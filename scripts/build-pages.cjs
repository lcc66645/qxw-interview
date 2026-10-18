const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/portfolio.json'), 'utf8'));
data.presentation.managementDemo = JSON.parse(fs.readFileSync(path.join(root, 'data/management-demo.json'), 'utf8'));
data.presentation.visualLibrary = JSON.parse(fs.readFileSync(path.join(root, 'data/visual-library.json'), 'utf8'));
Object.entries(data.presentation.visualLibrary).forEach(([key, visual]) => {
  visual.desktop = `assets/visual-${key}.png`;
  visual.mobile = `assets/visual-${key}-mobile.png`;
  visual.desktopIndex = data.images.length;
  visual.mobileIndex = data.images.length + 1;
  data.images.push(visual.desktop, visual.mobile);
});
const shell = fs.readFileSync(path.join(root, 'templates/page.html'), 'utf8');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function write(file, content) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) fs.writeFileSync(target, content);
}

const page = data.pages.capabilities;
const navigation = Object.entries(data.pages).map(([key, item]) =>
  `<a href="${escape(item.route)}" data-page-link="${key}"${key === 'capabilities' ? ' aria-current="page"' : ''}><span class="nav-label-full">${escape(item.title)}</span><span class="nav-label-mobile">${escape(item.mobileTitle)}</span></a>`
).join('');
const html = shell.replaceAll('{{PAGE_ID}}', 'capabilities').replaceAll('{{PAGE_TITLE}}', escape(page.title)).replaceAll('{{NAVIGATION}}', navigation).replaceAll('{{PAGE_CONTENT}}', page.html);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved portfolio template');
write('index.html', html.trimEnd() + '\n');
write('portfolio-data.js', `window.portfolioData = ${JSON.stringify(data).replace(/</g, '\\u003c')};\n`);
console.log(`Generated one portfolio entry with ${Object.keys(data.pages).length} secondary views and shared portfolio-data.js.`);
