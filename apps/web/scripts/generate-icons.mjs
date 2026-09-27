// Rasterises public/icons/icon.svg into the PNG sizes the manifest and iOS need.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const dir = path.join(import.meta.dirname, '..', 'public', 'icons');
const svg = await readFile(path.join(dir, 'icon.svg'));

const outputs = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  // Maskable icons need a safe zone: shrink the artwork onto a full-bleed background.
  ['icon-maskable-512.png', 512, 0.12],
];

for (const [name, size, inset] of outputs) {
  const inner = Math.round(size * (1 - inset * 2));
  const art = await sharp(svg).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: inset ? '#FFEFD2' : { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(path.join(dir, name));
  console.log('wrote', name);
}
