import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'icons');

// Ensure icons directory exists
mkdirSync(iconsDir, { recursive: true });

// VidPulse amber color
const accentColor = '#f59e0b';
const bgColor = '#1a1a1a';

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background circle
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Lightning bolt (pulse symbol)
  ctx.fillStyle = accentColor;
  ctx.beginPath();

  const scale = size / 128;
  const cx = size / 2;
  const cy = size / 2;

  // Simple lightning bolt shape
  ctx.moveTo(cx + 8 * scale, cy - 40 * scale);
  ctx.lineTo(cx - 20 * scale, cy + 5 * scale);
  ctx.lineTo(cx - 5 * scale, cy + 5 * scale);
  ctx.lineTo(cx - 15 * scale, cy + 40 * scale);
  ctx.lineTo(cx + 20 * scale, cy - 5 * scale);
  ctx.lineTo(cx + 5 * scale, cy - 5 * scale);
  ctx.closePath();
  ctx.fill();

  return canvas.toBuffer('image/png');
}

// Generate icons at different sizes
const sizes = [16, 48, 128];

for (const size of sizes) {
  const buffer = generateIcon(size);
  const filename = join(iconsDir, `icon${size}.png`);
  writeFileSync(filename, buffer);
  console.log(`Generated ${filename}`);
}

console.log('Icons generated successfully!');
