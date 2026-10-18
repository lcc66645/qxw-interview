(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const initial = window.portfolioData || JSON.parse($('#portfolio-data').textContent);
  const source = initial.source;
  const pages = initial.pages;
  const hasPage = id => Object.hasOwn(pages, id);
  const defaultPage = hasPage(document.body.dataset.page) ? document.body.dataset.page : 'capabilities';
  let currentPage = defaultPage;
  let disposeMotion = () => {};
  const storageKey = 'qxw-portfolio-v2';
  const fields = ['name', 'role', 'location', 'headline', 'intro', 'about', 'email'];
  const mediaKeys = ['portrait', 'production', 'growth', 'team'];
  const data = { profile: structuredClone(initial.profile), projects: structuredClone(initial.projects), media: {} };
  let draftMedia = {};
  const validImage = value => typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length < 5600000;
  const icon = name => initial.icons[name] || '';
  const isRetired = (value, previous) => (Array.isArray(previous) ? previous : [previous]).includes(value);
  const headerObserver = new ResizeObserver(() => {
    document.documentElement.style.setProperty('--portfolio-header-height', `${$('.header').getBoundingClientRect().height}px`);
  });
  headerObserver.observe($('.header'));
  window.portfolioIcons = initial.icons;
  const retiredReviewDescriptions = new Set([
    '119条有效视频、3,690万内容 VV、238人拉新、2,443人拉活。按9个卖点分别比较 VV、拉新效率与老用户唤醒，两个主力卖点合计153人拉新，占64.3%；明细差异单独说明。'
  ]);

  function merge(saved) {
    if (!saved || typeof saved !== 'object') return;
    if (saved.media && typeof saved.media === 'object') data.media = {};
    mediaKeys.forEach(key => { if (validImage(saved.media?.[key])) data.media[key] = saved.media[key]; });
    for (const key of fields) {
      if (typeof saved.profile?.[key] !== 'string') continue;
      if (isRetired(saved.profile[key], initial.retiredCopy?.profile?.[key])) continue;
      data.profile[key] = saved.profile[key];
    }
    if (Array.isArray(saved.projects)) {
      for (const project of data.projects) {
        const previous = saved.projects.find(item => item?.id === project.id);
        for (const key of ['title', 'description']) {
          if (typeof previous?.[key] !== 'string') continue;
          if (isRetired(previous[key], initial.retiredCopy?.projects?.[project.id]?.[key])) continue;
          if (project.id === 'holiday' && key === 'description' && retiredReviewDescriptions.has(previous[key])) continue;
          project[key] = previous[key];
        }
      }
    }
  }
  // Earlier versions stored placeholder projects; keep that storage separate from this resume.
  if (!initial.exported) {
    try { merge(JSON.parse(localStorage.getItem(storageKey))); } catch {}
  } else merge({ media: initial.media });

  function text(parent, tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }
  function iconElement(name) {
    const element = document.createElement('span');
    element.className = 'inline-icon';
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = icon(name);
    return element;
  }
  function metrics(parent, values) {
    const list = document.createElement('dl');
    list.className = 'metric-list';
    for (const metric of values) {
      const item = document.createElement('div');
      text(item, 'dt', metric.label);
      text(item, 'dd', metric.value);
      list.append(item);
    }
    parent.append(list);
    return list;
  }
  function externalLink(parent, title, url, className = '') {
    const link = text(parent, 'a', title, className);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(iconElement('arrow-up-right'));
    return link;
  }
  function renderProfile() {
    let backdrop = $('#studio-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div'); backdrop.id = 'studio-backdrop'; backdrop.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img'); image.src = initial.design.backgroundImage; image.alt = ''; backdrop.append(image); document.body.prepend(backdrop);
    }
    $$('[data-bind]').forEach(element => { element.textContent = data.profile[element.dataset.bind]; });
    $$('[data-year]').forEach(element => { element.textContent = new Date().getFullYear(); });
    document.title = `${pages[currentPage].title} · ${data.profile.name} · 作品集`;
    $('#copy-email').replaceChildren(document.createTextNode(data.profile.email), iconElement('copy'));
    const portrait = $('.portrait-image');
    if (portrait) {
      portrait.closest('section').dataset.avatar = data.media.portrait ? 'custom' : 'studio';
      portrait.src = data.media.portrait || initial.design.heroImage;
      portrait.alt = data.media.portrait ? `${data.profile.name}的个人肖像` : '工作室中戴眼镜的AIGC创作者，伸手递出作品画册';
      $('.portrait-kind').textContent = data.media.portrait ? 'PORTRAIT' : 'AIGC AVATAR';
      $('.portrait-copy').classList.toggle('is-long-name', data.profile.name.length > 10);
    }
  }
  function renderPortrait() {
    const section = document.createElement('section'); section.className = 'portrait-intro'; section.id = 'home'; section.setAttribute('aria-label', '关于我');
    const art = document.createElement('div'); art.className = 'portrait-art'; section.append(art);
    const image = document.createElement('img'); image.className = 'portrait-image'; image.width = 1672; image.height = 941; image.fetchPriority = 'high';
    art.append(image);
    const stage = document.createElement('div'); stage.className = 'portrait-stage'; stage.dataset.status = 'loading'; stage.setAttribute('aria-hidden', 'true'); art.append(stage);
    const copy = document.createElement('div'); copy.className = 'portrait-copy';
    text(copy, 'p', 'CONTENT / GROWTH / AIGC', 'section-kicker');
    const title = text(copy, 'h1', data.profile.name); title.dataset.bind = 'name';
    section.append(copy);
    text(art, 'span', '', 'portrait-kind');
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'icon-button portrait-pause'; toggle.dataset.togglePortrait = '';
    toggle.setAttribute('aria-label', '暂停人物动态'); toggle.title = '暂停人物动态'; toggle.setAttribute('aria-pressed', 'false'); toggle.append(iconElement('pause')); art.append(toggle);
    $('#main').prepend(section);
    const about = $('.about-copy');
    about.querySelector('.section-kicker').remove(); about.querySelector('.about-name').remove();
    const heading = document.createElement('h2'); heading.id = 'about-title'; heading.textContent = '关于我';
    about.querySelector('#about-title').replaceWith(heading); copy.append(about);
    const bio = document.createElement('aside'); bio.className = 'portrait-bio'; bio.setAttribute('aria-label', '经历与成果');
    const history = document.createElement('div'); history.className = 'portrait-history';
    text(history, 'h3', '经历与成果');
    source.jobs.forEach(job => {
      const item = document.createElement('article');
      text(item, 'p', job.period, 'portrait-period');
      text(item, 'h4', '懂车帝');
      text(item, 'p', job.role);
      text(item, 'p', '负责选题、脚本、AIGC生产标准与上线审核，独立运营4个账号。', 'portrait-achievement');
      history.append(item);
    });
    const contact = text(history, 'a', data.profile.email, 'portrait-email'); contact.href = `mailto:${data.profile.email}`; contact.dataset.bind = 'email';
    bio.append(history, $('.hero-metrics')); section.append(bio); $('.creator-about').remove();
  }
  function visualPath(key) {
    return data.media[key] || ({ production: initial.images[1], growth: initial.reviewCharts[0], team: initial.images[2] })[key];
  }
  function evidenceFigure(parent, key, caption, className = '') {
    const figure = document.createElement('figure'); figure.className = `project-visual ${className}`.trim();
    const button = document.createElement('button'); button.type = 'button'; button.className = 'visual-button';
    button.title = `放大查看：${caption}`; button.setAttribute('aria-label', button.title); button.dataset.enlarge = key;
    const image = document.createElement('img'); image.src = visualPath(key); image.alt = caption;
    image.width = key === 'growth' ? 2016 : 1200; image.height = key === 'growth' ? 972 : 780;
    button.append(image);
    const indicator = document.createElement('span'); indicator.className = 'visual-zoom'; indicator.append(iconElement('arrow-up-right')); button.append(indicator);
    figure.append(button); text(figure, 'figcaption', data.media[key] ? caption.split(' · ')[0] : caption); parent.append(figure);
  }
  function renderCapabilities() {
    visualFigure($('#capability-grid').parentElement, 'capabilities', $('#capability-grid'));
    initial.presentation.dimensions.forEach((dimension, index) => {
      const article = document.createElement('article');
      article.className = 'capability-item';
      text(article, 'span', String(index + 1).padStart(2, '0'), 'capability-number');
      const content = document.createElement('div');
      text(content, 'h3', dimension.title);
      const example = document.createElement('div'); example.className = 'capability-case';
      const link = text(example, 'a', '查看具体实践', 'case-anchor'); link.href = pageHref(dimension.page); link.append(iconElement('arrow-up-right')); content.append(example);
      article.append(content);
      $('#capability-grid').append(article);
    });
  }
  function visualFigure(parent, key, before = null) {
    const visual = initial.presentation.visualLibrary[key];
    const figure = document.createElement('figure'); figure.className = 'project-visual infographic-figure'; figure.dataset.visual = key;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'visual-button'; button.dataset.enlarge = `visual-${key}`;
    button.title = `放大查看：${visual.title}`; button.setAttribute('aria-label', button.title);
    button.dataset.visualTitle = visual.title;
    [['desktop',1440,780],['mobile',720,1200]].forEach(([variant,width,height]) => {
      const image = document.createElement('img'); image.className = `infographic-${variant}`;
      image.src = initial.images[visual[`${variant}Index`]]; image.alt = visual.alt; image.width = width; image.height = height; image.decoding = 'async'; button.append(image);
    });
    const indicator = document.createElement('span'); indicator.className = 'visual-zoom'; indicator.append(iconElement('arrow-up-right')); button.append(indicator);
    figure.append(button); text(figure, 'figcaption', visual.title);
    parent.insertBefore(figure, before); return figure;
  }
  function renderDimension(index, { before, afterIntro, showMetrics = true, showCaseLink = true, showPoints = true } = {}) {
    const dimension = initial.presentation.dimensions[index];
    const parent = $('#dimension-content'); parent.dataset.dimension = dimension.key;
    if (before) before(parent);
    text(parent, 'p', dimension.thesis, 'dimension-thesis');
    if (index === 2 && showMetrics) metrics(parent, dimension.metrics).classList.add('dimension-metrics');
    if (afterIntro) afterIntro(parent);
    const list = document.createElement('div'); list.className = 'dimension-points';
    if (showPoints && index === 2) text(list, 'h2', '01 / 个人成果', 'board-title');
    if (showPoints && index === 2) visualFigure(list, 'creation');
    if (showPoints) dimension.points.forEach((point, pointIndex) => {
      const item = document.createElement('details'); item.className = 'dimension-point';
      const summary = document.createElement('summary'); text(summary, 'h3', `${pointIndex + 1}. ${point.title}`); summary.append(iconElement('arrow-down')); item.append(summary);
      const copy = document.createElement('div');
      text(copy, 'p', point.action); text(copy, 'p', point.evidence, 'dimension-evidence'); item.append(copy); list.append(item);
    }); if (showPoints) parent.append(list);
    if (index !== 2 && showMetrics) metrics(parent, dimension.metrics).classList.add('dimension-metrics');
    if (showCaseLink) {
      const link = text(parent, 'a', dimension.caseLabel, 'case-anchor dimension-link');
      link.href = pageHref(dimension.casePage || 'skills', dimension.caseAnchor); link.append(iconElement('arrow-up-right'));
    }
    return parent;
  }
  function renderCompetence(parent, competence, support, example) {
    text(parent, 'p', support?.action || competence.summary.action, 'practice-action');
    if (!support) return;
    const detail = document.createElement('div'); detail.className = 'practice-support';
    text(detail, 'p', example ? `目的：${example.purpose}` : support.goal, 'practice-goal');
    const thinking = document.createElement('dl'); thinking.className = 'practice-thinking';
    [['我的判断', support.judgment], ['策略取舍', support.tradeoff]].forEach(([label, value]) => {
      text(thinking, 'dt', label); text(thinking, 'dd', value);
    }); detail.append(thinking);
    const list = document.createElement('ul'); support.steps.forEach(step => text(list, 'li', step)); detail.append(list); parent.append(detail);
    text(parent, 'p', `能力体现：${support.competency}`, 'practice-competency');
    if (support.deliverable) text(parent, 'p', `我交付：${support.deliverable}`, 'practice-deliverable');
    if (support.visual === 'growth') renderGrowthStrategy(parent);
    if (example) renderCaseProof(parent, example, 'practice-case', false);
    if (support.visual) evidenceFigure(parent, support.visual, support.caption);
    if (support.visual === 'production') renderProductionCost(parent);
    if (support.visual === 'team') renderMatrixBudget(parent);
    if (support.visual === 'growth') {
      const comparison = document.createElement('div'); comparison.className = 'weekly-comparison';
      text(comparison, 'h5', '矩阵周拉新 · 相邻两周');
      [[71, '前一周'], [212, '后一周']].forEach(([value, label]) => {
        const row = document.createElement('div'); row.className = 'comparison-row';
        text(row, 'span', label); const track = document.createElement('span'); track.className = 'comparison-track';
        const bar = document.createElement('span'); bar.style.width = `${value / 212 * 100}%`; track.append(bar); row.append(track); text(row, 'strong', `${value}人`); comparison.append(row);
      });
      text(comparison, 'p', '环比 +198.6%', 'comparison-result'); parent.append(comparison);
    }
  }
  function workDisclosure(parent, id, title) {
    const detail = document.createElement('details'); detail.id = id; detail.className = 'work-decision';
    const summary = document.createElement('summary'); text(summary, 'span', title); summary.append(iconElement('arrow-down'));
    detail.append(summary); parent.append(detail); return detail;
  }
  function strategySection(parent, title, id) {
    const section = document.createElement('section'); section.className = 'strategy-section';
    if (id) section.id = id;
    text(section, 'h5', title); parent.append(section); return section;
  }
  function strategyTable(parent, caption, headings, rows) {
    const table = document.createElement('table'); table.className = 'strategy-table';
    text(table, 'caption', caption);
    const header = table.createTHead().insertRow(); headings.forEach(label => { const cell = text(header, 'th', label); cell.scope = 'col'; });
    const body = table.createTBody(); rows.forEach(values => {
      const row = body.insertRow(); values.forEach((value, index) => { const cell = text(row, index ? 'td' : 'th', value); if (!index) cell.scope = 'row'; });
    }); parent.append(table);
  }
  function renderGrowthStrategy(parent) {
    const strategy = initial.presentation.growthStrategy;
    const detail = workDisclosure(parent, 'growth-strategy', strategy.title);
    const business = strategySection(detail, '业务定位'); text(business, 'p', strategy.business);
    const audience = strategySection(detail, '目标人群与需求任务'); text(audience, 'p', strategy.audience);
    strategyTable(audience, '用户任务与功能匹配', ['人群任务', '决策难题', '内容承接'], strategy.tasks);
    const positioning = strategySection(detail, '竞争定位与运营选择'); text(positioning, 'p', strategy.positioning);
    const goal = strategySection(detail, strategy.goal.title, 'growth-goal');
    text(goal, 'p', strategy.goal.rationale);
    const formula = document.createElement('dl'); formula.className = 'goal-formula';
    [[strategy.goal.hitsPerMonth, '条高拉新作品/月'], [strategy.goal.acquisitionsPerHit, '人拉新/作品'], [strategy.goal.hitsPerMonth * strategy.goal.acquisitionsPerHit, '人拉新/人/月 · 目标']].forEach(([value, label]) => {
      const term = document.createElement('div'); text(term, 'dt', label); text(term, 'dd', value); formula.append(term);
    }); goal.append(formula); text(goal, 'p', strategy.goal.description); text(goal, 'p', strategy.goal.metrics);
    const progress = document.createElement('figure'); progress.className = 'goal-progress';
    text(progress, 'figcaption', `${strategy.goal.progress.date} · 月目标进度快照`);
    [['VV目标进度', strategy.goal.progress.vvPercent], ['拉新目标进度', strategy.goal.progress.acquisitionPercent]].forEach(([label, value]) => {
      const row = document.createElement('div'); row.className = 'goal-progress-row'; text(row, 'span', label);
      const track = document.createElement('span'); track.className = 'cost-track'; track.setAttribute('aria-hidden', 'true');
      const bar = document.createElement('span'); bar.style.width = `${value}%`; track.append(bar); row.append(track); text(row, 'strong', `${value}%`); progress.append(row);
    }); goal.append(progress); text(goal, 'p', strategy.goal.decision, 'decision-result');
    const channels = strategySection(detail, '平台布局与分发方式', 'growth-channels');
    const snapshot = strategy.channels;
    text(channels, 'p', `${snapshot.period}：全平台${snapshot.totalVv / 10000}万、抖音${snapshot.douyinVv / 10000}万；抖音日VV份额${(snapshot.douyinVv / snapshot.totalVv * 100).toFixed(1)}%。`, 'channel-snapshot');
    strategyTable(channels, '平台职责', ['平台', '运营角色', '执行重点'], snapshot.platforms);
    text(channels, 'p', snapshot.decision);
    const link = text(detail, 'a', '查看AI小懂的完整增长拆解', 'case-anchor'); link.href = pageHref('experience', 'case-stage-1'); link.append(iconElement('arrow-up-right'));
  }
  function renderGrowthLoop(parent) {
    const strategy = initial.presentation.growthStrategy;
    const path = strategySection(parent, '用户路径 / 从观看动机到产品使用');
    const steps = document.createElement('ol'); steps.className = 'user-growth-path';
    strategy.userPath.forEach((label, index) => { const item = text(steps, 'li', label); if (index < strategy.userPath.length - 1) item.append(iconElement('arrow-down')); }); path.append(steps);
    const loop = strategySection(parent, '运营闭环 / 从内容验证到规模复用');
    const list = document.createElement('ol'); list.className = 'growth-operation-loop';
    strategy.operationLoop.forEach(([title, description], index) => {
      const item = document.createElement('li'); text(item, 'span', String(index + 1).padStart(2, '0'), 'loop-number');
      const copy = document.createElement('div'); text(copy, 'h5', title); text(copy, 'p', description); item.append(copy); list.append(item);
    }); loop.append(list); text(loop, 'p', '结果回到人群、卖点与脚本；未跑通的方向继续验证，已验证结构才交给矩阵复制。', 'loop-return');
  }
  function renderGrowthDiagnostics(parent) {
    const list = document.createElement('dl'); list.className = 'growth-diagnostics';
    initial.presentation.growthStrategy.diagnostics.forEach(item => {
      const row = document.createElement('div'); text(row, 'dt', item.signal);
      const copy = document.createElement('dd'); text(copy, 'p', item.evidence, 'diagnostic-evidence');
      text(copy, 'p', `判断：${item.judgment}`); text(copy, 'p', `我的动作：${item.action}`); row.append(copy); list.append(row);
    }); parent.append(list);
  }
  function renderProductionCost(parent) {
    const cost = initial.presentation.productionCost;
    const detail = workDisclosure(parent, 'production-cost-control', cost.title);
    text(detail, 'p', `目的：${cost.purpose}`, 'decision-purpose'); text(detail, 'p', cost.context);
    const comparison = document.createElement('figure'); comparison.className = 'cost-comparison';
    text(comparison, 'figcaption', `${cost.model} · 每次生成${cost.durationSeconds}秒片段`);
    cost.segments.forEach(segment => {
      const row = document.createElement('div'); row.className = 'cost-segment';
      text(row, 'span', segment.resolution);
      const track = document.createElement('span'); track.className = 'cost-track'; track.setAttribute('aria-hidden', 'true');
      const bar = document.createElement('span'); bar.style.width = `${segment.tokens / Math.max(...cost.segments.map(item => item.tokens)) * 100}%`; track.append(bar); row.append(track);
      text(row, 'strong', `${segment.approximate ? '约' : ''}${segment.tokens} token`); comparison.append(row);
    }); detail.append(comparison);
    const table = document.createElement('table'); table.className = 'cost-policy';
    text(table, 'caption', '按内容等级约束模型使用');
    const head = table.createTHead().insertRow(); ['内容类型', '模型', '使用判断'].forEach(label => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; head.append(cell); });
    const body = table.createTBody(); cost.rules.forEach(rule => { const row = body.insertRow();
      const label = document.createElement('th'); label.scope = 'row'; label.textContent = rule.content; row.append(label);
      text(row, 'td', rule.model); text(row, 'td', rule.decision);
    }); detail.append(table); text(detail, 'p', cost.action); text(detail, 'p', `交付结果：${cost.result}`, 'decision-result');
  }
  function renderMatrixBudget(parent) {
    const budget = initial.presentation.matrixBudget;
    const detail = workDisclosure(parent, 'matrix-budget-control', budget.title);
    text(detail, 'p', `目的：${budget.purpose}`, 'decision-purpose');
    const decisions = document.createElement('dl'); decisions.className = 'growth-diagnostics matrix-decisions';
    budget.decisions.forEach(item => {
      const row = document.createElement('div'); text(row, 'dt', item.title);
      const copy = document.createElement('dd'); text(copy, 'p', item.problem, 'diagnostic-evidence');
      text(copy, 'p', `判断：${item.judgment}`); text(copy, 'p', `我的动作：${item.action}`); row.append(copy); decisions.append(row);
    }); detail.append(decisions); text(detail, 'h5', '预算与激励的具体管理');
    const steps = document.createElement('dl'); steps.className = 'budget-steps';
    budget.budgetSteps.forEach(step => { text(steps, 'dt', step.title); text(steps, 'dd', step.action); }); detail.append(steps);
    text(detail, 'p', budget.result, 'decision-result');
  }
  function renderCaseProof(parent, example, className, showPurpose = true) {
    const section = document.createElement('section'); section.className = className;
    if (showPurpose) text(section, 'p', `目的：${example.purpose}`, 'proof-purpose');
    text(section, 'h5', example.title); text(section, 'p', example.action, 'proof-action');
    text(section, 'p', example.result, 'proof-result'); parent.append(section);
  }
  function renderOKR(parent, job) {
    const section = document.createElement('section'); section.className = 'job-okr'; section.id = 'team-okr'; section.setAttribute('aria-label', '懂车帝工作OKR');
    text(section, 'h2', 'OKR / 先定目标，再拆管理动作', 'board-title');
    text(section, 'p', '核心考核拉新；内容排期至少80%承接业务卖点。300人 / 人 / 月为规划，阶段结果与管理交付分别呈现。', 'board-note');
    job.okr.forEach((item, index) => {
      const row = document.createElement('details'); row.className = 'okr-row'; row.id = `okr-${index + 1}`;
      const objective = document.createElement('summary');
      text(objective, 'span', `O${index + 1}`, 'okr-number');
      const heading = document.createElement('span'); heading.className = 'okr-heading';
      text(heading, 'span', initial.presentation.okrTitles[index], 'okr-title');
      text(heading, 'span', initial.presentation.evidenceBoards.team[index].snapshot, 'okr-snapshot');
      objective.append(heading, iconElement('arrow-down'));
      const results = document.createElement('ul'); results.className = 'okr-results';
      initial.presentation.okrResults[index].forEach(result => {
        const split = result.indexOf('：'); const entry = document.createElement('li');
        text(entry, 'span', result.slice(0, split), 'kr-label'); text(entry, 'span', result.slice(split + 1)); results.append(entry);
      }); row.append(objective, results);
      boardTable(row, `O${index + 1} / 从KR到管理执行`, ['目标拆分', '我的管理动作', '阶段表现 / 已交付'], initial.presentation.evidenceBoards.team[index].management, 'management-table');
      section.append(row);
    }); parent.append(section);
  }
  function renderExperience() {
    renderDimension(0, { afterIntro: renderGrowthBoard, showPoints: false, showMetrics: false });
  }
  function selectExperiencePanel(key) {
    $$('[data-experience-panel]').forEach(panel => {
      const active = panel.dataset.experiencePanel === key; panel.hidden = !active;
      if (active) {
        panel.classList.add('is-visible');
        if (key === 'business-review') panel.querySelector('#business-review').open = true;
      }
    });
    $$('[data-experience-tab]').forEach(button => {
      const active = button.dataset.experienceTab === key;
      button.setAttribute('aria-expanded', String(active)); button.classList.toggle('is-active', active);
    });
  }
  function renderProjectCase(parent) {
    const heading = text(parent, 'h4', '懂车帝 / 项目案例', 'portfolio-case-title');
    heading.id = 'case-study-title';
    const details = document.createElement('details'); details.className = 'review-tip portfolio-case'; details.id = 'business-review'; details.open = true;
    const summary = document.createElement('summary');
    text(summary, 'span', 'CASE 01', 'tip-label');
    const title = document.createElement('span'); title.className = 'tip-heading';
    text(title, 'strong', 'AI 小懂星图复盘'); text(title, 'span', '卖点判断、模板交付、脚本验证');
    summary.append(title); details.append(summary);
    const body = document.createElement('div'); body.id = 'business-review-body'; body.className = 'review-body';
    details.append(body); parent.append(details);
  }
  function renderReviewTips() {
    const body = $('#business-review-body'); if (!body) return; body.replaceChildren();
    const project = data.projects.find(item => item.id === 'holiday');
    text(body, 'h4', project.title, 'tip-project-title');
    text(body, 'p', project.description, 'review-intro');
    renderBusinessReview(body);
  }
  function reviewActions(parent, items) {
    const list = document.createElement('dl'); list.className = 'review-actions';
    items.forEach(([title, action]) => {
      const row = document.createElement('div');
      text(row, 'dt', title); text(row, 'dd', action); list.append(row);
    }); parent.append(list);
  }
  function caseDisclosure(id, title) {
    const section = document.createElement('details'); section.className = 'case-perspective'; section.id = id;
    const summary = document.createElement('summary');
    text(summary, 'h4', title); summary.append(iconElement('arrow-down')); section.append(summary);
    return section;
  }
  function renderBusinessReview(parent) {
    text(parent, 'p', `${initial.campaignReview.overview.period} · 中秋国庆项目`, 'case-context');
    text(parent, 'p', '个人负责：9卖点分析、TOP13与3条反例拆解、3套模板及脚本检查项交付。', 'case-responsibility');
    initial.presentation.casePerspectives.forEach(({ id, title, decision, action, output }) => {
      const section = caseDisclosure(id, title);
      const reasoning = document.createElement('dl'); reasoning.className = 'case-reasoning';
      [['我的判断', decision], ['我的动作', action], ['交付与验证', output]].forEach(([label, value]) => {
        text(reasoning, 'dt', label); text(reasoning, 'dd', value);
      }); section.append(reasoning);
      if (id === 'case-growth') {
        renderCampaignEvidence(section);
        renderMatrixBudget(section);
      }
      if (id === 'case-team') {
        const link = text(section, 'a', '查看日常生产中的模型分级与成本管理', 'case-anchor'); link.href = pageHref('experience', 'production-cost-control'); link.append(iconElement('arrow-up-right'));
      }
      parent.append(section);
    });
    const results = document.createElement('section'); results.className = 'case-results'; results.id = 'case-results';
    text(results, 'h4', '项目整体结果与个人交付');
    metrics(results, [
      { label: '活动视频', value: '119条' }, { label: '累计VV', value: '3,690万' },
      { label: '项目拉新', value: '238人' }, { label: '项目拉活', value: '2,443人' }
    ]).classList.add('campaign-metrics', 'graphic-accessible');
    visualFigure(results, 'case');
    text(results, 'p', '识别两大拉新主力卖点，贡献153人拉新（64.3%）；智能找二手车带来803人拉活。', 'review-highlight');
    const extra = workDisclosure(results, 'case-detail-evidence', '展开卖点数据与分析图');
    const wrap = document.createElement('div'); wrap.className = 'review-table-wrap'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '业务卖点成果对比');
    const table = document.createElement('table'); table.className = 'review-table';
    text(table, 'caption', '业务卖点成果对比');
    const head = document.createElement('thead'); const header = document.createElement('tr');
    ['业务卖点', '内容VV', '拉新', '拉活'].forEach(label => { const cell = text(header, 'th', label); cell.scope = 'col'; }); head.append(header); table.append(head);
    const body = document.createElement('tbody');
    [0, 1, 2, 4].forEach(index => {
      const point = initial.campaignReview.points[index]; const row = document.createElement('tr');
      const name = text(row, 'th', point.name); name.scope = 'row';
      [`${point.vv / 10000}万`, `${point.acquisitions}人`, `${point.reactivations}人`].forEach(value => text(row, 'td', value)); body.append(row);
    }); table.append(body); wrap.append(table); extra.append(wrap);
    evidenceFigure(extra, 'growth', '播放表现与拉新贡献 · 中秋国庆星图项目', 'review-chart');
    text(extra, 'p', '两个主力卖点占32.2%的VV、64.3%的拉新；三个高播放低拉新卖点占46.5%的VV、19.3%的拉新。下一轮优先验证选车优惠和语音讲车的需求匹配与脚本表达。', 'review-highlight');
    parent.insertBefore(results, parent.querySelector('.case-perspective'));
    const lessons = caseDisclosure('pitfall-review', '反例与下一轮验证');
    renderBadCases(lessons);
    parent.append(lessons);
    const links = document.createElement('div'); links.className = 'case-links';
    ['贷款维权', '借车讲车', '借车接客'].forEach((title, index) => externalLink(links, title, source.links[index + 9].url));
    parent.append(links);
  }
  function renderBadCases(parent) {
    const group = document.createElement('div'); group.className = 'badcase-list';
    text(group, 'h5', 'Bad Case / 单条样本与卖点汇总分别分析');
    const examples = [
      { title: '01 / 单条样本：信息展示不等于使用动机', purpose: '分析工具是否承接了角色尚未完成的决策任务。', failed: '单条 / C63估价旁白', failedData: '375万VV / 2人拉新', better: '单条 / 父亲卖霸道发工资', betterData: '59万VV / 17人拉新', diagnosis: '逐句拆解后，我将“功能只重复已有信息”作为C63脚本的待检验问题；卖霸道样本中则存在现场估价需求。两条作品的差异用于形成改稿假设，不视为同条件实验。', action: '逐项标记“未解决任务—工具动作—决策结果”，下一轮优先验证工具参与解题的位置。', url: initial.campaignReview.storyComparison[1].url },
      { title: '02 / 卖点汇总：传播规模与拉新贡献错位', purpose: '识别值得继续验证的内容方向，而非仅按VV排序。', failed: '卖点汇总 / 小懂精准估价', failedData: '830万VV / 32人拉新', better: '卖点汇总 / AI帮选车+查优惠', betterData: '691万VV / 89人拉新', diagnosis: '这是两个卖点下多条作品的汇总对照，不是单条脚本对照。我据此将选车优惠列为下一轮优先验证方向，再结合达人、作品和投放条件判断是否扩大投入。', action: '先回查卖点对应的人群任务、脚本结构与达人适配，不凭汇总数据直接认定某个功能必然转化更好。' },
      { title: '03 / 单条样本：剧情冲突与功能需求不匹配', purpose: '分别评价剧情吸引力与产品功能的任务匹配。', failed: '单条 / 家庭接孩子冲突·AI约试驾', failedData: '289万VV / 3人拉新', better: '单条 / 贷款算账维权·帮选车+查优惠', betterData: '252万VV / 67人拉新', diagnosis: '家庭接孩子的冲突不直接产生试驾需求；贷款算账则对应当下购车信息决策。我将功能与场景不匹配作为前者的脚本诊断，而不将两条作品的拉新差异全部归因于植入方式。', action: '先写清角色难题、功能作用和观众可执行的动作，再在可比条件下测试；不只补充一句下载提示。', url: initial.campaignReview.samples[12].url }
    ];
    examples.forEach(example => {
      const item = document.createElement('article'); item.className = 'badcase-item';
      text(item, 'h6', example.title); text(item, 'p', `目的：${example.purpose}`, 'proof-purpose');
      const comparison = document.createElement('dl'); comparison.className = 'badcase-comparison';
      [[example.failed, example.failedData], [example.better, example.betterData]].forEach(([title, result]) => {
        const row = document.createElement('div'); text(row, 'dt', title); text(row, 'dd', result); comparison.append(row);
      }); item.append(comparison);
      text(item, 'p', example.diagnosis, 'badcase-diagnosis'); text(item, 'p', `下一轮动作：${example.action}`, 'badcase-action');
      if (example.url) externalLink(item, '查看分析样本', example.url);
      group.append(item);
    }); parent.append(group);
  }
  function renderTechStack() {
    const parent = $('#dimension-content');
    pageOutline(parent, [['case-results', '项目结果', '项目成绩与个人交付分开'], ['case-growth', '能力拆解', '增长判断 / 团队推进 / 创作验证'], ['pitfall-review', '反例分析', '差异 → 判断 → 下一轮动作']]);
    renderProjectCase(parent); renderReviewTips();
  }
  function renderMethods() {
    const parent = renderDimension(1, { showPoints: false, showMetrics: false, showCaseLink: false });
    pageOutline(parent, [['team-analysis', '数据分析', '采集 → 汇总 → 诊断 → 行动'], ['team-review', '内容×业务复盘', '问题 → 假设 → 内容修改 → 验证'], ['team-execution', '团队管理', '分工 → 验收 → 复用 → 反馈']]);
    visualFigure(parent, 'team');
    renderTeamAnalysis(parent);
    const review = boardSection(parent, 'team-review', '02 / 内容×业务复盘');
    text(review, 'p', '我把数据差异翻译成脚本修改要求，而不是用播放排名替代内容判断。', 'board-objective');
    visualFigure(review, 'review');
    const reviewDetail = workDisclosure(review, 'team-review-actions', '展开复盘判断与内容动作');
    boardTable(reviewDetail, '我的复盘拆解表', ['观察信号', '判断与取舍', '落到内容的动作', '下一轮检查'], [
      ['有播放、少新增', '先查使用动机与任务承接，不直接否定题材', '把功能放进角色难题；核对组件与发布条件', '同类内容分别比较VV与每百万VV拉新'],
      ['拉活强、拉新弱', '区分唤醒与获新，不用同一排名评价', '单列回访任务，调整新增任务选题', '分别回收拉新、拉活，避免混加'],
      ['同模板表现分化', '下钻人群、开头与功能动作，区分内容差异与分发影响', '保留有效结构，优先修改一个关键变量', '记录改动与同期表现，判断能否复用']
    ], 'review-action-table');
    const caseLink = text(review, 'a', '查看真实项目中的诊断与取舍', 'case-anchor'); caseLink.href = pageHref('skills', 'case-growth'); caseLink.append(iconElement('arrow-up-right'));
    const execution = boardSection(parent, 'team-execution', '03 / 团队管理与交付');
    text(execution, 'p', '我把复盘结论落实到任务、验收标准与维护责任，跟进至下一轮验证。', 'board-objective');
    metrics(execution, initial.presentation.dimensions[1].metrics).classList.add('dimension-metrics', 'graphic-accessible');
    const managementDetail = workDisclosure(execution, 'team-management-actions', '展开管理分工与交付标准');
    boardTable(managementDetail, '管理动作与可检查交付', ['管理环节', '我的动作', '角色分工', '可检查交付'], [
      ['目标对齐', '按内容任务拆到小组与个人；双周与业务校准', '负责人定方向，组长承接排期', '排期表 / 每条内容的任务'],
      ['交付检查', '统一9步流程、六维质检和P0–P3分级', '组长检查，创作者修正', '验收清单 / 退回原因 / 修复记录'],
      ['验证与复制', '创意组验证，二创组复用；指定模板维护人', '贡献人说明适用场景，维护人更新', '模板版本 / 人物车型资产 / 反例'],
      ['复盘跟进', '日报看波动，周报看人群×卖点×方法', '组长回收，负责人决定继续或调整', '行动项 / 责任角色 / 验证时间']
    ], 'management-table');
    const workflow = workDisclosure(execution, 'production-workflow', '交付标准与协作示意');
    evidenceFigure(workflow, 'production', '9步交付与六维质检');
    evidenceFigure(workflow, 'team', '团队分工与矩阵协作');
  }
  function renderInsights() {
    const parent = renderDimension(2, { showMetrics: false, showCaseLink: false, afterIntro: parent => pageOutline(parent, [['creation-abilities', '个人成果', '矩阵运营 / 传播获客 / 持续增长'], ['creation-workflow', '创作工作流', '选题到复盘，逐点展开'], ['featured-evidence', '代表作品', '成片链接与制作拆解']]) });
    parent.querySelector('.dimension-points').id = 'creation-abilities';
    renderCreationBoard(parent);
    const works = document.createElement('section'); works.className = 'authored-work';
    text(works, 'h2', '03 / 个人代表作品');
    const evidence = document.createElement('div'); evidence.className = 'evidence-list'; evidence.id = 'featured-evidence';
    works.append(evidence); parent.append(works); renderEvidence();
  }
  function renderEvidence() {
    source.links.slice(0, 5).forEach((link, index) => {
      const item = externalLink($('#featured-evidence'), link.title, link.url);
      item.classList.add('representative-link');
      item.prepend(iconElement('play'));
      if (index === 0) {
        const detail = workDisclosure($('#featured-evidence'), 'creator-case-detail', '《小老板》 / 制作拆解与提示词附件');
        detail.classList.add('authored-case'); renderCreatorCase(detail);
      }
    });
    const accounts = document.createElement('div'); accounts.className = 'account-links';
    ['人间清醒观察室', '穿越汽车', '车没坏', '噜噜总动员'].forEach((name, index) => externalLink(accounts, name, source.links[index + 5].url));
    $('.dimension-point > div').append(accounts);
  }

  function boardSection(parent, id, title) {
    const section = document.createElement('section'); section.className = 'evidence-board'; section.id = id;
    const heading = text(section, 'h2', title, 'board-title'); heading.id = `${id}-title`;
    section.setAttribute('aria-labelledby', heading.id); parent.append(section); return section;
  }
  function boardTable(parent, caption, headings, rows, className = '') {
    const scroll = document.createElement('div'); scroll.className = 'board-table-scroll';
    scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', caption);
    strategyTable(scroll, caption, headings, rows);
    scroll.querySelector('table').classList.add('board-table');
    if (className) scroll.querySelector('table').classList.add(className);
    parent.append(scroll);
  }
  function flowMap(parent, steps) {
    const list = document.createElement('ol'); list.className = 'evidence-flow';
    steps.forEach(([title, description], index) => {
      const item = document.createElement('li'); text(item, 'span', String(index + 1).padStart(2, '0'), 'flow-number');
      text(item, 'h3', title); text(item, 'p', description);
      if (index < steps.length - 1) item.append(iconElement('arrow-up-right'));
      list.append(item);
    }); parent.append(list);
  }
  function pageOutline(parent, items) {
    const nav = document.createElement('nav'); nav.className = 'page-outline'; nav.setAttribute('aria-label', '本页结构');
    items.forEach(([id, title, note], index) => {
      const link = document.createElement('a'); link.href = pageHref(currentPage, id);
      text(link, 'span', String(index + 1).padStart(2, '0'), 'outline-number');
      const copy = document.createElement('span'); text(copy, 'strong', title); text(copy, 'small', note); link.append(copy); nav.append(link);
    }); parent.append(nav);
  }
  function renderTeamAnalysis(parent) {
    const section = boardSection(parent, 'team-analysis', '01 / 数据分析：从作品明细到管理决策');
    text(section, 'p', '我搭建作品级回收表，按账号、小组、平台和内容类型汇总；先定位差异，再下钻脚本与分发条件。', 'board-objective');
    text(section, 'p', 'Excel数据透视 / SUMIFS / RANK.EQ · 日报监测、周报诊断、双周业务复盘', 'board-note');
    const demo = document.createElement('div'); demo.id = 'analysis-demo'; demo.className = 'analysis-demo';
    text(demo, 'p', initial.presentation.managementDemo.label, 'demo-label');
    const controls = document.createElement('div'); controls.className = 'analysis-controls';
    const filterLabel = text(controls, 'label', '小组筛选'); filterLabel.htmlFor = 'demo-group';
    const select = document.createElement('select'); select.id = 'demo-group';
    ['全部小组', '小组A', '小组B'].forEach((name, index) => { const option = text(select, 'option', name); option.value = index ? name : ''; });
    controls.append(select); text(controls, 'span', initial.presentation.managementDemo.period, 'board-note'); demo.append(controls);
    const tablist = document.createElement('div'); tablist.className = 'analysis-steps'; tablist.setAttribute('role', 'tablist'); tablist.setAttribute('aria-label', '数据分析流程');
    const labels = ['采集校验', '透视汇总', '交叉诊断', '行动验证'];
    const panel = document.createElement('div'); panel.id = 'analysis-panel'; panel.setAttribute('role', 'tabpanel'); panel.tabIndex = 0;
    let stage = 1;
    const buttons = labels.map((label, index) => {
      const button = text(tablist, 'button', `${String(index + 1).padStart(2, '0')} / ${label}`); button.type = 'button';
      button.id = `analysis-tab-${index + 1}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
      button.addEventListener('click', () => { stage = index; update(); });
      button.addEventListener('keydown', event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null;
        if (next === null) return; event.preventDefault(); stage = next; update(); buttons[next].focus();
      }); return button;
    });
    const sum = rows => rows.reduce((total, row) => ({ vv: total.vv + row.vv, newUsers: total.newUsers + row.newUsers, followers: total.followers + row.followers, published: total.published + 1 }), {vv:0,newUsers:0,followers:0,published:0});
    const perMillion = total => total.vv ? (total.newUsers / total.vv * 1000000).toFixed(1) : '—';
    const wan = value => `${(value / 10000).toFixed(1)}万`;
    const aggregate = (rows, key) => [...new Set(rows.map(row => row[key]))].map(name => ({name, ...sum(rows.filter(row => row[key] === name))}));
    function bars(parent, caption, rows, valueKey, format) {
      const figure = document.createElement('figure'); figure.className = 'demo-bars'; text(figure, 'figcaption', caption);
      const max = Math.max(...rows.map(row => row[valueKey]), 1);
      rows.forEach(row => {
        const item = document.createElement('div'); item.className = 'demo-bar-row'; text(item, 'span', row.name);
        const track = document.createElement('span'); track.className = 'demo-bar-track'; track.setAttribute('aria-hidden', 'true');
        const mark = document.createElement('span'); mark.style.width = `${row[valueKey] / max * 100}%`; track.append(mark); item.append(track);
        text(item, 'strong', format(row[valueKey])); figure.append(item);
      }); parent.append(figure);
    }
    function update() {
      buttons.forEach((button, index) => { button.setAttribute('aria-selected', String(index === stage)); button.tabIndex = index === stage ? 0 : -1; });
      panel.setAttribute('aria-labelledby', buttons[stage].id); panel.replaceChildren();
      const rows = initial.presentation.managementDemo.rows.filter(row => !select.value || row.group === select.value);
      const total = sum(rows);
      metrics(panel, [{label:'演示作品',value:`${rows.length}条`}, {label:'演示VV',value:wan(total.vv)}, {label:'演示拉新',value:`${total.newUsers}人`}, {label:'每百万VV拉新',value:`${perMillion(total)}人`}]).classList.add('demo-metrics');
      const instructions = [
        '采集：以作品为最小单元，校验作品ID、日期、发布与归因窗口；空值和未回收不填成0。',
        '汇总：先按成员与小组聚合，再看发布、涨粉和新增；效率由合计拉新÷合计VV计算，不平均每条比率。',
        '诊断：区分品宣与效果任务；同时比较业务量、效率和样本，不因小样本高比率就直接放量。',
        '行动：明确内容改动、责任角色、复查时间和指标；回收后决定继续验证、复制或停止。'
      ];
      text(panel, 'p', instructions[stage], 'analysis-reading');
      if (stage === 0) {
        boardTable(panel, '作品级回收明细 · 演示', ['日期','作品','成员 / 小组','内容任务 / 方法','VV','拉新','每百万VV拉新'], rows.map(row => [row.day,row.work,`${row.member} / ${row.group}`,`${row.type} / ${row.method}`,wan(row.vv),`${row.newUsers}人`,`${perMillion(row)}人`]), 'demo-detail-table');
      } else if (stage === 1) {
        boardTable(panel, '成员维度透视 · 演示 · 生产数关联同周期生产台账', ['成员','小组','发布 / 生产','VV','涨粉','拉新','每百万VV拉新'], aggregate(rows,'member').map(row => [row.name,rows.find(item => item.member === row.name).group,`${row.published} / ${initial.presentation.managementDemo.production.find(item => item.member === row.name).produced}`,wan(row.vv),row.followers,`${row.newUsers}人`,`${perMillion(row)}人`]), 'demo-pivot-table');
        const charts = document.createElement('div'); charts.className = 'analysis-charts';
        bars(charts, '日度VV · 演示 · 零基线', aggregate(rows,'day'), 'vv', wan);
        bars(charts, '小组拉新 · 演示 · 零基线', aggregate(rows,'group'), 'newUsers', value => `${value}人`); panel.append(charts);
      } else if (stage === 2) {
        boardTable(panel, '任务分层诊断 · 演示', ['任务','作品数','VV','拉新','每百万VV拉新','评价重点'], aggregate(rows,'type').map(row => [row.name,row.published,wan(row.vv),`${row.newUsers}人`,`${perMillion(row)}人`,row.name === '效果型' ? '新增与功能使用动机' : '传播、认知与回访']), 'demo-diagnosis-table');
        const members = aggregate(rows,'member');
        bars(panel, '成员拉新效率 · 演示 · 人 / 百万VV · 零基线', members.map(row => ({name:row.name,efficiency:Number(perMillion(row))})), 'efficiency', value => `${value.toFixed(1)}人`);
        text(panel, 'p', '判断：不能把品宣内容的曝光优势视为获新优势；效果内容先验证功能动机与任务承接，再考虑复制。', 'board-return');
      } else {
        boardTable(panel, '诊断 → 行动 → 验证 · 演示', ['发现 / 假设','下一步动作','责任角色','复查指标'], [
          ['如播放与获新排序不一致', '拆开品宣与效果看板，回查功能动作', '分析 / 内容负责人', '同任务拉新量、每百万VV拉新'],
          ['如出现可复制的效果结构', '保留解题路径，替换场景与开头验证', '创意组 / 二创组', '多条作品表现、样本稳定性'],
          ['生产数与发布数存在差异', '逐条核对待审、退回、排期，不直接判为浪费', '组长 / 审核', '差异原因与待办关闭情况'],
          ['需判断是否值得继续放量', '补齐实际消耗及同期可比样本后再决策', '运营 / 业务协同', '总消耗、归因新增、质量风险']
        ], 'demo-actions-table');
      }
    }
    select.addEventListener('change', update); demo.append(tablist, panel); section.append(demo); update();
  }
  function renderGrowthBoard(parent) {
    const board = initial.presentation.evidenceBoards.growth;
    pageOutline(parent, [['growth-goal', '目标判断', '以拉新为主，不把VV当增长'], ['growth-channels', '增长策略', '人群 × 内容 × 分发承接'], ['growth-budget', '预算控制', '测试 → 验证 → 放量']]);
    const goals = boardSection(parent, 'growth-goal', '01 / 增长目标与指标取舍');
    text(goals, 'p', board.objective, 'board-objective'); text(goals, 'p', board.ownership, 'board-note');
    const list = document.createElement('dl'); list.className = 'growth-krs';
    board.keyResults.slice(0, 1).forEach(([label, value, action]) => {
      const row = document.createElement('div'); text(row, 'dt', label); text(row, 'dd', value); text(row, 'p', action); list.append(row);
    }); goals.append(list);
    const policy = board.operatingPolicy;
    const priorities = document.createElement('section'); priorities.className = 'growth-policy';
    text(priorities, 'h3', policy.title);
    text(priorities, 'p', policy.valueChain, 'policy-value-chain');
    text(priorities, 'p', policy.decision, 'board-note');
    const split = document.createElement('div'); split.className = 'policy-allocation'; split.setAttribute('aria-hidden', 'true');
    [policy.sellingPointPercent, policy.explorationPercent].forEach(value => { const segment = document.createElement('span'); segment.style.flexBasis = `${value}%`; split.append(segment); });
    priorities.append(split);
    const labels = document.createElement('div'); labels.className = 'policy-labels';
    text(labels, 'strong', policy.sellingPointLabel); text(labels, 'span', policy.explorationLabel); priorities.append(labels);
    text(priorities, 'p', `排期要求：${policy.execution}`, 'board-note'); goals.append(priorities);
    const types = document.createElement('dl'); types.className = 'policy-content-types';
    policy.contentTypes.forEach(([name, task]) => { const item = document.createElement('div'); text(item, 'dt', name); text(item, 'dd', task); types.append(item); }); priorities.append(types);
    const path = boardSection(parent, 'growth-channels', '02 / 增长策略与验证');
    visualFigure(path, 'growth');
    const strategy = workDisclosure(path, 'growth-strategy-actions', '展开人群、渠道与脚本判断');
    flowMap(strategy, board.path);
    const decisions = document.createElement('dl'); decisions.className = 'decision-strips';
    board.decisions.forEach(([label, title, action]) => {
      const row = document.createElement('div'); text(row, 'dt', label); const copy = document.createElement('dd'); text(copy, 'h3', title); text(copy, 'p', action); row.append(copy); decisions.append(row);
    }); strategy.append(decisions);
    const comparison = document.createElement('figure'); comparison.className = 'weekly-comparison';
    text(comparison, 'figcaption', '矩阵阶段表现 · 相邻两周拉新 · 人 · 零基线');
    [[71, '前一周'], [212, '后一周']].forEach(([value, label]) => {
      const row = document.createElement('div'); row.className = 'comparison-row'; text(row, 'span', label);
      const track = document.createElement('span'); track.className = 'comparison-track';
      const mark = document.createElement('span'); mark.style.width = `${value / 212 * 100}%`; track.append(mark); row.append(track); text(row, 'strong', `${value}人`); comparison.append(row);
    }); text(comparison, 'p', '环比 +198.6% · 矩阵相邻两周表现', 'board-note'); path.append(comparison);
    const budget = boardSection(parent, 'growth-budget', '03 / 预算与生产成本控制');
    text(budget, 'p', '按新增效率分配测试与放量资源，按镜头要求控制生成与返工消耗。', 'board-objective');
    visualFigure(budget, 'budget');
    const budgetDetail = workDisclosure(budget, 'growth-budget-actions', '展开预算决策与执行动作');
    boardTable(budgetDetail, '预算决策与成本约束', ['环节','我的动作','决策依据','交付'], [
      ['测试前', '前置对齐任务预算、组件与发布条件', '内容能否归因、是否具备承接条件', '任务检查表 / 预算需求'],
      ['测试后', '回收新增与内容表现，用有效样本争取资源', '拉新量、每百万VV拉新与实际消耗分开看', '放量建议 / 下一轮验证项'],
      ['生产中', '按内容等级分配模型，先定位返工原因', '画质、表演要求与生成消耗', '模型规范 / 返工检查项'],
      ['放量时', '复用已验证结构，检查质量和转化是否衰减', '不以积分额度代替实际支出', '模板与发布记录 / 复盘结论']
    ], 'budget-decision-table');
    renderProductionCost(budget);
  }
  function renderCampaignEvidence(parent) {
    const board = initial.presentation.evidenceBoards.growth;
    const result = boardSection(parent, 'growth-evidence', '卖点分析 / 从曝光贡献到新增贡献');
    const campaign = initial.campaignReview; const totals = campaign.overview;
    const chart = document.createElement('figure'); chart.className = 'share-chart';
    text(chart, 'figcaption', '各卖点组合的播放份额与拉新份额 · 占项目总量 · 0–100%');
    [[0, 1], [2, 5, 6]].forEach((indices, index) => {
      const points = indices.map(i => campaign.points[i]);
      const vv = points.reduce((sum, item) => sum + item.vv, 0), added = points.reduce((sum, item) => sum + item.acquisitions, 0);
      const group = document.createElement('div'); group.className = 'share-group';
      text(group, 'h3', index ? '估价 + 避坑 + 约试驾' : '帮选车优惠 + 语音讲车');
      [['VV份额', vv / totals.vv * 100, 'vv'], ['拉新份额', added / totals.acquisitions * 100, 'acquisition']].forEach(([label, value, type]) => {
        const row = document.createElement('div'); row.className = `share-row share-${type}`; text(row, 'span', label);
        const track = document.createElement('span'); track.className = 'share-track'; track.setAttribute('aria-hidden', 'true');
        const bar = document.createElement('span'); bar.style.width = `${value}%`; track.append(bar); row.append(track); text(row, 'strong', `${value.toFixed(1)}%`); group.append(row);
      }); text(group, 'p', `${added}人拉新 · ${vv / 10000}万VV`, 'board-note'); chart.append(group);
    }); result.append(chart);
    text(result, 'p', '我的判断与动作：两个主力卖点以32.2%的VV贡献64.3%的拉新，优先验证需求与功能匹配；下钻TOP13与3条反例，再把结论转成脚本要求。', 'board-takeaway');
    boardTable(result, '人群任务 → 功能匹配 → 投入判断', ['用户任务', '功能卖点', '项目表现', '我的判断'], board.focus, 'focus-table');
    const full = workDisclosure(result, 'selling-point-data', '9个卖点 / 作品量与增长效率对照');
    boardTable(full, '项目卖点表现', ['卖点', '条数', 'VV', '拉新', '拉活', '拉新 / 百万VV'], campaign.points.map(point => [point.name, point.videos, `${point.vv / 10000}万`, `${point.acquisitions}人`, `${point.reactivations}人`, point.acquisitionsPerMillion.toFixed(1)]), 'selling-point-table');
    text(full, 'p', '拍报价单仅1条，继续积累样本；百万VV拉新用于比较曝光效率，不是点击转化率。', 'board-note');
  }
  function renderCreatorCase(parent) {
    const work = initial.presentation.evidenceBoards.creation.representative;
    const section = boardSection(parent, work.id, work.title);
    text(section, 'p', work.subtitle, 'creator-case-subtitle');
    text(section, 'p', work.purpose, 'board-objective');
    text(section, 'p', work.personalRole, 'board-note');
    metrics(section, work.metrics).classList.add('creator-case-metrics');
    externalLink(section, '观看代表成片', source.links[0].url, 'case-anchor');
    const attachment = initial.attachments.find(item => item.id === 'xiaolaoban-prompts');
    const download = text(section, 'a', attachment.label, 'case-anchor prompt-download');
    download.href = attachment.dataUrl || attachment.path; download.download = attachment.filename;
    download.dataset.attachment = attachment.id; download.prepend(iconElement('download'));
    text(section, 'p', work.assets, 'board-note');
    const decisions = document.createElement('dl'); decisions.className = 'creator-decisions';
    work.decisions.forEach(([label, signal, action]) => {
      const row = document.createElement('div'); text(row, 'dt', label);
      const body = document.createElement('dd'); text(body, 'h3', signal); text(body, 'p', action); row.append(body); decisions.append(row);
    }); section.append(decisions);
    const samples = document.createElement('div'); samples.className = 'prompt-samples';
    text(samples, 'h3', '镜头提示词 / 判断如何落到执行');
    work.samples.forEach(sample => {
      const detail = workDisclosure(samples, sample.id, `${sample.shot} / ${sample.purpose}`); detail.classList.add('prompt-sample');
      text(detail, 'h4', sample.title); text(detail, 'p', sample.judgment, 'prompt-judgment');
      const fields = document.createElement('dl'); fields.className = 'prompt-fields';
      sample.fields.forEach(([label, excerpt]) => {
        text(fields, 'dt', label); const value = document.createElement('dd'); text(value, 'blockquote', excerpt); fields.append(value);
      }); detail.append(fields);
    }); section.append(samples);
  }
  function renderCreationBoard(parent) {
    const board = initial.presentation.evidenceBoards.creation;
    const section = boardSection(parent, 'creation-workflow', '02 / 个人工作流：从用户问题到成片，再回到数据');
    const tools = text(section, 'p', '工具概述：内部画布Auto Agent组织制作，ChatGPT生成图片，Seedance 2.5 / 2.0生成视频；Excel回收分析，Prompt与素材库支持复用。', 'board-note'); tools.id = 'creation-tools';
    const steps = document.createElement('div'); steps.className = 'creation-map';
    board.stages.forEach((stage, index) => {
      const detail = document.createElement('details'); detail.className = 'creation-stage'; detail.id = `creation-step-${index + 1}`;
      const summary = document.createElement('summary'); summary.className = 'creation-step-link'; text(summary, 'span', String(index + 1).padStart(2, '0'), 'flow-number');
      text(summary, 'strong', stage.name, 'creation-stage-name'); summary.append(iconElement('arrow-down')); detail.append(summary);
      text(detail, 'h3', stage.skill, 'stage-skill');
      const content = document.createElement('dl'); content.className = 'stage-content';
      [['工具', stage.tools], ['我的操作', stage.action], ['交付物', stage.output], ['验收判断', stage.check], ['实践', stage.example]].forEach(([label, value]) => { text(content, 'dt', label); text(content, 'dd', value); });
      detail.append(content);
      if (index === 6) boardTable(detail, '生成问题 → 修正动作 → 验收', ['真实问题', '我的处理', '验收重点'], board.failures, 'creation-failure-table');
      if (index === 8) text(detail, 'p', '有效脚本入模板库；失败镜头回填人物、车型与场景约束，进入下一轮生产。', 'board-return');
      steps.append(detail);
    }); section.append(steps);
  }

  function resolveLocation(id, anchor = '') {
    const aliases = {
      'competence-0-0': ['methods', 'production-workflow'], 'competence-0-1': ['experience', ''],
      'competence-0-2': ['experience', ''], 'competence-0-3': ['methods', ''], 'competence-0-4': ['insights', ''],
      'growth-strategy': ['experience', 'growth-goal'], 'growth-goal': ['experience', 'growth-goal'], 'growth-channels': ['experience', 'growth-channels'],
      'business-review': ['skills', 'business-review'], 'pitfall-review': ['skills', 'pitfall-review'],
      'case-stage-1': ['skills', 'case-growth'], 'case-stage-2': ['skills', 'case-growth'], 'case-stage-3': ['skills', 'case-growth'],
      'case-stage-4': ['skills', 'case-team'], 'case-stage-5': ['skills', 'case-results'], 'case-stage-6': ['skills', 'pitfall-review']
    };
    if (aliases[anchor]) return aliases[anchor];
    if (anchor === 'production-cost-control') return ['experience', anchor];
    if (anchor === 'production-workflow') return ['methods', anchor];
    if (anchor === 'team-okr' || anchor === 'okr-1') return ['methods', 'team-analysis'];
    if (anchor === 'okr-2' || anchor === 'collaboration-map') return ['methods', 'team-execution'];
    if (anchor === 'okr-3') return ['methods', 'team-review'];
    if (['matrix-budget-control', 'growth-evidence', 'selling-point-data'].includes(anchor)) return ['skills', anchor];
    if (['case-growth', 'case-team', 'case-creation', 'case-results'].includes(anchor)) return ['skills', anchor];
    if (anchor === 'featured-evidence' || anchor === 'creation-tools') return ['insights', anchor];
    if (['creator-xiaolaoban', 'prompt-opening', 'prompt-performance', 'prompt-brand'].includes(anchor)) return ['insights', anchor];
    return [id, anchor];
  }
  function pageHref(id, anchor = '') {
    const [page, target] = resolveLocation(id, anchor);
    return `${pages[page].route}${target ? `/${target}` : ''}`;
  }
  function openAnchor(anchor) {
    if (!anchor) return;
    const target = document.getElementById(anchor);
    if (!target) return;
    const panel = target.closest('[data-experience-panel]');
    if (panel) selectExperiencePanel(panel.dataset.experiencePanel);
    let parent = target;
    while (parent) {
      if (parent.tagName === 'DETAILS') parent.open = true;
      parent = parent.parentElement;
    }
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  function renderPage(id, anchor = '') {
    disposeMotion();
    currentPage = id;
    document.body.dataset.page = id;
    $('#main').innerHTML = pages[id].html;
    if (id === 'capabilities') { renderPortrait(); renderCapabilities(); }
    if (id === 'experience') renderExperience();
    if (id === 'methods') renderMethods();
    if (id === 'insights') renderInsights();
    if (id === 'skills') renderTechStack();
    if (id !== 'capabilities') {
      const print = document.createElement('button'); print.type = 'button'; print.id = 'print-journey'; print.className = 'icon-button';
      print.title = '打印当前内容'; print.setAttribute('aria-label', print.title); print.append(iconElement('printer')); $('.section-top').append(print);
    }
    renderProfile();
    disposeMotion = window.PortfolioMotion?.mount($('#main'), initial.icons) || (() => {});
    $$('[data-page-link]').forEach(link => {
      const active = link.dataset.pageLink === id;
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    openAnchor(anchor);
  }
  function followLocation() {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const [id, anchor = ''] = hash.replace(/^\//, '').split('/');
    if (hasPage(id)) {
      const [page, target] = resolveLocation(id, anchor);
      if (location.hash !== pageHref(page, target)) history.replaceState(null, '', pageHref(page, target));
      renderPage(page, target);
      return;
    }
    if (/^(competence-|business-review|pitfall-review|work$)/.test(hash)) {
      history.replaceState(null, '', pageHref('experience', hash));
      const [page, target] = resolveLocation('experience', hash); renderPage(page, target);
    } else if (hash) openAnchor(hash);
    else renderPage(defaultPage);
  }

  let toastTimer;
  function toast(message) {
    $('#toast').textContent = message; $('#toast').classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
  }
  function openEditor() {
    draftMedia = structuredClone(data.media);
    const form = $('#profile-form');
    fields.forEach(key => { form.elements[key].value = data.profile[key]; });
    const projects = $('#project-fields'); projects.replaceChildren();
    data.projects.forEach((project, index) => {
      if (project.id !== 'holiday') return;
      const label = text(projects, 'label', `项目 ${index + 1}`);
      const title = document.createElement('input'); title.name = `project-title-${index}`; title.value = project.title; title.maxLength = 100; title.required = true;
      const description = document.createElement('textarea'); description.name = `project-description-${index}`; description.value = project.description; description.rows = 3; description.maxLength = 400; description.required = true;
      label.append(title, description);
    });
    let media = $('#media-fields');
    if (!media) { media = document.createElement('fieldset'); media.id = 'media-fields'; $('#project-fields').parentElement.after(media); }
    media.replaceChildren(); text(media, 'legend', '肖像与项目图片');
    [['portrait', '个人肖像'], ['production', '生产流程 / 工作流截图'], ['growth', '增长数据截图'], ['team', '团队协作截图']].forEach(([key, title]) => {
      const label = text(media, 'label', title); const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.dataset.mediaKey = key;
      const status = text(label, 'span', data.media[key] ? '已使用自定义图片' : 'PNG / JPG / WebP · 单张不超过4MB', 'media-status');
      input.addEventListener('change', async () => {
        const file = input.files[0]; if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) { status.textContent = '请选择4MB以内的PNG、JPG或WebP图片'; input.value = ''; return; }
        input.disabled = true; reset.disabled = true;
        try {
          const value = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
          const check = new Image(); check.src = value; await check.decode();
          if (!validImage(value)) throw new Error('Invalid image');
          if (!input.isConnected || !$('#edit-dialog').open) return;
          draftMedia[key] = value; status.textContent = `已选择：${file.name}`;
        } catch { status.textContent = '图片无法读取，请换一张图片'; input.value = ''; }
        finally { input.disabled = false; reset.disabled = false; }
      }); label.append(input);
      const reset = text(media, 'button', '恢复默认', 'text-button media-reset'); reset.type = 'button';
      reset.addEventListener('click', () => { delete draftMedia[key]; input.value = ''; status.textContent = '保存后恢复默认图片'; });
    });
    $('#edit-dialog').showModal();
  }
  function collectForm() {
    data.media = structuredClone(draftMedia);
    const form = $('#profile-form');
    fields.forEach(key => { data.profile[key] = form.elements[key].value.trim(); });
    data.projects.forEach((project, index) => {
      if (!form.elements[`project-title-${index}`]) return;
      project.title = form.elements[`project-title-${index}`].value.trim();
      project.description = form.elements[`project-description-${index}`].value.trim();
    });
  }
  $('#main').addEventListener('click', event => {
    const workflow = event.target.closest('summary.creation-step-link');
    if (workflow) {
      const detail = workflow.parentElement;
      history.replaceState(null, '', pageHref('insights', detail.open ? '' : detail.id));
      return;
    }
    const experience = event.target.closest('[data-experience-tab]');
    if (experience) {
      const key = experience.getAttribute('aria-expanded') === 'true' ? '' : experience.dataset.experienceTab;
      selectExperiencePanel(key); history.pushState(null, '', pageHref('experience', key)); return;
    }
    const visual = event.target.closest('[data-enlarge]');
    if (visual) {
      const content = $('#project-detail'); content.replaceChildren();
      const selected = [...visual.querySelectorAll('img')].find(image => getComputedStyle(image).display !== 'none') || visual.querySelector('img');
      const title = text(content, 'h2', visual.dataset.visualTitle || selected.alt); title.id = 'detail-title';
      const controls = document.createElement('label'); controls.className = 'image-zoom-control'; text(controls, 'span', '缩放');
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '100'; slider.max = '300'; slider.step = '25'; slider.value = '100'; slider.setAttribute('aria-label', '图像缩放');
      controls.append(slider); const value = text(controls, 'output', '100%'); content.append(controls);
      const frame = document.createElement('div'); frame.className = 'visual-dialog-scroll'; frame.tabIndex = 0; frame.setAttribute('role', 'region'); frame.setAttribute('aria-label', '项目图片');
      const image = selected.cloneNode(); image.className = 'expanded-visual'; frame.append(image); content.append(frame);
      slider.addEventListener('input', () => { image.style.width = `${slider.value}%`; value.value = `${slider.value}%`; });
      $('#project-dialog').showModal(); return;
    }
    if (event.target.closest('[data-contact]')) { $('#contact-action').click(); return; }
    if (event.target.closest('#print-profile, #print-journey')) { printProfile(); return; }
  });
  $('#main').addEventListener('keydown', event => {
    const button = event.target.closest('[data-experience-tab]');
    if (!button || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = $$('[data-experience-tab]'), index = buttons.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault(); buttons[next].focus();
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      const [id, anchor = ''] = link.hash.slice(1).replace(/^\//, '').split('/');
      if (hasPage(id)) {
        event.preventDefault();
        if (location.hash !== link.hash) location.hash = link.hash;
        else { renderPage(id, anchor); if (!anchor) window.scrollTo({ top: 0, behavior: 'instant' }); }
        return;
      }
    }
    openAnchor(link.hash.slice(1));
  });
  $$('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }));
  $('#edit-profile').addEventListener('click', openEditor);
  $('#profile-form').addEventListener('submit', event => {
    event.preventDefault();
    if ($('#media-fields input:disabled')) { toast('图片正在读取，请稍候'); return; }
    collectForm(); refreshCurrentView();
    try { localStorage.setItem(storageKey, JSON.stringify(data)); toast('资料已保存到当前浏览器'); }
    catch { toast('预览已更新，请导出网站保存资料。'); }
    $('#edit-dialog').close();
  });
  $('#copy-email').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(data.profile.email); toast(`邮箱已复制：${data.profile.email}`); }
    catch { toast(data.profile.email); }
  });
  $('#contact-action').addEventListener('click', () => {
    const content = $('#project-detail'); content.replaceChildren();
    text(content, 'p', 'LET’S CONNECT', 'section-kicker');
    const title = text(content, 'h2', '期待与你交流。'); title.id = 'detail-title';
    text(content, 'p', data.profile.about, 'detail-intro');
    const link = text(content, 'a', data.profile.email, 'email-link'); link.href = `mailto:${data.profile.email}`; link.append(iconElement('mail'));
    $('#project-dialog').showModal();
  });
  function printProfile() {
    const details = $$('main details'); const states = details.map(element => element.open);
    const panels = $$('[data-experience-panel]'); const hidden = panels.map(panel => panel.hidden);
    details.forEach(element => { element.open = true; });
    panels.forEach(panel => { panel.hidden = false; panel.classList.add('is-visible'); });
    const restore = () => { details.forEach((element, index) => { element.open = states[index]; }); panels.forEach((panel, index) => { panel.hidden = hidden[index]; }); };
    window.addEventListener('afterprint', restore, { once: true });
    window.print();
  }
  window.addEventListener('hashchange', () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    followLocation();
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted || initial.exported) return;
    try { merge(JSON.parse(localStorage.getItem(storageKey))); } catch {}
    refreshCurrentView();
  });
  function refreshCurrentView() {
    const opened = $$('main details[open]').map(element => element.id).filter(Boolean);
    const selected = $('[data-experience-tab][aria-expanded="true"]')?.dataset.experienceTab;
    renderPage(currentPage);
    if (selected) selectExperiencePanel(selected);
    opened.forEach(id => { const element = document.getElementById(id); if (element?.tagName === 'DETAILS') element.open = true; });
  }

  async function readSource(path) {
    const response = await fetch(path); if (!response.ok) throw new Error('Export source unavailable'); return response;
  }
  async function inlineImage(path) {
    if (path.startsWith('data:')) return path;
    const blob = await (await readSource(path)).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
  }
  async function inlineAttachment(attachment) {
    const blob = new Blob([await (await readSource(attachment.path)).arrayBuffer()], { type: 'text/markdown;charset=utf-8' });
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
    return { ...attachment, dataUrl };
  }
  let sourceCache;
  function exportSources() {
    if (!sourceCache) sourceCache = Promise.all([
      readSource('style.css').then(response => response.text()),
      readSource('creator.css').then(response => response.text()),
      readSource('app.js').then(response => response.text()),
      Promise.all(initial.images.map(inlineImage)),
      Promise.all(initial.reviewCharts.map(inlineImage)),
      Promise.all(initial.design.fonts.map(inlineImage)),
      readSource('motion.js').then(response => response.text()),
      inlineImage(initial.design.heroImage),
      inlineImage(initial.design.backgroundImage),
      readSource('studio.css').then(response => response.text()),
      readSource('assets/vendor/three-0.160.1.min.js').then(async response => {
        const code = await response.text();
        const license = await (await readSource('assets/vendor/three-LICENSE')).text();
        return `/*\n${license}\n*/\n${code}`;
      }),
      readSource('portrait-scene.js').then(response => response.text()),
      Promise.all(initial.attachments.map(inlineAttachment))
    ]).then(([base, theme, js, images, reviewCharts, fonts, motion, heroImage, backgroundImage, studioCSS, three, portraitScript, attachments]) => {
      let css = base + '\n' + theme + '\n' + studioCSS;
      initial.design.fonts.forEach((path, index) => { css = css.replaceAll(path, fonts[index]); });
      return [css, js, images, reviewCharts, { ...initial.design, fonts, heroImage, backgroundImage }, motion, three, portraitScript, attachments];
    }).catch(error => { sourceCache = null; throw error; });
    return sourceCache;
  }
  if (!initial.exported) exportSources().catch(() => {});
  $('#export-site').addEventListener('click', async () => {
    if (!$('#profile-form').reportValidity()) return;
    if ($('#media-fields input:disabled')) { toast('图片正在读取，请稍候'); return; }
    const button = $('#export-site'); button.disabled = true;
    try {
      collectForm(); refreshCurrentView();
      const [css, js, images, reviewCharts, design, motion, three, portraitScript, attachments] = initial.exported
        ? [$('style[data-embedded]').textContent, $('script[data-embedded]').textContent, initial.images, initial.reviewCharts, initial.design, $('script[data-motion]').textContent, $('script[data-three]').textContent, $('script[data-portrait]').textContent, initial.attachments]
        : await exportSources();
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('dialog').forEach(dialog => dialog.removeAttribute('open'));
      clone.querySelector('#project-detail').replaceChildren();
      clone.querySelector('#toast').classList.remove('visible');
      clone.querySelector('#export-site').removeAttribute('disabled');
      clone.querySelector('.published-downloads')?.remove();
      // Keep a readable first paint even when a preview blocks JavaScript.
      const main = clone.querySelector('#main');
      main.classList.remove('motion-enabled');
      main.querySelectorAll('canvas').forEach(canvas => canvas.remove());
      main.querySelectorAll('.scene-ready').forEach(element => element.classList.remove('scene-ready'));
      main.querySelectorAll('[data-experience-panel]').forEach(panel => {
        panel.hidden = false;
        panel.setAttribute('aria-label', clone.querySelector(`#${panel.getAttribute('aria-labelledby')}`)?.textContent || '工作实践'); panel.removeAttribute('aria-labelledby');
      });
      main.querySelector('.experience-tabs')?.remove();
      const analysis = main.querySelector('#analysis-demo');
      if (analysis) {
        const panel = analysis.querySelector('[role="tabpanel"]');
        const context = `${initial.presentation.managementDemo.period} · ${$('#demo-group').value || '全部小组'} · ${analysis.querySelector('[aria-selected="true"]').textContent}`;
        const note = text(analysis, 'p', context, 'board-note'); analysis.insertBefore(note, panel);
        panel.removeAttribute('aria-labelledby'); panel.setAttribute('aria-label', context);
        analysis.querySelectorAll('.analysis-controls, .analysis-steps').forEach(element => element.remove());
      }
      main.querySelectorAll('details').forEach(detail => { detail.open = true; });
      clone.querySelectorAll('[data-attachment]').forEach(link => {
        const attachment = attachments.find(item => item.id === link.dataset.attachment);
        if (!attachment?.dataUrl) throw new Error('Unembedded export attachment');
        link.href = attachment.dataUrl;
      });
      const embeddedImages = new Map([
        ...initial.images.map((path, index) => [path, images[index]]),
        ...initial.reviewCharts.map((path, index) => [path, reviewCharts[index]]),
        [initial.design.heroImage, design.heroImage],
        [initial.design.backgroundImage, design.backgroundImage]
      ]);
      clone.querySelectorAll('img').forEach(image => {
        const src = image.getAttribute('src');
        if (embeddedImages.has(src)) image.src = embeddedImages.get(src);
        else if (src && !src.startsWith('data:')) throw new Error('Unembedded export image');
      });
      clone.querySelectorAll('link[rel="stylesheet"]').forEach(link => link.remove());
      clone.querySelector('style[data-embedded]')?.remove();
      const style = document.createElement('style'); style.dataset.embedded = 'true'; style.textContent = css; clone.querySelector('head').append(style);
      clone.querySelector('script[src="app.js"]')?.remove();
      clone.querySelector('script[src="portfolio-data.js"]')?.remove();
      clone.querySelector('script[src="motion.js"]')?.remove();
      clone.querySelector('script[src="assets/vendor/three-0.160.1.min.js"]')?.remove();
      clone.querySelector('script[src="portrait-scene.js"]')?.remove();
      clone.querySelector('script[data-three]')?.remove();
      clone.querySelector('script[data-portrait]')?.remove();
      clone.querySelector('script[data-motion]')?.remove();
      clone.querySelector('script[data-embedded]')?.remove();
      let payload = clone.querySelector('#portfolio-data');
      if (!payload) { payload = document.createElement('script'); payload.id = 'portfolio-data'; payload.type = 'application/json'; clone.querySelector('body').append(payload); }
      payload.textContent = JSON.stringify({ ...initial, profile: data.profile, projects: data.projects, media: data.media, images, reviewCharts, design, attachments, exported: true }).replace(/</g, '\\u003c');
      const library = document.createElement('script'); library.dataset.three = 'true'; library.textContent = three; clone.querySelector('body').append(library);
      const portrait = document.createElement('script'); portrait.dataset.portrait = 'true'; portrait.textContent = portraitScript; clone.querySelector('body').append(portrait);
      const animation = document.createElement('script'); animation.dataset.motion = 'true'; animation.textContent = motion; clone.querySelector('body').append(animation);
      const script = document.createElement('script'); script.dataset.embedded = 'true'; script.textContent = js; clone.querySelector('body').append(script);
      for (const container of [clone.querySelector('head'), clone.querySelector('body')]) {
        [...container.childNodes].filter(node => node.nodeType === 3 && !node.nodeValue.trim()).forEach(node => { node.nodeValue = '\n'; });
      }
      const blob = new Blob(['\uFEFF<!doctype html>\n' + clone.outerHTML], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${data.profile.name}-作品集.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('网站已导出，包含完整资料与预览图片。');
    } catch { toast('导出失败，请通过本地 HTTP 预览打开后重试。'); }
    finally { button.disabled = false; }
  });

  renderPage(currentPage);
  followLocation();
})();
