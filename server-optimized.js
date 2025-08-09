/*
 * Optimized StarForgeFrontier server with performance enhancements
 * 
 * This optimized version includes:
 * - Spatial indexing for efficient collision detection
 * - Delta state management for reduced network traffic
 * - Database connection pooling and query optimization
 * - Selective broadcast manager for targeted message distribution
 * - Worker threads for physics calculations
 * - All original features maintained for backward compatibility
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Import optimization utilities
const SpatialIndex = require('./utils/spatial-index');
const DeltaStateManager = require('./utils/delta-state');
const DatabasePool = require('./utils/database-pool');
const BroadcastManager = require('./utils/broadcast-manager');
const PhysicsWorkerManager = require('./utils/physics-worker');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Enable JSON parsing for authentication endpoints
app.use(express.json());
app.use(express.static('public'));

// Initialize optimized components
const spatialIndex = new SpatialIndex(100); // 100 unit grid cells
const deltaStateManager = new DeltaStateManager();
const broadcastManager = new BroadcastManager();
const physicsWorkers = new PhysicsWorkerManager(2); // 2 worker threads

// Initialize enhanced database with connection pooling
const db = new DatabasePool({
  poolSize: 5,
  maxRetries: 3,
  queryTimeout: 10000,
  cacheMaxSize: 200,
  cacheMaxAge: 300000 // 5 minutes
});

// Game state
const activePlayers = new Map(); // WebSocket connections
const playerSessions = new Map(); // Game session tracking
let ores = [];
let events = [];

// Game constants
const STARTING_RESOURCES = 100;
const ORE_VALUE = 25;
const BASE_SPEED = 2.0;
const BASE_CARGO_CAPACITY = 1000;
const BASE_COLLECTION_RANGE = 40;

const ITEMS = {
  engine: { cost: 50, type: 'module', id: 'engine' },
  cargo:  { cost: 30, type: 'module', id: 'cargo' },
  weapon: { cost: 70, type: 'module', id: 'weapon' },
  shield: { cost: 60, type: 'module', id: 'shield' }
};

// Component effect definitions
const COMPONENT_EFFECTS = {
  engine: {
    speedMultiplier: 0.3,
    accelerationBonus: 0.2
  },
  cargo: {
    capacityBonus: 500,
    efficiencyBonus: 0.1
  },
  weapon: {
    damageBonus: 25,
    rangeBonus: 10
  },
  shield: {
    healthBonus: 100,
    regenBonus: 2
  }
};

// Achievement definitions
const ACHIEVEMENTS = {
  FIRST_STEPS: { type: 'movement', name: 'First Steps', desc: 'Move your ship for the first time', threshold: 1 },
  COLLECTOR: { type: 'resources', name: 'Collector', desc: 'Collect 100 resources', threshold: 100 },
  BUILDER: { type: 'modules', name: 'Builder', desc: 'Add your first module', threshold: 1 },
  EXPLORER: { type: 'distance', name: 'Explorer', desc: 'Travel 1000 units', threshold: 1000 },
  WEALTHY: { type: 'resources', name: 'Wealthy', desc: 'Accumulate 500 resources', threshold: 500 },
  ENGINEER: { type: 'modules', name: 'Engineer', desc: 'Build 5 modules', threshold: 5 }
};

// Performance monitoring
let performanceMetrics = {
  lastGameLoopTime: 0,
  averageGameLoopTime: 0,
  gameLoopCount: 0,
  physicsCalculationTime: 0,
  broadcastTime: 0,
  databaseOperationTime: 0
};

// Calculate ship properties (unchanged for compatibility)
function calculateShipProperties(player) {
  if (!player.modules || player.modules.length === 0) {
    return {
      speed: BASE_SPEED,
      cargoCapacity: BASE_CARGO_CAPACITY,
      collectionRange: BASE_COLLECTION_RANGE,
      maxHealth: 100,
      damage: 0,
      weaponRange: 0
    };
  }

  const componentCounts = {};
  player.modules.forEach(module => {
    if (module.id !== 'hull') {
      componentCounts[module.id] = (componentCounts[module.id] || 0) + 1;
    }
  });

  let speed = BASE_SPEED;
  let cargoCapacity = BASE_CARGO_CAPACITY;
  let collectionRange = BASE_COLLECTION_RANGE;
  let maxHealth = 100;
  let damage = 0;
  let weaponRange = 0;

  if (componentCounts.engine) {
    const engines = componentCounts.engine;
    speed = BASE_SPEED * (1 + engines * COMPONENT_EFFECTS.engine.speedMultiplier);
  }

  if (componentCounts.cargo) {
    const cargoModules = componentCounts.cargo;
    cargoCapacity = BASE_CARGO_CAPACITY + (cargoModules * COMPONENT_EFFECTS.cargo.capacityBonus);
    collectionRange = BASE_COLLECTION_RANGE + (cargoModules * 10);
  }

  if (componentCounts.weapon) {
    const weapons = componentCounts.weapon;
    damage = weapons * COMPONENT_EFFECTS.weapon.damageBonus;
    weaponRange = weapons * COMPONENT_EFFECTS.weapon.rangeBonus;
  }

  if (componentCounts.shield) {
    const shields = componentCounts.shield;
    maxHealth = 100 + (shields * COMPONENT_EFFECTS.shield.healthBonus);
  }

  return {
    speed: Math.round(speed * 100) / 100,
    cargoCapacity,
    collectionRange,
    maxHealth,
    damage,
    weaponRange,
    componentCounts
  };
}

function updateShipProperties(player) {
  const properties = calculateShipProperties(player);
  player.shipProperties = properties;
  
  if (player.health === undefined) {
    player.health = properties.maxHealth;
  }
  
  if (player.health > properties.maxHealth) {
    player.health = properties.maxHealth;
  }
  
  return properties;
}

// Initialize server
async function initializeServer() {
  try {
    await db.initialize();
    console.log('Enhanced database initialized successfully');
    
    spawnInitialOres();
    scheduleSupernova();
    startOptimizedGameLoop();
    
  } catch (error) {
    console.error('Failed to initialize optimized server:', error);
    process.exit(1);
  }
}

// Authentication endpoints (unchanged for compatibility)
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    const player = await db.createPlayer(username, email, password);
    res.json({ message: 'Account created successfully', playerId: player.id });
    
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const player = await db.authenticatePlayer(username, password);
    if (!player) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const sessionToken = uuidv4();
    
    res.json({ 
      message: 'Login successful', 
      playerId: player.id, 
      username: player.username,
      sessionToken 
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced health check endpoint with performance metrics
app.get('/api/health', (req, res) => {
  const dbStats = db.getPerformanceStats();
  const broadcastStats = broadcastManager.getStats();
  const physicsStats = physicsWorkers.getStats();
  const spatialStats = spatialIndex.getStats();
  const deltaStats = deltaStateManager.getStats();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    players: {
      active: activePlayers.size,
      sessions: playerSessions.size
    },
    performance: performanceMetrics,
    optimizations: {
      database: {
        initialized: db.initialized,
        ...dbStats
      },
      broadcast: broadcastStats,
      physics: physicsStats,
      spatial: spatialStats,
      deltaState: deltaStats
    }
  };
  
  res.json(health);
});

// Enhanced metrics endpoint
app.get('/metrics', (req, res) => {
  const dbStats = db.getPerformanceStats();
  const broadcastStats = broadcastManager.getStats();
  const physicsStats = physicsWorkers.getStats();
  
  const metrics = [
    `# HELP active_players Number of active players`,
    `# TYPE active_players gauge`,
    `active_players ${activePlayers.size}`,
    ``,
    `# HELP game_loop_time Average game loop time in ms`,
    `# TYPE game_loop_time gauge`,
    `game_loop_time ${performanceMetrics.averageGameLoopTime}`,
    ``,
    `# HELP database_queries_per_second Database queries per second`,
    `# TYPE database_queries_per_second gauge`,
    `database_queries_per_second ${dbStats.queriesExecuted}`,
    ``,
    `# HELP broadcast_messages_sent Total broadcast messages sent`,
    `# TYPE broadcast_messages_sent counter`,
    `broadcast_messages_sent ${broadcastStats.messagesSent}`,
    ``,
    `# HELP physics_jobs_processed Total physics jobs processed`,
    `# TYPE physics_jobs_processed counter`,
    `physics_jobs_processed ${physicsStats.jobsProcessed}`,
    ``,
    `# HELP process_memory_usage_bytes Memory usage in bytes`,
    `# TYPE process_memory_usage_bytes gauge`,
    `process_memory_usage_bytes ${process.memoryUsage().heapUsed}`,
    ``,
    `# HELP process_uptime_seconds Process uptime in seconds`,
    `# TYPE process_uptime_seconds counter`,
    `process_uptime_seconds ${process.uptime()}`
  ].join('\n');
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// Other endpoints remain unchanged for compatibility
app.get('/api/leaderboard/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const leaderboard = await db.getLeaderboard(category, limit);
    res.json(leaderboard);
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/player/:playerId/stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    const playerData = await db.getPlayerData(playerId);
    
    if (!playerData) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(playerData.stats);
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optimized utility functions
function spawnInitialOres() {
  ores = [];
  const num = 20;
  for (let i = 0; i < num; i++) {
    const ore = {
      id: uuidv4(),
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      value: ORE_VALUE
    };
    ores.push(ore);
    spatialIndex.addObject(ore, ore.x, ore.y);
  }
}

function removeOre(id) {
  const oreIndex = ores.findIndex(o => o.id === id);
  if (oreIndex !== -1) {
    const ore = ores[oreIndex];
    spatialIndex.removeObject(ore);
    ores.splice(oreIndex, 1);
  }
}

function scheduleSupernova(delayMs = 3 * 60 * 1000) {
  const x = Math.random() * 4000 - 2000;
  const y = Math.random() * 4000 - 2000;
  events.push({ type: 'supernova', x, y, triggerAt: Date.now() + delayMs });
}

// Enhanced broadcast using delta state management
async function broadcastGameState() {
  const startTime = Date.now();
  
  const gameState = {
    players: Array.from(activePlayers.values()).map(player => ({
      id: player.id,
      x: player.x,
      y: player.y,
      modules: player.modules,
      resources: player.resources,
      level: player.level,
      username: player.username
    })),
    ores,
    serverTime: Date.now()
  };

  // Send delta updates to each client
  let messagesSent = 0;
  for (const [ws, player] of activePlayers.entries()) {
    const client = broadcastManager.clients.get(ws);
    if (client) {
      const deltaResult = deltaStateManager.getGameStateDelta(client.id, gameState);
      
      if (deltaResult.hasChanges) {
        const success = broadcastManager.sendToClient(ws, {
          type: 'deltaUpdate',
          ...deltaResult
        });
        if (success) messagesSent++;
      }
    }
  }

  performanceMetrics.broadcastTime = Date.now() - startTime;
  return messagesSent;
}

// Achievement checking (unchanged for compatibility)
async function checkAchievements(player) {
  const achievements = [];
  
  if (player.stats.totalDistanceTraveled >= ACHIEVEMENTS.FIRST_STEPS.threshold) {
    if (await db.awardAchievement(player.id, 'movement', ACHIEVEMENTS.FIRST_STEPS.name, ACHIEVEMENTS.FIRST_STEPS.desc)) {
      achievements.push(ACHIEVEMENTS.FIRST_STEPS);
    }
  }
  
  if (player.stats.totalResourcesCollected >= ACHIEVEMENTS.COLLECTOR.threshold) {
    if (await db.awardAchievement(player.id, 'resources', ACHIEVEMENTS.COLLECTOR.name, ACHIEVEMENTS.COLLECTOR.desc)) {
      achievements.push(ACHIEVEMENTS.COLLECTOR);
    }
  }
  
  if (player.stats.totalModulesBuilt >= ACHIEVEMENTS.BUILDER.threshold) {
    if (await db.awardAchievement(player.id, 'modules', ACHIEVEMENTS.BUILDER.name, ACHIEVEMENTS.BUILDER.desc)) {
      achievements.push(ACHIEVEMENTS.BUILDER);
    }
  }
  
  if (player.stats.totalDistanceTraveled >= ACHIEVEMENTS.EXPLORER.threshold) {
    if (await db.awardAchievement(player.id, 'distance', ACHIEVEMENTS.EXPLORER.name, ACHIEVEMENTS.EXPLORER.desc)) {
      achievements.push(ACHIEVEMENTS.EXPLORER);
    }
  }
  
  if (player.resources >= ACHIEVEMENTS.WEALTHY.threshold) {
    if (await db.awardAchievement(player.id, 'resources', ACHIEVEMENTS.WEALTHY.name, ACHIEVEMENTS.WEALTHY.desc)) {
      achievements.push(ACHIEVEMENTS.WEALTHY);
    }
  }
  
  if (player.stats.totalModulesBuilt >= ACHIEVEMENTS.ENGINEER.threshold) {
    if (await db.awardAchievement(player.id, 'modules', ACHIEVEMENTS.ENGINEER.name, ACHIEVEMENTS.ENGINEER.desc)) {
      achievements.push(ACHIEVEMENTS.ENGINEER);
    }
  }
  
  return achievements;
}

async function updateLeaderboards(player) {
  await db.updateLeaderboard(player.id, 'resources', player.resources);
  await db.updateLeaderboard(player.id, 'level', player.level);
  await db.updateLeaderboard(player.id, 'modules', player.stats.totalModulesBuilt);
  await db.updateLeaderboard(player.id, 'distance', Math.floor(player.stats.totalDistanceTraveled));
}

// Enhanced WebSocket connection handling
wss.on('connection', async (ws) => {
  let player = null;
  let sessionId = null;
  
  ws.on('message', async (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      return;
    }
    
    if (data.type === 'authenticate' && !player) {
      try {
        let playerData;
        
        if (data.isGuest) {
          playerData = {
            id: data.playerId,
            username: data.username,
            resources: STARTING_RESOURCES,
            level: 1,
            experience: 0,
            x: Math.random() * 800 - 400,
            y: Math.random() * 800 - 400,
            modules: [{ id: 'hull', x: 0, y: 0 }],
            stats: {
              totalResourcesCollected: 0,
              totalModulesBuilt: 0,
              totalDistanceTraveled: 0,
              deaths: 0,
              kills: 0
            }
          };
        } else {
          playerData = await db.getPlayerData(data.playerId);
          if (!playerData) {
            ws.send(JSON.stringify({ type: 'error', message: 'Player not found' }));
            return;
          }
        }
        
        player = {
          id: playerData.id,
          username: playerData.username,
          x: playerData.x,
          y: playerData.y,
          modules: playerData.modules.length > 0 ? playerData.modules : [{ id: 'hull', x: 0, y: 0 }],
          inputs: { up: false, down: false, left: false, right: false },
          resources: playerData.resources,
          level: playerData.level,
          experience: playerData.experience,
          stats: playerData.stats,
          lastPosition: { x: playerData.x, y: playerData.y },
          lastUpdate: Date.now()
        };
        
        const properties = updateShipProperties(player);
        activePlayers.set(ws, player);
        
        // Register with broadcast manager
        broadcastManager.registerClient(ws, {
          id: player.id,
          playerId: player.id,
          username: player.username,
          x: player.x,
          y: player.y,
          channels: ['global', 'game']
        });
        
        // Add to spatial index
        spatialIndex.addObject(player, player.x, player.y);
        
        sessionId = await db.startGameSession(player.id);
        playerSessions.set(player.id, {
          sessionId,
          startTime: Date.now(),
          startResources: player.resources,
          startModules: player.stats.totalModulesBuilt
        });
        
        ws.send(JSON.stringify({
          type: 'init',
          id: player.id,
          players: Array.from(activePlayers.values()),
          ores,
          items: ITEMS,
          playerData: {
            username: player.username,
            resources: player.resources,
            level: player.level,
            experience: player.experience,
            stats: player.stats,
            shipProperties: properties
          }
        }));
        
        broadcastManager.broadcastToChannel('global', 
          { type: 'player_join', player: { id: player.id, username: player.username } },
          ws
        );
        
      } catch (error) {
        console.error('Authentication error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
      }
      return;
    }
    
    if (!player) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
      return;
    }
    
    // Handle game messages
    if (data.type === 'input') {
      const oldX = player.x;
      const oldY = player.y;
      
      player.inputs = {
        up: !!data.up,
        down: !!data.down,
        left: !!data.left,
        right: !!data.right
      };
      
      if (Math.abs(oldX - player.x) > 0.1 || Math.abs(oldY - player.y) > 0.1) {
        const distance = Math.sqrt((player.x - oldX) ** 2 + (player.y - oldY) ** 2);
        player.stats.totalDistanceTraveled += distance;
      }
      
    } else if (data.type === 'build') {
      const mod = data.module;
      const item = ITEMS[mod.id];
      const cost = item ? item.cost : 0;
      
      if (item && item.type === 'module' && player.resources >= cost) {
        player.resources -= cost;
        player.modules.push(mod);
        player.stats.totalModulesBuilt += 1;
        
        await db.addShipModule(player.id, mod.id, item.type, mod.x, mod.y);
        await db.updatePlayerStats(player.id, { 
          resources: player.resources,
          totalModulesBuilt: player.stats.totalModulesBuilt 
        });
        
        const achievements = await checkAchievements(player);
        if (achievements.length > 0) {
          ws.send(JSON.stringify({ type: 'achievements', achievements }));
        }
        
        ws.send(JSON.stringify({ type: 'resources', resources: player.resources }));
      }
      
    } else if (data.type === 'buy') {
      const item = ITEMS[data.itemId];
      if (item && player.resources >= item.cost) {
        player.resources -= item.cost;
        
        if (item.type === 'module') {
          const offset = player.modules.length * 22;
          const newModule = { id: item.id, x: offset, y: 0 };
          player.modules.push(newModule);
          player.stats.totalModulesBuilt += 1;
          
          const properties = updateShipProperties(player);
          
          await db.addShipModule(player.id, newModule.id, item.type, newModule.x, newModule.y);
          
          ws.send(JSON.stringify({
            type: 'shipProperties',
            properties: properties
          }));
          
          let effectMessage = `Added ${item.id} module! `;
          if (item.id === 'engine') {
            effectMessage += `Ship speed increased to ${properties.speed.toFixed(1)}!`;
          } else if (item.id === 'cargo') {
            effectMessage += `Cargo capacity increased to ${properties.cargoCapacity}!`;
          } else if (item.id === 'weapon') {
            effectMessage += `Damage increased to ${properties.damage}!`;
          } else if (item.id === 'shield') {
            effectMessage += `Max health increased to ${properties.maxHealth}!`;
          }
          
          ws.send(JSON.stringify({
            type: 'message',
            message: effectMessage,
            category: 'success'
          }));
        }
        
        await db.updatePlayerStats(player.id, { 
          resources: player.resources,
          totalModulesBuilt: player.stats.totalModulesBuilt 
        });
        
        const achievements = await checkAchievements(player);
        if (achievements.length > 0) {
          ws.send(JSON.stringify({ type: 'achievements', achievements }));
        }
        
        ws.send(JSON.stringify({ type: 'resources', resources: player.resources }));
      }
    }
  });
  
  // Handle disconnection
  ws.on('close', async () => {
    if (player) {
      activePlayers.delete(ws);
      spatialIndex.removeObject(player);
      broadcastManager.unregisterClient(ws);
      
      broadcastManager.broadcastToChannel('global', 
        { type: 'player_disconnect', id: player.id }
      );
      
      await db.updatePlayerPosition(player.id, player.x, player.y);
      await db.updatePlayerStats(player.id, {
        resources: player.resources,
        level: player.level,
        experience: player.experience
      });
      
      if (sessionId) {
        const session = playerSessions.get(player.id);
        if (session) {
          const duration = Math.floor((Date.now() - session.startTime) / 1000);
          const resourcesGained = player.resources - session.startResources;
          const modulesBuilt = player.stats.totalModulesBuilt - session.startModules;
          
          await db.endGameSession(sessionId, {
            duration,
            resourcesGained,
            modulesBuilt,
            distanceTraveled: player.stats.totalDistanceTraveled
          });
          
          playerSessions.delete(player.id);
        }
      }
      
      await updateLeaderboards(player);
    }
  });
});

// Optimized game loop with worker threads and performance monitoring
function startOptimizedGameLoop() {
  const TICK_INTERVAL = 1000 / 30; // 30 FPS
  
  setInterval(async () => {
    const loopStartTime = Date.now();
    
    try {
      // Prepare player data for physics processing
      const playersData = Array.from(activePlayers.values()).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        inputs: p.inputs,
        shipProperties: p.shipProperties,
        resources: p.resources,
        stats: p.stats
      }));
      
      if (playersData.length > 0) {
        // Process physics in worker threads
        const physicsStartTime = Date.now();
        const physicsResult = await physicsWorkers.processPhysics(playersData, ores, {
          BASE_SPEED,
          BASE_COLLECTION_RANGE,
          BASE_CARGO_CAPACITY
        });
        performanceMetrics.physicsCalculationTime = Date.now() - physicsStartTime;
        
        // Apply physics results
        physicsResult.updatedPlayers.forEach(updatedPlayer => {
          const [ws, player] = Array.from(activePlayers.entries())
            .find(([w, p]) => p.id === updatedPlayer.id) || [];
          
          if (player) {
            const oldX = player.x;
            const oldY = player.y;
            
            player.x = updatedPlayer.x;
            player.y = updatedPlayer.y;
            
            // Update spatial indices
            spatialIndex.updateObject(player, player.x, player.y);
            broadcastManager.updateClientPosition(ws, player.x, player.y);
            
            // Calculate distance traveled
            if (Math.abs(oldX - player.x) > 0.1 || Math.abs(oldY - player.y) > 0.1) {
              const distance = Math.sqrt((player.x - oldX) ** 2 + (player.y - oldY) ** 2);
              player.stats.totalDistanceTraveled += distance;
            }
          }
        });
        
        // Handle ore collection
        physicsResult.collectedOres.forEach(collection => {
          const [ws, player] = Array.from(activePlayers.entries())
            .find(([w, p]) => p.id === collection.playerId) || [];
          
          if (player) {
            const collectionEfficiency = player.shipProperties?.componentCounts?.cargo ? 
              1 + (player.shipProperties.componentCounts.cargo * COMPONENT_EFFECTS.cargo.efficiencyBonus) : 1;
            
            const collectedAmount = Math.round(collection.value * collectionEfficiency);
            player.resources += collectedAmount;
            player.stats.totalResourcesCollected += collection.value;
            player.level = 1 + Math.floor(player.stats.totalResourcesCollected / 200);
            
            // Check achievements
            checkAchievements(player).then(achievements => {
              if (achievements.length > 0) {
                ws.send(JSON.stringify({ type: 'achievements', achievements }));
              }
            });
            
            removeOre(collection.oreId);
          }
        });
      }
      
      // Respawn ores if needed
      if (ores.length === 0) {
        spawnInitialOres();
      }
      
      // Handle scheduled events
      const now = Date.now();
      events = events.filter(ev => {
        if (ev.triggerAt <= now) {
          if (ev.type === 'supernova') {
            const num = 40;
            for (let i = 0; i < num; i++) {
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * 200;
              const ore = {
                id: uuidv4(),
                x: ev.x + Math.cos(angle) * dist,
                y: ev.y + Math.sin(angle) * dist,
                value: ORE_VALUE * 2
              };
              ores.push(ore);
              spatialIndex.addObject(ore, ore.x, ore.y);
            }
            
            broadcastManager.broadcastToChannel('global', { 
              type: 'event', 
              event: { type: 'supernova', x: ev.x, y: ev.y } 
            });
            
            const delay = (2 + Math.random() * 3) * 60 * 1000;
            scheduleSupernova(delay);
          }
          return false;
        }
        return true;
      });
      
      // Save player positions periodically
      for (const [ws, p] of activePlayers.entries()) {
        const timeSinceUpdate = Date.now() - p.lastUpdate;
        if (timeSinceUpdate > 30000) { // Every 30 seconds
          await db.updatePlayerPosition(p.id, p.x, p.y);
          await db.updatePlayerStats(p.id, {
            resources: p.resources,
            level: p.level,
            totalResourcesCollected: p.stats.totalResourcesCollected,
            totalDistanceTraveled: p.stats.totalDistanceTraveled
          });
          p.lastUpdate = Date.now();
        }
      }
      
      // Broadcast optimized game state
      await broadcastGameState();
      
      // Update performance metrics
      const loopTime = Date.now() - loopStartTime;
      performanceMetrics.gameLoopCount++;
      performanceMetrics.averageGameLoopTime = 
        (performanceMetrics.averageGameLoopTime * (performanceMetrics.gameLoopCount - 1) + loopTime) / 
        performanceMetrics.gameLoopCount;
      performanceMetrics.lastGameLoopTime = loopTime;
      
    } catch (error) {
      console.error('Game loop error:', error);
    }
    
  }, TICK_INTERVAL);
}

// Graceful shutdown with cleanup
process.on('SIGINT', async () => {
  console.log('Shutting down optimized server...');
  
  // Save all active player data
  for (const [ws, player] of activePlayers.entries()) {
    await db.updatePlayerPosition(player.id, player.x, player.y);
    await db.updatePlayerStats(player.id, {
      resources: player.resources,
      level: player.level,
      experience: player.experience
    });
    
    if (playerSessions.has(player.id)) {
      const session = playerSessions.get(player.id);
      const duration = Math.floor((Date.now() - session.startTime) / 1000);
      const resourcesGained = player.resources - session.startResources;
      const modulesBuilt = player.stats.totalModulesBuilt - session.startModules;
      
      await db.endGameSession(session.sessionId, {
        duration,
        resourcesGained,
        modulesBuilt,
        distanceTraveled: player.stats.totalDistanceTraveled
      });
    }
  }
  
  // Shutdown optimized components
  await physicsWorkers.shutdown();
  broadcastManager.shutdown();
  spatialIndex.clear();
  deltaStateManager.removeClient();
  
  await db.close();
  server.close();
  process.exit(0);
});

// Start optimized server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Optimized StarForgeFrontier server running at http://localhost:${PORT}`);
  console.log('Optimizations enabled:');
  console.log('- Spatial indexing for collision detection');
  console.log('- Delta state management for reduced network traffic');
  console.log('- Database connection pooling');
  console.log('- Selective broadcast management');
  console.log('- Worker threads for physics calculations');
  
  await initializeServer();
});

module.exports = { server, db, spatialIndex, broadcastManager, physicsWorkers };