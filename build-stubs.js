const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const srcDir = path.join(__dirname, 'src', 'stubs', 'auth-email');
const destDir = path.join(__dirname, 'dist', 'stubs', 'auth-email');

copyDir(srcDir, destDir);
console.log('Stubs copied successfully from src/stubs/auth-email to dist/stubs/auth-email.');
