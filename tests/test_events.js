// Run: node tests/test_events.js
const assert = require('assert');
const { makeModel } = require('../src/model.js');
const { makeMatcher } = require('../src/events.js');
const D = require('../data/data.json');
const X = makeMatcher(D, makeModel(D));
const want = { 'EV-001': 'Alert/Medium', 'EV-002': 'Duplicate/', 'EV-003': 'Alert/High', 'EV-004': 'Suppress/', 'EV-005': 'Suppress/', 'EV-007': 'Information/', 'EV-009': 'Suppress/', 'EV-010': 'Watch/' };
for (const r of X.runFeed(D.events)) { const got = r.verdict + '/' + (r.level || ''); assert.strictEqual(got, want[r.id], r.id); console.log(r.id.padEnd(7), got.padEnd(14), r.reason); }
console.log('events: all 8 verdicts as expected.');
