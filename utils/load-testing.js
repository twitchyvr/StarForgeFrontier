/**
 * Load testing utilities for StarForgeFrontier server
 * Provides tools to simulate multiple concurrent players and measure performance
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class LoadTestClient {
  constructor(serverUrl, clientId) {
    this.serverUrl = serverUrl;
    this.clientId = clientId;
    this.ws = null;
    this.connected = false;
    this.authenticated = false;
    
    // Simulation state
    this.player = {
      id: uuidv4(),
      username: `LoadTestBot_${clientId}`,
      x: Math.random() * 800 - 400,
      y: Math.random() * 800 - 400,
      resources: 100,
      level: 1
    };
    
    // Behavior settings
    this.behavior = {
      movementSpeed: 2,
      movementChange: 0.1, // Probability to change direction
      messageFrequency: 100, // ms between actions
      resourceCollectionRate: 0.3, // Probability to try collecting resources
      buildingRate: 0.1 // Probability to build modules
    };
    
    // Performance metrics
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      latencyMeasurements: [],
      errors: 0,
      connectionTime: 0,
      lastPingTime: 0,
      avgLatency: 0
    };
    
    this.currentInputs = { up: false, down: false, left: false, right: false };
    this.isRunning = false;
  }

  /**
   * Connect to the server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);
        
        this.ws.on('open', () => {
          this.connected = true;
          this.metrics.connectionTime = Date.now();
          console.log(`Load test client ${this.clientId} connected`);
          this.authenticate();
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          this.metrics.errors++;
          console.error(`Load test client ${this.clientId} error:`, error);
          if (!this.connected) {
            reject(error);
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.authenticated = false;
          console.log(`Load test client ${this.clientId} disconnected`);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Authenticate with the server
   */
  authenticate() {
    const authMessage = {
      type: 'authenticate',
      isGuest: true,
      playerId: this.player.id,
      username: this.player.username
    };
    
    this.sendMessage(authMessage);
  }

  /**
   * Send a message to the server
   */
  sendMessage(message) {
    if (this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.metrics.messagesSent++;
      
      // Track latency for certain message types
      if (message.type === 'ping') {
        this.metrics.lastPingTime = Date.now();
      }
    }
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      this.metrics.messagesReceived++;
      
      switch (message.type) {
        case 'init':
          this.authenticated = true;
          this.player = { ...this.player, ...message.playerData };
          console.log(`Load test client ${this.clientId} authenticated`);
          break;
          
        case 'update':
          // Handle game state updates
          this.processGameUpdate(message);
          break;
          
        case 'pong':
          // Calculate latency
          if (this.metrics.lastPingTime > 0) {
            const latency = Date.now() - this.metrics.lastPingTime;
            this.metrics.latencyMeasurements.push(latency);
            this.updateAverageLatency();
          }
          break;
          
        case 'resources':
          this.player.resources = message.resources;
          break;
          
        case 'error':
          this.metrics.errors++;
          console.warn(`Load test client ${this.clientId} received error:`, message.message);
          break;
      }
    } catch (error) {
      this.metrics.errors++;
      console.error(`Load test client ${this.clientId} message parse error:`, error);
    }
  }

  /**
   * Process game state updates
   */
  processGameUpdate(message) {
    // Update player position if needed
    if (message.players) {
      const myPlayer = message.players.find(p => p.id === this.player.id);
      if (myPlayer) {
        this.player.x = myPlayer.x;
        this.player.y = myPlayer.y;
        this.player.resources = myPlayer.resources;
        this.player.level = myPlayer.level;
      }
    }
  }

  /**
   * Start simulating player behavior
   */
  startSimulation() {
    if (!this.authenticated || this.isRunning) return;
    
    this.isRunning = true;
    
    // Movement simulation
    this.movementInterval = setInterval(() => {
      this.simulateMovement();
    }, this.behavior.messageFrequency);
    
    // Action simulation
    this.actionInterval = setInterval(() => {
      this.simulateActions();
    }, this.behavior.messageFrequency * 3);
    
    // Ping for latency measurement
    this.pingInterval = setInterval(() => {
      this.sendMessage({ type: 'ping', timestamp: Date.now() });
    }, 5000);
  }

  /**
   * Stop the simulation
   */
  stopSimulation() {
    this.isRunning = false;
    
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
    }
    
    if (this.actionInterval) {
      clearInterval(this.actionInterval);
      this.actionInterval = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Simulate player movement
   */
  simulateMovement() {
    // Randomly change direction
    if (Math.random() < this.behavior.movementChange) {
      this.currentInputs.up = Math.random() < 0.25;
      this.currentInputs.down = Math.random() < 0.25;
      this.currentInputs.left = Math.random() < 0.25;
      this.currentInputs.right = Math.random() < 0.25;
    }
    
    // Send input message
    this.sendMessage({
      type: 'input',
      ...this.currentInputs
    });
  }

  /**
   * Simulate player actions
   */
  simulateActions() {
    // Try to build modules occasionally
    if (Math.random() < this.behavior.buildingRate && this.player.resources >= 30) {
      const modules = ['engine', 'cargo', 'weapon', 'shield'];
      const randomModule = modules[Math.floor(Math.random() * modules.length)];
      
      this.sendMessage({
        type: 'buy',
        itemId: randomModule
      });
    }
  }

  /**
   * Update average latency calculation
   */
  updateAverageLatency() {
    if (this.metrics.latencyMeasurements.length > 0) {
      const sum = this.metrics.latencyMeasurements.reduce((a, b) => a + b, 0);
      this.metrics.avgLatency = sum / this.metrics.latencyMeasurements.length;
      
      // Keep only last 50 measurements
      if (this.metrics.latencyMeasurements.length > 50) {
        this.metrics.latencyMeasurements = this.metrics.latencyMeasurements.slice(-50);
      }
    }
  }

  /**
   * Get client metrics
   */
  getMetrics() {
    return {
      clientId: this.clientId,
      connected: this.connected,
      authenticated: this.authenticated,
      uptime: this.connected ? Date.now() - this.metrics.connectionTime : 0,
      ...this.metrics,
      player: {
        id: this.player.id,
        username: this.player.username,
        position: { x: this.player.x, y: this.player.y },
        resources: this.player.resources,
        level: this.player.level
      }
    };
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    this.stopSimulation();
    
    if (this.ws && this.connected) {
      this.ws.close();
    }
  }
}

class LoadTestManager {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.clients = new Map();
    this.testConfig = {
      maxClients: 100,
      rampUpTime: 30000, // 30 seconds
      testDuration: 300000, // 5 minutes
      rampDownTime: 15000 // 15 seconds
    };
    
    // Test metrics
    this.testMetrics = {
      startTime: 0,
      endTime: 0,
      peakClients: 0,
      totalMessages: 0,
      totalErrors: 0,
      averageLatency: 0,
      throughput: 0 // messages per second
    };
    
    this.isRunning = false;
  }

  /**
   * Configure the load test
   */
  configure(config) {
    this.testConfig = { ...this.testConfig, ...config };
  }

  /**
   * Start the load test
   */
  async startLoadTest() {
    if (this.isRunning) {
      throw new Error('Load test is already running');
    }
    
    this.isRunning = true;
    this.testMetrics.startTime = Date.now();
    
    console.log(`Starting load test with ${this.testConfig.maxClients} clients`);
    console.log(`Ramp up: ${this.testConfig.rampUpTime}ms`);
    console.log(`Test duration: ${this.testConfig.testDuration}ms`);
    console.log(`Ramp down: ${this.testConfig.rampDownTime}ms`);
    
    try {
      // Ramp up phase
      await this.rampUp();
      
      // Test duration phase
      await this.runTest();
      
      // Ramp down phase
      await this.rampDown();
      
    } catch (error) {
      console.error('Load test error:', error);
    } finally {
      this.testMetrics.endTime = Date.now();
      this.isRunning = false;
      console.log('Load test completed');
      this.generateReport();
    }
  }

  /**
   * Ramp up clients gradually
   */
  async rampUp() {
    const interval = this.testConfig.rampUpTime / this.testConfig.maxClients;
    
    for (let i = 0; i < this.testConfig.maxClients; i++) {
      if (!this.isRunning) break;
      
      try {
        const client = new LoadTestClient(this.serverUrl, i);
        await client.connect();
        this.clients.set(i, client);
        
        // Start simulation after a short delay
        setTimeout(() => {
          if (client.authenticated) {
            client.startSimulation();
          }
        }, 1000);
        
        console.log(`Client ${i + 1}/${this.testConfig.maxClients} connected`);
        
        // Update peak clients
        this.testMetrics.peakClients = Math.max(this.testMetrics.peakClients, this.clients.size);
        
        // Wait before connecting next client
        await this.delay(interval);
        
      } catch (error) {
        console.error(`Failed to connect client ${i}:`, error);
        this.testMetrics.totalErrors++;
      }
    }
    
    console.log(`Ramp up complete: ${this.clients.size} clients connected`);
  }

  /**
   * Run the main test phase
   */
  async runTest() {
    console.log(`Running test for ${this.testConfig.testDuration}ms`);
    
    // Start metrics collection
    const metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000);
    
    // Wait for test duration
    await this.delay(this.testConfig.testDuration);
    
    clearInterval(metricsInterval);
    console.log('Test phase complete');
  }

  /**
   * Ramp down clients gradually
   */
  async rampDown() {
    const clientIds = Array.from(this.clients.keys());
    const interval = this.testConfig.rampDownTime / clientIds.length;
    
    for (const clientId of clientIds) {
      if (!this.isRunning) break;
      
      const client = this.clients.get(clientId);
      if (client) {
        client.disconnect();
        this.clients.delete(clientId);
        console.log(`Client ${clientId} disconnected. Remaining: ${this.clients.size}`);
      }
      
      await this.delay(interval);
    }
    
    console.log('Ramp down complete');
  }

  /**
   * Collect metrics from all clients
   */
  collectMetrics() {
    let totalMessages = 0;
    let totalErrors = 0;
    let totalLatency = 0;
    let connectedClients = 0;
    
    for (const client of this.clients.values()) {
      const metrics = client.getMetrics();
      
      if (metrics.connected) {
        connectedClients++;
        totalMessages += metrics.messagesReceived + metrics.messagesSent;
        totalErrors += metrics.errors;
        
        if (metrics.avgLatency > 0) {
          totalLatency += metrics.avgLatency;
        }
      }
    }
    
    this.testMetrics.totalMessages = totalMessages;
    this.testMetrics.totalErrors = totalErrors;
    this.testMetrics.averageLatency = connectedClients > 0 ? totalLatency / connectedClients : 0;
    
    // Calculate throughput (messages per second)
    const elapsed = Date.now() - this.testMetrics.startTime;
    this.testMetrics.throughput = totalMessages / (elapsed / 1000);
    
    console.log(`Metrics - Connected: ${connectedClients}, Messages: ${totalMessages}, Errors: ${totalErrors}, Avg Latency: ${Math.round(this.testMetrics.averageLatency)}ms, Throughput: ${Math.round(this.testMetrics.throughput)} msg/s`);
  }

  /**
   * Stop the load test
   */
  stopLoadTest() {
    this.isRunning = false;
    
    // Disconnect all clients
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
    
    console.log('Load test stopped');
  }

  /**
   * Generate a test report
   */
  generateReport() {
    const duration = this.testMetrics.endTime - this.testMetrics.startTime;
    
    const report = {
      testConfiguration: this.testConfig,
      testDuration: duration,
      peakClients: this.testMetrics.peakClients,
      totalMessages: this.testMetrics.totalMessages,
      totalErrors: this.testMetrics.totalErrors,
      averageLatency: Math.round(this.testMetrics.averageLatency),
      throughput: Math.round(this.testMetrics.throughput),
      errorRate: (this.testMetrics.totalErrors / this.testMetrics.totalMessages * 100) || 0,
      messagesPerClient: this.testMetrics.peakClients > 0 ? Math.round(this.testMetrics.totalMessages / this.testMetrics.peakClients) : 0
    };
    
    console.log('\n=== LOAD TEST REPORT ===');
    console.log(`Test Duration: ${duration / 1000}s`);
    console.log(`Peak Clients: ${report.peakClients}`);
    console.log(`Total Messages: ${report.totalMessages}`);
    console.log(`Total Errors: ${report.totalErrors}`);
    console.log(`Error Rate: ${report.errorRate.toFixed(2)}%`);
    console.log(`Average Latency: ${report.averageLatency}ms`);
    console.log(`Throughput: ${report.throughput} messages/second`);
    console.log(`Messages per Client: ${report.messagesPerClient}`);
    console.log('========================\n');
    
    return report;
  }

  /**
   * Get current test status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      connectedClients: this.clients.size,
      elapsedTime: this.isRunning ? Date.now() - this.testMetrics.startTime : 0,
      metrics: this.testMetrics
    };
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI tool for running load tests
if (require.main === module) {
  const args = process.argv.slice(2);
  const serverUrl = args[0] || 'ws://localhost:3000';
  const maxClients = parseInt(args[1]) || 10;
  const duration = parseInt(args[2]) || 60000; // 1 minute default
  
  const loadTest = new LoadTestManager(serverUrl);
  loadTest.configure({
    maxClients: maxClients,
    testDuration: duration,
    rampUpTime: Math.min(duration / 4, 30000),
    rampDownTime: Math.min(duration / 8, 15000)
  });
  
  console.log(`Starting load test against ${serverUrl}`);
  console.log(`Max clients: ${maxClients}, Duration: ${duration}ms`);
  
  loadTest.startLoadTest().catch(error => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Stopping load test...');
    loadTest.stopLoadTest();
    process.exit(0);
  });
}

module.exports = { LoadTestClient, LoadTestManager };