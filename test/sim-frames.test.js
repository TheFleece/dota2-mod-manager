/* The frame comparison behind the rendering check in tools/sim.
 *
 * It exists to catch stale tiles: a block of the screen that still shows an old frame after the
 * page has drawn a new one. These pin that a block is found, that the noise a healthy screen
 * makes is not, and that two blocks come back as two regions, largest first.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { compareFrames, markChanges } = require('../tools/sim/frames.js');

const W = 256;
const H = 128;
const frame = (fill = 30) => Buffer.alloc(W * H * 4, fill);
const paint = (buf, x0, y0, w, h, v = 220) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const i = (y * W + x) * 4;
    buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = 255;
  }
  return buf;
};

test('two identical frames have nothing changed', () => {
  const r = compareFrames(frame(), frame(), W, H);
  assert.equal(r.changedPixels, 0);
  assert.equal(r.changedCells, 0);
  assert.deepEqual(r.boxes, []);
});

test('a stale block is found, where it is', () => {
  const r = compareFrames(frame(), paint(frame(), 64, 32, 64, 48), W, H);
  assert.equal(r.boxes.length, 1);
  assert.deepEqual(r.boxes[0], { x: 64, y: 32, w: 64, h: 48 });
  assert.equal(r.changedCells, 4 * 3);
});

test('scattered single pixels and a faint shift are noise, not a block', () => {
  const b = frame();
  for (let k = 0; k < 40; k++) paint(b, (k * 37) % W, (k * 11) % H, 1, 1); // a caret, a dither
  const faint = frame(30 + 20); // every pixel moved, but by less than the threshold
  assert.equal(compareFrames(frame(), b, W, H).changedCells, 0);
  assert.equal(compareFrames(frame(), faint, W, H).changedPixels, 0);
});

test('two blocks come back as two regions, the larger first', () => {
  const b = paint(paint(frame(), 0, 0, 32, 32), 128, 64, 96, 48);
  const r = compareFrames(frame(), b, W, H);
  assert.equal(r.boxes.length, 2);
  assert.deepEqual(r.boxes[0], { x: 128, y: 64, w: 96, h: 48 });
  assert.deepEqual(r.boxes[1], { x: 0, y: 0, w: 32, h: 32 });
});

test('frames of different sizes are refused rather than half compared', () => {
  assert.throws(() => compareFrames(frame(), Buffer.alloc(16), W, H), /differ in size/);
});

test('the marked frame outlines a changed block and leaves the rest alone', () => {
  const b = paint(frame(), 64, 32, 64, 48);
  const { boxes } = compareFrames(frame(), b, W, H);
  const marked = markChanges(b, W, H, boxes);
  const at = (x, y) => [...marked.subarray((y * W + x) * 4, (y * W + x) * 4 + 3)];
  assert.deepEqual(at(64, 32), [0, 0, 255], 'the corner of the block is outlined');
  assert.deepEqual(at(0, 0), [30, 30, 30], 'outside the block nothing changed');
});
