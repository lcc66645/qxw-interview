# 仇熙雯 AIGC 作品集

原生HTML/CSS/JavaScript，无运行时CDN或安装依赖。站点：https://lcc66645.github.io/qxw-interview/

## 当前结构

视觉已调整为亮色工作室：保留原人物与工作室资产，用浅白透明遮罩、深色文字以及绿/蓝/珊瑚色强调替代深色底。参考新上传HTML的流程与图表层次，不恢复旧版内容、能力自评分或旧指标。亮色覆盖集中在`studio.css`末尾的screen媒体规则，打印样式不变；证据图由原有构建脚本重新生成透明底亮色图。`scripts/test-light-theme.cjs`检查五视图及子分点、浅色文字残留、移动端溢出、筛选和展开交互。

图表采用原生透明图层：可复制的HTML表格、数据条和流程节点叠在统一工作室背景上，细分隔线与轻磨砂只承担阅读层级，不再用独立PNG海报展示数据。运行`node scripts/build-pages.cjs`重建共享数据与入口；不再追加14张历史信息图，原有三张可编辑证据图片及附件保留。

二级内容页改为每页三个可切换的子分点，不再纵向连续铺开。增长：目标/策略/预算；团队：分析/复盘/管理；个人：成果/工作流/作品；案例：结果/贡献/反例。每部分前置“我的作用—关键动作—交付证据”，结果数字、透明流程与明细分层呈现。创作工作流按策划、制作、上线反馈分组；反例逐条展开。`scripts/test-section-framework.cjs`验证键盘、历史、深链接、筛选保留、打印恢复和离线降级。

能力概述将关键数字、工作路径与入口合成三个原生节点；个人三个能力点、九步创作工作流及执行细节按需展开。表格仅在自身区域横向滚动，流程在手机纵向重排。`scripts/test-visual-story.cjs`验证透明样式、无海报依赖、筛选联动、数据归属、重复结构与响应式布局；原证据图片仍支持300%放大。设计检查见`design-qa.md`。

五个二级视图共用一个入口、导航和工作室背景：

- `#/capabilities`：关于我、立体人物和三个核心能力摘要。
- `#/experience`：目标判断→增长策略→预算控制三段；只保留一个新增规划，80/20排期、相邻周成果和模型成本分级各有位置，不提前展开具体项目。
- `#/methods`：数据分析→内容×业务复盘→团队执行三段，不再重复OKR。匿名演示工作台按采集、透视、诊断、行动切换，表图共用一个小组筛选；实际团队规模与示例数据分开展示。
- `#/insights`：三项个人能力→单套点击展开工作流→5条纵向作品链接。账号链接放在矩阵能力内，工具概述放在工作流内，《小老板》详细案例/附件在第一条作品下默认收起。
- `#/skills`：AI小懂内容只在此页展开。保留项目数据、三个能力视角和3条反例；卖点份额图/9卖点效率表与活动预算/结算都放在增长视角。

历史路由键保留，顶部名称已更新。旧工作分点、成本、案例深链接自动定位到对应新视图。没有独立问答稿、时间线、岗位迁移或虚构雇主经历。

`presentation.dimensions`保留首页三个维度摘要和个人三点。增长/团队详细页直接按三个编号板块展开，不再追加一套能力文案。JD截图仅指导内容优先级；不补写B端付费、SaaS续费、Agent配置上线或产品/算法迭代业绩。基础SQL不写成高级SQL。

`data/management-demo.json`为用户要求的匿名合成演示，构建时并入共享数据与离线HTML。没有转录真实截图的姓名、账号、UID或作品ID。12条记录驱动明细、成员透视、日度VV/小组拉新、任务诊断及行动表；效率按总拉新/总VV计算。演示不是个人成绩，不与119条活动数据合并。`test-management-analysis.cjs`验证数字一致、表图联动、匿名字段、条宽、键盘和响应式布局。

`presentation.evidenceBoards`定义新增可视化结构。份额图、9卖点表直接从`campaignReview`计算，不另存一套指标；两组份额使用同一0–100%长度标尺。300人/人/月只作为规划，分析样本数量和模板数量分为过程与交付，不冒充增长KR。九个工作流节点自身为native details，默认全部收起，点击原位展开而非在下方重复列标题；点击更新当前阶段URL，刷新可恢复，打印/无脚本首屏展示完整内容。没有收到真实后台/分镜截图，不生成假截图。补充材料要求见`materials-needed.md`。

活动数据、TOP13、三条反例/三套模板等具体案例细节不再分散到前四页；前四页只保留日常职责、规划、管理及独立阶段表现。`growth-evidence`、`selling-point-data`、`matrix-budget-control`旧链接会跨页定位到真实案例并展开祖先。原图表/数据未删除。

个人成果按最新确认展示：4个账号、单条VV破1000万、单条抖音自然流拉新50+、月均涨粉3万+。没有据此推断为同一作品的成绩，不绑定《小老板》，也不补写月均统计窗口或四账号合计。

新增《小老板》个人作品拆解：实际使用内部Auto Agent、ChatGPT图片模型、Seedance2.5/2.0；1天耗时、每30秒单元平均返工1–2次分别展示。提示词方案包括12场景/5角色/7段/23镜，精选三段对应前5秒、表演与品牌判断，原始Markdown原字节保存在`downloads/xiaolaoban-prompts.md`。附件在独立HTML和二次导出中以内嵌data URL下载，静态首屏也不留失效相对链接。源文档的生成指令只作内容，不执行。增长新增拉新优先、至少80%卖点内容/约20%探索排期与品宣型/效果型分工；不把排期当实际占比、不把Q2测算当成绩。

`data/portfolio.json`和`templates/page.html`是生成输入。执行`node scripts/build-pages.cjs`更新`index.html`与`portfolio-data.js`。`app.js`负责路由、编辑、打印、图像查看与离线导出；`studio.css`为最后的视觉层。Three.js仅对首页人物的局部发丝/眉毛做图像网格动画，非完整人体3D。支持暂停、减少动态、离屏停止、静态回退和资源清理。

原始项目证据保留在`data/campaign-review.json`及共享数据中：119条、3,690万VV、238拉新、2,443拉活；9卖点明细与总览的差异不补数。153/238=64.3%，不把VV当UV或点击，不将团队结果全算个人创作。495/135token是15秒不同清晰度的消耗；额度不等于支出、规范上线不等于已降本。详细审阅在`content-review.md`，不作为页面正文。

## 验证与交付

本机验证：`python -m http.server 4212 --bind 127.0.0.1`。浏览器脚本可设置`BASE_URL`、`PLAYWRIGHT_MODULE`与`CHROMIUM_PATH`。

1. `node scripts/test-pages.cjs`：25种视图/尺寸组合、目标/预算分工、份额图及条宽、9卖点表、匿名分析及管理表、九步内容和刷新跳转、12个链接、编辑上传、打印、查看器及离线交互。用`PREVIEW_PATH=downloads/portfolio-final.html`生成默认交付文件；另运行`test-management-analysis.cjs`验证联动分析的精确计算。
2. `node scripts/test-creator-motion.cjs`、`test-hero-capabilities.cjs`、`test-studio-scene.cjs`：动态、生命周期、人物像素与响应式取景。
3. `HTML_PATH=downloads/portfolio-final.html node scripts/test-standalone.cjs`：UTF-8、无正文代码、无脚本首屏、离线导航、人物动画；生成ZIP。
4. `node scripts/build-download-manifest.cjs`；随后用同一`HTML_PATH`执行`test-delivery.cjs`，检查实际ZIP、25种组合与二次导出；`test-public-downloads.cjs`检查同源下载字节。
5. `node scripts/test-creator-attachment.cjs`：原创作品深链、提示词原文、附件在JS开/关的离线HTML中完整下载、320px布局。在线附件和离线二次导出都校验字节，不只检查链接存在。

最终文件在`downloads/portfolio-final.html`和`downloads/portfolio-final.zip`，完整内嵌字体、图像、资料和脚本，可再次导出。聊天客户端将HTML当源码预览时使用ZIP下载。发布需正常快进推送到已授权的`main`，不得force；`scripts/check-pages-deployment.cjs`核对对应提交的Pages部署。公开下载文件与清单SHA-256应一致。
