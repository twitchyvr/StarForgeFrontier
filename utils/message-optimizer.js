/**
 * Message frequency optimizer for WebSocket communications
 * Reduces network traffic by batching, throttling, and prioritizing messages
 */

class MessageFrequencyOptimizer {
  constructor(options = {}) {
    this.options = {
      maxBatchSize: options.maxBatchSize || 10,
      batchInterval: options.batchInterval || 16, // ~60fps
      throttleInterval: options.throttleInterval || 100, // 100ms throttle for low priority
      priorityLevels: options.priorityLevels || {
        CRITICAL: 0,    // Immediate send
        HIGH: 1,        // Send within 16ms
        MEDIUM: 2,      // Send within 50ms
        LOW: 3          // Send within 100ms
      },
      enableCompression: options.enableCompression !== false,
      enableDuplicateFiltering: options.enableDuplicateFiltering !== false
    };
    
    // Message queues by priority
    this.messageQueues = new Map();
    Object.values(this.options.priorityLevels).forEach(level => {
      this.messageQueues.set(level, []);
    });
    
    // Client-specific optimizations
    this.clientOptimizations = new Map(); // clientId -> optimization settings
    
    // Throttling state
    this.throttleState = new Map(); // messageType -> last sent timestamp
    
    // Batching intervals
    this.batchIntervals = new Map();
    
    // Message templates for compression
    this.messageTemplates = new Map();
    this.initializeMessageTemplates();
    
    // Performance metrics
    this.metrics = {
      messagesQueued: 0,
      messagesSent: 0,
      messagesDropped: 0,
      batchesSent: 0,
      compressionRatio: 0,
      duplicatesFiltered: 0,
      bandwidthSaved: 0
    };
    
    this.isActive = false;
  }

  /**
   * Start the message optimizer
   */
  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    
    // Start processing intervals for different priority levels
    this.startProcessingIntervals();
    
    console.log('Message frequency optimizer started');
  }

  /**
   * Stop the message optimizer
   */
  stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Clear all intervals
    for (const interval of this.batchIntervals.values()) {
      clearInterval(interval);
    }
    this.batchIntervals.clear();
    
    // Flush remaining messages
    this.flushAllQueues();
    
    console.log('Message frequency optimizer stopped');
  }

  /**
   * Queue a message for optimized sending
   */
  queueMessage(clientId, message, priority = 'MEDIUM', metadata = {}) {
    if (!this.isActive) {
      // If optimizer is not active, send immediately
      return this.sendMessageDirect(clientId, message);
    }
    
    const priorityLevel = this.options.priorityLevels[priority] || this.options.priorityLevels.MEDIUM;
    const messageItem = {
      clientId,
      message: { ...message },
      priority: priorityLevel,
      metadata: {
        timestamp: Date.now(),
        ...metadata
      }
    };
    
    // Apply optimizations
    if (this.shouldThrottleMessage(message.type, messageItem)) {
      this.metrics.messagesDropped++;
      return false;
    }
    
    if (this.options.enableDuplicateFiltering && this.isDuplicateMessage(clientId, message)) {
      this.metrics.duplicatesFiltered++;
      return false;
    }
    
    // Compress message if enabled
    if (this.options.enableCompression) {
      messageItem.message = this.compressMessage(message);
    }
    
    // Add to appropriate queue
    const queue = this.messageQueues.get(priorityLevel);
    if (queue) {
      queue.push(messageItem);
      this.metrics.messagesQueued++;
      
      // Send critical messages immediately
      if (priorityLevel === this.options.priorityLevels.CRITICAL) {
        this.processCriticalMessages();
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Batch queue messages for multiple clients
   */
  queueBatchMessage(clientIds, message, priority = 'MEDIUM', metadata = {}) {
    let queued = 0;
    
    for (const clientId of clientIds) {
      if (this.queueMessage(clientId, message, priority, metadata)) {
        queued++;
      }
    }
    
    return queued;
  }

  /**
   * Start processing intervals for different priority levels
   */
  startProcessingIntervals() {
    // Critical: Process immediately (handled in queueMessage)
    
    // High priority: 16ms (~60fps)
    this.batchIntervals.set('HIGH', setInterval(() => {
      this.processQueue(this.options.priorityLevels.HIGH);
    }, this.options.batchInterval));
    
    // Medium priority: 50ms (~20fps)
    this.batchIntervals.set('MEDIUM', setInterval(() => {
      this.processQueue(this.options.priorityLevels.MEDIUM);
    }, 50));
    
    // Low priority: 100ms (~10fps)
    this.batchIntervals.set('LOW', setInterval(() => {
      this.processQueue(this.options.priorityLevels.LOW);
    }, this.options.throttleInterval));
  }

  /**
   * Process messages in a specific priority queue
   */
  processQueue(priorityLevel) {
    const queue = this.messageQueues.get(priorityLevel);
    if (!queue || queue.length === 0) return;
    
    // Group messages by client for batching
    const clientMessages = new Map();
    
    while (queue.length > 0 && clientMessages.size < this.options.maxBatchSize) {
      const messageItem = queue.shift();
      
      if (!clientMessages.has(messageItem.clientId)) {
        clientMessages.set(messageItem.clientId, []);
      }
      
      clientMessages.get(messageItem.clientId).push(messageItem.message);
    }
    
    // Send batched messages to each client
    for (const [clientId, messages] of clientMessages.entries()) {
      this.sendBatchedMessages(clientId, messages);
    }
  }

  /**
   * Process critical messages immediately
   */
  processCriticalMessages() {
    const queue = this.messageQueues.get(this.options.priorityLevels.CRITICAL);
    if (!queue) return;
    
    while (queue.length > 0) {
      const messageItem = queue.shift();
      this.sendMessageDirect(messageItem.clientId, messageItem.message);
    }
  }

  /**
   * Send batched messages to a client
   */
  sendBatchedMessages(clientId, messages) {
    if (messages.length === 1) {
      this.sendMessageDirect(clientId, messages[0]);
    } else {
      const batchMessage = {
        type: 'batch',
        messages: messages,
        count: messages.length,
        timestamp: Date.now()
      };
      
      this.sendMessageDirect(clientId, batchMessage);
      this.metrics.batchesSent++;
    }
  }

  /**
   * Send message directly (to be implemented by integration)
   */
  sendMessageDirect(clientId, message) {
    // This method should be overridden or bound to actual sending mechanism
    this.metrics.messagesSent++;
    
    // Emit event for external handling
    this.emit?.('sendMessage', { clientId, message });
    
    return true;
  }

  /**
   * Check if message should be throttled
   */
  shouldThrottleMessage(messageType, messageItem) {
    if (messageItem.priority === this.options.priorityLevels.CRITICAL) {
      return false; // Never throttle critical messages
    }
    
    const throttleKey = `${messageItem.clientId}_${messageType}`;
    const lastSent = this.throttleState.get(throttleKey) || 0;
    const now = Date.now();
    
    // Get throttle interval based on message type
    const throttleInterval = this.getThrottleIntervalForMessage(messageType);
    
    if (now - lastSent < throttleInterval) {
      return true; // Should throttle
    }
    
    this.throttleState.set(throttleKey, now);
    return false;
  }

  /**
   * Get throttle interval for specific message types
   */
  getThrottleIntervalForMessage(messageType) {
    const intervals = {
      'player_position': 16,    // 60fps for position updates
      'game_state': 33,         // 30fps for game state
      'chat_message': 100,      // 10fps for chat
      'resource_update': 200,   // 5fps for resource updates
      'leaderboard': 1000,      // 1fps for leaderboard
      'system_message': 500     // 2fps for system messages
    };
    
    return intervals[messageType] || this.options.throttleInterval;
  }

  /**
   * Check if message is a duplicate
   */
  isDuplicateMessage(clientId, message) {
    // Simple duplicate detection based on message content
    const messageKey = `${clientId}_${message.type}`;
    const lastMessage = this.lastSentMessages?.get(messageKey);
    
    if (!lastMessage) {
      if (!this.lastSentMessages) {
        this.lastSentMessages = new Map();
      }
      this.lastSentMessages.set(messageKey, JSON.stringify(message));
      return false;
    }
    
    const currentMessageStr = JSON.stringify(message);
    const isDuplicate = lastMessage === currentMessageStr;
    
    if (!isDuplicate) {
      this.lastSentMessages.set(messageKey, currentMessageStr);
    }
    
    return isDuplicate;
  }

  /**
   * Initialize message templates for compression
   */
  initializeMessageTemplates() {
    this.messageTemplates.set('player_update', {
      template: { type: 'player_update', id: null, x: null, y: null, resources: null },
      fields: ['id', 'x', 'y', 'resources']
    });
    
    this.messageTemplates.set('game_state', {
      template: { type: 'game_state', players: null, ores: null },
      fields: ['players', 'ores']
    });
    
    this.messageTemplates.set('resource_update', {
      template: { type: 'resource_update', playerId: null, resources: null },
      fields: ['playerId', 'resources']
    });
  }

  /**
   * Compress message using templates
   */
  compressMessage(message) {
    const template = this.messageTemplates.get(message.type);
    if (!template) {
      return message; // No compression available
    }
    
    // Simple compression: only send changed fields
    const compressed = { type: message.type };
    let originalSize = JSON.stringify(message).length;
    
    template.fields.forEach(field => {
      if (message[field] !== undefined) {
        compressed[field] = message[field];
      }
    });
    
    let compressedSize = JSON.stringify(compressed).length;
    
    // Update compression metrics
    if (compressedSize < originalSize) {
      this.metrics.bandwidthSaved += (originalSize - compressedSize);
      this.metrics.compressionRatio = this.metrics.bandwidthSaved / (this.metrics.bandwidthSaved + compressedSize);
    }
    
    return compressed;
  }

  /**
   * Configure client-specific optimizations
   */
  configureClient(clientId, optimizations) {
    this.clientOptimizations.set(clientId, {
      maxBatchSize: optimizations.maxBatchSize || this.options.maxBatchSize,
      throttleMultiplier: optimizations.throttleMultiplier || 1.0,
      enableCompression: optimizations.enableCompression !== false,
      priorityBoost: optimizations.priorityBoost || 0
    });
  }

  /**
   * Remove client optimizations
   */
  removeClient(clientId) {
    this.clientOptimizations.delete(clientId);
    
    // Clean up throttle state
    const keysToDelete = [];
    for (const key of this.throttleState.keys()) {
      if (key.startsWith(`${clientId}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.throttleState.delete(key));
    
    // Clean up last sent messages
    if (this.lastSentMessages) {
      const messageKeysToDelete = [];
      for (const key of this.lastSentMessages.keys()) {
        if (key.startsWith(`${clientId}_`)) {
          messageKeysToDelete.push(key);
        }
      }
      messageKeysToDelete.forEach(key => this.lastSentMessages.delete(key));
    }
  }

  /**
   * Flush all message queues
   */
  flushAllQueues() {
    for (const [priority, queue] of this.messageQueues.entries()) {
      while (queue.length > 0) {
        const messageItem = queue.shift();
        this.sendMessageDirect(messageItem.clientId, messageItem.message);
      }
    }
  }

  /**
   * Get optimizer statistics
   */
  getStats() {
    const queueSizes = {};
    for (const [priority, queue] of this.messageQueues.entries()) {
      queueSizes[`priority_${priority}`] = queue.length;
    }
    
    return {
      ...this.metrics,
      queueSizes,
      throttleStateSize: this.throttleState.size,
      clientOptimizations: this.clientOptimizations.size,
      isActive: this.isActive
    };
  }

  /**
   * Adaptive optimization based on network conditions
   */
  adaptToNetworkConditions(conditions) {
    const { latency, bandwidth, packetLoss } = conditions;
    
    // Adjust batch size based on latency
    if (latency > 100) {
      this.options.maxBatchSize = Math.min(this.options.maxBatchSize + 2, 20);
    } else if (latency < 50) {
      this.options.maxBatchSize = Math.max(this.options.maxBatchSize - 1, 5);
    }
    
    // Adjust throttle intervals based on bandwidth
    if (bandwidth < 1000000) { // Less than 1Mbps
      this.options.throttleInterval = Math.min(this.options.throttleInterval * 1.5, 500);
    } else if (bandwidth > 10000000) { // Greater than 10Mbps
      this.options.throttleInterval = Math.max(this.options.throttleInterval * 0.8, 50);
    }
    
    // Enable more aggressive compression on poor connections
    if (packetLoss > 0.05 || bandwidth < 500000) {
      this.options.enableCompression = true;
    }
  }

  /**
   * Get memory usage estimation
   */
  getMemoryUsage() {
    let totalMessages = 0;
    let estimatedBytes = 0;
    
    for (const queue of this.messageQueues.values()) {
      totalMessages += queue.length;
      estimatedBytes += queue.length * 200; // Rough estimate per message
    }
    
    return {
      totalQueuedMessages: totalMessages,
      estimatedMemoryBytes: estimatedBytes,
      estimatedMemoryKB: Math.round(estimatedBytes / 1024 * 100) / 100
    };
  }

  /**
   * Periodic cleanup and optimization
   */
  cleanup() {
    // Clean up old throttle state entries
    const now = Date.now();
    const cutoff = now - 60000; // 1 minute
    
    for (const [key, timestamp] of this.throttleState.entries()) {
      if (timestamp < cutoff) {
        this.throttleState.delete(key);
      }
    }
    
    // Clean up old last message entries
    if (this.lastSentMessages && this.lastSentMessages.size > 1000) {
      // Keep only most recent 500 entries
      const entries = Array.from(this.lastSentMessages.entries());
      this.lastSentMessages.clear();
      
      entries.slice(-500).forEach(([key, value]) => {
        this.lastSentMessages.set(key, value);
      });
    }
  }

  /**
   * Health check
   */
  healthCheck() {
    const stats = this.getStats();
    const memoryUsage = this.getMemoryUsage();
    
    return {
      status: this.isActive ? 'active' : 'inactive',
      queueHealth: {
        totalMessages: memoryUsage.totalQueuedMessages,
        memoryUsage: memoryUsage.estimatedMemoryKB,
        backlog: memoryUsage.totalQueuedMessages > 100 ? 'warning' : 'ok'
      },
      performance: {
        compressionRatio: Math.round(stats.compressionRatio * 100),
        duplicatesFiltered: stats.duplicatesFiltered,
        bandwidthSaved: Math.round(stats.bandwidthSaved / 1024) // KB
      },
      efficiency: {
        messagesDropped: stats.messagesDropped,
        batchesSent: stats.batchesSent,
        averageBatchSize: stats.batchesSent > 0 ? Math.round(stats.messagesSent / stats.batchesSent) : 0
      }
    };
  }
}

module.exports = MessageFrequencyOptimizer;