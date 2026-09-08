import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8')
  .replace(/\nif \(document\.readyState === 'loading'\) \{[\s\S]*$/, '');
const dom = new JSDOM('', { runScripts: 'outside-only' });
dom.window.eval(source);
const calculate = dom.window.calculateXpTrend;
const day = 86400000;
const now = Date.parse('2026-09-08T12:00:00Z');
const point = (ago, totalExp) => ({ timestamp: new Date(now - ago * day).toISOString(), totalExp });
test('XP pace includes inactive time and compares observed periods', () => {
  const result = calculate([point(14, 100), point(7, 800), point(0, 2200)], 7, now);
  assert.equal(result.current.gain, 1400);
  assert.equal(result.current.rate, 200);
  assert.equal(result.change, 100);
});
test('sparse history uses actual elapsed days and suppresses comparison', () => {
  const result = calculate([point(3, 100), point(1, 500)], 30, now);
  assert.equal(result.current.rate, 200);
  assert.equal(result.current.complete, false);
  assert.equal(result.change, null);
});
test('inactive players show zero; missing and decreasing history is unavailable', () => {
  assert.equal(calculate([point(7, 100), point(0, 100)], 7, now).current.rate, 0);
  assert.equal(calculate([point(0, 100)], 7, now).current, null);
  assert.equal(calculate([point(7, 100), point(3, 50), point(0, 200)], 7, now).current, null);
  assert.equal(calculate([point(60, 100), point(40, 200)], 7, now).current, null);
});
