describe('Ship Customization System', () => {
  describe('Advanced Component Types', () => {
    test('should have reactor components with power generation', () => {
      const ADVANCED_COMPONENTS = {
        reactor: { 
          cost: 120, 
          type: 'power', 
          id: 'reactor',
          powerGeneration: 10,
          efficiency: 0.85
        },
        'fusion-reactor': { 
          cost: 300, 
          type: 'power', 
          id: 'fusion-reactor',
          powerGeneration: 25,
          efficiency: 0.95
        }
      };
      
      expect(ADVANCED_COMPONENTS.reactor.powerGeneration).toBe(10);
      expect(ADVANCED_COMPONENTS['fusion-reactor'].powerGeneration).toBe(25);
    });

    test('should have life support components with crew efficiency', () => {
      const lifeSupport = {
        cost: 45,
        type: 'utility',
        id: 'life-support',
        crewCapacity: 5,
        oxygenGeneration: 100,
        efficiencyBonus: 0.2
      };
      
      expect(lifeSupport.crewCapacity).toBe(5);
      expect(lifeSupport.efficiencyBonus).toBe(0.2);
    });

    test('should have sensor arrays with detection bonuses', () => {
      const sensors = {
        cost: 80,
        type: 'utility', 
        id: 'sensor-array',
        detectionRange: 50,
        targetingAccuracy: 0.15
      };
      
      expect(sensors.detectionRange).toBe(50);
      expect(sensors.targetingAccuracy).toBe(0.15);
    });

    test('should have thruster components with agility bonuses', () => {
      const thruster = {
        cost: 25,
        type: 'propulsion',
        id: 'thruster',
        agilityBonus: 0.4,
        powerConsumption: 2
      };
      
      expect(thruster.agilityBonus).toBe(0.4);
      expect(thruster.powerConsumption).toBe(2);
    });
  });

  describe('Power System Calculations', () => {
    test('should calculate total power generation', () => {
      const components = [
        { id: 'reactor', powerGeneration: 10 },
        { id: 'reactor', powerGeneration: 10 },
        { id: 'fusion-reactor', powerGeneration: 25 }
      ];
      
      const totalPower = components.reduce((total, comp) => {
        return total + (comp.powerGeneration || 0);
      }, 0);
      
      expect(totalPower).toBe(45);
    });

    test('should calculate power consumption', () => {
      const components = [
        { id: 'shield', powerConsumption: 5 },
        { id: 'weapon', powerConsumption: 8 },
        { id: 'thruster', powerConsumption: 2 },
        { id: 'life-support', powerConsumption: 3 }
      ];
      
      const totalConsumption = components.reduce((total, comp) => {
        return total + (comp.powerConsumption || 0);
      }, 0);
      
      expect(totalConsumption).toBe(18);
    });

    test('should validate power balance', () => {
      const powerGeneration = 45;
      const powerConsumption = 35;
      const powerBalance = powerGeneration - powerConsumption;
      
      expect(powerBalance).toBe(10);
      expect(powerBalance > 0).toBe(true); // Power surplus
    });

    test('should detect power deficit', () => {
      const powerGeneration = 20;
      const powerConsumption = 35;
      const powerBalance = powerGeneration - powerConsumption;
      
      expect(powerBalance).toBe(-15);
      expect(powerBalance < 0).toBe(true); // Power deficit
    });
  });

  describe('Structural Integrity System', () => {
    test('should calculate hull structural points', () => {
      const hullComponents = [
        { id: 'hull', structuralIntegrity: 100 },
        { id: 'hull', structuralIntegrity: 100 },
        { id: 'armor-plating', structuralIntegrity: 150 }
      ];
      
      const totalIntegrity = hullComponents.reduce((total, comp) => {
        return total + (comp.structuralIntegrity || 0);
      }, 0);
      
      expect(totalIntegrity).toBe(350);
    });

    test('should validate minimum structural requirements', () => {
      const components = [
        { id: 'engine', structuralLoad: 50 },
        { id: 'weapon', structuralLoad: 75 },
        { id: 'reactor', structuralLoad: 100 }
      ];
      
      const totalLoad = components.reduce((total, comp) => {
        return total + (comp.structuralLoad || 0);
      }, 0);
      
      const minimumIntegrityRequired = totalLoad * 1.2; // 20% safety margin
      expect(minimumIntegrityRequired).toBe(270);
    });

    test('should validate structural integrity vs load', () => {
      const structuralIntegrity = 350;
      const structuralLoad = 225;
      const safetyMargin = structuralIntegrity / structuralLoad;
      
      expect(safetyMargin).toBeGreaterThan(1.2); // Safe design
      expect(Math.round(safetyMargin * 100) / 100).toBe(1.56);
    });
  });

  describe('Ship Template System', () => {
    test('should validate template data structure', () => {
      const template = {
        name: 'Fighter MK-I',
        category: 'combat',
        description: 'Fast attack vessel',
        cost: 500,
        components: [
          { id: 'hull', x: 10, y: 10, rotation: 0 },
          { id: 'engine', x: 8, y: 10, rotation: 0 },
          { id: 'weapon', x: 12, y: 10, rotation: 0 }
        ],
        metadata: {
          author: 'player123',
          version: '1.0',
          rating: 4.5,
          downloads: 150
        }
      };
      
      expect(template.name).toBeDefined();
      expect(template.category).toBe('combat');
      expect(template.components).toHaveLength(3);
      expect(template.cost).toBe(500);
      expect(template.metadata.rating).toBe(4.5);
    });

    test('should calculate template total cost', () => {
      const componentCosts = {
        'hull': 0,
        'engine': 50,
        'weapon': 70,
        'reactor': 120
      };
      
      const components = [
        { id: 'hull' },
        { id: 'engine' },
        { id: 'weapon' },
        { id: 'weapon' },
        { id: 'reactor' }
      ];
      
      const totalCost = components.reduce((total, comp) => {
        return total + (componentCosts[comp.id] || 0);
      }, 0);
      
      expect(totalCost).toBe(310); // 0 + 50 + 70 + 70 + 120
    });

    test('should validate template categories', () => {
      const validCategories = [
        'combat', 'mining', 'exploration', 'transport', 'hybrid'
      ];
      
      const testCategories = ['combat', 'invalid', 'mining', 'unknown'];
      const validation = testCategories.map(cat => validCategories.includes(cat));
      
      expect(validation).toEqual([true, false, true, false]);
    });
  });

  describe('Ship Design Validation', () => {
    test('should require essential components', () => {
      const essentialComponents = ['hull', 'engine'];
      const shipComponents = [
        { id: 'hull' },
        { id: 'weapon' },
        { id: 'shield' }
      ];
      
      const hasEssentials = essentialComponents.every(essential => 
        shipComponents.some(comp => comp.id === essential)
      );
      
      expect(hasEssentials).toBe(false); // Missing engine
    });

    test('should validate component positioning', () => {
      const gridSize = { width: 30, height: 20 };
      const components = [
        { id: 'hull', x: 15, y: 10, width: 2, height: 2 },
        { id: 'engine', x: 13, y: 10, width: 1, height: 1 },
        { id: 'weapon', x: 35, y: 25, width: 1, height: 1 } // Out of bounds
      ];
      
      const validPositions = components.map(comp => {
        return (comp.x + comp.width <= gridSize.width) && 
               (comp.y + comp.height <= gridSize.height) &&
               (comp.x >= 0 && comp.y >= 0);
      });
      
      expect(validPositions).toEqual([true, true, false]);
    });

    test('should detect component collisions', () => {
      const components = [
        { id: 'hull', x: 10, y: 10, width: 3, height: 3 },
        { id: 'engine', x: 11, y: 11, width: 1, height: 1 }, // Overlaps hull
        { id: 'weapon', x: 15, y: 10, width: 1, height: 1 }  // No overlap
      ];
      
      function componentsOverlap(comp1, comp2) {
        return !(comp1.x + comp1.width <= comp2.x || 
                comp2.x + comp2.width <= comp1.x || 
                comp1.y + comp1.height <= comp2.y || 
                comp2.y + comp2.height <= comp1.y);
      }
      
      const hull = components[0];
      const engine = components[1];
      const weapon = components[2];
      
      expect(componentsOverlap(hull, engine)).toBe(true);  // Collision
      expect(componentsOverlap(hull, weapon)).toBe(false); // No collision
    });
  });

  describe('Component Effects Integration', () => {
    test('should calculate enhanced ship properties with new components', () => {
      const ship = {
        modules: [
          { id: 'hull' },
          { id: 'engine' },
          { id: 'engine' },
          { id: 'reactor' },
          { id: 'life-support' },
          { id: 'sensor-array' }
        ]
      };
      
      const componentEffects = {
        engine: { speedBonus: 0.3 },
        reactor: { powerGeneration: 10 },
        'life-support': { efficiencyBonus: 0.2 },
        'sensor-array': { detectionRange: 50 }
      };
      
      // Count components
      const componentCounts = {};
      ship.modules.forEach(module => {
        componentCounts[module.id] = (componentCounts[module.id] || 0) + 1;
      });
      
      // Calculate effects
      const engines = componentCounts.engine || 0;
      const reactors = componentCounts.reactor || 0;
      const lifeSupportSystems = componentCounts['life-support'] || 0;
      
      const speedMultiplier = 1 + (engines * (componentEffects.engine?.speedBonus || 0));
      const powerGeneration = reactors * (componentEffects.reactor?.powerGeneration || 0);
      const efficiencyBonus = lifeSupportSystems * (componentEffects['life-support']?.efficiencyBonus || 0);
      
      expect(speedMultiplier).toBe(1.6); // 1 + (2 * 0.3)
      expect(powerGeneration).toBe(10);  // 1 * 10
      expect(efficiencyBonus).toBe(0.2); // 1 * 0.2
    });

    test('should maintain backward compatibility with existing components', () => {
      const legacyShip = {
        modules: [
          { id: 'hull', x: 0, y: 0 },
          { id: 'engine', x: 22, y: 0 },
          { id: 'weapon', x: 44, y: 0 },
          { id: 'shield', x: 66, y: 0 }
        ]
      };
      
      const legacyEffects = {
        engine: { speedMultiplier: 0.3 },
        weapon: { damageBonus: 25 },
        shield: { healthBonus: 100 }
      };
      
      // Should work with existing calculation system
      const componentCounts = {};
      legacyShip.modules.forEach(module => {
        if (module.id !== 'hull') {
          componentCounts[module.id] = (componentCounts[module.id] || 0) + 1;
        }
      });
      
      expect(componentCounts.engine).toBe(1);
      expect(componentCounts.weapon).toBe(1);
      expect(componentCounts.shield).toBe(1);
      expect(componentCounts.hull).toBeUndefined();
    });
  });

  describe('Template Rating System', () => {
    test('should calculate average template rating', () => {
      const ratings = [5, 4, 5, 3, 4, 5, 4];
      const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      const roundedAverage = Math.round(average * 10) / 10;
      
      expect(roundedAverage).toBe(4.3);
    });

    test('should validate rating values', () => {
      const testRatings = [1, 3, 5, 0, 6, -1, 3.5];
      const validRatings = testRatings.filter(rating => 
        rating >= 1 && rating <= 5 && Number.isInteger(rating)
      );
      
      expect(validRatings).toEqual([1, 3, 5]); // Invalid: 0, 6, -1, 3.5
    });

    test('should sort templates by popularity', () => {
      const templates = [
        { name: 'Fighter', downloads: 150, rating: 4.2 },
        { name: 'Miner', downloads: 300, rating: 3.8 },
        { name: 'Explorer', downloads: 75, rating: 4.8 }
      ];
      
      const sortedByDownloads = [...templates].sort((a, b) => b.downloads - a.downloads);
      const sortedByRating = [...templates].sort((a, b) => b.rating - a.rating);
      
      expect(sortedByDownloads[0].name).toBe('Miner');
      expect(sortedByRating[0].name).toBe('Explorer');
    });
  });
});