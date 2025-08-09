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
  const addWeaponBtn = document.getElementById('addWeapon');
  const addShieldBtn = document.getElementById('addShield');
  const addReactorBtn = document.getElementById('addReactor');
  const shipEditorToggleBtn = document.getElementById('shipEditorToggle');
  
  // Ship stats UI elements
  const shipSpeedEl = document.getElementById('shipSpeed');
  const shipCargoEl = document.getElementById('shipCargo');
  const shipRangeEl = document.getElementById('shipRange');

  // Game state
  let myId = null;
  let players = {};
  let ores = [];
  let hazards = []; // Environmental hazards
  let myResources = 0;
  let myLevel = 1;
  let shopItems = {};
  let activeEvents = [];
  let playerInventory = new Map(); // Track player ore inventory
  let shipProperties = {
    speed: 2,
    cargoCapacity: 1000,
    collectionRange: 40,
    maxHealth: 100,
    damage: 0,
    weaponRange: 0
  };
  
  // Galaxy system
  let galaxyUI = null;
  let currentSectorData = null;
  
  // Ship editor system
  let shipEditor = null;
  
  // Trading system
  let tradingUI = null;
  
  // Hazard system
  let hazardSystemUI = null;
  
  // Combat state
  let selectedTarget = null;
  let weaponCooldown = 0;
  let projectiles = [];
  let damageNumbers = [];
  let combatLog = [];
  let lastFireTime = 0;
  let mouseX = 0;
  let mouseY = 0;
  let worldMouseX = 0;
  let worldMouseY = 0;
  
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
  
  // Ship editor toggle
  shipEditorToggleBtn.addEventListener('click', () => {
    if (shipEditor) {
      shipEditor.openEditor();
    }
  });

  // Keyboard shortcut for shop and combat controls
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab for target cycling
        cycleTarget();
      } else {
        // Tab for shop toggle
        shopPanel.classList.toggle('hidden');
        if (!shopPanel.classList.contains('hidden')) {
          renderShop();
        }
      }
    } else if (e.code === 'Space') {
      e.preventDefault();
      fireWeapon();
    } else if (e.key === 'B' || e.key === 'b') {
      e.preventDefault();
      if (shipEditor) {
        shipEditor.openEditor();
      }
    } else if (e.key === 'T' || e.key === 't') {
      e.preventDefault();
      if (tradingUI) {
        tradingUI.openTradingPanel('station');
      }
    } else if (e.key === 'M' || e.key === 'm') {
      e.preventDefault();
      if (tradingUI) {
        tradingUI.openTradingPanel('market');
      }
    } else if (e.key === 'C' || e.key === 'c') {
      e.preventDefault();
      if (tradingUI) {
        tradingUI.openTradingPanel('contracts');
      }
    }
  });

  // Mouse tracking for targeting
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    updateWorldMousePosition();
  });

  // Click to target or fire
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    updateWorldMousePosition();
    
    // Check if clicking on an enemy ship
    const target = getTargetAtPosition(worldMouseX, worldMouseY);
    if (target && target.id !== myId) {
      selectedTarget = target.id;
      showNotification(`Targeting ${target.username || 'Player ' + target.id.substr(0, 6)}`, 'info', 1500);
    } else if (selectedTarget && shipProperties.damage > 0) {
      // Fire at selected target
      fireWeapon();
    }
  });

  // Check authentication on load
  const playerId = localStorage.getItem('playerId');
  const username = localStorage.getItem('username');
  const isGuest = localStorage.getItem('isGuest') === 'true';
  
  if (!playerId) {
    window.location.href = '/auth.html';
    return;
  }

  // Send authentication message immediately after connection
  ws.onopen = () => {
    if (isGuest) {
      // Create a temporary guest player
      ws.send(JSON.stringify({
        type: 'authenticate',
        playerId: playerId,
        isGuest: true,
        username: username
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'authenticate',
        playerId: playerId
      }));
    }
  };

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
      hazards = msg.hazards || [];
      if (msg.items) {
        shopItems = msg.items;
      }
      if (msg.playerData && msg.playerData.shipProperties) {
        shipProperties = msg.playerData.shipProperties;
      }
      
      // Initialize galaxy UI after connection
      if (!galaxyUI) {
        // Create game client interface for galaxy UI
        const gameClientInterface = {
          ws: ws,
          get myResources() { return myResources; },
          get players() { return players; },
          get myId() { return myId; },
          showNotification: showNotification,
          triggerShake: triggerShake,
          get particleEffects() { return particleEffects; }
        };
        
        galaxyUI = new GalaxyUI(gameClientInterface);
        
        // Initialize ship editor
        shipEditor = new ShipEditor(gameClientInterface);
        
        // Initialize trading UI
        tradingUI = new TradingUI();
        
        // Connect trading UI to game client for access to player data
        window.gameClient = {
          get myId() { return myId; },
          get players() { return players; },
          get myResources() { return myResources; },
          get shipProperties() { return shipProperties; },
          get playerInventory() { return playerInventory; },
          sendWebSocketMessage: (message) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(message));
            }
          }
        };
        
        // Initialize skill system UI
        if (typeof SkillSystemUI !== 'undefined') {
          window.skillSystem = new SkillSystemUI(window.gameClient);
        }
        
        // Initialize hazard system UI
        if (typeof HazardSystemUI !== 'undefined') {
          hazardSystemUI = new HazardSystemUI(gameClientInterface);
          window.hazardSystem = hazardSystemUI;
          
          // Initialize with current hazards
          if (hazards.length > 0) {
            hazardSystemUI.updateHazards(hazards);
          }
        }
        
        // Make galaxy UI, ship editor, trading UI and game functions globally accessible
        window.galaxyUI = galaxyUI;
        window.shipEditor = shipEditor;
        window.tradingUI = tradingUI;
        window.playSound = playSound;
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
      hazards = msg.hazards || [];
      
      // Update hazard system if available
      if (hazardSystemUI) {
        hazardSystemUI.updateHazards(hazards);
      }
      
      updatePlayerCount();
    } else if (msg.type === 'resources') {
      const oldResources = myResources;
      myResources = msg.resources;
      
      // If resources increased, simulate ore collection for trading system
      if (myResources > oldResources) {
        const resourceGain = myResources - oldResources;
        const oreQuantity = Math.max(1, Math.floor(resourceGain / 10)); // Simplified conversion
        
        // Simulate random ore type collection based on common ore types
        const commonOreTypes = ['IRON', 'COPPER', 'SILVER', 'GOLD', 'TITANIUM'];
        const oreType = msg.oreType || commonOreTypes[Math.floor(Math.random() * commonOreTypes.length)];
        
        const currentQuantity = playerInventory.get(oreType) || 0;
        playerInventory.set(oreType, currentQuantity + oreQuantity);
        
        // Notify trading UI of inventory update if it exists
        if (window.tradingUI) {
          window.tradingUI.updateCargoDisplay();
        }
      }
      
      updateHUD();
      renderShop(); // Update shop button states
    } else if (msg.type === 'shipProperties') {
      shipProperties = msg.properties;
      updateShipStats();
      showNotification('Ship upgraded!', 'info', 2000);
    } else if (msg.type === 'player_disconnect') {
      delete players[msg.id];
      updatePlayerCount();
    } else if (msg.type === 'event') {
      if (msg.event && msg.event.type === 'supernova') {
        handleSupernova(msg.event);
      }
    } else if (msg.type === 'achievements') {
      handleAchievements(msg.achievements);
    } else if (msg.type === 'error') {
      showNotification(msg.message, 'error');
      if (msg.message.includes('Authentication')) {
        localStorage.clear();
        window.location.href = '/auth.html';
      }
    } else if (msg.type === 'player_join') {
      showNotification(`${msg.player.username} joined the galaxy`, 'info', 2000);
    } else if (msg.type === 'combat_hit') {
      // Handle combat hit messages
      const targetPlayer = players[msg.targetId];
      if (targetPlayer) {
        createDamageNumber(targetPlayer.x, targetPlayer.y - 20, msg.damage);
        
        // Create appropriate visual effect
        if (msg.shieldHit) {
          createShieldHitEffect(targetPlayer.x, targetPlayer.y);
          playSound('shieldHit');
        } else {
          createImpactEffect(targetPlayer.x, targetPlayer.y);
          playSound('hit');
        }
        
        triggerShake(msg.targetId === myId ? 8 : 3, msg.targetId === myId ? 200 : 100);
        
        // Update target's health
        if (targetPlayer.health !== undefined) {
          targetPlayer.health = Math.max(0, targetPlayer.health - msg.damage);
        }
        
        // Add to combat log
        const attackerName = msg.attackerId === myId ? 'You' : (players[msg.attackerId]?.username || 'Player');
        const targetName = msg.targetId === myId ? 'You' : (targetPlayer.username || 'Player');
        addCombatLogEntry(`${attackerName} hit ${targetName} for ${msg.damage} damage`);
        
        // Low health warning for self
        if (msg.targetId === myId && targetPlayer.health < shipProperties.maxHealth * 0.25) {
          showNotification('LOW HEALTH WARNING!', 'error', 2000);
          playSound('lowHealth');
        }
      }
    } else if (msg.type === 'player_destroyed') {
      // Handle player destruction
      const destroyedPlayer = players[msg.playerId];
      if (destroyedPlayer) {
        createParticleExplosion(destroyedPlayer.x, destroyedPlayer.y, 30);
        playSound('explosion');
        triggerShake(15, 500);
        
        const destroyerName = msg.destroyerId === myId ? 'You' : (players[msg.destroyerId]?.username || 'Player');
        const destroyedName = msg.playerId === myId ? 'You' : (destroyedPlayer.username || 'Player');
        addCombatLogEntry(`${destroyerName} destroyed ${destroyedName}!`, 'kill');
        
        if (msg.playerId === selectedTarget) {
          selectedTarget = null;
        }
      }
    } else if (msg.type === 'galaxy_map') {
      // Handle galaxy map data
      if (galaxyUI) {
        galaxyUI.handleGalaxyMapData(msg.data);
      }
    } else if (msg.type === 'warp_targets') {
      // Handle warp targets data
      if (galaxyUI) {
        galaxyUI.handleWarpTargetsData(msg.data);
      }
    } else if (msg.type === 'warp_result') {
      // Handle warp initiation result
      if (msg.result.success) {
        showNotification('Warp initiated successfully!', 'success');
        if (galaxyUI && msg.result.arrivalTime) {
          galaxyUI.createWarpTravelEffect(msg.result.fromCoords, msg.result.toCoords);
        }
      } else {
        showNotification(`Warp failed: ${msg.result.reason}`, 'error');
      }
    } else if (msg.type === 'warp_status') {
      // Handle warp status updates
      if (galaxyUI) {
        galaxyUI.handleWarpStatus(msg.status);
      }
    } else if (msg.type === 'warp_completed') {
      // Handle warp completion
      if (galaxyUI) {
        galaxyUI.handleWarpCompletion(msg.data);
      }
      showNotification('Warp completed!', 'success');
      triggerShake(10, 300);
    } else if (msg.type === 'warp_cancelled') {
      // Handle warp cancellation
      showNotification(`Warp cancelled. Fuel refund: ${msg.result.fuelRefund}`, 'info');
      if (galaxyUI) {
        galaxyUI.updateWarpDriveStatus();
      }
    } else if (msg.type === 'sector_info') {
      // Handle current sector information
      currentSectorData = msg.sector;
      if (galaxyUI) {
        galaxyUI.handleSectorInfo(msg.sector);
      }
    } else if (msg.type === 'sector_event') {
      // Handle sector-specific events
      if (msg.event && msg.event.type === 'supernova') {
        handleSupernova(msg.event);
      } else if (msg.event && msg.event.type === 'tech_activation') {
        showNotification('Ancient technology activated in this sector!', 'event', 4000);
        triggerShake(12, 400);
      } else if (msg.event && msg.event.type === 'asteroid_collapse') {
        showNotification('Asteroid collapse detected! New ore deposits formed!', 'info', 3000);
        triggerShake(8, 300);
      }
    } else if (msg.type === 'trading_transaction') {
      // Handle completed trading transactions
      if (msg.success) {
        const { oreType, quantity, action, totalPrice } = msg.transaction;
        
        if (action === 'buy') {
          // Add ores to inventory, subtract credits
          const currentQuantity = playerInventory.get(oreType) || 0;
          playerInventory.set(oreType, currentQuantity + quantity);
          myResources -= totalPrice;
        } else if (action === 'sell') {
          // Remove ores from inventory, add credits
          const currentQuantity = playerInventory.get(oreType) || 0;
          playerInventory.set(oreType, Math.max(0, currentQuantity - quantity));
          myResources += totalPrice;
        }
        
        updateHUD();
        if (window.tradingUI) {
          window.tradingUI.updateCargoDisplay();
        }
      }
    } else if (msg.type === 'contract_update') {
      // Handle contract status updates
      if (window.tradingUI) {
        window.tradingUI.updateActiveContracts();
      }
    } else if (msg.type === 'player_warp_start') {
      // Handle other players starting warp
      const warpingPlayer = players[msg.playerId];
      if (warpingPlayer) {
        showNotification(`${warpingPlayer.username || 'Player'} has warped away`, 'info', 2000);
      }
      
    // ===== SKILL SYSTEM MESSAGE HANDLERS =====
    } else if (msg.type === 'player_skills_data') {
      // Handle skill data from server
      if (window.skillSystem) {
        window.skillSystem.handleSkillData(msg);
      }
      
    } else if (msg.type === 'skill_upgrade_success') {
      // Handle successful skill upgrade
      if (window.skillSystem) {
        window.skillSystem.handleSkillUpgrade({
          success: true,
          skillName: msg.skillName,
          newLevel: msg.newLevel,
          pointsSpent: msg.pointsSpent
        });
      }
      
    } else if (msg.type === 'skill_upgrade_error') {
      // Handle skill upgrade error
      if (window.skillSystem) {
        window.skillSystem.handleSkillUpgrade({
          success: false,
          error: msg.error
        });
      }
      
    } else if (msg.type === 'skill_effects_data') {
      // Handle skill effects data
      // This could be used to apply visual effects or modify gameplay
      console.log('Skill effects received:', msg.effects);
      
    } else if (msg.type === 'skill_history_data') {
      // Handle skill history data
      console.log('Skill history received:', msg.history);
      
    } else if (msg.type === 'skill_reset_success') {
      // Handle successful skill reset
      if (window.skillSystem) {
        window.skillSystem.showNotification('All skills have been reset successfully!', 'success');
        window.skillSystem.refreshSkillData();
      }
      
    } else if (msg.type === 'skill_reset_error') {
      // Handle skill reset error
      if (window.skillSystem) {
        window.skillSystem.showNotification(msg.error, 'error');
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
      
      // Update galaxy UI with player position
      if (galaxyUI) {
        galaxyUI.updateForPlayerPosition(player.x, player.y);
        
        // Request sector info if we haven't received it yet
        if (!currentSectorData) {
          ws.send(JSON.stringify({ type: 'request_sector_info' }));
        }
      }
    }
    
    // Update ship stats display
    updateShipStats();
    
    // Update galaxy UI resources
    if (galaxyUI) {
      galaxyUI.updateWarpDriveStatus();
    }
    
    // Update trading UI if available
    if (tradingUI) {
      // Update with current player position for station proximity detection
      // The trading UI will handle this through its periodic updates
    }
    
    // Update button states
    addEngineBtn.disabled = myResources < 50;
    addCargoBtn.disabled = myResources < 30;
    if (addWeaponBtn) addWeaponBtn.disabled = myResources < 70;
    if (addShieldBtn) addShieldBtn.disabled = myResources < 60;
    if (addReactorBtn) addReactorBtn.disabled = myResources < 120;
    const addWarpDriveBtn = document.getElementById('addWarpDrive');
    if (addWarpDriveBtn) addWarpDriveBtn.disabled = myResources < 150;
  }
  
  // Update ship statistics display
  function updateShipStats() {
    if (shipSpeedEl) shipSpeedEl.textContent = shipProperties.speed.toFixed(1);
    if (shipCargoEl) shipCargoEl.textContent = `${Math.round((myResources / shipProperties.cargoCapacity) * 100)}%`;
    if (shipRangeEl) shipRangeEl.textContent = shipProperties.collectionRange;
    
    // Update combat stats
    const shipHealthEl = document.getElementById('shipHealth');
    const shipDamageEl = document.getElementById('shipDamage');
    const shipWeaponRangeEl = document.getElementById('shipWeaponRange');
    
    const self = players[myId];
    if (self && self.health !== undefined) {
      if (shipHealthEl) shipHealthEl.textContent = `${self.health}/${shipProperties.maxHealth}`;
      
      // Update health color based on percentage
      if (shipHealthEl) {
        const healthPercent = self.health / shipProperties.maxHealth;
        if (healthPercent > 0.5) {
          shipHealthEl.style.color = '#28a745';
        } else if (healthPercent > 0.25) {
          shipHealthEl.style.color = '#ffc107';
        } else {
          shipHealthEl.style.color = '#dc3545';
        }
      }
    }
    
    if (shipDamageEl) shipDamageEl.textContent = shipProperties.damage;
    if (shipWeaponRangeEl) shipWeaponRangeEl.textContent = shipProperties.weaponRange;
    
    // Update weapon cooldown indicator
    updateWeaponCooldownDisplay();
    
    // Update target display
    updateTargetDisplay();
  }
  
  function updateWeaponCooldownDisplay() {
    const cooldownBar = document.getElementById('weaponCooldownBar');
    if (cooldownBar) {
      const cooldownPercent = Math.max(0, weaponCooldown / 1000); // 1000ms cooldown
      cooldownBar.style.width = `${(1 - cooldownPercent) * 100}%`;
      
      if (cooldownPercent > 0) {
        cooldownBar.style.backgroundColor = '#dc3545'; // Red when on cooldown
      } else {
        cooldownBar.style.backgroundColor = '#28a745'; // Green when ready
      }
    }
  }
  
  function updateTargetDisplay() {
    const targetNameEl = document.getElementById('selectedTargetName');
    if (targetNameEl) {
      if (selectedTarget && players[selectedTarget]) {
        const target = players[selectedTarget];
        targetNameEl.textContent = target.username || `Player ${target.id.substr(0, 6)}`;
        targetNameEl.style.color = '#ff4444';
      } else {
        targetNameEl.textContent = 'No Target';
        targetNameEl.style.color = 'rgba(255, 255, 255, 0.6)';
      }
    }
  }

  function updatePlayerCount() {
    const count = Object.keys(players).length;
    playerCountEl.textContent = count;
  }

  // Handle achievements
  function handleAchievements(achievements) {
    achievements.forEach(achievement => {
      showNotification(`🏆 Achievement Unlocked: ${achievement.name}`, 'success', 4000);
      triggerShake(12, 400);
    });
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
        color: `hsl(${Math.random() * 60 + 10}, 100%, 60%)`,
        type: 'explosion'
      });
    }
  }

  function createShieldHitEffect(x, y) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      particleEffects.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8,
        color: `hsl(200, 100%, ${60 + Math.random() * 40}%)`,
        type: 'shield'
      });
    }
  }

  function createImpactEffect(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      particleEffects.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6,
        color: `hsl(0, 100%, ${70 + Math.random() * 30}%)`,
        type: 'impact'
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
      
      if (p.type === 'shield') {
        // Shield particles are larger and have a glow
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'impact') {
        // Impact particles are smaller and more intense
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'warp_arrival') {
        // Warp arrival particles with blue glow effect
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * p.life, 0, Math.PI * 2);
        ctx.fill();
        
        // Add streaking effect
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        // Default explosion particles
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      
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

  addWeaponBtn.addEventListener('click', () => {
    const self = players[myId];
    if (!self || myResources < 70) return;
    const offset = (self.modules.length) * 22;
    const module = { id: 'weapon', x: offset, y: 0 };
    ws.send(JSON.stringify({ type: 'build', module }));
    showNotification('Weapon module added!', 'success');
    triggerShake(10, 300);
  });

  addShieldBtn.addEventListener('click', () => {
    const self = players[myId];
    if (!self || myResources < 60) return;
    const offset = (self.modules.length) * 22;
    const module = { id: 'shield', x: offset, y: 0 };
    ws.send(JSON.stringify({ type: 'build', module }));
    showNotification('Shield module added!', 'success');
    triggerShake(8, 250);
  });

  addReactorBtn.addEventListener('click', () => {
    const self = players[myId];
    if (!self || myResources < 120) return;
    const offset = (self.modules.length) * 22;
    const module = { id: 'reactor', x: offset, y: 0 };
    ws.send(JSON.stringify({ type: 'build', module }));
    showNotification('Reactor module added!', 'success');
    triggerShake(10, 300);
  });

  // Add warp drive module handler
  const addWarpDriveBtn = document.getElementById('addWarpDrive');
  if (addWarpDriveBtn) {
    addWarpDriveBtn.addEventListener('click', () => {
      const self = players[myId];
      if (!self || myResources < 150) return;
      const offset = (self.modules.length) * 22;
      const module = { id: 'warp_drive', x: offset, y: 0 };
      ws.send(JSON.stringify({ type: 'build', module }));
      showNotification('Warp drive module added!', 'success');
      triggerShake(10, 300);
      
      // Update galaxy UI warp capabilities
      if (galaxyUI) {
        setTimeout(() => {
          galaxyUI.requestWarpTargets();
        }, 500);
      }
    });
  }

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

  // Combat system functions
  function updateWorldMousePosition() {
    const self = players[myId];
    if (!self) return;
    
    const screenCenterX = canvas.width / 2;
    const screenCenterY = canvas.height / 2;
    
    worldMouseX = self.x + (mouseX - screenCenterX) / zoom;
    worldMouseY = self.y + (mouseY - screenCenterY) / zoom;
  }

  function getTargetAtPosition(x, y) {
    const clickRadius = 30 / zoom; // Adjust for zoom level
    
    for (const player of Object.values(players)) {
      if (player.id === myId) continue;
      
      const dx = player.x - x;
      const dy = player.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= clickRadius) {
        return player;
      }
    }
    return null;
  }

  function cycleTarget() {
    const otherPlayers = Object.values(players).filter(p => p.id !== myId);
    if (otherPlayers.length === 0) {
      selectedTarget = null;
      return;
    }
    
    if (!selectedTarget) {
      selectedTarget = otherPlayers[0].id;
    } else {
      const currentIndex = otherPlayers.findIndex(p => p.id === selectedTarget);
      const nextIndex = (currentIndex + 1) % otherPlayers.length;
      selectedTarget = otherPlayers[nextIndex].id;
    }
    
    const target = players[selectedTarget];
    if (target) {
      showNotification(`Targeting ${target.username || 'Player ' + target.id.substr(0, 6)}`, 'info', 1500);
    }
  }

  function fireWeapon() {
    const now = performance.now();
    const cooldownTime = 1000; // 1 second cooldown
    
    if (now - lastFireTime < cooldownTime) {
      return; // Still on cooldown
    }
    
    const self = players[myId];
    const target = players[selectedTarget];
    
    if (!self || !target || shipProperties.damage <= 0) {
      return;
    }
    
    // Check if target is in range
    const dx = target.x - self.x;
    const dy = target.y - self.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > shipProperties.weaponRange) {
      showNotification('Target out of range!', 'warning', 1500);
      return;
    }
    
    lastFireTime = now;
    weaponCooldown = cooldownTime;
    
    // Create projectile
    createProjectile(self.x, self.y, target.x, target.y, shipProperties.damage);
    
    // Send fire command to server
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'fire',
        targetId: selectedTarget,
        damage: shipProperties.damage
      }));
    }
    
    // Visual and audio feedback
    triggerShake(5, 150);
    playSound('weaponFire');
  }

  function createProjectile(startX, startY, targetX, targetY, damage) {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = 8; // pixels per frame
    
    projectiles.push({
      x: startX,
      y: startY,
      vx: (dx / distance) * speed,
      vy: (dy / distance) * speed,
      damage: damage,
      life: distance / speed, // Time to reach target
      maxLife: distance / speed,
      color: '#00ffff',
      type: 'laser'
    });
  }

  function updateProjectiles() {
    projectiles = projectiles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      return p.life > 0;
    });
  }

  function drawProjectiles() {
    projectiles.forEach(p => {
      ctx.save();
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      
      if (p.type === 'laser') {
        // Draw laser beam
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 5, p.y - p.vy * 5);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      
      ctx.restore();
    });
  }

  function createDamageNumber(x, y, damage) {
    damageNumbers.push({
      x: x,
      y: y,
      damage: damage,
      life: 60, // frames
      maxLife: 60,
      vy: -2 // float upward
    });
  }

  function updateDamageNumbers() {
    damageNumbers = damageNumbers.filter(d => {
      d.y += d.vy;
      d.vy *= 0.98; // slow down over time
      d.life -= 1;
      return d.life > 0;
    });
  }

  function drawDamageNumbers() {
    damageNumbers.forEach(d => {
      ctx.save();
      const alpha = d.life / d.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText(`-${d.damage}`, d.x, d.y);
      ctx.fillText(`-${d.damage}`, d.x, d.y);
      ctx.restore();
    });
  }

  function updateCooldowns() {
    if (weaponCooldown > 0) {
      weaponCooldown -= 16; // Reduce by frame time (assuming 60fps)
      if (weaponCooldown < 0) weaponCooldown = 0;
    }
  }

  // Audio system
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffers = {};
  
  function generateSound(type) {
    const sampleRate = audioContext.sampleRate;
    let buffer, data, length;
    
    switch(type) {
      case 'weaponFire':
        length = sampleRate * 0.2; // 0.2 seconds
        buffer = audioContext.createBuffer(1, length, sampleRate);
        data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          data[i] = Math.sin(2 * Math.PI * (800 + t * 400) * t) * Math.exp(-t * 8) * 0.3;
        }
        break;
        
      case 'hit':
        length = sampleRate * 0.15;
        buffer = audioContext.createBuffer(1, length, sampleRate);
        data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.2;
        }
        break;
        
      case 'shieldHit':
        length = sampleRate * 0.3;
        buffer = audioContext.createBuffer(1, length, sampleRate);
        data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          data[i] = Math.sin(2 * Math.PI * 300 * t) * Math.exp(-t * 3) * 0.2;
        }
        break;
        
      case 'explosion':
        length = sampleRate * 0.8;
        buffer = audioContext.createBuffer(1, length, sampleRate);
        data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2) * 0.4;
        }
        break;
        
      case 'lowHealth':
        length = sampleRate * 0.5;
        buffer = audioContext.createBuffer(1, length, sampleRate);
        data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          data[i] = Math.sin(2 * Math.PI * 200 * t) * Math.sin(2 * Math.PI * 8 * t) * Math.exp(-t * 4) * 0.3;
        }
        break;
        
      case 'warpCharge':
        length = sampleRate * 2.0; // 2 seconds
        buffer = audioContext.createBuffer(1, length, sampleRate);
        data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const frequency = 100 + t * 200; // Rising frequency
          data[i] = Math.sin(2 * Math.PI * frequency * t) * (1 - Math.exp(-t * 3)) * Math.exp(-t * 0.5) * 0.4;
        }
        break;
        
      case 'warpJump':
        length = sampleRate * 0.8;
        buffer = audioContext.createBuffer(1, length, sampleRate);
        data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const envelope = Math.exp(-t * 4);
          data[i] = (Math.sin(2 * Math.PI * 800 * t) + Math.sin(2 * Math.PI * 1200 * t)) * envelope * 0.3;
        }
        break;
        
      default:
        return null;
    }
    
    return buffer;
  }

  function playSound(type) {
    try {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      if (!audioBuffers[type]) {
        audioBuffers[type] = generateSound(type);
      }
      
      if (audioBuffers[type]) {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffers[type];
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (error) {
      // Silently fail if audio context is not available
    }
  }

  // Combat log system
  function addCombatLogEntry(message, type = 'normal') {
    combatLog.push({
      message,
      type,
      timestamp: Date.now()
    });
    
    // Keep only last 10 entries
    if (combatLog.length > 10) {
      combatLog.shift();
    }
    
    updateCombatLogDisplay();
  }

  function updateCombatLogDisplay() {
    const combatLogEl = document.getElementById('combatLog');
    if (!combatLogEl) return;
    
    combatLogEl.innerHTML = '';
    combatLog.slice(-5).forEach(entry => {
      const logEntry = document.createElement('div');
      logEntry.className = `combat-log-entry ${entry.type}`;
      logEntry.textContent = entry.message;
      combatLogEl.appendChild(logEntry);
    });
    
    // Auto-scroll to bottom
    combatLogEl.scrollTop = combatLogEl.scrollHeight;
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

  // Biome-specific environmental effects
  function drawBiomeEffects(camX, camY) {
    if (!currentSectorData || !currentSectorData.biome) return;
    
    const biomeName = currentSectorData.biome.name;
    const time = performance.now() * 0.001;
    
    switch (biomeName) {
      case 'Nebula':
        // Draw nebula clouds with swirling effect
        ctx.save();
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 5; i++) {
          const angle = time * 0.2 + i * (Math.PI * 2 / 5);
          const radius = 100 + Math.sin(time + i) * 30;
          const x = camX + Math.cos(angle) * radius;
          const y = camY + Math.sin(angle) * radius;
          
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, 80);
          gradient.addColorStop(0, 'rgba(255, 107, 157, 0.4)');
          gradient.addColorStop(1, 'rgba(255, 107, 157, 0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, 80, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
        
      case 'Black Hole Region':
        // Draw gravitational distortion effect
        ctx.save();
        ctx.globalAlpha = 0.6;
        const distortionRadius = 150 + Math.sin(time * 2) * 20;
        const gradient = ctx.createRadialGradient(camX, camY, 0, camX, camY, distortionRadius);
        gradient.addColorStop(0, 'rgba(44, 0, 62, 0.8)');
        gradient.addColorStop(0.7, 'rgba(44, 0, 62, 0.3)');
        gradient.addColorStop(1, 'rgba(44, 0, 62, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(camX, camY, distortionRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
        
      case 'Stellar Nursery':
        // Draw energy wisps and radiation
        ctx.save();
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 8; i++) {
          const angle = time * 0.5 + i * (Math.PI * 2 / 8);
          const radius = 80 + Math.sin(time * 2 + i) * 40;
          const x = camX + Math.cos(angle) * radius;
          const y = camY + Math.sin(angle) * radius;
          
          ctx.fillStyle = '#FFD700';
          ctx.shadowColor = '#FFD700';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
    }
  }

  // Main render loop
  function render() {
    requestAnimationFrame(render);
    updateZoom();
    updateParticles();
    updateProjectiles();
    updateDamageNumbers();
    updateCooldowns();
    
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
    
    // Draw biome-specific environmental effects
    drawBiomeEffects(camX, camY);
    
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
    
    // Draw projectiles
    drawProjectiles();
    
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
    
    // Draw environmental hazards
    if (hazardSystemUI) {
      hazardSystemUI.renderHazards(ctx);
    }
    
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
      
      // Draw health bar
      if (p.health !== undefined && p.shipProperties && p.shipProperties.maxHealth) {
        const healthPercent = p.health / p.shipProperties.maxHealth;
        const barWidth = 40;
        const barHeight = 6;
        const barX = p.x - barWidth / 2;
        const barY = p.y - 50;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        // Health bar
        ctx.fillStyle = healthPercent > 0.5 ? '#28a745' : healthPercent > 0.25 ? '#ffc107' : '#dc3545';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        
        // Health bar border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Health text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.health}/${p.shipProperties.maxHealth}`, p.x, barY - 2);
      }
      
      // Draw targeting indicator
      if (selectedTarget === p.id) {
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const time = performance.now() * 0.005;
        ctx.lineDashOffset = time % 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      
      // Draw weapon range indicator for self
      if (isMe && selectedTarget && shipProperties.weaponRange > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, shipProperties.weaponRange, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      
      // Draw player name
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(isMe ? 'You' : `Player ${p.id.substr(0, 6)}`, p.x, p.y - 65);
      ctx.restore();
    });
    
    // Draw damage numbers
    drawDamageNumbers();
    
    ctx.restore();
    
    // Update minimap
    renderMinimap();
    
    // Update HUD
    updateHUD();
  }

  render();
})();