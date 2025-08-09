const request = require('supertest');
const { calculateShipProperties, updateShipProperties } = require('../../test-helpers/ship-helpers');

describe('Ship Component System', () => {
  describe('Component Effects Calculation', () => {
    test('should calculate base ship properties with no components', () => {
      const player = { modules: [{ id: 'hull', x: 0, y: 0 }] };
      const properties = calculateShipProperties(player);
      
      expect(properties.speed).toBe(2.0);
      expect(properties.cargoCapacity).toBe(1000);
      expect(properties.collectionRange).toBe(40);
      expect(properties.maxHealth).toBe(100);
      expect(properties.damage).toBe(0);
      expect(properties.weaponRange).toBe(0);
    });

    test('should increase speed with engine modules', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'engine', x: 22, y: 0 },
          { id: 'engine', x: 44, y: 0 }
        ]
      };
      const properties = calculateShipProperties(player);
      
      // Base speed 2.0 + 2 engines * 30% each = 2.0 * (1 + 0.6) = 3.2
      expect(properties.speed).toBe(3.2);
      expect(properties.componentCounts.engine).toBe(2);
    });

    test('should increase cargo capacity with cargo modules', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'cargo', x: 22, y: 0 }
        ]
      };
      const properties = calculateShipProperties(player);
      
      // Base 1000 + 1 cargo * 500 = 1500
      expect(properties.cargoCapacity).toBe(1500);
      expect(properties.collectionRange).toBe(50); // Base 40 + 10 per cargo
    });

    test('should increase damage with weapon modules', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'weapon', x: 22, y: 0 },
          { id: 'weapon', x: 44, y: 0 }
        ]
      };
      const properties = calculateShipProperties(player);
      
      expect(properties.damage).toBe(50); // 2 weapons * 25 damage each
      expect(properties.weaponRange).toBe(20); // 2 weapons * 10 range each
    });

    test('should increase health with shield modules', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'shield', x: 22, y: 0 }
        ]
      };
      const properties = calculateShipProperties(player);
      
      expect(properties.maxHealth).toBe(200); // Base 100 + 1 shield * 100
    });

    test('should handle mixed component configurations', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'engine', x: 22, y: 0 },
          { id: 'cargo', x: 44, y: 0 },
          { id: 'weapon', x: 66, y: 0 },
          { id: 'shield', x: 88, y: 0 }
        ]
      };
      const properties = calculateShipProperties(player);
      
      expect(properties.speed).toBe(2.6); // 2.0 * (1 + 0.3)
      expect(properties.cargoCapacity).toBe(1500); // 1000 + 500
      expect(properties.collectionRange).toBe(50); // 40 + 10
      expect(properties.damage).toBe(25); // 1 * 25
      expect(properties.weaponRange).toBe(10); // 1 * 10
      expect(properties.maxHealth).toBe(200); // 100 + 100
    });

    test('should handle empty or missing modules array', () => {
      const player1 = { modules: [] };
      const player2 = {};
      
      const properties1 = calculateShipProperties(player1);
      const properties2 = calculateShipProperties(player2);
      
      [properties1, properties2].forEach(properties => {
        expect(properties.speed).toBe(2.0);
        expect(properties.cargoCapacity).toBe(1000);
        expect(properties.collectionRange).toBe(40);
        expect(properties.maxHealth).toBe(100);
      });
    });
  });

  describe('Ship Properties Update', () => {
    test('should initialize player health to max health', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'shield', x: 22, y: 0 }
        ]
      };
      
      updateShipProperties(player);
      
      expect(player.health).toBe(200); // Should match maxHealth
      expect(player.shipProperties.maxHealth).toBe(200);
    });

    test('should cap existing health to new max health', () => {
      const player = { 
        modules: [{ id: 'hull', x: 0, y: 0 }],
        health: 250 // Higher than base max health
      };
      
      updateShipProperties(player);
      
      expect(player.health).toBe(100); // Capped to maxHealth
      expect(player.shipProperties.maxHealth).toBe(100);
    });

    test('should preserve health below max when adding shields', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'shield', x: 22, y: 0 }
        ],
        health: 80
      };
      
      updateShipProperties(player);
      
      expect(player.health).toBe(80); // Preserved
      expect(player.shipProperties.maxHealth).toBe(200); // Increased
    });

    test('should store calculated properties on player object', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'engine', x: 22, y: 0 }
        ]
      };
      
      const properties = updateShipProperties(player);
      
      expect(player.shipProperties).toBeDefined();
      expect(player.shipProperties).toEqual(properties);
      expect(player.shipProperties.speed).toBe(2.6);
    });
  });

  describe('Component Counting', () => {
    test('should correctly count multiple instances of same component', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'engine', x: 22, y: 0 },
          { id: 'engine', x: 44, y: 0 },
          { id: 'engine', x: 66, y: 0 },
          { id: 'cargo', x: 88, y: 0 },
          { id: 'cargo', x: 110, y: 0 }
        ]
      };
      const properties = calculateShipProperties(player);
      
      expect(properties.componentCounts.engine).toBe(3);
      expect(properties.componentCounts.cargo).toBe(2);
      expect(properties.componentCounts.hull).toBeUndefined(); // Hull not counted
    });

    test('should handle zero components correctly', () => {
      const player = { modules: [{ id: 'hull', x: 0, y: 0 }] };
      const properties = calculateShipProperties(player);
      
      expect(properties.componentCounts).toEqual({});
    });
  });

  describe('Property Rounding', () => {
    test('should round speed to 2 decimal places', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'engine', x: 22, y: 0 } // Results in 2.6
        ]
      };
      const properties = calculateShipProperties(player);
      
      expect(properties.speed).toBe(2.6);
      expect(typeof properties.speed).toBe('number');
    });

    test('should handle complex speed calculations', () => {
      // Create scenario that would result in floating point precision issues
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'engine', x: 22, y: 0 },
          { id: 'engine', x: 44, y: 0 },
          { id: 'engine', x: 66, y: 0 } // 3 engines
        ]
      };
      const properties = calculateShipProperties(player);
      
      // 2.0 * (1 + 3 * 0.3) = 2.0 * 1.9 = 3.8
      expect(properties.speed).toBe(3.8);
    });
  });

  describe('Component Constants', () => {
    test('should use correct base values', () => {
      const player = { modules: [] };
      const properties = calculateShipProperties(player);
      
      expect(properties.speed).toBe(2.0); // BASE_SPEED
      expect(properties.cargoCapacity).toBe(1000); // BASE_CARGO_CAPACITY
      expect(properties.collectionRange).toBe(40); // BASE_COLLECTION_RANGE
    });

    test('should apply correct multipliers', () => {
      const player = { 
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'engine', x: 22, y: 0 } // One engine
        ]
      };
      const properties = calculateShipProperties(player);
      
      // 2.0 * (1 + 1 * 0.3) = 2.0 * 1.3 = 2.6
      expect(properties.speed).toBe(2.6);
    });
  });
});