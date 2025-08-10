/**
 * Test suite for the integrated hazard system
 */

const Database = require('../../database');
const { HazardSystem } = require('../../hazards/HazardSystem');
const { HazardGenerator, DYNAMIC_EVENTS } = require('../../hazards/HazardGenerator');
const { HazardEffects } = require('../../hazards/HazardEffects');

describe('Integrated Hazard System', () => {
  let db;
  let hazardSystem;
  let hazardGenerator;
  let hazardEffects;

  beforeEach(async () => {
    db = new Database();
    await db.initialize();
    
    hazardSystem = new HazardSystem(db);
    await hazardSystem.initialize();
    
    // Mock sector manager for testing
    const mockSectorManager = {
      getPlayerSector: () => ({ isLoaded: true, ores: [] })
    };
    
    hazardGenerator = new HazardGenerator(mockSectorManager, db);
    hazardEffects = new HazardEffects();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Hazard System Integration', () => {
    test('should initialize hazard system successfully', () => {
      expect(hazardSystem).toBeDefined();
      expect(hazardGenerator).toBeDefined();
      expect(hazardEffects).toBeDefined();
    });

    test('should create hazards in sectors', async () => {
      const hazard = await hazardSystem.spawnHazard(0, 0, 'ASTEROID_FIELD', 100, 100);
      
      expect(hazard).toBeDefined();
      expect(hazard.type).toBe('ASTEROID_FIELD');
      expect(hazard.x).toBe(100);
      expect(hazard.y).toBe(100);
      expect(hazard.id).toBeDefined();
    });

    test('should process player hazard effects', () => {
      const playerId = 'test-player';
      const playerPosition = { x: 100, y: 100 };
      const sectorCoords = { x: 0, y: 0 };
      
      // Initialize player
      hazardEffects.initializePlayer(playerId);
      
      // Create a mock hazard effect
      const mockHazardEffect = {
        hazardId: 'test-hazard',
        type: 'COSMIC_RADIATION',
        magnitude: 0.5,
        effects: {
          crewHealthDrain: 5,
          radiationLevel: 50
        },
        warnings: ['HIGH_RADIATION_EXPOSURE'],
        audioQueue: ['radiation_warning']
      };
      
      const results = hazardEffects.processHazardEffects(
        playerId, 
        [mockHazardEffect], 
        playerPosition, 
        1000 // 1 second
      );
      
      expect(results).toBeDefined();
      expect(results.healthEffects).toBeDefined();
      expect(results.warnings).toContain('HIGH_RADIATION_EXPOSURE');
      expect(results.audioQueue).toContain('radiation_warning');
    });

    test('should get sector hazards', () => {
      const hazards = hazardSystem.getSectorHazards(0, 0);
      expect(Array.isArray(hazards)).toBe(true);
    });

    test('should handle countermeasures', () => {
      const playerId = 'test-player';
      hazardEffects.initializePlayer(playerId);
      
      hazardEffects.addCountermeasure(playerId, 'radiation_shielding');
      
      const systemHealth = hazardEffects.getSystemHealth(playerId);
      expect(systemHealth).toBeDefined();
      expect(Object.keys(systemHealth)).toContain('life_support');
    });
  });

  describe('Emergency Scenarios', () => {
    test('should create distress call scenario', async () => {
      const eventData = {
        id: 'test-event',
        type: 'distress_call',
        centerSector: { x: 0, y: 0 },
        expiresAt: Date.now() + 300000
      };
      
      const scenario = await hazardGenerator.handleEmergencyScenario('distress_call', eventData);
      
      expect(scenario).toBeDefined();
      expect(scenario.missionType).toBe('rescue');
      expect(scenario.name).toBe('Distress Call');
      expect(scenario.rewards).toBeDefined();
      expect(scenario.metadata.survivors).toBeGreaterThan(0);
    });

    test('should create evacuation mission scenario', async () => {
      const eventData = {
        id: 'test-event-2',
        type: 'evacuation_mission',
        centerSector: { x: 1, y: 1 },
        expiresAt: Date.now() + 600000
      };
      
      const scenario = await hazardGenerator.handleEmergencyScenario('evacuation_mission', eventData);
      
      expect(scenario).toBeDefined();
      expect(scenario.missionType).toBe('evacuation');
      expect(scenario.name).toBe('Colony Evacuation');
      expect(scenario.metadata.civiliansToEvacuate).toBe(50);
    });

    test('should process rescue mission participation', async () => {
      const playerId = 'test-player';
      const eventData = {
        id: 'rescue-test',
        type: 'distress_call',
        centerSector: { x: 0, y: 0 },
        expiresAt: Date.now() + 300000
      };
      
      const scenario = await hazardGenerator.handleEmergencyScenario('distress_call', eventData);
      hazardGenerator.dynamicEvents.set(scenario.id, {
        ...eventData,
        missionType: 'rescue',
        metadata: scenario.metadata,
        participants: [],
        progress: 0,
        status: 'active'
      });
      
      const result = await hazardGenerator.processScenarioParticipation(
        scenario.id,
        playerId,
        'rescue_survivors',
        { capacity: 3 }
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Rescued');
      expect(result.rewards).toBeDefined();
      expect(result.rewards.experience).toBeGreaterThan(0);
    });

    test('should get active emergency scenarios', () => {
      const scenarios = hazardGenerator.getActiveEmergencyScenarios();
      expect(Array.isArray(scenarios)).toBe(true);
    });
  });

  describe('Dynamic Events Configuration', () => {
    test('should have all required emergency scenario types', () => {
      const emergencyTypes = ['distress_call', 'evacuation_mission', 'disaster_response', 'pirate_raid_response', 'medical_emergency'];
      
      for (const type of emergencyTypes) {
        expect(DYNAMIC_EVENTS[type]).toBeDefined();
        expect(DYNAMIC_EVENTS[type].missionType).toBeDefined();
        expect(DYNAMIC_EVENTS[type].rewards).toBeDefined();
      }
    });

    test('should have proper duration settings for emergency scenarios', () => {
      const distressCall = DYNAMIC_EVENTS.distress_call;
      expect(distressCall.duration.min).toBeGreaterThan(0);
      expect(distressCall.duration.max).toBeGreaterThan(distressCall.duration.min);
    });

    test('should have appropriate rewards for scenarios', () => {
      const evacuation = DYNAMIC_EVENTS.evacuation_mission;
      expect(evacuation.rewards.experience).toBeGreaterThan(0);
      expect(evacuation.rewards.resources).toBeGreaterThan(0);
      expect(evacuation.rewards.reputation).toBeGreaterThan(0);
    });
  });

  describe('Hazard Effects and System Health', () => {
    test('should track system health degradation', () => {
      const playerId = 'test-player';
      hazardEffects.initializePlayer(playerId);
      
      const systemHealth = hazardEffects.getSystemHealth(playerId);
      
      // All systems should start at 100% health
      Object.values(systemHealth).forEach(system => {
        expect(system.health).toBe(1.0);
        expect(system.status).toBe('OPTIMAL');
      });
    });

    test('should repair damaged systems', () => {
      const playerId = 'test-player';
      hazardEffects.initializePlayer(playerId);
      
      // Damage a system first
      const systemHealth = hazardEffects.systemHealth.get(playerId);
      systemHealth.shields = 0.3; // 30% health
      
      const result = hazardEffects.repairSystem(playerId, 'shields', 0.5);
      
      expect(result.success).toBe(true);
      expect(result.newHealth).toBe(0.8); // Should be 30% + 50% = 80%
    });

    test('should calculate hazard resistance', () => {
      const playerId = 'test-player';
      hazardEffects.initializePlayer(playerId);
      hazardEffects.addCountermeasure(playerId, 'radiation_shielding');
      
      const resistance = hazardEffects.calculateHazardResistance(playerId);
      
      expect(resistance).toBeDefined();
      expect(resistance.COSMIC_RADIATION).toBeGreaterThan(0);
    });

    test('should generate appropriate warnings', () => {
      const playerId = 'test-player';
      hazardEffects.initializePlayer(playerId);
      
      const mockHighIntensityEffect = {
        hazardId: 'test-hazard',
        type: 'GRAVITATIONAL_ANOMALY',
        magnitude: 0.9, // Very high intensity
        effects: {
          gravitationalPull: 0.8,
          structuralStress: 2.0
        },
        warnings: ['EVENT_HORIZON_PROXIMITY']
      };
      
      const results = hazardEffects.processHazardEffects(
        playerId, 
        [mockHighIntensityEffect], 
        { x: 0, y: 0 }, 
        1000
      );
      
      expect(results.warnings).toContain('EVENT_HORIZON_PROXIMITY');
    });
  });

  describe('Database Integration', () => {
    test('should save hazards to database', async () => {
      const hazardData = {
        id: 'test-hazard-db',
        sector_x: 5,
        sector_y: 5,
        hazard_type: 'SOLAR_FLARE',
        x: 200,
        y: 300,
        properties: { intensity: 0.7 },
        expires_at: null // No expiration for this test
      };
      
      await db.saveSectorHazard(hazardData);
      
      const savedHazards = await db.getSectorHazards(5, 5);
      expect(savedHazards.length).toBeGreaterThan(0);
      
      const savedHazard = savedHazards.find(h => h.id === 'test-hazard-db');
      expect(savedHazard).toBeDefined();
      expect(savedHazard.type).toBe('SOLAR_FLARE');
    });

    test('should track hazard exposure history', async () => {
      const exposureData = {
        id: 'exposure-test',
        player_id: 'test-player',
        hazard_id: 'test-hazard',
        hazard_type: 'COSMIC_RADIATION',
        sector_x: 0,
        sector_y: 0,
        exposure_start: Date.now(),
        total_exposure_time: 30000,
        max_intensity: 0.8,
        damage_taken: 15
      };
      
      await db.recordHazardExposure(exposureData);
      
      const history = await db.getPlayerHazardExposure('test-player');
      expect(history.length).toBeGreaterThan(0);
      
      const exposure = history.find(e => e.id === 'exposure-test');
      expect(exposure).toBeDefined();
      expect(exposure.hazard_type).toBe('COSMIC_RADIATION');
    });
  });

  describe('Performance and Statistics', () => {
    test('should provide hazard statistics', () => {
      const stats = hazardSystem.getHazardStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalHazards).toBeDefined();
      expect(stats.hazardCounts).toBeDefined();
      expect(stats.activeSectors).toBeDefined();
    });

    test('should provide effect statistics', () => {
      const stats = hazardEffects.getEffectStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.activePlayers).toBeDefined();
      expect(stats.totalWarnings).toBeDefined();
    });

    test('should handle multiple players efficiently', () => {
      const playerIds = ['player1', 'player2', 'player3', 'player4', 'player5'];
      
      // Initialize multiple players
      playerIds.forEach(id => {
        hazardEffects.initializePlayer(id);
      });
      
      const stats = hazardEffects.getEffectStatistics();
      expect(stats.activePlayers).toBe(5);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid hazard types gracefully', async () => {
      await expect(
        hazardSystem.spawnHazard(0, 0, 'INVALID_HAZARD', 0, 0)
      ).rejects.toThrow('Unknown hazard type');
    });

    test('should handle invalid countermeasures gracefully', () => {
      const playerId = 'test-player';
      hazardEffects.initializePlayer(playerId);
      
      // Adding invalid countermeasure should not crash
      hazardEffects.addCountermeasure(playerId, 'invalid_countermeasure');
      
      const resistance = hazardEffects.calculateHazardResistance(playerId);
      expect(resistance).toBeDefined();
    });

    test('should handle scenario participation for non-existent scenarios', async () => {
      const result = await hazardGenerator.processScenarioParticipation(
        'non-existent-scenario',
        'test-player',
        'some_action',
        {}
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    test('should handle system repair for invalid systems', () => {
      const playerId = 'test-player';
      hazardEffects.initializePlayer(playerId);
      
      const result = hazardEffects.repairSystem(playerId, 'invalid_system', 1.0);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});