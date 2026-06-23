const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../kava-api');
const dest = path.resolve(__dirname, '../templates/kava-api');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    const base = path.basename(src);
    if (['node_modules', '.git', 'dist', '.idea', '.vscode'].includes(base)) {
      return;
    }
    
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    const base = path.basename(src);
    if (base === '.env' || base.endsWith('.log')) {
      return;
    }
    fs.copyFileSync(src, dest);
  }
}

console.log('Copying starter template from:', src);
console.log('To:', dest);

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
copyRecursiveSync(src, dest);
console.log('✓ Starter template copied successfully.');
