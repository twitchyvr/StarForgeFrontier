/**
 * Comprehensive performance monitoring and profiling system
 * Tracks server performance metrics and provides optimization insights
 */

const EventEmitter = require('events');
const os = require('os');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      sampleInterval: options.sampleInterval || 1000, // 1 second
      historyLength: options.historyLength || 300, // 5 minutes of samples
      alertThresholds: {
        cpuUsage: options.cpuThreshold || 80,
        memoryUsage: options.memoryThreshold || 85,
        gameLoopTime: options.gameLoopThreshold || 50,
        activeConnections: options.connectionThreshold || 1000
      },
      enableProfiling: options.enableProfiling !== false,
      enableGCMonitoring: options.enableGCMonitoring !== false
    };
    
    // Performance metrics storage
    this.metrics = {
      server: {
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 0,
          external: 0,
          rss: 0
        },
        networkConnections: 0,
        requestsPerSecond: 0
      },
      game: {
        gameLoopTime: 0,
        averageGameLoopTime: 0,
        playersCount: 0,
        entitiesCount: 0,
        messagesPerSecond: 0,
        collisionChecks: 0,
        physicsTime: 0
      },
      database: {
        queriesPerSecond: 0,
        averageQueryTime: 0,
        connectionPoolUtilization: 0,
        cacheHitRate: 0
      },
      network: {
        bytesReceived: 0,
        bytesSent: 0,
        connectionsOpened: 0,
        connectionsClosed: 0,
        messagesQueued: 0
      }
    };
    
    // Historical data
    this.history = [];
    this.alerts = [];
    
    // Profiling data
    this.profiles = {
      functionCalls: new Map(),
      gameLoopBreakdown: [],
      memoryAllocations: [],
      networkTraffic: []
    };
    
    // Counters for rate calculations
    this.counters = {
      requests: 0,
      dbQueries: 0,
      networkMessages: 0,
      gameLoops: 0,
      lastSample: Date.now()
    };
    
    // GC monitoring
    this.gcStats = {
      collections: 0,
      totalTime: 0,
      averageTime: 0
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    
    if (this.options.enableGCMonitoring) {
      this.setupGCMonitoring();
    }
  }

  /**
   * Start performance monitoring
   */
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.options.sampleInterval);
    
    console.log('Performance monitoring started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('Performance monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Collect all performance metrics
   */
  collectMetrics() {
    const timestamp = Date.now();
    const timeDelta = timestamp - this.counters.lastSample;
    
    // Server metrics
    this.collectServerMetrics();
    
    // Rate calculations
    this.calculateRates(timeDelta);
    
    // Store historical data
    this.storeHistoricalData(timestamp);
    
    // Check thresholds and generate alerts
    this.checkAlertThresholds();
    
    // Update counters
    this.counters.lastSample = timestamp;
    
    // Emit metrics event
    this.emit('metricsCollected', this.getCurrentMetrics());
  }

  /**
   * Collect server-level metrics
   */
  collectServerMetrics() {
    // CPU usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    this.metrics.server.cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);
    
    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.server.memoryUsage = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    };
    
    // Uptime
    this.metrics.server.uptime = Math.round(process.uptime());
  }

  /**
   * Calculate rates (per second metrics)
   */
  calculateRates(timeDelta) {
    const deltaSeconds = timeDelta / 1000;
    
    if (deltaSeconds > 0) {
      this.metrics.server.requestsPerSecond = Math.round(this.counters.requests / deltaSeconds);
      this.metrics.database.queriesPerSecond = Math.round(this.counters.dbQueries / deltaSeconds);
      this.metrics.game.messagesPerSecond = Math.round(this.counters.networkMessages / deltaSeconds);
      
      // Reset counters
      this.counters.requests = 0;
      this.counters.dbQueries = 0;
      this.counters.networkMessages = 0;
      this.counters.gameLoops = 0;
    }
  }

  /**
   * Store metrics in historical data
   */
  storeHistoricalData(timestamp) {
    const snapshot = {
      timestamp,
      ...JSON.parse(JSON.stringify(this.metrics))
    };
    
    this.history.push(snapshot);
    
    // Maintain history length
    if (this.history.length > this.options.historyLength) {
      this.history.shift();
    }
  }

  /**
   * Check alert thresholds
   */
  checkAlertThresholds() {
    const thresholds = this.options.alertThresholds;
    const now = Date.now();
    
    // CPU usage alert
    if (this.metrics.server.cpuUsage > thresholds.cpuUsage) {
      this.createAlert('HIGH_CPU_USAGE', `CPU usage at ${this.metrics.server.cpuUsage}%`, 'warning');
    }
    
    // Memory usage alert
    const memoryPercent = (this.metrics.server.memoryUsage.heapUsed / this.metrics.server.memoryUsage.heapTotal) * 100;
    if (memoryPercent > thresholds.memoryUsage) {
      this.createAlert('HIGH_MEMORY_USAGE', `Memory usage at ${memoryPercent.toFixed(1)}%`, 'warning');
    }
    
    // Game loop time alert
    if (this.metrics.game.gameLoopTime > thresholds.gameLoopTime) {
      this.createAlert('SLOW_GAME_LOOP', `Game loop taking ${this.metrics.game.gameLoopTime}ms`, 'warning');
    }
    
    // Connection count alert
    if (this.metrics.server.networkConnections > thresholds.activeConnections) {
      this.createAlert('HIGH_CONNECTION_COUNT', `${this.metrics.server.networkConnections} active connections`, 'info');
    }
  }

  /**
   * Create an alert
   */
  createAlert(type, message, severity = 'info') {
    const alert = {
      type,
      message,
      severity,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };
    
    this.alerts.push(alert);
    
    // Maintain alerts history (keep last 100)
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    
    this.emit('alert', alert);
    console.warn(`[ALERT] ${severity.toUpperCase()}: ${message}`);
  }

  /**
   * Update game-specific metrics
   */
  updateGameMetrics(gameMetrics) {
    if (gameMetrics.gameLoopTime !== undefined) {
      this.metrics.game.gameLoopTime = gameMetrics.gameLoopTime;
      
      // Calculate running average
      if (this.metrics.game.averageGameLoopTime === 0) {
        this.metrics.game.averageGameLoopTime = gameMetrics.gameLoopTime;
      } else {
        this.metrics.game.averageGameLoopTime = 
          (this.metrics.game.averageGameLoopTime * 0.9) + (gameMetrics.gameLoopTime * 0.1);
      }
    }
    
    if (gameMetrics.playersCount !== undefined) {
      this.metrics.game.playersCount = gameMetrics.playersCount;
    }
    
    if (gameMetrics.entitiesCount !== undefined) {
      this.metrics.game.entitiesCount = gameMetrics.entitiesCount;
    }
    
    if (gameMetrics.collisionChecks !== undefined) {
      this.metrics.game.collisionChecks = gameMetrics.collisionChecks;
    }
    
    if (gameMetrics.physicsTime !== undefined) {
      this.metrics.game.physicsTime = gameMetrics.physicsTime;
    }
    
    this.counters.gameLoops++;
  }

  /**
   * Update database metrics
   */
  updateDatabaseMetrics(dbMetrics) {
    if (dbMetrics.averageQueryTime !== undefined) {
      this.metrics.database.averageQueryTime = dbMetrics.averageQueryTime;
    }
    
    if (dbMetrics.connectionPoolUtilization !== undefined) {
      this.metrics.database.connectionPoolUtilization = dbMetrics.connectionPoolUtilization;
    }
    
    if (dbMetrics.cacheHitRate !== undefined) {
      this.metrics.database.cacheHitRate = dbMetrics.cacheHitRate;
    }
    
    this.counters.dbQueries++;
  }

  /**
   * Update network metrics
   */
  updateNetworkMetrics(networkMetrics) {
    if (networkMetrics.bytesReceived !== undefined) {
      this.metrics.network.bytesReceived += networkMetrics.bytesReceived;
    }
    
    if (networkMetrics.bytesSent !== undefined) {
      this.metrics.network.bytesSent += networkMetrics.bytesSent;
    }
    
    if (networkMetrics.connectionsOpened !== undefined) {
      this.metrics.network.connectionsOpened += networkMetrics.connectionsOpened;
      this.metrics.server.networkConnections++;
    }
    
    if (networkMetrics.connectionsClosed !== undefined) {
      this.metrics.network.connectionsClosed += networkMetrics.connectionsClosed;
      this.metrics.server.networkConnections--;
    }
    
    if (networkMetrics.messagesQueued !== undefined) {
      this.metrics.network.messagesQueued = networkMetrics.messagesQueued;
    }
    
    this.counters.requests++;
    this.counters.networkMessages++;
  }

  /**
   * Profile a function call
   */
  profileFunction(functionName, duration) {
    if (!this.options.enableProfiling) return;
    
    if (!this.profiles.functionCalls.has(functionName)) {
      this.profiles.functionCalls.set(functionName, {
        callCount: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0
      });
    }
    
    const profile = this.profiles.functionCalls.get(functionName);
    profile.callCount++;
    profile.totalTime += duration;
    profile.averageTime = profile.totalTime / profile.callCount;
    profile.minTime = Math.min(profile.minTime, duration);
    profile.maxTime = Math.max(profile.maxTime, duration);
  }

  /**
   * Add game loop breakdown data
   */
  addGameLoopBreakdown(breakdown) {
    if (!this.options.enableProfiling) return;
    
    this.profiles.gameLoopBreakdown.push({
      timestamp: Date.now(),
      ...breakdown
    });
    
    // Keep only last 100 breakdowns
    if (this.profiles.gameLoopBreakdown.length > 100) {
      this.profiles.gameLoopBreakdown.shift();
    }
  }

  /**
   * Setup GC monitoring
   */
  setupGCMonitoring() {
    if (global.gc) {
      const originalGC = global.gc;
      global.gc = () => {
        const start = Date.now();
        originalGC();
        const gcTime = Date.now() - start;
        
        this.gcStats.collections++;
        this.gcStats.totalTime += gcTime;
        this.gcStats.averageTime = this.gcStats.totalTime / this.gcStats.collections;
        
        if (gcTime > 100) { // Alert for long GC pauses
          this.createAlert('LONG_GC_PAUSE', `Garbage collection took ${gcTime}ms`, 'warning');
        }
      };
    }
  }

  /**
   * Get current metrics snapshot
   */
  getCurrentMetrics() {
    return {
      timestamp: Date.now(),
      server: { ...this.metrics.server },
      game: { ...this.metrics.game },
      database: { ...this.metrics.database },
      network: { ...this.metrics.network },
      gc: { ...this.gcStats }
    };
  }

  /**
   * Get historical data
   */
  getHistoricalData(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.history.filter(entry => entry.timestamp >= cutoff);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(minutes = 10) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Get profiling data
   */
  getProfilingData() {
    if (!this.options.enableProfiling) {
      return { message: 'Profiling is disabled' };
    }
    
    return {
      functionCalls: Object.fromEntries(this.profiles.functionCalls),
      gameLoopBreakdown: this.profiles.gameLoopBreakdown.slice(-10), // Last 10 samples
      memoryAllocations: this.profiles.memoryAllocations.slice(-10),
      networkTraffic: this.profiles.networkTraffic.slice(-10)
    };
  }

  /**
   * Generate performance report
   */
  generateReport(timeRange = 5) { // Default 5 minutes
    const historicalData = this.getHistoricalData(timeRange);
    const recentAlerts = this.getRecentAlerts(timeRange);
    
    if (historicalData.length === 0) {
      return { message: 'No historical data available' };
    }
    
    // Calculate averages and trends
    const avgCPU = historicalData.reduce((sum, d) => sum + d.server.cpuUsage, 0) / historicalData.length;
    const avgMemory = historicalData.reduce((sum, d) => sum + d.server.memoryUsage.heapUsed, 0) / historicalData.length;
    const avgGameLoop = historicalData.reduce((sum, d) => sum + d.game.gameLoopTime, 0) / historicalData.length;
    const maxPlayers = Math.max(...historicalData.map(d => d.game.playersCount));
    
    const report = {
      timeRange: `${timeRange} minutes`,
      summary: {
        averageCPU: Math.round(avgCPU),
        averageMemory: Math.round(avgMemory),
        averageGameLoopTime: Math.round(avgGameLoop * 100) / 100,
        peakPlayers: maxPlayers,
        totalAlerts: recentAlerts.length
      },
      current: this.getCurrentMetrics(),
      alerts: recentAlerts,
      recommendations: this.generateRecommendations(historicalData)
    };
    
    return report;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(historicalData) {
    const recommendations = [];
    
    // CPU usage recommendations
    const avgCPU = historicalData.reduce((sum, d) => sum + d.server.cpuUsage, 0) / historicalData.length;
    if (avgCPU > 70) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'High CPU usage detected. Consider enabling physics worker threads or optimizing game loop.'
      });
    }
    
    // Memory usage recommendations
    const memoryTrend = this.calculateTrend(historicalData.map(d => d.server.memoryUsage.heapUsed));
    if (memoryTrend > 0.1) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'Memory usage is trending upward. Check for memory leaks and enable object pooling.'
      });
    }
    
    // Game loop performance
    const avgGameLoop = historicalData.reduce((sum, d) => sum + d.game.gameLoopTime, 0) / historicalData.length;
    if (avgGameLoop > 30) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Game loop is running slow. Enable player culling and spatial indexing optimizations.'
      });
    }
    
    // Database performance
    const avgQueryTime = historicalData.reduce((sum, d) => sum + d.database.averageQueryTime, 0) / historicalData.length;
    if (avgQueryTime > 50) {
      recommendations.push({
        type: 'database',
        priority: 'medium',
        message: 'Database queries are slow. Consider increasing connection pool size or adding query caching.'
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate trend (simple linear regression slope)
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  /**
   * Reset all metrics and history
   */
  reset() {
    this.metrics = {
      server: { uptime: 0, cpuUsage: 0, memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 }, networkConnections: 0, requestsPerSecond: 0 },
      game: { gameLoopTime: 0, averageGameLoopTime: 0, playersCount: 0, entitiesCount: 0, messagesPerSecond: 0, collisionChecks: 0, physicsTime: 0 },
      database: { queriesPerSecond: 0, averageQueryTime: 0, connectionPoolUtilization: 0, cacheHitRate: 0 },
      network: { bytesReceived: 0, bytesSent: 0, connectionsOpened: 0, connectionsClosed: 0, messagesQueued: 0 }
    };
    
    this.history = [];
    this.alerts = [];
    this.profiles.functionCalls.clear();
    this.profiles.gameLoopBreakdown = [];
    this.profiles.memoryAllocations = [];
    this.profiles.networkTraffic = [];
    
    this.counters = {
      requests: 0,
      dbQueries: 0,
      networkMessages: 0,
      gameLoops: 0,
      lastSample: Date.now()
    };
    
    this.gcStats = { collections: 0, totalTime: 0, averageTime: 0 };
  }
}

module.exports = PerformanceMonitor;