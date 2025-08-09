/**
 * Comprehensive tests for the Guild System
 * Tests guild creation, management, roles, halls, and integrations
 */

const Database = require('../../database');
const GuildSystem = require('../../guilds/GuildSystem');
const Guild = require('../../guilds/Guild');
const GuildHall = require('../../guilds/GuildHall');
const SkillSystem = require('../../skills/SkillSystem');

describe('Guild System', () => {
  let db;
  let guildSystem;
  let skillSystem;
  let testPlayers;

  beforeAll(async () => {
    // Initialize test database
    db = new Database();
    await db.initialize();
    
    // Initialize skill system
    skillSystem = new SkillSystem(db);
    
    // Initialize guild system
    guildSystem = new GuildSystem(db, skillSystem);
    await guildSystem.initialize();

    // Create test players
    testPlayers = [];
    for (let i = 1; i <= 5; i++) {
      const player = await db.createPlayer(`TestPlayer${i}`, `test${i}@example.com`, 'password123');
      testPlayers.push(player);
    }
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('Guild Class', () => {
    test('should create a new guild with default values', () => {
      const guildData = {
        name: 'Test Guild',
        tag: 'TEST',
        founderId: testPlayers[0].id
      };

      const guild = new Guild(guildData);

      expect(guild.name).toBe('Test Guild');
      expect(guild.tag).toBe('TEST');
      expect(guild.founderId).toBe(testPlayers[0].id);
      expect(guild.config.maxMembers).toBe(50);
      expect(guild.config.recruitmentOpen).toBe(true);
      expect(guild.stats.totalMembers).toBe(0);
      expect(guild.stats.guildLevel).toBe(1);
    });

    test('should create default roles correctly', () => {
      const guild = new Guild({ name: 'Test', tag: 'TEST', founderId: 'test' });
      const defaultRoles = guild.createDefaultRoles();

      expect(defaultRoles).toHaveLength(6);
      expect(defaultRoles.find(r => r.id === 'founder')).toBeDefined();
      expect(defaultRoles.find(r => r.id === 'leader')).toBeDefined();
      expect(defaultRoles.find(r => r.id === 'member')).toBeDefined();
      expect(defaultRoles.find(r => r.isDefault)).toBeDefined();
    });

    test('should serialize and deserialize correctly', () => {
      const originalGuild = new Guild({
        name: 'Test Guild',
        tag: 'TEST',
        founderId: testPlayers[0].id,
        description: 'A test guild'
      });

      const serialized = originalGuild.serialize();
      expect(serialized.name).toBe('Test Guild');
      expect(serialized.tag).toBe('TEST');
      expect(JSON.parse(serialized.config).maxMembers).toBe(50);

      const deserializedGuild = Guild.fromDatabase(serialized);
      expect(deserializedGuild.name).toBe(originalGuild.name);
      expect(deserializedGuild.tag).toBe(originalGuild.tag);
      expect(deserializedGuild.config.maxMembers).toBe(originalGuild.config.maxMembers);
    });

    test('should calculate member bonuses correctly', () => {
      const guild = new Guild({ name: 'Test', tag: 'TEST', founderId: 'test' });
      guild.stats.guildLevel = 10;
      guild.activePerks = ['resource_bonus', 'experience_boost'];
      guild.territories = ['0,0', '0,1', '1,0'];

      const bonuses = guild.calculateMemberBonuses();

      expect(bonuses.experience_gain).toBeGreaterThan(0);
      expect(bonuses.resource_gain).toBeGreaterThan(0);
      expect(bonuses.resource_gain).toBe(0.06); // 2% per territory
    });
  });

  describe('Guild Creation and Management', () => {
    test('should create a guild successfully', async () => {
      const guild = await guildSystem.createGuild(
        testPlayers[0].id,
        'Alpha Squadron',
        'ALPHA',
        {
          description: 'Elite combat guild',
          guildType: 'COMBAT',
          maxMembers: 25
        }
      );

      expect(guild).toBeDefined();
      expect(guild.name).toBe('Alpha Squadron');
      expect(guild.tag).toBe('ALPHA');
      expect(guild.config.guildType).toBe('COMBAT');
      expect(guild.config.maxMembers).toBe(25);
      expect(guild.stats.totalMembers).toBe(1);
      expect(guild.founderId).toBe(testPlayers[0].id);
    });

    test('should prevent duplicate guild names/tags', async () => {
      await expect(guildSystem.createGuild(
        testPlayers[1].id,
        'Alpha Squadron',
        'BETA'
      )).rejects.toThrow('Guild name or tag already exists');

      await expect(guildSystem.createGuild(
        testPlayers[1].id,
        'Beta Squadron',
        'ALPHA'
      )).rejects.toThrow('Guild name or tag already exists');
    });

    test('should prevent player from creating multiple guilds', async () => {
      await expect(guildSystem.createGuild(
        testPlayers[0].id,
        'Gamma Squadron',
        'GAMMA'
      )).rejects.toThrow('Player is already a member of a guild');
    });

    test('should get player guild correctly', () => {
      const guild = guildSystem.getPlayerGuild(testPlayers[0].id);
      expect(guild).toBeDefined();
      expect(guild.name).toBe('Alpha Squadron');
    });

    test('should search guilds with criteria', async () => {
      // Create another guild for testing
      await guildSystem.createGuild(testPlayers[1].id, 'Beta Mining Corp', 'BETA', {
        guildType: 'TRADING',
        recruitmentOpen: true
      });

      const results = await guildSystem.searchGuilds({
        guildType: 'COMBAT'
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alpha Squadron');

      const allResults = await guildSystem.searchGuilds({});
      expect(allResults.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Guild Membership', () => {
    let alphaGuild, betaGuild;

    beforeEach(() => {
      alphaGuild = guildSystem.getPlayerGuild(testPlayers[0].id);
      betaGuild = guildSystem.getPlayerGuild(testPlayers[1].id);
    });

    test('should apply to guild successfully (auto-accept)', async () => {
      const result = await guildSystem.applyToGuild(testPlayers[2].id, alphaGuild.id);
      
      expect(result.status).toBe('accepted');
      expect(alphaGuild.stats.totalMembers).toBe(2);
      expect(guildSystem.getPlayerGuild(testPlayers[2].id)).toBe(alphaGuild);
    });

    test('should handle guild application process', async () => {
      // Set guild to require applications
      betaGuild.config.requiresApplication = true;
      await guildSystem.saveGuild(betaGuild);

      const result = await guildSystem.applyToGuild(testPlayers[3].id, betaGuild.id, 'I want to mine!');
      
      expect(result.status).toBe('pending');
      expect(guildSystem.getPlayerGuild(testPlayers[3].id)).toBeNull();

      // Process application (accept)
      const processResult = await guildSystem.processApplication(
        result.applicationId,
        'accepted',
        testPlayers[1].id
      );

      expect(processResult.status).toBe('accepted');
      expect(guildSystem.getPlayerGuild(testPlayers[3].id)).toBe(betaGuild);
    });

    test('should leave guild successfully', async () => {
      const result = await guildSystem.leaveGuild(testPlayers[2].id);
      
      expect(result.success).toBe(true);
      expect(result.formerGuild).toBe('Alpha Squadron');
      expect(guildSystem.getPlayerGuild(testPlayers[2].id)).toBeNull();
    });

    test('should prevent founder from leaving', async () => {
      await expect(guildSystem.leaveGuild(testPlayers[0].id))
        .rejects.toThrow('Guild founder cannot leave');
    });

    test('should kick member successfully', async () => {
      // Add member back
      await guildSystem.applyToGuild(testPlayers[2].id, alphaGuild.id);
      
      const result = await guildSystem.kickMember(
        testPlayers[0].id,
        testPlayers[2].id,
        'Inactivity'
      );

      expect(result.success).toBe(true);
      expect(guildSystem.getPlayerGuild(testPlayers[2].id)).toBeNull();
    });
  });

  describe('Guild Roles and Permissions', () => {
    let guild;

    beforeEach(async () => {
      guild = guildSystem.getPlayerGuild(testPlayers[0].id);
      // Add a member to test role changes
      await guildSystem.applyToGuild(testPlayers[4].id, guild.id);
    });

    test('should change member role successfully', async () => {
      const result = await guildSystem.changeMemberRole(
        testPlayers[0].id,
        testPlayers[4].id,
        'officer'
      );

      expect(result.success).toBe(true);
      expect(result.newRole).toBe('officer');

      const member = guild.members.get(testPlayers[4].id);
      expect(member.roleId).toBe('officer');
    });

    test('should enforce role hierarchy', async () => {
      // Try to promote to founder (should fail)
      await expect(guildSystem.changeMemberRole(
        testPlayers[4].id, // non-founder trying to change roles
        testPlayers[0].id, // targeting founder
        'member'
      )).rejects.toThrow();
    });

    test('should transfer leadership correctly', async () => {
      const result = await guildSystem.transferFoundership(
        guild.id,
        testPlayers[0].id,
        testPlayers[4].id
      );

      expect(result.success).toBe(true);
      expect(result.newFounder).toBe(testPlayers[4].id);
      expect(guild.founderId).toBe(testPlayers[4].id);

      const newFounder = guild.members.get(testPlayers[4].id);
      const oldFounder = guild.members.get(testPlayers[0].id);
      expect(newFounder.roleId).toBe('founder');
      expect(oldFounder.roleId).toBe('leader');
    });

    test('should check permissions correctly', () => {
      expect(guild.hasPermission(guild.founderId, 'guild.disband')).toBe(true);
      expect(guild.hasPermission(testPlayers[4].id, 'guild.disband')).toBe(false);
    });
  });

  describe('Guild Resources', () => {
    let guild;

    beforeEach(() => {
      guild = guildSystem.getPlayerGuild(testPlayers[4].id); // Current founder
    });

    test('should contribute resources successfully', async () => {
      const result = await guildSystem.contributeResources(
        testPlayers[4].id,
        'credits',
        1000
      );

      expect(result.success).toBe(true);
      expect(guild.resources.credits).toBe(1000);
    });

    test('should contribute ore resources', async () => {
      const oreAmount = { oreType: 'iron', quantity: 50 };
      const result = await guildSystem.contributeResources(
        testPlayers[4].id,
        'ores',
        oreAmount
      );

      expect(result.success).toBe(true);
      expect(guild.resources.ores.iron).toBe(50);
    });

    test('should award contribution points', async () => {
      const member = guild.members.get(testPlayers[4].id);
      const initialPoints = member.contributionPoints;

      await guildSystem.contributeResources(testPlayers[4].id, 'credits', 500);

      expect(member.contributionPoints).toBeGreaterThan(initialPoints);
    });
  });

  describe('Guild Halls', () => {
    test('should create guild hall with correct properties', () => {
      const hallData = {
        guildId: 'test-guild-id',
        name: 'Alpha Base',
        sectorX: 0,
        sectorY: 0,
        x: 100,
        y: 100
      };

      const hall = new GuildHall(hallData);

      expect(hall.name).toBe('Alpha Base');
      expect(hall.hallType).toBe('BASIC');
      expect(hall.level).toBe(1);
      expect(hall.isActive).toBe(true);
      expect(hall.facilities.hangar).toBeDefined();
      expect(hall.facilities.vault).toBeDefined();
    });

    test('should calculate hall bonuses correctly', () => {
      const hall = new GuildHall({
        guildId: 'test',
        name: 'Test Hall',
        sectorX: 0,
        sectorY: 0,
        x: 0,
        y: 0
      });

      hall.facilities.workshop = { level: 3, active: true, efficiency: 1.45 };
      hall.updateFacilityEffects('workshop');

      const bonuses = hall.calculateHallBonuses();
      expect(bonuses.crafting_efficiency).toBeCloseTo(0.45);
    });

    test('should upgrade facilities successfully', async () => {
      const hall = new GuildHall({
        guildId: 'test',
        name: 'Test Hall',
        sectorX: 0,
        sectorY: 0,
        x: 0,
        y: 0
      });

      const result = await hall.upgradeFacility('hangar');

      expect(result.success).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(hall.facilities.hangar.level).toBe(2);
      expect(hall.facilities.hangar.capacity).toBe(8); // 5 + (2 * 3)
    });

    test('should enforce facility limits based on hall type', async () => {
      const hall = new GuildHall({
        guildId: 'test',
        name: 'Test Hall',
        sectorX: 0,
        sectorY: 0,
        x: 0,
        y: 0,
        hallType: 'BASIC'
      });

      // Basic halls can only support 4 facilities, starting with 2 (hangar, vault)
      await hall.addFacility('workshop');
      await hall.addFacility('laboratory');

      // This should fail as we've reached the limit
      await expect(hall.addFacility('barracks'))
        .rejects.toThrow('can only support 4 facilities');
    });

    test('should handle resource storage', async () => {
      const hall = new GuildHall({
        guildId: 'test',
        name: 'Test Hall',
        sectorX: 0,
        sectorY: 0,
        x: 0,
        y: 0
      });

      await hall.storeResources('credits', 5000);
      expect(hall.storedResources.credits).toBe(5000);

      const oreAmount = { oreType: 'gold', quantity: 25 };
      await hall.storeResources('ore', oreAmount);
      expect(hall.storedResources.ores.gold).toBe(25);

      await hall.retrieveResources('credits', 2000);
      expect(hall.storedResources.credits).toBe(3000);
    });

    test('should enforce storage capacity', async () => {
      const hall = new GuildHall({
        guildId: 'test',
        name: 'Test Hall',
        sectorX: 0,
        sectorY: 0,
        x: 0,
        y: 0
      });

      // Vault capacity is 10000 at level 1
      // Credits are light (1/100th of storage), ores are heavy (1:1)
      const largeOreAmount = { oreType: 'iron', quantity: 10001 };

      await expect(hall.storeResources('ore', largeOreAmount))
        .rejects.toThrow('Insufficient storage capacity');
    });
  });

  describe('Guild Diplomacy', () => {
    let alphaGuild, betaGuild;

    beforeEach(() => {
      alphaGuild = guildSystem.getPlayerGuild(testPlayers[4].id);
      betaGuild = guildSystem.getPlayerGuild(testPlayers[1].id);
    });

    test('should set diplomatic relations', async () => {
      const result = await guildSystem.setGuildRelation(
        testPlayers[4].id,
        betaGuild.id,
        'ALLY'
      );

      expect(result.success).toBe(true);
      expect(result.relation).toBe('ALLY');
      expect(alphaGuild.getDiplomaticRelation(betaGuild.id)).toBe('ALLY');
      expect(betaGuild.getDiplomaticRelation(alphaGuild.id)).toBe('ALLY');
    });

    test('should change diplomatic relations', async () => {
      await guildSystem.setGuildRelation(testPlayers[4].id, betaGuild.id, 'ENEMY');
      
      expect(alphaGuild.getDiplomaticRelation(betaGuild.id)).toBe('ENEMY');
      expect(alphaGuild.allies).not.toContain(betaGuild.id);
      expect(alphaGuild.enemies).toContain(betaGuild.id);
    });
  });

  describe('Guild Experience and Leveling', () => {
    let guild;

    beforeEach(() => {
      guild = guildSystem.getPlayerGuild(testPlayers[4].id);
    });

    test('should award experience and level up', () => {
      const initialLevel = guild.stats.guildLevel;
      const requiredExp = guild.getRequiredExperienceForLevel(initialLevel + 1);

      const result = guild.awardExperience(requiredExp);

      expect(result.levelUp).toBe(true);
      expect(result.newLevel).toBe(initialLevel + 1);
      expect(guild.stats.guildLevel).toBe(initialLevel + 1);
    });

    test('should calculate required experience correctly', () => {
      const guild = new Guild({ name: 'Test', tag: 'TEST', founderId: 'test' });
      
      expect(guild.getRequiredExperienceForLevel(2)).toBe(4000); // 2^2 * 1000
      expect(guild.getRequiredExperienceForLevel(3)).toBe(9000); // 3^2 * 1000
      expect(guild.getRequiredExperienceForLevel(5)).toBe(25000); // 5^2 * 1000
    });
  });

  describe('Guild Perks', () => {
    let guild;

    beforeEach(() => {
      guild = guildSystem.getPlayerGuild(testPlayers[4].id);
      guild.resources.credits = 10000; // Ensure enough credits for perks
    });

    test('should get available perks based on level', () => {
      guild.stats.guildLevel = 10;
      const availablePerks = guild.getAvailablePerks();
      
      expect(availablePerks.length).toBeGreaterThan(0);
      const resourcePerk = availablePerks.find(p => p.id === 'resource_bonus');
      expect(resourcePerk).toBeDefined();
      expect(resourcePerk.requiredLevel).toBe(5);
    });

    test('should activate perk successfully', async () => {
      guild.stats.guildLevel = 10;
      
      const perk = await guild.activatePerk('resource_bonus');
      
      expect(perk.id).toBe('resource_bonus');
      expect(guild.activePerks).toContain('resource_bonus');
      expect(guild.unlockedPerks).toContain('resource_bonus');
      expect(guild.resources.credits).toBe(9000); // 10000 - 1000 cost
    });

    test('should prevent activating unavailable perks', async () => {
      guild.stats.guildLevel = 1; // Too low level
      
      await expect(guild.activatePerk('experience_boost'))
        .rejects.toThrow('Invalid or unavailable perk');
    });

    test('should prevent activating already active perks', async () => {
      guild.stats.guildLevel = 10;
      await guild.activatePerk('resource_bonus');
      
      await expect(guild.activatePerk('resource_bonus'))
        .rejects.toThrow('Perk already active');
    });
  });

  describe('Guild Integration with Skill System', () => {
    let guild;

    beforeEach(async () => {
      guild = guildSystem.getPlayerGuild(testPlayers[4].id);
      guild.activePerks = ['resource_bonus', 'experience_boost'];
      guild.stats.guildLevel = 15;
      await guildSystem.saveGuild(guild);
    });

    test('should provide guild bonuses through skill system', async () => {
      const bonuses = await guildSystem.getMemberBonuses(testPlayers[4].id);
      
      expect(bonuses).toBeDefined();
      expect(bonuses.experience_gain).toBeGreaterThan(0);
      expect(bonuses.resource_gain).toBeGreaterThan(0);
    });

    test('should calculate combined skill and guild effects', async () => {
      // Add some skill points and upgrade skills
      await skillSystem.addSkillPoints(testPlayers[4].id, 'trading', 100);
      await skillSystem.upgradeSkill(testPlayers[4].id, 'trading', 'market_analysis');
      
      const effects = await skillSystem.calculatePlayerSkillEffects(testPlayers[4].id, guildSystem);
      
      expect(effects).toBeDefined();
      expect(Object.keys(effects).length).toBeGreaterThan(0);
      // Should include both skill effects and guild bonuses
    });
  });

  describe('Guild Leaderboard', () => {
    test('should generate guild leaderboard', async () => {
      const leaderboard = await guildSystem.getGuildLeaderboard('level', 10);
      
      expect(Array.isArray(leaderboard)).toBe(true);
      expect(leaderboard.length).toBeGreaterThan(0);
      
      // Should be sorted by guild level descending
      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i].guildLevel).toBeLessThanOrEqual(leaderboard[i-1].guildLevel);
      }
      
      // Each entry should have rank
      expect(leaderboard[0].rank).toBe(1);
    });

    test('should support different leaderboard categories', async () => {
      const memberLeaderboard = await guildSystem.getGuildLeaderboard('members', 10);
      const resourceLeaderboard = await guildSystem.getGuildLeaderboard('resources', 10);
      
      expect(Array.isArray(memberLeaderboard)).toBe(true);
      expect(Array.isArray(resourceLeaderboard)).toBe(true);
    });
  });

  describe('Guild Statistics', () => {
    test('should provide comprehensive guild statistics', async () => {
      const stats = await guildSystem.getGuildStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalGuilds).toBeGreaterThanOrEqual(2);
      expect(stats.totalMembers).toBeGreaterThan(0);
      expect(stats.averageGuildSize).toBeGreaterThan(0);
      expect(Array.isArray(stats.guildsByType)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent guild operations gracefully', async () => {
      await expect(guildSystem.applyToGuild(testPlayers[2].id, 'non-existent-guild'))
        .rejects.toThrow('Guild not found');

      const nonExistentGuild = guildSystem.getGuild('non-existent');
      expect(nonExistentGuild).toBeNull();
    });

    test('should validate guild tag format', async () => {
      await expect(guildSystem.createGuild(testPlayers[2].id, 'Test Guild', 'X'))
        .rejects.toThrow('Guild tag must be between 2 and 5 characters');

      await expect(guildSystem.createGuild(testPlayers[2].id, 'Test Guild', 'TOOLONG'))
        .rejects.toThrow('Guild tag must be between 2 and 5 characters');
    });

    test('should validate guild name length', async () => {
      await expect(guildSystem.createGuild(testPlayers[2].id, 'AB', 'TEST'))
        .rejects.toThrow('Guild name must be between 3 and 50 characters');

      const longName = 'A'.repeat(51);
      await expect(guildSystem.createGuild(testPlayers[2].id, longName, 'TEST'))
        .rejects.toThrow('Guild name must be between 3 and 50 characters');
    });

    test('should handle guild capacity limits', async () => {
      const smallGuild = await guildSystem.createGuild(testPlayers[2].id, 'Small Guild', 'SMALL', {
        maxMembers: 1
      });

      // Should fail as guild is already at capacity (founder counts)
      await expect(guildSystem.applyToGuild(testPlayers[3].id, smallGuild.id))
        .rejects.toThrow('Guild is at maximum capacity');
    });
  });
});