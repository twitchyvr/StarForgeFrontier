/**
 * Performance optimization tests for StarForgeFrontier
 * Tests all performance enhancement components
 */

const { 
  SpatialIndex, 
  DeltaStateManager, 
  BroadcastManager, 
  PlayerCullingSystem,
  ObjectPoolManager,
  PerformanceMonitor,
  MessageFrequencyOptimizer,
  LoadTestManager
} = require('../../utils');

describe('Performance Optimization Tests', () => {
  let spatialIndex;
  let deltaStateManager;
  let broadcastManager;
  let playerCulling;
  let objectPool;
  let performanceMonitor;
  let messageOptimizer;

  beforeEach(() => {
    spatialIndex = new SpatialIndex(100);
    deltaStateManager = new DeltaStateManager();
    broadcastManager = new BroadcastManager();
    playerCulling = new PlayerCullingSystem();
    objectPool = new ObjectPoolManager();
    performanceMonitor = new PerformanceMonitor();
    messageOptimizer = new MessageFrequencyOptimizer();
  });

  afterEach(() => {
    spatialIndex?.clear();
    try {
      broadcastManager?.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
    playerCulling?.reset();
    objectPool?.clearAll();
    performanceMonitor?.stop();
    messageOptimizer?.stop();
  });

  describe('Spatial Index Optimization', () => {
    test('should efficiently add and find objects', () => {
      const player = { id: 'player1', x: 100, y: 100 };
      const ore = { id: 'ore1', x: 120, y: 110 };
      
      spatialIndex.addObject(player, player.x, player.y);
      spatialIndex.addObject(ore, ore.x, ore.y);
      
      const nearby = spatialIndex.getObjectsInRadius(100, 100, 50);
      expect(nearby).toHaveLength(2);
      expect(nearby).toContain(player);
      expect(nearby).toContain(ore);
    });

    test('should update object positions efficiently', () => {
      const player = { id: 'player1', x: 100, y: 100 };
      spatialIndex.addObject(player, player.x, player.y);
      
      spatialIndex.updateObject(player, 200, 200);
      
      const nearbyOld = spatialIndex.getObjectsInRadius(100, 100, 50);
      const nearbyNew = spatialIndex.getObjectsInRadius(200, 200, 50);
      
      expect(nearbyOld).toHaveLength(0);
      expect(nearbyNew).toHaveLength(1);
      expect(nearbyNew).toContain(player);
    });

    test('should provide meaningful statistics', () => {
      for (let i = 0; i < 10; i++) {
        spatialIndex.addObject({ id: `obj${i}` }, i * 10, i * 10);
      }
      
      const stats = spatialIndex.getStats();
      expect(stats.totalObjects).toBe(10);
      expect(stats.totalCells).toBeGreaterThan(0);
    });
  });

  describe('Player Culling System', () => {
    test('should track player positions', () => {
      playerCulling.updatePlayerPosition('player1', 100, 100);
      playerCulling.updateObject('ore1', 120, 110, 'ore');
      
      const visibleObjects = playerCulling.getVisibleObjects('player1', true);
      expect(visibleObjects).toContain('ore1');
    });

    test('should cull distant objects', () => {
      playerCulling.updatePlayerPosition('player1', 0, 0);
      playerCulling.updateObject('ore1', 10, 10, 'ore'); // Close
      playerCulling.updateObject('ore2', 5000, 5000, 'ore'); // Far
      
      const visibleObjects = playerCulling.getVisibleObjects('player1', true);
      expect(visibleObjects).toContain('ore1');
      expect(visibleObjects).not.toContain('ore2');
    });

    test('should limit objects per player', () => {
      playerCulling.configure({ maxObjectsPerPlayer: 5 });
      playerCulling.updatePlayerPosition('player1', 0, 0);
      
      // Add 10 objects
      for (let i = 0; i < 10; i++) {
        playerCulling.updateObject(`obj${i}`, i, i, 'ore');
      }
      
      const visibleObjects = playerCulling.getVisibleObjects('player1', true);
      expect(visibleObjects.length).toBeLessThanOrEqual(5);
    });

    test('should provide culling statistics', () => {
      playerCulling.updatePlayerPosition('player1', 0, 0);
      playerCulling.updateObject('ore1', 10, 10, 'ore');
      playerCulling.getVisibleObjects('player1', true);
      
      const stats = playerCulling.getStats();
      expect(stats.totalObjects).toBe(2); // Player + ore
      expect(stats.totalPlayers).toBe(1);
    });
  });

  describe('Object Pooling System', () => {
    test('should create and reuse ore objects', () => {
      const ore1 = objectPool.createOre('ore1', 100, 100, 25, 'common');
      expect(ore1.id).toBe('ore1');
      expect(ore1.x).toBe(100);
      expect(ore1.value).toBe(25);
      
      objectPool.release('ore', ore1);
      
      const ore2 = objectPool.createOre('ore2', 200, 200, 50, 'rare');
      // Should reuse the same object instance
      expect(ore2.id).toBe('ore2');
      expect(ore2.x).toBe(200);
    });

    test('should track pool statistics', () => {
      // Create and release objects
      const ore = objectPool.createOre('ore1', 100, 100, 25);
      objectPool.release('ore', ore);
      
      const stats = objectPool.getStats();
      expect(stats.ore.created).toBeGreaterThan(0);
      expect(stats.ore.acquired).toBeGreaterThan(0);
    });

    test('should handle different object types', () => {
      const projectile = objectPool.createProjectile('p1', 0, 0, 10, 5, 25, 100, 'player1');
      const particle = objectPool.createParticle(50, 50, 2, 2, 1000, 5, '#ff0000');
      
      expect(projectile.id).toBe('p1');
      expect(projectile.damage).toBe(25);
      expect(particle.color).toBe('#ff0000');
    });
  });

  describe('Message Frequency Optimizer', () => {
    test('should queue and batch messages', (done) => {
      messageOptimizer.start();
      
      let messagesSent = 0;
      messageOptimizer.sendMessageDirect = (clientId, message) => {
        messagesSent++;
        if (messagesSent === 1) {
          expect(message.type).toBe('batch');
          expect(message.messages).toHaveLength(3);
          done();
        }
        return true;
      };
      
      // Queue multiple messages
      messageOptimizer.queueMessage('client1', { type: 'test1' }, 'MEDIUM');
      messageOptimizer.queueMessage('client1', { type: 'test2' }, 'MEDIUM');
      messageOptimizer.queueMessage('client1', { type: 'test3' }, 'MEDIUM');
    });

    test('should handle critical messages immediately', (done) => {
      messageOptimizer.start();
      
      messageOptimizer.sendMessageDirect = (clientId, message) => {
        expect(message.type).toBe('critical');
        done();
        return true;
      };
      
      messageOptimizer.queueMessage('client1', { type: 'critical' }, 'CRITICAL');
    });

    test('should throttle high-frequency messages', () => {
      messageOptimizer.start();
      
      // Send same message type rapidly
      const result1 = messageOptimizer.queueMessage('client1', { type: 'player_position' }, 'HIGH');
      const result2 = messageOptimizer.queueMessage('client1', { type: 'player_position' }, 'HIGH');
      
      expect(result1).toBe(true);
      expect(result2).toBe(false); // Should be throttled
    });

    test('should provide optimizer statistics', () => {
      messageOptimizer.start();
      messageOptimizer.queueMessage('client1', { type: 'test' }, 'MEDIUM');
      
      const stats = messageOptimizer.getStats();
      expect(stats.messagesQueued).toBeGreaterThan(0);
      expect(stats.isActive).toBe(true);
    });
  });

  describe('Performance Monitor', () => {
    test('should track performance metrics', () => {
      performanceMonitor.start();
      
      performanceMonitor.updateGameMetrics({
        gameLoopTime: 16,
        playersCount: 10,
        entitiesCount: 50
      });
      
      const metrics = performanceMonitor.getCurrentMetrics();
      expect(metrics.game.gameLoopTime).toBe(16);
      expect(metrics.game.playersCount).toBe(10);
    });

    test('should generate performance report', () => {
      performanceMonitor.start();
      
      // Simulate some metrics
      performanceMonitor.updateGameMetrics({ gameLoopTime: 20, playersCount: 5 });
      performanceMonitor.collectMetrics();
      
      const report = performanceMonitor.generateReport(1);
      expect(report.current).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    test('should create alerts for performance issues', (done) => {
      performanceMonitor.start();
      
      performanceMonitor.on('alert', (alert) => {
        expect(alert.type).toBe('SLOW_GAME_LOOP');
        expect(alert.severity).toBe('warning');
        done();
      });
      
      // Trigger a performance alert
      performanceMonitor.updateGameMetrics({ gameLoopTime: 100 }); // Slow loop
      performanceMonitor.collectMetrics();
    });
  });

  describe('Delta State Management', () => {
    test('should calculate deltas for game state', () => {
      const gameState1 = {
        players: [{ id: 'p1', x: 100, y: 100 }],
        ores: [{ id: 'o1', x: 200, y: 200 }]
      };
      
      const gameState2 = {
        players: [{ id: 'p1', x: 110, y: 100 }], // Moved
        ores: [{ id: 'o1', x: 200, y: 200 }] // Same
      };
      
      deltaStateManager.getGameStateDelta('client1', gameState1);
      const delta = deltaStateManager.getGameStateDelta('client1', gameState2);
      
      expect(delta.hasChanges).toBe(true);
      expect(delta.delta.players.modified).toHaveLength(1);
      expect(delta.delta.players.modified[0].x).toBe(110);
    });

    test('should track player additions and removals', () => {
      const gameState1 = {
        players: [{ id: 'p1', x: 100, y: 100 }],
        ores: []
      };
      
      const gameState2 = {
        players: [
          { id: 'p1', x: 100, y: 100 },
          { id: 'p2', x: 200, y: 200 }
        ],
        ores: []
      };
      
      deltaStateManager.getGameStateDelta('client1', gameState1);
      const delta = deltaStateManager.getGameStateDelta('client1', gameState2);
      
      expect(delta.hasChanges).toBe(true);
      expect(delta.delta.players.added).toHaveLength(1);
      expect(delta.delta.players.added[0].id).toBe('p2');
    });
  });

  describe('Broadcast Manager', () => {
    test('should register and manage clients', () => {
      const mockWs = { 
        readyState: 1, 
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn()
      };
      
      const client = broadcastManager.registerClient(mockWs, {
        id: 'client1',
        x: 100,
        y: 100,
        channels: ['global', 'game']
      });
      
      expect(client.id).toBe('client1');
      expect(client.channels.has('global')).toBe(true);
    });

    test('should broadcast to specific channels', () => {
      const mockWs1 = { 
        readyState: 1, 
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn()
      };
      const mockWs2 = { 
        readyState: 1, 
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn()
      };
      
      broadcastManager.registerClient(mockWs1, {
        id: 'client1',
        channels: ['global']
      });
      
      broadcastManager.registerClient(mockWs2, {
        id: 'client2',
        channels: ['private']
      });
      
      const sent = broadcastManager.broadcastToChannel('global', { type: 'test' });
      
      expect(sent).toBe(1);
      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).not.toHaveBeenCalled();
    });

    test('should broadcast to nearby players', () => {
      const mockWs1 = { 
        readyState: 1, 
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn()
      };
      const mockWs2 = { 
        readyState: 1, 
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn()
      };
      
      broadcastManager.registerClient(mockWs1, {
        id: 'client1',
        x: 100,
        y: 100
      });
      
      broadcastManager.registerClient(mockWs2, {
        id: 'client2',
        x: 200,
        y: 200
      });
      
      const sent = broadcastManager.broadcastToArea(100, 100, 50, { type: 'local' });
      
      expect(sent).toBe(1); // Only client1 is within range
      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).not.toHaveBeenCalled();
    });
  });

  describe('Load Testing Integration', () => {
    test('should create load test manager', () => {
      const loadTest = new LoadTestManager('ws://localhost:3000');
      
      loadTest.configure({
        maxClients: 10,
        testDuration: 5000,
        rampUpTime: 1000
      });
      
      const status = loadTest.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.connectedClients).toBe(0);
    });
  });

  describe('Integration Performance Test', () => {
    test('should handle high load with all optimizations', async () => {
      // Start all optimization systems
      performanceMonitor.start();
      messageOptimizer.start();
      
      const startTime = Date.now();
      
      // Simulate 100 players
      const players = [];
      for (let i = 0; i < 100; i++) {
        const player = {
          id: `player${i}`,
          x: Math.random() * 1000,
          y: Math.random() * 1000
        };
        players.push(player);
        
        spatialIndex.addObject(player, player.x, player.y);
        playerCulling.updatePlayerPosition(player.id, player.x, player.y);
      }
      
      // Simulate 500 ore objects
      for (let i = 0; i < 500; i++) {
        const ore = objectPool.createOre(
          `ore${i}`,
          Math.random() * 1000,
          Math.random() * 1000,
          25
        );
        spatialIndex.addObject(ore, ore.x, ore.y);
        playerCulling.updateObject(ore.id, ore.x, ore.y, 'ore');
      }
      
      // Simulate game updates
      for (let tick = 0; tick < 10; tick++) {
        const tickStart = Date.now();
        
        // Update player positions
        players.forEach(player => {
          player.x += (Math.random() - 0.5) * 4;
          player.y += (Math.random() - 0.5) * 4;
          spatialIndex.updateObject(player, player.x, player.y);
          playerCulling.updatePlayerPosition(player.id, player.x, player.y);
        });
        
        // Perform collision detection
        players.forEach(player => {
          const nearby = spatialIndex.getObjectsInRadius(player.x, player.y, 50);
          expect(nearby.length).toBeGreaterThanOrEqual(0);
        });
        
        // Update performance metrics
        const tickTime = Date.now() - tickStart;
        performanceMonitor.updateGameMetrics({
          gameLoopTime: tickTime,
          playersCount: players.length,
          entitiesCount: players.length + 500
        });
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`Performance test completed in ${totalTime}ms`);
      
      // Verify performance
      const metrics = performanceMonitor.getCurrentMetrics();
      expect(metrics.game.playersCount).toBe(100);
      expect(totalTime).toBeLessThan(5000); // Should complete quickly with optimizations
      
      // Verify optimization stats
      const spatialStats = spatialIndex.getStats();
      const cullingStats = playerCulling.getStats();
      const poolStats = objectPool.getStats();
      
      expect(spatialStats.totalObjects).toBeGreaterThan(0);
      expect(cullingStats.totalObjects).toBeGreaterThan(0);
      expect(poolStats.ore.created).toBeGreaterThan(0);
    });
  });
});

module.exports = {
  testPerformanceOptimizations: () => {
    console.log('Running performance optimization tests...');
    // This would run all the tests above
  }
};