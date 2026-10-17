# 仇熙雯 AIGC 作品集

原生HTML/CSS/JavaScript，无运行时CDN或安装依赖。站点：https://lcc66645.github.io/qxw-interview/

## 当前结构

五个二级视图共用一个入口、导航和工作室背景：

- `#/capabilities`：关于我、立体人物和三个核心能力摘要。
- `#/experience`：用户增长思维。
- `#/methods`：团队管理执行，质量、成本、OKR证据默认收起。
- `#/insights`：个人AIGC创作能力、5条作品和4个账号。
- `#/skills`：真实案例，保留AI小懂项目数据、三个能力视角和3条反例。

历史路由键保留，顶部名称已更新。旧工作分点、成本、案例深链接自动定位到对应新视图。没有独立问答稿、时间线、岗位迁移或虚构雇主经历。

`presentation.dimensions`是三个维度的展示内容，每维一句核心判断、三项动作与数据证据。JD截图仅指导内容优先级；不补写B端付费、SaaS续费、Agent配置上线或产品/算法迭代业绩。基础SQL不写成高级SQL。

`data/portfolio.json`和`templates/page.html`是生成输入。执行`node scripts/build-pages.cjs`更新`index.html`与`portfolio-data.js`。`app.js`负责路由、编辑、打印、图像查看与离线导出；`studio.css`为最后的视觉层。Three.js仅对首页人物的局部发丝/眉毛做图像网格动画，非完整人体3D。支持暂停、减少动态、离屏停止、静态回退和资源清理。

原始项目证据保留在`data/campaign-review.json`及共享数据中：119条、3,690万VV、238拉新、2,443拉活；9卖点明细与总览的差异不补数。153/238=64.3%，不把VV当UV或点击，不将团队结果全算个人创作。495/135token是15秒不同清晰度的消耗；额度不等于支出、规范上线不等于已降本。详细审阅在`content-review.md`，不作为页面正文。

## 验证与交付

本机验证：`python -m http.server 4211 --bind 127.0.0.1`。浏览器脚本可设置`BASE_URL`、`PLAYWRIGHT_MODULE`与`CHROMIUM_PATH`。

1. `node scripts/test-pages.cjs`：25种视图/尺寸组合、三维内容、真实数据、12个链接、历史路由、编辑和图片上传、打印、查看器及离线交互。替代已删除的五职责/六工作入口/六步骤专项套件。用`PREVIEW_PATH=downloads/portfolio-final.html`生成默认交付文件。
2. `node scripts/test-creator-motion.cjs`、`test-hero-capabilities.cjs`、`test-studio-scene.cjs`：动态、生命周期、人物像素与响应式取景。
3. `HTML_PATH=downloads/portfolio-final.html node scripts/test-standalone.cjs`：UTF-8、无正文代码、无脚本首屏、离线导航、人物动画；生成ZIP。
4. `node scripts/build-download-manifest.cjs`；随后用同一`HTML_PATH`执行`test-delivery.cjs`，检查实际ZIP、25种组合与二次导出；`test-public-downloads.cjs`检查同源下载字节。

最终文件在`downloads/portfolio-final.html`和`downloads/portfolio-final.zip`，完整内嵌字体、图像、资料和脚本，可再次导出。聊天客户端将HTML当源码预览时使用ZIP下载。发布需正常快进推送到已授权的`main`，不得force；`scripts/check-pages-deployment.cjs`核对对应提交的Pages部署。公开下载文件与清单SHA-256应一致。
