const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));
data.presentation.managementDemo = JSON.parse(fs.readFileSync(path.join(root, 'data/management-demo.json'), 'utf8'));
data.presentation.visualLibrary = JSON.parse(fs.readFileSync(path.join(root, 'data/visual-library.json'), 'utf8'));
data.presentation.showcase = JSON.parse(fs.readFileSync(path.join(root, 'data/evidence-showcase.json'), 'utf8'));
const shell = fs.readFileSync(path.join(root, 'templates/page.html'), 'utf8');
const releaseFiles = ['style.css', 'creator.css', 'studio.css', 'app.js', 'motion.js', 'portrait-scene.js', 'assets/vendor/three-0.160.1.min.js', ...data.images, ...data.reviewCharts];
const fingerprint = createHash('sha256').update(JSON.stringify(data)).update(shell);
releaseFiles.forEach(file => fingerprint.update(file).update(fs.readFileSync(path.join(root, file))));
data.release = { id: fingerprint.digest('hex').slice(0, 12), entry: 'portfolio-light.html' };
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function write(file, content) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) fs.writeFileSync(target, content);
}

const page = data.pages.capabilities;
const navigation = Object.entries(data.pages).map(([key, item]) =>
  `<a href="${escape(item.route)}" data-page-link="${key}"${key === 'capabilities' ? ' aria-current="page"' : ''}><span class="nav-label-full">${escape(item.title)}</span><span class="nav-label-mobile">${escape(item.mobileTitle)}</span></a>`
).join('');
const html = shell.replaceAll('{{PAGE_ID}}', 'capabilities').replaceAll('{{PAGE_TITLE}}', escape(page.title)).replaceAll('{{NAVIGATION}}', navigation).replaceAll('{{PAGE_CONTENT}}', page.html).replaceAll('{{ASSET_VERSION}}', data.release.id);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved portfolio template');
write('index.html', html.trimEnd() + '\n');
write(data.release.entry, html.trimEnd() + '\n');
write('portfolio-data.js', `window.portfolioData = ${JSON.stringify(data).replace(/</g, '\\u003c')};\n`);
console.log(`Generated one portfolio entry with ${Object.keys(data.pages).length} secondary views and shared portfolio-data.js.`);
