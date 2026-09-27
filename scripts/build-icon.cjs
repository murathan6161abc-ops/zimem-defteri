const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
  const svgPath = path.join(__dirname, '..', 'resources', 'icon.svg');
  const outDir = path.join(__dirname, '..', 'resources');
  const svg = fs.readFileSync(svgPath);

  // Main icon (transparent corners come from rounded rect in svg)
  await sharp(svg, { density: 600 })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(outDir, 'icon.png'));

  // Foreground for adaptive icon — same content but on transparent bg, padded
  await sharp(svg, { density: 600 })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(outDir, 'icon-foreground.png'));

  // Splash: solid background + centered logo (smaller)
  const logoBuf = await sharp(svg, { density: 600 })
    .resize(900, 900)
    .png()
    .toBuffer();

  await sharp({
    create: { width: 2732, height: 2732, channels: 4, background: '#0a0e1a' },
  })
    .composite([{ input: logoBuf, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, 'splash.png'));

  console.log('Icons + splash generated.');
})();
