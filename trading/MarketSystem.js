/**
 * MarketSystem.js - Advanced market mechanics for StarForgeFrontier trading
 * Handles price tracking, supply/demand calculations, and player-to-player trading
 */

const { v4: uuidv4 } = require('uuid');
const { ORE_TYPES } = require('../galaxy/Sector');

class MarketSystem {
  constructor(database) {
    this.database = database;
    this.activeOrders = new Map(); // In-memory order book
    this.priceCache = new Map(); // Cached market prices
    this.regionalPrices = new Map(); // Regional price modifiers
    
    // Market configuration
    this.config = {
      orderExpiry: 86400000, // 24 hours in milliseconds
      maxOrdersPerPlayer: 10,
      minOrderValue: 10,
      maxOrderValue: 100000,
      priceVolatility: 0.1, // 10% maximum price change per update
      regionalInfluence: 0.3, // How much regional supply/demand affects prices
      priceHistoryDays: 30
    };
    
    // Initialize system
    this.initializeMarketData();
  }

  /**
   * Initialize market data and load existing orders
   */
  async initializeMarketData() {
    try {
      // Load regional price data
      await this.calculateRegionalPrices();
      
      // Load active orders from database
      await this.loadActiveOrders();
      
      console.log('Market system initialized successfully');
    } catch (error) {
      console.error('Error initializing market system:', error);
    }
  }

  /**
   * Calculate regional price modifiers based on sector distribution
   */
  async calculateRegionalPrices() {
    // Get all trading stations grouped by biome
    const stations = await this.database.all(
      'SELECT biome_type, COUNT(*) as station_count FROM trading_stations WHERE is_active = 1 GROUP BY biome_type'
    );
    
    // Calculate supply/demand for each ore type based on biome distribution
    for (const [oreType, oreConfig] of Object.entries(ORE_TYPES)) {
      const regionalData = {
        basePrice: oreConfig.value,
        supplyModifier: 1.0,
        demandModifier: 1.0,
        volatility: oreConfig.rarity > 0.3 ? 0.05 : 0.15, // Rare ores more volatile
        lastUpdate: Date.now()
      };
      
      // Find biomes that naturally have this ore
      const sourceBiomes = this.getBiomesForOre(oreType);
      const totalStations = stations.reduce((sum, s) => sum + s.station_count, 0);
      const sourceStations = stations
        .filter(s => sourceBiomes.includes(s.biome_type))
        .reduce((sum, s) => sum + s.station_count, 0);
      
      // Supply is higher if more stations in source biomes
      if (totalStations > 0) {
        const sourceRatio = sourceStations / totalStations;
        regionalData.supplyModifier = 0.7 + sourceRatio * 0.6; // 0.7 to 1.3 multiplier
        regionalData.demandModifier = 1.5 - sourceRatio * 0.5; // 1.0 to 1.5 multiplier
      }
      
      this.regionalPrices.set(oreType, regionalData);
    }
  }

  /**
   * Get biomes that naturally contain a specific ore type
   */
  getBiomesForOre(oreType) {
    const biomes = [];
    for (const [biomeKey, biomeConfig] of Object.entries(require('../galaxy/Sector').BIOME_TYPES)) {
      if (biomeConfig.oreTypes.includes(oreType)) {
        biomes.push(biomeKey);
      }
    }
    return biomes;
  }

  /**
   * Load active orders from database
   */
  async loadActiveOrders() {
    const orders = await this.database.all(
      `SELECT * FROM trade_orders 
       WHERE status = 'active' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ORDER BY created_at ASC`
    );
    
    this.activeOrders.clear();
    for (const order of orders) {
      this.activeOrders.set(order.id, {
        id: order.id,
        playerId: order.player_id,
        stationId: order.station_id,
        orderType: order.order_type,
        oreType: order.ore_type,
        quantity: order.quantity,
        pricePerUnit: order.price_per_unit,
        totalValue: order.total_value,
        createdAt: new Date(order.created_at),
        expiresAt: order.expires_at ? new Date(order.expires_at) : null
      });
    }
  }

  /**
   * Create a buy or sell order
   */
  async createOrder(orderData) {
    const { playerId, stationId, orderType, oreType, quantity, pricePerUnit } = orderData;
    
    // Validate order parameters
    this.validateOrder(orderData);
    
    // Check player order limits
    await this.checkPlayerOrderLimits(playerId);
    
    const orderId = uuidv4();
    const totalValue = quantity * pricePerUnit;
    const expiresAt = new Date(Date.now() + this.config.orderExpiry);
    
    // Create order in database
    await this.database.createTradeOrder({
      id: orderId,
      player_id: playerId,
      station_id: stationId,
      order_type: orderType,
      ore_type: oreType,
      quantity,
      price_per_unit: pricePerUnit,
      total_value: totalValue,
      expires_at: expiresAt
    });
    
    // Add to active orders
    const order = {
      id: orderId,
      playerId,
      stationId,
      orderType,
      oreType,
      quantity,
      pricePerUnit,
      totalValue,
      createdAt: new Date(),
      expiresAt
    };
    
    this.activeOrders.set(orderId, order);
    
    // Try to match orders immediately
    await this.matchOrders(oreType, stationId);
    
    // Update market prices
    await this.updateMarketPrice(stationId, oreType);
    
    return order;
  }

  /**
   * Validate order parameters
   */
  validateOrder(orderData) {
    const { orderType, oreType, quantity, pricePerUnit } = orderData;
    
    if (!['buy', 'sell'].includes(orderType)) {
      throw new Error('Invalid order type. Must be "buy" or "sell"');
    }
    
    if (!ORE_TYPES[oreType]) {
      throw new Error(`Invalid ore type: ${oreType}`);
    }
    
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new Error('Quantity must be a positive integer');
    }
    
    if (pricePerUnit <= 0 || !Number.isInteger(pricePerUnit)) {
      throw new Error('Price per unit must be a positive integer');
    }
    
    const totalValue = quantity * pricePerUnit;
    if (totalValue < this.config.minOrderValue || totalValue > this.config.maxOrderValue) {
      throw new Error(`Order value must be between ${this.config.minOrderValue} and ${this.config.maxOrderValue}`);
    }
  }

  /**
   * Check if player has reached order limits
   */
  async checkPlayerOrderLimits(playerId) {
    const playerOrders = Array.from(this.activeOrders.values())
      .filter(order => order.playerId === playerId);
    
    if (playerOrders.length >= this.config.maxOrdersPerPlayer) {
      throw new Error(`Maximum ${this.config.maxOrdersPerPlayer} active orders per player`);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId, playerId) {
    const order = this.activeOrders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    if (order.playerId !== playerId) {
      throw new Error('Not authorized to cancel this order');
    }
    
    // Update database
    await this.database.updateTradeOrderStatus(orderId, 'cancelled');
    
    // Remove from active orders
    this.activeOrders.delete(orderId);
    
    return order;
  }

  /**
   * Match buy and sell orders
   */
  async matchOrders(oreType, stationId) {
    const buyOrders = Array.from(this.activeOrders.values())
      .filter(order => 
        order.oreType === oreType && 
        order.stationId === stationId && 
        order.orderType === 'buy'
      )
      .sort((a, b) => b.pricePerUnit - a.pricePerUnit); // Highest buy prices first
    
    const sellOrders = Array.from(this.activeOrders.values())
      .filter(order => 
        order.oreType === oreType && 
        order.stationId === stationId && 
        order.orderType === 'sell'
      )
      .sort((a, b) => a.pricePerUnit - b.pricePerUnit); // Lowest sell prices first
    
    // Match orders
    for (const buyOrder of buyOrders) {
      for (const sellOrder of sellOrders) {
        if (buyOrder.pricePerUnit >= sellOrder.pricePerUnit) {
          await this.executeTrade(buyOrder, sellOrder);
          break; // Move to next buy order
        }
      }
    }
  }

  /**
   * Execute a trade between two orders
   */
  async executeTrade(buyOrder, sellOrder) {
    const tradeQuantity = Math.min(buyOrder.quantity, sellOrder.quantity);
    const tradePrice = sellOrder.pricePerUnit; // Seller sets the price
    const totalValue = tradeQuantity * tradePrice;
    
    // Record trade in database
    await this.database.recordTrade({
      buyer_id: buyOrder.playerId,
      seller_id: sellOrder.playerId,
      station_id: buyOrder.stationId,
      ore_type: buyOrder.oreType,
      quantity: tradeQuantity,
      price_per_unit: tradePrice,
      total_value: totalValue,
      trade_type: 'player_to_player'
    });
    
    // Record market price
    await this.database.recordMarketPrice(
      buyOrder.stationId,
      buyOrder.oreType,
      tradePrice,
      tradePrice,
      tradeQuantity
    );
    
    // Update order quantities
    buyOrder.quantity -= tradeQuantity;
    sellOrder.quantity -= tradeQuantity;
    
    // Complete fulfilled orders
    if (buyOrder.quantity === 0) {
      await this.database.updateTradeOrderStatus(buyOrder.id, 'completed');
      this.activeOrders.delete(buyOrder.id);
    }
    
    if (sellOrder.quantity === 0) {
      await this.database.updateTradeOrderStatus(sellOrder.id, 'completed');
      this.activeOrders.delete(sellOrder.id);
    }
    
    // Update order quantities in database
    if (buyOrder.quantity > 0) {
      await this.database.run(
        'UPDATE trade_orders SET quantity = ?, total_value = ? WHERE id = ?',
        [buyOrder.quantity, buyOrder.quantity * buyOrder.pricePerUnit, buyOrder.id]
      );
    }
    
    if (sellOrder.quantity > 0) {
      await this.database.run(
        'UPDATE trade_orders SET quantity = ?, total_value = ? WHERE id = ?',
        [sellOrder.quantity, sellOrder.quantity * sellOrder.pricePerUnit, sellOrder.id]
      );
    }
    
    console.log(`Trade executed: ${tradeQuantity} ${buyOrder.oreType} at ${tradePrice} each`);
  }

  /**
   * Get order book for a specific ore and station
   */
  getOrderBook(oreType, stationId) {
    const buyOrders = Array.from(this.activeOrders.values())
      .filter(order => 
        order.oreType === oreType && 
        order.stationId === stationId && 
        order.orderType === 'buy'
      )
      .sort((a, b) => b.pricePerUnit - a.pricePerUnit)
      .slice(0, 10); // Top 10 buy orders
    
    const sellOrders = Array.from(this.activeOrders.values())
      .filter(order => 
        order.oreType === oreType && 
        order.stationId === stationId && 
        order.orderType === 'sell'
      )
      .sort((a, b) => a.pricePerUnit - b.pricePerUnit)
      .slice(0, 10); // Top 10 sell orders
    
    return {
      oreType,
      stationId,
      buyOrders: buyOrders.map(order => ({
        quantity: order.quantity,
        pricePerUnit: order.pricePerUnit,
        totalValue: order.totalValue
      })),
      sellOrders: sellOrders.map(order => ({
        quantity: order.quantity,
        pricePerUnit: order.pricePerUnit,
        totalValue: order.totalValue
      }))
    };
  }

  /**
   * Get market price for an ore at a station
   */
  async getMarketPrice(stationId, oreType) {
    const cacheKey = `${stationId}_${oreType}`;
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minute cache
      return cached.price;
    }
    
    // Get recent price history
    const recentPrices = await this.database.getMarketHistory(stationId, oreType, 10);
    
    if (recentPrices.length === 0) {
      // No price history, use base price with regional modifier
      const regionalData = this.regionalPrices.get(oreType);
      const basePrice = regionalData ? regionalData.basePrice : ORE_TYPES[oreType].value;
      return basePrice;
    }
    
    // Calculate weighted average with recent prices weighted more
    let totalWeight = 0;
    let weightedSum = 0;
    
    recentPrices.forEach((price, index) => {
      const weight = Math.pow(0.9, index); // Exponential decay
      const avgPrice = (price.buy_price + price.sell_price) / 2;
      weightedSum += avgPrice * weight;
      totalWeight += weight;
    });
    
    const marketPrice = Math.round(weightedSum / totalWeight);
    
    // Cache the result
    this.priceCache.set(cacheKey, {
      price: marketPrice,
      timestamp: Date.now()
    });
    
    return marketPrice;
  }

  /**
   * Update market price based on recent trading activity
   */
  async updateMarketPrice(stationId, oreType) {
    const currentPrice = await this.getMarketPrice(stationId, oreType);
    const regionalData = this.regionalPrices.get(oreType);
    
    if (!regionalData) return;
    
    // Calculate new price based on order book depth and regional factors
    const orderBook = this.getOrderBook(oreType, stationId);
    const buyPressure = orderBook.buyOrders.reduce((sum, order) => sum + order.quantity, 0);
    const sellPressure = orderBook.sellOrders.reduce((sum, order) => sum + order.quantity, 0);
    
    // Price influence based on buy/sell pressure
    let priceChange = 0;
    if (buyPressure > sellPressure) {
      priceChange = (buyPressure - sellPressure) / Math.max(buyPressure + sellPressure, 1) * this.config.priceVolatility;
    } else if (sellPressure > buyPressure) {
      priceChange = -(sellPressure - buyPressure) / Math.max(buyPressure + sellPressure, 1) * this.config.priceVolatility;
    }
    
    // Apply regional modifiers
    const regionalInfluence = this.config.regionalInfluence;
    const finalPrice = Math.round(currentPrice * (1 + priceChange * regionalInfluence));
    
    // Update regional data
    regionalData.basePrice = finalPrice;
    regionalData.lastUpdate = Date.now();
    
    // Clear cache to force recalculation
    this.priceCache.delete(`${stationId}_${oreType}`);
  }

  /**
   * Get player's active orders
   */
  getPlayerOrders(playerId) {
    return Array.from(this.activeOrders.values())
      .filter(order => order.playerId === playerId)
      .map(order => ({
        id: order.id,
        stationId: order.stationId,
        orderType: order.orderType,
        oreType: order.oreType,
        quantity: order.quantity,
        pricePerUnit: order.pricePerUnit,
        totalValue: order.totalValue,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt
      }));
  }

  /**
   * Get market summary for all stations and ores
   */
  async getMarketSummary() {
    const summary = {};
    
    // Get all active stations
    const stations = await this.database.all(
      'SELECT id, station_name FROM trading_stations WHERE is_active = 1'
    );
    
    for (const station of stations) {
      summary[station.id] = {
        stationName: station.station_name,
        markets: {}
      };
      
      for (const oreType of Object.keys(ORE_TYPES)) {
        const price = await this.getMarketPrice(station.id, oreType);
        const orderBook = this.getOrderBook(oreType, station.id);
        
        summary[station.id].markets[oreType] = {
          currentPrice: price,
          buyOrderCount: orderBook.buyOrders.length,
          sellOrderCount: orderBook.sellOrders.length,
          highestBuyPrice: orderBook.buyOrders[0]?.pricePerUnit || 0,
          lowestSellPrice: orderBook.sellOrders[0]?.pricePerUnit || 0
        };
      }
    }
    
    return summary;
  }

  /**
   * Clean up expired orders
   */
  async cleanupExpiredOrders() {
    const now = Date.now();
    const expiredOrders = [];
    
    for (const [orderId, order] of this.activeOrders.entries()) {
      if (order.expiresAt && order.expiresAt.getTime() < now) {
        expiredOrders.push(orderId);
      }
    }
    
    for (const orderId of expiredOrders) {
      await this.database.updateTradeOrderStatus(orderId, 'expired');
      this.activeOrders.delete(orderId);
    }
    
    if (expiredOrders.length > 0) {
      console.log(`Cleaned up ${expiredOrders.length} expired orders`);
    }
  }

  /**
   * Update market system (called periodically)
   */
  async update() {
    try {
      // Clean up expired orders
      await this.cleanupExpiredOrders();
      
      // Update regional prices
      await this.calculateRegionalPrices();
      
      // Clear old price cache entries
      const now = Date.now();
      for (const [key, cached] of this.priceCache.entries()) {
        if (now - cached.timestamp > 300000) { // 5 minutes
          this.priceCache.delete(key);
        }
      }
    } catch (error) {
      console.error('Error updating market system:', error);
    }
  }

  /**
   * Get trading statistics
   */
  async getTradingStats() {
    const stats = await this.database.all(`
      SELECT 
        ore_type,
        COUNT(*) as trade_count,
        SUM(quantity) as total_volume,
        AVG(price_per_unit) as avg_price,
        MIN(price_per_unit) as min_price,
        MAX(price_per_unit) as max_price
      FROM trade_history 
      WHERE traded_at > datetime('now', '-7 days')
      GROUP BY ore_type
    `);
    
    const activeOrderCount = await this.database.get(
      'SELECT COUNT(*) as count FROM trade_orders WHERE status = "active"'
    );
    
    return {
      weeklyStats: stats,
      activeOrders: activeOrderCount.count,
      totalActiveValue: Array.from(this.activeOrders.values())
        .reduce((sum, order) => sum + order.totalValue, 0)
    };
  }
}

module.exports = MarketSystem;