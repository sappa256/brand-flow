const fs = require('fs');

const svgPath = '/Users/rajesh/Downloads/logo design.svg';

try {
  const content = fs.readFileSync(svgPath, 'utf8');
  let match;
  const regex = /data:image\/(png|jpeg|webp|gif);base64,([a-zA-Z0-9+/=]+)/g;
  let count = 0;
  
  while ((match = regex.exec(content)) !== null) {
    count++;
    console.log(`Match ${count}: Type = ${match[1]}, Base64 Length = ${match[2].length}`);
  }
  
  console.log(`Total embedded images found: ${count}`);
} catch (err) {
  console.error(err);
}
