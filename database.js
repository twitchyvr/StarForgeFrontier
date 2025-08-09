/**
 * Database module for StarForgeFrontier
 * Handles persistent storage of player data, ships, and game state
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the database connection and create tables
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      let dbPath;
      if (process.env.NODE_ENV === 'test') {
        dbPath = ':memory:';
      } else if (process.env.DATABASE_PATH) {
        // Use custom database path (for Render.com persistent disk)
        const fs = require('fs');
        const path = require('path');
        const dir = path.dirname(process.env.DATABASE_PATH);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        dbPath = process.env.DATABASE_PATH;
      } else {
        dbPath = 'starforge.db';
      }
      
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`Connected to SQLite database: ${dbPath}`);
        this.createTables()
          .then(() => {
            this.initialized = true;
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /**
   * Create database tables
   */
  async createTables() {
    const tables = [
      // Players table
      `CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_play_time INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1
      )`,
      
      // Player stats table
      `CREATE TABLE IF NOT EXISTS player_stats (
        player_id TEXT PRIMARY KEY,
        resources INTEGER DEFAULT 100,
        level INTEGER DEFAULT 1,
        experience INTEGER DEFAULT 0,
        total_resources_collected INTEGER DEFAULT 0,
        total_modules_built INTEGER DEFAULT 0,
        total_distance_traveled REAL DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        kills INTEGER DEFAULT 0,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,
      
      // Player positions table
      `CREATE TABLE IF NOT EXISTS player_positions (
        player_id TEXT PRIMARY KEY,
        x REAL DEFAULT 0,
        y REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,
      
      // Ship modules table
      `CREATE TABLE IF NOT EXISTS ship_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT,
        module_id TEXT,
        module_type TEXT,
        position_x INTEGER,
        position_y INTEGER,
        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,
      
      // Game sessions table
      `CREATE TABLE IF NOT EXISTS game_sessions (
        id TEXT PRIMARY KEY,
        player_id TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        duration INTEGER,
        resources_gained INTEGER DEFAULT 0,
        modules_built INTEGER DEFAULT 0,
        distance_traveled REAL DEFAULT 0,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,
      
      // Achievements table
      `CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT,
        achievement_type TEXT,
        achievement_name TEXT,
        description TEXT,
        earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,
      
      // Leaderboards table
      `CREATE TABLE IF NOT EXISTS leaderboards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT,
        category TEXT, -- 'resources', 'level', 'modules', 'distance'
        score INTEGER,
        achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Galaxy sectors table
      `CREATE TABLE IF NOT EXISTS galaxy_sectors (
        sector_x INTEGER,
        sector_y INTEGER,
        seed INTEGER NOT NULL,
        biome_type TEXT NOT NULL,
        biome_data TEXT, -- JSON data for biome configuration
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        player_count INTEGER DEFAULT 0,
        is_discovered BOOLEAN DEFAULT 0,
        PRIMARY KEY (sector_x, sector_y)
      )`,

      // Sector ores table
      `CREATE TABLE IF NOT EXISTS sector_ores (
        id TEXT PRIMARY KEY,
        sector_x INTEGER,
        sector_y INTEGER,
        ore_type TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        value INTEGER NOT NULL,
        spawned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_collected BOOLEAN DEFAULT 0,
        collected_by TEXT,
        collected_at DATETIME,
        FOREIGN KEY (sector_x, sector_y) REFERENCES galaxy_sectors (sector_x, sector_y),
        FOREIGN KEY (collected_by) REFERENCES players (id)
      )`,

      // Sector environmental hazards table
      `CREATE TABLE IF NOT EXISTS sector_hazards (
        id TEXT PRIMARY KEY,
        sector_x INTEGER,
        sector_y INTEGER,
        hazard_type TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        properties TEXT, -- JSON data for hazard-specific properties
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (sector_x, sector_y) REFERENCES galaxy_sectors (sector_x, sector_y)
      )`,

      // Player sector locations and warp history
      `CREATE TABLE IF NOT EXISTS player_sector_locations (
        player_id TEXT PRIMARY KEY,
        current_sector_x INTEGER DEFAULT 0,
        current_sector_y INTEGER DEFAULT 0,
        last_warp_at DATETIME,
        total_warps INTEGER DEFAULT 0,
        total_fuel_consumed INTEGER DEFAULT 0,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (current_sector_x, current_sector_y) REFERENCES galaxy_sectors (sector_x, sector_y)
      )`,

      // Warp routes and travel history
      `CREATE TABLE IF NOT EXISTS warp_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT,
        from_sector_x INTEGER,
        from_sector_y INTEGER,
        to_sector_x INTEGER,
        to_sector_y INTEGER,
        fuel_cost INTEGER,
        travel_time INTEGER,
        warped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Sector discoveries and exploration
      `CREATE TABLE IF NOT EXISTS sector_discoveries (
        player_id TEXT,
        sector_x INTEGER,
        sector_y INTEGER,
        discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        exploration_percentage REAL DEFAULT 0,
        PRIMARY KEY (player_id, sector_x, sector_y),
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (sector_x, sector_y) REFERENCES galaxy_sectors (sector_x, sector_y)
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }
    
    console.log('Database tables created successfully');
  }

  /**
   * Helper method to run SQL commands
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Helper method to get a single row
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Helper method to get multiple rows
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Create a new player account
   */
  async createPlayer(username, email, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const playerId = require('uuid').v4();
    
    // Begin transaction
    await this.run('BEGIN TRANSACTION');
    
    try {
      // Insert player
      await this.run(
        'INSERT INTO players (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
        [playerId, username, email, passwordHash]
      );
      
      // Insert default stats
      await this.run(
        'INSERT INTO player_stats (player_id) VALUES (?)',
        [playerId]
      );
      
      // Insert default position
      await this.run(
        'INSERT INTO player_positions (player_id, x, y) VALUES (?, ?, ?)',
        [playerId, Math.random() * 800 - 400, Math.random() * 800 - 400]
      );
      
      // Insert default sector location (start in sector 0,0)
      await this.run(
        'INSERT INTO player_sector_locations (player_id, current_sector_x, current_sector_y) VALUES (?, ?, ?)',
        [playerId, 0, 0]
      );
      
      await this.run('COMMIT');
      return { id: playerId, username, email };
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Authenticate a player
   */
  async authenticatePlayer(username, password) {
    const player = await this.get(
      'SELECT * FROM players WHERE username = ? AND is_active = 1',
      [username]
    );
    
    if (!player) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, player.password_hash);
    if (!isValid) {
      return null;
    }
    
    // Update last login
    await this.run(
      'UPDATE players SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [player.id]
    );
    
    return { id: player.id, username: player.username, email: player.email };
  }

  /**
   * Get player data including stats and position
   */
  async getPlayerData(playerId) {
    const player = await this.get(
      `SELECT p.*, ps.*, pp.x, pp.y 
       FROM players p 
       JOIN player_stats ps ON p.id = ps.player_id 
       JOIN player_positions pp ON p.id = pp.player_id 
       WHERE p.id = ?`,
      [playerId]
    );
    
    if (!player) {
      return null;
    }
    
    // Get ship modules
    const modules = await this.all(
      'SELECT * FROM ship_modules WHERE player_id = ? ORDER BY installed_at',
      [playerId]
    );
    
    return {
      id: player.id,
      username: player.username,
      resources: player.resources,
      level: player.level,
      experience: player.experience,
      x: player.x,
      y: player.y,
      modules: modules.map(m => ({
        id: m.module_id,
        type: m.module_type,
        x: m.position_x,
        y: m.position_y
      })),
      stats: {
        totalResourcesCollected: player.total_resources_collected,
        totalModulesBuilt: player.total_modules_built,
        totalDistanceTraveled: player.total_distance_traveled,
        deaths: player.deaths,
        kills: player.kills
      }
    };
  }

  /**
   * Update player stats
   */
  async updatePlayerStats(playerId, stats) {
    const updates = [];
    const values = [];
    
    if (stats.resources !== undefined) {
      updates.push('resources = ?');
      values.push(stats.resources);
    }
    if (stats.level !== undefined) {
      updates.push('level = ?');
      values.push(stats.level);
    }
    if (stats.experience !== undefined) {
      updates.push('experience = ?');
      values.push(stats.experience);
    }
    
    if (updates.length > 0) {
      values.push(playerId);
      await this.run(
        `UPDATE player_stats SET ${updates.join(', ')} WHERE player_id = ?`,
        values
      );
    }
  }

  /**
   * Update player position
   */
  async updatePlayerPosition(playerId, x, y) {
    await this.run(
      'UPDATE player_positions SET x = ?, y = ?, last_updated = CURRENT_TIMESTAMP WHERE player_id = ?',
      [x, y, playerId]
    );
  }

  /**
   * Add a ship module
   */
  async addShipModule(playerId, moduleId, moduleType, x, y) {
    const result = await this.run(
      'INSERT INTO ship_modules (player_id, module_id, module_type, position_x, position_y) VALUES (?, ?, ?, ?, ?)',
      [playerId, moduleId, moduleType, x, y]
    );
    
    // Update total modules built stat
    await this.run(
      'UPDATE player_stats SET total_modules_built = total_modules_built + 1 WHERE player_id = ?',
      [playerId]
    );
    
    return result;
  }

  /**
   * Start a game session
   */
  async startGameSession(playerId) {
    const sessionId = require('uuid').v4();
    await this.run(
      'INSERT INTO game_sessions (id, player_id) VALUES (?, ?)',
      [sessionId, playerId]
    );
    return sessionId;
  }

  /**
   * End a game session
   */
  async endGameSession(sessionId, stats = {}) {
    const updates = ['ended_at = CURRENT_TIMESTAMP'];
    const values = [];
    
    if (stats.duration !== undefined) {
      updates.push('duration = ?');
      values.push(stats.duration);
    }
    if (stats.resourcesGained !== undefined) {
      updates.push('resources_gained = ?');
      values.push(stats.resourcesGained);
    }
    if (stats.modulesBuilt !== undefined) {
      updates.push('modules_built = ?');
      values.push(stats.modulesBuilt);
    }
    if (stats.distanceTraveled !== undefined) {
      updates.push('distance_traveled = ?');
      values.push(stats.distanceTraveled);
    }
    
    values.push(sessionId);
    await this.run(
      `UPDATE game_sessions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Award an achievement
   */
  async awardAchievement(playerId, type, name, description) {
    // Check if already earned
    const existing = await this.get(
      'SELECT id FROM achievements WHERE player_id = ? AND achievement_type = ? AND achievement_name = ?',
      [playerId, type, name]
    );
    
    if (existing) {
      return false; // Already earned
    }
    
    await this.run(
      'INSERT INTO achievements (player_id, achievement_type, achievement_name, description) VALUES (?, ?, ?, ?)',
      [playerId, type, name, description]
    );
    
    return true; // Newly earned
  }

  /**
   * Update leaderboard
   */
  async updateLeaderboard(playerId, category, score) {
    // Check for existing entry
    const existing = await this.get(
      'SELECT score FROM leaderboards WHERE player_id = ? AND category = ?',
      [playerId, category]
    );
    
    if (existing && existing.score >= score) {
      return false; // No improvement
    }
    
    if (existing) {
      await this.run(
        'UPDATE leaderboards SET score = ?, achieved_at = CURRENT_TIMESTAMP WHERE player_id = ? AND category = ?',
        [score, playerId, category]
      );
    } else {
      await this.run(
        'INSERT INTO leaderboards (player_id, category, score) VALUES (?, ?, ?)',
        [playerId, category, score]
      );
    }
    
    return true;
  }

  /**
   * Get leaderboard rankings
   */
  async getLeaderboard(category, limit = 10) {
    return await this.all(
      `SELECT l.score, p.username, l.achieved_at 
       FROM leaderboards l 
       JOIN players p ON l.player_id = p.id 
       WHERE l.category = ? 
       ORDER BY l.score DESC 
       LIMIT ?`,
      [category, limit]
    );
  }

  /**
   * Save sector data to database
   */
  async saveSectorData(sectorData) {
    await this.run(
      `INSERT OR REPLACE INTO galaxy_sectors 
       (sector_x, sector_y, seed, biome_type, biome_data, last_updated, player_count, is_discovered) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sectorData.sector_x,
        sectorData.sector_y, 
        sectorData.seed,
        sectorData.biome_type,
        sectorData.biome_data,
        sectorData.last_updated,
        sectorData.player_count || 0,
        sectorData.is_discovered || 0
      ]
    );
  }

  /**
   * Get sector data from database
   */
  async getSectorData(sectorX, sectorY) {
    return await this.get(
      'SELECT * FROM galaxy_sectors WHERE sector_x = ? AND sector_y = ?',
      [sectorX, sectorY]
    );
  }

  /**
   * Save ore to sector
   */
  async saveSectorOre(oreData) {
    await this.run(
      `INSERT OR REPLACE INTO sector_ores 
       (id, sector_x, sector_y, ore_type, x, y, value, spawned_at, is_collected) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        oreData.id,
        oreData.sector_x,
        oreData.sector_y,
        oreData.ore_type,
        oreData.x,
        oreData.y,
        oreData.value,
        oreData.spawned_at,
        oreData.is_collected || 0
      ]
    );
  }

  /**
   * Get ores for a sector
   */
  async getSectorOres(sectorX, sectorY) {
    return await this.all(
      'SELECT * FROM sector_ores WHERE sector_x = ? AND sector_y = ? AND is_collected = 0',
      [sectorX, sectorY]
    );
  }

  /**
   * Mark ore as collected
   */
  async collectSectorOre(oreId, playerId) {
    await this.run(
      'UPDATE sector_ores SET is_collected = 1, collected_by = ?, collected_at = CURRENT_TIMESTAMP WHERE id = ?',
      [playerId, oreId]
    );
  }

  /**
   * Get environmental hazards for a sector
   */
  async getSectorHazards(sectorX, sectorY) {
    const hazards = await this.all(
      'SELECT * FROM sector_hazards WHERE sector_x = ? AND sector_y = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
      [sectorX, sectorY]
    );
    
    return hazards.map(hazard => ({
      id: hazard.id,
      type: hazard.hazard_type,
      x: hazard.x,
      y: hazard.y,
      properties: hazard.properties ? JSON.parse(hazard.properties) : {},
      createdAt: hazard.created_at,
      expiresAt: hazard.expires_at
    }));
  }

  /**
   * Save environmental hazard
   */
  async saveSectorHazard(hazardData) {
    await this.run(
      `INSERT INTO sector_hazards 
       (id, sector_x, sector_y, hazard_type, x, y, properties, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hazardData.id,
        hazardData.sector_x,
        hazardData.sector_y,
        hazardData.hazard_type,
        hazardData.x,
        hazardData.y,
        JSON.stringify(hazardData.properties || {}),
        hazardData.expires_at
      ]
    );
  }

  /**
   * Update player sector location
   */
  async updatePlayerSectorLocation(playerId, sectorX, sectorY, isWarp = false) {
    // Update or insert player sector location
    const existing = await this.get(
      'SELECT player_id FROM player_sector_locations WHERE player_id = ?',
      [playerId]
    );
    
    if (existing) {
      const updates = ['current_sector_x = ?', 'current_sector_y = ?'];
      const values = [sectorX, sectorY];
      
      if (isWarp) {
        updates.push('last_warp_at = CURRENT_TIMESTAMP');
        updates.push('total_warps = total_warps + 1');
      }
      
      values.push(playerId);
      
      await this.run(
        `UPDATE player_sector_locations SET ${updates.join(', ')} WHERE player_id = ?`,
        values
      );
    } else {
      await this.run(
        `INSERT INTO player_sector_locations 
         (player_id, current_sector_x, current_sector_y, total_warps) 
         VALUES (?, ?, ?, ?)`,
        [playerId, sectorX, sectorY, isWarp ? 1 : 0]
      );
    }
  }

  /**
   * Get player's current sector location
   */
  async getPlayerSectorLocation(playerId) {
    return await this.get(
      'SELECT * FROM player_sector_locations WHERE player_id = ?',
      [playerId]
    );
  }

  /**
   * Record a warp route
   */
  async recordWarpRoute(playerId, fromX, fromY, toX, toY, fuelCost, travelTime) {
    await this.run(
      `INSERT INTO warp_routes 
       (player_id, from_sector_x, from_sector_y, to_sector_x, to_sector_y, fuel_cost, travel_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [playerId, fromX, fromY, toX, toY, fuelCost, travelTime]
    );
    
    // Update fuel consumption total
    await this.run(
      'UPDATE player_sector_locations SET total_fuel_consumed = total_fuel_consumed + ? WHERE player_id = ?',
      [fuelCost, playerId]
    );
  }

  /**
   * Record sector discovery
   */
  async recordSectorDiscovery(playerId, sectorX, sectorY, explorationPercentage = 0) {
    await this.run(
      `INSERT OR REPLACE INTO sector_discoveries 
       (player_id, sector_x, sector_y, exploration_percentage) 
       VALUES (?, ?, ?, ?)`,
      [playerId, sectorX, sectorY, explorationPercentage]
    );
    
    // Mark sector as discovered
    await this.run(
      'UPDATE galaxy_sectors SET is_discovered = 1 WHERE sector_x = ? AND sector_y = ?',
      [sectorX, sectorY]
    );
  }

  /**
   * Get player's discovered sectors
   */
  async getPlayerDiscoveries(playerId) {
    return await this.all(
      `SELECT sd.*, gs.biome_type, gs.biome_data 
       FROM sector_discoveries sd 
       JOIN galaxy_sectors gs ON sd.sector_x = gs.sector_x AND sd.sector_y = gs.sector_y 
       WHERE sd.player_id = ? 
       ORDER BY sd.discovered_at DESC`,
      [playerId]
    );
  }

  /**
   * Get warp history for a player
   */
  async getPlayerWarpHistory(playerId, limit = 20) {
    return await this.all(
      'SELECT * FROM warp_routes WHERE player_id = ? ORDER BY warped_at DESC LIMIT ?',
      [playerId, limit]
    );
  }

  /**
   * Update sector player count
   */
  async updateSectorPlayerCount(sectorX, sectorY, playerCount) {
    await this.run(
      'UPDATE galaxy_sectors SET player_count = ?, last_updated = CURRENT_TIMESTAMP WHERE sector_x = ? AND sector_y = ?',
      [playerCount, sectorX, sectorY]
    );
  }

  /**
   * Get galaxy statistics
   */
  async getGalaxyStats() {
    const sectorCount = await this.get('SELECT COUNT(*) as count FROM galaxy_sectors');
    const discoveredCount = await this.get('SELECT COUNT(*) as count FROM galaxy_sectors WHERE is_discovered = 1');
    const totalOres = await this.get('SELECT COUNT(*) as count FROM sector_ores WHERE is_collected = 0');
    const totalWarps = await this.get('SELECT COUNT(*) as count FROM warp_routes');
    
    const biomeDistribution = await this.all(
      'SELECT biome_type, COUNT(*) as count FROM galaxy_sectors GROUP BY biome_type ORDER BY count DESC'
    );
    
    return {
      totalSectors: sectorCount.count,
      discoveredSectors: discoveredCount.count,
      explorationPercentage: (discoveredCount.count / Math.max(1, sectorCount.count)) * 100,
      totalOres: totalOres.count,
      totalWarps: totalWarps.count,
      biomeDistribution
    };
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          }
          console.log('Database connection closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;