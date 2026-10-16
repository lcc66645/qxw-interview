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
      if (saved.profile[key] === initial.retiredCopy?.profile?.[key]) continue;
      data.profile[key] = saved.profile[key];
    }
    if (Array.isArray(saved.projects)) {
      for (const project of data.projects) {
        const previous = saved.projects.find(item => item?.id === project.id);
        for (const key of ['title', 'description']) {
          if (typeof previous?.[key] !== 'string') continue;
          if (previous[key] === initial.retiredCopy?.projects?.[project.id]?.[key]) continue;
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
      portrait.src = data.media.portrait || initial.design.heroImage;
      portrait.alt = data.media.portrait ? `${data.profile.name}的个人肖像` : '工作室中戴眼镜的AIGC创作者，伸手递出作品画册';
      $('.portrait-kind').textContent = data.media.portrait ? 'PORTRAIT' : 'AIGC AVATAR';
      $('.portrait-copy').classList.toggle('is-long-name', data.profile.name.length > 10);
    }
  }
  function renderPortrait() {
    const section = document.createElement('section'); section.className = 'portrait-intro'; section.setAttribute('aria-label', '个人形象');
    const room = document.createElement('img'); room.className = 'portrait-room'; room.src = initial.design.backgroundImage; room.alt = ''; room.setAttribute('aria-hidden', 'true'); section.append(room);
    const image = document.createElement('img'); image.className = 'portrait-image'; image.width = 1672; image.height = 941; image.fetchPriority = 'high';
    section.append(image);
    const stage = document.createElement('div'); stage.className = 'portrait-stage'; stage.dataset.status = 'loading'; stage.setAttribute('aria-hidden', 'true'); section.append(stage);
    const copy = document.createElement('div'); copy.className = 'portrait-copy';
    text(copy, 'p', 'CONTENT / GROWTH / AIGC', 'section-kicker');
    const title = text(copy, 'h1', data.profile.name); title.dataset.bind = 'name';
    section.append(copy);
    text(section, 'span', '', 'portrait-kind');
    const next = text(section, 'a', '关于我', 'portrait-next'); next.href = '#home'; next.append(iconElement('arrow-down'));
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'icon-button portrait-pause'; toggle.dataset.togglePortrait = '';
    toggle.setAttribute('aria-label', '暂停人物动态'); toggle.title = '暂停人物动态'; toggle.setAttribute('aria-pressed', 'false'); toggle.append(iconElement('pause')); section.append(toggle);
    $('#main').prepend(section);
    const about = $('#about-title'); const heading = document.createElement('h2');
    heading.id = about.id; heading.className = about.className; heading.textContent = about.textContent; about.replaceWith(heading);
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
    source.capabilities.forEach((capability, index) => {
      const article = document.createElement('article');
      article.className = 'capability-item';
      text(article, 'span', String(index + 1).padStart(2, '0'), 'capability-number');
      const content = document.createElement('div');
      text(content, 'h3', capability.title);
      text(content, 'p', capability.description);
      article.append(content);
      $('#capability-grid').append(article);
    });
  }
  function renderCompetence(parent, competence, support) {
    text(parent, 'p', support?.action || competence.summary.action, 'practice-action');
    text(parent, 'p', competence.summary.outcome, 'result-tag');
    if (!support) return;
    const detail = document.createElement('div'); detail.className = 'practice-support';
    text(detail, 'p', support.goal, 'practice-goal');
    const list = document.createElement('ul'); support.steps.forEach(step => text(list, 'li', step)); detail.append(list); parent.append(detail);
    if (support.deliverable) text(parent, 'p', `我交付：${support.deliverable}`, 'practice-deliverable');
    if (support.visual) evidenceFigure(parent, support.visual, support.caption);
    if (support.visual === 'growth') {
      const comparison = document.createElement('div'); comparison.className = 'weekly-comparison';
      text(comparison, 'h5', '周拉新变化');
      [[71, '调整前'], [212, '调整后']].forEach(([value, label]) => {
        const row = document.createElement('div'); row.className = 'comparison-row';
        text(row, 'span', label); const track = document.createElement('span'); track.className = 'comparison-track';
        const bar = document.createElement('span'); bar.style.width = `${value / 212 * 100}%`; track.append(bar); row.append(track); text(row, 'strong', `${value}人`); comparison.append(row);
      });
      text(comparison, 'p', '环比 +198.6%', 'comparison-result'); parent.append(comparison);
    }
  }
  function renderOKR(parent, job) {
    const section = document.createElement('section'); section.className = 'job-okr'; section.setAttribute('aria-label', '懂车帝工作OKR');
    text(section, 'h4', 'OKR / 我的目标与关键结果');
    job.okr.forEach((item, index) => {
      const row = document.createElement('div'); row.className = 'okr-row';
      const objective = document.createElement('div');
      text(objective, 'span', `O${index + 1}`, 'okr-number');
      text(objective, 'h5', initial.presentation.okrTitles[index]);
      const results = document.createElement('ul'); results.className = 'okr-results';
      item.results.forEach(result => {
        const split = result.indexOf('：'); const entry = document.createElement('li');
        text(entry, 'span', result.slice(0, split), 'kr-label'); text(entry, 'span', result.slice(split + 1)); results.append(entry);
      }); row.append(objective, results); section.append(row);
    }); parent.append(section);
  }
  function renderExperience() {
    const list = $('#experience-list');
    source.jobs.forEach((job, jobIndex) => {
      const article = document.createElement('article'); article.className = 'job'; article.id = `employer-${jobIndex}`;
      const header = document.createElement('div'); header.className = 'job-heading';
      const name = document.createElement('div');
      text(name, 'h3', jobIndex === 0 ? '2.1 / 懂车帝' : '2.2 / 简单有为 · 内容运营');
      text(name, 'p', job.role); text(name, 'p', job.company, 'job-company');
      header.append(name); text(header, 'span', job.period, 'job-period'); article.append(header);
      text(article, 'p', job.summary, 'job-intro');
      if (jobIndex === 0) renderOKR(article, job);
      const order = jobIndex === 0 ? initial.presentation.practiceOrder : job.competences.map((_, index) => index);
      order.forEach((index, sequence) => {
        const competence = job.competences[index];
        const support = jobIndex === 0 ? initial.presentation.practices[index] : initial.presentation.earlierPractices[index];
        const point = document.createElement('section'); point.className = 'practice-point';
        point.id = `competence-${jobIndex}-${index}`;
        const heading = document.createElement('div'); heading.className = 'practice-heading';
        text(heading, 'span', String(sequence + 1).padStart(2, '0'), 'competence-number');
        text(heading, 'h4', support.title || competence.title); point.append(heading);
        renderCompetence(point, competence, support); article.append(point);
      });
      if (jobIndex === 0) {
        const works = document.createElement('section'); works.className = 'authored-work';
        text(works, 'h4', '个人代表作品');
        const evidence = document.createElement('div'); evidence.className = 'evidence-list'; evidence.id = 'featured-evidence';
        works.append(evidence); article.append(works);
      }
      list.append(article);
    });
    const heading = text(list, 'h3', '项目案例', 'portfolio-case-title');
    heading.id = 'case-study-title';
    const details = document.createElement('details'); details.className = 'review-tip portfolio-case'; details.id = 'business-review'; details.open = true;
    const summary = document.createElement('summary');
    text(summary, 'span', 'CASE 01', 'tip-label');
    const title = document.createElement('span'); title.className = 'tip-heading';
    text(title, 'strong', 'AI 小懂星图复盘'); text(title, 'span', '从内容策略到用户增长');
    summary.append(title); details.append(summary);
    const body = document.createElement('div'); body.id = 'business-review-body'; body.className = 'review-body';
    details.append(body); list.append(details);
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
  function renderBusinessReview(parent) {
    text(parent, 'p', `${initial.campaignReview.overview.period} · 中秋国庆项目`, 'case-context');
    text(parent, 'p', '我的工作：拆9个业务卖点、回收119条视频的增长表现、逐句分析高拉新脚本；将结果转成下一轮选题、脚本和达人投放建议。', 'case-responsibility');
    const stages = [
      ['目标与人群', '我先将选车、查优惠、算贷款归为新用户决策任务，将找二手车归为老用户回访任务。拉新与拉活分开判断，避免用一个播放排名决定所有内容资源。'],
      ['卖点与脚本', '我对TOP13拉新脚本与3条高播放低转化反例逐句标记：冲突是否仍待解决、工具是否真正完成任务、话术是否具体。贷款算账与借车讲车两类场景，分别让查优惠和语音讲车成为剧情必需的解法。'],
      ['生产与协作', '我将有效脚本整理为“冲突—工具解题—角色决定”的可复用结构，并补齐人物、车型资产和Prompt。用9步流程衔接创意验证与二创交付，审核同时检查成片质量和功能植入。'],
      ['数据回收与投放判断', '我按作品归集VV、拉新、拉活，再按卖点对比。帮选车+查优惠与AI语音讲车列为拉新主力；智能找二手车单独承担拉活任务。高播放低拉新内容则回查受众需求和工具出场，输出脚本修改与达人选题建议。']
    ];
    stages.forEach(([title, description], index) => {
      const section = document.createElement('section'); section.className = 'case-stage'; section.dataset.stage = String(index + 1);
      text(section, 'h4', `0${index + 1} / ${title}`); text(section, 'p', description);
      if (index === 1) {
        const examples = document.createElement('div'); examples.className = 'script-examples';
        [['贷款维权', '4S店贷款算账冲突 → 工具介入解题', '252万VV · 67人拉新'], ['借车讲车', '借野马见岳父，不会开手动挡 → AI语音讲车', '266万VV · 35人拉新']].forEach(([title, script, result]) => {
          const item = document.createElement('article'); text(item, 'h5', title); text(item, 'p', script); text(item, 'strong', result); examples.append(item);
        }); section.append(examples);
      }
      if (index === 2) {
        evidenceFigure(section, 'production', '9步生产链路 · 选题、脚本、分镜、资产、生成、剪辑、审核、发布、复盘', 'case-workflow');
      }
      parent.append(section);
    });
    const results = document.createElement('section'); results.className = 'case-stage'; results.dataset.stage = '5';
    text(results, 'h4', '05 / 项目成果');
    metrics(results, [
      { label: '内容产出', value: '119条' }, { label: '播放', value: '3,690万' },
      { label: '拉新', value: '238人' }, { label: '拉活', value: '2,443人' }
    ]);
    text(results, 'p', '识别两大拉新主力卖点，贡献153人拉新（64.3%）；智能找二手车带来803人拉活。', 'review-highlight');
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
    }); table.append(body); wrap.append(table); results.append(wrap);
    evidenceFigure(results, 'growth', '播放表现与拉新贡献 · 中秋国庆星图项目', 'review-chart');
    text(results, 'p', '两个主力卖点用32.2%的VV带来64.3%的拉新；三个流量型卖点占46.5%的VV，仅贡献19.3%的拉新。我的复盘重点因此从“什么内容火”转向“什么需求会让用户使用工具”。', 'review-highlight');
    parent.append(results);
    const lessons = document.createElement('section'); lessons.className = 'case-stage'; lessons.id = 'pitfall-review'; lessons.dataset.stage = '6';
    text(lessons, 'h4', '06 / 踩坑与下一轮动作');
    text(lessons, 'p', '我把复盘结论写成下一轮可执行的筛选项，而不是再列一遍播放排行榜。');
    reviewActions(lessons, [
      ['播放误判', '精准估价830万VV、32人拉新，低于帮选车+查优惠的89人。下一轮拉新内容先审决策任务是否明确，不以VV高低直接决定复制量。'],
      ['植入过晚', '剧情问题已经解决后再报功能，用户缺少使用理由。脚本审核改查工具是否参与解题、角色是否因结果作出决定，而不是只查有没有出现“小懂”。'],
      ['指标混用', '智能找二手车拉新9人、拉活803人；不能因拉新低就淘汰。将其保留在拉活方向，单独评估任务与受众，避免和新用户选车内容混排。']
    ]);
    parent.append(lessons);
    const links = document.createElement('div'); links.className = 'case-links';
    ['贷款维权', '借车讲车', '借车接客'].forEach((title, index) => externalLink(links, title, source.links[index + 9].url));
    parent.append(links);
  }
  function renderTechStack() {
    initial.extensions.techGroups.forEach(group => {
      const article = document.createElement('article'); article.className = 'tech-group';
      const heading = document.createElement('div'); text(heading, 'h3', group.title); text(heading, 'p', group.description);
      const tools = document.createElement('div'); tools.className = 'tech-tools';
      group.indexes.forEach(index => text(tools, 'span', source.skills[index]));
      article.append(heading, tools); $('#skills-list').append(article);
    });
  }
  function renderMethods() {
    source.methods.forEach((method, index) => {
      const article = document.createElement('article'); article.className = 'method-item';
      text(article, 'span', String(index + 1).padStart(2, '0'), 'method-number');
      text(article, 'h3', method.title); text(article, 'p', method.description);
      text(article, 'p', initial.presentation.methodResults[index], 'method-proof');
      const application = initial.extensions.methodApplications[index];
      const link = text(article, 'a', '相关实践', 'method-application'); link.href = pageHref('experience', application.href.slice(1));
      link.append(iconElement('arrow-up-right')); $('#method-grid').append(article);
    });
  }
  function renderInsights() {
    source.insights.forEach((insight, index) => {
      const article = document.createElement('article'); article.className = 'insight-item';
      text(article, 'span', String(index + 1).padStart(2, '0'));
      const body = document.createElement('div');
      text(body, 'h3', insight.title.replace(/^\d+\.\s*/, '')); text(body, 'p', insight.description);
      article.append(body); $('#insight-list').append(article);
    });
  }
  function renderEvidence() {
    source.links.slice(0, 5).forEach(link => {
      const item = externalLink($('#featured-evidence'), link.title, link.url);
      item.prepend(iconElement('play'));
    });
    const accounts = document.createElement('div'); accounts.className = 'account-links';
    ['人间清醒观察室', '穿越汽车', '车没坏', '噜噜总动员'].forEach((name, index) => externalLink(accounts, name, source.links[index + 5].url));
    $('#featured-evidence').after(accounts);
  }

  function pageHref(id, anchor = '') {
    return `${pages[id].route}${anchor ? `/${anchor}` : ''}`;
  }
  function openAnchor(anchor) {
    if (!anchor) return;
    const target = document.getElementById(anchor);
    if (!target) return;
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
    if (id === 'experience') { renderExperience(); renderReviewTips(); renderEvidence(); }
    if (id === 'methods') renderMethods();
    if (id === 'insights') renderInsights();
    if (id === 'skills') renderTechStack();
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
      if (location.hash !== pageHref(id, anchor)) history.replaceState(null, '', pageHref(id, anchor));
      renderPage(id, anchor);
      return;
    }
    if (/^(competence-|business-review|pitfall-review|work$)/.test(hash)) {
      history.replaceState(null, '', pageHref('experience', hash));
      renderPage('experience', hash);
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
    const visual = event.target.closest('[data-enlarge]');
    if (visual) {
      const content = $('#project-detail'); content.replaceChildren();
      const title = text(content, 'h2', visual.querySelector('img').alt); title.id = 'detail-title';
      const controls = document.createElement('label'); controls.className = 'image-zoom-control'; text(controls, 'span', '缩放');
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '100'; slider.max = '300'; slider.step = '25'; slider.value = '100'; slider.setAttribute('aria-label', '图像缩放');
      controls.append(slider); const value = text(controls, 'output', '100%'); content.append(controls);
      const frame = document.createElement('div'); frame.className = 'visual-dialog-scroll'; frame.tabIndex = 0; frame.setAttribute('role', 'region'); frame.setAttribute('aria-label', '项目图片');
      const image = visual.querySelector('img').cloneNode(); image.className = 'expanded-visual'; frame.append(image); content.append(frame);
      slider.addEventListener('input', () => { image.style.width = `${slider.value}%`; value.value = `${slider.value}%`; });
      $('#project-dialog').showModal(); return;
    }
    if (event.target.closest('[data-contact]')) { $('#contact-action').click(); return; }
    if (event.target.closest('#print-profile, #print-journey')) { printProfile(); return; }
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
    details.forEach(element => { element.open = true; });
    const restore = () => details.forEach((element, index) => { element.open = states[index]; });
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
    renderPage(currentPage);
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
      readSource('portrait-scene.js').then(response => response.text())
    ]).then(([base, theme, js, images, reviewCharts, fonts, motion, heroImage, backgroundImage, studioCSS, three, portraitScript]) => {
      let css = base + '\n' + theme + '\n' + studioCSS;
      initial.design.fonts.forEach((path, index) => { css = css.replaceAll(path, fonts[index]); });
      return [css, js, images, reviewCharts, { ...initial.design, fonts, heroImage, backgroundImage }, motion, three, portraitScript];
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
      const [css, js, images, reviewCharts, design, motion, three, portraitScript] = initial.exported
        ? [$('style[data-embedded]').textContent, $('script[data-embedded]').textContent, initial.images, initial.reviewCharts, initial.design, $('script[data-motion]').textContent, $('script[data-three]').textContent, $('script[data-portrait]').textContent]
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
      payload.textContent = JSON.stringify({ ...initial, profile: data.profile, projects: data.projects, media: data.media, images, reviewCharts, design, exported: true }).replace(/</g, '\\u003c');
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
