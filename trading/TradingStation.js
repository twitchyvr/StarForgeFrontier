/**
 * TradingStation.js - NPC trading station system for StarForgeFrontier
 * Manages autonomous trading stations in sectors with dynamic inventory and pricing
 */

const { v4: uuidv4 } = require('uuid');
const { BIOME_TYPES, ORE_TYPES } = require('../galaxy/Sector');

// Trading station types based on biome specialization
const STATION_TYPES = {
  MINING_DEPOT: {
    name: 'Mining Depot',
    description: 'Specialized in raw ore processing and trading',
    preferredBiomes: ['ASTEROID_FIELD', 'BLACK_HOLE_REGION'],
    buyMultiplier: 1.1, // Pays 10% more for raw materials
    sellMultiplier: 0.9, // Sells refined goods at discount
    inventoryCapacity: 5000,
    restockFrequency: 3600000 // 1 hour in milliseconds
  },
  RESEARCH_STATION: {
    name: 'Research Station',
    description: 'Advanced technology and exotic matter trading',
    preferredBiomes: ['ANCIENT_RUINS', 'STELLAR_NURSERY'],
    buyMultiplier: 1.3, // Premium prices for rare materials
    sellMultiplier: 1.2, // Expensive tech components
    inventoryCapacity: 2000,
    restockFrequency: 7200000 // 2 hours
  },
  FUEL_DEPOT: {
    name: 'Fuel Depot',
    description: 'Energy and fuel trading hub',
    preferredBiomes: ['NEBULA', 'STELLAR_NURSERY'],
    buyMultiplier: 1.0,
    sellMultiplier: 0.8, // Cheap fuel and energy
    inventoryCapacity: 8000,
    restockFrequency: 1800000 // 30 minutes
  },
  TRADE_HUB: {
    name: 'Trade Hub',
    description: 'General trading post for all goods',
    preferredBiomes: ['DEEP_SPACE', 'ASTEROID_FIELD'],
    buyMultiplier: 0.9, // Lower buy prices
    sellMultiplier: 1.1, // Higher sell prices
    inventoryCapacity: 6000,
    restockFrequency: 5400000 // 1.5 hours
  },
  SALVAGE_YARD: {
    name: 'Salvage Yard',
    description: 'Buys damaged goods, sells reclaimed materials',
    preferredBiomes: ['BLACK_HOLE_REGION', 'DEEP_SPACE'],
    buyMultiplier: 0.7, // Low prices for everything
    sellMultiplier: 0.6, // Very cheap goods
    inventoryCapacity: 10000,
    restockFrequency: 10800000 // 3 hours
  },
  LUXURY_TRADER: {
    name: 'Luxury Trader',
    description: 'High-end rare materials and components',
    preferredBiomes: ['ANCIENT_RUINS', 'NEBULA'],
    buyMultiplier: 1.5, // Premium buy prices
    sellMultiplier: 2.0, // Very expensive luxury goods
    inventoryCapacity: 1000,
    restockFrequency: 14400000 // 4 hours
  }
};

// Station names by type for procedural generation
const STATION_NAMES = {
  MINING_DEPOT: [
    'Asteroid Mining Co.', 'Deep Rock Mining', 'Ore Extraction Alpha',
    'Mining Station Beta', 'Rock Breaker Station', 'Mineral Processing Hub'
  ],
  RESEARCH_STATION: [
    'Science Outpost Delta', 'Research Lab Gamma', 'Xenotech Institute',
    'Advanced Materials Lab', 'Quantum Research Station', 'Tech Innovation Hub'
  ],
  FUEL_DEPOT: [
    'Fuel Stop Alpha', 'Energy Station Prime', 'Refueling Platform',
    'Power Cell Depot', 'Fusion Fuel Station', 'Energy Trading Post'
  ],
  TRADE_HUB: [
    'Commerce Central', 'Trade Station Alpha', 'Merchant Platform',
    'Commercial Outpost', 'Trading Post Prime', 'Market Station'
  ],
  SALVAGE_YARD: [
    'Scrap & Salvage', 'Junkyard Station', 'Salvage Operations',
    'Reclamation Depot', 'Wreck Recovery Station', 'Scrap Trader'
  ],
  LUXURY_TRADER: [
    'Elite Trading Co.', 'Premium Goods Station', 'Luxury Materials',
    'High-End Trader', 'Exclusive Commerce', 'Rare Finds Emporium'
  ]
};

class TradingStation {
  constructor(sectorCoordinates, biomeType, seed, database) {
    this.coordinates = sectorCoordinates;
    this.biomeType = biomeType;
    this.seed = seed;
    this.database = database;
    this.id = uuidv4();
    
    // Create seeded RNG for consistent generation
    this.rng = this.createSeededRNG(seed);
    
    // Determine station type based on biome
    this.stationType = this.determineStationType(biomeType);
    this.config = STATION_TYPES[this.stationType];
    
    // Generate station properties
    this.name = this.generateStationName();
    this.position = this.generatePosition();
    this.reputationModifier = 1.0;
    this.inventory = new Map();
    this.lastRestocked = Date.now();
    
    // Initialize inventory based on biome and station type
    this.initializeInventory();
  }

  /**
   * Create seeded random number generator
   */
  createSeededRNG(seed) {
    let currentSeed = seed;
    return {
      random: () => {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        return currentSeed / 233280;
      },
      randomInt: (min, max) => {
        return Math.floor(this.rng.random() * (max - min + 1)) + min;
      },
      choice: (array) => {
        return array[Math.floor(this.rng.random() * array.length)];
      }
    };
  }

  /**
   * Determine station type based on biome with some randomization
   */
  determineStationType(biomeType) {
    // Get preferred station types for this biome
    const preferredTypes = [];
    const secondaryTypes = [];
    
    for (const [stationType, config] of Object.entries(STATION_TYPES)) {
      if (config.preferredBiomes.includes(biomeType)) {
        preferredTypes.push(stationType);
      } else {
        secondaryTypes.push(stationType);
      }
    }
    
    // 70% chance for preferred type, 30% for any type
    if (preferredTypes.length > 0 && this.rng.random() < 0.7) {
      return this.rng.choice(preferredTypes);
    } else {
      return this.rng.choice([...preferredTypes, ...secondaryTypes]);
    }
  }

  /**
   * Generate station name
   */
  generateStationName() {
    const names = STATION_NAMES[this.stationType];
    return this.rng.choice(names);
  }

  /**
   * Generate station position in sector
   */
  generatePosition() {
    // Position stations away from sector center to avoid ore conflicts
    const angle = this.rng.random() * Math.PI * 2;
    const distance = 300 + this.rng.random() * 200; // 300-500 pixels from center
    
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    };
  }

  /**
   * Initialize station inventory based on biome and type
   */
  initializeInventory() {
    const biomeConfig = BIOME_TYPES[this.biomeType];
    const stationConfig = this.config;
    
    // Add biome-specific ores that the station trades
    biomeConfig.oreTypes.forEach(oreType => {
      const oreConfig = ORE_TYPES[oreType];
      this.addInventoryItem(oreType, oreConfig);
    });
    
    // Add some cross-biome trading opportunities
    const allOreTypes = Object.keys(ORE_TYPES);
    const additionalOres = this.rng.randomInt(2, 4); // 2-4 additional ore types
    
    for (let i = 0; i < additionalOres; i++) {
      const oreType = this.rng.choice(allOreTypes);
      if (!this.inventory.has(oreType)) {
        const oreConfig = ORE_TYPES[oreType];
        this.addInventoryItem(oreType, oreConfig, 0.3); // Lower multiplier for non-biome ores
      }
    }
  }

  /**
   * Add inventory item with pricing
   */
  addInventoryItem(oreType, oreConfig, rarityMultiplier = 1.0) {
    const basePrice = oreConfig.value;
    const stationConfig = this.config;
    
    // Calculate buy/sell prices with station modifiers
    const baseBuyPrice = Math.floor(basePrice * stationConfig.buyMultiplier);
    const baseSellPrice = Math.floor(basePrice * stationConfig.sellMultiplier);
    
    // Initial stock based on rarity (more common = more stock)
    const maxStock = Math.floor((oreConfig.rarity * stationConfig.inventoryCapacity * rarityMultiplier) / 2);
    const currentStock = this.rng.randomInt(Math.floor(maxStock * 0.3), maxStock);
    
    const inventoryItem = {
      oreType,
      quantity: currentStock,
      maxQuantity: maxStock,
      baseBuyPrice,
      baseSellPrice,
      currentBuyPrice: baseBuyPrice,
      currentSellPrice: baseSellPrice,
      supplyLevel: currentStock / maxStock,
      demandLevel: this.rng.random() * 0.6 + 0.2, // 0.2 to 0.8
      lastPriceUpdate: Date.now()
    };
    
    this.inventory.set(oreType, inventoryItem);
  }

  /**
   * Update dynamic pricing based on supply and demand
   */
  updatePricing() {
    for (const [oreType, item] of this.inventory.entries()) {
      // Update supply level
      item.supplyLevel = item.quantity / item.maxQuantity;
      
      // Dynamic demand simulation (slowly fluctuates over time)
      const demandVariation = (this.rng.random() - 0.5) * 0.1; // ±5% change
      item.demandLevel = Math.max(0.1, Math.min(0.9, item.demandLevel + demandVariation));
      
      // Calculate price adjustments
      // Low supply = higher sell prices, lower buy prices
      // High demand = higher buy prices, higher sell prices
      const supplyMultiplier = 1.0 + (0.5 - item.supplyLevel) * 0.6; // ±30% based on supply
      const demandMultiplier = 0.7 + item.demandLevel * 0.6; // 70%-130% based on demand
      
      // Update current prices
      item.currentBuyPrice = Math.floor(item.baseBuyPrice * demandMultiplier);
      item.currentSellPrice = Math.floor(item.baseSellPrice * supplyMultiplier);
      item.lastPriceUpdate = Date.now();
      
      // Ensure sell price is always higher than buy price
      if (item.currentSellPrice <= item.currentBuyPrice) {
        item.currentSellPrice = item.currentBuyPrice + 1;
      }
    }
  }

  /**
   * Restock station inventory
   */
  restock() {
    const now = Date.now();
    if (now - this.lastRestocked < this.config.restockFrequency) {
      return false; // Too soon to restock
    }
    
    for (const [oreType, item] of this.inventory.entries()) {
      // Gradually restock towards max capacity
      const restockAmount = Math.floor((item.maxQuantity - item.quantity) * 0.3);
      item.quantity = Math.min(item.maxQuantity, item.quantity + restockAmount);
    }
    
    this.lastRestocked = now;
    return true;
  }

  /**
   * Process buy order from player (station buys from player)
   */
  processBuyOrder(oreType, quantity, playerId) {
    const item = this.inventory.get(oreType);
    if (!item) {
      throw new Error(`Station does not trade ${oreType}`);
    }
    
    // Check if station has capacity to buy
    const availableCapacity = item.maxQuantity - item.quantity;
    const actualQuantity = Math.min(quantity, availableCapacity);
    
    if (actualQuantity <= 0) {
      throw new Error('Station inventory full');
    }
    
    const totalPrice = actualQuantity * item.currentBuyPrice;
    
    // Update inventory
    item.quantity += actualQuantity;
    
    // Update pricing due to increased supply
    this.updatePricing();
    
    return {
      quantity: actualQuantity,
      pricePerUnit: item.currentBuyPrice,
      totalPrice,
      remaining: quantity - actualQuantity
    };
  }

  /**
   * Process sell order to player (station sells to player)
   */
  processSellOrder(oreType, quantity, playerId) {
    const item = this.inventory.get(oreType);
    if (!item) {
      throw new Error(`Station does not have ${oreType}`);
    }
    
    // Check availability
    const actualQuantity = Math.min(quantity, item.quantity);
    
    if (actualQuantity <= 0) {
      throw new Error('Station out of stock');
    }
    
    const totalPrice = actualQuantity * item.currentSellPrice;
    
    // Update inventory
    item.quantity -= actualQuantity;
    
    // Update pricing due to decreased supply
    this.updatePricing();
    
    return {
      quantity: actualQuantity,
      pricePerUnit: item.currentSellPrice,
      totalPrice,
      remaining: quantity - actualQuantity
    };
  }

  /**
   * Get station market data for client
   */
  getMarketData() {
    const marketData = {
      stationId: this.id,
      stationName: this.name,
      stationType: this.stationType,
      biomeType: this.biomeType,
      position: this.position,
      inventory: []
    };
    
    for (const [oreType, item] of this.inventory.entries()) {
      marketData.inventory.push({
        oreType,
        oreName: ORE_TYPES[oreType].name,
        quantity: item.quantity,
        maxQuantity: item.maxQuantity,
        buyPrice: item.currentBuyPrice,
        sellPrice: item.currentSellPrice,
        supplyLevel: item.supplyLevel,
        demandLevel: item.demandLevel,
        stockStatus: this.getStockStatus(item)
      });
    }
    
    return marketData;
  }

  /**
   * Get stock status description
   */
  getStockStatus(item) {
    if (item.supplyLevel > 0.8) return 'Overstocked';
    if (item.supplyLevel > 0.6) return 'Well Stocked';
    if (item.supplyLevel > 0.4) return 'Moderate Stock';
    if (item.supplyLevel > 0.2) return 'Low Stock';
    if (item.supplyLevel > 0.0) return 'Critical Stock';
    return 'Out of Stock';
  }

  /**
   * Save station data to database
   */
  async saveToDB() {
    // Save station record
    await this.database.createTradingStation({
      id: this.id,
      sector_x: this.coordinates.x,
      sector_y: this.coordinates.y,
      station_name: this.name,
      station_type: this.stationType,
      biome_type: this.biomeType,
      x: this.position.x,
      y: this.position.y,
      reputation_modifier: this.reputationModifier
    });
    
    // Save inventory data
    for (const [oreType, item] of this.inventory.entries()) {
      await this.database.updateStationInventory(this.id, oreType, {
        quantity: item.quantity,
        base_buy_price: item.baseBuyPrice,
        base_sell_price: item.baseSellPrice,
        current_buy_price: item.currentBuyPrice,
        current_sell_price: item.currentSellPrice,
        supply_level: item.supplyLevel,
        demand_level: item.demandLevel
      });
    }
  }

  /**
   * Load station data from database
   */
  static async loadFromDB(stationId, database) {
    const stationData = await database.getTradingStation(stationId);
    if (!stationData) {
      throw new Error(`Station ${stationId} not found`);
    }
    
    // Create station instance
    const station = new TradingStation(
      { x: stationData.sector_x, y: stationData.sector_y },
      stationData.biome_type,
      stationData.id.hashCode(), // Use station ID as seed for consistency
      database
    );
    
    // Override generated values with database values
    station.id = stationData.id;
    station.name = stationData.station_name;
    station.stationType = stationData.station_type;
    station.position = { x: stationData.x, y: stationData.y };
    station.reputationModifier = stationData.reputation_modifier;
    
    // Load inventory
    const inventoryData = await database.getStationInventory(stationId);
    station.inventory.clear();
    
    for (const item of inventoryData) {
      station.inventory.set(item.ore_type, {
        oreType: item.ore_type,
        quantity: item.quantity,
        maxQuantity: item.quantity * 2, // Estimate based on current stock
        baseBuyPrice: item.base_buy_price,
        baseSellPrice: item.base_sell_price,
        currentBuyPrice: item.current_buy_price,
        currentSellPrice: item.current_sell_price,
        supplyLevel: item.supply_level,
        demandLevel: item.demand_level,
        lastPriceUpdate: new Date(item.last_price_update).getTime()
      });
    }
    
    return station;
  }

  /**
   * Update station (called periodically by server)
   */
  update() {
    // Restock if needed
    this.restock();
    
    // Update pricing
    this.updatePricing();
  }
}

// Helper function to hash string to number
String.prototype.hashCode = function() {
  let hash = 0;
  if (this.length === 0) return hash;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

module.exports = {
  TradingStation,
  STATION_TYPES,
  STATION_NAMES
};