const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const directory = path.resolve(__dirname, '../downloads');
const files = ['portfolio-final.html', 'portfolio-final.zip'].map(file => {
  const bytes = fs.readFileSync(path.join(directory, file));
  return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log('Generated downloads/manifest.json.');
