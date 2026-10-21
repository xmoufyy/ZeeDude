// Regenerates PNG/JPEG copies of the brand art for places that can't use
// WebP: the Open Graph renderer, the favicon, and the iOS home-screen icon.
// Run after replacing public/brand/*.webp, then commit the outputs:
//   node scripts/brand-assets.mjs
// Uses sharp, which ships with Next.js.

import sharp from "sharp";

const LOGO = "public/brand/zeedude-logo.webp";
const BANNER = "public/brand/zeedude-banner.webp";

const outputs = [
  // 1200x630 crop of the banner for the share image background, darkened and
  // softened so overlaid text stays readable (and the PNG stays small).
  sharp(BANNER)
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .modulate({ brightness: 0.7 })
    .blur(2)
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile("public/brand/og-banner.jpg"),
  sharp(LOGO).resize(64, 64).png({ compressionLevel: 9 }).toFile("src/app/icon.png"),
  sharp(LOGO).resize(180, 180).png({ compressionLevel: 9 }).toFile("src/app/apple-icon.png"),
  // Small logo for the share image (WebP isn't supported there).
  sharp(LOGO).resize(220, 220).png({ compressionLevel: 9 }).toFile("public/brand/zeedude-logo-220.png"),
];

for (const info of await Promise.all(outputs)) console.log(`${info.width}x${info.height} ${info.format} ${info.size} bytes`);
