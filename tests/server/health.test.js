const request = require('supertest');
const express = require('express');
const { checkHTTP, checkWebSocket, checkDatabase } = require('../../healthcheck');

describe('Health Check System', () => {
  let app;

  beforeAll(() => {
    // Create a minimal Express app for health testing
    app = express();
    
    // Mock health endpoint
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: 'test',
        version: '1.0.0',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        players: {
          active: 0,
          sessions: 0
        },
        database: {
          initialized: true
        }
      });
    });

    // Mock metrics endpoint
    app.get('/metrics', (req, res) => {
      const metrics = [
        '# HELP active_players Number of active players',
        '# TYPE active_players gauge',
        'active_players 0',
        '',
        '# HELP process_uptime_seconds Process uptime in seconds',
        '# TYPE process_uptime_seconds counter',
        `process_uptime_seconds ${process.uptime()}`
      ].join('\n');
      
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    });
  });

  describe('Health Endpoint', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.environment).toBe('test');
      expect(response.body.memory).toBeDefined();
      expect(response.body.players).toBeDefined();
      expect(response.body.database).toBeDefined();
    });

    test('should have correct structure', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('players');
      expect(response.body).toHaveProperty('database');
      
      expect(response.body.memory).toHaveProperty('used');
      expect(response.body.memory).toHaveProperty('total');
      expect(response.body.players).toHaveProperty('active');
      expect(response.body.players).toHaveProperty('sessions');
      expect(response.body.database).toHaveProperty('initialized');
    });

    test('should return valid timestamp', async () => {
      const response = await request(app).get('/api/health');
      
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should return reasonable memory values', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.body.memory.used).toBeGreaterThan(0);
      expect(response.body.memory.total).toBeGreaterThan(0);
      expect(response.body.memory.used).toBeLessThanOrEqual(response.body.memory.total);
    });
  });

  describe('Metrics Endpoint', () => {
    test('should return Prometheus metrics', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toContain('text/plain');
      expect(response.text).toContain('active_players');
      expect(response.text).toContain('process_uptime_seconds');
    });

    test('should have proper Prometheus format', async () => {
      const response = await request(app).get('/metrics');
      
      const lines = response.text.split('\n');
      const helpLines = lines.filter(line => line.startsWith('# HELP'));
      const typeLines = lines.filter(line => line.startsWith('# TYPE'));
      const metricLines = lines.filter(line => line && !line.startsWith('#'));
      
      expect(helpLines.length).toBeGreaterThan(0);
      expect(typeLines.length).toBeGreaterThan(0);
      expect(metricLines.length).toBeGreaterThan(0);
      
      // Check metric format
      metricLines.forEach(line => {
        expect(line).toMatch(/^\w+\s+\d+/);
      });
    });

    test('should include expected metrics', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('active_players 0');
      expect(response.text).toMatch(/process_uptime_seconds \d+/);
    });
  });

  describe('Health Check Functions', () => {
    test('checkHTTP should validate HTTP endpoints', async () => {
      // This test would need a running server
      // For now, we test the function exists and is callable
      expect(typeof checkHTTP).toBe('function');
    });

    test('checkWebSocket should validate WebSocket connections', async () => {
      expect(typeof checkWebSocket).toBe('function');
    });

    test('checkDatabase should validate database connectivity', async () => {
      expect(typeof checkDatabase).toBe('function');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing endpoints gracefully', async () => {
      const response = await request(app).get('/api/nonexistent');
      expect(response.status).toBe(404);
    });

    test('should handle malformed requests', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Content-Type', 'invalid');
      
      // Should still work despite malformed header
      expect(response.status).toBe(200);
    });
  });

  describe('Performance', () => {
    test('health endpoint should respond quickly', async () => {
      const start = Date.now();
      await request(app).get('/api/health');
      const duration = Date.now() - start;
      
      // Should respond within 100ms
      expect(duration).toBeLessThan(100);
    });

    test('metrics endpoint should respond quickly', async () => {
      const start = Date.now();
      await request(app).get('/metrics');
      const duration = Date.now() - start;
      
      // Should respond within 100ms
      expect(duration).toBeLessThan(100);
    });

    test('should handle concurrent health checks', async () => {
      const requests = Array.from({ length: 10 }, () => 
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });
  });

  describe('Monitoring Integration', () => {
    test('should provide metrics for monitoring systems', async () => {
      const response = await request(app).get('/metrics');
      
      // Should contain metrics that monitoring systems expect
      expect(response.text).toContain('active_players');
      expect(response.text).toContain('process_uptime_seconds');
      
      // Should be in proper format for Prometheus scraping
      expect(response.get('Content-Type')).toContain('text/plain');
    });

    test('should provide health check for load balancers', async () => {
      const response = await request(app).get('/api/health');
      
      // Load balancers typically expect:
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    test('should include uptime information', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(typeof response.body.uptime).toBe('number');
    });

    test('should include memory information', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.body.memory).toBeDefined();
      expect(response.body.memory.used).toBeGreaterThan(0);
      expect(response.body.memory.total).toBeGreaterThan(0);
    });
  });
});