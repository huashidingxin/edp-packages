import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampSlide, wrapIndex } from '../src/lib/carousel.ts';

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
