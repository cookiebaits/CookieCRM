const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Condensed SVG representation matching the user's original logo
// Balanced along the y=48 midline with zero excess padding for crisp navbar scaling
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 572 96" width="572" height="96" fill="none">
  <defs>
    <!-- Shield and network gradient -->
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="35%" stop-color="#f97316" />
      <stop offset="70%" stop-color="#ea580c" />
      <stop offset="100%" stop-color="#dc2626" />
    </linearGradient>

    <!-- Intelligence badge gradient -->
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#be123c" />
      <stop offset="30%" stop-color="#e11d48" />
      <stop offset="75%" stop-color="#ea580c" />
      <stop offset="100%" stop-color="#f97316" />
    </linearGradient>

    <!-- Clean outline stroke shadow for sharp contrast on dark navigation bars -->
    <filter id="textGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="0" stdDeviation="0.5" flood-color="#ffffff" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Left: Shield Icon (centered vertically on y=48) -->
  <g transform="translate(6, 4)">
    <!-- Crested Top Shield Outline -->
    <path
      d="M 43 6
         C 53 10, 69 13, 77 17
         C 79 46, 71 73, 43 89
         C 15 73, 7 46, 9 17
         C 17 13, 33 10, 43 6 Z"
      fill="none"
      stroke="url(#shieldGrad)"
      stroke-width="4.2"
      stroke-linejoin="round"
      stroke-linecap="round"
    />

    <!-- Network Inside Roof connecting upper nodes to apex -->
    <path
      d="M 26 34 L 43 21 L 60 34"
      fill="none"
      stroke="url(#shieldGrad)"
      stroke-width="3.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Side curving ribs -->
    <path
      d="M 26 34 C 22 47, 25 61, 33 68"
      fill="none"
      stroke="url(#shieldGrad)"
      stroke-width="2.8"
      stroke-linecap="round"
    />
    <path
      d="M 60 34 C 64 47, 61 61, 53 68"
      fill="none"
      stroke="url(#shieldGrad)"
      stroke-width="2.8"
      stroke-linecap="round"
    />

    <!-- Thin dark vertical link from roof apex to center node -->
    <line
      x1="43" y1="21"
      x2="43" y2="44"
      stroke="#0f172a"
      stroke-width="2"
      stroke-linecap="round"
    />

    <!-- Vertical stem under center dot extending down to bottom of shield -->
    <line
      x1="43" y1="44"
      x2="43" y2="83"
      stroke="url(#shieldGrad)"
      stroke-width="3.8"
      stroke-linecap="round"
    />

    <!-- Three Nodes -->
    <circle cx="26" cy="34" r="4.5" fill="url(#shieldGrad)" />
    <circle cx="60" cy="34" r="4.5" fill="url(#shieldGrad)" />
    <circle cx="43" cy="44" r="5.2" fill="url(#shieldGrad)" />
  </g>

  <!-- Middle: 'Scambaiter CRM' Outline Text matching original logo -->
  <g transform="translate(98, 59)">
    <text
      x="0"
      y="0"
      font-family="Liberation Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      font-size="37.5"
      font-weight="400"
      letter-spacing="0.45px"
      fill="rgba(255, 255, 255, 0.05)"
      stroke="#ffffff"
      stroke-width="1.15"
      stroke-linejoin="round"
      filter="url(#textGlow)"
    >Scambaiter CRM</text>
  </g>

  <!-- Right: 'Intelligence' Badge -->
  <g transform="translate(416, 27)">
    <rect
      x="0"
      y="0"
      width="150"
      height="42"
      rx="12"
      ry="12"
      fill="url(#badgeGrad)"
    />
    <text
      x="75"
      y="27.5"
      text-anchor="middle"
      font-family="Liberation Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      font-size="22"
      font-weight="700"
      letter-spacing="0.2px"
      fill="#ffffff"
    >Intelligence</text>
  </g>
</svg>`;

async function main() {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Save SVG
  const svgPath = path.join(publicDir, 'logo.svg');
  fs.writeFileSync(svgPath, svgContent);
  console.log('Saved', svgPath);

  // Render PNG with sharp
  const pngPath = path.join(publicDir, 'logo.png');
  await sharp(Buffer.from(svgContent))
    .png({ quality: 100 })
    .toFile(pngPath);
  console.log('Saved', pngPath);

  // Also create high-density 2x PNG (1144 x 192)
  const png2xPath = path.join(publicDir, 'logo@2x.png');
  await sharp(Buffer.from(svgContent), { density: 300 })
    .resize(1144, 192)
    .png({ quality: 100 })
    .toFile(png2xPath);
  console.log('Saved', png2xPath);

  // If dist/ exists, update dist assets as well
  const distDir = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    fs.copyFileSync(svgPath, path.join(distDir, 'logo.svg'));
    fs.copyFileSync(pngPath, path.join(distDir, 'logo.png'));
    fs.copyFileSync(png2xPath, path.join(distDir, 'logo@2x.png'));
    console.log('Synchronized logo assets to dist/');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
