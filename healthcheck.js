#!/usr/bin/env node
/**
 * Health check script for StarForgeFrontier
 * Used by Docker, load balancers, and monitoring systems
 */

const http = require('http');
const WebSocket = require('ws');

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;
const TIMEOUT = 5000; // 5 second timeout

async function checkHTTP() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: '/api/health',
      method: 'GET',
      timeout: TIMEOUT
    }, (res) => {
      if (res.statusCode === 200) {
        resolve('HTTP OK');
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP Timeout'));
    });
    
    req.end();
  });
}

async function checkWebSocket() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${HOST}:${PORT}`);
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket Timeout'));
    }, TIMEOUT);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      ws.close();
      resolve('WebSocket OK');
    });
    
    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function checkDatabase() {
  try {
    const Database = require('./database');
    const db = new Database();
    await db.initialize();
    
    // Simple query to test database connectivity
    await db.get('SELECT 1 as test');
    await db.close();
    
    return 'Database OK';
  } catch (error) {
    throw new Error(`Database: ${error.message}`);
  }
}

async function healthCheck() {
  const checks = [];
  const results = {};
  
  try {
    // Parallel health checks
    checks.push(checkHTTP().then(r => results.http = r));
    checks.push(checkWebSocket().then(r => results.websocket = r));
    checks.push(checkDatabase().then(r => results.database = r));
    
    await Promise.all(checks);
    
    console.log('✅ Health Check Passed:', results);
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Health Check Failed:', error.message);
    console.error('Results:', results);
    process.exit(1);
  }
}

// Add health check endpoint to server if running as module
if (require.main === module) {
  healthCheck();
} else {
  module.exports = { checkHTTP, checkWebSocket, checkDatabase };
}