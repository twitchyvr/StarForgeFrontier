/*
 * Enhanced Client for StarForgeFrontier
 * Includes improved UI, minimap, notifications, and better visual feedback
 */

(() => {
  // Canvas elements
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const minimapCanvas = document.getElementById('minimap');
  const minimapCtx = minimapCanvas.getContext('2d');

  // UI Elements
  const resourcesEl = document.getElementById('resources');
  const levelEl = document.getElementById('level');
  const positionEl = document.getElementById('position');
  const playerCountEl = document.getElementById('playerCount');
  const notificationsEl = document.getElementById('notifications');
  const shopPanel = document.getElementById('shopPanel');
  const shopContent = document.getElementById('shopContent');
  const shopToggleBtn = document.getElementById('shopToggle');
  const closeShopBtn = document.getElementById('closeShop');
  const addEngineBtn = document.getElementById('addEngine');
  const addCargoBtn = document.getElementById('addCargo');

  // Game state
  let myId = null;
  let players = {};
  let ores = [];
  let myResources = 0;
  let myLevel = 1;
  let shopItems = {};
  let activeEvents = [];
  
  // Camera and visual effects
  let zoom = 1;
  let targetZoom = 1;
  let shakeTime = 0;
  let shakeMagnitude = 0;
  let particleEffects = [];
  
  // WebSocket connection
  const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${wsProtocol}://${location.host}`);

  // Initialize canvases
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Notification system
  function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationsEl.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // Shop UI management
  function renderShop() {
    shopContent.innerHTML = '';
    
    Object.entries(shopItems).forEach(([key, item]) => {
      const shopItem = document.createElement('div');
      shopItem.className = 'shop-item';
      
      const info = document.createElement('div');
      info.className = 'shop-item-info';
      
      const name = document.createElement('div');
      name.className = 'shop-item-name';
      name.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      
      const desc = document.createElement('div');
      desc.className = 'shop-item-desc';
      desc.textContent = getItemDescription(key);
      
      const price = document.createElement('div');
      price.className = 'shop-item-price';
      price.textContent = `${item.cost} credits`;
      
      info.appendChild(name);
      info.appendChild(desc);
      info.appendChild(price);
      
      const buyBtn = document.createElement('button');
      buyBtn.className = 'shop-buy-btn';
      buyBtn.textContent = 'Buy';
      buyBtn.disabled = myResources < item.cost;
      buyBtn.addEventListener('click', () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'buy', itemId: key }));
          showNotification(`Purchased ${key}!`, 'success');
          triggerShake(8, 200);
        }
      });
      
      shopItem.appendChild(info);
      shopItem.appendChild(buyBtn);
      shopContent.appendChild(shopItem);
    });
  }

  function getItemDescription(itemId) {
    const descriptions = {
      engine: 'Increases ship speed and maneuverability',
      cargo: 'Expands storage capacity for resources',
      weapon: 'Adds offensive capabilities to your ship',
      shield: 'Provides defensive protection'
    };
    return descriptions[itemId] || 'Unknown module';
  }

  // Toggle shop panel
  shopToggleBtn.addEventListener('click', () => {
    shopPanel.classList.toggle('hidden');
    if (!shopPanel.classList.contains('hidden')) {
      renderShop();
    }
  });

  closeShopBtn.addEventListener('click', () => {
    shopPanel.classList.add('hidden');
  });

  // Keyboard shortcut for shop
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      shopPanel.classList.toggle('hidden');
      if (!shopPanel.classList.contains('hidden')) {
        renderShop();
      }
    }
  });

  // WebSocket message handling
  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    
    if (msg.type === 'init') {
      myId = msg.id;
      players = {};
      msg.players.forEach(p => { players[p.id] = p; });
      ores = msg.ores;
      if (msg.items) {
        shopItems = msg.items;
      }
      showNotification('Connected to StarForgeFrontier', 'success');
      updatePlayerCount();
    } else if (msg.type === 'update') {
      players = {};
      msg.players.forEach(p => {
        players[p.id] = p;
        if (p.id === myId) {
          myResources = p.resources;
          myLevel = p.level;
          updateHUD();
        }
      });
      ores = msg.ores;
      updatePlayerCount();
    } else if (msg.type === 'resources') {
      myResources = msg.resources;
      updateHUD();
      renderShop(); // Update shop button states
    } else if (msg.type === 'player_disconnect') {
      delete players[msg.id];
      updatePlayerCount();
    } else if (msg.type === 'event') {
      if (msg.event && msg.event.type === 'supernova') {
        handleSupernova(msg.event);
      }
    }
  };

  ws.onclose = () => {
    showNotification('Connection lost. Please refresh.', 'error', 5000);
  };

  ws.onerror = () => {
    showNotification('Connection error. Please check your network.', 'error');
  };

  // Update HUD elements
  function updateHUD() {
    resourcesEl.textContent = myResources.toLocaleString();
    levelEl.textContent = myLevel;
    
    const player = players[myId];
    if (player) {
      positionEl.textContent = `${Math.round(player.x)}, ${Math.round(player.y)}`;
    }
    
    // Update button states
    addEngineBtn.disabled = myResources < 50;
    addCargoBtn.disabled = myResources < 30;
  }

  function updatePlayerCount() {
    const count = Object.keys(players).length;
    playerCountEl.textContent = count;
  }

  // Handle supernova events
  function handleSupernova(event) {
    activeEvents.push({
      type: 'supernova',
      x: event.x,
      y: event.y,
      startTime: performance.now()
    });
    
    showNotification('SUPERNOVA DETECTED! High-value ores spawned!', 'event', 4000);
    triggerShake(20, 800);
    
    // Create particle explosion effect
    createParticleExplosion(event.x, event.y, 50);
  }

  // Particle effects
  function createParticleExplosion(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      particleEffects.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: `hsl(${Math.random() * 60 + 10}, 100%, 60%)`
      });
    }
  }

  function updateParticles() {
    particleEffects = particleEffects.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= 0.02;
      return p.life > 0;
    });
  }

  function drawParticles(camX, camY) {
    particleEffects.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // Input handling
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

  // Module purchase handlers
  addEngineBtn.addEventListener('click', () => {
    const self = players[myId];
    if (!self || myResources < 50) return;
    const offset = (self.modules.length) * 22;
    const module = { id: 'engine', x: offset, y: 0 };
    ws.send(JSON.stringify({ type: 'build', module }));
    showNotification('Engine module added!', 'success');
    triggerShake(10, 300);
  });

  addCargoBtn.addEventListener('click', () => {
    const self = players[myId];
    if (!self || myResources < 30) return;
    const offset = (self.modules.length) * 22;
    const module = { id: 'cargo', x: offset, y: 0 };
    ws.send(JSON.stringify({ type: 'build', module }));
    showNotification('Cargo module added!', 'success');
    triggerShake(8, 250);
  });

  // Screen shake
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

  // Zoom controls
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * 0.1;
    targetZoom = Math.min(2.5, Math.max(0.5, targetZoom - delta));
  }, { passive: false });

  function updateZoom() {
    zoom += (targetZoom - zoom) * 0.1;
  }

  // Minimap rendering
  function renderMinimap() {
    const scale = 0.02;
    const mapSize = 200;
    const halfSize = mapSize / 2;
    
    // Clear minimap
    minimapCtx.fillStyle = 'rgba(10, 25, 49, 0.9)';
    minimapCtx.fillRect(0, 0, mapSize, mapSize);
    
    // Center on player
    const self = players[myId];
    if (!self) return;
    
    // Draw grid
    minimapCtx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
    minimapCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = (mapSize / 4) * i;
      minimapCtx.beginPath();
      minimapCtx.moveTo(pos, 0);
      minimapCtx.lineTo(pos, mapSize);
      minimapCtx.stroke();
      minimapCtx.beginPath();
      minimapCtx.moveTo(0, pos);
      minimapCtx.lineTo(mapSize, pos);
      minimapCtx.stroke();
    }
    
    // Draw ores
    minimapCtx.fillStyle = '#ffd700';
    ores.forEach(ore => {
      const x = halfSize + (ore.x - self.x) * scale;
      const y = halfSize + (ore.y - self.y) * scale;
      if (x >= 0 && x <= mapSize && y >= 0 && y <= mapSize) {
        minimapCtx.beginPath();
        minimapCtx.arc(x, y, 2, 0, Math.PI * 2);
        minimapCtx.fill();
      }
    });
    
    // Draw players
    Object.values(players).forEach(p => {
      const x = halfSize + (p.x - self.x) * scale;
      const y = halfSize + (p.y - self.y) * scale;
      if (x >= 0 && x <= mapSize && y >= 0 && y <= mapSize) {
        minimapCtx.fillStyle = p.id === myId ? '#00ff00' : '#ff0000';
        minimapCtx.fillRect(x - 2, y - 2, 4, 4);
      }
    });
    
    // Draw events
    activeEvents.forEach(ev => {
      if (ev.type === 'supernova') {
        const x = halfSize + (ev.x - self.x) * scale;
        const y = halfSize + (ev.y - self.y) * scale;
        if (x >= 0 && x <= mapSize && y >= 0 && y <= mapSize) {
          minimapCtx.strokeStyle = '#ff00ff';
          minimapCtx.lineWidth = 2;
          minimapCtx.beginPath();
          minimapCtx.arc(x, y, 10, 0, Math.PI * 2);
          minimapCtx.stroke();
        }
      }
    });
  }

  // Procedural generation helpers (from original client)
  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stringToSeed(str) {
    let seed = 0;
    for (let i = 0; i < str.length; i++) {
      seed = (seed * 31 + str.charCodeAt(i)) >>> 0;
    }
    return seed;
  }

  // Starfield and planets (simplified from original)
  const STAR_TILE_SIZE = 800;
  const STARS_PER_TILE = 8;
  
  function getStarsForTile(tx, ty) {
    const seed = (tx * 73856093) ^ (ty * 19349663);
    const rand = mulberry32(seed);
    const stars = [];
    for (let i = 0; i < STARS_PER_TILE; i++) {
      stars.push({
        x: rand() * STAR_TILE_SIZE,
        y: rand() * STAR_TILE_SIZE,
        size: 1 + rand() * 2,
        alpha: 0.5 + rand() * 0.5
      });
    }
    return stars;
  }

  function drawStars(camX, camY) {
    const halfW = canvas.width / zoom / 2;
    const halfH = canvas.height / zoom / 2;
    const minX = Math.floor((camX - halfW) / STAR_TILE_SIZE) - 1;
    const maxX = Math.floor((camX + halfW) / STAR_TILE_SIZE) + 1;
    const minY = Math.floor((camY - halfH) / STAR_TILE_SIZE) - 1;
    const maxY = Math.floor((camY + halfH) / STAR_TILE_SIZE) + 1;
    
    ctx.save();
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

  // Module shapes
  const moduleShapeCache = {};
  
  function getModuleShape(playerId, modIndex) {
    const key = `${playerId}-${modIndex}`;
    if (moduleShapeCache[key]) return moduleShapeCache[key];
    const seed = stringToSeed(key);
    const rand = mulberry32(seed);
    const pointCount = 5 + Math.floor(rand() * 4);
    const points = [];
    const twoPi = Math.PI * 2;
    for (let i = 0; i < pointCount; i++) {
      const baseAngle = (twoPi / pointCount) * i;
      const jitter = (rand() - 0.5) * (twoPi / pointCount) * 0.4;
      const radius = 10 + rand() * 8;
      const a = baseAngle + jitter;
      points.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
    }
    moduleShapeCache[key] = points;
    return points;
  }

  // Main render loop
  function render() {
    requestAnimationFrame(render);
    updateZoom();
    updateParticles();
    
    const shakeOffset = applyShake();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Determine camera center
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
    
    // Draw stars
    drawStars(camX, camY);
    
    // Draw supernova effects
    const nowEvt = performance.now();
    for (let i = activeEvents.length - 1; i >= 0; i--) {
      const ev = activeEvents[i];
      const dt = nowEvt - ev.startTime;
      if (dt > 10000) {
        activeEvents.splice(i, 1);
        continue;
      }
      const t = dt / 10000;
      const maxRadius = 600;
      const radius = t * maxRadius;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 100, 20, ${1 - t})`;
      ctx.lineWidth = 4;
      ctx.arc(ev.x, ev.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    // Draw particles
    drawParticles(camX, camY);
    
    // Draw ores with glow effect
    ores.forEach(ore => {
      const ox = Math.floor(ore.x);
      const oy = Math.floor(ore.y);
      const oreSeed = ((ox * 1000003) ^ (oy * 1000033)) >>> 0;
      const oreRand = mulberry32(oreSeed);
      const radius = 5 + oreRand() * 8;
      
      let color = '#e2a516';
      let glowRadius = 0;
      if (self) {
        const dx = self.x - ore.x;
        const dy = self.y - ore.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 200 * 200) {
          color = '#ffd02f';
          glowRadius = 20;
        }
      }
      
      // Draw glow
      if (glowRadius > 0) {
        ctx.save();
        const gradient = ctx.createRadialGradient(ore.x, ore.y, 0, ore.x, ore.y, glowRadius);
        gradient.addColorStop(0, 'rgba(255, 208, 47, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 208, 47, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ore.x, ore.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      
      // Draw ore
      ctx.save();
      ctx.translate(ore.x, ore.y);
      ctx.rotate(oreRand() * Math.PI * 2);
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.ellipse(0, 0, radius, radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });
    
    // Draw players with enhanced visuals
    Object.values(players).forEach(p => {
      const isMe = p.id === myId;
      
      // Draw engine trail
      if (isMe && (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'] || 
                   keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'])) {
        ctx.save();
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
        gradient.addColorStop(0, 'rgba(0, 191, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 191, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      
      // Draw modules
      p.modules.forEach((mod, index) => {
        const shape = getModuleShape(p.id, index);
        const worldX = p.x + mod.x;
        const worldY = p.y + mod.y;
        
        // Module shadow
        ctx.save();
        ctx.translate(2, 2);
        ctx.beginPath();
        shape.forEach((pt, i) => {
          const x = worldX + pt.x;
          const y = worldY + pt.y;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();
        ctx.restore();
        
        // Module body
        ctx.beginPath();
        shape.forEach((pt, i) => {
          const x = worldX + pt.x;
          const y = worldY + pt.y;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        
        // Gradient fill
        const gradient = ctx.createLinearGradient(worldX - 10, worldY - 10, worldX + 10, worldY + 10);
        if (isMe) {
          gradient.addColorStop(0, '#00bfff');
          gradient.addColorStop(1, '#0080ff');
        } else {
          gradient.addColorStop(0, '#7f9fff');
          gradient.addColorStop(1, '#5f7fff');
        }
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.strokeStyle = isMe ? 'rgba(0, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      
      // Draw player name
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(isMe ? 'You' : `Player ${p.id.substr(0, 6)}`, p.x, p.y - 30);
      ctx.restore();
    });
    
    ctx.restore();
    
    // Update minimap
    renderMinimap();
    
    // Update HUD
    updateHUD();
  }

  render();
})();