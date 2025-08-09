/**
 * Test suite for the galaxy system
 */

const Database = require('../../database');
const SectorManager = require('../../galaxy/SectorManager');
const WarpSystem = require('../../galaxy/WarpSystem');
const { Sector, BIOME_TYPES, ORE_TYPES } = require('../../galaxy/Sector');
const ProceduralGeneration = require('../../galaxy/ProceduralGeneration');

describe('Galaxy System', () => {
  let db;
  let sectorManager;
  let warpSystem;

  beforeEach(async () => {
    db = new Database();
    await db.initialize();
    sectorManager = new SectorManager(db);
    warpSystem = new WarpSystem(db, sectorManager);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Sector', () => {
    test('should create sector with valid biome', () => {
      const sector = new Sector({ x: 0, y: 0 }, 12345);
      expect(sector.coordinates).toEqual({ x: 0, y: 0 });
      expect(sector.seed).toBe(12345);
      expect(Object.values(BIOME_TYPES)).toContainEqual(sector.biome);
    });

    test('should generate ores when loaded', async () => {
      const sector = new Sector({ x: 0, y: 0 }, 12345);
      await sector.load();
      
      expect(sector.isLoaded).toBe(true);
      expect(sector.ores.length).toBeGreaterThan(0);
      expect(sector.ores[0]).toHaveProperty('id');
      expect(sector.ores[0]).toHaveProperty('type');
      expect(sector.ores[0]).toHaveProperty('value');
    });

    test('should process supernova events', () => {
      const sector = new Sector({ x: 0, y: 0 }, 12345);
      const initialOreCount = sector.ores.length;
      
      sector.executeSupernovaEvent({ x: 0, y: 0 });
      
      expect(sector.ores.length).toBeGreaterThan(initialOreCount);
      expect(sector.ores.some(ore => ore.isSupernova)).toBe(true);
    });
  });

  describe('SectorManager', () => {
    test('should load and cache sectors', async () => {
      const sector1 = await sectorManager.getSector({ x: 0, y: 0 });
      const sector2 = await sectorManager.getSector({ x: 0, y: 0 });
      
      expect(sector1).toBe(sector2); // Should return same instance
      expect(sectorManager.loadedSectors.size).toBe(1);
    });

    test('should calculate sector coordinates correctly', () => {
      const coords1 = sectorManager.getSectorCoordinatesForPosition(500, 500);
      expect(coords1).toEqual({ x: 0, y: 0 });
      
      const coords2 = sectorManager.getSectorCoordinatesForPosition(1500, 1500);
      expect(coords2).toEqual({ x: 1, y: 1 });
      
      const coords3 = sectorManager.getSectorCoordinatesForPosition(-1500, -1500);
      expect(coords3).toEqual({ x: -1, y: -1 });
    });

    test('should manage player sector transitions', async () => {
      const playerId = 'test-player';
      const result = await sectorManager.movePlayerToSector(playerId, { x: 1, y: 1 });
      
      expect(result.sector).toBeDefined();
      expect(result.position).toBeDefined();
      expect(sectorManager.playerSectors.get(playerId)).toBe('1_1');
    });

    test('should generate galaxy map data', () => {
      const mapData = sectorManager.getGalaxyMapData({ x: 0, y: 0 }, 2);
      
      expect(mapData.length).toBe(25); // 5x5 grid
      expect(mapData[0]).toHaveProperty('coordinates');
      expect(mapData[0]).toHaveProperty('biome');
    });
  });

  describe('WarpSystem', () => {
    test('should calculate warp requirements', () => {
      const mockPlayer = {
        id: 'test-player',
        resources: 1000,
        modules: [{ id: 'engine' }]
      };
      
      const requirements = warpSystem.calculateWarpRequirements(
        { x: 0, y: 0 }, 
        { x: 2, y: 2 }, 
        mockPlayer
      );
      
      expect(requirements.valid).toBe(true);
      expect(requirements.fuelCost).toBeGreaterThan(0);
      expect(requirements.travelTime).toBeGreaterThan(0);
      expect(requirements.distance).toBeCloseTo(2.83, 1);
    });

    test('should prevent warp when insufficient fuel', () => {
      const mockPlayer = {
        id: 'test-player',
        resources: 10, // Very low resources
        modules: []
      };
      
      const requirements = warpSystem.calculateWarpRequirements(
        { x: 0, y: 0 }, 
        { x: 5, y: 5 }, 
        mockPlayer
      );
      
      expect(requirements.valid).toBe(true);
      expect(requirements.canAfford).toBe(false);
    });

    test('should calculate warp efficiency with engines', () => {
      const playerWithEngines = {
        modules: [
          { id: 'engine' }, 
          { id: 'engine' }, 
          { id: 'warp_drive' }
        ]
      };
      
      const efficiency = warpSystem.calculateWarpEfficiency(playerWithEngines);
      
      expect(efficiency.fuelMultiplier).toBeLessThan(1.0);
      expect(efficiency.timeMultiplier).toBeLessThan(1.0);
      expect(efficiency.engineCount).toBe(2);
    });
  });

  describe('ProceduralGeneration', () => {
    let procGen;

    beforeEach(() => {
      procGen = new ProceduralGeneration(12345);
    });

    test('should generate consistent seeds', () => {
      const seed1 = procGen.generateSectorSeed(0, 0);
      const seed2 = procGen.generateSectorSeed(0, 0);
      const seed3 = procGen.generateSectorSeed(1, 0);
      
      expect(seed1).toBe(seed2); // Same coordinates = same seed
      expect(seed1).not.toBe(seed3); // Different coordinates = different seed
    });

    test('should generate different biomes for different locations', () => {
      const biome1 = procGen.generateSectorBiome({ x: 0, y: 0 }, 12345);
      const biome2 = procGen.generateSectorBiome({ x: 10, y: 10 }, 12345);
      
      expect(biome1).toHaveProperty('name');
      expect(biome2).toHaveProperty('name');
      expect(Object.values(BIOME_TYPES)).toContainEqual(biome1);
      expect(Object.values(BIOME_TYPES)).toContainEqual(biome2);
    });

    test('should generate faction territories', () => {
      const territory1 = procGen.generateFactionTerritory({ x: 0, y: 0 });
      const territory2 = procGen.generateFactionTerritory({ x: 50, y: 50 });
      
      expect(territory1).toHaveProperty('faction');
      expect(territory1).toHaveProperty('influence');
      expect(territory2.faction).toBe('Neutral Space'); // Far from center
    });
  });

  describe('Database Integration', () => {
    test('should save and load sector data', async () => {
      const sector = new Sector({ x: 5, y: 5 }, 54321);
      await sector.load();
      
      // Save sector
      await db.saveSectorData({
        sector_x: 5,
        sector_y: 5,
        seed: 54321,
        biome_type: sector.biome.name,
        biome_data: JSON.stringify(sector.biome),
        last_updated: Date.now()
      });
      
      // Load sector data
      const loadedData = await db.getSectorData(5, 5);
      
      expect(loadedData).toBeDefined();
      expect(loadedData.sector_x).toBe(5);
      expect(loadedData.sector_y).toBe(5);
      expect(loadedData.seed).toBe(54321);
    });

    test('should track player sector locations', async () => {
      const playerId = 'test-player-location';
      
      await db.updatePlayerSectorLocation(playerId, 3, 4, true);
      const location = await db.getPlayerSectorLocation(playerId);
      
      expect(location.current_sector_x).toBe(3);
      expect(location.current_sector_y).toBe(4);
      expect(location.total_warps).toBe(1);
    });

    test('should record warp routes', async () => {
      const playerId = 'test-player-warp';
      
      await db.recordWarpRoute(playerId, 0, 0, 2, 3, 150, 25000);
      const warpHistory = await db.getPlayerWarpHistory(playerId, 1);
      
      expect(warpHistory.length).toBe(1);
      expect(warpHistory[0].fuel_cost).toBe(150);
      expect(warpHistory[0].travel_time).toBe(25000);
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain existing player creation flow', async () => {
      const player = await db.createPlayer('legacyuser', 'legacy@test.com', 'password');
      
      expect(player).toHaveProperty('id');
      expect(player.username).toBe('legacyuser');
      
      const playerData = await db.getPlayerData(player.id);
      expect(playerData.resources).toBe(100); // Starting resources
      // New players start with empty modules array initially
      expect(Array.isArray(playerData.modules)).toBe(true);
    });

    test('should work with existing authentication', async () => {
      await db.createPlayer('authtest', 'auth@test.com', 'password');
      const authResult = await db.authenticatePlayer('authtest', 'password');
      
      expect(authResult).toBeDefined();
      expect(authResult.username).toBe('authtest');
    });
  });
});