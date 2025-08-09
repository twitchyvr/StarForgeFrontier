/**
 * Broadcast manager for selective message distribution
 * Efficiently manages WebSocket communications with spatial and topic-based filtering
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class BroadcastManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // Map<WebSocket, ClientInfo>
    this.channels = new Map(); // Map<channel, Set<WebSocket>>
    this.spatialIndex = new Map(); // Map<region, Set<WebSocket>>
    this.messageQueue = []; // Queue for batch processing
    this.queueProcessInterval = null;
    this.batchSize = 50;
    this.batchInterval = 16; // ~60fps
    
    // Performance metrics
    this.metrics = {
      messagesSent: 0,
      broadcastsSent: 0,
      messagesQueued: 0,
      spatialFilters: 0,
      channelFilters: 0,
      totalClients: 0
    };

    this.startBatchProcessing();
  }

  /**
   * Register a client with the broadcast manager
   */
  registerClient(ws, clientInfo = {}) {
    const client = {
      id: clientInfo.id || this.generateClientId(),
      playerId: clientInfo.playerId,
      username: clientInfo.username || 'Anonymous',
      x: clientInfo.x || 0,
      y: clientInfo.y || 0,
      region: this.calculateRegion(clientInfo.x || 0, clientInfo.y || 0),
      channels: new Set(clientInfo.channels || ['global']),
      lastActivity: Date.now(),
      connectionTime: Date.now(),
      messagesSent: 0,
      messagesReceived: 0,
      isActive: true
    };

    this.clients.set(ws, client);
    
    // Add to channels
    client.channels.forEach(channel => {
      if (!this.channels.has(channel)) {
        this.channels.set(channel, new Set());
      }
      this.channels.get(channel).add(ws);
    });

    // Add to spatial index
    this.addToSpatialIndex(ws, client);
    
    this.metrics.totalClients++;
    
    // Handle client disconnection
    ws.on('close', () => {
      this.unregisterClient(ws);
    });

    this.emit('clientRegistered', { ws, client });
    return client;
  }

  /**
   * Unregister a client
   */
  unregisterClient(ws) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Remove from channels
    client.channels.forEach(channel => {
      const channelClients = this.channels.get(channel);
      if (channelClients) {
        channelClients.delete(ws);
        if (channelClients.size === 0) {
          this.channels.delete(channel);
        }
      }
    });

    // Remove from spatial index
    this.removeFromSpatialIndex(ws, client);
    
    this.clients.delete(ws);
    this.metrics.totalClients--;

    this.emit('clientUnregistered', { ws, client });
  }

  /**
   * Update client position for spatial filtering
   */
  updateClientPosition(ws, x, y) {
    const client = this.clients.get(ws);
    if (!client) return;

    const oldRegion = client.region;
    const newRegion = this.calculateRegion(x, y);

    if (oldRegion !== newRegion) {
      this.removeFromSpatialIndex(ws, client);
      client.x = x;
      client.y = y;
      client.region = newRegion;
      this.addToSpatialIndex(ws, client);
    } else {
      client.x = x;
      client.y = y;
    }

    client.lastActivity = Date.now();
  }

  /**
   * Add client to channel
   */
  addToChannel(ws, channel) {
    const client = this.clients.get(ws);
    if (!client) return false;

    if (!client.channels.has(channel)) {
      client.channels.add(channel);
      
      if (!this.channels.has(channel)) {
        this.channels.set(channel, new Set());
      }
      this.channels.get(channel).add(ws);
      
      return true;
    }
    return false;
  }

  /**
   * Remove client from channel
   */
  removeFromChannel(ws, channel) {
    const client = this.clients.get(ws);
    if (!client) return false;

    if (client.channels.has(channel)) {
      client.channels.delete(channel);
      
      const channelClients = this.channels.get(channel);
      if (channelClients) {
        channelClients.delete(ws);
        if (channelClients.size === 0) {
          this.channels.delete(channel);
        }
      }
      
      return true;
    }
    return false;
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, message) {
    const client = this.clients.get(ws);
    if (!client || !client.isActive) return false;

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        client.messagesSent++;
        this.metrics.messagesSent++;
        client.lastActivity = Date.now();
        return true;
      } catch (error) {
        console.error('Error sending message to client:', error);
        this.unregisterClient(ws);
        return false;
      }
    }
    return false;
  }

  /**
   * Broadcast to all clients in a channel
   */
  broadcastToChannel(channel, message, excludeClient = null) {
    const channelClients = this.channels.get(channel);
    if (!channelClients) return 0;

    let sentCount = 0;
    channelClients.forEach(ws => {
      if (ws !== excludeClient && this.sendToClient(ws, message)) {
        sentCount++;
      }
    });

    this.metrics.broadcastsSent++;
    this.metrics.channelFilters++;
    return sentCount;
  }

  /**
   * Broadcast to clients within a spatial area
   */
  broadcastToArea(x, y, radius, message, excludeClient = null) {
    const relevantRegions = this.getRelevantRegions(x, y, radius);
    const clients = new Set();
    
    relevantRegions.forEach(region => {
      const regionClients = this.spatialIndex.get(region);
      if (regionClients) {
        regionClients.forEach(ws => {
          const client = this.clients.get(ws);
          if (client && ws !== excludeClient) {
            const distance = Math.sqrt(
              (client.x - x) ** 2 + (client.y - y) ** 2
            );
            if (distance <= radius) {
              clients.add(ws);
            }
          }
        });
      }
    });

    let sentCount = 0;
    clients.forEach(ws => {
      if (this.sendToClient(ws, message)) {
        sentCount++;
      }
    });

    this.metrics.broadcastsSent++;
    this.metrics.spatialFilters++;
    return sentCount;
  }

  /**
   * Broadcast to nearby clients (optimized for game state updates)
   */
  broadcastToNearby(originClient, message, maxDistance = 1000) {
    if (typeof originClient === 'object' && originClient.readyState !== undefined) {
      // It's a WebSocket, get the client info
      originClient = this.clients.get(originClient);
    }
    
    if (!originClient) return 0;

    return this.broadcastToArea(
      originClient.x,
      originClient.y,
      maxDistance,
      message
    );
  }

  /**
   * Queue message for batch processing
   */
  queueMessage(recipients, message, priority = 0) {
    this.messageQueue.push({
      recipients,
      message,
      priority,
      timestamp: Date.now()
    });
    this.metrics.messagesQueued++;
  }

  /**
   * Batch broadcast for better performance
   */
  batchBroadcast(messages) {
    const messageMap = new Map();
    
    // Group messages by recipient
    messages.forEach(({ recipients, message }) => {
      recipients.forEach(ws => {
        if (!messageMap.has(ws)) {
          messageMap.set(ws, []);
        }
        messageMap.get(ws).push(message);
      });
    });

    let totalSent = 0;
    
    // Send batched messages
    messageMap.forEach((messageList, ws) => {
      if (this.sendToClient(ws, {
        type: 'batch',
        messages: messageList
      })) {
        totalSent++;
      }
    });

    return totalSent;
  }

  /**
   * Start batch processing of queued messages
   */
  startBatchProcessing() {
    this.queueProcessInterval = setInterval(() => {
      if (this.messageQueue.length === 0) return;

      // Sort by priority and timestamp
      this.messageQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.timestamp - b.timestamp; // Older first
      });

      // Process batch
      const batch = this.messageQueue.splice(0, this.batchSize);
      batch.forEach(({ recipients, message }) => {
        if (Array.isArray(recipients)) {
          recipients.forEach(ws => {
            this.sendToClient(ws, message);
          });
        } else if (typeof recipients === 'function') {
          // Recipients is a filter function
          this.clients.forEach((client, ws) => {
            if (recipients(client, ws)) {
              this.sendToClient(ws, message);
            }
          });
        }
      });

    }, this.batchInterval);
  }

  /**
   * Stop batch processing
   */
  stopBatchProcessing() {
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
      this.queueProcessInterval = null;
    }
  }

  /**
   * Spatial index management
   */
  calculateRegion(x, y, regionSize = 500) {
    const regionX = Math.floor(x / regionSize);
    const regionY = Math.floor(y / regionSize);
    return `${regionX},${regionY}`;
  }

  addToSpatialIndex(ws, client) {
    if (!this.spatialIndex.has(client.region)) {
      this.spatialIndex.set(client.region, new Set());
    }
    this.spatialIndex.get(client.region).add(ws);
  }

  removeFromSpatialIndex(ws, client) {
    const regionClients = this.spatialIndex.get(client.region);
    if (regionClients) {
      regionClients.delete(ws);
      if (regionClients.size === 0) {
        this.spatialIndex.delete(client.region);
      }
    }
  }

  getRelevantRegions(x, y, radius, regionSize = 500) {
    const regions = new Set();
    const minRegionX = Math.floor((x - radius) / regionSize);
    const maxRegionX = Math.floor((x + radius) / regionSize);
    const minRegionY = Math.floor((y - radius) / regionSize);
    const maxRegionY = Math.floor((y + radius) / regionSize);

    for (let regionX = minRegionX; regionX <= maxRegionX; regionX++) {
      for (let regionY = minRegionY; regionY <= maxRegionY; regionY++) {
        regions.add(`${regionX},${regionY}`);
      }
    }

    return Array.from(regions);
  }

  /**
   * Get all clients matching a filter
   */
  getClientsByFilter(filterFn) {
    const matchingClients = [];
    this.clients.forEach((client, ws) => {
      if (filterFn(client, ws)) {
        matchingClients.push({ ws, client });
      }
    });
    return matchingClients;
  }

  /**
   * Get client statistics
   */
  getClientStats(ws) {
    const client = this.clients.get(ws);
    if (!client) return null;

    return {
      id: client.id,
      playerId: client.playerId,
      username: client.username,
      position: { x: client.x, y: client.y },
      region: client.region,
      channels: Array.from(client.channels),
      connectionTime: client.connectionTime,
      lastActivity: client.lastActivity,
      messagesSent: client.messagesSent,
      messagesReceived: client.messagesReceived,
      isActive: client.isActive
    };
  }

  /**
   * Get broadcast manager statistics
   */
  getStats() {
    return {
      ...this.metrics,
      activeChannels: this.channels.size,
      spatialRegions: this.spatialIndex.size,
      queuedMessages: this.messageQueue.length,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup inactive clients
   */
  cleanupInactiveClients(maxIdleTime = 300000) { // 5 minutes
    const now = Date.now();
    const clientsToRemove = [];

    this.clients.forEach((client, ws) => {
      if (now - client.lastActivity > maxIdleTime) {
        clientsToRemove.push(ws);
      }
    });

    clientsToRemove.forEach(ws => {
      this.unregisterClient(ws);
    });

    return clientsToRemove.length;
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      clients: this.clients.size,
      channels: this.channels.size,
      spatialRegions: this.spatialIndex.size,
      queuedMessages: this.messageQueue.length,
      batchProcessing: this.queueProcessInterval !== null,
      metrics: this.metrics
    };
  }

  /**
   * Shutdown the broadcast manager
   */
  shutdown() {
    this.stopBatchProcessing();
    
    // Close all client connections
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutting down');
      }
    });

    this.clients.clear();
    this.channels.clear();
    this.spatialIndex.clear();
    this.messageQueue.length = 0;
    
    this.emit('shutdown');
  }
}

module.exports = BroadcastManager;