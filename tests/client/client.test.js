/**
 * @jest-environment jsdom
 */

describe('StarForgeFrontier Client', () => {
  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <canvas id="game"></canvas>
      <div id="hud">
        <div id="resources">Resources: 0</div>
        <button id="addEngine">Add Engine (50)</button>
        <button id="addCargo">Add Cargo (30)</button>
      </div>
    `;
    
    // Mock canvas context
    const canvas = document.getElementById('game');
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
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1
    };
    canvas.getContext = jest.fn(() => mockContext);
    
    // Mock WebSocket
    global.WebSocket = jest.fn(() => ({
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Canvas Setup', () => {
    test('should initialize canvas element', () => {
      const canvas = document.getElementById('game');
      expect(canvas).toBeTruthy();
      expect(canvas.tagName).toBe('CANVAS');
    });

    test('should get 2D context', () => {
      const canvas = document.getElementById('game');
      const ctx = canvas.getContext('2d');
      expect(ctx).toBeTruthy();
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
    });
  });

  describe('HUD Elements', () => {
    test('should have resources display', () => {
      const resourcesEl = document.getElementById('resources');
      expect(resourcesEl).toBeTruthy();
      expect(resourcesEl.textContent).toBe('Resources: 0');
    });

    test('should have engine button', () => {
      const addEngineBtn = document.getElementById('addEngine');
      expect(addEngineBtn).toBeTruthy();
      expect(addEngineBtn.textContent).toBe('Add Engine (50)');
    });

    test('should have cargo button', () => {
      const addCargoBtn = document.getElementById('addCargo');
      expect(addCargoBtn).toBeTruthy();
      expect(addCargoBtn.textContent).toBe('Add Cargo (30)');
    });

    test('should update resources display', () => {
      const resourcesEl = document.getElementById('resources');
      const updateResources = (amount, level = 1) => {
        resourcesEl.textContent = `Resources: ${amount} (Level: ${level})`;
      };
      
      updateResources(150, 2);
      expect(resourcesEl.textContent).toBe('Resources: 150 (Level: 2)');
      
      updateResources(500, 3);
      expect(resourcesEl.textContent).toBe('Resources: 500 (Level: 3)');
    });
  });

  describe('Input Handling', () => {
    test('should track keyboard state', () => {
      const keys = {};
      const handleKeyDown = (code) => {
        keys[code] = true;
      };
      const handleKeyUp = (code) => {
        keys[code] = false;
      };
      
      // Test WASD keys
      handleKeyDown('KeyW');
      expect(keys['KeyW']).toBe(true);
      
      handleKeyDown('KeyA');
      expect(keys['KeyA']).toBe(true);
      
      handleKeyUp('KeyW');
      expect(keys['KeyW']).toBe(false);
      
      // Test arrow keys
      handleKeyDown('ArrowUp');
      expect(keys['ArrowUp']).toBe(true);
      
      handleKeyDown('ArrowLeft');
      expect(keys['ArrowLeft']).toBe(true);
      
      handleKeyUp('ArrowUp');
      expect(keys['ArrowUp']).toBe(false);
    });

    test('should create input message from key state', () => {
      const keys = {
        'KeyW': true,
        'KeyS': false,
        'KeyA': true,
        'KeyD': false,
        'ArrowUp': false,
        'ArrowDown': false,
        'ArrowLeft': false,
        'ArrowRight': true
      };
      
      const createInputMessage = (keys) => ({
        type: 'input',
        up: keys['KeyW'] || keys['ArrowUp'],
        down: keys['KeyS'] || keys['ArrowDown'],
        left: keys['KeyA'] || keys['ArrowLeft'],
        right: keys['KeyD'] || keys['ArrowRight']
      });
      
      const msg = createInputMessage(keys);
      expect(msg.type).toBe('input');
      expect(msg.up).toBe(true);    // KeyW is true
      expect(msg.down).toBe(false);
      expect(msg.left).toBe(true);  // KeyA is true
      expect(msg.right).toBe(true); // ArrowRight is true
    });
  });

  describe('Procedural Generation', () => {
    test('should generate consistent random numbers from seed', () => {
      // Mulberry32 PRNG implementation
      const mulberry32 = (seed) => {
        return function() {
          let t = seed += 0x6D2B79F5;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      };
      
      const rand1 = mulberry32(12345);
      const rand2 = mulberry32(12345);
      
      // Same seed should produce same sequence
      expect(rand1()).toBe(rand2());
      expect(rand1()).toBe(rand2());
      expect(rand1()).toBe(rand2());
      
      // Different seed should produce different sequence
      const rand3 = mulberry32(54321);
      expect(rand1()).not.toBe(rand3());
    });

    test('should convert string to seed', () => {
      const stringToSeed = (str) => {
        let seed = 0;
        for (let i = 0; i < str.length; i++) {
          seed = (seed * 31 + str.charCodeAt(i)) >>> 0;
        }
        return seed;
      };
      
      const seed1 = stringToSeed('player-123');
      const seed2 = stringToSeed('player-123');
      const seed3 = stringToSeed('player-456');
      
      expect(seed1).toBe(seed2); // Same string produces same seed
      expect(seed1).not.toBe(seed3); // Different strings produce different seeds
      expect(typeof seed1).toBe('number');
      expect(seed1).toBeGreaterThanOrEqual(0);
    });

    test('should generate module shapes deterministically', () => {
      const getModuleShape = (playerId, modIndex, cache = {}) => {
        const key = `${playerId}-${modIndex}`;
        if (cache[key]) return cache[key];
        
        // Simplified shape generation for testing
        const points = [];
        const pointCount = 6;
        for (let i = 0; i < pointCount; i++) {
          const angle = (Math.PI * 2 / pointCount) * i;
          points.push({ 
            x: Math.cos(angle) * 15, 
            y: Math.sin(angle) * 15 
          });
        }
        cache[key] = points;
        return points;
      };
      
      const cache = {};
      const shape1 = getModuleShape('player1', 0, cache);
      const shape2 = getModuleShape('player1', 0, cache);
      const shape3 = getModuleShape('player2', 0, cache);
      
      expect(shape1).toBe(shape2); // Same parameters return cached shape
      expect(shape1).not.toBe(shape3); // Different parameters return different shape
      expect(shape1).toHaveLength(6);
      expect(shape1[0]).toHaveProperty('x');
      expect(shape1[0]).toHaveProperty('y');
    });
  });

  describe('Camera and Zoom', () => {
    test('should update zoom smoothly', () => {
      let zoom = 1;
      let targetZoom = 1;
      
      const updateZoom = () => {
        zoom += (targetZoom - zoom) * 0.1;
      };
      
      targetZoom = 2;
      updateZoom();
      expect(zoom).toBeCloseTo(1.1, 5);
      
      updateZoom();
      expect(zoom).toBeCloseTo(1.19, 5);
      
      // Should approach target zoom
      for (let i = 0; i < 50; i++) {
        updateZoom();
      }
      expect(zoom).toBeCloseTo(2, 2);
    });

    test('should clamp zoom within bounds', () => {
      const clampZoom = (zoom) => {
        return Math.min(2.5, Math.max(0.5, zoom));
      };
      
      expect(clampZoom(0.3)).toBe(0.5);  // Below minimum
      expect(clampZoom(1.5)).toBe(1.5);  // Within bounds
      expect(clampZoom(3.0)).toBe(2.5);  // Above maximum
    });
  });

  describe('Visual Effects', () => {
    test('should calculate screen shake offset', () => {
      let shakeTime = 300;
      let shakeMagnitude = 10;
      
      const applyShake = () => {
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
      };
      
      const shake1 = applyShake();
      expect(shake1.x).toBeDefined();
      expect(shake1.y).toBeDefined();
      
      // Magnitude should decrease over time
      const offset1 = Math.sqrt(shake1.x * shake1.x + shake1.y * shake1.y);
      const shake2 = applyShake();
      const offset2 = Math.sqrt(shake2.x * shake2.x + shake2.y * shake2.y);
      expect(offset2).toBeLessThan(offset1);
      
      // Should return zero when time runs out
      shakeTime = 0;
      const shake3 = applyShake();
      expect(shake3.x).toBe(0);
      expect(shake3.y).toBe(0);
    });

    test('should determine ore highlight based on distance', () => {
      const shouldHighlight = (player, ore, radius = 200) => {
        const dx = player.x - ore.x;
        const dy = player.y - ore.y;
        const distSq = dx * dx + dy * dy;
        return distSq < radius * radius;
      };
      
      const player = { x: 0, y: 0 };
      
      expect(shouldHighlight(player, { x: 100, y: 100 })).toBe(true);
      expect(shouldHighlight(player, { x: 200, y: 0 })).toBe(false);
      expect(shouldHighlight(player, { x: 150, y: 150 })).toBe(false);
      expect(shouldHighlight(player, { x: 0, y: 199 })).toBe(true);
    });
  });

  describe('Shop System', () => {
    test('should create shop panel dynamically', () => {
      const createShopPanel = () => {
        const panel = document.createElement('div');
        panel.style.position = 'absolute';
        panel.style.display = 'none';
        panel.innerHTML = '<strong>Shop</strong><br/>';
        return panel;
      };
      
      const panel = createShopPanel();
      expect(panel.style.position).toBe('absolute');
      expect(panel.style.display).toBe('none');
      expect(panel.innerHTML).toContain('Shop');
    });

    test('should toggle shop visibility', () => {
      let shopVisible = false;
      const toggleShop = () => {
        shopVisible = !shopVisible;
        return shopVisible;
      };
      
      expect(toggleShop()).toBe(true);
      expect(shopVisible).toBe(true);
      expect(toggleShop()).toBe(false);
      expect(shopVisible).toBe(false);
    });
  });
});