/**
 * Object pooling system for efficient memory management
 * Reduces garbage collection pressure by reusing objects
 */

class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10, maxSize = 1000) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.pool = [];
    this.activeObjects = new Set();
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
    
    // Metrics
    this.metrics = {
      created: initialSize,
      acquired: 0,
      released: 0,
      hits: 0,
      misses: 0
    };
  }

  /**
   * Get an object from the pool
   */
  acquire() {
    let obj;
    
    if (this.pool.length > 0) {
      obj = this.pool.pop();
      this.metrics.hits++;
    } else {
      obj = this.createFn();
      this.metrics.created++;
      this.metrics.misses++;
    }
    
    this.activeObjects.add(obj);
    this.metrics.acquired++;
    
    return obj;
  }

  /**
   * Return an object to the pool
   */
  release(obj) {
    if (!this.activeObjects.has(obj)) {
      return false; // Object not from this pool
    }
    
    this.activeObjects.delete(obj);
    
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
      this.metrics.released++;
      return true;
    }
    
    return false; // Pool is full, object will be garbage collected
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.metrics,
      poolSize: this.pool.length,
      activeObjects: this.activeObjects.size,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0
    };
  }

  /**
   * Clear the pool
   */
  clear() {
    this.pool.length = 0;
    this.activeObjects.clear();
  }
}

/**
 * Global object pool manager for various game objects
 */
class ObjectPoolManager {
  constructor() {
    this.pools = new Map();
    this.initializePools();
  }

  /**
   * Initialize pools for common game objects
   */
  initializePools() {
    // Ore object pool
    this.createPool('ore', {
      create: () => ({
        id: null,
        x: 0,
        y: 0,
        value: 0,
        type: 'common',
        collected: false,
        spawned: 0
      }),
      reset: (ore) => {
        ore.id = null;
        ore.x = 0;
        ore.y = 0;
        ore.value = 0;
        ore.type = 'common';
        ore.collected = false;
        ore.spawned = 0;
      },
      initialSize: 50,
      maxSize: 500
    });

    // Projectile object pool
    this.createPool('projectile', {
      create: () => ({
        id: null,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        damage: 0,
        range: 0,
        ownerId: null,
        active: false,
        spawned: 0,
        traveled: 0
      }),
      reset: (projectile) => {
        projectile.id = null;
        projectile.x = 0;
        projectile.y = 0;
        projectile.vx = 0;
        projectile.vy = 0;
        projectile.damage = 0;
        projectile.range = 0;
        projectile.ownerId = null;
        projectile.active = false;
        projectile.spawned = 0;
        projectile.traveled = 0;
      },
      initialSize: 20,
      maxSize: 200
    });

    // Particle effect pool
    this.createPool('particle', {
      create: () => ({
        id: null,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0,
        size: 0,
        color: '#ffffff',
        alpha: 1,
        type: 'default'
      }),
      reset: (particle) => {
        particle.id = null;
        particle.x = 0;
        particle.y = 0;
        particle.vx = 0;
        particle.vy = 0;
        particle.life = 0;
        particle.maxLife = 0;
        particle.size = 0;
        particle.color = '#ffffff';
        particle.alpha = 1;
        particle.type = 'default';
      },
      initialSize: 30,
      maxSize: 300
    });

    // Event object pool
    this.createPool('event', {
      create: () => ({
        id: null,
        type: null,
        x: 0,
        y: 0,
        data: {},
        triggerAt: 0,
        processed: false
      }),
      reset: (event) => {
        event.id = null;
        event.type = null;
        event.x = 0;
        event.y = 0;
        event.data = {};
        event.triggerAt = 0;
        event.processed = false;
      },
      initialSize: 10,
      maxSize: 100
    });

    // Message object pool for network optimization
    this.createPool('message', {
      create: () => ({
        type: null,
        data: {},
        recipients: [],
        priority: 0,
        timestamp: 0
      }),
      reset: (message) => {
        message.type = null;
        message.data = {};
        message.recipients.length = 0;
        message.priority = 0;
        message.timestamp = 0;
      },
      initialSize: 20,
      maxSize: 200
    });

    // Collision detection result pool
    this.createPool('collision', {
      create: () => ({
        entity1: null,
        entity2: null,
        distance: 0,
        overlap: 0,
        normal: { x: 0, y: 0 },
        timestamp: 0
      }),
      reset: (collision) => {
        collision.entity1 = null;
        collision.entity2 = null;
        collision.distance = 0;
        collision.overlap = 0;
        collision.normal.x = 0;
        collision.normal.y = 0;
        collision.timestamp = 0;
      },
      initialSize: 15,
      maxSize: 150
    });

    // Vector2D pool for physics calculations
    this.createPool('vector2d', {
      create: () => ({ x: 0, y: 0 }),
      reset: (vector) => {
        vector.x = 0;
        vector.y = 0;
      },
      initialSize: 40,
      maxSize: 400
    });
  }

  /**
   * Create a new object pool
   */
  createPool(name, options) {
    const pool = new ObjectPool(
      options.create,
      options.reset,
      options.initialSize,
      options.maxSize
    );
    
    this.pools.set(name, pool);
    return pool;
  }

  /**
   * Get an object from a specific pool
   */
  acquire(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool '${poolName}' not found`);
    }
    return pool.acquire();
  }

  /**
   * Return an object to a specific pool
   */
  release(poolName, obj) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      console.warn(`Pool '${poolName}' not found`);
      return false;
    }
    return pool.release(obj);
  }

  /**
   * Get a pool by name
   */
  getPool(name) {
    return this.pools.get(name);
  }

  /**
   * Get statistics for all pools
   */
  getStats() {
    const stats = {};
    for (const [name, pool] of this.pools.entries()) {
      stats[name] = pool.getStats();
    }
    return stats;
  }

  /**
   * Get memory usage estimation
   */
  getMemoryUsage() {
    let totalObjects = 0;
    let totalActive = 0;
    
    for (const pool of this.pools.values()) {
      const stats = pool.getStats();
      totalObjects += stats.poolSize;
      totalActive += stats.activeObjects;
    }
    
    return {
      totalPooledObjects: totalObjects,
      totalActiveObjects: totalActive,
      estimatedMemoryKB: Math.round((totalObjects + totalActive) * 0.1) // rough estimate
    };
  }

  /**
   * Clear all pools
   */
  clearAll() {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
  }

  /**
   * Specialized methods for common game objects
   */

  /**
   * Create an ore object with pooling
   */
  createOre(id, x, y, value, type = 'common') {
    const ore = this.acquire('ore');
    ore.id = id;
    ore.x = x;
    ore.y = y;
    ore.value = value;
    ore.type = type;
    ore.collected = false;
    ore.spawned = Date.now();
    return ore;
  }

  /**
   * Create a projectile object with pooling
   */
  createProjectile(id, x, y, vx, vy, damage, range, ownerId) {
    const projectile = this.acquire('projectile');
    projectile.id = id;
    projectile.x = x;
    projectile.y = y;
    projectile.vx = vx;
    projectile.vy = vy;
    projectile.damage = damage;
    projectile.range = range;
    projectile.ownerId = ownerId;
    projectile.active = true;
    projectile.spawned = Date.now();
    projectile.traveled = 0;
    return projectile;
  }

  /**
   * Create a particle effect with pooling
   */
  createParticle(x, y, vx, vy, life, size, color, type = 'default') {
    const particle = this.acquire('particle');
    particle.id = Math.random().toString(36).substr(2, 9);
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = life;
    particle.maxLife = life;
    particle.size = size;
    particle.color = color;
    particle.alpha = 1;
    particle.type = type;
    return particle;
  }

  /**
   * Create an event object with pooling
   */
  createEvent(id, type, x, y, data, triggerAt) {
    const event = this.acquire('event');
    event.id = id;
    event.type = type;
    event.x = x;
    event.y = y;
    event.data = { ...data };
    event.triggerAt = triggerAt;
    event.processed = false;
    return event;
  }

  /**
   * Create a message object with pooling
   */
  createMessage(type, data, recipients = [], priority = 0) {
    const message = this.acquire('message');
    message.type = type;
    message.data = { ...data };
    message.recipients = [...recipients];
    message.priority = priority;
    message.timestamp = Date.now();
    return message;
  }

  /**
   * Create a collision result with pooling
   */
  createCollision(entity1, entity2, distance, overlap, normalX = 0, normalY = 0) {
    const collision = this.acquire('collision');
    collision.entity1 = entity1;
    collision.entity2 = entity2;
    collision.distance = distance;
    collision.overlap = overlap;
    collision.normal.x = normalX;
    collision.normal.y = normalY;
    collision.timestamp = Date.now();
    return collision;
  }

  /**
   * Create a vector with pooling
   */
  createVector(x = 0, y = 0) {
    const vector = this.acquire('vector2d');
    vector.x = x;
    vector.y = y;
    return vector;
  }

  /**
   * Batch release objects back to pools
   */
  releaseBatch(objects) {
    let released = 0;
    
    for (const { pool, object } of objects) {
      if (this.release(pool, object)) {
        released++;
      }
    }
    
    return released;
  }

  /**
   * Periodic cleanup to maintain pool health
   */
  cleanup() {
    let totalCleaned = 0;
    
    for (const [name, pool] of this.pools.entries()) {
      const stats = pool.getStats();
      
      // If hit rate is very low, reduce pool size
      if (stats.hitRate < 0.3 && stats.poolSize > 5) {
        const toRemove = Math.floor(stats.poolSize * 0.2);
        for (let i = 0; i < toRemove && pool.pool.length > 0; i++) {
          pool.pool.pop();
          totalCleaned++;
        }
      }
    }
    
    return totalCleaned;
  }
}

module.exports = { ObjectPool, ObjectPoolManager };