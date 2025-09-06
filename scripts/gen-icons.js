#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function run() {
  const root = process.cwd();
  const srcAny = path.join(root, 'icons', 'icon.svg');
  const srcMask = path.join(root, 'icons', 'icon-maskable.svg');
  const outDir = path.join(root, 'icons');
  const targets = [
    { src: srcAny,  name: 'icon-192.png',          size: 192 },
    { src: srcAny,  name: 'icon-256.png',          size: 256 },
    { src: srcAny,  name: 'icon-384.png',          size: 384 },
    { src: srcAny,  name: 'icon-512.png',          size: 512 },
    { src: srcMask, name: 'icon-maskable-192.png', size: 192 },
    { src: srcMask, name: 'icon-maskable-256.png', size: 256 },
    { src: srcMask, name: 'icon-maskable-384.png', size: 384 },
    { src: srcMask, name: 'icon-maskable-512.png', size: 512 },
    { src: srcMask, name: 'icon-180.png',          size: 180 }
  ];
  await fs.promises.mkdir(outDir, { recursive: true });
  for (const t of targets) {
    const out = path.join(outDir, t.name);
    await sharp(t.src).resize(t.size, t.size, { fit: 'contain', background: '#181818' }).png().toFile(out);
    console.log('Generated', path.relative(root, out));
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
