const fs = require('fs');
const path = require('path');

const svgPath = '/Users/rajesh/Downloads/logo design.svg';
const targetDir = '/Users/rajesh/.gemini/antigravity/scratch/brand-flow/src/assets';

try {
  console.log("Reading SVG file...");
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  let match;
  const regex = /data:image\/(png|jpeg|webp|gif);base64,([a-zA-Z0-9+/=]+)/g;
  let count = 0;
  
  while ((match = regex.exec(svgContent)) !== null) {
    count++;
    const format = match[1];
    const base64Data = match[2];
    const targetPath = path.join(targetDir, `extracted-logo-${count}.${format}`);
    
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buffer);
    console.log(`Saved image ${count} to: ${targetPath} (Size: ${buffer.length} bytes)`);
  }
} catch (err) {
  console.error("Error during extraction:", err);
}
