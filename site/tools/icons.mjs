/**
 * Build the favicon set from the app's own icon.
 *
 * Two things were wrong before. The site declared a single 512px PNG, and Google asks for a
 * square that is a multiple of 48; and nothing answered /favicon.ico, which Cloudflare Pages
 * turned into the HTML 404 page served with `nosniff`, so a crawler asking for the icon got a
 * document and gave up. A search result with a grey globe instead of a mark is the visible
 * end of that.
 *
 * The source is build/icon.png, the same file the installer uses, so the tab, the search
 * result and the installed app all show one mark.
 *
 * Usage: node tools/icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..', 'public');
const source = path.join(pub, 'icon.png');

/** ICO with a PNG payload: the header points at one image and the bytes follow. */
function ico(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width
  entry.writeUInt8(size, 1); // height
  entry.writeUInt8(0, 2); // palette: none
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + 16, 12); // offset to the payload
  return Buffer.concat([header, entry, png]);
}

const png = (size) => sharp(source).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer();

const out = [];

const forIco = await png(48);
fs.writeFileSync(path.join(pub, 'favicon.ico'), ico(forIco, 48));
out.push(['favicon.ico', 48]);

for (const size of [96, 180, 192]) {
  fs.writeFileSync(path.join(pub, `icon-${size}.png`), await png(size));
  out.push([`icon-${size}.png`, size]);
}

for (const [name, size] of out) {
  const bytes = fs.statSync(path.join(pub, name)).size;
  console.log(`${name.padEnd(16)} ${size}px  ${bytes} bytes`);
}
