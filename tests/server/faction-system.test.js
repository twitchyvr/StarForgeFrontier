/**
 * Tests for the NPC faction system
 */

const Database = require('../../database');
const { FactionOrchestrator } = require('../../factions/FactionOrchestrator');
const { Faction, FACTION_TYPES } = require('../../factions/Faction');
const { NPCFleet, MISSION_TYPES } = require('../../factions/NPCFleet');

describe('Faction System', () => {
  let database;
  let factionOrchestrator;

  beforeEach(async () => {
    database = new Database();
    await database.initialize();
  });

  afterEach(async () => {
    if (factionOrchestrator) {
      await factionOrchestrator.shutdown();
    }
    if (database) {
      await database.close();
    }
  });

  describe('Faction Core', () => {
    test('should create faction with correct properties', () => {
      const faction = new Faction('test-military', 'Test Military', 'MILITARY');
      
      expect(faction.id).toBe('test-military');
      expect(faction.name).toBe('Test Military');
      expect(faction.type).toBe('MILITARY');
      expect(faction.typeConfig).toBe(FACTION_TYPES.MILITARY);
      expect(faction.resources.get('credits')).toBe(10000);
      expect(faction.territory.size).toBe(0);
      expect(faction.fleets.size).toBe(0);
    });

    test('should manage faction territory', () => {
      const faction = new Faction('test-faction', 'Test Faction', 'NEUTRAL');
      
      expect(faction.claimTerritory('0,0')).toBe(true);
      expect(faction.claimTerritory('1,0')).toBe(true);
      expect(faction.claimTerritory('0,0')).toBe(false); // Already claimed
      
      expect(faction.territory.has('0,0')).toBe(true);
      expect(faction.territory.has('1,0')).toBe(true);
      expect(faction.territory.size).toBe(2);
      
      expect(faction.loseTerritory('0,0')).toBe(true);
      expect(faction.loseTerritory('0,0')).toBe(false); // Already lost
      expect(faction.territory.size).toBe(1);
    });

    test('should manage player reputation', () => {
      const faction = new Faction('test-faction', 'Test Faction', 'TRADER');
      
      expect(faction.getPlayerReputation('player1')).toBe(0);
      
      faction.modifyPlayerReputation('player1', 25, 'helped with trade');
      expect(faction.getPlayerReputation('player1')).toBe(25);
      
      faction.modifyPlayerReputation('player1', -50, 'attacked convoy');
      expect(faction.getPlayerReputation('player1')).toBe(-25);
      
      // Test reputation bounds
      faction.modifyPlayerReputation('player1', -200);
      expect(faction.getPlayerReputation('player1')).toBe(-100);
      
      faction.modifyPlayerReputation('player1', 300);
      expect(faction.getPlayerReputation('player1')).toBe(100);
    });

    test('should get correct reputation levels', () => {
      const faction = new Faction('test-faction', 'Test Faction', 'NEUTRAL');
      
      faction.modifyPlayerReputation('player1', -80);
      let level = faction.getReputationLevel('player1');
      expect(level.level).toBe('HOSTILE');
      
      faction.modifyPlayerReputation('player1', 120); // Should be 40 total
      level = faction.getReputationLevel('player1');
      expect(level.level).toBe('FRIENDLY');
    });

    test('should manage resources', () => {
      const faction = new Faction('test-faction', 'Test Faction', 'MILITARY');
      
      expect(faction.getResource('credits')).toBe(10000);
      expect(faction.getResource('iron')).toBe(500);
      expect(faction.getResource('nonexistent')).toBe(0);
      
      faction.modifyResource('credits', 500);
      expect(faction.getResource('credits')).toBe(10500);
      
      faction.modifyResource('credits', -15000); // Should not go below 0
      expect(faction.getResource('credits')).toBe(0);
      
      expect(faction.hasResources({ credits: 100, iron: 50 })).toBe(false);
      expect(faction.hasResources({ iron: 100 })).toBe(true);
    });
  });

  describe('NPCFleet', () => {
    test('should create fleet with correct configuration', () => {
      const config = {
        factionId: 'test-faction',
        factionType: 'MILITARY',
        mission: { type: 'PATROL', parameters: { targetSectors: ['0,0', '1,0'] } },
        spawnSector: '0,0',
        shipCount: 3,
        equipmentLevel: 'medium'
      };
      
      const fleet = new NPCFleet('test-fleet', config);
      
      expect(fleet.id).toBe('test-fleet');
      expect(fleet.factionId).toBe('test-faction');
      expect(fleet.factionType).toBe('MILITARY');
      expect(fleet.ships.length).toBe(3);
      expect(fleet.mission.type).toBe('PATROL');
      expect(fleet.status).toBe('idle');
    });

    test('should generate ships with correct equipment level', () => {
      const config = {
        factionId: 'test-faction',
        factionType: 'MILITARY',
        mission: { type: 'PATROL', parameters: {} },
        spawnSector: '0,0',
        shipCount: 2,
        equipmentLevel: 'high'
      };
      
      const fleet = new NPCFleet('test-fleet', config);
      
      expect(fleet.ships.length).toBe(2);
      fleet.ships.forEach(ship => {
        expect(ship.health).toBeGreaterThan(150); // High level equipment
        expect(ship.damage).toBeGreaterThan(35);
        expect(ship.weapons.length).toBeGreaterThan(1);
        expect(ship.modules.length).toBeGreaterThan(0);
      });
    });

    test('should handle different mission types', () => {
      const missionTypes = ['PATROL', 'TRADE', 'EXPLORE', 'ATTACK', 'DEFEND'];
      
      missionTypes.forEach(missionType => {
        const config = {
          factionId: 'test-faction',
          factionType: 'MILITARY',
          mission: { type: missionType, parameters: {} },
          spawnSector: '0,0',
          shipCount: 1,
          equipmentLevel: 'basic'
        };
        
        const fleet = new NPCFleet('test-fleet-' + missionType.toLowerCase(), config);
        expect(fleet.mission.type).toBe(missionType);
        expect(MISSION_TYPES[missionType]).toBeDefined();
      });
    });
  });

  describe('FactionOrchestrator', () => {
    test('should initialize with default factions', async () => {
      factionOrchestrator = new FactionOrchestrator(database);
      await factionOrchestrator.initialize();
      
      expect(factionOrchestrator.factions.size).toBe(5); // DEFAULT_FACTIONS
      expect(factionOrchestrator.factions.has('military-coalition')).toBe(true);
      expect(factionOrchestrator.factions.has('trade-federation')).toBe(true);
      expect(factionOrchestrator.factions.has('crimson-raiders')).toBe(true);
    });

    test('should get player reputations', async () => {
      factionOrchestrator = new FactionOrchestrator(database);
      await factionOrchestrator.initialize();
      
      // Modify some reputations
      factionOrchestrator.modifyPlayerReputation('player1', 'military-coalition', 50, 'test');
      factionOrchestrator.modifyPlayerReputation('player1', 'trade-federation', -30, 'test');
      
      const reputations = factionOrchestrator.getPlayerReputations('player1');
      
      expect(reputations['military-coalition'].reputation).toBe(50);
      expect(reputations['trade-federation'].reputation).toBe(-30);
    });

    test('should get factions in sector', async () => {
      factionOrchestrator = new FactionOrchestrator(database);
      await factionOrchestrator.initialize();
      
      const factionsInSector = factionOrchestrator.getFactionsInSector('2,2');
      expect(factionsInSector.length).toBeGreaterThan(0);
      
      // Military Coalition should control sector 2,2 (their home base)
      const militaryPresence = factionsInSector.find(f => f.name === 'Terran Military Coalition');
      expect(militaryPresence).toBeDefined();
    });

    test('should manage system statistics', async () => {
      factionOrchestrator = new FactionOrchestrator(database);
      await factionOrchestrator.initialize();
      
      const stats = factionOrchestrator.getSystemStats();
      
      expect(stats.factions).toBeDefined();
      expect(stats.totalFleets).toBe(0); // No fleets created yet
      expect(stats.performance).toBeDefined();
      expect(Object.keys(stats.factions)).toHaveLength(5);
    });

    test('should handle faction events', async () => {
      factionOrchestrator = new FactionOrchestrator(database);
      await factionOrchestrator.initialize();
      
      const eventId = factionOrchestrator.triggerEvent({
        type: 'PLAYER_REPUTATION_CHANGE',
        playerId: 'player1',
        factionId: 'military-coalition',
        change: 25,
        reason: 'test event'
      });
      
      expect(eventId).toBeDefined();
      expect(factionOrchestrator.events.has(eventId)).toBe(true);
    });
  });

  describe('Database Integration', () => {
    test('should save and load faction data', async () => {
      const faction = new Faction('test-save', 'Test Save Faction', 'TRADER');
      faction.claimTerritory('5,5');
      faction.modifyResource('credits', 5000);
      
      const data = faction.serialize();
      await database.saveFaction(data);
      
      const loaded = await database.getFaction('test-save');
      expect(loaded).toBeDefined();
      expect(loaded.name).toBe('Test Save Faction');
      expect(loaded.type).toBe('TRADER');
    });

    test('should manage player reputation in database', async () => {
      await database.updatePlayerReputation('player1', 'faction1', 75);
      
      const reputation = await database.getPlayerReputation('player1', 'faction1');
      expect(reputation).toBe(75);
      
      const allReputations = await database.getPlayerReputations('player1');
      expect(allReputations.length).toBeGreaterThan(0);
    });

    test('should manage faction territory in database', async () => {
      await database.setFactionTerritory('faction1', 3, 3, 1.0);
      await database.setFactionTerritory('faction1', 4, 3, 0.8);
      
      const territories = await database.getFactionTerritories('faction1');
      expect(territories.length).toBe(2);
      expect(territories[0].control_level).toBe(1.0); // Should be sorted by control level
    });

    test('should get faction statistics from database', async () => {
      // Add some test data
      const faction = new Faction('stats-test', 'Stats Test', 'MILITARY');
      await database.saveFaction(faction.serialize());
      
      await database.setFactionTerritory('stats-test', 0, 0, 1.0);
      await database.updatePlayerReputation('player1', 'stats-test', 50);
      
      const stats = await database.getFactionStats();
      expect(stats.totalFactions).toBeGreaterThan(0);
      expect(stats.totalTerritories).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scaling', () => {
    test('should handle multiple factions efficiently', async () => {
      factionOrchestrator = new FactionOrchestrator(database);
      await factionOrchestrator.initialize();
      
      const startTime = Date.now();
      
      // Simulate multiple updates
      for (let i = 0; i < 10; i++) {
        await factionOrchestrator.update();
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Updates should complete reasonably quickly
      expect(totalTime).toBeLessThan(5000); // 5 seconds max for 10 updates
    });

    test('should maintain performance with many reputation changes', async () => {
      factionOrchestrator = new FactionOrchestrator(database);
      await factionOrchestrator.initialize();
      
      const startTime = Date.now();
      
      // Simulate many reputation changes
      for (let i = 0; i < 100; i++) {
        const playerId = `player${i % 10}`; // 10 different players
        const factionId = 'military-coalition';
        factionOrchestrator.modifyPlayerReputation(playerId, factionId, 1, 'performance test');
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});