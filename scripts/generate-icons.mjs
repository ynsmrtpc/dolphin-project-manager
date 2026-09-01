/**
 * Marka varliklarini `public/logo.svg` kaynagindan uretir:
 *   node scripts/generate-icons.mjs
 *
 * Uretilenler:
 *   public/logo-mark.svg           kucuk boyutlar icin sikilastirilmis varyant
 *   public/icons/icon-{192,512}.png
 *   public/icons/icon-maskable-{192,512}.png
 *   src/app/icon.svg               favicon (SVG)
 *   src/app/favicon.ico            16/32/48
 *   src/app/apple-icon.png         180
 */
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = process.cwd();
const SOURCE = resolve(root, "public/logo.svg");

/** Zemin rengi; maskable ikonda tasma alanini da bu doldurur. */
const INK = "#1d1d1f";

/**
 * Icerigin gercek sinirlari (2048'lik izgarada olculdu).
 * Kucuk boyutlarda kenar boslugu fazla geldigi icin daraltilmis bir
 * viewBox ile yakinlastiriyoruz.
 */
const TIGHT_VIEWBOX = "272 272 1500 1500";

const source = readFileSync(SOURCE, "utf8");

function withViewBox(svg, viewBox) {
  return svg.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`);
}

const full = Buffer.from(source);
const tight = Buffer.from(withViewBox(source, TIGHT_VIEWBOX));

const png = (svg, size) =>
  sharp(svg, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

/**
 * Android maskesi kenarlardan %10'a kadar kirpabiliyor.
 * Logoyu %80'e kucultup tam kanama zemin uzerine oturtuyoruz.
 */
async function maskable(size) {
  const inner = Math.round(size * 0.8);
  const offset = Math.round((size - inner) / 2);

  return sharp({
    create: { width: size, height: size, channels: 4, background: INK },
  })
    .composite([{ input: await png(full, inner), top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await mkdir(resolve(root, "public/icons"), { recursive: true });

const outputs = [
  ["public/logo-mark.svg", tight],
  ["public/icons/icon-192.png", await png(full, 192)],
  ["public/icons/icon-512.png", await png(full, 512)],
  ["public/icons/icon-maskable-192.png", await maskable(192)],
  ["public/icons/icon-maskable-512.png", await maskable(512)],
  ["src/app/icon.svg", tight],
  ["src/app/apple-icon.png", await png(full, 180)],
  [
    "src/app/favicon.ico",
    await pngToIco([await png(tight, 16), await png(tight, 32), await png(tight, 48)]),
  ],
];

for (const [path, data] of outputs) {
  await writeFile(resolve(root, path), data);
}

console.log("uretilen dosyalar:");
for (const [path] of outputs) console.log("  " + path);
