/**
 * Horizontal scaling preparation for StarForgeFrontier server
 * Implements infrastructure patterns for scaling across multiple instances
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class HorizontalScalingManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.instanceId = options.instanceId || crypto.randomBytes(8).toString('hex');
    this.clusterSize = options.clusterSize || 1;
    this.nodeId = options.nodeId || 0;
    
    // Service discovery and registry
    this.serviceRegistry = {
      instances: new Map(),
      services: new Map()
    };
    
    // Load balancing configuration
    this.loadBalancer = {
      strategy: options.loadBalancingStrategy || 'round-robin',
      currentIndex: 0,
      healthCheckInterval: options.healthCheckInterval || 30000
    };
    
    // State synchronization
    this.stateSyncManager = {
      enabled: options.enableStateSync !== false,
      syncInterval: options.stateSyncInterval || 5000,
      lastSync: 0,
      pendingUpdates: new Map()
    };
    
    // Cross-instance communication
    this.messageQueue = {
      outbound: [],
      inbound: [],
      topics: new Map()
    };
    
    // Horizontal sharding configuration
    this.sharding = {
      enabled: options.enableSharding !== false,
      shardKey: options.shardKey || 'playerId',
      shardFunction: options.shardFunction || this.defaultShardFunction.bind(this),
      rebalanceThreshold: options.rebalanceThreshold || 0.3
    };
    
    // Session management for distributed systems
    this.sessionManager = {
      store: new Map(),
      ttl: options.sessionTTL || 3600000, // 1 hour
      persistenceLayer: options.sessionStore || 'memory'
    };
    
    // Health monitoring for cluster
    this.clusterHealth = {
      nodes: new Map(),
      lastHealthCheck: 0,
      unhealthyNodes: new Set()
    };
    
    this.isActive = false;
  }

  /**
   * Initialize horizontal scaling infrastructure
   */
  async initialize() {
    try {
      console.log(`Initializing horizontal scaling for instance ${this.instanceId}`);
      
      // Register this instance
      await this.registerInstance();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start state synchronization
      if (this.stateSyncManager.enabled) {
        this.startStateSynchronization();
      }
      
      // Initialize session management
      await this.initializeSessionManager();
      
      // Setup cross-instance messaging
      this.setupMessageHandling();
      
      this.isActive = true;
      console.log('Horizontal scaling initialization complete');
      
    } catch (error) {
      console.error('Failed to initialize horizontal scaling:', error);
      throw error;
    }
  }

  /**
   * Register this instance in the service registry
   */
  async registerInstance() {
    const instanceInfo = {
      id: this.instanceId,
      nodeId: this.nodeId,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'healthy',
      capacity: {
        maxPlayers: 500, // Configurable
        currentPlayers: 0,
        cpuUsage: 0,
        memoryUsage: 0
      },
      endpoints: {
        websocket: process.env.WS_PORT || 3000,
        http: process.env.HTTP_PORT || 3000,
        cluster: process.env.CLUSTER_PORT || 3001
      }
    };
    
    this.serviceRegistry.instances.set(this.instanceId, instanceInfo);
    
    // In production, this would register with external service discovery
    // (e.g., Consul, etcd, Redis, or cloud-native solutions)
    this.emit('instanceRegistered', instanceInfo);
  }

  /**
   * Determine which instance should handle a specific player/request
   */
  getTargetInstance(identifier) {
    if (!this.sharding.enabled || this.clusterSize <= 1) {
      return this.instanceId;
    }
    
    const shard = this.sharding.shardFunction(identifier);
    const targetNodeId = shard % this.clusterSize;
    
    // Find instance for target node
    for (const [instanceId, info] of this.serviceRegistry.instances.entries()) {
      if (info.nodeId === targetNodeId && info.status === 'healthy') {
        return instanceId;
      }
    }
    
    // Fallback to current instance if target not available
    return this.instanceId;
  }

  /**
   * Default sharding function using consistent hashing
   */
  defaultShardFunction(identifier) {
    const hash = crypto.createHash('sha256').update(String(identifier)).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Route player to appropriate instance
   */
  routePlayer(playerId, connectionInfo) {
    const targetInstance = this.getTargetInstance(playerId);
    
    if (targetInstance === this.instanceId) {
      // Handle locally
      return { handled: true, local: true };
    } else {
      // Forward to another instance
      return {
        handled: false,
        local: false,
        targetInstance,
        redirectInfo: this.getInstanceEndpoint(targetInstance)
      };
    }
  }

  /**
   * Get endpoint information for an instance
   */
  getInstanceEndpoint(instanceId) {
    const instance = this.serviceRegistry.instances.get(instanceId);
    if (!instance) return null;
    
    return {
      instanceId,
      websocket: `ws://instance-${instance.nodeId}:${instance.endpoints.websocket}`,
      http: `http://instance-${instance.nodeId}:${instance.endpoints.http}`
    };
  }

  /**
   * Distribute game state updates across instances
   */
  broadcastToCluster(eventType, data, excludeInstance = null) {
    const message = {
      type: 'cluster_broadcast',
      eventType,
      data,
      sourceInstance: this.instanceId,
      timestamp: Date.now()
    };
    
    for (const [instanceId, instanceInfo] of this.serviceRegistry.instances.entries()) {
      if (instanceId !== excludeInstance && instanceId !== this.instanceId) {
        this.sendToInstance(instanceId, message);
      }
    }
  }

  /**
   * Send message to specific instance
   */
  async sendToInstance(targetInstanceId, message) {
    // In production, this would use message queues, HTTP APIs, or direct TCP
    // For now, we'll simulate with events
    
    const targetInstance = this.serviceRegistry.instances.get(targetInstanceId);
    if (!targetInstance) {
      console.warn(`Target instance ${targetInstanceId} not found`);
      return false;
    }
    
    // Add to outbound queue
    this.messageQueue.outbound.push({
      targetInstance: targetInstanceId,
      message,
      timestamp: Date.now(),
      retries: 0
    });
    
    // Simulate sending (in production, use actual network communication)
    this.emit('messageSent', { targetInstanceId, message });
    
    return true;
  }

  /**
   * Handle cross-instance player migration
   */
  async migratePlayer(playerId, targetInstanceId, playerState) {
    try {
      // Prepare migration data
      const migrationData = {
        type: 'player_migration',
        playerId,
        playerState,
        sourceInstance: this.instanceId,
        targetInstance: targetInstanceId,
        timestamp: Date.now()
      };
      
      // Send to target instance
      await this.sendToInstance(targetInstanceId, migrationData);
      
      // Track migration for cleanup
      this.emit('playerMigrated', { playerId, targetInstanceId });
      
      return true;
    } catch (error) {
      console.error('Player migration failed:', error);
      return false;
    }
  }

  /**
   * Handle load balancing decisions
   */
  shouldRebalance() {
    if (this.clusterSize <= 1) return false;
    
    const instances = Array.from(this.serviceRegistry.instances.values());
    const loads = instances.map(instance => instance.capacity.currentPlayers);
    
    if (loads.length === 0) return false;
    
    const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    
    // Check if load imbalance exceeds threshold
    const imbalance = (maxLoad - minLoad) / avgLoad;
    return imbalance > this.sharding.rebalanceThreshold;
  }

  /**
   * Perform load rebalancing
   */
  async rebalanceLoad() {
    if (!this.shouldRebalance()) return;
    
    console.log('Starting load rebalancing...');
    
    const instances = Array.from(this.serviceRegistry.instances.values())
      .filter(instance => instance.status === 'healthy')
      .sort((a, b) => a.capacity.currentPlayers - b.capacity.currentPlayers);
    
    if (instances.length < 2) return;
    
    const mostLoaded = instances[instances.length - 1];
    const leastLoaded = instances[0];
    
    // Calculate how many players to migrate
    const loadDiff = mostLoaded.capacity.currentPlayers - leastLoaded.capacity.currentPlayers;
    const playersToMigrate = Math.floor(loadDiff / 4); // Migrate 25% of the difference
    
    if (playersToMigrate > 0) {
      this.emit('rebalanceStarted', {
        from: mostLoaded.id,
        to: leastLoaded.id,
        playerCount: playersToMigrate
      });
    }
  }

  /**
   * Distributed session management
   */
  async createSession(sessionId, data) {
    const session = {
      id: sessionId,
      data,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      instanceId: this.instanceId
    };
    
    this.sessionManager.store.set(sessionId, session);
    
    // Replicate to other instances if needed
    if (this.stateSyncManager.enabled) {
      this.broadcastToCluster('session_created', { sessionId, session });
    }
    
    return session;
  }

  /**
   * Get session from distributed store
   */
  async getSession(sessionId) {
    let session = this.sessionManager.store.get(sessionId);
    
    if (!session && this.stateSyncManager.enabled) {
      // Try to fetch from other instances
      const response = await this.queryCluster('get_session', { sessionId });
      if (response && response.session) {
        session = response.session;
        this.sessionManager.store.set(sessionId, session);
      }
    }
    
    if (session) {
      session.lastAccessed = Date.now();
    }
    
    return session;
  }

  /**
   * Query cluster for information
   */
  async queryCluster(queryType, data) {
    // In production, implement actual cluster querying
    return new Promise((resolve) => {
      this.emit('clusterQuery', { queryType, data, resolve });
      
      // Simulate timeout
      setTimeout(() => resolve(null), 5000);
    });
  }

  /**
   * Start health monitoring for cluster
   */
  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.loadBalancer.healthCheckInterval);
  }

  /**
   * Perform health check on all instances
   */
  async performHealthCheck() {
    const now = Date.now();
    
    for (const [instanceId, instance] of this.serviceRegistry.instances.entries()) {
      const timeSinceHeartbeat = now - instance.lastHeartbeat;
      
      if (timeSinceHeartbeat > this.loadBalancer.healthCheckInterval * 2) {
        // Mark as unhealthy
        instance.status = 'unhealthy';
        this.clusterHealth.unhealthyNodes.add(instanceId);
        this.emit('instanceUnhealthy', { instanceId, instance });
      } else if (instance.status === 'unhealthy' && timeSinceHeartbeat < this.loadBalancer.healthCheckInterval) {
        // Mark as recovered
        instance.status = 'healthy';
        this.clusterHealth.unhealthyNodes.delete(instanceId);
        this.emit('instanceRecovered', { instanceId, instance });
      }
    }
    
    this.clusterHealth.lastHealthCheck = now;
  }

  /**
   * Start state synchronization
   */
  startStateSynchronization() {
    setInterval(() => {
      this.synchronizeState();
    }, this.stateSyncManager.syncInterval);
  }

  /**
   * Synchronize state across instances
   */
  async synchronizeState() {
    if (this.stateSyncManager.pendingUpdates.size === 0) return;
    
    const updates = Array.from(this.stateSyncManager.pendingUpdates.entries());
    this.stateSyncManager.pendingUpdates.clear();
    
    // Broadcast state updates to cluster
    this.broadcastToCluster('state_sync', { updates });
    this.stateSyncManager.lastSync = Date.now();
  }

  /**
   * Setup message handling
   */
  setupMessageHandling() {
    this.on('messageReceived', (message) => {
      this.handleClusterMessage(message);
    });
  }

  /**
   * Handle messages from other instances
   */
  handleClusterMessage(message) {
    switch (message.type) {
      case 'cluster_broadcast':
        this.emit('clusterEvent', message);
        break;
        
      case 'player_migration':
        this.handlePlayerMigration(message);
        break;
        
      case 'state_sync':
        this.handleStateSync(message);
        break;
        
      case 'health_check':
        this.respondToHealthCheck(message);
        break;
        
      default:
        console.warn('Unknown cluster message type:', message.type);
    }
  }

  /**
   * Handle incoming player migration
   */
  async handlePlayerMigration(migrationData) {
    const { playerId, playerState, sourceInstance } = migrationData;
    
    try {
      // Accept migrated player
      this.emit('playerMigrationReceived', { playerId, playerState, sourceInstance });
      
      // Send acknowledgment
      await this.sendToInstance(sourceInstance, {
        type: 'migration_ack',
        playerId,
        success: true,
        targetInstance: this.instanceId
      });
      
    } catch (error) {
      console.error('Failed to handle player migration:', error);
      
      // Send failure acknowledgment
      await this.sendToInstance(sourceInstance, {
        type: 'migration_ack',
        playerId,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle state synchronization
   */
  handleStateSync(syncData) {
    const { updates } = syncData;
    
    updates.forEach(([key, value]) => {
      this.emit('stateUpdate', { key, value });
    });
  }

  /**
   * Get scaling statistics
   */
  getScalingStats() {
    const healthyInstances = Array.from(this.serviceRegistry.instances.values())
      .filter(instance => instance.status === 'healthy');
    
    const totalCapacity = healthyInstances.reduce((sum, instance) => sum + instance.capacity.maxPlayers, 0);
    const totalLoad = healthyInstances.reduce((sum, instance) => sum + instance.capacity.currentPlayers, 0);
    
    return {
      clusterSize: this.clusterSize,
      healthyInstances: healthyInstances.length,
      unhealthyInstances: this.clusterHealth.unhealthyNodes.size,
      totalCapacity,
      totalLoad,
      utilization: totalCapacity > 0 ? (totalLoad / totalCapacity) : 0,
      loadBalanceScore: this.calculateLoadBalanceScore(),
      lastHealthCheck: this.clusterHealth.lastHealthCheck,
      messageQueueSize: this.messageQueue.outbound.length,
      sessionCount: this.sessionManager.store.size
    };
  }

  /**
   * Calculate load balance score (0 = perfectly balanced, 1 = completely unbalanced)
   */
  calculateLoadBalanceScore() {
    const instances = Array.from(this.serviceRegistry.instances.values())
      .filter(instance => instance.status === 'healthy');
    
    if (instances.length <= 1) return 0;
    
    const loads = instances.map(instance => instance.capacity.currentPlayers);
    const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
    
    if (avgLoad === 0) return 0;
    
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
    const standardDeviation = Math.sqrt(variance);
    
    return Math.min(standardDeviation / avgLoad, 1);
  }

  /**
   * Shutdown scaling infrastructure
   */
  async shutdown() {
    this.isActive = false;
    
    // Cleanup resources
    this.serviceRegistry.instances.clear();
    this.serviceRegistry.services.clear();
    this.messageQueue.outbound = [];
    this.messageQueue.inbound = [];
    this.sessionManager.store.clear();
    
    console.log('Horizontal scaling manager shut down');
  }

  /**
   * Initialize session manager
   */
  async initializeSessionManager() {
    // In production, integrate with Redis, DynamoDB, or other distributed stores
    console.log('Session manager initialized (memory store)');
  }
}

module.exports = HorizontalScalingManager;