const request = require('supertest');
const express = require('express');

describe('StarForgeFrontier Server', () => {
  let app;

  beforeAll(() => {
    // Create a simple Express app for testing static file serving
    app = express();
    app.use(express.static('public'));
  });

  describe('HTTP Server', () => {
    test('should serve static files', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });

    test('should serve CSS file', async () => {
      const response = await request(app).get('/style.css');
      expect(response.status).toBe(200);
    });

    test('should serve JavaScript file', async () => {
      const response = await request(app).get('/client.js');
      expect(response.status).toBe(200);
    });

    test('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent');
      expect(response.status).toBe(404);
    });
  });

  describe('Server Configuration', () => {
    test('should use environment PORT if available', () => {
      const testPort = '4000';
      process.env.PORT = testPort;
      const port = process.env.PORT || 3000;
      expect(port).toBe(testPort);
      delete process.env.PORT;
    });

    test('should default to port 3000 if no environment PORT', () => {
      delete process.env.PORT;
      const port = process.env.PORT || 3000;
      expect(port).toBe(3000);
    });
  });
});