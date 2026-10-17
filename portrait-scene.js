(() => {
  'use strict';
  function mount(section) {
    if (!section) return () => {};
    const image = section.querySelector('.portrait-image');
    const stage = section.querySelector('.portrait-stage');
    const toggle = section.querySelector('[data-toggle-portrait]');
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, paused = false, visible = true, contextLost = false;
    let frame = 0, elapsed = 0, lastTime = 0, count = 0;
    let renderer, geometry, material, texture, scene, camera, mesh;
    const uniforms = {
      uTime: { value: 0 }, uMotion: { value: 1 }, uTexture: { value: null },
      uAvatar: { value: section.dataset.avatar === 'studio' ? 1 : 0 }
    };
    function allowed() { return !disposed && !paused && !media.matches && !contextLost && visible && !document.hidden; }
    function draw() {
      if (!renderer || disposed) return;
      uniforms.uTime.value = elapsed;
      uniforms.uMotion.value = media.matches ? 0 : 1;
      renderer.render(scene, camera);
      stage.dataset.frames = String(++count);
      stage.dataset.time = elapsed.toFixed(3);
    }
    function tick(time) {
      frame = 0;
      if (media.matches && section.dataset.motion !== 'reduced') { sync(); return; }
      if (!allowed()) return;
      if (lastTime && time - lastTime < 1000 / (stage.clientWidth <= 640 ? 30 : 45)) { frame = requestAnimationFrame(tick); return; }
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.08) : 0;
      lastTime = time; elapsed += delta; draw();
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      if (disposed) return;
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      section.dataset.motion = media.matches ? 'reduced' : paused ? 'paused' : 'playing';
      toggle.disabled = media.matches;
      toggle.setAttribute('aria-pressed', String(paused || media.matches));
      const label = media.matches ? '已减少动态效果' : paused ? '播放人物动态' : '暂停人物动态';
      toggle.setAttribute('aria-label', label); toggle.title = label;
      toggle.innerHTML = window.portfolioIcons?.[paused ? 'play' : 'pause'] || toggle.innerHTML;
      draw();
      if (allowed() && renderer) frame = requestAnimationFrame(tick);
    }
    function resize() {
      if (!renderer || disposed) return;
      const width = stage.clientWidth, height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      const worldHeight = 2 * Math.tan(camera.fov * Math.PI / 360) * camera.position.z;
      const artHeight = image.clientHeight, artTop = image.offsetTop;
      const scale = artHeight / height;
      mesh.scale.set(worldHeight * scale * image.naturalWidth / image.naturalHeight, worldHeight * scale, 1);
      mesh.position.y = worldHeight * (.5 - artTop / height - scale / 2);
      stage.dataset.subjectHeight = String(artHeight);
      stage.dataset.scale = getComputedStyle(section).getPropertyValue('--portrait-scale').trim();
      draw();
    }
    function onToggle() { paused = !paused; sync(); }
    function lost(event) { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0; section.classList.remove('scene-ready'); stage.dataset.status = 'fallback'; }
    function restored() { if (!disposed) { contextLost = false; section.classList.add('scene-ready'); stage.dataset.status = 'webgl'; resize(); sync(); } }
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
    const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { rootMargin: '80px' });
    visibilityObserver.observe(section.querySelector('.portrait-art'));
    toggle.addEventListener('click', onToggle);
    document.addEventListener('visibilitychange', sync); media.addEventListener('change', sync);
    // Embedded browsers can update media.matches without dispatching a change event.
    const preferenceCheck = setInterval(() => {
      const expected = media.matches ? 'reduced' : paused ? 'paused' : 'playing';
      if (!document.hidden && section.dataset.motion !== expected) sync();
    }, 800);
    image.decode().then(async () => {
      if (disposed || !window.THREE) return;
      // A detached image keeps CSS dimensions out of WebGL texture allocation.
      const textureImage = new Image(); textureImage.src = image.currentSrc || image.src;
      await textureImage.decode();
      if (disposed) return;
      const T = window.THREE;
      try {
        renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.domElement.setAttribute('aria-hidden', 'true');
        renderer.domElement.addEventListener('webglcontextlost', lost); renderer.domElement.addEventListener('webglcontextrestored', restored);
        stage.append(renderer.domElement);
        texture = new T.Texture(textureImage); texture.colorSpace = T.SRGBColorSpace; texture.needsUpdate = true;
        uniforms.uTexture.value = texture;
        geometry = new T.PlaneGeometry(1, 1, 160, 120);
        material = new T.ShaderMaterial({
          uniforms, transparent: true, depthWrite: false, side: T.DoubleSide,
          vertexShader: `
            varying vec2 vUv;
            uniform float uTime;
            uniform float uMotion;
            uniform float uAvatar;
            uniform sampler2D uTexture;
            void main() {
              vUv = uv;
              vec3 p = position;
              // Wind only reaches the top silhouette and outer locks, not the face or torso.
              float crown = smoothstep(0.72, 0.86, uv.y);
              float sides = (1.0 - smoothstep(0.36, 0.42, uv.x) + smoothstep(0.62, 0.67, uv.x)) * smoothstep(0.52, 0.61, uv.y);
              float bounds = smoothstep(0.27, 0.34, uv.x) * (1.0 - smoothstep(0.68, 0.73, uv.x));
              vec3 tone = texture2D(uTexture, uv).rgb;
              float hairTone = 1.0 - smoothstep(0.25, 0.55, max(tone.r, max(tone.g, tone.b)));
              float hair = max(crown, sides) * bounds * hairTone * uMotion * uAvatar;
              p.x += sin(uTime * 0.85 + uv.y * 12.0 + uv.x * 5.0) * hair * 0.0024;
              p.y += cos(uTime * 0.68 + uv.x * 13.0) * hair * 0.0007;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }`,
          fragmentShader: `
            varying vec2 vUv;
            uniform sampler2D uTexture;
            uniform float uTime;
            uniform float uMotion;
            uniform float uAvatar;
            float brow(vec2 point, vec2 center, float slope) {
              vec2 delta = point - center;
              delta.y -= delta.x * slope;
              return 1.0 - smoothstep(0.35, 1.0, length(delta / vec2(0.029, 0.017)));
            }
            void main() {
              vec2 sampleUV = vUv;
              float lift = pow(max(0.0, sin(uTime * 0.62)), 12.0) * 0.0025 * uMotion * uAvatar;
              float eyebrows = brow(vUv, vec2(0.444, 0.646), 0.24) * 0.45 + brow(vUv, vec2(0.550, 0.697), 0.34);
              sampleUV.y -= lift * eyebrows;
              vec4 color = texture2D(uTexture, sampleUV);
              float edges = smoothstep(0.0, 0.035, vUv.y) * smoothstep(0.0, 0.025, vUv.x) * (1.0 - smoothstep(0.98, 1.0, vUv.x)) * (1.0 - smoothstep(0.985, 1.0, vUv.y));
              gl_FragColor = vec4(color.rgb, color.a * edges);
              if (gl_FragColor.a < 0.002) discard;
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`
        });
        mesh = new T.Mesh(geometry, material);
        scene = new T.Scene(); scene.add(mesh);
        camera = new T.PerspectiveCamera(32, 1, 0.1, 30); camera.position.z = 5;
        resize(); section.classList.add('scene-ready'); stage.dataset.status = 'webgl'; sync();
      } catch {
        stage.dataset.status = 'fallback';
        renderer?.dispose(); renderer?.domElement.remove(); renderer = null;
        geometry?.dispose(); material?.dispose(); texture?.dispose();
      }
    }).catch(() => { if (!disposed) stage.dataset.status = 'fallback'; });
    sync();
    return () => {
      disposed = true; cancelAnimationFrame(frame); clearInterval(preferenceCheck);
      visibilityObserver.disconnect(); resizeObserver.disconnect();
      toggle.removeEventListener('click', onToggle);
      document.removeEventListener('visibilitychange', sync); media.removeEventListener('change', sync);
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
        renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      }
      geometry?.dispose(); material?.dispose(); texture?.dispose();
    };
  }
  window.PortfolioPortrait = { mount };
})();
