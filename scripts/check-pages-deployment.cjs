const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const expected = process.argv[2] || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const repository = 'https://github.com/lcc66645/qxw-interview';
const output = '/tmp/qxw-publication-qa';
fs.mkdirSync(output, { recursive: true });
function get(url) {
  return execFileSync('curl', ['--fail', '--silent', '--show-error', '--max-time', '25', url], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const parser = await browser.newPage();
    for (let attempt = 0; attempt < 18; attempt++) {
      const html = get(`${repository}/actions?publication-check=${Date.now()}`);
      const runs = await parser.evaluate(html => {
        const document = new DOMParser().parseFromString(html, 'text/html');
        for (const script of document.querySelectorAll('script[data-target="react-app.embeddedData"]')) {
          const data = JSON.parse(script.textContent);
          const runs = data.payload?.allWorkflowRunsRoute?.workflowRuns;
          if (runs) return runs.map(run => ({ id: run.id, url: run.runUrl, name: run.name, state: run.state }));
        }
        return [];
      }, html);
      for (const run of runs.filter(run => run.name === 'pages build and deployment').slice(0, 3)) {
        const detail = get(`${run.url}?publication-check=${Date.now()}`);
        const result = await parser.evaluate(({ html, expected }) => {
          const document = new DOMParser().parseFromString(html, 'text/html');
          const matches = document.title.includes(`@${expected.slice(0, 7)}`) || [...document.querySelectorAll('a[href]')].some(link => link.getAttribute('href').endsWith(`/commit/${expected}`));
          const url = [...document.querySelectorAll('a[href]')].map(link => link.href).find(href => href === 'https://lcc66645.github.io/qxw-interview/');
          return { matches, url, title: document.title };
        }, { html: detail, expected });
        if (!result.matches) continue;
        console.log(`Pages ${run.id}: ${run.state.status} / ${run.state.conclusion || 'pending'}`);
        if (run.state.status === 'WORKFLOW_RUN_STATUS_COMPLETED') {
          if (run.state.conclusion !== 'WORKFLOW_RUN_CONCLUSION_SUCCESS') throw new Error(`Pages failed: ${run.url}`);
          if (!result.url) throw new Error('Successful run did not expose the expected Pages URL');
          const receipt = { commit: expected, workflow: run.url, status: 'success', site: result.url };
          fs.writeFileSync(path.join(output, 'deployment.json'), JSON.stringify(receipt, null, 2) + '\n');
          console.log(JSON.stringify(receipt)); return;
        }
      }
      console.log(`Waiting for Pages deployment of ${expected.slice(0, 7)} (${attempt + 1}/18)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    throw new Error('Pages deployment not confirmed within the observation window');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
