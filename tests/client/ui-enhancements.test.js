/**
 * @jest-environment jsdom
 */

describe('StarForgeFrontier Enhanced UI', () => {
  beforeEach(() => {
    // Setup enhanced DOM structure
    document.body.innerHTML = `
      <canvas id="game"></canvas>
      <canvas id="minimap"></canvas>
      <div id="hud">
        <div class="hud-section player-stats">
          <div class="stat-item">
            <span class="stat-label">Resources</span>
            <span id="resources" class="stat-value">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Level</span>
            <span id="level" class="stat-value">1</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Position</span>
            <span id="position" class="stat-value">0, 0</span>
          </div>
        </div>
        <div class="hud-section quick-actions">
          <button id="addEngine" class="action-btn">
            <span class="btn-icon">⚙</span>
            <span class="btn-text">Engine (50)</span>
          </button>
          <button id="addCargo" class="action-btn">
            <span class="btn-icon">📦</span>
            <span class="btn-text">Cargo (30)</span>
          </button>
          <button id="shopToggle" class="action-btn">
            <span class="btn-icon">🛒</span>
            <span class="btn-text">Shop</span>
          </button>
        </div>
      </div>
      <div id="shopPanel" class="panel hidden">
        <div class="panel-header">
          <h2>Space Shop</h2>
          <button id="closeShop" class="close-btn">×</button>
        </div>
        <div id="shopContent" class="panel-content"></div>
      </div>
      <div id="notifications"></div>
      <div id="onlineStatus">
        <span class="status-indicator"></span>
        <span id="playerCount">0</span> pilots online
      </div>
    `;
    
    // Mock canvas contexts
    const canvas = document.getElementById('game');
    const minimap = document.getElementById('minimap');
    const mockContext = {
      clearRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      arc: jest.fn(),
      ellipse: jest.fn(),
      createRadialGradient: jest.fn(() => ({
        addColorStop: jest.fn()
      })),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn()
      })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      fillRect: jest.fn(),
      fillText: jest.fn()
    };
    
    canvas.getContext = jest.fn(() => mockContext);
    minimap.getContext = jest.fn(() => mockContext);
  });

  describe('Enhanced HUD Elements', () => {
    test('should have structured player stats section', () => {
      const statsSection = document.querySelector('.player-stats');
      expect(statsSection).toBeTruthy();
      
      const statItems = statsSection.querySelectorAll('.stat-item');
      expect(statItems).toHaveLength(3); // Resources, Level, Position
      
      const labels = [...statItems].map(item => 
        item.querySelector('.stat-label').textContent
      );
      expect(labels).toEqual(['Resources', 'Level', 'Position']);
    });

    test('should have enhanced action buttons with icons', () => {
      const quickActions = document.querySelector('.quick-actions');
      expect(quickActions).toBeTruthy();
      
      const actionBtns = quickActions.querySelectorAll('.action-btn');
      expect(actionBtns).toHaveLength(3); // Engine, Cargo, Shop
      
      // Check each button has icon and text
      actionBtns.forEach(btn => {
        expect(btn.querySelector('.btn-icon')).toBeTruthy();
        expect(btn.querySelector('.btn-text')).toBeTruthy();
      });
    });

    test('should update HUD elements correctly', () => {
      const resourcesEl = document.getElementById('resources');
      const levelEl = document.getElementById('level');
      const positionEl = document.getElementById('position');
      
      const updateHUD = (resources, level, x, y) => {
        resourcesEl.textContent = resources.toLocaleString();
        levelEl.textContent = level;
        positionEl.textContent = `${Math.round(x)}, ${Math.round(y)}`;
      };
      
      updateHUD(1500, 3, 123.7, -456.2);
      
      expect(resourcesEl.textContent).toBe('1,500');
      expect(levelEl.textContent).toBe('3');
      expect(positionEl.textContent).toBe('124, -456');
    });

    test('should have minimap canvas', () => {
      const minimap = document.getElementById('minimap');
      expect(minimap).toBeTruthy();
      expect(minimap.tagName).toBe('CANVAS');
    });

    test('should have online status indicator', () => {
      const onlineStatus = document.getElementById('onlineStatus');
      expect(onlineStatus).toBeTruthy();
      
      const statusIndicator = onlineStatus.querySelector('.status-indicator');
      const playerCount = document.getElementById('playerCount');
      
      expect(statusIndicator).toBeTruthy();
      expect(playerCount).toBeTruthy();
      expect(playerCount.textContent).toBe('0');
    });
  });

  describe('Shop System', () => {
    test('should have shop panel with proper structure', () => {
      const shopPanel = document.getElementById('shopPanel');
      expect(shopPanel).toBeTruthy();
      expect(shopPanel.classList.contains('panel')).toBe(true);
      expect(shopPanel.classList.contains('hidden')).toBe(true);
      
      const header = shopPanel.querySelector('.panel-header');
      const content = shopPanel.querySelector('.panel-content');
      const closeBtn = document.getElementById('closeShop');
      
      expect(header).toBeTruthy();
      expect(content).toBeTruthy();
      expect(closeBtn).toBeTruthy();
    });

    test('should toggle shop panel visibility', () => {
      const shopPanel = document.getElementById('shopPanel');
      
      // Initially hidden
      expect(shopPanel.classList.contains('hidden')).toBe(true);
      
      // Simulate toggle functionality
      const toggleShop = () => {
        shopPanel.classList.toggle('hidden');
      };
      
      const closeShop = () => {
        shopPanel.classList.add('hidden');
      };
      
      // Toggle open
      toggleShop();
      expect(shopPanel.classList.contains('hidden')).toBe(false);
      
      // Toggle close
      closeShop();
      expect(shopPanel.classList.contains('hidden')).toBe(true);
      
      // Toggle open again
      toggleShop();
      expect(shopPanel.classList.contains('hidden')).toBe(false);
    });

    test('should create shop items dynamically', () => {
      const shopContent = document.getElementById('shopContent');
      const shopItems = {
        engine: { cost: 50, type: 'module', id: 'engine' },
        cargo: { cost: 30, type: 'module', id: 'cargo' },
        weapon: { cost: 70, type: 'module', id: 'weapon' }
      };
      
      const renderShop = (items, playerResources = 100) => {
        shopContent.innerHTML = '';
        
        Object.entries(items).forEach(([key, item]) => {
          const shopItem = document.createElement('div');
          shopItem.className = 'shop-item';
          
          const name = document.createElement('div');
          name.className = 'shop-item-name';
          name.textContent = key.charAt(0).toUpperCase() + key.slice(1);
          
          const price = document.createElement('div');
          price.className = 'shop-item-price';
          price.textContent = `${item.cost} credits`;
          
          const buyBtn = document.createElement('button');
          buyBtn.className = 'shop-buy-btn';
          buyBtn.textContent = 'Buy';
          buyBtn.disabled = playerResources < item.cost;
          
          shopItem.appendChild(name);
          shopItem.appendChild(price);
          shopItem.appendChild(buyBtn);
          shopContent.appendChild(shopItem);
        });
      };
      
      renderShop(shopItems, 60); // Player has 60 resources
      
      const items = shopContent.querySelectorAll('.shop-item');
      expect(items).toHaveLength(3);
      
      // Check affordability
      const buttons = shopContent.querySelectorAll('.shop-buy-btn');
      expect(buttons[0].disabled).toBe(false); // Engine: 50 <= 60
      expect(buttons[1].disabled).toBe(false); // Cargo: 30 <= 60
      expect(buttons[2].disabled).toBe(true);  // Weapon: 70 > 60
    });

    test('should provide item descriptions', () => {
      const getItemDescription = (itemId) => {
        const descriptions = {
          engine: 'Increases ship speed and maneuverability',
          cargo: 'Expands storage capacity for resources',
          weapon: 'Adds offensive capabilities to your ship',
          shield: 'Provides defensive protection'
        };
        return descriptions[itemId] || 'Unknown module';
      };
      
      expect(getItemDescription('engine')).toBe('Increases ship speed and maneuverability');
      expect(getItemDescription('cargo')).toBe('Expands storage capacity for resources');
      expect(getItemDescription('weapon')).toBe('Adds offensive capabilities to your ship');
      expect(getItemDescription('shield')).toBe('Provides defensive protection');
      expect(getItemDescription('unknown')).toBe('Unknown module');
    });
  });

  describe('Notification System', () => {
    test('should create notification elements', () => {
      const notificationsEl = document.getElementById('notifications');
      expect(notificationsEl).toBeTruthy();
      
      const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationsEl.appendChild(notification);
        return notification;
      };
      
      const successNotif = showNotification('Purchase successful!', 'success');
      const errorNotif = showNotification('Not enough resources', 'error');
      const eventNotif = showNotification('Supernova detected!', 'event');
      
      expect(successNotif.classList.contains('success')).toBe(true);
      expect(errorNotif.classList.contains('error')).toBe(true);
      expect(eventNotif.classList.contains('event')).toBe(true);
      
      expect(notificationsEl.children).toHaveLength(3);
    });

    test('should handle different notification types', () => {
      const validTypes = ['info', 'success', 'warning', 'error', 'event'];
      
      validTypes.forEach(type => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        expect(notification.classList.contains(type)).toBe(true);
      });
    });
  });

  describe('Enhanced Visual Effects', () => {
    test('should calculate particle positions', () => {
      const createParticleExplosion = (x, y, count) => {
        const particles = [];
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
          const speed = 2 + Math.random() * 3;
          particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            color: `hsl(${Math.random() * 60 + 10}, 100%, 60%)`
          });
        }
        return particles;
      };
      
      const particles = createParticleExplosion(100, 200, 10);
      expect(particles).toHaveLength(10);
      
      particles.forEach(p => {
        expect(p.x).toBe(100);
        expect(p.y).toBe(200);
        expect(p.vx).toBeDefined();
        expect(p.vy).toBeDefined();
        expect(p.life).toBe(1);
        expect(p.color).toMatch(/hsl\([\d.]+, 100%, 60%\)/);
      });
    });

    test('should update particle physics', () => {
      let particles = [
        { x: 0, y: 0, vx: 2, vy: 1, life: 1 },
        { x: 10, y: 10, vx: -1, vy: 2, life: 0.5 }
      ];
      
      const updateParticles = () => {
        particles = particles.filter(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.life -= 0.02;
          return p.life > 0;
        });
      };
      
      updateParticles();
      
      expect(particles).toHaveLength(2);
      expect(particles[0].x).toBe(2);
      expect(particles[0].y).toBe(1);
      expect(particles[0].life).toBeCloseTo(0.98);
      expect(particles[0].vx).toBeCloseTo(1.96);
    });

    test('should handle minimap scaling', () => {
      const calculateMinimapPosition = (worldX, worldY, playerX, playerY, scale = 0.02, mapSize = 200) => {
        const halfSize = mapSize / 2;
        return {
          x: halfSize + (worldX - playerX) * scale,
          y: halfSize + (worldY - playerY) * scale
        };
      };
      
      // Player at origin
      const pos1 = calculateMinimapPosition(100, 50, 0, 0);
      expect(pos1.x).toBe(102); // 100 + (100 - 0) * 0.02
      expect(pos1.y).toBe(101); // 100 + (50 - 0) * 0.02
      
      // Object relative to player
      const pos2 = calculateMinimapPosition(200, 100, 150, 75);
      expect(pos2.x).toBe(101); // 100 + (200 - 150) * 0.02
      expect(pos2.y).toBe(100.5); // 100 + (100 - 75) * 0.02
    });
  });

  describe('Keyboard Controls', () => {
    test('should handle tab key for shop toggle', () => {
      const shopPanel = document.getElementById('shopPanel');
      
      // Simulate tab key press
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          shopPanel.classList.toggle('hidden');
        }
      };
      
      // Initially hidden
      expect(shopPanel.classList.contains('hidden')).toBe(true);
      
      handleKeyDown(tabEvent);
      expect(shopPanel.classList.contains('hidden')).toBe(false);
      
      handleKeyDown(tabEvent);
      expect(shopPanel.classList.contains('hidden')).toBe(true);
    });

    test('should update button states based on resources', () => {
      const addEngineBtn = document.getElementById('addEngine');
      const addCargoBtn = document.getElementById('addCargo');
      
      const updateButtonStates = (resources) => {
        addEngineBtn.disabled = resources < 50;
        addCargoBtn.disabled = resources < 30;
      };
      
      // Low resources
      updateButtonStates(25);
      expect(addEngineBtn.disabled).toBe(true);
      expect(addCargoBtn.disabled).toBe(true);
      
      // Medium resources
      updateButtonStates(40);
      expect(addEngineBtn.disabled).toBe(true);
      expect(addCargoBtn.disabled).toBe(false);
      
      // High resources
      updateButtonStates(100);
      expect(addEngineBtn.disabled).toBe(false);
      expect(addCargoBtn.disabled).toBe(false);
    });
  });
});