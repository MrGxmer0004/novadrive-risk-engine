/* NovaDrive loss model. Pure functions, no DOM. */
function makeModel(DATA) {
  const S = DATA.suppliers, byKey = {};
  S.forEach(s => byKey[s.key] = s);
  const links = DATA.links, comps = DATA.components, prods = DATA.products;
  const REV = prods.reduce((a, p) => a + p.rev, 0);
  const upOf = {}, downOf = {};
  S.forEach(s => { upOf[s.key] = []; downOf[s.key] = []; });
  links.forEach(l => { upOf[l.to].push(l); downOf[l.frm].push(l); });
  const compsOf = {};
  function compsFed(k) {
    if (compsOf[k]) return compsOf[k];
    const out = new Set();
    comps.forEach(c => { if (c.suppliers[k] != null) out.add(c.id); });
    downOf[k].forEach(l => compsFed(l.to).forEach(c => out.add(c)));
    return compsOf[k] = out;
  }
  S.forEach(s => compsFed(s.key));
  const dep = (l, D) => l.type === 'sole' ? 1 : D;

  /* opt: {lost:Set, D:number, repl:{key:x}, realloc:boolean} */
  function run(opt) {
    opt = opt || {};
    const lost = opt.lost || new Set(), D = opt.D == null ? 0.6 : opt.D, repl = opt.repl || {};
    const E = {}, lim = {};
    function eff(k) {
      if (E[k] != null) return E[k];
      if (repl[k] != null) { E[k] = repl[k]; lim[k] = k; return E[k]; }
      if (lost.has(k)) { E[k] = 0; lim[k] = k; return 0; }
      let best = byKey[k].x, who = k;
      upOf[k].forEach(l => {
        const e = eff(l.frm), s = 1 - dep(l, D) * (1 - e);
        if (s < best - 1e-12) { best = s; who = lim[l.frm]; }
      });
      E[k] = best; lim[k] = who; return best;
    }
    S.forEach(s => eff(s.key));
    const C = {}, Clim = {}, shares = {};
    comps.forEach(c => {
      let sh = Object.assign({}, c.suppliers);
      if (opt.realloc) {
        const alive = Object.keys(sh).filter(k => !lost.has(k) || repl[k] != null);
        const gone = Object.keys(sh).filter(k => lost.has(k) && repl[k] == null);
        if (gone.length && alive.length) {
          const tot = alive.reduce((a, k) => a + sh[k], 0);
          const n = {}; alive.forEach(k => n[k] = sh[k] / tot); gone.forEach(k => n[k] = 0); sh = n;
        }
      }
      shares[c.id] = sh;
      let v = 0, worst = null, worstE = 2;
      Object.keys(sh).forEach(k => { v += sh[k] * E[k]; if (sh[k] > 0 && E[k] < worstE) { worstE = E[k]; worst = k; } });
      C[c.id] = v; Clim[c.id] = worst ? lim[worst] : null;
    });
    const P = {}, Plim = {};
    prods.forEach(p => {
      let v = 2, w = null;
      comps.forEach(c => { if (c.products.indexOf(p.id) >= 0 && C[c.id] < v) { v = C[c.id]; w = c.id; } });
      P[p.id] = v; Plim[p.id] = w;
    });
    const T = prods.reduce((a, p) => a + p.rev * P[p.id], 0) / REV;
    return { E, lim, C, Clim, P, Plim, T, shares };
  }

  function compare(base, after) {
    const rar = {}; let total = 0;
    prods.forEach(p => { const f = base.P[p.id] > 0 ? Math.max(0, 1 - after.P[p.id] / base.P[p.id]) : 0; rar[p.id] = p.rev * f; total += rar[p.id]; });
    const plants = {};
    prods.forEach(p => Object.keys(p.plants).forEach(pl => plants[pl] = (plants[pl] || 0) + rar[p.id] * p.plants[pl]));
    return { rar, total, weekly: total / 52, plants, drop: base.T > 0 ? 1 - after.T / base.T : 0 };
  }

  function minX(key, opt) {
    const base = run({ D: opt.D });
    for (let i = 0; i <= 100; i++) {
      const x = i / 100, r = Object.assign({}, opt.repl || {}); r[key] = x;
      if (run({ lost: opt.lost, D: opt.D, repl: r, realloc: opt.realloc }).T >= base.T - 1e-9) return x;
    }
    return null;
  }

  function leadWeeks(key) { let w = 0; comps.forEach(c => { if (compsOf[key].has(c.id)) w = Math.max(w, c.lead); }); return w; }
  function siblings(key) { const out = new Set(); comps.forEach(c => { if (c.suppliers[key] != null) Object.keys(c.suppliers).forEach(k => { if (k !== key) out.add(k); }); }); return Array.from(out); }
  function demandLoss(lost) {
    const out = [];
    S.forEach(s => {
      if (lost.has(s.key)) return;
      const d = downOf[s.key]; if (!d.length) return;
      const hit = d.filter(l => lost.has(l.to));
      if (hit.length) out.push({ key: s.key, share: hit.length / d.length, customers: hit.map(l => l.to) });
    });
    return out;
  }
  function scorecard(D) {
    const base = run({ D });
    return S.map(s => {
      const a = run({ lost: new Set([s.key]), D }), cmp = compare(base, a);
      return { key: s.key, x: s.x, e: base.E[s.key], lim: base.lim[s.key], loss: cmp.drop, rar: cmp.total, priority: 0.5 * (1 - s.x) + 0.5 * cmp.drop };
    }).sort((a, b) => b.priority - a.priority).map((r, i) => Object.assign(r, { rank: i + 1 }));
  }
  return { run, compare, minX, leadWeeks, siblings, demandLoss, scorecard, byKey, upOf, downOf, compsOf, REV };
}
if (typeof module !== 'undefined') module.exports = { makeModel };
