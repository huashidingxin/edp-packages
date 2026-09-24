import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampSlide, measureSetStride, wrapIndex, wrapScrollPosition } from '../src/lib/carousel.ts';

test('wrapIndex: forward wraps to 0', () => {
  assert.equal(wrapIndex(2, 1, 3), 0);
  assert.equal(wrapIndex(0, 1, 3), 1);
});

test('wrapIndex: backward wraps to end', () => {
  assert.equal(wrapIndex(0, -1, 3), 2);
  assert.equal(wrapIndex(1, -1, 3), 0);
});

test('wrapIndex: large delta normalizes', () => {
  assert.equal(wrapIndex(0, 7, 3), 1);
  assert.equal(wrapIndex(0, -4, 3), 2);
});

test('wrapIndex: empty carousel stays 0', () => {
  assert.equal(wrapIndex(5, 1, 0), 0);
});

test('clampSlide: bounds', () => {
  assert.equal(clampSlide(-1, 3), 0);
  assert.equal(clampSlide(9, 3), 2);
  assert.equal(clampSlide(1, 0), 0);
});

test('wrapScrollPosition: stays within [setWidth, 2 * setWidth)', () => {
  const setWidth = 1000;
  // Inside range
  assert.equal(wrapScrollPosition(1500, setWidth), 1500);
  assert.equal(wrapScrollPosition(1000, setWidth), 1000);
  // Reached or exceeded upper boundary
  assert.equal(wrapScrollPosition(2000, setWidth), 1000);
  assert.equal(wrapScrollPosition(2050, setWidth), 1050);
  assert.equal(wrapScrollPosition(3100, setWidth), 1100);
  // Below lower boundary
  assert.equal(wrapScrollPosition(990, setWidth), 1990);
  assert.equal(wrapScrollPosition(0, setWidth), 1000);
  assert.equal(wrapScrollPosition(-500, setWidth), 1500);
  // Zero or negative setWidth
  assert.equal(wrapScrollPosition(500, 0), 500);
  assert.equal(wrapScrollPosition(500, -100), 500);
});

test('measureSetStride: calculates diff between first and (count)th item', () => {
  // 3 items per set, cards at 0, 100, 200, 300, 400, 500
  const offsets = [0, 100, 200, 300, 400, 500];
  assert.equal(measureSetStride(offsets, 3, 900), 300);

  // Insufficient items or non-positive diff falls back to fallbackWidth / 3
  assert.equal(measureSetStride([], 3, 900), 300);
  assert.equal(measureSetStride([0, 100], 3, 900), 300);
  assert.equal(measureSetStride([100, 50], 1, 900), 300);
});

