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
const EnhancedSectorManager = require('./galaxy/EnhancedSectorManager');
const WarpSystem = require('./galaxy/WarpSystem');
const { ORE_TYPES } = require('./galaxy/Sector');
const { TradingStation } = require('./trading/TradingStation');
const MarketSystem = require('./trading/MarketSystem');
const { ContractSystem } = require('./trading/ContractSystem');
const { FactionOrchestrator } = require('./factions/FactionOrchestrator');
const SkillSystem = require('./skills/SkillSystem');
const GuildSystem = require('./guilds/GuildSystem');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Enable JSON parsing for authentication endpoints
app.use(express.json());
app.use(express.static('public'));

// Initialize database
const db = new Database();

// Initialize galaxy systems
let sectorManager = null; // Now using EnhancedSectorManager with hazard system
let warpSystem = null;

// Initialize trading systems
let marketSystem = null;
let contractSystem = null;
const tradingStations = new Map(); // Active trading stations by sector

// Initialize faction system
let factionOrchestrator = null;

// Initialize skill system
let skillSystem = null;

// Initialize guild system
let guildSystem = null;

// Initialize research system
const ResearchSystem = require('./research/ResearchSystem');
const ResearchStation = require('./research/ResearchStation');
let researchSystem = null;
let researchStation = null;

// In-memory state for active gameplay
const activePlayers = new Map(); // WebSocket connections
const playerSessions = new Map(); // Game session tracking
let ores = []; // Legacy ores for sector 0,0 compatibility
let events = []; // Legacy events for sector 0,0 compatibility

// Combat system state
const projectiles = new Map(); // Active projectiles
const weaponCooldowns = new Map(); // Player weapon cooldowns

// Combat constants
const WEAPON_COOLDOWN = 1000; // 1 second in milliseconds
const PROJECTILE_SPEED = 300; // pixels per second
const RESPAWN_DELAY = 3000; // 3 seconds
const INVULNERABILITY_TIME = 2000; // 2 seconds after respawn

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
  shield: { cost: 60, type: 'module', id: 'shield' },
  warp_drive: { cost: 150, type: 'module', id: 'warp_drive' },
  scanner: { cost: 80, type: 'module', id: 'scanner' }
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
  },
  warp_drive: {
    fuelEfficiency: 0.25,  // -25% fuel cost per warp drive
    speedBonus: 0.2        // -20% travel time per warp drive
  },
  scanner: {
    rangeBonus: 2,         // +2 sector scan range per scanner
    detectionBonus: 0.15   // +15% ore detection range per scanner
  }
};

// Achievement definitions
const ACHIEVEMENTS = {
  FIRST_STEPS: { type: 'movement', name: 'First Steps', desc: 'Move your ship for the first time', threshold: 1 },
  COLLECTOR: { type: 'resources', name: 'Collector', desc: 'Collect 100 resources', threshold: 100 },
  BUILDER: { type: 'modules', name: 'Builder', desc: 'Add your first module', threshold: 1 },
  TRAVELER: { type: 'distance', name: 'Traveler', desc: 'Travel 1000 units', threshold: 1000 },
  WEALTHY: { type: 'resources', name: 'Wealthy', desc: 'Accumulate 500 resources', threshold: 500 },
  ENGINEER: { type: 'modules', name: 'Engineer', desc: 'Build 5 modules', threshold: 5 },
  FIRST_BLOOD: { type: 'kills', name: 'First Blood', desc: 'Destroy your first enemy ship', threshold: 1 },
  WARRIOR: { type: 'kills', name: 'Warrior', desc: 'Destroy 10 enemy ships', threshold: 10 },
  DESTROYER: { type: 'kills', name: 'Destroyer', desc: 'Destroy 25 enemy ships', threshold: 25 },
  ACE_PILOT: { type: 'kills', name: 'Ace Pilot', desc: 'Destroy 50 enemy ships', threshold: 50 },
  FIRST_WARP: { type: 'warps', name: 'First Warp', desc: 'Complete your first warp jump', threshold: 1 },
  EXPLORER: { type: 'sectors', name: 'Explorer', desc: 'Discover 5 different sectors', threshold: 5 },
  NAVIGATOR: { type: 'sectors', name: 'Navigator', desc: 'Discover 15 different sectors', threshold: 15 },
  GALACTIC_CARTOGRAPHER: { type: 'sectors', name: 'Galactic Cartographer', desc: 'Discover 50 different sectors', threshold: 50 }
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

  // Apply scanner effects
  if (componentCounts.scanner) {
    const scanners = componentCounts.scanner;
    collectionRange = collectionRange + (scanners * COMPONENT_EFFECTS.scanner.detectionBonus * collectionRange);
  }

  return {
    speed: Math.round(speed * 100) / 100, // Round to 2 decimals
    cargoCapacity,
    collectionRange,
    maxHealth,
    damage,
    weaponRange,
    componentCounts,
    warpDrives: componentCounts.warp_drive || 0,
    scanners: componentCounts.scanner || 0
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
    
    // Initialize skill system first (required by other systems)
    skillSystem = new SkillSystem(db);
    console.log('Skill system initialized successfully');
    
    // Initialize faction system
    factionOrchestrator = new FactionOrchestrator(db);
    await factionOrchestrator.initialize();
    console.log('Faction system initialized successfully');
    
    // Initialize galaxy systems with enhanced hazard support
    sectorManager = new EnhancedSectorManager(db, skillSystem);
    await sectorManager.initialize();
    warpSystem = new WarpSystem(db, sectorManager);
    console.log('Enhanced galaxy systems with hazard support initialized successfully');
    
    // Initialize trading systems
    marketSystem = new MarketSystem(db);
    contractSystem = new ContractSystem(db);
    console.log('Trading systems initialized successfully');
    
    // Initialize guild system
    guildSystem = new GuildSystem(db, skillSystem, factionOrchestrator);
    await guildSystem.initialize();
    console.log('Guild system initialized successfully');
    
    // Initialize research system
    researchSystem = new ResearchSystem(db, skillSystem, guildSystem);
    await researchSystem.initialize();
    researchStation = new ResearchStation(db, sectorManager);
    console.log('Research system initialized successfully');
    
    // Initialize starting trading stations
    await initializeStartingTradingStations();
    
    // Initialize starting sector (0,0) for backward compatibility
    await initializeStartingSector();
    
    // Spawn initial ores in legacy format for sector 0,0
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

// Initialize starting sector for backward compatibility
async function initializeStartingSector() {
  try {
    const startingSector = await sectorManager.getSector(0, 0);
    console.log(`Starting sector (0,0) initialized - Biome: ${startingSector.biome.name}`);
  } catch (error) {
    console.error('Error initializing starting sector:', error);
  }
}

// Galaxy API endpoints
app.get('/api/galaxy/map/:x/:y', async (req, res) => {
  try {
    const centerX = parseInt(req.params.x);
    const centerY = parseInt(req.params.y);
    const radius = parseInt(req.query.radius) || 5;
    
    if (isNaN(centerX) || isNaN(centerY)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    const mapData = sectorManager.getGalaxyMapData({ x: centerX, y: centerY }, radius);
    
    // Add trading station information to the map data
    if (mapData && mapData.sectors) {
      for (const sector of mapData.sectors) {
        try {
          const stations = await db.getTradingStations(sector.x, sector.y);
          if (stations.length > 0) {
            sector.tradingStations = stations.map(station => ({
              id: station.id,
              name: station.station_name,
              type: station.station_type,
              position: { x: station.x, y: station.y }
            }));
          }
        } catch (error) {
          console.error(`Error loading trading stations for sector (${sector.x}, ${sector.y}):`, error);
        }
      }
    }
    
    res.json(mapData);
    
  } catch (error) {
    console.error('Galaxy map error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/galaxy/warp-targets/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const maxRange = parseInt(req.query.range) || 5;
    
    const playerData = await db.getPlayerData(playerId);
    if (!playerData) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const destinations = await warpSystem.getWarpDestinations(playerId, playerData, maxRange);
    res.json(destinations);
    
  } catch (error) {
    console.error('Warp targets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/galaxy/warp', async (req, res) => {
  try {
    const { playerId, targetX, targetY, isEmergencyWarp } = req.body;
    
    if (!playerId || isNaN(targetX) || isNaN(targetY)) {
      return res.status(400).json({ error: 'Invalid warp parameters' });
    }
    
    const playerData = await db.getPlayerData(playerId);
    if (!playerData) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const targetCoords = { x: parseInt(targetX), y: parseInt(targetY) };
    
    let result;
    if (isEmergencyWarp) {
      result = await warpSystem.emergencyWarp(playerId, playerData, targetCoords);
    } else {
      result = await warpSystem.initiateWarp(playerId, playerData, targetCoords);
    }
    
    // If warp was successful, handle trading station integration
    if (result.success && !result.inProgress) {
      try {
        // Get sector data for the destination
        const sector = await sectorManager.getSector(targetCoords.x, targetCoords.y);
        if (sector) {
          await onSectorDiscovered(playerId, targetCoords.x, targetCoords.y, {
            biome_type: sector.biomeType,
            seed: sector.seed
          });
        }
      } catch (error) {
        console.error('Error integrating trading stations on warp:', error);
        // Don't fail the warp if trading station integration fails
      }
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Warp initiation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/galaxy/stats', async (req, res) => {
  try {
    const galaxyStats = await db.getGalaxyStats();
    const sectorManagerStats = sectorManager.getGalaxyStats();
    const warpSystemStats = warpSystem.getSystemStatus();
    
    res.json({
      galaxy: galaxyStats,
      sectorManager: sectorManagerStats,
      warpSystem: warpSystemStats
    });
    
  } catch (error) {
    console.error('Galaxy stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/player/:playerId/warp-stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    const warpStats = await warpSystem.getPlayerWarpStats(playerId);
    res.json(warpStats);
    
  } catch (error) {
    console.error('Player warp stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/player/:playerId/discoveries', async (req, res) => {
  try {
    const { playerId } = req.params;
    const discoveries = await db.getPlayerDiscoveries(playerId);
    res.json(discoveries);
    
  } catch (error) {
    console.error('Player discoveries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
    
    // Store session token in player sessions
    playerSessions.set(player.id, {
      ...playerSessions.get(player.id),
      sessionToken: sessionToken,
      loginTime: Date.now(),
      username: player.username
    });
    
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

// ===== AUTHENTICATION HELPER FUNCTIONS =====

/**
 * Validate session token and return player ID
 */
async function validateToken(token) {
  try {
    // In production, this should validate JWT tokens
    // For now, we'll check if it's a valid UUID and exists in active sessions
    if (!token) {
      return null;
    }

    // Simple token validation - check if it matches a UUID pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return null;
    }

    // For now, we'll extract player ID from active sessions
    // In production, this should decode and validate JWT
    for (const [playerId, session] of playerSessions.entries()) {
      if (session.sessionToken === token) {
        // Check if session is still valid (optional expiry check)
        const sessionAge = Date.now() - (session.loginTime || 0);
        const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (sessionAge < maxSessionAge) {
          return playerId;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error validating token:', error);
    return null;
  }
}

/**
 * Authentication middleware
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const playerId = await validateToken(token);
  
  if (!playerId) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  req.playerId = playerId;
  next();
}

// ===== TRADING SYSTEM API ENDPOINTS =====

// Get trading stations in a sector
app.get('/api/trading/stations/:sectorX/:sectorY', async (req, res) => {
  try {
    const { sectorX, sectorY } = req.params;
    const stations = await db.getTradingStations(parseInt(sectorX), parseInt(sectorY));
    
    const stationsWithMarketData = [];
    for (const station of stations) {
      const inventory = await db.getStationInventory(station.id);
      stationsWithMarketData.push({
        ...station,
        inventory
      });
    }
    
    res.json(stationsWithMarketData);
  } catch (error) {
    console.error('Error fetching trading stations:', error);
    res.status(500).json({ error: 'Failed to fetch trading stations' });
  }
});

// Get detailed station information including market data
app.get('/api/trading/station/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const station = await db.getTradingStation(stationId);
    
    if (!station) {
      return res.status(404).json({ error: 'Trading station not found' });
    }
    
    const inventory = await db.getStationInventory(stationId);
    const orderBook = marketSystem.getOrderBook(null, stationId); // Get all order books for station
    
    res.json({
      ...station,
      inventory,
      orderBook
    });
  } catch (error) {
    console.error('Error fetching station data:', error);
    res.status(500).json({ error: 'Failed to fetch station data' });
  }
});

// Buy from trading station (station sells to player)
app.post('/api/trading/buy', async (req, res) => {
  try {
    const { playerId, stationId, oreType, quantity } = req.body;
    
    if (!playerId || !stationId || !oreType || !quantity) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Load station
    const station = await TradingStation.loadFromDB(stationId, db);
    
    // Process the sale
    const result = station.processSellOrder(oreType, quantity, playerId);
    
    // Update station inventory in database
    await station.saveToDB();
    
    // Update player resources
    const playerData = await db.getPlayerData(playerId);
    if (playerData.resources < result.totalPrice) {
      return res.status(400).json({ error: 'Insufficient resources' });
    }
    
    await db.updatePlayerStats(playerId, { 
      resources: playerData.resources - result.totalPrice 
    });
    
    // Record the trade
    await db.recordTrade({
      buyer_id: playerId,
      seller_id: null,
      station_id: stationId,
      ore_type: oreType,
      quantity: result.quantity,
      price_per_unit: result.pricePerUnit,
      total_value: result.totalPrice,
      trade_type: 'station_to_player'
    });
    
    res.json({
      success: true,
      transaction: result,
      message: `Purchased ${result.quantity} ${oreType} for ${result.totalPrice} resources`
    });
    
  } catch (error) {
    console.error('Error processing buy order:', error);
    res.status(500).json({ error: error.message || 'Failed to process purchase' });
  }
});

// Sell to trading station (player sells to station)
app.post('/api/trading/sell', async (req, res) => {
  try {
    const { playerId, stationId, oreType, quantity } = req.body;
    
    if (!playerId || !stationId || !oreType || !quantity) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // TODO: Check player inventory for the ore (implement player ore inventory system)
    // For now, assume player has the ore
    
    // Load station
    const station = await TradingStation.loadFromDB(stationId, db);
    
    // Process the purchase
    const result = station.processBuyOrder(oreType, quantity, playerId);
    
    // Update station inventory in database
    await station.saveToDB();
    
    // Update player resources
    const playerData = await db.getPlayerData(playerId);
    await db.updatePlayerStats(playerId, { 
      resources: playerData.resources + result.totalPrice 
    });
    
    // Record the trade
    await db.recordTrade({
      buyer_id: null,
      seller_id: playerId,
      station_id: stationId,
      ore_type: oreType,
      quantity: result.quantity,
      price_per_unit: result.pricePerUnit,
      total_value: result.totalPrice,
      trade_type: 'player_to_station'
    });
    
    res.json({
      success: true,
      transaction: result,
      message: `Sold ${result.quantity} ${oreType} for ${result.totalPrice} resources`
    });
    
  } catch (error) {
    console.error('Error processing sell order:', error);
    res.status(500).json({ error: error.message || 'Failed to process sale' });
  }
});

// Create trade order (player-to-player trading)
app.post('/api/trading/order', async (req, res) => {
  try {
    const { playerId, stationId, orderType, oreType, quantity, pricePerUnit } = req.body;
    
    const order = await marketSystem.createOrder({
      playerId,
      stationId,
      orderType,
      oreType,
      quantity,
      pricePerUnit
    });
    
    res.json({
      success: true,
      order,
      message: `${orderType} order created for ${quantity} ${oreType} at ${pricePerUnit} each`
    });
    
  } catch (error) {
    console.error('Error creating trade order:', error);
    res.status(400).json({ error: error.message || 'Failed to create order' });
  }
});

// Cancel trade order
app.delete('/api/trading/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { playerId } = req.body;
    
    const order = await marketSystem.cancelOrder(orderId, playerId);
    
    res.json({
      success: true,
      order,
      message: 'Order cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(400).json({ error: error.message || 'Failed to cancel order' });
  }
});

// Get player's active orders
app.get('/api/trading/orders/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const orders = marketSystem.getPlayerOrders(playerId);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching player orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order book for specific ore and station
app.get('/api/trading/orderbook/:stationId/:oreType', async (req, res) => {
  try {
    const { stationId, oreType } = req.params;
    const orderBook = marketSystem.getOrderBook(oreType, stationId);
    res.json(orderBook);
  } catch (error) {
    console.error('Error fetching order book:', error);
    res.status(500).json({ error: 'Failed to fetch order book' });
  }
});

// Get market price for ore at station
app.get('/api/trading/price/:stationId/:oreType', async (req, res) => {
  try {
    const { stationId, oreType } = req.params;
    const price = await marketSystem.getMarketPrice(stationId, oreType);
    const history = await db.getMarketHistory(stationId, oreType, 20);
    
    res.json({
      currentPrice: price,
      priceHistory: history
    });
  } catch (error) {
    console.error('Error fetching market price:', error);
    res.status(500).json({ error: 'Failed to fetch price data' });
  }
});

// Get market summary
app.get('/api/trading/market-summary', async (req, res) => {
  try {
    const summary = await marketSystem.getMarketSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching market summary:', error);
    res.status(500).json({ error: 'Failed to fetch market summary' });
  }
});

// ===== CONTRACT SYSTEM API ENDPOINTS =====

// Get available contracts
app.get('/api/contracts/available', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const contracts = contractSystem.getAvailableContracts(limit);
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching available contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Accept a contract
app.post('/api/contracts/accept', async (req, res) => {
  try {
    const { contractId, playerId } = req.body;
    
    if (!contractId || !playerId) {
      return res.status(400).json({ error: 'Missing contractId or playerId' });
    }
    
    const contract = await contractSystem.acceptContract(contractId, playerId);
    
    res.json({
      success: true,
      contract,
      message: `Contract accepted: ${contract.description}`
    });
    
  } catch (error) {
    console.error('Error accepting contract:', error);
    res.status(400).json({ error: error.message || 'Failed to accept contract' });
  }
});

// Get player's active contracts
app.get('/api/contracts/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const status = req.query.status || null;
    
    const contracts = await db.getPlayerContracts(playerId, status);
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching player contracts:', error);
    res.status(500).json({ error: 'Failed to fetch player contracts' });
  }
});

// Complete a contract
app.post('/api/contracts/complete', async (req, res) => {
  try {
    const { contractId, playerId } = req.body;
    
    if (!contractId || !playerId) {
      return res.status(400).json({ error: 'Missing contractId or playerId' });
    }
    
    const result = await contractSystem.completeContract(contractId, playerId);
    
    res.json({
      success: true,
      result,
      message: result.message
    });
    
  } catch (error) {
    console.error('Error completing contract:', error);
    res.status(400).json({ error: error.message || 'Failed to complete contract' });
  }
});

// Get contract statistics
app.get('/api/contracts/stats', async (req, res) => {
  try {
    const stats = await contractSystem.getContractStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching contract stats:', error);
    res.status(500).json({ error: 'Failed to fetch contract statistics' });
  }
});

// Get trading statistics
app.get('/api/trading/stats', async (req, res) => {
  try {
    const stats = await marketSystem.getTradingStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching trading stats:', error);
    res.status(500).json({ error: 'Failed to fetch trading statistics' });
  }
});

// ===== FACTION SYSTEM API ENDPOINTS =====

// Get all factions summary
app.get('/api/factions', async (req, res) => {
  try {
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const factions = {};
    for (const [factionId, faction] of factionOrchestrator.factions.entries()) {
      factions[factionId] = {
        id: faction.id,
        name: faction.name,
        type: faction.type,
        territoryCount: faction.territory.size,
        fleetCount: faction.fleets.size,
        currentStrategy: faction.currentStrategy,
        homeBase: faction.homeBase,
        typeConfig: faction.typeConfig
      };
    }
    
    res.json(factions);
  } catch (error) {
    console.error('Error fetching factions:', error);
    res.status(500).json({ error: 'Failed to fetch faction data' });
  }
});

// Get specific faction details
app.get('/api/factions/:factionId', async (req, res) => {
  try {
    const { factionId } = req.params;
    
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const faction = factionOrchestrator.factions.get(factionId);
    if (!faction) {
      return res.status(404).json({ error: 'Faction not found' });
    }
    
    res.json({
      id: faction.id,
      name: faction.name,
      type: faction.type,
      typeConfig: faction.typeConfig,
      territory: Array.from(faction.territory),
      fleets: Array.from(faction.fleets.keys()),
      resources: Object.fromEntries(faction.resources),
      currentStrategy: faction.currentStrategy,
      homeBase: faction.homeBase,
      stats: faction.stats,
      allies: Array.from(faction.allies),
      enemies: Array.from(faction.enemies)
    });
  } catch (error) {
    console.error('Error fetching faction details:', error);
    res.status(500).json({ error: 'Failed to fetch faction details' });
  }
});

// Get all fleets summary
app.get('/api/factions/fleets', async (req, res) => {
  try {
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const fleets = [];
    for (const [fleetId, fleet] of factionOrchestrator.allFleets.entries()) {
      fleets.push({
        id: fleet.id,
        factionId: fleet.factionId,
        factionType: fleet.factionType,
        shipCount: fleet.ships.length,
        mission: fleet.mission.type,
        status: fleet.status,
        currentSector: fleet.currentSector,
        position: fleet.position
      });
    }
    
    res.json(fleets);
  } catch (error) {
    console.error('Error fetching fleets:', error);
    res.status(500).json({ error: 'Failed to fetch fleet data' });
  }
});

// Get fleets in specific sector
app.get('/api/factions/fleets/sector/:sectorX/:sectorY', async (req, res) => {
  try {
    const { sectorX, sectorY } = req.params;
    const sectorId = `${sectorX},${sectorY}`;
    
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const fleetsInSector = factionOrchestrator.getFleetsInSector(sectorId);
    res.json(fleetsInSector);
    
  } catch (error) {
    console.error('Error fetching sector fleets:', error);
    res.status(500).json({ error: 'Failed to fetch sector fleet data' });
  }
});

// Get player reputation with all factions
app.get('/api/factions/reputation/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const reputations = factionOrchestrator.getPlayerReputations(playerId);
    res.json(reputations);
  } catch (error) {
    console.error('Error fetching player reputation:', error);
    res.status(500).json({ error: 'Failed to fetch reputation data' });
  }
});

// Get player reputation with specific faction
app.get('/api/factions/reputation/:playerId/:factionId', async (req, res) => {
  try {
    const { playerId, factionId } = req.params;
    
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const faction = factionOrchestrator.factions.get(factionId);
    if (!faction) {
      return res.status(404).json({ error: 'Faction not found' });
    }
    
    const reputation = faction.getPlayerReputation(playerId);
    const level = faction.getReputationLevel(playerId);
    
    res.json({
      reputation,
      level: level.level,
      name: level.name,
      color: level.color,
      min: level.min,
      max: level.max
    });
  } catch (error) {
    console.error('Error fetching specific faction reputation:', error);
    res.status(500).json({ error: 'Failed to fetch faction reputation' });
  }
});

// Get player reputation history
app.get('/api/factions/reputation-history/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const history = await db.getReputationHistory(playerId, null, limit);
    res.json(history);
  } catch (error) {
    console.error('Error fetching reputation history:', error);
    res.status(500).json({ error: 'Failed to fetch reputation history' });
  }
});

// Check if player can interact with faction
app.get('/api/factions/interaction/:playerId/:factionId/:interactionType', async (req, res) => {
  try {
    const { playerId, factionId, interactionType } = req.params;
    
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const faction = factionOrchestrator.factions.get(factionId);
    if (!faction) {
      return res.status(404).json({ error: 'Faction not found' });
    }
    
    const reputation = faction.getPlayerReputation(playerId);
    const level = faction.getReputationLevel(playerId);
    
    // Basic interaction rules
    let canInteract = true;
    if (level.level === 'HOSTILE') {
      canInteract = false;
    }
    
    res.json({
      canInteract,
      interactionType,
      currentStanding: level.level,
      reputation: reputation
    });
  } catch (error) {
    console.error('Error checking faction interaction:', error);
    res.status(500).json({ error: 'Failed to check interaction permission' });
  }
});

// Get faction system status and statistics
app.get('/api/factions/system-status', async (req, res) => {
  try {
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const status = factionOrchestrator.getSystemStats();
    res.json(status);
  } catch (error) {
    console.error('Error fetching faction system status:', error);
    res.status(500).json({ error: 'Failed to fetch system status' });
  }
});

// Trigger faction event (admin/debug endpoint)
app.post('/api/factions/events', async (req, res) => {
  try {
    const { playerId, factionId, eventType, eventData } = req.body;
    
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    // Basic validation
    if (!playerId || !eventType) {
      return res.status(400).json({ error: 'Missing required parameters: playerId, eventType' });
    }
    
    // Queue the event
    factionOrchestrator.queueEvent(eventType, {
      playerId,
      factionId,
      ...eventData
    });
    
    res.json({
      success: true,
      message: `Event ${eventType} queued successfully`,
      event: {
        type: eventType,
        playerId,
        factionId,
        data: eventData
      }
    });
  } catch (error) {
    console.error('Error triggering faction event:', error);
    res.status(500).json({ error: 'Failed to trigger faction event' });
  }
});

// Get trade price modifiers for player with factions
app.get('/api/factions/trade-modifiers/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    if (!factionOrchestrator) {
      return res.status(503).json({ error: 'Faction system not initialized' });
    }
    
    const modifiers = {};
    
    // Get modifiers for each faction
    for (const [factionId, faction] of factionOrchestrator.factions.entries()) {
      const priceModifier = factionOrchestrator.reputationManager.getTradePriceModifier(playerId, factionId);
      const standing = factionOrchestrator.reputationManager.getPlayerStanding(playerId, factionId);
      
      modifiers[factionId] = {
        factionName: faction.name,
        priceModifier,
        standing: standing.level,
        canTrade: standing.effects.canTrade
      };
    }
    
    res.json(modifiers);
  } catch (error) {
    console.error('Error fetching trade modifiers:', error);
    res.status(500).json({ error: 'Failed to fetch trade modifiers' });
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
// PWA and Push Notification Endpoints
const pushSubscriptions = new Map(); // Store push subscriptions

app.post('/api/push-subscribe', (req, res) => {
  try {
    const { subscription, userAgent, timestamp } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    
    // Store subscription (in production, save to database)
    const subscriptionId = uuidv4();
    pushSubscriptions.set(subscription.endpoint, {
      id: subscriptionId,
      subscription,
      userAgent,
      timestamp,
      createdAt: new Date()
    });
    
    console.log(`Push subscription registered: ${subscriptionId}`);
    res.json({ success: true, subscriptionId });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/push-unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;
    
    if (pushSubscriptions.has(endpoint)) {
      pushSubscriptions.delete(endpoint);
      console.log(`Push subscription removed: ${endpoint}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/send-push', (req, res) => {
  try {
    const { subscription, notification, priority } = req.body;
    
    // In production, use a proper push service like web-push
    // For now, just acknowledge the request
    console.log('Push notification request:', {
      endpoint: subscription?.endpoint,
      title: notification?.title,
      priority: priority
    });
    
    // TODO: Implement actual push notification sending
    // This would require web-push library and VAPID keys
    
    res.json({ success: true });
  } catch (error) {
    console.error('Send push error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notification-preferences', (req, res) => {
  try {
    const preferences = req.body;
    
    // TODO: Save preferences to database by user ID
    console.log('Notification preferences updated:', preferences);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Notification preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/performance', (req, res) => {
  try {
    const { loadTime, domContentLoaded, userAgent, timestamp } = req.body;
    
    // Log performance data for optimization
    console.log('Performance data:', {
      loadTime,
      domContentLoaded,
      userAgent: userAgent?.substring(0, 100), // Truncate for privacy
      timestamp
    });
    
    // TODO: Store in database for analysis
    
    res.json({ success: true });
  } catch (error) {
    console.error('Performance logging error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sync-action', (req, res) => {
  try {
    const action = req.body;
    
    // Handle offline actions that need to be synced
    console.log('Syncing offline action:', action);
    
    // TODO: Process offline action based on type
    // e.g., resource collection, ship modifications, etc.
    
    res.json({ success: true });
  } catch (error) {
    console.error('Sync action error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to broadcast push notifications for game events
function broadcastPushNotification(eventType, data) {
  const notification = createGameNotification(eventType, data);
  
  if (!notification) return;
  
  pushSubscriptions.forEach((sub) => {
    // In production, send actual push notification
    console.log(`Would send push notification to ${sub.id}:`, notification);
    
    // TODO: Implement actual push sending with web-push
    /*
    webpush.sendNotification(sub.subscription, JSON.stringify(notification))
      .catch(error => {
        console.error('Push notification failed:', error);
        if (error.statusCode === 410) {
          // Subscription expired, remove it
          pushSubscriptions.delete(sub.subscription.endpoint);
        }
      });
    */
  });
}

function createGameNotification(eventType, data) {
  const notifications = {
    'guild_war': {
      title: 'Guild War Declared!',
      body: `War has been declared between ${data.guild1} and ${data.guild2}`,
      icon: '/icons/icon-192x192.svg',
      tag: 'guild-war'
    },
    'research_complete': {
      title: 'Research Complete!',
      body: `${data.techName} research has been completed`,
      icon: '/icons/icon-192x192.svg',
      tag: 'research-complete'
    },
    'faction_reputation': {
      title: `Faction Update - ${data.factionName}`,
      body: `Your reputation has changed to ${data.reputation}`,
      icon: '/icons/icon-192x192.svg',
      tag: 'faction-update'
    },
    'player_achievement': {
      title: 'Achievement Unlocked!',
      body: data.achievementName,
      icon: '/icons/icon-192x192.svg',
      tag: 'achievement'
    }
  };
  
  return notifications[eventType];
}

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
  
  // Get ores from current sectors instead of global ores
  let currentOres = ores; // Legacy fallback
  let currentHazards = []; // Environmental hazards for client display
  
  if (sectorManager) {
    // Collect ores and hazards from all loaded sectors
    const allSectorOres = [];
    const allSectorHazards = [];
    
    // Handle both legacy SectorManager and EnhancedSectorManager
    const sectors = sectorManager.loadedSectors || sectorManager.activeSectors;
    if (sectors) {
      for (const sector of sectors.values()) {
        if (sector.isLoaded) {
          allSectorOres.push(...sector.ores);
          if (sector.environmentalHazards) {
            allSectorHazards.push(...sector.environmentalHazards);
          }
        }
      }
    }
    
    if (allSectorOres.length > 0) {
      currentOres = allSectorOres;
    }
    currentHazards = allSectorHazards;
  }
  
  const state = {
    type: 'update',
    players: playerList,
    ores: currentOres,
    hazards: currentHazards
  };
  broadcast(state);
}

// Broadcast sector-specific events
function broadcastSectorEvent(event) {
  // Find players in the affected sector
  const sectorKey = `${event.sectorCoordinates.x}_${event.sectorCoordinates.y}`;
  const playersInSector = [];
  
  for (const [ws, player] of activePlayers.entries()) {
    const playerSectorKey = sectorManager.playerSectors.get(player.id);
    if (playerSectorKey === sectorKey) {
      playersInSector.push(ws);
    }
  }
  
  // Broadcast to players in the sector
  const payload = JSON.stringify({
    type: 'sector_event',
    event: event
  });
  
  playersInSector.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
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
  
  if (player.stats.totalDistanceTraveled >= ACHIEVEMENTS.TRAVELER.threshold) {
    if (await db.awardAchievement(player.id, 'distance', ACHIEVEMENTS.TRAVELER.name, ACHIEVEMENTS.TRAVELER.desc)) {
      achievements.push(ACHIEVEMENTS.TRAVELER);
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
  await db.updateLeaderboard(player.id, 'kills', player.stats.kills || 0);
  if (player.stats.deaths > 0) {
    await db.updateLeaderboard(player.id, 'kdr', Math.round((player.stats.kills / player.stats.deaths) * 100) / 100);
  }
}

// Combat system functions
function handleWeaponFire(ws, player, data) {
  // Check if player is alive
  if (player.isDead) {
    return;
  }
  
  // Check if player has weapons
  if (!player.shipProperties || player.shipProperties.damage <= 0) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'No weapons equipped!' 
    }));
    return;
  }
  
  // Check weapon cooldown
  const now = Date.now();
  const lastFire = weaponCooldowns.get(player.id) || 0;
  if (now - lastFire < WEAPON_COOLDOWN) {
    return;
  }
  
  // Find target player
  const targetPlayer = Array.from(activePlayers.values()).find(p => p.id === data.targetId);
  if (!targetPlayer || targetPlayer.isDead) {
    return;
  }
  
  // Check range
  const dx = targetPlayer.x - player.x;
  const dy = targetPlayer.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const weaponRange = player.shipProperties.weaponRange || 0;
  
  if (distance > weaponRange) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Target out of range!' 
    }));
    return;
  }
  
  // Create projectile
  const projectileId = uuidv4();
  const projectile = {
    id: projectileId,
    fromId: player.id,
    targetId: data.targetId,
    x: player.x,
    y: player.y,
    targetX: targetPlayer.x,
    targetY: targetPlayer.y,
    damage: player.shipProperties.damage,
    startTime: now,
    duration: distance / PROJECTILE_SPEED * 1000 // milliseconds
  };
  
  projectiles.set(projectileId, projectile);
  weaponCooldowns.set(player.id, now);
  
  // Broadcast projectile to all players
  broadcast({
    type: 'projectile',
    projectile: {
      id: projectileId,
      fromId: player.id,
      x: player.x,
      y: player.y,
      targetX: targetPlayer.x,
      targetY: targetPlayer.y,
      duration: projectile.duration
    }
  });
}

async function processProjectileHits() {
  const now = Date.now();
  const hitProjectiles = [];
  
  for (const [id, projectile] of projectiles.entries()) {
    if (now >= projectile.startTime + projectile.duration) {
      hitProjectiles.push(projectile);
      projectiles.delete(id);
    }
  }
  
  for (const projectile of hitProjectiles) {
    await processHit(projectile);
  }
}

async function processHit(projectile) {
  // Find target player
  const targetPlayer = Array.from(activePlayers.values()).find(p => p.id === projectile.targetId);
  const shooterPlayer = Array.from(activePlayers.values()).find(p => p.id === projectile.fromId);
  
  if (!targetPlayer || targetPlayer.isDead || !shooterPlayer) {
    return;
  }
  
  // Check invulnerability
  if (targetPlayer.invulnerableUntil && Date.now() < targetPlayer.invulnerableUntil) {
    return;
  }
  
  // Apply damage
  const damage = projectile.damage;
  targetPlayer.health = Math.max(0, (targetPlayer.health || targetPlayer.shipProperties.maxHealth) - damage);
  
  // Find target WebSocket
  const targetWs = Array.from(activePlayers.entries()).find(([ws, p]) => p.id === targetPlayer.id)?.[0];
  
  // Broadcast hit
  broadcast({
    type: 'hit',
    targetId: targetPlayer.id,
    shooterId: shooterPlayer.id,
    damage: damage,
    health: targetPlayer.health,
    maxHealth: targetPlayer.shipProperties.maxHealth
  });
  
  // Check for destruction
  if (targetPlayer.health <= 0) {
    await handlePlayerDestroyed(targetPlayer, shooterPlayer);
  }
}

async function handlePlayerDestroyed(targetPlayer, shooterPlayer) {
  targetPlayer.isDead = true;
  targetPlayer.health = 0;
  targetPlayer.stats.deaths = (targetPlayer.stats.deaths || 0) + 1;
  
  // Award kill to shooter
  if (shooterPlayer) {
    shooterPlayer.stats.kills = (shooterPlayer.stats.kills || 0) + 1;
    
    // Award combat skill points for destroying enemy
    if (skillSystem) {
      await skillSystem.awardSkillPoints(shooterPlayer.id, 'enemy_destroyed', 5);
    }
    
    // Award resources for kill
    const killReward = 50 + (targetPlayer.level * 25);
    shooterPlayer.resources += killReward;
    
    // Check combat achievements
    const achievements = await checkCombatAchievements(shooterPlayer);
    if (achievements.length > 0) {
      const shooterWs = Array.from(activePlayers.entries()).find(([ws, p]) => p.id === shooterPlayer.id)?.[0];
      if (shooterWs) {
        shooterWs.send(JSON.stringify({ type: 'achievements', achievements }));
      }
    }
    
    // Update databases
    await db.updatePlayerStats(shooterPlayer.id, {
      kills: shooterPlayer.stats.kills,
      resources: shooterPlayer.resources
    });
  }
  
  // Update target player database
  await db.updatePlayerStats(targetPlayer.id, {
    deaths: targetPlayer.stats.deaths
  });
  
  // Update leaderboards
  if (shooterPlayer) await updateLeaderboards(shooterPlayer);
  await updateLeaderboards(targetPlayer);
  
  // Broadcast destruction
  broadcast({
    type: 'destroyed',
    playerId: targetPlayer.id,
    killerId: shooterPlayer?.id,
    killerName: shooterPlayer?.username
  });
}

async function checkCombatAchievements(player) {
  const achievements = [];
  const kills = player.stats.kills || 0;
  
  if (kills >= ACHIEVEMENTS.FIRST_BLOOD.threshold) {
    if (await db.awardAchievement(player.id, 'kills', ACHIEVEMENTS.FIRST_BLOOD.name, ACHIEVEMENTS.FIRST_BLOOD.desc)) {
      achievements.push(ACHIEVEMENTS.FIRST_BLOOD);
    }
  }
  
  if (kills >= ACHIEVEMENTS.WARRIOR.threshold) {
    if (await db.awardAchievement(player.id, 'kills', ACHIEVEMENTS.WARRIOR.name, ACHIEVEMENTS.WARRIOR.desc)) {
      achievements.push(ACHIEVEMENTS.WARRIOR);
    }
  }
  
  if (kills >= ACHIEVEMENTS.DESTROYER.threshold) {
    if (await db.awardAchievement(player.id, 'kills', ACHIEVEMENTS.DESTROYER.name, ACHIEVEMENTS.DESTROYER.desc)) {
      achievements.push(ACHIEVEMENTS.DESTROYER);
    }
  }
  
  if (kills >= ACHIEVEMENTS.ACE_PILOT.threshold) {
    if (await db.awardAchievement(player.id, 'kills', ACHIEVEMENTS.ACE_PILOT.name, ACHIEVEMENTS.ACE_PILOT.desc)) {
      achievements.push(ACHIEVEMENTS.ACE_PILOT);
    }
  }
  
  return achievements;
}

function handlePlayerRespawn(ws, player) {
  if (!player.isDead) {
    return;
  }
  
  // Reset player state
  player.isDead = false;
  player.health = player.shipProperties?.maxHealth || 100;
  player.invulnerableUntil = Date.now() + INVULNERABILITY_TIME;
  
  // Respawn at random location
  player.x = Math.random() * 800 - 400;
  player.y = Math.random() * 800 - 400;
  
  // Broadcast respawn
  broadcast({
    type: 'respawn',
    playerId: player.id,
    x: player.x,
    y: player.y,
    health: player.health,
    maxHealth: player.shipProperties?.maxHealth || 100
  });
  
  ws.send(JSON.stringify({
    type: 'respawned',
    health: player.health,
    maxHealth: player.shipProperties?.maxHealth || 100,
    invulnerableUntil: player.invulnerableUntil
  }));
}

// ===== GUILD SYSTEM API ENDPOINTS =====

// Get player's guild
app.get('/api/guild/my-guild', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const playerId = await validateToken(token);
    if (!playerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const guild = guildSystem.getPlayerGuild(playerId);
    if (!guild) {
      return res.status(404).json({ message: 'Player is not in a guild' });
    }

    const guildData = guild.getFullData();
    const members = Array.from(guild.members.values());
    
    res.json({
      success: true,
      guild: guildData,
      members: members,
      playerRole: guild.members.get(playerId)?.roleId
    });
  } catch (error) {
    console.error('Error getting player guild:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new guild
app.post('/api/guild/create', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const playerId = await validateToken(token);
    if (!playerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { name, tag, description, guildType, maxMembers, recruitmentOpen, requiresApplication } = req.body;
    
    const guild = await guildSystem.createGuild(playerId, name, tag, {
      description,
      guildType,
      maxMembers,
      recruitmentOpen,
      requiresApplication
    });

    res.json({
      success: true,
      guild: guild.getSummary()
    });
  } catch (error) {
    console.error('Error creating guild:', error);
    res.status(400).json({ message: error.message });
  }
});

// Search guilds
app.get('/api/guild/search', async (req, res) => {
  try {
    const criteria = {
      name: req.query.name,
      tag: req.query.tag,
      guildType: req.query.guildType,
      recruitmentOpen: req.query.recruitmentOpen === 'true',
      minLevel: parseInt(req.query.minLevel),
      maxLevel: parseInt(req.query.maxLevel),
      limit: parseInt(req.query.limit) || 20
    };

    const guilds = await guildSystem.searchGuilds(criteria);
    
    res.json({
      success: true,
      guilds: guilds
    });
  } catch (error) {
    console.error('Error searching guilds:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Apply to join a guild
app.post('/api/guild/:guildId/apply', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const playerId = await validateToken(token);
    if (!playerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { guildId } = req.params;
    const { message } = req.body;

    const result = await guildSystem.applyToGuild(playerId, guildId, message);
    
    res.json({
      success: true,
      status: result.status,
      applicationId: result.applicationId
    });
  } catch (error) {
    console.error('Error applying to guild:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get guild members
app.get('/api/guild/:guildId/members', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const playerId = await validateToken(token);
    if (!playerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { guildId } = req.params;
    const guild = guildSystem.getGuild(guildId);
    
    if (!guild) {
      return res.status(404).json({ message: 'Guild not found' });
    }

    // Check if player is a member
    if (!guild.members.has(playerId)) {
      return res.status(403).json({ message: 'Not a guild member' });
    }

    const members = [];
    for (const [memberId, member] of guild.members.entries()) {
      const playerData = await db.getPlayerData(memberId);
      if (playerData) {
        const role = guild.roles.get(member.roleId);
        members.push({
          playerId: memberId,
          username: playerData.username,
          roleId: member.roleId,
          roleName: role?.name || 'Unknown',
          contributionPoints: member.contributionPoints,
          joinedAt: member.joinedAt,
          lastActive: member.lastActive,
          isOnline: activePlayers.has(memberId)
        });
      }
    }

    res.json({
      success: true,
      members: members
    });
  } catch (error) {
    console.error('Error getting guild members:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Leave guild
app.post('/api/guild/leave', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const playerId = await validateToken(token);
    if (!playerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const result = await guildSystem.leaveGuild(playerId);
    
    res.json({
      success: true,
      message: `You have left ${result.formerGuild}`
    });
  } catch (error) {
    console.error('Error leaving guild:', error);
    res.status(400).json({ message: error.message });
  }
});

// Kick member from guild
app.post('/api/guild/kick/:targetPlayerId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const kickerId = await validateToken(token);
    if (!kickerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { targetPlayerId } = req.params;
    const { reason } = req.body;

    const result = await guildSystem.kickMember(kickerId, targetPlayerId, reason);
    
    res.json({
      success: true,
      message: 'Member kicked successfully'
    });
  } catch (error) {
    console.error('Error kicking member:', error);
    res.status(400).json({ message: error.message });
  }
});

// Change member role
app.post('/api/guild/role/:targetPlayerId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const changerId = await validateToken(token);
    if (!changerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { targetPlayerId } = req.params;
    const { newRoleId } = req.body;

    const result = await guildSystem.changeMemberRole(changerId, targetPlayerId, newRoleId);
    
    res.json({
      success: true,
      newRole: result.newRole
    });
  } catch (error) {
    console.error('Error changing member role:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get guild events
app.get('/api/guild/:guildId/events', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const playerId = await validateToken(token);
    if (!playerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { guildId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const guild = guildSystem.getGuild(guildId);
    if (!guild || !guild.members.has(playerId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const events = await guildSystem.getGuildEvents(guildId, limit);
    
    res.json({
      success: true,
      events: events
    });
  } catch (error) {
    console.error('Error getting guild events:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Contribute resources to guild
app.post('/api/guild/contribute', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const playerId = await validateToken(token);
    if (!playerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { resourceType, amount } = req.body;

    const result = await guildSystem.contributeResources(playerId, resourceType, amount);
    
    res.json({
      success: true,
      resources: result.resources,
      levelUp: result.levelUp
    });
  } catch (error) {
    console.error('Error contributing resources:', error);
    res.status(400).json({ message: error.message });
  }
});

// Set diplomatic relations
app.post('/api/guild/diplomacy/:targetGuildId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const playerId = await validateToken(token);
    if (!playerId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { targetGuildId } = req.params;
    const { relationType } = req.body;

    const result = await guildSystem.setGuildRelation(playerId, targetGuildId, relationType);
    
    res.json({
      success: true,
      relation: result.relation
    });
  } catch (error) {
    console.error('Error setting guild relation:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get guild leaderboard
app.get('/api/guild/leaderboard', async (req, res) => {
  try {
    const category = req.query.category || 'level';
    const limit = parseInt(req.query.limit) || 10;

    const leaderboard = await guildSystem.getGuildLeaderboard(category, limit);
    
    res.json({
      success: true,
      leaderboard: leaderboard
    });
  } catch (error) {
    console.error('Error getting guild leaderboard:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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
        
        // Initialize player in sector system
        const currentCoords = sectorManager.getSectorCoordinatesForPosition(player.x, player.y);
        await sectorManager.movePlayerToSector(player.id, currentCoords, { x: player.x, y: player.y });
        
        // Calculate and set ship properties based on modules
        const properties = updateShipProperties(player);
        
        activePlayers.set(ws, player);
        
        // Add player to faction system
        if (factionOrchestrator) {
          factionOrchestrator.addPlayer(player.id, player);
        }
        
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
        
        // Award engineering skill points for building components
        if (skillSystem) {
          await skillSystem.awardSkillPoints(player.id, 'component_installed', 2);
        }
        
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
          
          // Award engineering skill points for building components
          if (skillSystem) {
            await skillSystem.awardSkillPoints(player.id, 'component_installed', 2);
          }
          
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
      
    } else if (data.type === 'fire') {
      // Handle weapon firing
      handleWeaponFire(ws, player, data);
      
    } else if (data.type === 'respawn') {
      // Handle player respawn
      handlePlayerRespawn(ws, player);
      
    } else if (data.type === 'request_galaxy_map') {
      // Send galaxy map data around player's current sector
      const currentCoords = sectorManager.getSectorCoordinatesForPosition(player.x, player.y);
      const radius = data.radius || 5;
      const mapData = sectorManager.getGalaxyMapData(currentCoords, radius);
      
      ws.send(JSON.stringify({
        type: 'galaxy_map',
        mapData,
        currentSector: currentCoords
      }));
      
    } else if (data.type === 'request_warp_targets') {
      // Send available warp destinations
      const destinations = await warpSystem.getWarpDestinations(player.id, player, data.maxRange || 5);
      
      ws.send(JSON.stringify({
        type: 'warp_targets',
        destinations,
        warpDriveRating: warpSystem.getWarpDriveRating(player)
      }));
      
    } else if (data.type === 'initiate_warp') {
      // Handle warp initiation
      const targetCoords = { x: data.targetX, y: data.targetY };
      const result = await warpSystem.initiateWarp(player.id, player, targetCoords, data.isEmergencyWarp);
      
      ws.send(JSON.stringify({
        type: 'warp_result',
        result
      }));
      
      // If warp was successful, inform other players in current sector
      if (result.success && !data.isEmergencyWarp) {
        broadcast({
          type: 'player_warp_start',
          playerId: player.id,
          playerName: player.username,
          fromCoords: result.fromCoords,
          toCoords: result.toCoords,
          travelTime: result.travelTime
        });
      }
      
    } else if (data.type === 'cancel_warp') {
      // Handle warp cancellation
      const result = await warpSystem.cancelWarp(player.id);
      
      if (result.success && result.fuelRefund > 0) {
        player.resources += result.fuelRefund;
        await db.updatePlayerStats(player.id, { resources: player.resources });
      }
      
      ws.send(JSON.stringify({
        type: 'warp_cancelled',
        result
      }));
      
    } else if (data.type === 'request_warp_status') {
      // Send current warp status
      const warpStatus = warpSystem.getWarpStatus(player.id);
      
      ws.send(JSON.stringify({
        type: 'warp_status',
        status: warpStatus
      }));
      
    } else if (data.type === 'request_sector_info') {
      // Send detailed information about current sector
      const currentSector = sectorManager.getPlayerSector(player.id);
      
      if (currentSector && typeof currentSector.getSectorData === 'function') {
        try {
          ws.send(JSON.stringify({
            type: 'sector_info',
            sector: currentSector.getSectorData()
          }));
        } catch (error) {
          console.error('Error getting sector data:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to get sector information'
          }));
        }
      } else {
        console.warn('No valid sector found for player:', player.id);
        ws.send(JSON.stringify({
          type: 'sector_info',
          sector: null
        }));
      }
      
    // ===== SKILL SYSTEM HANDLERS =====
    } else if (data.type === 'get_player_skills') {
      try {
        // Get player's current skills and skill points
        const playerSkills = await skillSystem.getPlayerSkills(data.playerId);
        
        // Get detailed progress for each skill tree
        const treeProgress = {};
        const skillTrees = skillSystem.getAllSkillTrees();
        
        for (const treeName of Object.keys(skillTrees)) {
          treeProgress[treeName] = await skillSystem.getSkillTreeProgress(data.playerId, treeName);
        }
        
        ws.send(JSON.stringify({
          type: 'player_skills_data',
          skills: playerSkills.skills,
          skillPoints: playerSkills.skillPoints,
          treeProgress: treeProgress
        }));
      } catch (error) {
        console.error('Error getting player skills:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to get skill data'
        }));
      }
      
    } else if (data.type === 'upgrade_skill') {
      try {
        const result = await skillSystem.upgradeSkill(data.playerId, data.skillTree, data.skillName);
        
        if (result.success) {
          // Award achievement for first skill upgrade
          if (result.newLevel === 1) {
            await db.awardAchievement(data.playerId, 'progression', 'First Skill', 'Upgraded your first skill');
          }
          
          // Award achievement for maxing a skill
          const skillTree = skillSystem.getSkillTreeInfo(data.skillTree);
          const skill = skillTree?.skills[data.skillName];
          if (skill && result.newLevel >= skill.maxLevel) {
            await db.awardAchievement(data.playerId, 'progression', 'Skill Master', `Maxed out ${skill.name}`);
          }
          
          ws.send(JSON.stringify({
            type: 'skill_upgrade_success',
            skillTree: data.skillTree,
            skillName: data.skillName,
            newLevel: result.newLevel,
            pointsSpent: result.pointsSpent
          }));
          
          // Broadcast skill upgrade notification to other players if desired
          // Could be used for guild notifications, etc.
        }
      } catch (error) {
        console.error('Error upgrading skill:', error);
        ws.send(JSON.stringify({
          type: 'skill_upgrade_error',
          error: error.message
        }));
      }
      
    } else if (data.type === 'get_skill_effects') {
      try {
        const effects = await skillSystem.calculatePlayerSkillEffects(data.playerId);
        
        ws.send(JSON.stringify({
          type: 'skill_effects_data',
          effects: effects
        }));
      } catch (error) {
        console.error('Error calculating skill effects:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to calculate skill effects'
        }));
      }
      
    } else if (data.type === 'get_skill_history') {
      try {
        const history = await skillSystem.getSkillHistory(data.playerId, data.limit || 20);
        
        ws.send(JSON.stringify({
          type: 'skill_history_data',
          history: history
        }));
      } catch (error) {
        console.error('Error getting skill history:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to get skill history'
        }));
      }
      
    } else if (data.type === 'reset_skills') {
      try {
        if (!data.confirmationCode || data.confirmationCode !== 'RESET_SKILLS_CONFIRMED') {
          ws.send(JSON.stringify({
            type: 'skill_reset_error',
            error: 'Invalid confirmation code'
          }));
          return;
        }
        
        const result = await skillSystem.resetPlayerSkills(data.playerId, data.confirmationCode);
        
        if (result.success) {
          ws.send(JSON.stringify({
            type: 'skill_reset_success',
            refundedPoints: result.refundedPoints
          }));
        }
      } catch (error) {
        console.error('Error resetting skills:', error);
        ws.send(JSON.stringify({
          type: 'skill_reset_error',
          error: error.message
        }));
      }
      
    // ===== RESEARCH SYSTEM ENDPOINTS =====
    } else if (data.type === 'getResearchData') {
      try {
        const researchProgress = await researchSystem.getPlayerResearchProgress(player.id);
        const researchPoints = await researchSystem.getPlayerResearchPoints(player.id);
        const laboratories = await researchStation.getPlayerLaboratories(player.id);
        
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: true,
          data: {
            researchProgress,
            researchPoints,
            laboratories
          }
        }));
      } catch (error) {
        console.error('Error getting research data:', error);
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: false,
          message: error.message
        }));
      }
      
    } else if (data.type === 'startResearch') {
      try {
        const projectId = await researchSystem.startResearchProject(
          player.id, 
          data.technologyId, 
          data.projectType || 'INDIVIDUAL',
          data.guildId || null
        );
        
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: true,
          data: { projectId }
        }));
        
        // Broadcast research started event
        broadcast({
          type: 'researchStarted',
          playerId: player.id,
          technologyId: data.technologyId,
          projectId
        });
        
      } catch (error) {
        console.error('Error starting research:', error);
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: false,
          message: error.message
        }));
      }
      
    } else if (data.type === 'buildLaboratory') {
      try {
        const result = await researchStation.buildLaboratory(
          player.id,
          data.sectorX,
          data.sectorY,
          data.x,
          data.y,
          data.laboratoryType,
          data.name,
          data.guildId || null
        );
        
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: true,
          data: result
        }));
        
      } catch (error) {
        console.error('Error building laboratory:', error);
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: false,
          message: error.message
        }));
      }
      
    } else if (data.type === 'upgradeLaboratory') {
      try {
        await researchStation.upgradeLaboratory(player.id, data.labId, data.upgradeType);
        
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: true
        }));
        
      } catch (error) {
        console.error('Error upgrading laboratory:', error);
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: false,
          message: error.message
        }));
      }
      
    } else if (data.type === 'performMaintenance') {
      try {
        await researchStation.performMaintenance(player.id, data.labId);
        
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: true
        }));
        
      } catch (error) {
        console.error('Error performing maintenance:', error);
        const callback = data.callback;
        ws.send(JSON.stringify({
          type: 'callback',
          callbackId: callback,
          success: false,
          message: error.message
        }));
      }
    }
  });
  
  // Handle disconnection
  ws.on('close', async () => {
    if (player) {
      activePlayers.delete(ws);
      broadcast({ type: 'player_disconnect', id: player.id });
      
      // Remove from faction system
      if (factionOrchestrator) {
        factionOrchestrator.removePlayer(player.id);
      }
      
      // Remove from sector system
      if (sectorManager) {
        await sectorManager.handlePlayerLeave(player.id);
      }
      
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

// ===== TRADING SYSTEM INTEGRATION =====

/**
 * Spawn trading stations in a sector based on biome and probability
 */
async function spawnTradingStationsInSector(sectorX, sectorY, biomeType, seed) {
  try {
    // Check if stations already exist
    const existingStations = await db.getTradingStations(sectorX, sectorY);
    if (existingStations.length > 0) {
      return; // Already has stations
    }
    
    // Determine if this sector should have trading stations
    const stationProbability = calculateStationSpawnProbability(biomeType, sectorX, sectorY);
    
    // Create seeded RNG for consistent generation
    let currentSeed = seed;
    const seededRandom = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
    
    if (seededRandom() < stationProbability) {
      // Determine number of stations (1-2 for most sectors, 3+ for hub sectors)
      const maxStations = biomeType === 'DEEP_SPACE' ? 3 : (seededRandom() < 0.3 ? 2 : 1);
      const stationCount = Math.ceil(seededRandom() * maxStations);
      
      console.log(`Spawning ${stationCount} trading station(s) in sector (${sectorX}, ${sectorY}) - ${biomeType}`);
      
      for (let i = 0; i < stationCount; i++) {
        // Create new trading station
        const station = new TradingStation(
          { x: sectorX, y: sectorY },
          biomeType,
          seed + i, // Different seed for each station
          db
        );
        
        // Save to database
        await station.saveToDB();
        
        // Cache the station
        const sectorKey = `${sectorX},${sectorY}`;
        if (!tradingStations.has(sectorKey)) {
          tradingStations.set(sectorKey, []);
        }
        tradingStations.get(sectorKey).push(station);
      }
    }
  } catch (error) {
    console.error(`Error spawning trading stations in sector (${sectorX}, ${sectorY}):`, error);
  }
}

/**
 * Calculate probability of trading station spawning based on biome and location
 */
function calculateStationSpawnProbability(biomeType, sectorX, sectorY) {
  let baseProbability = 0.15; // 15% base chance
  
  // Biome-specific modifiers
  const biomeModifiers = {
    'ASTEROID_FIELD': 0.25, // 25% - mining operations common
    'NEBULA': 0.15, // 15% - fuel depots
    'DEEP_SPACE': 0.30, // 30% - trade hubs in empty space
    'STELLAR_NURSERY': 0.10, // 10% - dangerous, fewer stations
    'ANCIENT_RUINS': 0.20, // 20% - research stations
    'BLACK_HOLE_REGION': 0.05 // 5% - very dangerous
  };
  
  baseProbability = biomeModifiers[biomeType] || baseProbability;
  
  // Distance from origin affects probability
  const distance = Math.sqrt(sectorX * sectorX + sectorY * sectorY);
  if (distance < 3) {
    baseProbability *= 1.5; // 50% bonus near starting area
  } else if (distance > 15) {
    baseProbability *= 0.7; // 30% reduction in far sectors
  }
  
  // Major trade routes (every 5 sectors in cardinal directions)
  if ((sectorX === 0 && sectorY % 5 === 0) || (sectorY === 0 && sectorX % 5 === 0)) {
    baseProbability *= 2.0; // Double chance on trade routes
  }
  
  return Math.min(0.8, baseProbability); // Cap at 80% max
}

/**
 * Load trading stations for a sector
 */
async function loadTradingStationsForSector(sectorX, sectorY) {
  try {
    const sectorKey = `${sectorX},${sectorY}`;
    
    // Check if already cached
    if (tradingStations.has(sectorKey)) {
      return tradingStations.get(sectorKey);
    }
    
    // Load from database
    const stationData = await db.getTradingStations(sectorX, sectorY);
    const stations = [];
    
    for (const data of stationData) {
      try {
        const station = await TradingStation.loadFromDB(data.id, db);
        stations.push(station);
      } catch (error) {
        console.error(`Error loading trading station ${data.id}:`, error);
      }
    }
    
    // Cache the stations
    tradingStations.set(sectorKey, stations);
    return stations;
    
  } catch (error) {
    console.error(`Error loading trading stations for sector (${sectorX}, ${sectorY}):`, error);
    return [];
  }
}

/**
 * Update trading systems (called periodically)
 */
async function updateTradingSystems() {
  try {
    // Update market system
    if (marketSystem) {
      await marketSystem.update();
    }
    
    // Update all cached trading stations
    for (const [sectorKey, stations] of tradingStations.entries()) {
      for (const station of stations) {
        station.update(); // Update pricing and inventory
      }
      
      // Occasionally save stations to database (every 10th update cycle)
      if (Math.random() < 0.1) {
        for (const station of stations) {
          try {
            await station.saveToDB();
          } catch (error) {
            console.error(`Error saving station ${station.id}:`, error);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error updating trading systems:', error);
  }
}

/**
 * Integrate trading stations with sector discovery
 */
async function onSectorDiscovered(playerId, sectorX, sectorY, sectorData) {
  try {
    // Award exploration skill points for discovering new sectors
    if (skillSystem) {
      await skillSystem.awardSkillPoints(playerId, 'sector_discovered', 3);
    }
    
    // Spawn trading stations if needed
    await spawnTradingStationsInSector(sectorX, sectorY, sectorData.biome_type, sectorData.seed);
    
    // Load stations for the sector
    await loadTradingStationsForSector(sectorX, sectorY);
    
  } catch (error) {
    console.error(`Error handling sector discovery for trading system:`, error);
  }
}

/**
 * Initialize starting trading stations in sectors near origin
 */
async function initializeStartingTradingStations() {
  try {
    console.log('Initializing starting trading stations...');
    
    // Create trading stations in key starting sectors
    const startingSectors = [
      { x: 0, y: 0, biome: 'DEEP_SPACE' },     // Origin - guaranteed trade hub
      { x: 1, y: 0, biome: 'ASTEROID_FIELD' },  // Mining depot
      { x: 0, y: 1, biome: 'NEBULA' },         // Fuel depot
      { x: -1, y: 0, biome: 'ANCIENT_RUINS' }, // Research station
      { x: 0, y: -1, biome: 'ASTEROID_FIELD' } // Another mining depot
    ];
    
    for (const sectorInfo of startingSectors) {
      // Get or create the sector
      let sector = await sectorManager.getSector(sectorInfo.x, sectorInfo.y);
      if (!sector) {
        // Create the sector if it doesn't exist
        sector = await sectorManager.generateSector(sectorInfo.x, sectorInfo.y, null, sectorInfo.biome);
      }
      
      // Force spawn a trading station in this sector
      const seedForStation = Math.abs(sectorInfo.x * 1000 + sectorInfo.y);
      
      // Check if station already exists
      const existingStations = await db.getTradingStations(sectorInfo.x, sectorInfo.y);
      if (existingStations.length === 0) {
        // Create new trading station
        const station = new TradingStation(
          { x: sectorInfo.x, y: sectorInfo.y },
          sector.biomeType || sectorInfo.biome,
          seedForStation,
          db
        );
        
        // Save to database
        await station.saveToDB();
        console.log(`Created starting trading station: ${station.name} at (${sectorInfo.x}, ${sectorInfo.y})`);
        
        // Cache the station
        const sectorKey = `${sectorInfo.x},${sectorInfo.y}`;
        if (!tradingStations.has(sectorKey)) {
          tradingStations.set(sectorKey, []);
        }
        tradingStations.get(sectorKey).push(station);
      } else {
        console.log(`Trading station already exists at (${sectorInfo.x}, ${sectorInfo.y})`);
      }
    }
    
    console.log('Starting trading stations initialization complete');
  } catch (error) {
    console.error('Error initializing starting trading stations:', error);
  }
}

// Main game loop
function startGameLoop() {
  const TICK_INTERVAL = 1000 / 30;
  
  setInterval(async () => {
    // Process combat projectiles
    await processProjectileHits();
    
    // Process warp completions
    if (warpSystem) {
      const completedWarps = await warpSystem.processWarpCompletions();
      for (const { playerId, warpOp } of completedWarps) {
        const player = Array.from(activePlayers.values()).find(p => p.id === playerId);
        if (player) {
          const result = await warpSystem.completeWarp(playerId, warpOp, player);
          if (result.success) {
            // Award research points for exploration
            if (researchSystem) {
              await researchSystem.generateResearchPointsFromActivity(playerId, 'EXPLORATION', { 
                fromSector: { x: warpOp.fromSectorX, y: warpOp.fromSectorY },
                toSector: { x: warpOp.toSectorX, y: warpOp.toSectorY },
                distance: Math.abs(warpOp.toSectorX - warpOp.fromSectorX) + Math.abs(warpOp.toSectorY - warpOp.fromSectorY)
              });
            }
            
            // Find player's WebSocket and notify of warp completion
            const playerWs = Array.from(activePlayers.entries()).find(([ws, p]) => p.id === playerId)?.[0];
            if (playerWs) {
              playerWs.send(JSON.stringify({
                type: 'warp_completed',
                result
              }));
            }
          }
        }
      }
    }
    
    // Update all loaded sectors
    if (sectorManager) {
      const triggeredEvents = sectorManager.updateAllSectors();
      
      // Broadcast sector events to players in affected sectors
      for (const event of triggeredEvents) {
        broadcastSectorEvent(event);
      }
    }
    
    // Update player positions
    for (const [ws, p] of activePlayers.entries()) {
      // Skip movement if dead
      if (p.isDead) {
        continue;
      }
      
      // Update ship properties if they don't exist or components changed
      if (!p.shipProperties) {
        updateShipProperties(p);
      }
      
      // Shield regeneration
      const shieldRegen = p.shipProperties?.componentCounts?.shield ? 
        p.shipProperties.componentCounts.shield * COMPONENT_EFFECTS.shield.regenBonus : 0;
      if (shieldRegen > 0 && p.health < p.shipProperties.maxHealth) {
        p.health = Math.min(p.shipProperties.maxHealth, (p.health || p.shipProperties.maxHealth) + (shieldRegen / 30));
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
        
        // Update player position in faction system
        if (factionOrchestrator) {
          factionOrchestrator.updatePlayer(p.id, p);
        }
        
        // Process hazard effects for player movement
        if (sectorManager && sectorManager.updatePlayerPosition) {
          try {
            await sectorManager.updatePlayerPosition(p.id, p.sectorX || 0, p.sectorY || 0, p.x, p.y);
          } catch (error) {
            console.error('Error processing player hazard effects:', error);
          }
        }
      }
    }
    
    // Handle ore collection (both legacy and sector-based)
    for (const [ws, p] of activePlayers.entries()) {
      // Skip ore collection for dead players
      if (p.isDead) {
        continue;
      }
      
      const collectionRange = p.shipProperties?.collectionRange || BASE_COLLECTION_RANGE;
      const cargoCapacity = p.shipProperties?.cargoCapacity || BASE_CARGO_CAPACITY;
      const collectionEfficiency = p.shipProperties?.componentCounts?.cargo ? 
        1 + (p.shipProperties.componentCounts.cargo * COMPONENT_EFFECTS.cargo.efficiencyBonus) : 1;
      
      // Get player's current sector
      const currentSector = sectorManager ? sectorManager.getPlayerSector(p.id) : null;
      
      if (currentSector && currentSector.isLoaded) {
        // Use sector-based ore collection
        for (const ore of currentSector.ores) {
          const dx = p.x - ore.x;
          const dy = p.y - ore.y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq < collectionRange * collectionRange) {
            // Check cargo capacity
            if (p.resources >= cargoCapacity) {
              ws.send(JSON.stringify({
                type: 'message',
                message: `Cargo full! Capacity: ${cargoCapacity}. Need more cargo modules.`,
                category: 'warning'
              }));
              continue;
            }
            
            const oreTypeData = ORE_TYPES[ore.type] || { value: ore.value };
            const collectedAmount = Math.round(oreTypeData.value * collectionEfficiency);
            p.resources += collectedAmount;
            p.stats.totalResourcesCollected += oreTypeData.value;
            p.level = 1 + Math.floor(p.stats.totalResourcesCollected / 200);
            
            // Award skill points for exploration and trading activities
            if (skillSystem) {
              await skillSystem.awardSkillPoints(p.id, 'ore_collected', 1);
            }
            
            // Award research points for mining activities
            if (researchSystem) {
              await researchSystem.generateResearchPointsFromActivity(p.id, 'MINING', { 
                oreType: ore.type,
                value: collectedAmount 
              });
            }
            
            // Remove ore from sector
            currentSector.removeOre(ore.id);
            
            // Mark ore as collected in database
            await db.collectSectorOre(ore.id, p.id);
            
            // Send ore collection notification with type info
            ws.send(JSON.stringify({
              type: 'ore_collected',
              oreType: ore.type,
              oreName: oreTypeData.name || ore.type,
              value: collectedAmount,
              oreColor: oreTypeData.color || '#FFD700'
            }));
            
            // Check for achievements
            const achievements = await checkAchievements(p);
            if (achievements.length > 0) {
              ws.send(JSON.stringify({ type: 'achievements', achievements }));
            }
            
            break;
          }
        }
      } else {
        // Fallback to legacy ore collection for backward compatibility
        for (const ore of ores) {
          const dx = p.x - ore.x;
          const dy = p.y - ore.y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq < collectionRange * collectionRange) {
            // Check cargo capacity
            if (p.resources >= cargoCapacity) {
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
            
            // Award skill points for exploration and trading activities
            if (skillSystem) {
              await skillSystem.awardSkillPoints(p.id, 'ore_collected', 1);
            }
            
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
    
    // Update trading systems every 30 seconds (every 900 ticks at 30 FPS)
    if (Date.now() % 30000 < TICK_INTERVAL * 2) {
      await updateTradingSystems();
    }
    
    // Update faction system
    if (factionOrchestrator) {
      await factionOrchestrator.update();
    }
    
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
    
    // Remove from sector system
    if (sectorManager) {
      await sectorManager.handlePlayerLeave(player.id);
    }
    
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
  
  // Save all loaded sector data
  if (sectorManager) {
    await sectorManager.saveAllSectors();
  }
  
  // Shutdown faction system
  if (factionOrchestrator) {
    await factionOrchestrator.shutdown();
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