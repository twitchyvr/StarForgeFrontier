/**
 * Delta state management for reduced network traffic
 * Tracks changes and sends only modified data to clients
 */

class DeltaStateManager {
  constructor() {
    this.lastState = new Map(); // Map<clientId, lastKnownState>
    this.currentState = {};
    this.stateVersion = 0;
  }

  /**
   * Update the current state
   */
  updateState(newState) {
    this.currentState = { ...newState };
    this.stateVersion++;
  }

  /**
   * Get delta state for a specific client
   */
  getDeltaForClient(clientId) {
    const lastKnownState = this.lastState.get(clientId) || {};
    const delta = this.calculateDelta(lastKnownState, this.currentState);
    
    // Update the client's last known state
    this.lastState.set(clientId, { ...this.currentState });
    
    return {
      version: this.stateVersion,
      delta,
      hasChanges: Object.keys(delta).length > 0
    };
  }

  /**
   * Calculate the difference between two states
   */
  calculateDelta(oldState, newState) {
    const delta = {};

    // Check for new or modified properties
    for (const [key, value] of Object.entries(newState)) {
      if (!oldState.hasOwnProperty(key) || !this.deepEqual(oldState[key], value)) {
        delta[key] = this.deepClone(value);
      }
    }

    // Check for deleted properties
    for (const key of Object.keys(oldState)) {
      if (!newState.hasOwnProperty(key)) {
        delta[key] = null; // Mark as deleted
      }
    }

    return delta;
  }

  /**
   * Calculate delta for player list (optimized for game state)
   */
  getPlayersDelta(clientId, players) {
    const lastKnownPlayers = this.lastState.get(clientId)?.players || {};
    const currentPlayers = {};
    const delta = {
      added: [],
      modified: [],
      removed: []
    };

    // Convert players array to indexed object for easier comparison
    players.forEach(player => {
      currentPlayers[player.id] = player;
    });

    // Find added and modified players
    for (const [playerId, player] of Object.entries(currentPlayers)) {
      const lastKnownPlayer = lastKnownPlayers[playerId];
      
      if (!lastKnownPlayer) {
        // New player
        delta.added.push(player);
      } else if (!this.deepEqual(lastKnownPlayer, player)) {
        // Modified player - only send changed fields
        const playerDelta = { id: playerId };
        for (const [key, value] of Object.entries(player)) {
          if (!this.deepEqual(lastKnownPlayer[key], value)) {
            playerDelta[key] = value;
          }
        }
        delta.modified.push(playerDelta);
      }
    }

    // Find removed players
    for (const playerId of Object.keys(lastKnownPlayers)) {
      if (!currentPlayers[playerId]) {
        delta.removed.push(playerId);
      }
    }

    // Update client's last known state
    if (!this.lastState.has(clientId)) {
      this.lastState.set(clientId, {});
    }
    this.lastState.get(clientId).players = currentPlayers;

    return {
      hasChanges: delta.added.length > 0 || delta.modified.length > 0 || delta.removed.length > 0,
      delta
    };
  }

  /**
   * Calculate delta for ore list (optimized for frequently changing positions)
   */
  getOresDelta(clientId, ores) {
    const lastKnownOres = this.lastState.get(clientId)?.ores || {};
    const currentOres = {};
    const delta = {
      added: [],
      removed: []
    };

    // Convert ores array to indexed object
    ores.forEach(ore => {
      currentOres[ore.id] = ore;
    });

    // Find added ores
    for (const [oreId, ore] of Object.entries(currentOres)) {
      if (!lastKnownOres[oreId]) {
        delta.added.push(ore);
      }
    }

    // Find removed ores
    for (const oreId of Object.keys(lastKnownOres)) {
      if (!currentOres[oreId]) {
        delta.removed.push(oreId);
      }
    }

    // Update client's last known state
    if (!this.lastState.has(clientId)) {
      this.lastState.set(clientId, {});
    }
    this.lastState.get(clientId).ores = currentOres;

    return {
      hasChanges: delta.added.length > 0 || delta.removed.length > 0,
      delta
    };
  }

  /**
   * Get optimized game state delta for a client
   */
  getGameStateDelta(clientId, gameState) {
    const playersDelta = this.getPlayersDelta(clientId, gameState.players);
    const oresDelta = this.getOresDelta(clientId, gameState.ores);

    const result = {
      version: this.stateVersion,
      hasChanges: playersDelta.hasChanges || oresDelta.hasChanges,
      delta: {}
    };

    if (playersDelta.hasChanges) {
      result.delta.players = playersDelta.delta;
    }

    if (oresDelta.hasChanges) {
      result.delta.ores = oresDelta.delta;
    }

    // Include other game state properties that might have changed
    const otherProps = ['events', 'serverTime', 'gameMode'];
    for (const prop of otherProps) {
      if (gameState[prop] !== undefined) {
        const lastKnown = this.lastState.get(clientId)?.[prop];
        if (!this.deepEqual(lastKnown, gameState[prop])) {
          result.delta[prop] = gameState[prop];
          result.hasChanges = true;
          
          // Update last known state
          if (!this.lastState.has(clientId)) {
            this.lastState.set(clientId, {});
          }
          this.lastState.get(clientId)[prop] = this.deepClone(gameState[prop]);
        }
      }
    }

    return result;
  }

  /**
   * Remove a client from tracking
   */
  removeClient(clientId) {
    this.lastState.delete(clientId);
  }

  /**
   * Force a full state update for a client (useful when client reconnects)
   */
  forceFullUpdate(clientId) {
    this.lastState.delete(clientId);
  }

  /**
   * Get statistics about delta state management
   */
  getStats() {
    return {
      trackedClients: this.lastState.size,
      stateVersion: this.stateVersion,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  estimateMemoryUsage() {
    let totalSize = 0;
    for (const [clientId, state] of this.lastState.entries()) {
      totalSize += JSON.stringify(state).length;
    }
    return {
      estimatedBytes: totalSize,
      estimatedKB: Math.round(totalSize / 1024 * 100) / 100
    };
  }

  /**
   * Deep equality check
   */
  deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) return obj1 === obj2;
    
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 !== 'object') return obj1 === obj2;
    
    if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }

  /**
   * Deep clone helper
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    
    const cloned = {};
    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = this.deepClone(value);
    }
    return cloned;
  }

  /**
   * Cleanup old client states to prevent memory leaks
   */
  cleanup(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    const clientsToRemove = [];
    
    for (const [clientId, state] of this.lastState.entries()) {
      if (state.lastAccess && (now - state.lastAccess) > maxAge) {
        clientsToRemove.push(clientId);
      }
    }
    
    clientsToRemove.forEach(clientId => {
      this.lastState.delete(clientId);
    });
    
    return clientsToRemove.length;
  }
}

module.exports = DeltaStateManager;