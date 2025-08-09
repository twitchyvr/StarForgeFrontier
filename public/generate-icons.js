// Node.js script to generate PWA icons programmatically
const fs = require('fs');
const { createCanvas } = require('canvas');

// Icon sizes required for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

function createStarForgeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#0d1421');
  gradient.addColorStop(1, '#1a2332');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Create starfield background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 0; i < Math.floor(size / 20); i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = Math.random() * 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw main spaceship icon
  const centerX = size / 2;
  const centerY = size / 2;
  const shipSize = size * 0.4;
  
  // Ship body
  ctx.fillStyle = '#64b5f6';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, shipSize * 0.3, shipSize * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Ship cockpit
  ctx.fillStyle = '#42a5f5';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY - shipSize * 0.3, shipSize * 0.2, shipSize * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Engine trails
  ctx.fillStyle = '#ffc107';
  ctx.beginPath();
  ctx.moveTo(centerX - shipSize * 0.15, centerY + shipSize * 0.4);
  ctx.lineTo(centerX - shipSize * 0.1, centerY + shipSize * 0.7);
  ctx.lineTo(centerX - shipSize * 0.05, centerY + shipSize * 0.4);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(centerX + shipSize * 0.15, centerY + shipSize * 0.4);
  ctx.lineTo(centerX + shipSize * 0.1, centerY + shipSize * 0.7);
  ctx.lineTo(centerX + shipSize * 0.05, centerY + shipSize * 0.4);
  ctx.closePath();
  ctx.fill();
  
  // Wings
  ctx.fillStyle = '#90caf9';
  ctx.beginPath();
  ctx.moveTo(centerX - shipSize * 0.3, centerY);
  ctx.lineTo(centerX - shipSize * 0.5, centerY + shipSize * 0.2);
  ctx.lineTo(centerX - shipSize * 0.2, centerY + shipSize * 0.1);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(centerX + shipSize * 0.3, centerY);
  ctx.lineTo(centerX + shipSize * 0.5, centerY + shipSize * 0.2);
  ctx.lineTo(centerX + shipSize * 0.2, centerY + shipSize * 0.1);
  ctx.closePath();
  ctx.fill();
  
  return canvas;
}

function createBadgeIcon() {
  const canvas = createCanvas(72, 72);
  const ctx = canvas.getContext('2d');
  
  // Simple badge design
  ctx.fillStyle = '#64b5f6';
  ctx.beginPath();
  ctx.arc(36, 36, 32, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SF', 36, 36);
  
  return canvas;
}

async function generateAllIcons() {
  console.log('Generating PWA icons...');
  
  // Create main app icons
  for (const size of iconSizes) {
    const canvas = createStarForgeIcon(size);
    const buffer = canvas.toBuffer('image/png');
    const filename = `./public/icons/icon-${size}x${size}.png`;
    
    fs.writeFileSync(filename, buffer);
    console.log(`Generated ${filename}`);
  }
  
  // Create badge icon
  const badgeCanvas = createBadgeIcon();
  const badgeBuffer = badgeCanvas.toBuffer('image/png');
  fs.writeFileSync('./public/icons/badge-72x72.png', badgeBuffer);
  console.log('Generated badge-72x72.png');
  
  // Create shortcut icons
  const shortcuts = [
    { name: 'designer', color: '#4caf50', text: '🔧' },
    { name: 'galaxy', color: '#9c27b0', text: '🌌' },
    { name: 'trading', color: '#ff9800', text: '💼' }
  ];
  
  shortcuts.forEach(shortcut => {
    const canvas = createCanvas(96, 96);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = shortcut.color;
    ctx.fillRect(8, 8, 80, 80);
    
    // Icon text (emoji fallback)
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shortcut.text, 48, 48);
    
    const buffer = canvas.toBuffer('image/png');
    const filename = `./public/icons/shortcut-${shortcut.name}.png`;
    fs.writeFileSync(filename, buffer);
    console.log(`Generated ${filename}`);
  });
  
  console.log('All icons generated successfully!');
}

// Simple fallback icons using ASCII art approach
function generateFallbackIcons() {
  console.log('Generating fallback icons without canvas dependency...');
  
  // For now, create placeholder files
  iconSizes.forEach(size => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0d1421"/>
          <stop offset="100%" style="stop-color:#1a2332"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size*0.15}" fill="#64b5f6"/>
      <ellipse cx="${size/2}" cy="${size*0.35}" rx="${size*0.08}" ry="${size*0.08}" fill="#42a5f5"/>
      <polygon points="${size*0.4},${size*0.6} ${size*0.45},${size*0.8} ${size*0.48},${size*0.6}" fill="#ffc107"/>
      <polygon points="${size*0.6},${size*0.6} ${size*0.55},${size*0.8} ${size*0.52},${size*0.6}" fill="#ffc107"/>
      <text x="${size/2}" y="${size*0.9}" text-anchor="middle" fill="#64b5f6" font-size="${size*0.1}" font-family="Arial">StarForge</text>
    </svg>`;
    
    fs.writeFileSync(`./public/icons/icon-${size}x${size}.svg`, svg);
    console.log(`Generated fallback SVG icon-${size}x${size}.svg`);
  });
}

// Try to generate with canvas, fallback to SVG
try {
  generateAllIcons();
} catch (error) {
  console.log('Canvas not available, generating SVG fallbacks...');
  generateFallbackIcons();
}