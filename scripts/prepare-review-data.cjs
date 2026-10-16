const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const inputPath = process.argv[2];
if (!inputPath) throw new Error('Usage: node scripts/prepare-review-data.cjs <review-text-path>');
const input = fs.readFileSync(inputPath, 'utf8');
const lines = section => section.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
function between(start, end) {
  const from = input.indexOf(start);
  const to = input.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `Missing review section: ${start}`);
  return input.slice(from + start.length, to);
}
function blocks(section, first, columns, count) {
  const values = lines(section);
  const start = values.indexOf(first);
  assert(start >= 0, `Missing first row: ${first}`);
  const selected = values.slice(start, start + columns * count);
  assert.equal(selected.length, columns * count);
  return Array.from({ length: count }, (_, index) => selected.slice(index * columns, (index + 1) * columns));
}
function vv(value) {
  const match = value.match(/^([\d,.]+)\s*万$/);
  assert(match, `Invalid VV: ${value}`);
  return Math.round(Number(match[1].replaceAll(',', '')) * 10000);
}
function rate(value) { return value === '—' ? null : Number(value.replace('%', '')) / 100; }
function directUrl(markdown) {
  const match = markdown.match(/\]\((https:\/\/[^\s)]+)\)/);
  assert(match, 'Invalid sample link');
  const wrapped = new URL(match[1]);
  const url = wrapped.searchParams.get('target') || wrapped.href;
  const parsed = new URL(url);
  assert(['v.douyin.com', 'www.douyin.com'].includes(parsed.hostname));
  return parsed.href;
}
const points = blocks(between('落在右上角（高曝光 + 高于大盘拉新率）的只有两个卖点：', '来源：数据回收 sheet 按'), 'AI 帮选车 + 查优惠', 7, 9).map(([name, videos, views, acquisitions, statedRate, reactivations, role], index) => ({
  id: `selling-point-${index + 1}`, name, videos: Number(videos), vv: vv(views), acquisitions: Number(acquisitions), reactivations: Number(reactivations), sourceRate: rate(statedRate), sourceRole: role
}));
const creators = blocks(between('五、达人沉淀：四类角色已经分化清楚', '来源：数据回收 sheet 按昵称聚合'), '汽车隐藏说明书', 6, 8).map(([name, videos, views, acquisitions, reactivations, role]) => ({name, videos: Number(videos), vv: vv(views), acquisitions: Number(acquisitions), reactivations: Number(reactivations), role}));
const samples = blocks(between('6.1 样本：拉新 TOP 13 视频一览', '6.2 六个结构性共同点'), '1', 6, 13).map(([rank, creator, result, sellingPoint, conflict, link], index) => {
  const match = result.match(/^(\d+)\s*\/\s*([\d,.]+\s*万)$/);
  assert(match); assert.equal(Number(rank), index + 1);
  return {rank:Number(rank),creator,acquisitions:Number(match[1]),vv:vv(match[2]),sellingPoint,conflict,url:directUrl(link)};
});
const sourceReactivation = blocks(between('四、拉活视角：二手车内容是被低估的唤醒抓手', '最典型的样本是'), '智能找二手车', 4, 5).map(([name, reactivations, statedRate, statedMultiple], index) => ({name,reactivations:Number(reactivations),rate:rate(statedRate),sourceMultiple:statedMultiple,scope:index<3?'卖点聚合':'二手车线子集'}));
const overview = {period:'2026/09/24–10/08',days:15,videos:119,lines:[{name:'纯小懂',videos:107},{name:'二手车 & 小懂',videos:12}],sellingPoints:9,vv:36900000,acquisitions:238,reactivations:2443};
overview.acquisitionsPerMillion = overview.acquisitions / overview.vv * 1e6;
overview.reactivationsPerMillion = overview.reactivations / overview.vv * 1e6;
overview.meanVvPerPoint = overview.vv / overview.sellingPoints;
for (const point of points) {
  point.meanVv = point.vv / point.videos;
  point.acquisitionsPerMillion = point.acquisitions / point.vv * 1e6;
  point.reactivationsPerMillion = point.reactivations / point.vv * 1e6;
  point.acquisitionMultiple = point.acquisitionsPerMillion / overview.acquisitionsPerMillion;
  point.reactivationMultiple = point.reactivationsPerMillion / overview.reactivationsPerMillion;
}
for (const sample of samples) sample.acquisitionsPerMillion = sample.acquisitions / sample.vv * 1e6;
for (const row of sourceReactivation) {
  const point = points.find(point => point.name === row.name);
  row.perMillion = point ? point.reactivationsPerMillion : row.rate * 1e6;
  row.multiple = row.perMillion / overview.reactivationsPerMillion;
  row.calculation = point ? '按卖点 VV 与人数重算' : '按原文子集率估算，未提供子集 VV';
}
const sum = (rows, field) => rows.reduce((total, row) => total + row[field], 0);
const core = points.slice(0, 2);
const traffic = points.filter(point => ['小懂精准估价', '二手车交易避坑', 'AI 约试驾'].includes(point.name));
const coreCreators = creators.slice(0, 4);
function group(name, rows) {
  const result = {name,vv:sum(rows,'vv'),acquisitions:sum(rows,'acquisitions'),reactivations:sum(rows,'reactivations')};
  result.vvShare = result.vv / overview.vv;
  result.acquisitionShare = result.acquisitions / overview.acquisitions;
  result.reactivationShare = result.reactivations / overview.reactivations;
  return result;
}
const groups = [group('两个主力卖点', core), group('三个流量型卖点', traffic)];
const remainder = {name:'其他及明细差异',vv:overview.vv-sum(groups,'vv'),acquisitions:overview.acquisitions-sum(groups,'acquisitions')};
remainder.vvShare=remainder.vv/overview.vv;remainder.acquisitionShare=remainder.acquisitions/overview.acquisitions;
groups.push(remainder);
const storyComparison = [
 {name:'父亲卖霸道发工资',vv:590000,acquisitions:17,interpretation:'角色当下需要估价，工具承担剧情内的解题任务',url:samples[3].url},
 {name:'C63 估价旁白',vv:3750000,acquisitions:2,interpretation:'剧情已识别车辆，工具以重复信息的旁白出现',url:'https://www.douyin.com/user/MS4wLjABAAAA1EVDcJB9udtxMrJdFmsk5pFzzMR8IGtqjGUl2VCCdY0?from_tab_name=main&modal_id=7690468448844959017'}
];
storyComparison.forEach(row=>{row.perMillion=row.acquisitions/row.vv*1e6;});
const reconciliation = {detailVideos:sum(points,'videos'),detailVv:sum(points,'vv'),detailAcquisitions:sum(points,'acquisitions'),detailReactivations:sum(points,'reactivations')};
reconciliation.vvGap=overview.vv-reconciliation.detailVv;
reconciliation.acquisitionGap=overview.acquisitions-reconciliation.detailAcquisitions;
assert.equal(reconciliation.detailVideos,119);assert.equal(reconciliation.detailReactivations,2443);
assert.equal(reconciliation.vvGap,10000);assert.equal(reconciliation.acquisitionGap,1);
assert.equal(groups[0].acquisitions,153);assert.equal(groups[1].acquisitions,46);
assert.equal(sum(coreCreators,'reactivations'),1391);
const corrections = [
 '总览为3,690万 VV、238人拉新；9卖点明细合计3,689万 VV、237人拉新，分别差1万 VV与1人。保留差异，不向任一卖点补数。',
 '两个主力卖点合计153人，占总览238人的64.3%；原文“65%”作为近似说法，不再展示为精确比例。',
 '三个流量型卖点的拉新效率约为大盘0.12–0.60倍，并非都只有1/5–1/10。均 VV 分别约55.3万、124.8万、96.5万/条。',
 '“二手车内容拉活3–7倍”仅适用于部分卖点或二手车线子集。卖点聚合下，知识问答约1.58倍、智能找二手车约3.69倍；不同粒度不可相加。',
 '四个指定头部账号合计拉活1,391人，占总览56.9%，不支持原文73%的说法；曝光约60.5%、拉新约77.7%。',
 '父亲卖车样本17人/59万 VV，对比 C63 样本2人/375万 VV，按舍入 VV 估算效率约54.0倍，并非原文14倍；两条观察样本不能证明单因素因果。',
 'TOP13中“懂车的小姬”4人/7万 VV约57.14人/百万 VV，高于贷款维权样本67人/252万 VV的26.59人/百万 VV。贷款维权是此表拉新人数最高，不是率最高；没有成本数据，不给单条 ROI 排名。',
 '同一 GTI 样本在 TOP13表列439万 VV、4人拉新，模板段落又列59万 VV；暂按 TOP13表展示439万，原始单条数据待回源核验。',
 '模板不是卖点分组：不能把两卖点64.3%的贡献归因于“家庭伦理模板”。话术具体度、场景需求、功能匹配与工具位置应联合判断。'
];
const result = {schemaVersion:1,source:{file:'已粘贴的文本.txt',sha256:crypto.createHash('sha256').update(input).digest('hex'),namedTable:'飞书《AI 小懂 AIGC 卖点 & 内容回收》· 数据回收 sheet（原文转述，未直接读取原表）',attribution:'原文称为链接点击后回流数据；曝光字段按内容 VV 展示。点击数、UV、成本、去重规则和归因窗口未提供。'},overview,points,creators,samples,reactivationScopes:sourceReactivation,groups,coreCreators:group('指定四个头部账号',coreCreators),storyComparison,storyEfficiencyRatio:storyComparison[0].perMillion/storyComparison[1].perMillion,reconciliation,corrections};
const output=path.resolve(__dirname,'../data/campaign-review.json');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({overview,detail:reconciliation,coreShare:groups[0].acquisitionShare,trafficRates:traffic.map(row=>({name:row.name,relativeToBaseline:row.acquisitionMultiple})),creatorReactivationShare:result.coreCreators.reactivationShare,storyEfficiencyRatio:result.storyEfficiencyRatio}));
