/* Event matcher: external signal -> supplier, facility or zone -> management alert. Rule-based and explainable. */
function makeMatcher(DATA, M) {
  const U = DATA.universe, zones = DATA.zones;
  const keyById = {}; DATA.suppliers.forEach(s => keyById[s.id] = s.key);
  const REG = { 'REG-NO-4128': 'ORG-309' };
  const KNOWN_OTHER = [{ name: 'OceanLink', what: 'terminal operator named in DOC-083; not a supplier' }];
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ents = U.map(u => ({ id: u.id, legal: u.legal, stem: u.legal.replace(/\s+Ltd\.?$/, ''), first: u.legal.split(' ')[0], zone: u.zone, site: u.site, role: u.role, note: u.note, key: keyById[u.id] || null }));
  const firstCount = {}; ents.forEach(e => firstCount[e.first] = (firstCount[e.first] || 0) + 1);
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const TYPES = [
    ['admin', /headquarter|head office|relocat|administrative|registered office/i, 'Administrative change'],
    ['correction', /correct|allegation|clarif|retract/i, 'Correction or allegation'],
    ['financial', /insolven|restructur|covenant|creditor|financing|bankrupt|default|liquidity|delayed payments/i, 'Financial distress'],
    ['hazard', /flood|storm|earthquake|fire|typhoon|cyclone|power outage|shutdown|strike|explosion|landslide/i, 'Physical or labour hazard'],
    ['logistics', /port|terminal|congestion|delay|shipping|freight|customs|departures/i, 'Logistics disruption']
  ];
  const MILD = /no (factory )?(damage|shutdown)|not confirmed|is confirmed\.?$|no .{0,40} confirmed|production continues|has not been assessed|watch/i;

  function match(ev, earlier) {
    const text = (ev.title + '. ' + ev.detail).trim(), trace = [];
    const out = { id: ev.id, ev, trace, entities: [], zones: [], nodes: [], type: null, typeLabel: 'Unclassified', verdict: 'Suppress', level: null, reason: '', why: '', actions: [], dupOf: null };
    // 1 freshness
    const gap = ev.effective && ev.published ? days(ev.effective, ev.published) : 0;
    out.stale = gap > 90;
    trace.push(out.stale ? `Freshness: effective ${ev.effective} is ${gap} days before publication ${ev.published}. Stale.` : `Freshness: effective ${ev.effective || 'not given'}, published ${ev.published || 'not given'}. Current.`);
    // 2 duplicate
    const dup = (earlier || []).find(e => ev.family && e.family === ev.family && e.id !== ev.id);
    if (dup) { out.dupOf = dup.id; trace.push(`Source family ${ev.family} already seen in ${dup.id}. Duplicate.`); }
    else trace.push(ev.family ? `Source family ${ev.family}: first occurrence.` : 'Source family: not given.');
    // 3 geography
    let scrub = text;
    Object.keys(zones).forEach(z => {
      const nm = zones[z]; let hit = new RegExp('\\b' + z + '\\b').test(text);
      if (nm && new RegExp(esc(nm), 'i').test(text)) { hit = true; scrub = scrub.replace(new RegExp(esc(nm), 'ig'), ' '); }
      if (hit) out.zones.push(z);
    });
    trace.push(out.zones.length ? 'Geography: ' + out.zones.map(z => z + (zones[z] ? ' (' + zones[z] + ')' : '')).join(', ') + '.' : 'Geography: no zone code or mapped zone name found.');
    // 4 entities
    const seen = {};
    const add = (e, how, negated) => { if (seen[e.id]) { if (!negated) seen[e.id].negated = false; return; } seen[e.id] = { id: e.id, legal: e.legal, key: e.key, how, negated, zone: e.zone, site: e.site, role: e.role, note: e.note }; out.entities.push(seen[e.id]); };
    Object.keys(REG).forEach(r => { if (text.indexOf(r) >= 0) { const e = ents.find(x => x.id === REG[r]); add(e, 'registry number ' + r, false); } });
    ents.slice().sort((a, b) => b.stem.length - a.stem.length).forEach(e => {
      const re = new RegExp('\\b' + esc(e.stem) + '\\b', 'i');
      if (re.test(scrub)) { const neg = new RegExp('\\bnot\\s+(?:the\\s+)?' + esc(e.stem), 'i').test(scrub); add(e, 'full legal name', neg); scrub = scrub.replace(new RegExp(esc(e.stem), 'ig'), ' '); }
    });
    ents.forEach(e => {
      if (seen[e.id]) return;
      if (new RegExp('\\b' + esc(e.first) + '\\b').test(scrub)) {
        if (firstCount[e.first] === 1) add(e, 'short name "' + e.first + '"', new RegExp('\\bnot\\s+(?:the\\s+)?' + esc(e.first) + '\\b').test(scrub));
        else add(e, 'ambiguous short name "' + e.first + '" (' + firstCount[e.first] + ' entities share it)', false);
      }
    });
    const others = KNOWN_OTHER.filter(k => text.indexOf(k.name) >= 0);
    out.entities.forEach(e => trace.push(`Entity: ${e.legal} (${e.id}) by ${e.how}` + (e.negated ? ' (the text says it is NOT this entity).' : '') + (e.key ? '; in the supplier network.' : '; not in the supplier network.')));
    others.forEach(k => trace.push(`Entity: ${k.name}: ${k.what}.`));
    if (!out.entities.length && !others.length) trace.push('Entity: no known legal name or registry number found.');
    // 5 type
    for (const t of TYPES) { if (t[1].test(text)) { out.type = t[0]; out.typeLabel = t[2]; break; } }
    const mild = MILD.test(text);
    trace.push('Signal type: ' + out.typeLabel + (mild ? ' (no confirmed damage or stoppage).' : '.'));
    // 6 decision
    const pos = out.entities.filter(e => !e.negated), posNet = pos.filter(e => e.key), negNet = out.entities.filter(e => e.negated && e.key);
    const zoneNodes = DATA.suppliers.filter(s => out.zones.indexOf(s.zone) >= 0).map(s => s.key);
    const base = M.run({});
    const sim = keys => { const a = M.run({ lost: new Set(keys) }), c = M.compare(base, a); const comp = new Set(); keys.forEach(k => M.compsOf[k].forEach(x => comp.add(x))); return { a, c, comps: Array.from(comp).sort() }; };
    const names = keys => keys.join(', ');
    if (out.stale) { out.verdict = 'Suppress'; out.reason = 'Stale: the event took effect ' + gap + ' days before it was republished.'; out.actions = ['No action. Filter on effective date, not publish date.']; }
    else if (out.dupOf) { out.verdict = 'Duplicate'; out.reason = 'Same source family as ' + out.dupOf + '; it adds no independent evidence.'; out.actions = ['Attach to ' + out.dupOf + ' as a citation. Do not raise severity.']; }
    else if (posNet.length && out.type === 'admin') {
      out.verdict = 'Information'; out.nodes = posNet.map(e => e.key);
      out.reason = 'Administrative change at an office site; the production site is unchanged.';
      out.actions = ['Update the address record. No supply action.'];
    }
    else if (posNet.length) {
      out.nodes = posNet.map(e => e.key); const s = sim(out.nodes), minx = Math.min.apply(null, out.nodes.map(k => M.byKey[k].x));
      out.verdict = 'Alert'; out.level = (out.type === 'financial' && minx < 0.4) || (!mild && out.type === 'hazard') ? 'High' : 'Medium';
      out.reason = out.typeLabel + ' at a supplier in the network' + (out.type === 'financial' && minx < 0.4 ? ', corroborated by its reliability score X of ' + minx.toFixed(2) + '.' : '.');
      out.why = whyText(out.nodes, s);
      out.actions = actionsFor(out, s);
    }
    else if (zoneNodes.length && (out.type === 'hazard' || out.type === 'logistics')) {
      out.nodes = zoneNodes; const s = sim(zoneNodes);
      out.verdict = 'Alert'; out.level = mild ? 'Medium' : 'High';
      out.reason = out.typeLabel + ' in ' + out.zones.join(', ') + ', where ' + zoneNodes.length + ' network suppliers have plants' + (mild ? '; no damage or stoppage is confirmed.' : '.');
      out.why = whyText(zoneNodes, s);
      out.actions = actionsFor(out, s);
    }
    else if (pos.length && !posNet.length) {
      out.verdict = 'Suppress';
      out.reason = pos.map(e => e.legal).join(', ') + ' is not in the supplier network' + (negNet.length ? '; the similar name ' + negNet.map(e => e.legal).join(', ') + ' is explicitly ruled out.' : '.');
      out.actions = ['No action. Keep as a name-collision test case.'];
    }
    else if (out.type === 'logistics' || out.type === 'hazard') {
      out.verdict = 'Watch';
      out.reason = 'No supplier, site or mapped zone can be matched, so the affected lanes are unknown.';
      out.actions = ['Find out which inbound lanes use the named location; all observed Tier-1 shipments move by ocean.', 'Re-run the match once the location is mapped to a zone or a supplier.'];
    }
    else { out.verdict = 'Suppress'; out.reason = 'No link to the supplier network was found.'; out.actions = ['No action.']; }
    trace.push('Decision: ' + out.verdict + (out.level ? ' (' + out.level + ')' : '') + '. ' + out.reason);
    return out;

    function whyText(keys, s) {
      const sole = keys.filter(k => ['IonPeak', 'Jade', 'Cobalt', 'Delta Capacitor', 'Estuary', 'ForgeLine'].indexOf(k) >= 0);
      const prods = DATA.products.filter(p => s.a.P[p.id] < base.P[p.id] - 1e-9).map(p => p.id);
      return `${names(keys)} ${keys.length > 1 ? 'feed' : 'feeds'} ${s.comps.join(', ')}. If ${keys.length > 1 ? 'they' : 'it'} stopped, total supply efficiency would fall from ${base.T.toFixed(2)} to ${s.a.T.toFixed(2)} and about $${Math.round(s.c.total).toLocaleString('en-US')}m of annual revenue would be at risk` + (prods.length ? ` (${prods.join(', ')})` : '') + '.' + (sole.length ? ` ${names(sole)} ${sole.length > 1 ? 'are confirmed sole sources' : 'is a confirmed sole source'}.` : '');
    }
    function actionsFor(o, s) {
      const cust = new Set(); o.nodes.forEach(k => M.downOf[k].forEach(l => { if (o.nodes.indexOf(l.to) < 0) cust.add(l.to); }));
      const custs = Array.from(cust);
      if (o.type === 'financial') return [
        custs.length ? `Ask ${names(custs)} whether ${names(o.nodes)} is the only source for the input, and how many weeks of stock are held.` : `Ask ${names(o.nodes)} for a continuity plan and current stock position.`,
        'Start alternate-supplier screening now; see the shortlist for ' + names(o.nodes) + '.',
        'Monitor for a supply stoppage as creditor payments slip.'];
      return [`Confirm site status with ${names(o.nodes)}.`,
        custs.length ? `Get stock cover in weeks from ${names(custs)}.` : 'Get stock cover in weeks from NovaDrive plants.',
        'Pre-authorise expedited buys if a stoppage is confirmed.'];
    }
  }
  function runFeed(events) { const done = [], res = []; events.forEach(e => { res.push(match(e, done)); done.push(e); }); return res; }
  return { match, runFeed };
}
if (typeof module !== 'undefined') module.exports = { makeMatcher };
