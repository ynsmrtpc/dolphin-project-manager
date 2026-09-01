/**
 * Kaynak logo bir raster goruntuden VTracer ile vektorlestirilmis.
 * Bu yuzden yuzlerce "neredeyse ayni" renk (anti-aliasing izi) tasiyor;
 * kucuk boyutlarda gri gurultuye donusuyor.
 *
 * Burada her dolgu, markanin uc rengine en yakin olana sabitleniyor,
 * sonra svgo ile yol verisi sadelestiriliyor.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { optimize } from "svgo";

export const BRAND = {
  ink: "#1D1D1F", // zemin
  surface: "#F5F5F7", // yunus
  spark: "#21CAE7", // commit dali ve dugumler
};

const PALETTE = Object.values(BRAND).map((hex) => ({
  hex,
  rgb: [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ],
}));

function nearest(hex) {
  const rgb = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  let best = PALETTE[0];
  let bestDistance = Infinity;

  for (const entry of PALETTE) {
    const distance =
      (rgb[0] - entry.rgb[0]) ** 2 +
      (rgb[1] - entry.rgb[1]) ** 2 +
      (rgb[2] - entry.rgb[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }

  return best.hex;
}

const input = process.argv[2] ?? "public/logo.svg";
const output = process.argv[3] ?? "public/logo.svg";

const raw = readFileSync(input, "utf8");
const snapped = raw.replace(/fill="(#[0-9A-Fa-f]{6})"/g, (_, hex) => `fill="${nearest(hex)}"`);

const result = optimize(snapped, {
  multipass: true,
  plugins: [
    { name: "preset-default", params: { overrides: { removeViewBox: false } } },
    { name: "removeDimensions" },
    { name: "convertPathData", params: { floatPrecision: 1 } },
  ],
});

writeFileSync(output, result.data);

const before = Buffer.byteLength(raw);
const after = Buffer.byteLength(result.data);
console.log(
  `renkler 3'e indirildi · ${(before / 1024).toFixed(1)} KB -> ${(after / 1024).toFixed(1)} KB`,
);
