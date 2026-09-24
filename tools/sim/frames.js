/**
 * Whether two frames of the same screen show the same thing.
 *
 * A user sent a picture of the catalog drawn as a mess: pieces of one card lying across its
 * neighbours, a title cut in half, a card from further down the list painted over the top of
 * the grid. Nothing crashed and the log was clean. That is how stale tiles look: the GPU keeps
 * showing a piece of a frame that the page has already moved on from, and nothing in the page
 * can see it, because the page thinks it drew the right thing.
 *
 * So the check compares what is on screen with what the page would draw from scratch. The
 * driver captures a frame, forces a full repaint, and captures again. On a healthy machine the
 * two are the same picture. Where they differ, something on screen was not what the page
 * meant.
 *
 * Pixels are compared in cells rather than one by one. A single pixel changes for a dozen
 * innocent reasons (a caret, a subpixel of a gradient, an image decoded a frame later), and a
 * stale tile is never one pixel: it is a block, usually 256 pixels square. A cell counts as
 * changed when a real share of it changed, which keeps the noise out and the blocks in.
 *
 * Plain functions over BGRA buffers, the layout Electron's NativeImage.toBitmap() hands back,
 * so the tests run without a window.
 */

/**
 * @param {Buffer} a  BGRA pixels, width * height * 4 bytes
 * @param {Buffer} b  the same size
 * @param {number} width
 * @param {number} height
 * @param {object} [opts]
 * @param {number} [opts.cell=16]       cell size in pixels
 * @param {number} [opts.threshold=40]  a channel has to move this far for a pixel to count
 * @param {number} [opts.share=0.3]     share of a cell's pixels that makes the cell changed
 * @returns {{ changedPixels: number, pixelShare: number, cells: number, changedCells: number,
 *   cellShare: number, boxes: {x: number, y: number, w: number, h: number}[] }}
 */
function compareFrames(a, b, width, height, opts = {}) {
  const cell = opts.cell || 16;
  const threshold = opts.threshold ?? 40;
  const share = opts.share ?? 0.3;
  if (a.length !== b.length || a.length !== width * height * 4) {
    throw new Error(`frames differ in size: ${a.length} and ${b.length} bytes for ${width}x${height}`);
  }
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const counts = new Uint32Array(cols * rows);
  let changedPixels = 0;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    const cy = Math.floor(y / cell) * cols;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      if (Math.abs(a[i] - b[i]) > threshold || Math.abs(a[i + 1] - b[i + 1]) > threshold || Math.abs(a[i + 2] - b[i + 2]) > threshold) {
        changedPixels++;
        counts[cy + Math.floor(x / cell)]++;
      }
    }
  }
  const changed = new Uint8Array(cols * rows);
  let changedCells = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const w = Math.min(cell, width - c * cell);
      const h = Math.min(cell, height - r * cell);
      if (counts[r * cols + c] >= share * w * h) { changed[r * cols + c] = 1; changedCells++; }
    }
  }
  return {
    changedPixels,
    pixelShare: changedPixels / (width * height),
    cells: cols * rows,
    changedCells,
    cellShare: changedCells / (cols * rows),
    boxes: regions(changed, cols, rows).map((r) => ({ x: r.x * cell, y: r.y * cell, w: r.w * cell, h: r.h * cell })),
  };
}

/* Changed cells grouped into rectangles, largest first: a stale tile shows up as one block
   rather than as fifty cells, which is what a person reading the result wants to point at. */
function regions(grid, cols, rows) {
  const seen = new Uint8Array(grid.length);
  const out = [];
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i] || seen[i]) continue;
    let minX = cols, minY = rows, maxX = -1, maxY = -1, size = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      const x = j % cols;
      const y = (j - x) / cols;
      size++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const k = ny * cols + nx;
        if (grid[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
    out.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, size });
  }
  return out.sort((p, q) => q.size - p.size);
}

/** The second frame with every changed cell tinted, for a person to look at. BGRA in, BGRA out. */
function markChanges(b, width, height, boxes) {
  const out = Buffer.from(b);
  for (const box of boxes) {
    for (let y = box.y; y < Math.min(height, box.y + box.h); y++) {
      for (let x = box.x; x < Math.min(width, box.x + box.w); x++) {
        const i = (y * width + x) * 4;
        const edge = y === box.y || x === box.x || y === box.y + box.h - 1 || x === box.x + box.w - 1;
        if (edge) { out[i] = 0; out[i + 1] = 0; out[i + 2] = 255; continue; }
        out[i + 2] = Math.min(255, out[i + 2] + 90); // redder, keeping what was there readable
      }
    }
  }
  return out;
}

module.exports = { compareFrames, markChanges };
