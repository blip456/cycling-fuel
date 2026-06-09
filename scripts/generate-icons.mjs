// Renders all raster icon deliverables from the SVG masters in public/icons.
// Run with: npm run icons
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICON = path.join(root, "public/icons/icon.svg");
const MASKABLE = path.join(root, "public/icons/icon-maskable.svg");
const OUT = path.join(root, "public/icons");

async function render(svg, size, file) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, file));
  console.log(`✓ ${file} (${size}×${size})`);
}

await render(ICON, 192, "icon-192.png");
await render(ICON, 512, "icon-512.png");
await render(MASKABLE, 192, "icon-maskable-192.png");
await render(MASKABLE, 512, "icon-maskable-512.png");
// iOS requires a PNG apple-touch-icon (SVG is ignored); 180px covers all devices
await render(ICON, 180, "apple-touch-icon.png");

// Favicon: multi-size ICO served by Next from src/app/favicon.ico
const faviconPngs = await Promise.all(
  [16, 32, 48].map((s) =>
    sharp(ICON, { density: 300 }).resize(s, s).png().toBuffer()
  )
);
await writeFile(path.join(root, "src/app/favicon.ico"), await pngToIco(faviconPngs));
console.log("✓ favicon.ico (16/32/48)");
