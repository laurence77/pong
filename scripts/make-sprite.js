#!/usr/bin/env node
/**
 * Generate a tiny CC0 audio sprite MP3 with 4 cues:
 *  - paddle: 0.00–0.12s (800 Hz blip)
 *  - wall:   0.14–0.24s (220 Hz blip)
 *  - scoreUp:0.26–0.46s (sweep 420→760 Hz)
 *  - scoreDn:0.48–0.68s (sweep 420→160 Hz)
 */
const fs = require('fs');
const path = require('path');

const SR = 44100;
const DURATION = 0.7; // seconds
const samples = Math.floor(SR * DURATION);
const buf = new Float32Array(samples);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function fillTone(startSec, durSec, freq, vol = 0.35) {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(durSec * SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.min(1, i / (0.01 * SR)) * Math.max(0, 1 - i / len);
    const s = Math.sin(2 * Math.PI * freq * t) * vol * env;
    buf[start + i] = clamp(buf[start + i] + s, -1, 1);
  }
}

function fillSweep(startSec, durSec, f0, f1, vol = 0.30) {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(durSec * SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = f0 + (f1 - f0) * (i / len);
    const env = Math.min(1, i / (0.01 * SR)) * Math.max(0, 1 - i / len);
    const s = Math.sin(2 * Math.PI * f * t) * vol * env;
    buf[start + i] = clamp(buf[start + i] + s, -1, 1);
  }
}

// Cues
fillTone(0.00, 0.12, 800);
fillTone(0.14, 0.10, 220, 0.28);
fillSweep(0.26, 0.20, 420, 760, 0.28);
fillSweep(0.48, 0.20, 420, 160, 0.28);

// Convert to Int16
const pcm = new Int16Array(samples);
for (let i = 0; i < samples; i++) {
  const v = Math.max(-1, Math.min(1, buf[i]));
  pcm[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
}

// Write simple WAV (PCM 16-bit mono)
function writeWav(int16, sampleRate) {
  const byteRate = sampleRate * 2; // mono 16-bit
  const blockAlign = 2; // mono 16-bit
  const dataSize = int16.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  let o = 0;
  buf.write('RIFF', o); o += 4;
  buf.writeUInt32LE(36 + dataSize, o); o += 4;
  buf.write('WAVE', o); o += 4;
  buf.write('fmt ', o); o += 4;
  buf.writeUInt32LE(16, o); o += 4; // PCM chunk size
  buf.writeUInt16LE(1, o); o += 2; // audio format PCM
  buf.writeUInt16LE(1, o); o += 2; // channels
  buf.writeUInt32LE(sampleRate, o); o += 4;
  buf.writeUInt32LE(byteRate, o); o += 4;
  buf.writeUInt16LE(blockAlign, o); o += 2;
  buf.writeUInt16LE(16, o); o += 2; // bits per sample
  buf.write('data', o); o += 4;
  buf.writeUInt32LE(dataSize, o); o += 4;
  for (let i = 0; i < int16.length; i++) {
    buf.writeInt16LE(int16[i], o); o += 2;
  }
  return buf;
}

const outDir = path.join(process.cwd(), 'assets');
fs.mkdirSync(outDir, { recursive: true });

const wav = writeWav(pcm, SR);
const wavFile = path.join(outDir, 'sfx-sprite.wav');
fs.writeFileSync(wavFile, wav);
console.log('Wrote', path.relative(process.cwd(), wavFile));
