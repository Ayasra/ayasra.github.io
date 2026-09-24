import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockParts, durationText, durationLabel, dateText, inWindow, parseEntry, toEntry } from '../js/format.js';

const at = (h, m, s = 0) => new Date(2026, 8, 24, h, m, s);

test('24-hour clock pads hours', () => {
  assert.deepEqual(clockParts(at(9, 5, 7), false), { hm: '09:05', ss: '07', ampm: '' });
  assert.deepEqual(clockParts(at(0, 0), false), { hm: '00:00', ss: '00', ampm: '' });
  assert.deepEqual(clockParts(at(23, 59, 59), false), { hm: '23:59', ss: '59', ampm: '' });
});

test('12-hour clock keeps five cells with a blank leading digit', () => {
  assert.deepEqual(clockParts(at(9, 5), true), { hm: ' 9:05', ss: '00', ampm: 'AM' });
  assert.equal(clockParts(at(0, 30), true).hm, '12:30');
  assert.equal(clockParts(at(0, 30), true).ampm, 'AM');
  assert.equal(clockParts(at(12, 0), true).ampm, 'PM');
  assert.equal(clockParts(at(13, 7), true).hm, ' 1:07');
  assert.equal(clockParts(at(23, 59), true).hm, '11:59');
});

test('durations read MM:SS under an hour and H:MM:SS above', () => {
  assert.equal(durationText(0), '00:00');
  assert.equal(durationText(59), '00:59');
  assert.equal(durationText(300), '05:00');
  assert.equal(durationText(3599), '59:59');
  assert.equal(durationText(3600), '1:00:00');
  assert.equal(durationText(36000 + 61), '10:01:01');
  assert.equal(durationText(-5), '00:00');
});

test('duration labels', () => {
  assert.equal(durationLabel(300), '5 min');
  assert.equal(durationLabel(5400), '1 h 30 min');
  assert.equal(durationLabel(45), '45 s');
  assert.equal(durationLabel(3601), '1 h 1 s');
});

test('date line uses the locale and plain digits', () => {
  assert.equal(dateText(at(12, 0), 'en-US'), 'Thu 24 Sep');
  assert.match(dateText(at(12, 0), 'fr-FR'), /^jeu 24 sept$/);
});

test('night window, including one that wraps midnight', () => {
  assert.equal(inWindow(at(23, 0), '22:00', '07:00'), true);
  assert.equal(inWindow(at(3, 0), '22:00', '07:00'), true);
  assert.equal(inWindow(at(7, 0), '22:00', '07:00'), false);
  assert.equal(inWindow(at(21, 59), '22:00', '07:00'), false);
  assert.equal(inWindow(at(13, 0), '12:00', '14:00'), true);
  assert.equal(inWindow(at(14, 0), '12:00', '14:00'), false);
  assert.equal(inWindow(at(14, 0), '09:00', '09:00'), false);
});

test('keypad entry fills from the right', () => {
  assert.deepEqual(parseEntry(''), { groups: ['00', '00', '00'], seconds: 0 });
  assert.deepEqual(parseEntry('5'), { groups: ['00', '00', '05'], seconds: 5 });
  assert.deepEqual(parseEntry('130'), { groups: ['00', '01', '30'], seconds: 90 });
  assert.deepEqual(parseEntry('1000'), { groups: ['00', '10', '00'], seconds: 600 });
  assert.equal(parseEntry('90').seconds, 90); // 90 s is allowed, like a microwave
  assert.equal(parseEntry('123456').seconds, 12 * 3600 + 34 * 60 + 56);
});

test('toEntry is the inverse of parseEntry', () => {
  for (const s of [5, 60, 90, 300, 1500, 3600, 5400, 86399]) {
    assert.equal(parseEntry(toEntry(s)).seconds, s);
  }
  assert.equal(toEntry(300), '500');
});
