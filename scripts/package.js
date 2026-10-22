const fs = require('fs');
const { execSync } = require('child_process');
const { name, version } = require('../package.json');

fs.mkdirSync('dist', { recursive: true });
execSync(`vsce package --out dist/${name}-${version}.vsix`, { stdio: 'inherit' });