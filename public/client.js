/*
 * Client‑side code for StarForgeFrontier.  Handles rendering, user
 * inputs, UI interactions and WebSocket communication with the game
 * server.  The client maintains a local copy of the world state and
 * draws it using the HTML5 canvas API.  Visual flourishes like
 * screen shake, simple zooming and ore highlighting provide feedback
 * to enhance the player experience.
 */

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Resize canvas to fill the browser window
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // HUD elements
  const resourcesEl = document.getElementById('resources');
  const addEngineBtn = document.getElementById('addEngine');
  const addCargoBtn = document.getElementById('addCargo');

  // WebSocket connection
  const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${wsProtocol}://${location.host}`);

  let myId = null;
  let players = {};
  let ores = [];
  let myResources = 0;

  // Camera state
  let zoom = 1;
  let targetZoom = 1;
  let shakeTime = 0;
  let shakeMagnitude = 0;

  // === Procedural generation helpers ===
  // We want to add infinite variety to the world without storing
  // everything in memory.  To achieve this we use a simple seeded
  // pseudo‑random number generator so that stars and module shapes
  // can be deterministically regenerated on the fly.  The function
  // below (mulberry32) is an inexpensive PRNG used widely in
  // procedural content generation.  Given an integer seed, it
  // returns a function that produces a new pseudo‑random number in
  // the range [0,1) each time it is called.
  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Convert a string (e.g. player id) into a numeric seed by
  // summing character codes.  We intentionally keep it simple
  // because perfect randomness isn't needed for visual variety.
  function stringToSeed(str) {
    let seed = 0;
    for (let i = 0; i < str.length; i++) {
      seed = (seed * 31 + str.charCodeAt(i)) >>> 0;
    }
    return seed;
  }

  // Starfield generation
  // The world is divided into square tiles; within each tile we
  // generate a small, fixed number of stars at deterministic
  // positions.  Stars are drawn before anything else so they appear
  // behind the gameplay elements.  Because the generation is
  // deterministic based on tile coordinates, new stars will appear
  // seamlessly as the player explores new regions.
  const STAR_TILE_SIZE = 800;
  const STARS_PER_TILE = 8;

  // Planet generation
  // In addition to the starfield we pepper the universe with the
  // occasional large planet.  Planets are deterministically placed
  // per‑tile using the same seeded random technique.  Each planet
  // has a radius and colour chosen by the PRNG.  A low probability
  // ensures that planets feel rare and special.
  const PLANET_PROBABILITY = 0.06;
  const PLANET_MIN_RADIUS = 40;
  const PLANET_MAX_RADIUS = 120;

  function getPlanetsForTile(tx, ty) {
    const seed = (tx * 83492791) ^ (ty * 192837463);
    const rand = mulberry32(seed);
    const planets = [];
    // decide how many planets to spawn (0 or 1) with some probability
    if (rand() < PLANET_PROBABILITY) {
      const count = 1 + Math.floor(rand() * 2); // 1–2 planets per tile
      for (let i = 0; i < count; i++) {
        planets.push({
          x: rand() * STAR_TILE_SIZE,
          y: rand() * STAR_TILE_SIZE,
          radius: PLANET_MIN_RADIUS + rand() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS),
          // pick a pastel colour for the planet
          color: `hsl(${Math.floor(rand() * 360)}, 60%, 50%)`
        });
      }
    }
    return planets;
  }

  function drawPlanets(camX, camY) {
    const halfW = canvas.width / zoom / 2;
    const halfH = canvas.height / zoom / 2;
    const minX = Math.floor((camX - halfW) / STAR_TILE_SIZE) - 1;
    const maxX = Math.floor((camX + halfW) / STAR_TILE_SIZE) + 1;
    const minY = Math.floor((camY - halfH) / STAR_TILE_SIZE) - 1;
    const maxY = Math.floor((camY + halfH) / STAR_TILE_SIZE) + 1;
    ctx.save();
    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        const planets = getPlanetsForTile(tx, ty);
        const originX = tx * STAR_TILE_SIZE;
        const originY = ty * STAR_TILE_SIZE;
        planets.forEach(pl => {
          const x = originX + pl.x;
          const y = originY + pl.y;
          ctx.beginPath();
          ctx.fillStyle = pl.color;
          ctx.arc(x, y, pl.radius, 0, Math.PI * 2);
          ctx.fill();
          // draw a subtle ring for visual interest
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(x, y, pl.radius * 1.3, pl.radius * 0.4, 0.4, 0, Math.PI * 2);
          ctx.stroke();
        });
      }
    }
    ctx.restore();
  }

  function getStarsForTile(tx, ty) {
    const seed = (tx * 73856093) ^ (ty * 19349663);
    const rand = mulberry32(seed);
    const stars = [];
    for (let i = 0; i < STARS_PER_TILE; i++) {
      stars.push({
        // position relative to tile origin
        x: rand() * STAR_TILE_SIZE,
        y: rand() * STAR_TILE_SIZE,
        size: 1 + rand() * 2,
        alpha: 0.5 + rand() * 0.5
      });
    }
    return stars;
  }

  function drawStars(camX, camY) {
    // Determine the world bounds visible on screen in world units
    const halfW = canvas.width / zoom / 2;
    const halfH = canvas.height / zoom / 2;
    const minX = Math.floor((camX - halfW) / STAR_TILE_SIZE) - 1;
    const maxX = Math.floor((camX + halfW) / STAR_TILE_SIZE) + 1;
    const minY = Math.floor((camY - halfH) / STAR_TILE_SIZE) - 1;
    const maxY = Math.floor((camY + halfH) / STAR_TILE_SIZE) + 1;
    ctx.save();
    // Stars shouldn't be affected by camera scaling; draw at world scale
    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        const stars = getStarsForTile(tx, ty);
        const originX = tx * STAR_TILE_SIZE;
        const originY = ty * STAR_TILE_SIZE;
        stars.forEach(star => {
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,255,255,${star.alpha.toFixed(2)})`;
          const x = originX + star.x;
          const y = originY + star.y;
          ctx.arc(x, y, star.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    ctx.restore();
  }

  // Module shape generation
  // Each module is drawn as a polygon rather than a simple square
  // to give ships more personality.  The shape is deterministically
  // generated based on the player's id and module index.  Shapes are
  // cached to avoid recomputing them every frame.
  const moduleShapeCache = {};

  function getModuleShape(playerId, modIndex) {
    const key = `${playerId}-${modIndex}`;
    if (moduleShapeCache[key]) return moduleShapeCache[key];
    const seed = stringToSeed(key);
    const rand = mulberry32(seed);
    const pointCount = 5 + Math.floor(rand() * 4); // 5–8 points
    const points = [];
    const twoPi = Math.PI * 2;
    for (let i = 0; i < pointCount; i++) {
      const baseAngle = (twoPi / pointCount) * i;
      const jitter = (rand() - 0.5) * (twoPi / pointCount) * 0.4;
      const radius = 10 + rand() * 8; // 10–18
      const a = baseAngle + jitter;
      points.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
    }
    moduleShapeCache[key] = points;
    return points;
  }

  // Receive messages from server
  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.type === 'init') {
      myId = msg.id;
      // Convert array of players to object keyed by id
      players = {};
      msg.players.forEach(p => { players[p.id] = p; });
      ores = msg.ores;
    } else if (msg.type === 'update') {
      players = {};
      msg.players.forEach(p => {
        players[p.id] = p;
        if (p.id === myId) {
          myResources = p.resources;
        }
      });
      ores = msg.ores;
    } else if (msg.type === 'resources') {
      myResources = msg.resources;
    } else if (msg.type === 'player_disconnect') {
      delete players[msg.id];
    }
  };

  // Send input state to server
  const keys = {};
  function sendInput() {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'input',
        up: keys['KeyW'] || keys['ArrowUp'],
        down: keys['KeyS'] || keys['ArrowDown'],
        left: keys['KeyA'] || keys['ArrowLeft'],
        right: keys['KeyD'] || keys['ArrowRight']
      }));
    }
  }
  window.addEventListener('keydown', (e) => {
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      keys[e.code] = true;
      sendInput();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      keys[e.code] = false;
      sendInput();
    }
  });

  // Handle build buttons
  addEngineBtn.addEventListener('click', () => {
    // Append engine to the right of the last module
    const self = players[myId];
    if (!self) return;
    const offset = (self.modules.length) * 22; // 22px spacing
    const module = { id: 'engine', x: offset, y: 0 };
    ws.send(JSON.stringify({ type: 'build', module }));
    triggerShake(10, 300);
  });
  addCargoBtn.addEventListener('click', () => {
    const self = players[myId];
    if (!self) return;
    const offset = (self.modules.length) * 22;
    const module = { id: 'cargo', x: offset, y: 0 };
    ws.send(JSON.stringify({ type: 'build', module }));
    triggerShake(8, 250);
  });

  // Screen shake helpers
  function triggerShake(magnitude, duration) {
    shakeMagnitude = magnitude;
    shakeTime = duration;
  }

  function applyShake() {
    if (shakeTime > 0) {
      shakeTime -= 16;
      const angle = Math.random() * Math.PI * 2;
      const offset = shakeMagnitude * (shakeTime / 300);
      return {
        x: Math.cos(angle) * offset,
        y: Math.sin(angle) * offset
      };
    }
    return { x: 0, y: 0 };
  }

  // Zoom controls: mouse wheel to zoom in/out
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * 0.1;
    targetZoom = Math.min(2.5, Math.max(0.5, targetZoom - delta));
  }, { passive: false });

  // Smoothly interpolate zoom towards the target
  function updateZoom() {
    zoom += (targetZoom - zoom) * 0.1;
  }

  // Main render loop
  function render() {
    requestAnimationFrame(render);
    updateZoom();
    const shakeOffset = applyShake();
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Determine camera center on player
    const self = players[myId];
    let camX = 0;
    let camY = 0;
    if (self) {
      camX = self.x;
      camY = self.y;
    }
    // Apply camera transform
    ctx.save();
    ctx.translate(canvas.width / 2 + shakeOffset.x, canvas.height / 2 + shakeOffset.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    // Draw procedural starfield behind everything
    drawStars(camX, camY);
    // Draw procedurally generated planets after stars but before ores
    drawPlanets(camX, camY);
    // Draw ores
    ores.forEach(ore => {
      ctx.beginPath();
      // Highlight ore if close to player
      let color = '#e2a516';
      if (self) {
        const dx = self.x - ore.x;
        const dy = self.y - ore.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 200 * 200) {
          color = '#ffd02f';
        }
      }
      ctx.fillStyle = color;
      ctx.arc(ore.x, ore.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    // Draw players and their ships using procedural shapes
    Object.values(players).forEach(p => {
      p.modules.forEach((mod, index) => {
        const shape = getModuleShape(p.id, index);
        const worldX = p.x + mod.x;
        const worldY = p.y + mod.y;
        ctx.beginPath();
        shape.forEach((pt, i) => {
          const x = worldX + pt.x;
          const y = worldY + pt.y;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = p.id === myId ? '#00bfff' : '#5f7fff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff44';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });
    ctx.restore();
    // Update HUD
    resourcesEl.textContent = `Resources: ${myResources}`;
  }

  render();
})();
