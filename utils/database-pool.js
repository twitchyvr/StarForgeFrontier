/**
 * Enhanced database module with connection pooling and query optimization
 * Extends the original Database class with performance improvements
 */

const sqlite3 = require('sqlite3').verbose();
const Database = require('../database');

class DatabasePool extends Database {
  constructor(options = {}) {
    super();
    
    this.poolSize = options.poolSize || 5;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.queryTimeout = options.queryTimeout || 10000;
    
    this.connectionPool = [];
    this.activeConnections = 0;
    this.waitingQueue = [];
    this.queryCache = new Map();
    this.cacheMaxSize = options.cacheMaxSize || 100;
    this.cacheMaxAge = options.cacheMaxAge || 300000; // 5 minutes
    
    // Performance metrics
    this.metrics = {
      queriesExecuted: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0,
      connectionPoolHits: 0,
      connectionPoolMisses: 0,
      retries: 0,
      timeouts: 0
    };
  }

  /**
   * Initialize the database pool
   */
  async initialize() {
    try {
      // Initialize main connection first
      await super.initialize();
      
      // Create connection pool
      for (let i = 0; i < this.poolSize; i++) {
        const connection = await this.createConnection();
        this.connectionPool.push({
          connection,
          inUse: false,
          createdAt: Date.now()
        });
      }
      
      console.log(`Database pool initialized with ${this.poolSize} connections`);
      
      // Start cache cleanup interval
      this.startCacheCleanup();
      
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to initialize database pool:', error);
      throw error;
    }
  }

  /**
   * Create a new database connection
   */
  async createConnection() {
    return new Promise((resolve, reject) => {
      let dbPath;
      if (process.env.NODE_ENV === 'test') {
        dbPath = ':memory:';
      } else if (process.env.DATABASE_PATH) {
        dbPath = process.env.DATABASE_PATH;
      } else {
        dbPath = 'starforge.db';
      }

      const connection = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Enable WAL mode for better concurrent performance
        connection.run('PRAGMA journal_mode = WAL', (err) => {
          if (err) {
            console.warn('Failed to enable WAL mode:', err);
          }
        });
        
        // Optimize SQLite settings
        connection.run('PRAGMA synchronous = NORMAL');
        connection.run('PRAGMA cache_size = 10000');
        connection.run('PRAGMA temp_store = MEMORY');
        
        resolve(connection);
      });
    });
  }

  /**
   * Get a connection from the pool
   */
  async getConnection() {
    return new Promise((resolve, reject) => {
      // Find an available connection
      const availableConnection = this.connectionPool.find(conn => !conn.inUse);
      
      if (availableConnection) {
        availableConnection.inUse = true;
        this.metrics.connectionPoolHits++;
        resolve(availableConnection);
        return;
      }

      // No available connections, add to waiting queue
      this.metrics.connectionPoolMisses++;
      this.waitingQueue.push({ resolve, reject, timestamp: Date.now() });
      
      // Set timeout for waiting requests
      setTimeout(() => {
        const index = this.waitingQueue.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
          this.metrics.timeouts++;
          reject(new Error('Database connection timeout'));
        }
      }, this.queryTimeout);
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(poolConnection) {
    poolConnection.inUse = false;
    
    // Check if there are waiting requests
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      poolConnection.inUse = true;
      waiting.resolve(poolConnection);
    }
  }

  /**
   * Enhanced run method with connection pooling and retries
   */
  async run(sql, params = []) {
    const startTime = Date.now();
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.executeWithPool('run', sql, params);
        this.updateMetrics(Date.now() - startTime);
        return result;
      } catch (error) {
        lastError = error;
        this.metrics.retries++;
        
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Enhanced get method with caching
   */
  async get(sql, params = []) {
    const cacheKey = this.getCacheKey(sql, params);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    const startTime = Date.now();
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.executeWithPool('get', sql, params);
        this.updateMetrics(Date.now() - startTime);
        this.metrics.cacheMisses++;
        
        // Cache the result if it's a SELECT query
        if (sql.trim().toLowerCase().startsWith('select')) {
          this.addToCache(cacheKey, result);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        this.metrics.retries++;
        
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Enhanced all method with caching
   */
  async all(sql, params = []) {
    const cacheKey = this.getCacheKey(sql, params);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    const startTime = Date.now();
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.executeWithPool('all', sql, params);
        this.updateMetrics(Date.now() - startTime);
        this.metrics.cacheMisses++;
        
        // Cache the result if it's a SELECT query
        if (sql.trim().toLowerCase().startsWith('select')) {
          this.addToCache(cacheKey, result);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        this.metrics.retries++;
        
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Execute query with connection pool
   */
  async executeWithPool(method, sql, params) {
    const poolConnection = await this.getConnection();
    
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.metrics.timeouts++;
          reject(new Error('Query timeout'));
        }, this.queryTimeout);

        const callback = (err, result) => {
          clearTimeout(timeout);
          if (err) reject(err);
          else resolve(result);
        };

        if (method === 'run') {
          poolConnection.connection.run(sql, params, function(err) {
            callback(err, { id: this.lastID, changes: this.changes });
          });
        } else if (method === 'get') {
          poolConnection.connection.get(sql, params, callback);
        } else if (method === 'all') {
          poolConnection.connection.all(sql, params, callback);
        }
      });
    } finally {
      this.releaseConnection(poolConnection);
    }
  }

  /**
   * Batch operations for better performance
   */
  async batch(operations) {
    const poolConnection = await this.getConnection();
    
    try {
      return await new Promise((resolve, reject) => {
        poolConnection.connection.serialize(() => {
          poolConnection.connection.run('BEGIN TRANSACTION');
          
          const results = [];
          let completed = 0;
          let hasError = false;

          operations.forEach((op, index) => {
            if (hasError) return;

            const callback = (err, result) => {
              if (hasError) return;
              
              if (err) {
                hasError = true;
                poolConnection.connection.run('ROLLBACK');
                reject(err);
                return;
              }

              results[index] = result;
              completed++;

              if (completed === operations.length) {
                poolConnection.connection.run('COMMIT', (err) => {
                  if (err) {
                    reject(err);
                  } else {
                    resolve(results);
                  }
                });
              }
            };

            if (op.method === 'run') {
              poolConnection.connection.run(op.sql, op.params, function(err) {
                callback(err, { id: this.lastID, changes: this.changes });
              });
            } else if (op.method === 'get') {
              poolConnection.connection.get(op.sql, op.params, callback);
            } else if (op.method === 'all') {
              poolConnection.connection.all(op.sql, op.params, callback);
            }
          });
        });
      });
    } finally {
      this.releaseConnection(poolConnection);
    }
  }

  /**
   * Cache management methods
   */
  getCacheKey(sql, params) {
    return sql + JSON.stringify(params);
  }

  getFromCache(key) {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return cached.data;
    }
    
    if (cached) {
      this.queryCache.delete(key);
    }
    
    return null;
  }

  addToCache(key, data) {
    // Remove oldest entries if cache is full
    if (this.queryCache.size >= this.cacheMaxSize) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
    
    this.queryCache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.queryCache.clear();
  }

  /**
   * Start cache cleanup interval
   */
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];
      
      for (const [key, value] of this.queryCache.entries()) {
        if (now - value.timestamp > this.cacheMaxAge) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        this.queryCache.delete(key);
      });
    }, this.cacheMaxAge / 2); // Cleanup every half cache max age
  }

  /**
   * Update performance metrics
   */
  updateMetrics(queryTime) {
    this.metrics.queriesExecuted++;
    this.metrics.averageQueryTime = 
      (this.metrics.averageQueryTime * (this.metrics.queriesExecuted - 1) + queryTime) / 
      this.metrics.queriesExecuted;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.metrics,
      cacheSize: this.queryCache.size,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      poolUtilization: this.connectionPool.filter(conn => conn.inUse).length / this.poolSize,
      waitingRequests: this.waitingQueue.length
    };
  }

  /**
   * Delay helper for retries
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close all connections in the pool
   */
  async close() {
    // Close main connection
    await super.close();
    
    // Close pool connections
    const closePromises = this.connectionPool.map(poolConn => {
      return new Promise(resolve => {
        poolConn.connection.close((err) => {
          if (err) {
            console.error('Error closing pool connection:', err);
          }
          resolve();
        });
      });
    });
    
    await Promise.all(closePromises);
    this.connectionPool = [];
    this.queryCache.clear();
    
    console.log('Database pool closed');
  }

  /**
   * Health check for the database pool
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      await this.get('SELECT 1 as health');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        poolStats: this.getPerformanceStats(),
        connections: {
          total: this.poolSize,
          active: this.connectionPool.filter(conn => conn.inUse).length,
          waiting: this.waitingQueue.length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        poolStats: this.getPerformanceStats()
      };
    }
  }
}

module.exports = DatabasePool;