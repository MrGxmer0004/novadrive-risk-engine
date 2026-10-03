(function () {
  const M = makeModel(DATA), MX = makeMatcher(DATA, M);
  const $ = id => document.getElementById(id);
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f2 = v => v.toFixed(2), money = v => '$' + Math.round(v).toLocaleString('en-US') + 'm';
  const pct = v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  const S = DATA.suppliers, byKey = M.byKey, evById = {}; DATA.evidence.forEach(e => evById[e.id] = e);
  const compById = {}; DATA.components.forEach(c => compById[c.id] = c);
  const SOLE = new Set(); DATA.links.forEach(l => { if (l.type === 'sole') SOLE.add(l.frm); });
  DATA.components.forEach(c => { const k = Object.keys(c.suppliers); if (k.length === 1) SOLE.add(k[0]); });
  const status = k => SOLE.has(k) ? 'Confirmed sole' : (M.siblings(k).length ? 'Second source qualified' : (M.downOf[k].some(l => l.type === 'candidate') ? 'Candidate link' : 'Exclusivity not stated'));
  const state = { lost: new Set(), repl: {}, realloc: false, D: 0.6, sort: { col: 'priority', dir: -1 } };
  const evBtns = ids => ids.map(i => `<button type="button" class="evid" data-ev="${h(i)}">${h(i)}</button>`).join('');
  const band = x => x >= 0.65 ? 'good' : x >= 0.45 ? 'warn' : 'crit';
  const bar = (x, cls) => `<span class="bar ${cls || band(x)}"><i style="width:${Math.max(0, Math.min(1, x)) * 100}%"></i></span>`;

  /* ---------- tabs ---------- */
  const TABS = ['sim', 'scorecard', 'alerts', 'alternates', 'evidence', 'method'];
  function show(tab) {
    if (TABS.indexOf(tab) < 0) tab = 'sim';
    TABS.forEach(t => { $('tab-' + t).hidden = t !== tab; });
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
    try { history.replaceState(null, '', '#' + tab); } catch (e) { }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));

  /* ---------- evidence drawer ---------- */
  function openEv(id) {
    const e = evById[id]; if (!e) return;
    $('drawer-body').innerHTML = `<h2 class="mono">${h(e.id)}</h2><p><span class="pill ${e.status === 'Expired' ? 'crit' : 'quiet'}">${h(e.status)}</span> <span class="muted small">${h(e.type)} · ${h(e.date)} · source family ${h(e.family)}</span></p><h3>${h(e.title)}</h3><p>${h(e.detail)}</p><p class="muted small">Workbook sheet: Relationship Evidence.</p>`;
    $('drawer').hidden = false; $('drawer-x').focus();
  }
  $('drawer-x').addEventListener('click', () => { $('drawer').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('drawer').hidden = true; });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ev]'); if (b) { openEv(b.dataset.ev); return; }
    const s = e.target.closest('[data-sim]'); if (s) { state.lost = new Set(s.dataset.sim.split('|')); state.repl = {}; state.realloc = false; renderSim(); show('sim'); return; }
    const a = e.target.closest('[data-alt]'); if (a) { $('sel-alt').value = a.dataset.alt; renderAlt(); show('alternates'); return; }
  });

  /* ---------- simulator ---------- */
  function fillSelect(sel) {
    sel.innerHTML = [1, 2, 3].map(t => `<optgroup label="Tier ${t}">` + S.filter(s => s.tier === t).map(s => `<option value="${h(s.key)}">${h(s.legal.replace(/ Ltd\.$/, ''))} · ${h(s.supplies)}</option>`).join('') + '</optgroup>').join('');
  }
  fillSelect($('sel-lost')); fillSelect($('sel-alt')); $('sel-lost').value = 'IonPeak'; $('sel-alt').value = 'IonPeak';
  function toggleLost(k) { if (state.lost.has(k)) { state.lost.delete(k); delete state.repl[k]; } else state.lost.add(k); if (!state.lost.size) state.realloc = false; renderSim(); }
  $('btn-add').addEventListener('click', () => { const k = $('sel-lost').value; if (!state.lost.has(k)) { state.lost.add(k); renderSim(); } });
  $('btn-reset').addEventListener('click', () => { state.lost = new Set(); state.repl = {}; state.realloc = false; renderSim(); });
  $('dep-slider').addEventListener('input', e => { state.D = parseFloat(e.target.value); $('dep-val').textContent = f2(state.D); renderSim(); renderScore(); renderAlerts(); });

  const P = { Yarrow: 108, Umber: 156, Verdant: 204, Warden: 252, Xenon: 300, Zenith: 396, Orion: 108, IonPeak: 156, Lumen: 204, Jade: 252, Kestrel: 300, Rill: 348, Meridian: 396, Nacre: 444, Pine: 492, Quartz: 540, Aster: 120, Boreal: 168, HarborSense: 228, Grove: 276, Cobalt: 324, 'Delta Capacitor': 420, Estuary: 492, ForgeLine: 540, M10: 120, M20: 168, B10: 252, C10: 324, C20: 420, H20: 492, H10: 540, P1: 204, P2: 348, P3: 468 };
  const COLX = { 3: 16, 2: 190, 1: 364, c: 538, p: 730 }, W = 150, WP = 132;
  function netSvg(base, loss, fix) {
    const cur = fix || loss, link = (x1, y1, x2, y2, cls, dash) => `<path d="M${x1} ${y1}C${x1 + 14} ${y1} ${x2 - 16} ${y2} ${x2} ${y2}" fill="none" stroke="var(${cls})" stroke-width="${cls === '--line' ? 1.25 : 2}"${dash ? ' stroke-dasharray="4 3"' : ''}/>`;
    let o = `<svg class="net" viewBox="0 50 878 524" role="img" aria-label="Supplier network from Tier 3 to products, coloured by the effect of the simulated loss">`;
    [['Tier 3', COLX[3] + W / 2], ['Tier 2', COLX[2] + W / 2], ['Tier 1', COLX[1] + W / 2], ['Component', COLX.c + W / 2], ['Product', COLX.p + WP / 2]].forEach(a => o += `<text x="${a[1]}" y="70" text-anchor="middle" font-size="12" font-weight="600" fill="var(--muted)">${a[0]}</text>`);
    o += `<rect x="${COLX[1] - 6}" y="96" width="${W + 12}" height="96" rx="8" fill="var(--surface-2)" stroke="var(--line)" stroke-dasharray="4 3"/><text x="${COLX[1] + W / 2}" y="205" text-anchor="middle" font-size="10.5" fill="var(--muted)">Both owned by CommonSpan</text>`;
    const hit = k => cur.E[k] < base.E[k] - 1e-9;
    DATA.links.forEach(l => { const a = byKey[l.frm], b = byKey[l.to]; const bad = state.lost.has(l.frm) && state.repl[l.frm] == null; o += link(COLX[a.tier] + W, P[l.frm], COLX[b.tier], P[l.to], bad ? '--crit' : (hit(l.frm) && hit(l.to) ? '--warn' : '--line'), l.type === 'candidate'); });
    DATA.components.forEach(c => {
      Object.keys(c.suppliers).forEach(k => { const bad = state.lost.has(k) && state.repl[k] == null; o += link(COLX[1] + W, P[k], COLX.c, P[c.id], bad ? '--crit' : (hit(k) ? '--warn' : '--line')); });
      c.products.forEach(p => { o += link(COLX.c + W, P[c.id], COLX.p, P[p], cur.C[c.id] < base.C[c.id] - 1e-9 ? '--warn' : '--line'); });
    });
    const box = (x, y, w, name, sub, kind, attrs) => {
      const col = { lost: ['--crit-soft', '--crit'], hit: ['--warn-soft', '--warn'], fix: ['--good-soft', '--good'], sole: ['--accent-soft', '--accent'], none: ['--surface', '--line'] }[kind];
      return `<g ${attrs || ''}><rect x="${x}" y="${y - 18}" width="${w}" height="36" rx="6" fill="var(${col[0]})" stroke="var(${col[1]})" stroke-width="${kind === 'none' ? 1.25 : 2}"/><text x="${x + w / 2}" y="${y - 3}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--ink)">${h(name)}</text><text x="${x + w / 2}" y="${y + 11}" text-anchor="middle" font-size="10.5" fill="var(--muted)" font-family="var(--font-mono)">${sub}</text></g>`;
    };
    const chg = (b, a) => Math.abs(a - b) > 1e-9 ? `E ${f2(b)} → ${f2(a)}` : `E ${f2(b)}`;
    S.forEach(s => {
      const k = s.key, kind = state.repl[k] != null ? 'fix' : state.lost.has(k) ? 'lost' : hit(k) ? 'hit' : SOLE.has(k) ? 'sole' : 'none';
      o += box(COLX[s.tier], P[k], W, k, chg(base.E[k], cur.E[k]), kind, `class="node" tabindex="0" role="button" data-node="${h(k)}" aria-label="${h(k)}: click to ${state.lost.has(k) ? 'restore' : 'lose'}"`);
    });
    DATA.components.forEach(c => o += box(COLX.c, P[c.id], W, ({ M10: 'M10 power assembly', M20: 'M20 HV power assy', C10: 'C10 control board', C20: 'C20 DC-link cap', H10: 'H10 housing', H20: 'H20 cooling', B10: 'B10 battery board' })[c.id], chg(base.C[c.id], cur.C[c.id]), cur.C[c.id] < base.C[c.id] - 1e-9 ? 'hit' : 'none'));
    DATA.products.forEach(p => o += box(COLX.p, P[p.id], WP, p.id + ' ' + p.name.split(' ')[0], chg(base.P[p.id], cur.P[p.id]), cur.P[p.id] < base.P[p.id] - 1e-9 ? 'hit' : 'none'));
    return o + '</svg>';
  }
  $('net-legend').innerHTML = [['--crit-soft', '--crit', 'Lost'], ['--warn-soft', '--warn', 'Efficiency reduced'], ['--good-soft', '--good', 'Replaced'], ['--accent-soft', '--accent', 'Confirmed sole source'], ['--surface', '--line', 'Unaffected']].map(a => `<span><i style="background:var(${a[0]});border-color:var(${a[1]})"></i>${a[2]}</span>`).join('');
  $('net-wrap').addEventListener('click', e => { const n = e.target.closest('[data-node]'); if (n) toggleLost(n.dataset.node); });
  $('net-wrap').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const n = e.target.closest('[data-node]'); if (n) { e.preventDefault(); toggleLost(n.dataset.node); } } });

  function renderSim() {
    const D = state.D, base = M.run({ D }), lostArr = Array.from(state.lost);
    const loss = M.run({ lost: state.lost, D }), cl = M.compare(base, loss);
    const hasFix = Object.keys(state.repl).length > 0 || state.realloc;
    const fix = hasFix ? M.run({ lost: state.lost, D, repl: Object.fromEntries(Object.entries(state.repl).map(([k, v]) => [k, v.x])), realloc: state.realloc }) : null;
    const cf = fix ? M.compare(base, fix) : null, cur = fix || loss;
    // chips
    $('lost-chips').innerHTML = lostArr.length ? lostArr.map(k => state.repl[k] ? `<span class="chip fix">${h(k)} replaced by ${h(state.repl[k].name)}<button type="button" data-unfix="${h(k)}" aria-label="Undo replacement of ${h(k)}">↺</button><button type="button" data-unlose="${h(k)}" aria-label="Restore ${h(k)}">×</button></span>` : `<span class="chip">${h(k)} lost<button type="button" data-unlose="${h(k)}" aria-label="Restore ${h(k)}">×</button></span>`).join('') + (state.realloc ? `<span class="chip fix">Volume shifted to second source<button type="button" data-unrealloc="1" aria-label="Undo reallocation">↺</button></span>` : '') : '<span class="muted small">No supplier is marked as lost. Pick one above or click a box in the network.</span>';
    // verdict
    const v = $('sim-verdict');
    if (!lostArr.length) { v.className = 'verdict idle'; v.innerHTML = `Baseline: total supply efficiency is <strong>${f2(base.T)}</strong>, limited by <strong>${h(base.Clim[base.Plim.P1])}</strong> on ${h(base.Plim.P1)}. Lose a supplier to see who and what is affected.`; }
    else {
      const names = lostArr.join(', ');
      let t = `Losing <strong>${h(names)}</strong> cuts total supply efficiency from <strong>${f2(base.T)}</strong> to <strong>${f2(loss.T)}</strong> (${pct(-cl.drop)}) and puts <strong>${money(cl.total)}</strong> of annual revenue at risk, about ${money(cl.weekly)} a week.`;
      if (cl.total < 0.5) t = `Losing <strong>${h(names)}</strong> leaves total supply efficiency at <strong>${f2(loss.T)}</strong>. Its customers are affected, but another link already limits every product more.`;
      if (fix) t += ` With the selected fix, efficiency returns to <strong>${f2(fix.T)}</strong>` + (fix.T >= base.T - 1e-9 ? ', at or above the baseline.' : `, still ${pct(-(1 - fix.T / base.T))} against the baseline.`);
      v.className = 'verdict' + (fix && fix.T >= base.T - 1e-9 ? ' ok' : ''); v.innerHTML = t;
    }
    // kpis
    const weeks = lostArr.reduce((a, k) => Math.max(a, M.leadWeeks(k)), 0), hitP = DATA.products.filter(p => loss.P[p.id] < base.P[p.id] - 1e-9);
    $('sim-kpis').innerHTML = [
      ['Total supply efficiency', lostArr.length ? `${f2(base.T)} → ${f2(loss.T)}` + (fix ? ` → ${f2(fix.T)}` : '') : f2(base.T), lostArr.length ? (fix ? 'baseline → after loss → after fix' : 'baseline → after loss') : 'revenue-weighted, 0 to 1'],
      ['Revenue at risk', lostArr.length ? money(cl.total) : '$0m', lostArr.length ? `${money(cl.weekly)} a week` + (fix ? ` · ${money(cf.total)} after fix` : '') : `of ${money(M.REV)} in scope`],
      ['Products hit', lostArr.length ? (hitP.length ? hitP.map(p => p.id).join(', ') : 'None') : '—', lostArr.length ? Object.keys(cl.plants).filter(p => cl.plants[p] > 0.5).map(p => `${p.split(' ')[0]} ${money(cl.plants[p])}`).join(' · ') || 'no plant loses output' : 'P1 DriveCore, P2 ChargeBridge, P3 StoreLink'],
      ['Qualification floor', lostArr.length ? `${weeks} weeks` : '—', lostArr.length ? `up to ${money(cl.weekly * weeks)} exposed while a replacement qualifies` : 'time to qualify a replacement']
    ].map(k => `<div class="kpi"><span class="lab">${k[0]}</span><span class="v">${k[1]}</span><span class="s">${h(k[2])}</span></div>`).join('');
    // network
    $('net-wrap').innerHTML = netSvg(base, loss, fix);
    // suppliers table
    const rows = [];
    S.forEach(s => {
      const k = s.key, b = base.E[k], a = loss.E[k], c = cur.E[k];
      if (state.lost.has(k)) rows.push({ k, role: state.repl[k] ? `Lost, replaced by ${state.repl[k].name}` : 'Lost', cls: state.repl[k] ? 'good' : 'crit', b, a, c, o: 0 });
      else if (a < b - 1e-9) rows.push({ k, role: `Input short; now limited by ${loss.lim[k]}`, cls: 'warn', b, a, c, o: 1 });
    });
    M.demandLoss(state.lost).forEach(d => { if (!rows.find(r => r.k === d.key)) rows.push({ k: d.key, role: `Loses customer ${d.customers.join(', ')} (${Math.round(d.share * 100)}% of mapped demand)`, cls: 'info', b: base.E[d.key], a: loss.E[d.key], c: cur.E[d.key], o: 2 }); else rows.find(r => r.k === d.key).role += `; also loses customer ${d.customers.join(', ')}`; });
    rows.sort((x, y) => x.o - y.o || (y.b - y.a) - (x.b - x.a));
    $('tbl-sup').innerHTML = rows.length ? `<table><thead><tr><th>Supplier</th><th>Tier</th><th>Effect</th><th class="n">X</th><th class="n">E before</th><th class="n">E after</th><th class="n">Change</th>${fix ? '<th class="n">E with fix</th>' : ''}</tr></thead><tbody>` + rows.map(r => `<tr><td><strong>${h(r.k)}</strong><br><span class="muted small">${h(byKey[r.k].supplies)}</span></td><td>${byKey[r.k].tier}</td><td><span class="pill ${r.cls}">${r.o === 0 ? (state.repl[r.k] ? 'Replaced' : 'Lost') : r.o === 1 ? 'Downstream' : 'Upstream'}</span><br><span class="small">${h(r.role)}</span></td><td class="n">${f2(byKey[r.k].x)}</td><td class="n">${f2(r.b)}</td><td class="n">${f2(r.a)}</td><td class="n ${r.a < r.b - 1e-9 ? 'neg' : ''}">${r.b > 0 && Math.abs(r.a - r.b) > 1e-9 ? pct(r.a / r.b - 1) : '0%'}</td>${fix ? `<td class="n">${f2(r.c)}</td>` : ''}</tr>`).join('') + '</tbody></table>' : '<p class="muted">No supplier is affected yet.</p>';
    // components
    $('tbl-comp').innerHTML = `<table><thead><tr><th>Component</th><th>Tier-1 share</th><th class="n">E before</th><th class="n">E after</th><th class="n">Change</th>${fix ? '<th class="n">E with fix</th>' : ''}<th>Limited by</th></tr></thead><tbody>` + DATA.components.map(c => { const b = base.C[c.id], a = loss.C[c.id]; return `<tr><td><strong>${h(c.id)}</strong> ${h(c.name)}</td><td class="small">${Object.keys(cur.shares[c.id]).map(k => `${h(k)} ${Math.round(cur.shares[c.id][k] * 100)}%`).join(', ')}</td><td class="n">${f2(b)}</td><td class="n">${f2(a)}</td><td class="n ${a < b - 1e-9 ? 'neg' : ''}">${Math.abs(a - b) > 1e-9 ? pct(a / b - 1) : '0%'}</td>${fix ? `<td class="n">${f2(fix.C[c.id])}</td>` : ''}<td>${h(cur.Clim[c.id] || '')}</td></tr>`; }).join('') + '</tbody></table>';
    $('tbl-prod').innerHTML = `<table><thead><tr><th>Product</th><th class="n">Revenue</th><th class="n">E before</th><th class="n">E after</th><th class="n">Revenue at risk</th>${fix ? '<th class="n">After fix</th>' : ''}<th>Limited by</th></tr></thead><tbody>` + DATA.products.map(p => `<tr><td><strong>${h(p.id)}</strong> ${h(p.name)}</td><td class="n">${money(p.rev)}</td><td class="n">${f2(base.P[p.id])}</td><td class="n">${f2(loss.P[p.id])}</td><td class="n ${cl.rar[p.id] > 0.5 ? 'neg' : ''}">${money(cl.rar[p.id])}</td>${fix ? `<td class="n">${money(cf.rar[p.id])}</td>` : ''}<td>${h(cur.Plim[p.id])}</td></tr>`).join('') + '</tbody></table>';
    renderFix(base, loss);
  }
  $('lost-chips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.unlose) toggleLost(b.dataset.unlose);
    else if (b.dataset.unfix) { delete state.repl[b.dataset.unfix]; renderSim(); }
    else if (b.dataset.unrealloc) { state.realloc = false; renderSim(); }
  });

  function renderFix(base, loss) {
    const D = state.D, out = [], replX = Object.fromEntries(Object.entries(state.repl).map(([k, v]) => [k, v.x]));
    Array.from(state.lost).forEach(k => {
      const s = byKey[k], cat = ALTS.cats[s.cat], others = Object.assign({}, replX); delete others[k];
      const need = M.minX(k, { lost: state.lost, D, repl: others, realloc: state.realloc });
      const sib = M.siblings(k).filter(x => !state.lost.has(x));
      let html = `<div class="panel"><div class="split"><h2>Compensating for ${h(k)}</h2><span class="muted small">${h(s.supplies)} · ${h(status(k))} · qualification at least ${M.leadWeeks(k)} weeks</span></div>`;
      html += `<p>${need == null ? 'No single replacement restores the baseline while the other losses stand.' : need === 0 ? `Total efficiency does not depend on this supplier at the current settings, so any qualified replacement holds the baseline of ${f2(base.T)}.` : `To hold total efficiency at ${f2(base.T)}, a replacement needs a reliability score of <strong>X ≥ ${f2(need)}</strong>.`}</p>`;
      if (sib.length) {
        const r = M.run({ lost: state.lost, D, repl: others, realloc: true });
        html += `<div class="cand"><div><span class="tag">Already qualified</span><h4>Shift volume to ${h(sib.join(', '))}</h4><p class="small muted">${h(sib.join(', '))} is qualified for the same component (see the qualification register). Capacity to take the full volume is not in the data and must be confirmed.</p></div><div><span class="lab">Total efficiency after shift</span><div class="mono" style="font-size:18px">${f2(r.T)} ${r.T >= base.T - 1e-9 ? '<span class="pill good">Holds baseline</span>' : '<span class="pill warn">Below baseline</span>'}</div></div><div><button type="button" class="btn ${state.realloc ? 'ghost' : ''}" data-realloc="1">${state.realloc ? 'Undo shift' : 'Apply shift'}</button></div></div>`;
      }
      const cands = cat.cands.map(c => { const r = Object.assign({}, others); r[k] = c.X; const t = M.run({ lost: state.lost, D, repl: r, realloc: state.realloc }).T; return { c, t, ok: need != null && c.X >= need - 1e-9 }; }).sort((a, b) => (b.ok - a.ok) || (b.c.F - a.c.F));
      cands.forEach((o, i) => {
        const c = o.c, on = state.repl[k] && state.repl[k].name === c.name;
        html += `<div class="cand"><div>${i === 0 && o.ok ? '<span class="tag">Suggested first</span>' : ''}<h4>${h(c.name)}</h4><p class="small muted">${h(c.hq)} · ${h(c.what)}</p>${c.note ? `<p class="small"><span class="pill warn">Note</span> ${h(c.note)}</p>` : ''}</div>
          <div class="crit-list"><span>Fitment</span>${bar(c.F, 'good')}<span class="mono">${f2(c.F)}</span><span>Est. X</span>${bar(c.X)}<span class="mono">${f2(c.X)}</span><span>Total E</span>${bar(o.t, o.t >= base.T - 1e-9 ? 'good' : 'warn')}<span class="mono">${f2(o.t)}</span></div>
          <div><p class="small">${o.ok ? '<span class="pill good">Holds baseline</span>' : '<span class="pill warn">Below required X</span>'} ${c.ev.map(e => `<a href="${h(e.url)}" target="_blank" rel="noopener">${h(e.title)}</a>`).join(' · ')}</p><p style="margin-top:8px"><button type="button" class="btn small ${on ? 'ghost' : ''}" data-apply="${h(k)}" data-cand="${h(c.name)}">${on ? 'Undo' : 'Apply as replacement'}</button> <button type="button" class="btn ghost small" data-alt="${h(k)}">Full assessment</button></p></div></div>`;
      });
      out.push(html + '</div>');
    });
    $('fix-section').innerHTML = out.join('');
  }
  $('fix-section').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.realloc) { state.realloc = !state.realloc; renderSim(); }
    else if (b.dataset.apply) {
      const k = b.dataset.apply, c = ALTS.cats[byKey[k].cat].cands.find(x => x.name === b.dataset.cand);
      if (state.repl[k] && state.repl[k].name === c.name) delete state.repl[k]; else state.repl[k] = { name: c.name, x: c.X };
      renderSim();
    }
  });

  /* ---------- scorecard ---------- */
  function renderScore() {
    const sc = M.scorecard(state.D), base = M.run({ D: state.D });
    const rows = sc.map(r => Object.assign({}, r, { s: byKey[r.key] }));
    const get = { rank: r => r.rank, name: r => r.key, tier: r => r.s.tier, zone: r => r.s.zone, x: r => r.x, fin: r => r.s.sub.fin, op: r => r.s.sub.op, geo: r => r.s.sub.geo, assur: r => r.s.sub.assur, e: r => r.e, loss: r => r.loss, rar: r => r.rar, priority: r => r.priority, conf: r => ({ High: 3, Medium: 2, Low: 1 }[r.s.conf]) };
    const g = get[state.sort.col] || get.priority;
    rows.sort((a, b) => { const x = g(a), y = g(b); return (x < y ? -1 : x > y ? 1 : 0) * state.sort.dir; });
    const th = (c, l, n) => `<th class="sortable${n ? ' n' : ''}" data-col="${c}" tabindex="0">${l}${state.sort.col === c ? (state.sort.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`;
    $('tbl-score').innerHTML = `<table><thead><tr>${th('rank', '#', 1)}${th('name', 'Supplier')}${th('tier', 'Tier', 1)}${th('zone', 'Zone')}${th('x', 'X reliability')}${th('fin', 'Fin.', 1)}${th('op', 'Ops', 1)}${th('geo', 'Geo', 1)}${th('assur', 'Assur.', 1)}${th('e', 'E in chain', 1)}${th('loss', 'Loss impact')}${th('rar', 'Rev. at risk', 1)}${th('priority', 'Priority', 1)}${th('conf', 'Evidence')}</tr></thead><tbody>` + rows.map(r => {
      const s = r.s, st = status(r.key), star = s.imputed ? '*' : '';
      return `<tr><td class="n">${r.rank}</td><td><strong>${h(r.key)}</strong><br><span class="muted small">${h(s.supplies)}</span><br><span class="pill ${st === 'Confirmed sole' ? 'info' : 'quiet'}">${h(st)}</span> <button type="button" class="btn ghost small" data-sim="${h(r.key)}">Simulate</button></td><td class="n">${s.tier}</td><td>${h(s.zone)}${DATA.zones[s.zone] ? '<br><span class="muted small">' + h(DATA.zones[s.zone]) + '</span>' : ''}</td><td>${bar(r.x)}<span class="mono">${f2(r.x)}</span></td><td class="n">${f2(s.sub.fin)}${star}</td><td class="n">${f2(s.sub.op)}</td><td class="n">${f2(s.sub.geo)}</td><td class="n">${f2(s.sub.assur)}${star}</td><td class="n">${f2(r.e)}${r.lim !== r.key ? '<br><span class="muted small">' + h(r.lim) + '</span>' : ''}</td><td>${bar(r.loss, r.loss >= 0.5 ? 'crit' : r.loss >= 0.1 ? 'warn' : 'good')}<span class="mono">${f2(r.loss)}</span></td><td class="n">${money(r.rar)}</td><td class="n"><strong>${f2(r.priority)}</strong></td><td><span class="pill ${s.conf === 'High' ? 'good' : s.conf === 'Medium' ? 'quiet' : 'warn'}">${h(s.conf)}</span></td></tr>`;
    }).join('') + '</tbody></table>';
  }
  $('tbl-score').addEventListener('click', e => { const t = e.target.closest('th[data-col]'); if (!t) return; const c = t.dataset.col; state.sort = { col: c, dir: state.sort.col === c ? -state.sort.dir : (c === 'name' || c === 'zone' || c === 'rank' || c === 'tier' ? 1 : -1) }; renderScore(); });

  /* ---------- alerts ---------- */
  function alertCard(r) {
    const cls = r.verdict === 'Alert' ? (r.level === 'High' ? 'crit' : 'warn') : r.verdict === 'Watch' || r.verdict === 'Information' ? 'info' : '';
    const pill = r.verdict === 'Alert' ? `<span class="pill ${cls}">Alert · ${h(r.level)}</span>` : `<span class="pill ${r.verdict === 'Watch' || r.verdict === 'Information' ? 'info' : 'quiet'}">${h(r.verdict)}</span>`;
    const ents = r.entities.filter(e => !e.negated).map(e => `${h(e.legal)} (${h(e.id)}${e.key ? ', ' + h(e.site) + ' in ' + h(e.zone) : ''})`).join('; ');
    return `<div class="panel alert ${cls}"><div class="head">${pill}<h3>${h(r.ev.id)} · ${h(r.ev.title)}</h3><span class="muted small">published ${h(r.ev.published)}${r.ev.effective !== r.ev.published ? ', effective ' + h(r.ev.effective) : ''} · ${h(r.typeLabel)}</span></div>
      <p class="muted">${h(r.ev.detail)}</p>
      <p><strong>Match.</strong> ${h(r.reason)}${ents ? ' Entity: ' + ents + '.' : ''}${r.zones.length && r.verdict === 'Alert' && !ents ? ' Suppliers in zone: ' + h(r.nodes.join(', ')) + '.' : ''}</p>
      ${r.why ? `<p><strong>Why it matters.</strong> ${h(r.why)}</p>` : ''}
      <div><strong>Next action.</strong><ul>${r.actions.map(a => `<li>${h(a)}</li>`).join('')}</ul></div>
      ${r.nodes.length && r.verdict === 'Alert' ? `<div class="row"><button type="button" class="btn small" data-sim="${h(r.nodes.join('|'))}">Simulate this loss</button>${r.nodes.length === 1 ? `<button type="button" class="btn ghost small" data-alt="${h(r.nodes[0])}">See alternates</button>` : ''}</div>` : ''}
      <details><summary>How this was matched</summary><ol class="trace">${r.trace.map(t => `<li>${h(t)}</li>`).join('')}</ol></details></div>`;
  }
  function renderAlerts() {
    const res = MX.runFeed(DATA.events), ord = { Alert: 0, Watch: 1, Information: 2, Duplicate: 3, Suppress: 4 };
    res.sort((a, b) => (ord[a.verdict] - ord[b.verdict]) || ((a.level === 'High' ? 0 : 1) - (b.level === 'High' ? 0 : 1)));
    const n = res.filter(r => r.verdict === 'Alert').length;
    $('alert-list').innerHTML = `<p><strong>${n} of ${res.length}</strong> signals reach the supplier network and warrant an alert. The rest are shown with the reason they were held back.</p>` + res.map(alertCard).join('');
  }
  $('btn-match').addEventListener('click', () => {
    const ev = { id: 'TEST', title: $('ev-title').value, detail: $('ev-detail').value, published: $('ev-pub').value, effective: $('ev-eff').value || $('ev-pub').value, family: 'USER-TEST' };
    $('custom-alert').innerHTML = alertCard(MX.match(ev, DATA.events));
  });

  /* ---------- alternates ---------- */
  function renderAlt() {
    const k = $('sel-alt').value, s = byKey[k], cat = ALTS.cats[s.cat], need = M.minX(k, { lost: new Set([k]), D: state.D }), base = M.run({ D: state.D });
    const comp = DATA.components.filter(c => c.suppliers[k] != null);
    $('alt-context').innerHTML = `<p><strong>${h(s.legal)}</strong> supplies <strong>${h(cat.input)}</strong>. Search basis: ${h(cat.basis)}</p>` +
      (comp.length ? `<p class="small muted">Component context from the workbook: ${comp.map(c => h(c.id + ' ' + c.name + ': ' + c.app + '. ' + c.criteria.split('\n').pop().replace(/^3\.\s*Supplier Screening Criteria:\s*/, ''))).join(' ')}</p>` : '') +
      `<p class="small">Replacement needs X ≥ <span class="mono">${f2(need == null ? 1 : need)}</span> to hold total efficiency at ${f2(base.T)}. Qualification takes at least ${M.leadWeeks(k)} weeks. Sources were opened on ${h(ALTS.accessed)}.</p>
       <div><span class="lab">What sourcing and engineering still need to validate</span><ul>${cat.validate.map(v => `<li>${h(v)}</li>`).join('')}</ul></div>
       <div><button type="button" class="btn small" data-sim="${h(k)}">Simulate losing ${h(k)}</button></div>`;
    const lab = { tech: 'Technical capability', app: 'Application relevance', foot: 'Manufacturing footprint', scale: 'Scale', pres: 'Presence and qualification' }, xl = { fin: 'Financial standing', op: 'Delivery (not public)', geo: 'Footprint spread', assur: 'Assurance' };
    $('alt-cands').innerHTML = `<h2>Shortlist for ${h(cat.input.toLowerCase())}</h2>` + cat.cands.map(c => `<div class="cand"><div><h4>${h(c.name)}</h4><p class="small muted">${h(c.hq)}</p><p class="small">${h(c.what)}</p>${c.note ? `<p class="small"><span class="pill warn">Note</span> ${h(c.note)}</p>` : ''}<p class="small" style="margin-top:6px">${c.X >= (need == null ? 1 : need) - 1e-9 ? '<span class="pill good">Meets required X</span>' : '<span class="pill warn">Below required X</span>'}</p></div>
      <div><div class="crit-list"><strong>Fitment</strong><span></span><strong class="mono">${f2(c.F)}</strong>${Object.keys(lab).map(q => `<span>${lab[q]}</span>${bar(c.fit[q] / 5, 'good')}<span class="mono">${c.fit[q]}/5</span>`).join('')}</div>
      <div class="crit-list" style="margin-top:10px"><strong>Reliability estimate X</strong><span></span><strong class="mono">${f2(c.X)}</strong>${Object.keys(xl).map(q => `<span>${xl[q]}</span>${bar(c.xe[q])}<span class="mono">${f2(c.xe[q])}</span>`).join('')}</div></div>
      <div><span class="lab">Public evidence</span><ul>${c.ev.map(e => `<li class="small"><a href="${h(e.url)}" target="_blank" rel="noopener">${h(e.title)}</a><span class="muted"> · ${e.date ? 'dated ' + h(e.date) + ', ' : ''}opened ${h(ALTS.accessed)}</span><br>${h(e.claim)}</li>`).join('')}</ul></div></div>`).join('');
  }
  $('sel-alt').addEventListener('change', renderAlt);

  /* ---------- evidence ---------- */
  function renderEvidence() {
    const rows = [];
    DATA.components.forEach(c => Object.keys(c.suppliers).forEach(k => rows.push({ t: 1, frm: k, to: 'NovaDrive', input: `${c.id} ${c.name} (${Math.round(c.suppliers[k] * 100)}%)`, site: byKey[k].site, zone: byKey[k].zone, ev: c.ev[k], conf: 'Confirmed', st: Object.keys(c.suppliers).length === 1 ? 'Only qualified supplier' : 'Second source qualified' })));
    DATA.links.forEach(l => rows.push({ t: byKey[l.frm].tier, frm: l.frm, to: l.to, input: l.input, site: byKey[l.frm].site, zone: byKey[l.frm].zone, ev: l.ev, conf: l.type === 'sole' ? 'Confirmed' : l.type === 'candidate' ? 'Candidate' : 'Disclosed', st: l.type === 'sole' ? 'Sole source stated' : l.type === 'candidate' ? 'Needs verification' : 'Exclusivity not stated' }));
    $('tbl-links').innerHTML = `<table><thead><tr><th class="n">Tier</th><th>Supplier</th><th>Customer</th><th>Input or component</th><th>Site</th><th>Status</th><th>Confidence</th><th>Evidence (click to read)</th></tr></thead><tbody>` + rows.map(r => `<tr><td class="n">${r.t}</td><td><strong>${h(r.frm)}</strong></td><td>${h(r.to)}</td><td>${h(r.input)}</td><td class="mono small">${h(r.site)} · ${h(r.zone)}</td><td>${h(r.st)}</td><td><span class="pill ${r.conf === 'Confirmed' ? 'good' : r.conf === 'Candidate' ? 'warn' : 'quiet'}">${r.conf}</span></td><td>${evBtns(r.ev)}</td></tr>`).join('') + '</tbody></table>';
    $('tbl-excl').innerHTML = `<table><thead><tr><th>Entity or record</th><th>Treatment</th><th>Reason</th><th>Evidence</th></tr></thead><tbody>` + DATA.excluded.map(x => `<tr><td><strong>${h(x.what)}</strong></td><td><span class="pill quiet">${h(x.treat)}</span></td><td>${h(x.why)}</td><td>${evBtns(x.ev)}</td></tr>`).join('') + '</tbody></table>';
    renderEvLog();
  }
  function renderEvLog() {
    const q = $('ev-filter').value.trim().toLowerCase();
    const list = DATA.evidence.filter(e => !q || (e.id + ' ' + e.title + ' ' + e.detail + ' ' + e.type + ' ' + e.family).toLowerCase().indexOf(q) >= 0);
    $('tbl-evid').innerHTML = `<table><thead><tr><th>ID</th><th>Date</th><th>Type</th><th>Source family</th><th>Record</th></tr></thead><tbody>` + (list.length ? list.map(e => `<tr><td>${evBtns([e.id])}</td><td class="mono small">${h(e.date)}</td><td class="small">${h(e.type)}${e.status === 'Expired' ? ' <span class="pill crit">Expired</span>' : ''}</td><td class="mono small">${h(e.family)}</td><td class="small"><strong>${h(e.title)}</strong><br>${h(e.detail)}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">No record matches that filter.</td></tr>') + '</tbody></table>';
  }
  $('ev-filter').addEventListener('input', renderEvLog);

  function start() { renderSim(); renderScore(); renderAlerts(); renderAlt(); renderEvidence(); show((location.hash || '#sim').slice(1)); }
  state.lost = new Set(['IonPeak']);
  start();
})();
