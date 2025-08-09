#!/usr/bin/env node
/**
 * Monitoring script for StarForgeFrontier
 * Provides real-time monitoring and alerting capabilities
 */

const http = require('http');
const WebSocket = require('ws');

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;
const MONITOR_INTERVAL = parseInt(process.env.MONITOR_INTERVAL) || 30000; // 30 seconds

class GameMonitor {
  constructor() {
    this.metrics = {
      health: null,
      players: 0,
      sessions: 0,
      memory: 0,
      uptime: 0,
      lastCheck: null,
      errors: 0,
      consecutiveErrors: 0
    };
    
    this.alerts = {
      highMemory: false,
      highPlayerCount: false,
      connectionErrors: false
    };
  }

  async checkHealth() {
    try {
      const health = await this.fetchHealth();
      this.metrics = {
        ...health,
        lastCheck: new Date(),
        errors: this.metrics.errors,
        consecutiveErrors: 0
      };
      
      this.checkAlerts();
      this.displayStatus();
      
    } catch (error) {
      this.metrics.consecutiveErrors += 1;
      this.metrics.errors += 1;
      console.error(`❌ Health check failed: ${error.message}`);
      
      if (this.metrics.consecutiveErrors >= 3) {
        this.sendAlert('CRITICAL', 'Service appears to be down after 3 consecutive failures');
      }
    }
  }

  async fetchHealth() {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: HOST,
        port: PORT,
        path: '/api/health',
        method: 'GET',
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const health = JSON.parse(data);
            resolve({
              health: health.status,
              players: health.players?.active || 0,
              sessions: health.players?.sessions || 0,
              memory: health.memory?.used || 0,
              uptime: health.uptime || 0,
              database: health.database?.initialized || false
            });
          } catch (err) {
            reject(new Error('Invalid health response'));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Health check timeout'));
      });
      
      req.end();
    });
  }

  checkAlerts() {
    // High memory usage alert (>400MB)
    if (this.metrics.memory > 400 && !this.alerts.highMemory) {
      this.sendAlert('WARNING', `High memory usage: ${this.metrics.memory}MB`);
      this.alerts.highMemory = true;
    } else if (this.metrics.memory <= 300) {
      this.alerts.highMemory = false;
    }

    // High player count alert (>50 players)
    if (this.metrics.players > 50 && !this.alerts.highPlayerCount) {
      this.sendAlert('INFO', `High player count: ${this.metrics.players} players online`);
      this.alerts.highPlayerCount = true;
    } else if (this.metrics.players <= 40) {
      this.alerts.highPlayerCount = false;
    }

    // Connection errors
    if (this.metrics.consecutiveErrors > 0 && !this.alerts.connectionErrors) {
      this.sendAlert('WARNING', `Connection errors detected: ${this.metrics.consecutiveErrors} consecutive failures`);
      this.alerts.connectionErrors = true;
    } else if (this.metrics.consecutiveErrors === 0) {
      this.alerts.connectionErrors = false;
    }
  }

  sendAlert(level, message) {
    const timestamp = new Date().toISOString();
    const alert = `[${timestamp}] ${level}: ${message}`;
    
    console.log(`🚨 ${alert}`);
    
    // In production, send to monitoring service or Slack
    // await this.sendToSlack(alert);
    // await this.sendToDatadog(alert);
  }

  displayStatus() {
    console.clear();
    console.log('🎮 StarForgeFrontier Monitoring Dashboard');
    console.log('═'.repeat(50));
    console.log();
    
    // Status overview
    const status = this.metrics.health === 'healthy' ? '✅ HEALTHY' : '❌ UNHEALTHY';
    console.log(`Status: ${status}`);
    console.log(`Last Check: ${this.metrics.lastCheck?.toLocaleTimeString() || 'Never'}`);
    console.log();
    
    // Player metrics
    console.log('👥 Player Metrics:');
    console.log(`   Active Players: ${this.metrics.players}`);
    console.log(`   Game Sessions: ${this.metrics.sessions}`);
    console.log();
    
    // System metrics
    console.log('⚙️  System Metrics:');
    console.log(`   Memory Usage: ${this.metrics.memory} MB`);
    console.log(`   Uptime: ${Math.floor(this.metrics.uptime / 3600)}h ${Math.floor((this.metrics.uptime % 3600) / 60)}m`);
    console.log(`   Database: ${this.metrics.database ? '✅ Connected' : '❌ Disconnected'}`);
    console.log();
    
    // Error tracking
    console.log('🔍 Error Tracking:');
    console.log(`   Total Errors: ${this.metrics.errors}`);
    console.log(`   Consecutive Errors: ${this.metrics.consecutiveErrors}`);
    console.log();
    
    // Active alerts
    console.log('🚨 Active Alerts:');
    const activeAlerts = Object.entries(this.alerts)
      .filter(([_, active]) => active)
      .map(([alert, _]) => alert);
    
    if (activeAlerts.length === 0) {
      console.log('   None');
    } else {
      activeAlerts.forEach(alert => {
        console.log(`   ⚠️  ${alert}`);
      });
    }
    
    console.log();
    console.log(`Next check in ${MONITOR_INTERVAL / 1000} seconds...`);
    console.log('Press Ctrl+C to stop monitoring');
  }

  async testWebSocket() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${HOST}:${PORT}`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket timeout'));
      }, 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      });
      
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async runOnce() {
    console.log('🔍 Running single health check...');
    await this.checkHealth();
    
    try {
      await this.testWebSocket();
      console.log('✅ WebSocket connection: OK');
    } catch (error) {
      console.log('❌ WebSocket connection: FAILED');
    }
  }

  start() {
    console.log(`🚀 Starting monitoring for ${HOST}:${PORT}`);
    console.log(`📊 Check interval: ${MONITOR_INTERVAL / 1000} seconds`);
    console.log();
    
    // Initial check
    this.checkHealth();
    
    // Start monitoring loop
    this.interval = setInterval(() => {
      this.checkHealth();
    }, MONITOR_INTERVAL);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping monitor...');
      if (this.interval) {
        clearInterval(this.interval);
      }
      process.exit(0);
    });
  }
}

// Command line interface
const command = process.argv[2];
const monitor = new GameMonitor();

switch (command) {
  case 'once':
    monitor.runOnce();
    break;
  case 'start':
  case undefined:
    monitor.start();
    break;
  default:
    console.log('Usage:');
    console.log('  node monitor.js start  - Start continuous monitoring (default)');
    console.log('  node monitor.js once   - Run single health check');
    process.exit(1);
}