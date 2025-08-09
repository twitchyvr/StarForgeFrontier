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
    // Draw players and their ships
    Object.values(players).forEach(p => {
      p.modules.forEach(mod => {
        const worldX = p.x + mod.x;
        const worldY = p.y + mod.y;
        ctx.fillStyle = p.id === myId ? '#00bfff' : '#5f7fff';
        ctx.fillRect(worldX - 10, worldY - 10, 20, 20);
        // Simple outline for modules
        ctx.strokeStyle = '#ffffff44';
        ctx.strokeRect(worldX - 10, worldY - 10, 20, 20);
      });
    });
    ctx.restore();
    // Update HUD
    resourcesEl.textContent = `Resources: ${myResources}`;
  }

  render();
})();
