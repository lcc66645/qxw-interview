(() => {
  'use strict';
  function mount(section) {
    if (!section) return () => {};
    const image = section.querySelector('.portrait-image');
    const stage = section.querySelector('.portrait-stage');
    const toggle = section.querySelector('[data-toggle-portrait]');
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, paused = false, visible = true, contextLost = false, frame = 0, elapsed = 0, lastTime = 0, count = 0;
    let renderer, geometry, material, texture, scene, camera, mesh;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const uniforms = { uTime: { value: 0 }, uMotion: { value: 1 }, uTexture: { value: null } };
    function allowed() { return !disposed && !paused && !media.matches && !contextLost && visible && !document.hidden; }
    function draw(time = 0) {
      if (!renderer || disposed) return;
      const active = !paused && !media.matches;
      pointer.x += (pointer.targetX - pointer.x) * 0.065;
      pointer.y += (pointer.targetY - pointer.y) * 0.065;
      uniforms.uTime.value = elapsed;
      uniforms.uMotion.value = media.matches ? 0 : 1;
      mesh.rotation.y = active ? pointer.x * 0.065 : mesh.rotation.y;
      mesh.rotation.x = active ? -pointer.y * 0.025 : mesh.rotation.x;
      mesh.position.x = active ? pointer.x * 0.035 : mesh.position.x;
      if (media.matches) { mesh.rotation.set(0, 0, 0); mesh.position.x = 0; }
      section.style.setProperty('--scene-x', `${active ? pointer.x * -9 : 0}px`);
      section.style.setProperty('--scene-y', `${active ? pointer.y * -5 : 0}px`);
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
      lastTime = time;
      elapsed += delta;
      draw(time);
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
      mesh.scale.set(worldHeight * 0.94 * image.naturalWidth / image.naturalHeight, worldHeight * 0.94, 1);
      draw();
    }
    function move(event) {
      if (paused || media.matches || event.pointerType === 'touch') return;
      const rect = section.getBoundingClientRect();
      pointer.targetX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      pointer.targetY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    }
    function leave() { pointer.targetX = 0; pointer.targetY = 0; }
    function onToggle() { paused = !paused; sync(); }
    function lost(event) { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0; section.classList.remove('scene-ready'); stage.dataset.status = 'fallback'; }
    function restored() { if (!disposed) { contextLost = false; section.classList.add('scene-ready'); stage.dataset.status = 'webgl'; resize(); sync(); } }
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
    const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { rootMargin: '80px' });
    visibilityObserver.observe(section);
    section.addEventListener('pointermove', move); section.addEventListener('pointerleave', leave);
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
        geometry = new T.PlaneGeometry(1, 1, 100, 76);
        material = new T.ShaderMaterial({
          uniforms, transparent: true, depthWrite: false, side: T.DoubleSide,
          vertexShader: `
            varying vec2 vUv;
            uniform float uTime;
            uniform float uMotion;
            void main() {
              vUv = uv;
              vec3 p = position;
              float breath = sin(uTime * 1.05) * uMotion;
              float torso = 1.0 - smoothstep(0.44, 0.70, uv.y);
              p.y += breath * 0.0035 * (0.3 + torso);
              p.x *= 1.0 + breath * 0.0015 * torso;
              // Keep the face rigid; only the upper hair silhouette receives wind.
              float hair = smoothstep(0.62, 0.87, uv.y) * smoothstep(0.18, 0.34, uv.x) * (1.0 - smoothstep(0.65, 0.76, uv.x));
              p.x += sin(uTime * 1.3 + uv.y * 14.0 + uv.x * 5.0) * hair * 0.0055 * uMotion;
              p.y += cos(uTime * 1.1 + uv.x * 13.0) * hair * 0.002 * uMotion;
              float book = pow(1.0 - uv.y, 2.0) * (1.0 - smoothstep(0.52, 0.87, uv.x));
              p.z += book * 0.28 + breath * torso * 0.008;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }`,
          fragmentShader: `
            varying vec2 vUv;
            uniform sampler2D uTexture;
            void main() {
              vec4 color = texture2D(uTexture, vUv);
              float edges = smoothstep(0.0, 0.16, vUv.y) * smoothstep(0.0, 0.055, vUv.x) * (1.0 - smoothstep(0.96, 1.0, vUv.x)) * (1.0 - smoothstep(0.985, 1.0, vUv.y));
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
      section.removeEventListener('pointermove', move); section.removeEventListener('pointerleave', leave);
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
