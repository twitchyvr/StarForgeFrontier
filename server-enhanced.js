/*
 * Enhanced StarForgeFrontier server with persistent data storage
 * 
 * This enhanced version includes:
 * - SQLite database for persistent player data
 * - User authentication system
 * - Session management
 * - Achievement tracking
 * - Leaderboards
 * - Enhanced game statistics
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const Database = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Enable JSON parsing for authentication endpoints
app.use(express.json());
app.use(express.static('public'));

// Initialize database
const db = new Database();

// In-memory state for active gameplay
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
    speedMultiplier: 0.3,  // +30% speed per engine
    accelerationBonus: 0.2 // +20% responsiveness
  },
  cargo: {
    capacityBonus: 500,    // +500 capacity per cargo module
    efficiencyBonus: 0.1   // +10% resource collection per cargo
  },
  weapon: {
    damageBonus: 25,       // +25 damage per weapon
    rangeBonus: 10         // +10 range per weapon
  },
  shield: {
    healthBonus: 100,      // +100 health per shield
    regenBonus: 2          // +2 health regen per shield per second
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

// Calculate ship properties based on installed components
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

  // Count components
  const componentCounts = {};
  player.modules.forEach(module => {
    if (module.id !== 'hull') {
      componentCounts[module.id] = (componentCounts[module.id] || 0) + 1;
    }
  });

  // Calculate properties
  let speed = BASE_SPEED;
  let cargoCapacity = BASE_CARGO_CAPACITY;
  let collectionRange = BASE_COLLECTION_RANGE;
  let maxHealth = 100;
  let damage = 0;
  let weaponRange = 0;

  // Apply engine effects
  if (componentCounts.engine) {
    const engines = componentCounts.engine;
    speed = BASE_SPEED * (1 + engines * COMPONENT_EFFECTS.engine.speedMultiplier);
  }

  // Apply cargo effects
  if (componentCounts.cargo) {
    const cargoModules = componentCounts.cargo;
    cargoCapacity = BASE_CARGO_CAPACITY + (cargoModules * COMPONENT_EFFECTS.cargo.capacityBonus);
    collectionRange = BASE_COLLECTION_RANGE + (cargoModules * 10); // Wider collection range
  }

  // Apply weapon effects
  if (componentCounts.weapon) {
    const weapons = componentCounts.weapon;
    damage = weapons * COMPONENT_EFFECTS.weapon.damageBonus;
    weaponRange = weapons * COMPONENT_EFFECTS.weapon.rangeBonus;
  }

  // Apply shield effects
  if (componentCounts.shield) {
    const shields = componentCounts.shield;
    maxHealth = 100 + (shields * COMPONENT_EFFECTS.shield.healthBonus);
  }

  return {
    speed: Math.round(speed * 100) / 100, // Round to 2 decimals
    cargoCapacity,
    collectionRange,
    maxHealth,
    damage,
    weaponRange,
    componentCounts
  };
}

// Update player ship properties based on components
function updateShipProperties(player) {
  const properties = calculateShipProperties(player);
  
  // Store properties on player object for easy access
  player.shipProperties = properties;
  
  // Initialize health if not set
  if (player.health === undefined) {
    player.health = properties.maxHealth;
  }
  
  // Cap current health to max health if shields were added
  if (player.health > properties.maxHealth) {
    player.health = properties.maxHealth;
  }
  
  return properties;
}

// Initialize server
async function initializeServer() {
  try {
    await db.initialize();
    console.log('Database initialized successfully');
    
    // Spawn initial ores
    spawnInitialOres();
    
    // Schedule first supernova
    scheduleSupernova();
    
    // Start game loop
    startGameLoop();
    
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Authentication endpoints
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
    
    // Generate session token (in production, use JWT)
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

// Health check endpoint for monitoring and load balancers
app.get('/api/health', (req, res) => {
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
    database: {
      initialized: db.initialized
    }
  };
  
  res.json(health);
});

// Metrics endpoint for monitoring (Prometheus format)
app.get('/metrics', (req, res) => {
  const metrics = [
    `# HELP active_players Number of active players`,
    `# TYPE active_players gauge`,
    `active_players ${activePlayers.size}`,
    ``,
    `# HELP game_sessions Number of active game sessions`,
    `# TYPE game_sessions gauge`, 
    `game_sessions ${playerSessions.size}`,
    ``,
    `# HELP process_memory_usage_bytes Memory usage in bytes`,
    `# TYPE process_memory_usage_bytes gauge`,
    `process_memory_usage_bytes ${process.memoryUsage().heapUsed}`,
    ``,
    `# HELP process_uptime_seconds Process uptime in seconds`,
    `# TYPE process_uptime_seconds counter`,
    `process_uptime_seconds ${process.uptime()}`,
    ``,
    `# HELP database_initialized Database initialization status`,
    `# TYPE database_initialized gauge`,
    `database_initialized ${db.initialized ? 1 : 0}`
  ].join('\n');
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// Leaderboard endpoint
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

// Player stats endpoint
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

// Utility functions
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function spawnInitialOres() {
  ores = [];
  const num = 20;
  for (let i = 0; i < num; i++) {
    ores.push({
      id: uuidv4(),
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      value: ORE_VALUE
    });
  }
}

function removeOre(id) {
  ores = ores.filter(o => o.id !== id);
}

function scheduleSupernova(delayMs = 3 * 60 * 1000) {
  const x = Math.random() * 4000 - 2000;
  const y = Math.random() * 4000 - 2000;
  events.push({ type: 'supernova', x, y, triggerAt: Date.now() + delayMs });
}

function broadcastState() {
  const playerList = [];
  activePlayers.forEach((player, id) => {
    playerList.push({
      id: player.id,
      x: player.x,
      y: player.y,
      modules: player.modules,
      resources: player.resources,
      level: player.level,
      username: player.username
    });
  });
  
  const state = {
    type: 'update',
    players: playerList,
    ores
  };
  broadcast(state);
}

// Achievement checking
async function checkAchievements(player) {
  const achievements = [];
  
  // Check each achievement type
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

// Update leaderboards
async function updateLeaderboards(player) {
  await db.updateLeaderboard(player.id, 'resources', player.resources);
  await db.updateLeaderboard(player.id, 'level', player.level);
  await db.updateLeaderboard(player.id, 'modules', player.stats.totalModulesBuilt);
  await db.updateLeaderboard(player.id, 'distance', Math.floor(player.stats.totalDistanceTraveled));
}

// WebSocket connection handling
wss.on('connection', async (ws) => {
  let player = null;
  let sessionId = null;
  
  // Handle authentication
  ws.on('message', async (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      return;
    }
    
    // Handle authentication message
    if (data.type === 'authenticate' && !player) {
      try {
        let playerData;
        
        if (data.isGuest) {
          // Create temporary guest player
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
        
        // Calculate and set ship properties based on modules
        const properties = updateShipProperties(player);
        
        activePlayers.set(ws, player);
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
        
        broadcast({ type: 'player_join', player: { id: player.id, username: player.username } });
        
      } catch (error) {
        console.error('Authentication error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
      }
      return;
    }
    
    // Require authentication for other messages
    if (!player) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
      return;
    }
    
    // Handle game messages
    if (data.type === 'input') {
      // Store old position for distance calculation
      const oldX = player.x;
      const oldY = player.y;
      
      player.inputs = {
        up: !!data.up,
        down: !!data.down,
        left: !!data.left,
        right: !!data.right
      };
      
      // Calculate distance traveled (will be used in game loop)
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
        
        // Save to database
        await db.addShipModule(player.id, mod.id, item.type, mod.x, mod.y);
        await db.updatePlayerStats(player.id, { 
          resources: player.resources,
          totalModulesBuilt: player.stats.totalModulesBuilt 
        });
        
        // Check achievements
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
          
          // Update ship properties immediately after adding component
          const properties = updateShipProperties(player);
          
          await db.addShipModule(player.id, newModule.id, item.type, newModule.x, newModule.y);
          
          // Send updated ship properties to client
          ws.send(JSON.stringify({
            type: 'shipProperties',
            properties: properties
          }));
          
          // Send notification about component effects
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
        
        // Check achievements
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
      broadcast({ type: 'player_disconnect', id: player.id });
      
      // Save final position and stats
      await db.updatePlayerPosition(player.id, player.x, player.y);
      await db.updatePlayerStats(player.id, {
        resources: player.resources,
        level: player.level,
        experience: player.experience
      });
      
      // End game session
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
      
      // Update leaderboards
      await updateLeaderboards(player);
    }
  });
});

// Main game loop
function startGameLoop() {
  const TICK_INTERVAL = 1000 / 30;
  
  setInterval(async () => {
    // Update player positions
    activePlayers.forEach((p) => {
      // Update ship properties if they don't exist or components changed
      if (!p.shipProperties) {
        updateShipProperties(p);
      }
      
      const speed = p.shipProperties?.speed || BASE_SPEED;
      const oldX = p.x;
      const oldY = p.y;
      
      if (p.inputs.up) p.y -= speed;
      if (p.inputs.down) p.y += speed;
      if (p.inputs.left) p.x -= speed;
      if (p.inputs.right) p.x += speed;
      
      // Calculate distance traveled
      if (Math.abs(oldX - p.x) > 0.1 || Math.abs(oldY - p.y) > 0.1) {
        const distance = Math.sqrt((p.x - oldX) ** 2 + (p.y - oldY) ** 2);
        p.stats.totalDistanceTraveled += distance;
      }
    });
    
    // Handle ore collection
    for (const [ws, p] of activePlayers.entries()) {
      const collectionRange = p.shipProperties?.collectionRange || BASE_COLLECTION_RANGE;
      const cargoCapacity = p.shipProperties?.cargoCapacity || BASE_CARGO_CAPACITY;
      const collectionEfficiency = p.shipProperties?.componentCounts?.cargo ? 
        1 + (p.shipProperties.componentCounts.cargo * COMPONENT_EFFECTS.cargo.efficiencyBonus) : 1;
      
      for (const ore of ores) {
        const dx = p.x - ore.x;
        const dy = p.y - ore.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < collectionRange * collectionRange) {
          // Check cargo capacity
          if (p.resources >= cargoCapacity) {
            // Send message about cargo being full
            ws.send(JSON.stringify({
              type: 'message',
              message: `Cargo full! Capacity: ${cargoCapacity}. Need more cargo modules.`,
              category: 'warning'
            }));
            continue;
          }
          
          const collectedAmount = Math.round(ore.value * collectionEfficiency);
          p.resources += collectedAmount;
          p.stats.totalResourcesCollected += ore.value;
          p.level = 1 + Math.floor(p.stats.totalResourcesCollected / 200);
          
          // Check for achievements
          const achievements = await checkAchievements(p);
          if (achievements.length > 0) {
            ws.send(JSON.stringify({ type: 'achievements', achievements }));
          }
          
          removeOre(ore.id);
          break;
        }
      }
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
          // Spawn ores
          const num = 40;
          for (let i = 0; i < num; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 200;
            ores.push({
              id: uuidv4(),
              x: ev.x + Math.cos(angle) * dist,
              y: ev.y + Math.sin(angle) * dist,
              value: ORE_VALUE * 2
            });
          }
          
          broadcast({ type: 'event', event: { type: 'supernova', x: ev.x, y: ev.y } });
          
          // Schedule next supernova
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
    
    // Broadcast state
    broadcastState();
    
  }, TICK_INTERVAL);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  
  // Save all active player data
  for (const [ws, player] of activePlayers.entries()) {
    await db.updatePlayerPosition(player.id, player.x, player.y);
    await db.updatePlayerStats(player.id, {
      resources: player.resources,
      level: player.level,
      experience: player.experience
    });
    
    // End game sessions
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
  
  await db.close();
  server.close();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Enhanced StarForgeFrontier server running at http://localhost:${PORT}`);
  await initializeServer();
});

module.exports = { server, db }; // Export for testing