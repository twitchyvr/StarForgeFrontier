/**
 * Test suite for the Skill System
 * Tests skill progression, skill points, and effects calculation
 */

const Database = require('../../database');
const SkillSystem = require('../../skills/SkillSystem');

describe('Skill System', () => {
  let db;
  let skillSystem;
  let testPlayerCounter = 0;

  const createTestPlayer = async () => {
    testPlayerCounter++;
    const username = `testuser${testPlayerCounter}`;
    const email = `test${testPlayerCounter}@example.com`;
    
    await db.createPlayer(username, email, 'password123');
    const player = await db.get('SELECT id FROM players WHERE username = ?', [username]);
    return player.id;
  };

  beforeAll(async () => {
    db = new Database();
    await db.initialize();
    skillSystem = new SkillSystem(db);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('Skill Trees', () => {
    test('should have all required skill trees', () => {
      const skillTrees = skillSystem.getAllSkillTrees();
      
      expect(skillTrees).toHaveProperty('combat');
      expect(skillTrees).toHaveProperty('engineering');
      expect(skillTrees).toHaveProperty('trading');
      expect(skillTrees).toHaveProperty('exploration');
      expect(skillTrees).toHaveProperty('leadership');
    });

    test('should have valid skill tree structure', () => {
      const combatTree = skillSystem.getSkillTreeInfo('combat');
      
      expect(combatTree).toHaveProperty('name');
      expect(combatTree).toHaveProperty('description');
      expect(combatTree).toHaveProperty('skills');
      expect(typeof combatTree.skills).toBe('object');
    });

    test('should have skills with valid structure', () => {
      const combatTree = skillSystem.getSkillTreeInfo('combat');
      const weaponSystems = combatTree.skills.weapon_systems;
      
      expect(weaponSystems).toHaveProperty('name');
      expect(weaponSystems).toHaveProperty('description');
      expect(weaponSystems).toHaveProperty('maxLevel');
      expect(weaponSystems).toHaveProperty('effects');
      expect(weaponSystems).toHaveProperty('prerequisites');
      
      expect(typeof weaponSystems.maxLevel).toBe('number');
      expect(Array.isArray(weaponSystems.prerequisites)).toBe(true);
    });
  });

  describe('Skill Points', () => {
    test('should calculate skill point costs correctly', () => {
      const level1Cost = skillSystem.getSkillPointsForLevel(1);
      const level5Cost = skillSystem.getSkillPointsForLevel(5);
      const level10Cost = skillSystem.getSkillPointsForLevel(10);
      
      expect(level1Cost).toBeGreaterThan(0);
      expect(level5Cost).toBeGreaterThan(level1Cost);
      expect(level10Cost).toBeGreaterThan(level5Cost);
    });

    test('should calculate total skill points to level correctly', () => {
      const totalToLevel5 = skillSystem.getTotalSkillPointsToLevel(5);
      const totalToLevel10 = skillSystem.getTotalSkillPointsToLevel(10);
      
      expect(totalToLevel5).toBeGreaterThan(0);
      expect(totalToLevel10).toBeGreaterThan(totalToLevel5);
    });

    test('should award skill points for activities', async () => {
      const testPlayerId = await createTestPlayer();
      await skillSystem.awardSkillPoints(testPlayerId, 'ore_collected', 5);
      
      const playerSkills = await skillSystem.getPlayerSkills(testPlayerId);
      expect(playerSkills.skillPoints.exploration).toBeGreaterThan(0);
      expect(playerSkills.skillPoints.trading).toBeGreaterThan(0);
    });

    test('should add skill points to specific trees', async () => {
      const testPlayerId = await createTestPlayer();
      await skillSystem.addSkillPoints(testPlayerId, 'combat', 10);
      
      const playerSkills = await skillSystem.getPlayerSkills(testPlayerId);
      expect(playerSkills.skillPoints.combat).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Skill Upgrades', () => {
    test('should upgrade skills successfully', async () => {
      const testPlayerId = await createTestPlayer();
      await skillSystem.addSkillPoints(testPlayerId, 'combat', 100);
      
      const result = await skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems');
      
      expect(result.success).toBe(true);
      expect(result.newLevel).toBe(1);
      expect(result.pointsSpent).toBeGreaterThan(0);
    });

    test('should track skill levels correctly', async () => {
      const testPlayerId = await createTestPlayer();
      await skillSystem.addSkillPoints(testPlayerId, 'combat', 100);
      
      await skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems');
      await skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems');
      
      const playerSkills = await skillSystem.getPlayerSkills(testPlayerId);
      expect(playerSkills.skills.combat.weapon_systems.level).toBe(2);
    });

    test('should fail when insufficient skill points', async () => {
      const testPlayerId = await createTestPlayer();
      
      await expect(skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems'))
        .rejects.toThrow('Insufficient skill points');
    });

    test('should fail when skill is at max level', async () => {
      const testPlayerId = await createTestPlayer();
      // Upgrade skill to max level
      const combatTree = skillSystem.getSkillTreeInfo('combat');
      const maxLevel = combatTree.skills.weapon_systems.maxLevel;
      
      // Add lots of skill points
      await skillSystem.addSkillPoints(testPlayerId, 'combat', 10000);
      
      // Upgrade to max level
      for (let i = 0; i < maxLevel; i++) {
        await skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems');
      }
      
      // Try to upgrade beyond max
      await expect(skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems'))
        .rejects.toThrow('Skill already at maximum level');
    });

    test('should respect prerequisites', async () => {
      const testPlayerId = await createTestPlayer();
      await skillSystem.addSkillPoints(testPlayerId, 'combat', 1000);
      
      // Try to upgrade tactical_systems without meeting prerequisites
      await expect(skillSystem.upgradeSkill(testPlayerId, 'combat', 'tactical_systems'))
        .rejects.toThrow('Prerequisites not met');
    });
  });

  describe('Skill Effects', () => {
    test('should calculate skill effects correctly', async () => {
      const testPlayerId = await createTestPlayer();
      // Add skill points and upgrade some skills
      await skillSystem.addSkillPoints(testPlayerId, 'combat', 1000);
      await skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems');
      await skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems');
      
      const effects = await skillSystem.calculatePlayerSkillEffects(testPlayerId);
      
      expect(effects).toHaveProperty('weapon_damage_bonus');
      expect(effects.weapon_damage_bonus.value).toBeGreaterThan(0);
    });

    test('should handle multiple effects correctly', async () => {
      const testPlayerId = await createTestPlayer();
      await skillSystem.addSkillPoints(testPlayerId, 'engineering', 1000);
      await skillSystem.upgradeSkill(testPlayerId, 'engineering', 'power_systems');
      await skillSystem.upgradeSkill(testPlayerId, 'engineering', 'propulsion_systems');
      
      const effects = await skillSystem.calculatePlayerSkillEffects(testPlayerId);
      
      expect(effects).toHaveProperty('power_generation_bonus');
      expect(effects).toHaveProperty('engine_efficiency');
    });
  });

  describe('Skill Progress Tracking', () => {
    test('should track skill tree progress', async () => {
      const testPlayerId = await createTestPlayer();
      const progress = await skillSystem.getSkillTreeProgress(testPlayerId, 'combat');
      
      expect(progress).toHaveProperty('tree');
      expect(progress).toHaveProperty('availablePoints');
      expect(progress).toHaveProperty('skills');
      expect(typeof progress.availablePoints).toBe('number');
    });

    test('should record skill history', async () => {
      const testPlayerId = await createTestPlayer();
      await skillSystem.addSkillPoints(testPlayerId, 'combat', 100);
      await skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems');
      
      const history = await skillSystem.getSkillHistory(testPlayerId, 10);
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('event_type');
      expect(history[0]).toHaveProperty('skill_tree');
      expect(history[0]).toHaveProperty('skill_name');
    });
  });

  describe('Skill Reset', () => {
    test('should reset skills with proper confirmation', async () => {
      const testPlayerId = await createTestPlayer();
      // Add skills first
      await skillSystem.addSkillPoints(testPlayerId, 'combat', 100);
      await skillSystem.upgradeSkill(testPlayerId, 'combat', 'weapon_systems');
      
      const result = await skillSystem.resetPlayerSkills(testPlayerId, 'RESET_SKILLS_CONFIRMED');
      
      expect(result.success).toBe(true);
      expect(result.refundedPoints).toHaveProperty('combat');
      expect(result.refundedPoints.combat).toBeGreaterThan(0);
    });

    test('should fail reset without proper confirmation', async () => {
      const testPlayerId = await createTestPlayer();
      await expect(skillSystem.resetPlayerSkills(testPlayerId, 'invalid'))
        .rejects.toThrow('Invalid confirmation code');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complex skill progression scenario', async () => {
      const testPlayerId = await createTestPlayer();
      // Award points from various activities
      await skillSystem.awardSkillPoints(testPlayerId, 'ore_collected', 10);
      await skillSystem.awardSkillPoints(testPlayerId, 'component_installed', 5);
      await skillSystem.awardSkillPoints(testPlayerId, 'sector_discovered', 3);
      
      const playerSkills = await skillSystem.getPlayerSkills(testPlayerId);
      
      // Should have points in exploration and trading from ore collection
      expect(playerSkills.skillPoints.exploration).toBeGreaterThan(0);
      expect(playerSkills.skillPoints.trading).toBeGreaterThan(0);
      
      // Should have points in engineering from component installation
      expect(playerSkills.skillPoints.engineering).toBeGreaterThan(0);
    });

    test('should validate skill tree data integrity', () => {
      const allTrees = skillSystem.getAllSkillTrees();
      
      Object.entries(allTrees).forEach(([treeName, treeData]) => {
        expect(treeData).toHaveProperty('name');
        expect(treeData).toHaveProperty('description');
        expect(treeData).toHaveProperty('skills');
        
        Object.entries(treeData.skills).forEach(([skillName, skillData]) => {
          expect(skillData).toHaveProperty('name');
          expect(skillData).toHaveProperty('description');
          expect(skillData).toHaveProperty('maxLevel');
          expect(skillData).toHaveProperty('effects');
          expect(skillData).toHaveProperty('prerequisites');
          
          expect(typeof skillData.maxLevel).toBe('number');
          expect(skillData.maxLevel).toBeGreaterThan(0);
          expect(Array.isArray(skillData.prerequisites)).toBe(true);
        });
      });
    });
  });
});