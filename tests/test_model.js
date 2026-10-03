// Run: node tests/test_model.js
const assert = require('assert');
const { makeModel } = require('../src/model.js');
const D = require('../data/data.json');
const M = makeModel(D);
const b = M.run({});
const near = (a, e, m) => assert(Math.abs(a - e) < 0.006, `${m}: got ${a}, expected ${e}`);
near(b.T, 0.47, 'baseline total efficiency');
const lose = k => { const a = M.run({ lost: new Set([k]) }); return { a, c: M.compare(b, a) }; };
near(lose('Jade').a.T, 0, 'Jade lost'); near(lose('IonPeak').c.total, 1560, 'IonPeak revenue at risk');
near(lose('Aster').a.T, 0.183, 'Aster lost'); near(lose('Meridian').a.T, 0.419, 'Meridian lost');
near(M.run({ lost: new Set(['Aster']), realloc: true }).T, 0.47, 'Aster with volume shifted to Boreal');
assert.strictEqual(M.minX('IonPeak', { lost: new Set(['IonPeak']), D: 0.6 }), 0.47);
assert.strictEqual(M.scorecard(0.6)[0].key, 'Jade');
console.log('model: all checks passed. Baseline', b.T.toFixed(3));
