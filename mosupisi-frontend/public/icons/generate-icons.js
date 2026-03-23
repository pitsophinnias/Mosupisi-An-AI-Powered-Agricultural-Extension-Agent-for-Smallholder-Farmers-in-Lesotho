const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Icon sizes needed for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Colors (Mosupisi theme)
const colors = {
  primary: '#4CAF50',  // Green
  secondary: '#795548', // Brown
  accent: '#FFEB3B',    // Yellow
  white: '#FFFFFF',
  dark: '#2E7D32'       // Dark green
};

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname);
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icon for each size
iconSizes.forEach(size => {
  // Create canvas
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Draw background
  ctx.fillStyle = colors.primary;
  ctx.fillRect(0, 0, size, size);

  // Draw circle background
  ctx.beginPath();
  ctx.arc(size/2, size/2, size * 0.4, 0, 2 * Math.PI);
  ctx.fillStyle = colors.white;
  ctx.fill();

  // Draw mokorotlo hat (simplified)
  ctx.beginPath();
  
  // Hat base (rectangle)
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(size * 0.35, size * 0.45, size * 0.3, size * 0.15);
  
  // Hat top (triangle/cone)
  ctx.beginPath();
  ctx.moveTo(size * 0.3, size * 0.45);
  ctx.lineTo(size * 0.7, size * 0.45);
  ctx.lineTo(size * 0.5, size * 0.2);
  ctx.closePath();
  ctx.fillStyle = colors.secondary;
  ctx.fill();

  // Draw crop element (maize cob simplified)
  ctx.beginPath();
  ctx.fillStyle = colors.accent;
  
  // Cob body
  ctx.fillRect(size * 0.45, size * 0.6, size * 0.1, size * 0.2);
  
  // Kernels (dots)
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.63 + (i * size * 0.05), size * 0.02, 0, 2 * Math.PI);
    ctx.fillStyle = colors.white;
    ctx.fill();
  }

  // Add text for larger icons
  if (size >= 192) {
    ctx.font = `bold ${size * 0.1}px 'Roboto', sans-serif`;
    ctx.fillStyle = colors.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('M', size/2, size * 0.9);
  }

  // Save icon
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(iconsDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: icon-${size}x${size}.png`);
});

// Generate favicon.ico (using 32x32)
const faviconCanvas = createCanvas(32, 32);
const faviconCtx = faviconCanvas.getContext('2d');

// Simple favicon design
faviconCtx.fillStyle = colors.primary;
faviconCtx.fillRect(0, 0, 32, 32);
faviconCtx.font = 'bold 24px "Roboto", sans-serif';
faviconCtx.fillStyle = colors.white;
faviconCtx.textAlign = 'center';
faviconCtx.textBaseline = 'middle';
faviconCtx.fillText('M', 16, 16);

const faviconBuffer = faviconCanvas.toBuffer('image/png');
fs.writeFileSync(path.join(iconsDir, 'favicon.ico'), faviconBuffer);
console.log('Generated: favicon.ico');

// Generate apple-touch-icon (180x180)
const appleCanvas = createCanvas(180, 180);
const appleCtx = appleCanvas.getContext('2d');

appleCtx.fillStyle = colors.primary;
appleCtx.fillRect(0, 0, 180, 180);
appleCtx.font = 'bold 90px "Roboto", sans-serif';
appleCtx.fillStyle = colors.white;
appleCtx.textAlign = 'center';
appleCtx.textBaseline = 'middle';
appleCtx.fillText('M', 90, 90);

const appleBuffer = appleCanvas.toBuffer('image/png');
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), appleBuffer);
console.log('Generated: apple-touch-icon.png');

console.log('\n✅ All icons generated successfully!');
console.log(`📁 Icons saved to: ${iconsDir}`);