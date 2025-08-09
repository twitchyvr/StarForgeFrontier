const Database = require('../../database');

describe('Database Tests', () => {
  let db;

  beforeAll(async () => {
    db = new Database();
    await db.initialize();
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('Player Management', () => {
    test('should create a new player', async () => {
      const player = await db.createPlayer('testuser', 'test@example.com', 'password123');
      
      expect(player).toBeDefined();
      expect(player.id).toBeDefined();
      expect(player.username).toBe('testuser');
      expect(player.email).toBe('test@example.com');
    });

    test('should not allow duplicate usernames', async () => {
      await expect(db.createPlayer('testuser', 'test2@example.com', 'password123'))
        .rejects.toThrow();
    });

    test('should not allow duplicate emails', async () => {
      await expect(db.createPlayer('testuser2', 'test@example.com', 'password123'))
        .rejects.toThrow();
    });

    test('should authenticate valid player', async () => {
      const player = await db.authenticatePlayer('testuser', 'password123');
      
      expect(player).toBeDefined();
      expect(player.username).toBe('testuser');
      expect(player.id).toBeDefined();
    });

    test('should reject invalid password', async () => {
      const player = await db.authenticatePlayer('testuser', 'wrongpassword');
      expect(player).toBeNull();
    });

    test('should reject non-existent user', async () => {
      const player = await db.authenticatePlayer('nonexistent', 'password123');
      expect(player).toBeNull();
    });

    test('should retrieve complete player data', async () => {
      // First authenticate to get player ID
      const authPlayer = await db.authenticatePlayer('testuser', 'password123');
      
      const playerData = await db.getPlayerData(authPlayer.id);
      
      expect(playerData).toBeDefined();
      expect(playerData.id).toBe(authPlayer.id);
      expect(playerData.username).toBe('testuser');
      expect(playerData.resources).toBe(100); // Default starting resources
      expect(playerData.level).toBe(1);
      expect(playerData.x).toBeDefined();
      expect(playerData.y).toBeDefined();
      expect(playerData.modules).toEqual([]);
      expect(playerData.stats).toBeDefined();
      expect(playerData.stats.totalResourcesCollected).toBe(0);
    });
  });

  describe('Player Stats Management', () => {
    let playerId;

    beforeAll(async () => {
      const player = await db.createPlayer('statsuser', 'stats@example.com', 'password123');
      playerId = player.id;
    });

    test('should update player stats', async () => {
      await db.updatePlayerStats(playerId, {
        resources: 250,
        level: 3,
        experience: 450
      });

      const playerData = await db.getPlayerData(playerId);
      expect(playerData.resources).toBe(250);
      expect(playerData.level).toBe(3);
      expect(playerData.experience).toBe(450);
    });

    test('should update player position', async () => {
      await db.updatePlayerPosition(playerId, 123.45, -67.89);

      const playerData = await db.getPlayerData(playerId);
      expect(playerData.x).toBe(123.45);
      expect(playerData.y).toBe(-67.89);
    });

    test('should handle partial stat updates', async () => {
      await db.updatePlayerStats(playerId, { resources: 300 });

      const playerData = await db.getPlayerData(playerId);
      expect(playerData.resources).toBe(300);
      expect(playerData.level).toBe(3); // Should remain unchanged
    });
  });

  describe('Ship Modules Management', () => {
    let playerId;

    beforeAll(async () => {
      const player = await db.createPlayer('moduleuser', 'modules@example.com', 'password123');
      playerId = player.id;
    });

    test('should add ship modules', async () => {
      await db.addShipModule(playerId, 'engine', 'module', 22, 0);
      await db.addShipModule(playerId, 'cargo', 'module', 44, 0);

      const playerData = await db.getPlayerData(playerId);
      expect(playerData.modules).toHaveLength(2);
      expect(playerData.modules[0].id).toBe('engine');
      expect(playerData.modules[0].type).toBe('module');
      expect(playerData.modules[0].x).toBe(22);
      expect(playerData.modules[1].id).toBe('cargo');
      expect(playerData.stats.totalModulesBuilt).toBe(2);
    });

    test('should increment module count when adding modules', async () => {
      const beforeData = await db.getPlayerData(playerId);
      const beforeCount = beforeData.stats.totalModulesBuilt;

      await db.addShipModule(playerId, 'weapon', 'module', 66, 0);

      const afterData = await db.getPlayerData(playerId);
      expect(afterData.stats.totalModulesBuilt).toBe(beforeCount + 1);
    });
  });

  describe('Game Sessions', () => {
    let playerId;

    beforeAll(async () => {
      const player = await db.createPlayer('sessionuser', 'session@example.com', 'password123');
      playerId = player.id;
    });

    test('should start and end game sessions', async () => {
      const sessionId = await db.startGameSession(playerId);
      expect(sessionId).toBeDefined();

      await db.endGameSession(sessionId, {
        duration: 1800, // 30 minutes
        resourcesGained: 150,
        modulesBuilt: 2,
        distanceTraveled: 500.5
      });

      // Verify session was created (we'd need to add a getGameSession method to fully test)
      const sessions = await db.all(
        'SELECT * FROM game_sessions WHERE id = ?',
        [sessionId]
      );
      expect(sessions).toHaveLength(1);
      expect(sessions[0].player_id).toBe(playerId);
      expect(sessions[0].duration).toBe(1800);
      expect(sessions[0].resources_gained).toBe(150);
    });
  });

  describe('Achievements System', () => {
    let playerId;

    beforeAll(async () => {
      const player = await db.createPlayer('achievementuser', 'achievement@example.com', 'password123');
      playerId = player.id;
    });

    test('should award new achievements', async () => {
      const awarded = await db.awardAchievement(
        playerId,
        'movement',
        'First Steps',
        'Move your ship for the first time'
      );

      expect(awarded).toBe(true);

      // Verify achievement was saved
      const achievements = await db.all(
        'SELECT * FROM achievements WHERE player_id = ?',
        [playerId]
      );
      expect(achievements).toHaveLength(1);
      expect(achievements[0].achievement_name).toBe('First Steps');
    });

    test('should not award duplicate achievements', async () => {
      const awarded = await db.awardAchievement(
        playerId,
        'movement',
        'First Steps',
        'Move your ship for the first time'
      );

      expect(awarded).toBe(false);

      // Verify still only one achievement
      const achievements = await db.all(
        'SELECT * FROM achievements WHERE player_id = ?',
        [playerId]
      );
      expect(achievements).toHaveLength(1);
    });

    test('should award different achievements', async () => {
      const awarded = await db.awardAchievement(
        playerId,
        'resources',
        'Collector',
        'Collect 100 resources'
      );

      expect(awarded).toBe(true);

      const achievements = await db.all(
        'SELECT * FROM achievements WHERE player_id = ?',
        [playerId]
      );
      expect(achievements).toHaveLength(2);
    });
  });

  describe('Leaderboards', () => {
    let player1Id, player2Id;

    beforeAll(async () => {
      const player1 = await db.createPlayer('leader1', 'leader1@example.com', 'password123');
      const player2 = await db.createPlayer('leader2', 'leader2@example.com', 'password123');
      player1Id = player1.id;
      player2Id = player2.id;
    });

    test('should update leaderboard scores', async () => {
      const updated1 = await db.updateLeaderboard(player1Id, 'resources', 500);
      const updated2 = await db.updateLeaderboard(player2Id, 'resources', 300);

      expect(updated1).toBe(true);
      expect(updated2).toBe(true);
    });

    test('should not update with lower scores', async () => {
      const updated = await db.updateLeaderboard(player1Id, 'resources', 400);
      expect(updated).toBe(false);
    });

    test('should retrieve leaderboard rankings', async () => {
      const leaderboard = await db.getLeaderboard('resources', 10);

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].username).toBe('leader1'); // Higher score should be first
      expect(leaderboard[0].score).toBe(500);
      expect(leaderboard[1].username).toBe('leader2');
      expect(leaderboard[1].score).toBe(300);
    });

    test('should update existing leaderboard entries', async () => {
      const updated = await db.updateLeaderboard(player2Id, 'resources', 600);
      expect(updated).toBe(true);

      const leaderboard = await db.getLeaderboard('resources', 10);
      expect(leaderboard[0].username).toBe('leader2'); // Now player2 should be first
      expect(leaderboard[0].score).toBe(600);
    });

    test('should limit leaderboard results', async () => {
      await db.updateLeaderboard(player1Id, 'level', 5);
      await db.updateLeaderboard(player2Id, 'level', 3);

      const leaderboard = await db.getLeaderboard('level', 1);
      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].score).toBe(5);
    });
  });

  describe('Database Integrity', () => {
    test('should maintain referential integrity', async () => {
      const player = await db.createPlayer('integrityuser', 'integrity@example.com', 'password123');
      
      // Add module and verify stats are updated
      await db.addShipModule(player.id, 'test-module', 'module', 0, 0);
      
      const playerData = await db.getPlayerData(player.id);
      expect(playerData.stats.totalModulesBuilt).toBe(1);
      expect(playerData.modules).toHaveLength(1);
    });

    test('should handle concurrent access', async () => {
      const player = await db.createPlayer('concurrentuser', 'concurrent@example.com', 'password123');
      
      // Simulate concurrent updates
      const updates = Array.from({ length: 10 }, (_, i) => 
        db.updatePlayerStats(player.id, { resources: 100 + i * 10 })
      );
      
      await Promise.all(updates);
      
      const playerData = await db.getPlayerData(player.id);
      expect(playerData.resources).toBeGreaterThanOrEqual(100);
      expect(playerData.resources).toBeLessThanOrEqual(190);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid player IDs gracefully', async () => {
      const playerData = await db.getPlayerData('invalid-id');
      expect(playerData).toBeNull();
    });

    test('should handle database constraints', async () => {
      // Try to create player with invalid data
      await expect(db.run(
        'INSERT INTO players (id, username) VALUES (?, ?)',
        ['test-id', null] // username cannot be null
      )).rejects.toThrow();
    });

    test('should handle non-existent foreign keys', async () => {
      await expect(db.updatePlayerStats('non-existent-id', { resources: 100 }))
        .resolves.not.toThrow(); // Should not throw, just not update anything
    });
  });
});