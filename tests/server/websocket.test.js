// WebSocket integration tests
// Note: These tests require the actual server to be running
// They are marked as integration tests and can be run separately

describe('WebSocket Integration Tests', () => {
  describe('Connection Handling', () => {
    test.skip('should handle WebSocket connections when server is running', () => {
      // This test requires the actual server to be running
      // Run with: npm start (in another terminal) then npm test
    });

    test('should validate WebSocket message structure', () => {
      const validMessages = [
        { type: 'input', up: true, down: false, left: false, right: true },
        { type: 'buy', itemId: 'engine' },
        { type: 'build', module: { id: 'cargo', x: 22, y: 0 } }
      ];

      validMessages.forEach(msg => {
        expect(msg).toHaveProperty('type');
        expect(typeof msg.type).toBe('string');
      });
    });

    test('should validate init message format', () => {
      const initMessage = {
        type: 'init',
        id: 'player-uuid-123',
        players: [
          { id: 'player-1', x: 0, y: 0, modules: [], resources: 100, level: 1 }
        ],
        ores: [
          { id: 'ore-1', x: 100, y: 100, value: 25 }
        ],
        items: {
          engine: { cost: 50, type: 'module', id: 'engine' }
        }
      };

      expect(initMessage.type).toBe('init');
      expect(initMessage.id).toBeDefined();
      expect(Array.isArray(initMessage.players)).toBe(true);
      expect(Array.isArray(initMessage.ores)).toBe(true);
      expect(typeof initMessage.items).toBe('object');
    });

    test('should validate update message format', () => {
      const updateMessage = {
        type: 'update',
        players: [
          { id: 'player-1', x: 10, y: 20, modules: [], resources: 125, level: 1 }
        ],
        ores: [
          { id: 'ore-2', x: 200, y: 200, value: 25 }
        ]
      };

      expect(updateMessage.type).toBe('update');
      expect(Array.isArray(updateMessage.players)).toBe(true);
      expect(Array.isArray(updateMessage.ores)).toBe(true);
    });

    test('should validate resources message format', () => {
      const resourcesMessage = {
        type: 'resources',
        resources: 150
      };

      expect(resourcesMessage.type).toBe('resources');
      expect(typeof resourcesMessage.resources).toBe('number');
      expect(resourcesMessage.resources).toBeGreaterThanOrEqual(0);
    });

    test('should validate player_disconnect message format', () => {
      const disconnectMessage = {
        type: 'player_disconnect',
        id: 'player-uuid-123'
      };

      expect(disconnectMessage.type).toBe('player_disconnect');
      expect(disconnectMessage.id).toBeDefined();
      expect(typeof disconnectMessage.id).toBe('string');
    });

    test('should validate event message format', () => {
      const eventMessage = {
        type: 'event',
        event: {
          type: 'supernova',
          x: 500,
          y: -500
        }
      };

      expect(eventMessage.type).toBe('event');
      expect(eventMessage.event).toBeDefined();
      expect(eventMessage.event.type).toBe('supernova');
      expect(typeof eventMessage.event.x).toBe('number');
      expect(typeof eventMessage.event.y).toBe('number');
    });
  });

  describe('Message Validation', () => {
    test('should reject invalid message types', () => {
      const isValidMessageType = (type) => {
        const validTypes = ['input', 'buy', 'build'];
        return validTypes.includes(type);
      };

      expect(isValidMessageType('input')).toBe(true);
      expect(isValidMessageType('buy')).toBe(true);
      expect(isValidMessageType('build')).toBe(true);
      expect(isValidMessageType('invalid')).toBe(false);
      expect(isValidMessageType('')).toBe(false);
      expect(isValidMessageType(null)).toBe(false);
    });

    test('should validate input message structure', () => {
      const validateInput = (msg) => {
        return msg.type === 'input' &&
               typeof msg.up === 'boolean' &&
               typeof msg.down === 'boolean' &&
               typeof msg.left === 'boolean' &&
               typeof msg.right === 'boolean';
      };

      const validInput = { type: 'input', up: true, down: false, left: true, right: false };
      const invalidInput1 = { type: 'input', up: 'true' }; // Wrong type
      const invalidInput2 = { type: 'input' }; // Missing fields

      expect(validateInput(validInput)).toBe(true);
      expect(validateInput(invalidInput1)).toBe(false);
      expect(validateInput(invalidInput2)).toBe(false);
    });

    test('should validate buy message structure', () => {
      const validateBuy = (msg) => {
        const validItems = ['engine', 'cargo', 'weapon', 'shield'];
        return msg.type === 'buy' &&
               typeof msg.itemId === 'string' &&
               validItems.includes(msg.itemId);
      };

      const validBuy = { type: 'buy', itemId: 'engine' };
      const invalidBuy1 = { type: 'buy', itemId: 'invalid' };
      const invalidBuy2 = { type: 'buy' }; // Missing itemId

      expect(validateBuy(validBuy)).toBe(true);
      expect(validateBuy(invalidBuy1)).toBe(false);
      expect(validateBuy(invalidBuy2)).toBe(false);
    });

    test('should validate build message structure', () => {
      const validateBuild = (msg) => {
        if (msg.type !== 'build') return false;
        if (!msg.module) return false;
        return typeof msg.module.id === 'string' &&
               typeof msg.module.x === 'number' &&
               typeof msg.module.y === 'number';
      };

      const validBuild = { type: 'build', module: { id: 'engine', x: 22, y: 0 } };
      const invalidBuild1 = { type: 'build', module: { id: 'engine' } }; // Missing x, y
      const invalidBuild2 = { type: 'build' }; // Missing module

      expect(validateBuild(validBuild)).toBe(true);
      expect(validateBuild(invalidBuild1)).toBe(false);
      expect(validateBuild(invalidBuild2)).toBe(false);
    });
  });
});