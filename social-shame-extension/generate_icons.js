const fs = require('fs');

// Simple SVG icon generator
function createSVG(size) {
  const padding = Math.floor(size * 0.1);
  const innerSize = size - (padding * 2);
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = innerSize * 0.35;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a1a"/>
      <stop offset="100%" style="stop-color:#000000"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
  <circle cx="${centerX}" cy="${centerY - radius * 0.15}" r="${radius}" fill="none" stroke="#ffffff" stroke-width="${size * 0.04}"/>
  <rect x="${centerX - radius * 0.12}" y="${centerY - radius * 0.3}" width="${radius * 0.24}" height="${radius * 0.8}" rx="${radius * 0.1}" fill="#ffffff"/>
  <rect x="${centerX - radius * 0.6}" y="${centerY + radius * 0.5}" width="${radius * 1.2}" height="${radius * 0.8}" rx="${radius * 0.15}" fill="#ffffff"/>
</svg>`;
}

// Write SVG files and convert note
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const svg = createSVG(size);
  fs.writeFileSync(`images/icon${size}.svg`, svg);
});

console.log('SVG icons created. Converting to PNG...');
