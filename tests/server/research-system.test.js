/**
 * Research System Tests
 * Comprehensive test suite for the Research & Technology System
 */

const ResearchSystem = require('../../research/ResearchSystem');
const ResearchStation = require('../../research/ResearchStation');
const Database = require('../../database');
const SkillSystem = require('../../skills/SkillSystem');
const GuildSystem = require('../../guilds/GuildSystem');

describe('Research System', () => {
  let database, skillSystem, guildSystem, researchSystem, researchStation;
  let testPlayerId, testGuildId;

  beforeAll(async () => {
    // Initialize test database
    database = new Database();
    await database.initialize();

    // Initialize skill system
    skillSystem = new SkillSystem(database);

    // Initialize guild system
    guildSystem = new GuildSystem(database, skillSystem, null);
    await guildSystem.initialize();

    // Initialize research system
    researchSystem = new ResearchSystem(database, skillSystem, guildSystem);
    await researchSystem.initialize();

    // Initialize research station system
    researchStation = new ResearchStation(database, null);

    // Create test player
    testPlayerId = 'test-player-research';
    await database.run(
      'INSERT INTO players (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
      [testPlayerId, 'testresearcher', 'test@research.com', 'hashedpassword']
    );

    // Initialize player stats and position
    await database.run(
      'INSERT INTO player_stats (player_id, resources) VALUES (?, ?)',
      [testPlayerId, 10000]
    );

    await database.run(
      'INSERT INTO player_positions (player_id, x, y) VALUES (?, ?, ?)',
      [testPlayerId, 0, 0]
    );

    // Create test guild
    testGuildId = 'test-guild-research';
    await database.run(
      `INSERT INTO guilds 
       (id, name, tag, founder_id, founded_at, config, resources, stats, territories, guild_halls, allies, enemies, neutral, active_perks, unlocked_perks, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testGuildId,
        'Research Guild',
        'RES',
        testPlayerId,
        Date.now(),
        '{"maxMembers": 50}',
        '{"credits": 50000, "materials": 1000}',
        '{"level": 5, "experience": 2500}',
        '[]',
        '[]',
        '[]',
        '[]',
        '[]',
        '["RESEARCH_ACCELERATION"]',
        '["RESEARCH_ACCELERATION"]',
        Date.now()
      ]
    );
  });

  afterAll(async () => {
    // Cleanup research system
    if (researchSystem) {
      researchSystem.shutdown();
    }

    // Close database
    if (database) {
      await database.close();
    }
  });

  describe('Research Points', () => {
    test('should initialize player research points', async () => {
      const points = await researchSystem.getPlayerResearchPoints(testPlayerId);
      expect(points).toBeDefined();
      expect(points.military_points).toBe(0);
      expect(points.engineering_points).toBe(0);
      expect(points.science_points).toBe(0);
      expect(points.commerce_points).toBe(0);
    });

    test('should award research points for activities', async () => {
      await researchSystem.awardResearchPoints(testPlayerId, {
        military: 10,
        engineering: 15,
        science: 20,
        commerce: 5
      }, 'TEST_SOURCE');

      const points = await researchSystem.getPlayerResearchPoints(testPlayerId);
      expect(points.military_points).toBe(10);
      expect(points.engineering_points).toBe(15);
      expect(points.science_points).toBe(20);
      expect(points.commerce_points).toBe(5);
      expect(points.total_points_earned).toBe(50);
    });

    test('should generate research points from activities', async () => {
      const initialPoints = await researchSystem.getPlayerResearchPoints(testPlayerId);
      
      await researchSystem.generateResearchPointsFromActivity(testPlayerId, 'MINING', {
        oreType: 'iron',
        value: 100
      });

      const updatedPoints = await researchSystem.getPlayerResearchPoints(testPlayerId);
      expect(updatedPoints.engineering_points).toBeGreaterThan(initialPoints.engineering_points);
      expect(updatedPoints.science_points).toBeGreaterThan(initialPoints.science_points);
    });
  });

  describe('Technology Trees', () => {
    test('should have defined technology trees', () => {
      expect(researchSystem.researchTrees).toBeDefined();
      expect(researchSystem.researchTrees.MILITARY).toBeDefined();
      expect(researchSystem.researchTrees.ENGINEERING).toBeDefined();
      expect(researchSystem.researchTrees.SCIENCE).toBeDefined();
      expect(researchSystem.researchTrees.COMMERCE).toBeDefined();
    });

    test('should have technologies with proper structure', () => {
      const militaryTech = researchSystem.getTechnology('BASIC_WEAPONS');
      expect(militaryTech).toBeDefined();
      expect(militaryTech.id).toBe('BASIC_WEAPONS');
      expect(militaryTech.name).toBeDefined();
      expect(militaryTech.description).toBeDefined();
      expect(militaryTech.tier).toBe(1);
      expect(militaryTech.tree).toBe('MILITARY');
      expect(militaryTech.researchCost).toBeGreaterThan(0);
      expect(militaryTech.researchTime).toBeGreaterThan(0);
      expect(Array.isArray(militaryTech.prerequisites)).toBe(true);
      expect(Array.isArray(militaryTech.unlocks)).toBe(true);
      expect(militaryTech.effects).toBeDefined();
      expect(Array.isArray(militaryTech.blueprints)).toBe(true);
    });

    test('should check prerequisites correctly', async () => {
      // No prerequisites for tier 1 tech
      const hasPrereqsBasic = await researchSystem.checkPrerequisites(testPlayerId, []);
      expect(hasPrereqsBasic).toBe(true);

      // Should fail for tier 2 tech without tier 1
      const hasPrereqsAdvanced = await researchSystem.checkPrerequisites(testPlayerId, ['BASIC_WEAPONS']);
      expect(hasPrereqsAdvanced).toBe(false);

      // Unlock tier 1 technology
      await researchSystem.unlockTechnology(testPlayerId, 'BASIC_WEAPONS');

      // Now should pass for tier 2 tech
      const hasPrereqsAfterUnlock = await researchSystem.checkPrerequisites(testPlayerId, ['BASIC_WEAPONS']);
      expect(hasPrereqsAfterUnlock).toBe(true);
    });
  });

  describe('Research Projects', () => {
    test('should start a research project', async () => {
      // Give player enough research points
      await researchSystem.awardResearchPoints(testPlayerId, { military: 200 }, 'TEST');

      const projectId = await researchSystem.startResearchProject(testPlayerId, 'ARMOR_TECH');
      expect(projectId).toBeDefined();
      expect(researchSystem.activeProjects.has(projectId)).toBe(true);

      const project = researchSystem.activeProjects.get(projectId);
      expect(project.player_id).toBe(testPlayerId);
      expect(project.technology_id).toBe('ARMOR_TECH');
      expect(project.status).toBe('ACTIVE');
    });

    test('should fail to start project without sufficient points', async () => {
      await expect(
        researchSystem.startResearchProject(testPlayerId, 'PARTICLE_WEAPONS')
      ).rejects.toThrow('Insufficient research points');
    });

    test('should fail to start project without prerequisites', async () => {
      await researchSystem.awardResearchPoints(testPlayerId, { military: 1000 }, 'TEST');
      
      await expect(
        researchSystem.startResearchProject(testPlayerId, 'PARTICLE_WEAPONS')
      ).rejects.toThrow('Prerequisites not met');
    });

    test('should complete research project', async () => {
      // Start a quick project for testing
      await researchSystem.awardResearchPoints(testPlayerId, { science: 200 }, 'TEST');
      const projectId = await researchSystem.startResearchProject(testPlayerId, 'RESEARCH_METHODS');
      
      // Complete the project
      await researchSystem.completeResearchProject(projectId);

      // Check that technology is unlocked
      const playerResearch = await database.get(
        'SELECT * FROM player_research WHERE player_id = ? AND technology_id = ?',
        [testPlayerId, 'RESEARCH_METHODS']
      );

      expect(playerResearch).toBeDefined();
      expect(playerResearch.is_unlocked).toBe(1);
    });

    test('should get player research progress', async () => {
      const progress = await researchSystem.getPlayerResearchProgress(testPlayerId);
      expect(progress).toBeDefined();
      expect(progress.unlockedTechnologies).toBeDefined();
      expect(progress.inProgressResearch).toBeDefined();
      expect(progress.activeProjects).toBeDefined();
      expect(progress.researchPoints).toBeDefined();

      // Should have unlocked technologies from previous tests
      expect(progress.unlockedTechnologies.length).toBeGreaterThan(0);
    });
  });

  describe('Research Laboratories', () => {
    test('should build a basic laboratory', async () => {
      const result = await researchStation.buildLaboratory(
        testPlayerId,
        0, 0, // sector coordinates
        100, 100, // position in sector
        'BASIC',
        'Test Lab'
      );

      expect(result).toBeDefined();
      expect(result.laboratorId).toBeDefined();
      expect(result.constructionTime).toBeGreaterThan(0);
    });

    test('should get player laboratories', async () => {
      const labs = await researchStation.getPlayerLaboratories(testPlayerId);
      expect(labs).toBeDefined();
      expect(Array.isArray(labs)).toBe(true);
      expect(labs.length).toBeGreaterThan(0);

      const lab = labs[0];
      expect(lab.player_id).toBe(testPlayerId);
      expect(lab.laboratory_type).toBe('BASIC');
      expect(lab.name).toBe('Test Lab');
    });

    test('should calculate laboratory bonus', async () => {
      const labs = await researchStation.getPlayerLaboratories(testPlayerId);
      const lab = labs[0];
      
      const bonus = researchStation.calculateLaboratoryBonus(lab, 'MILITARY');
      expect(bonus).toBeGreaterThan(0);
      expect(bonus).toBeGreaterThan(lab.research_bonus);
    });

    test('should upgrade laboratory', async () => {
      const labs = await researchStation.getPlayerLaboratories(testPlayerId);
      const labId = labs[0].id;

      // First unlock the required technology
      await researchSystem.unlockTechnology(testPlayerId, 'RESEARCH_METHODS');

      await researchStation.upgradeLaboratory(testPlayerId, labId, 'AUTOMATION');

      const updatedLab = await researchStation.getLaboratory(labId);
      expect(updatedLab.level).toBe(2);
      expect(updatedLab.research_bonus).toBeGreaterThan(labs[0].research_bonus);
    });

    test('should perform laboratory maintenance', async () => {
      const labs = await researchStation.getPlayerLaboratories(testPlayerId);
      const labId = labs[0].id;

      await researchStation.performMaintenance(testPlayerId, labId);

      const maintainedLab = await researchStation.getLaboratory(labId);
      expect(maintainedLab.last_maintenance).toBeGreaterThan(labs[0].last_maintenance);
    });
  });

  describe('Guild Research Collaboration', () => {
    test('should create guild research collaboration', async () => {
      // Add guild member
      await database.run(
        'INSERT INTO guild_members (player_id, guild_id, role_id, joined_at) VALUES (?, ?, ?, ?)',
        [testPlayerId, testGuildId, 'member', Date.now()]
      );

      const collaborationId = 'test-collaboration';
      await database.run(
        `INSERT INTO research_collaborations 
         (id, guild_id, technology_id, project_name, description, required_points, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          collaborationId,
          testGuildId,
          'WARP_TECHNOLOGY',
          'Advanced Warp Drive Project',
          'Collaborative research on warp drive technology',
          1000,
          testPlayerId
        ]
      );

      const collaboration = await database.get(
        'SELECT * FROM research_collaborations WHERE id = ?',
        [collaborationId]
      );

      expect(collaboration).toBeDefined();
      expect(collaboration.guild_id).toBe(testGuildId);
      expect(collaboration.technology_id).toBe('WARP_TECHNOLOGY');
      expect(collaboration.status).toBe('OPEN');
    });

    test('should start guild collaboration project', async () => {
      await researchSystem.awardResearchPoints(testPlayerId, { engineering: 1000 }, 'TEST');
      
      const projectId = await researchSystem.startResearchProject(
        testPlayerId,
        'PROPULSION_SYSTEMS',
        'GUILD_COLLABORATION',
        testGuildId
      );

      expect(projectId).toBeDefined();
      const project = researchSystem.activeProjects.get(projectId);
      expect(project.project_type).toBe('GUILD_COLLABORATION');
      expect(project.guild_id).toBe(testGuildId);
    });
  });

  describe('Research Discoveries', () => {
    test('should generate research discovery', async () => {
      const discovery = await researchStation.generateResearchDiscovery(5, -2);
      
      if (discovery) { // Discovery generation is random
        expect(discovery.id).toBeDefined();
        expect(discovery.discovery_type).toBeDefined();
        expect(['ALIEN_TECH', 'ANCIENT_RUIN', 'PROTOTYPE', 'BREAKTHROUGH'])
          .toContain(discovery.discovery_type);
        expect(discovery.research_value).toBeGreaterThan(0);
      }
    });

    test('should record research discovery', async () => {
      const discoveryData = {
        id: 'test-discovery',
        discovery_type: 'ALIEN_TECH',
        sector_x: 0,
        sector_y: 0,
        x: 200,
        y: 200,
        research_value: 150,
        discovery_time: Date.now(),
        discovery_data: { rarity: 'rare', complexity: 3 }
      };

      const discoveryId = await researchStation.recordDiscovery(testPlayerId, discoveryData);
      expect(discoveryId).toBe('test-discovery');

      const savedDiscovery = await database.get(
        'SELECT * FROM research_discoveries WHERE id = ?',
        [discoveryId]
      );

      expect(savedDiscovery).toBeDefined();
      expect(savedDiscovery.discovered_by).toBe(testPlayerId);
      expect(savedDiscovery.discovery_type).toBe('ALIEN_TECH');
    });
  });

  describe('Technology Blueprints', () => {
    test('should create blueprints when technology is unlocked', async () => {
      await researchSystem.unlockTechnology(testPlayerId, 'PROPULSION_SYSTEMS');

      const blueprints = await database.all(
        'SELECT * FROM technology_blueprints WHERE technology_id = ?',
        ['PROPULSION_SYSTEMS']
      );

      expect(blueprints.length).toBeGreaterThan(0);
      const blueprint = blueprints[0];
      expect(blueprint.blueprint_type).toBe('propulsion');
      expect(blueprint.name).toBe('Ion Engine MK-I');
      expect(JSON.parse(blueprint.stats)).toBeDefined();
    });
  });

  describe('System Statistics', () => {
    test('should get research system statistics', async () => {
      const stats = await researchSystem.getResearchSystemStats();
      expect(stats).toBeDefined();
      expect(stats.totalProjects).toBeGreaterThanOrEqual(0);
      expect(stats.activeProjects).toBeGreaterThanOrEqual(0);
      expect(stats.completedProjects).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.popularTechnologies)).toBe(true);
      expect(Array.isArray(stats.researchDistribution)).toBe(true);
    });

    test('should get laboratory statistics', async () => {
      const stats = await researchStation.getLaboratoryStats();
      expect(stats).toBeDefined();
      expect(stats.totalLaboratories).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.laboratoryDistribution)).toBe(true);
      expect(stats.totalDiscoveries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration with Other Systems', () => {
    test('should calculate research bonuses with skill system', async () => {
      // Award some skill points to test skill bonuses
      await skillSystem.awardSkillPoints(testPlayerId, 'combat_experience', 10);
      
      const technology = researchSystem.getTechnology('BASIC_WEAPONS');
      const bonuses = await researchSystem.calculateResearchBonuses(testPlayerId, technology);
      
      expect(bonuses).toBeDefined();
      if (bonuses.skillBonus !== undefined) {
        expect(bonuses.skillBonus).toBeGreaterThanOrEqual(0);
      }
    });

    test('should calculate research time with bonuses', async () => {
      const technology = researchSystem.getTechnology('BASIC_WEAPONS');
      const baseTime = technology.researchTime;
      
      const bonusTime = await researchSystem.calculateResearchTime(testPlayerId, technology, testGuildId);
      
      expect(bonusTime).toBeGreaterThan(0);
      // With bonuses, research time should be less than base time
      expect(bonusTime).toBeLessThanOrEqual(baseTime);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid technology ID', () => {
      const invalidTech = researchSystem.getTechnology('INVALID_TECH');
      expect(invalidTech).toBeNull();
    });

    test('should handle insufficient resources for laboratory construction', async () => {
      // Create a player with insufficient resources
      const poorPlayerId = 'poor-player';
      await database.run(
        'INSERT INTO players (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
        [poorPlayerId, 'poorplayer', 'poor@test.com', 'hashedpassword']
      );
      await database.run(
        'INSERT INTO player_stats (player_id, resources) VALUES (?, ?)',
        [poorPlayerId, 100] // Not enough for any laboratory
      );

      await expect(
        researchStation.buildLaboratory(poorPlayerId, 0, 0, 300, 300, 'BASIC', 'Poor Lab')
      ).rejects.toThrow('Insufficient resources');
    });

    test('should handle non-existent player for research operations', async () => {
      await expect(
        researchSystem.getPlayerResearchPoints('non-existent-player')
      ).resolves.toBeDefined(); // Should create default entry

      await expect(
        researchSystem.startResearchProject('non-existent-player', 'BASIC_WEAPONS')
      ).rejects.toThrow(); // Should fail for actual operations
    });
  });
});

describe('Research System Integration', () => {
  test('should integrate with existing game systems', () => {
    // Test that research system properly interfaces with other systems
    expect(ResearchSystem).toBeDefined();
    expect(ResearchStation).toBeDefined();
    
    // Verify key integration points exist
    const researchSystem = new ResearchSystem(null, null, null);
    expect(researchSystem.researchTrees).toBeDefined();
    expect(researchSystem.technologies).toBeDefined();
    expect(researchSystem.researchPointSources).toBeDefined();
    
    // Verify method existence for integration
    expect(typeof researchSystem.generateResearchPointsFromActivity).toBe('function');
    expect(typeof researchSystem.awardResearchPoints).toBe('function');
    expect(typeof researchSystem.startResearchProject).toBe('function');
  });
});