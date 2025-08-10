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
      )`,

      // Trading stations
      `CREATE TABLE IF NOT EXISTS trading_stations (
        id TEXT PRIMARY KEY,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        station_name TEXT NOT NULL,
        station_type TEXT NOT NULL,
        biome_type TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        reputation_modifier REAL DEFAULT 1.0,
        last_restocked DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sector_x, sector_y) REFERENCES galaxy_sectors (sector_x, sector_y)
      )`,

      // Trading station inventory
      `CREATE TABLE IF NOT EXISTS station_inventory (
        station_id TEXT,
        ore_type TEXT,
        quantity INTEGER DEFAULT 0,
        base_buy_price INTEGER NOT NULL,
        base_sell_price INTEGER NOT NULL,
        current_buy_price INTEGER NOT NULL,
        current_sell_price INTEGER NOT NULL,
        last_price_update DATETIME DEFAULT CURRENT_TIMESTAMP,
        supply_level REAL DEFAULT 0.5,
        demand_level REAL DEFAULT 0.5,
        PRIMARY KEY (station_id, ore_type),
        FOREIGN KEY (station_id) REFERENCES trading_stations (id)
      )`,

      // Market price history
      `CREATE TABLE IF NOT EXISTS market_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_id TEXT,
        ore_type TEXT,
        buy_price INTEGER,
        sell_price INTEGER,
        volume_traded INTEGER DEFAULT 0,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (station_id) REFERENCES trading_stations (id)
      )`,

      // Trade orders (buy/sell orders from players)
      `CREATE TABLE IF NOT EXISTS trade_orders (
        id TEXT PRIMARY KEY,
        player_id TEXT,
        station_id TEXT,
        order_type TEXT NOT NULL, -- 'buy' or 'sell'
        ore_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price_per_unit INTEGER NOT NULL,
        total_value INTEGER NOT NULL,
        status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'expired'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (station_id) REFERENCES trading_stations (id)
      )`,

      // Trade history
      `CREATE TABLE IF NOT EXISTS trade_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        buyer_id TEXT,
        seller_id TEXT,
        station_id TEXT,
        ore_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price_per_unit INTEGER NOT NULL,
        total_value INTEGER NOT NULL,
        trade_type TEXT NOT NULL, -- 'player_to_station', 'station_to_player', 'player_to_player'
        traded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_id) REFERENCES players (id),
        FOREIGN KEY (seller_id) REFERENCES players (id),
        FOREIGN KEY (station_id) REFERENCES trading_stations (id)
      )`,

      // Delivery contracts
      `CREATE TABLE IF NOT EXISTS delivery_contracts (
        id TEXT PRIMARY KEY,
        player_id TEXT,
        contract_giver TEXT NOT NULL, -- station or NPC name
        origin_station_id TEXT,
        destination_station_id TEXT,
        cargo_type TEXT NOT NULL,
        cargo_quantity INTEGER NOT NULL,
        base_reward INTEGER NOT NULL,
        bonus_reward INTEGER DEFAULT 0,
        distance INTEGER NOT NULL,
        risk_level INTEGER DEFAULT 1, -- 1-5 difficulty
        deadline DATETIME NOT NULL,
        status TEXT DEFAULT 'available', -- 'available', 'accepted', 'in_progress', 'completed', 'failed', 'expired'
        accepted_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (origin_station_id) REFERENCES trading_stations (id),
        FOREIGN KEY (destination_station_id) REFERENCES trading_stations (id)
      )`,

      // Contract cargo tracking
      `CREATE TABLE IF NOT EXISTS contract_cargo (
        contract_id TEXT,
        ore_type TEXT,
        quantity_required INTEGER NOT NULL,
        quantity_delivered INTEGER DEFAULT 0,
        PRIMARY KEY (contract_id, ore_type),
        FOREIGN KEY (contract_id) REFERENCES delivery_contracts (id)
      )`,

      // ===== FACTION SYSTEM TABLES =====

      // Factions table (updated for new faction system)
      `CREATE TABLE IF NOT EXISTS factions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL, -- JSON data for faction configuration
        resources TEXT NOT NULL, -- JSON data for faction resources
        territory TEXT NOT NULL, -- JSON array of controlled sectors
        allies TEXT NOT NULL, -- JSON array of allied faction IDs
        enemies TEXT NOT NULL, -- JSON array of enemy faction IDs
        home_base TEXT, -- Home sector coordinates
        current_strategy TEXT DEFAULT 'EXPANSION',
        stats TEXT NOT NULL, -- JSON data for faction statistics
        updated_at INTEGER NOT NULL
      )`,

      // Faction relationships
      `CREATE TABLE IF NOT EXISTS faction_relationships (
        faction_id TEXT NOT NULL,
        target_faction_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL, -- 'ALLIED', 'ENEMY', 'NEUTRAL'
        relationship_strength REAL DEFAULT 0.5,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (faction_id, target_faction_id),
        FOREIGN KEY (faction_id) REFERENCES factions (id),
        FOREIGN KEY (target_faction_id) REFERENCES factions (id)
      )`,

      // Faction fleets
      `CREATE TABLE IF NOT EXISTS faction_fleets (
        fleet_id TEXT PRIMARY KEY,
        faction_id TEXT NOT NULL,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        behavior_type TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        is_in_combat BOOLEAN DEFAULT 0,
        morale REAL DEFAULT 100,
        fuel REAL DEFAULT 100,
        supplies REAL DEFAULT 100,
        alert_level INTEGER DEFAULT 0,
        mission_progress REAL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_update INTEGER DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (faction_id) REFERENCES factions (id)
      )`,

      // NPC fleets (alternative table structure for compatibility)
      `CREATE TABLE IF NOT EXISTS npc_fleets (
        id TEXT PRIMARY KEY,
        faction_id TEXT NOT NULL,
        name TEXT NOT NULL,
        ships TEXT NOT NULL, -- JSON array of ships
        current_sector TEXT NOT NULL, -- JSON sector coordinates
        destination TEXT, -- JSON destination coordinates
        mission TEXT NOT NULL,
        mission_data TEXT, -- JSON mission data
        resources INTEGER DEFAULT 1000,
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (faction_id) REFERENCES factions (id)
      )`,

      // Faction ships
      `CREATE TABLE IF NOT EXISTS faction_ships (
        ship_id TEXT PRIMARY KEY,
        fleet_id TEXT NOT NULL,
        ship_class TEXT NOT NULL,
        ship_name TEXT NOT NULL,
        health REAL NOT NULL,
        max_health REAL NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        is_alive BOOLEAN DEFAULT 1,
        is_in_combat BOOLEAN DEFAULT 0,
        damage REAL NOT NULL,
        speed REAL NOT NULL,
        range REAL NOT NULL,
        experience INTEGER DEFAULT 0,
        kills INTEGER DEFAULT 0,
        FOREIGN KEY (fleet_id) REFERENCES faction_fleets (fleet_id)
      )`,

      // Player reputation with factions
      `CREATE TABLE IF NOT EXISTS faction_player_reputation (
        player_id TEXT NOT NULL,
        faction_id TEXT NOT NULL,
        reputation REAL DEFAULT 0, -- -100 to 100
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (player_id, faction_id),
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (faction_id) REFERENCES factions (id)
      )`,

      // Reputation history for tracking changes
      `CREATE TABLE IF NOT EXISTS faction_reputation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        faction_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reputation_change REAL NOT NULL,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (faction_id) REFERENCES factions (id)
      )`,

      // Player reputation table (alias for faction_player_reputation)
      `CREATE TABLE IF NOT EXISTS player_reputation (
        player_id TEXT NOT NULL,
        faction_id TEXT NOT NULL,
        reputation REAL DEFAULT 0, -- -100 to 100
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        PRIMARY KEY (player_id, faction_id),
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (faction_id) REFERENCES factions (id)
      )`,

      // Faction territory table (alias for faction_territories)
      `CREATE TABLE IF NOT EXISTS faction_territory (
        faction_id TEXT NOT NULL,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        control_level REAL DEFAULT 1.0, -- 0.0 to 1.0
        last_contested INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        PRIMARY KEY (faction_id, sector_x, sector_y),
        FOREIGN KEY (faction_id) REFERENCES factions (id)
      )`,

      // Faction controlled territories
      `CREATE TABLE IF NOT EXISTS faction_territories (
        faction_id TEXT NOT NULL,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        control_level REAL DEFAULT 0.5, -- 0.0 to 1.0
        established_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (faction_id, sector_x, sector_y),
        FOREIGN KEY (faction_id) REFERENCES factions (id)
      )`,

      // Faction events and history
      `CREATE TABLE IF NOT EXISTS faction_events (
        id TEXT PRIMARY KEY,
        faction_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT, -- JSON data
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (faction_id) REFERENCES factions (id)
      )`,

      // Combat engagements between factions/players
      `CREATE TABLE IF NOT EXISTS faction_combat_history (
        id TEXT PRIMARY KEY,
        attacker_type TEXT NOT NULL, -- 'FACTION' or 'PLAYER'
        attacker_id TEXT NOT NULL,
        defender_type TEXT NOT NULL, -- 'FACTION' or 'PLAYER'  
        defender_id TEXT NOT NULL,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        victor TEXT, -- 'ATTACKER' or 'DEFENDER'
        duration INTEGER, -- milliseconds
        damage_dealt INTEGER,
        ships_lost INTEGER,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME
      )`,

      // ===== SKILL SYSTEM TABLES =====

      // Player skills table
      `CREATE TABLE IF NOT EXISTS player_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        skill_tree TEXT NOT NULL, -- 'combat', 'engineering', 'trading', 'exploration', 'leadership'
        skill_name TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        experience INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, skill_tree, skill_name),
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Player skill points table
      `CREATE TABLE IF NOT EXISTS player_skill_points (
        player_id TEXT NOT NULL,
        skill_tree TEXT NOT NULL,
        available_points INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (player_id, skill_tree),
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Skill events and history
      `CREATE TABLE IF NOT EXISTS skill_events (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        event_type TEXT NOT NULL, -- 'skill_upgrade', 'skill_reset', 'points_awarded'
        skill_tree TEXT,
        skill_name TEXT,
        old_level INTEGER,
        new_level INTEGER,
        skill_points_spent INTEGER DEFAULT 0,
        data TEXT, -- JSON data for additional event information
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Active skill effects and bonuses
      `CREATE TABLE IF NOT EXISTS player_skill_effects (
        player_id TEXT NOT NULL,
        effect_name TEXT NOT NULL,
        effect_value REAL NOT NULL,
        effect_type TEXT NOT NULL, -- 'additive', 'multiplicative', 'unlock'
        source_skills TEXT NOT NULL, -- JSON array of contributing skills
        last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (player_id, effect_name),
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Skill certifications and unlocks
      `CREATE TABLE IF NOT EXISTS skill_certifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        certification_type TEXT NOT NULL, -- 'ship_class', 'component_tier', 'sector_access'
        certification_name TEXT NOT NULL,
        required_skills TEXT NOT NULL, -- JSON array of skill requirements
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        UNIQUE(player_id, certification_type, certification_name),
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // ===== GUILD SYSTEM TABLES =====

      // Guilds table
      `CREATE TABLE IF NOT EXISTS guilds (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        tag TEXT NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        founder_id TEXT NOT NULL,
        founded_at INTEGER NOT NULL,
        config TEXT NOT NULL, -- JSON data for guild configuration
        resources TEXT NOT NULL, -- JSON data for guild resources
        stats TEXT NOT NULL, -- JSON data for guild statistics
        territories TEXT NOT NULL, -- JSON array of controlled territories
        guild_halls TEXT NOT NULL, -- JSON array of guild hall IDs
        allies TEXT NOT NULL, -- JSON array of allied guild IDs
        enemies TEXT NOT NULL, -- JSON array of enemy guild IDs
        neutral TEXT NOT NULL, -- JSON array of neutral guild IDs
        active_perks TEXT NOT NULL, -- JSON array of active perk IDs
        unlocked_perks TEXT NOT NULL, -- JSON array of unlocked perk IDs
        is_active BOOLEAN DEFAULT 1,
        disbanded_at INTEGER,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (founder_id) REFERENCES players (id)
      )`,

      // Guild members table
      `CREATE TABLE IF NOT EXISTS guild_members (
        player_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        contribution_points INTEGER DEFAULT 0,
        last_active INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        PRIMARY KEY (player_id, guild_id),
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (guild_id) REFERENCES guilds (id)
      )`,

      // Guild roles table
      `CREATE TABLE IF NOT EXISTS guild_roles (
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        role_name TEXT NOT NULL,
        priority INTEGER NOT NULL, -- Lower number = higher priority
        permissions TEXT NOT NULL, -- JSON array of permissions
        color TEXT NOT NULL,
        is_default BOOLEAN DEFAULT 0,
        max_members INTEGER DEFAULT -1, -- -1 for unlimited
        PRIMARY KEY (guild_id, role_id),
        FOREIGN KEY (guild_id) REFERENCES guilds (id)
      )`,

      // Guild halls table
      `CREATE TABLE IF NOT EXISTS guild_halls (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        level INTEGER DEFAULT 1,
        hall_type TEXT DEFAULT 'BASIC',
        is_active BOOLEAN DEFAULT 1,
        construction_progress REAL DEFAULT 100,
        construction_started INTEGER NOT NULL,
        construction_completed INTEGER,
        facilities TEXT NOT NULL, -- JSON data for facilities
        maintenance_cost INTEGER DEFAULT 100,
        last_maintenance INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        power_level INTEGER DEFAULT 100,
        defense_level INTEGER DEFAULT 50,
        upgrades TEXT NOT NULL, -- JSON array of upgrades
        active_modules TEXT NOT NULL, -- JSON array of active modules
        stored_resources TEXT NOT NULL, -- JSON data for stored resources
        access_level TEXT DEFAULT 'MEMBERS',
        is_public BOOLEAN DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (guild_id) REFERENCES guilds (id)
      )`,

      // Guild applications table
      `CREATE TABLE IF NOT EXISTS guild_applications (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        message TEXT DEFAULT '',
        status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
        applied_at INTEGER NOT NULL,
        processed_by TEXT,
        processed_at INTEGER,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (guild_id) REFERENCES guilds (id),
        FOREIGN KEY (processed_by) REFERENCES players (id)
      )`,

      // Guild resource transactions
      `CREATE TABLE IF NOT EXISTS guild_resource_transactions (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        player_id TEXT,
        transaction_type TEXT NOT NULL, -- 'deposit', 'withdraw'
        resource_type TEXT NOT NULL,
        amount TEXT NOT NULL, -- JSON data for amount (supports different resource types)
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (guild_id) REFERENCES guilds (id),
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Guild relations (diplomacy)
      `CREATE TABLE IF NOT EXISTS guild_relations (
        guild_id TEXT NOT NULL,
        target_guild_id TEXT NOT NULL,
        relation_type TEXT NOT NULL, -- 'ALLY', 'ENEMY', 'NEUTRAL'
        established_at INTEGER NOT NULL,
        established_by TEXT,
        notes TEXT DEFAULT '',
        PRIMARY KEY (guild_id, target_guild_id),
        FOREIGN KEY (guild_id) REFERENCES guilds (id),
        FOREIGN KEY (target_guild_id) REFERENCES guilds (id),
        FOREIGN KEY (established_by) REFERENCES players (id)
      )`,

      // Guild perks
      `CREATE TABLE IF NOT EXISTS guild_perks (
        guild_id TEXT NOT NULL,
        perk_id TEXT NOT NULL,
        activated_at INTEGER NOT NULL,
        cost_paid INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        PRIMARY KEY (guild_id, perk_id),
        FOREIGN KEY (guild_id) REFERENCES guilds (id)
      )`,

      // Guild events and activity log
      `CREATE TABLE IF NOT EXISTS guild_events (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        player_id TEXT,
        target_player_id TEXT,
        data TEXT, -- JSON data for event-specific information
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (guild_id) REFERENCES guilds (id),
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (target_player_id) REFERENCES players (id)
      )`,

      // Guild wars and conflicts
      `CREATE TABLE IF NOT EXISTS guild_wars (
        id TEXT PRIMARY KEY,
        attacker_guild_id TEXT NOT NULL,
        defender_guild_id TEXT NOT NULL,
        war_type TEXT DEFAULT 'TERRITORY', -- 'TERRITORY', 'RESOURCES', 'HONOR'
        status TEXT DEFAULT 'ACTIVE', -- 'DECLARED', 'ACTIVE', 'ENDED'
        declared_at INTEGER NOT NULL,
        declared_by TEXT NOT NULL,
        started_at INTEGER,
        ended_at INTEGER,
        victor_guild_id TEXT,
        casualties TEXT, -- JSON data for war casualties
        objectives TEXT, -- JSON data for war objectives
        FOREIGN KEY (attacker_guild_id) REFERENCES guilds (id),
        FOREIGN KEY (defender_guild_id) REFERENCES guilds (id),
        FOREIGN KEY (declared_by) REFERENCES players (id),
        FOREIGN KEY (victor_guild_id) REFERENCES guilds (id)
      )`,

      // Guild war battles
      `CREATE TABLE IF NOT EXISTS guild_war_battles (
        id TEXT PRIMARY KEY,
        war_id TEXT NOT NULL,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        attacker_players TEXT NOT NULL, -- JSON array of player IDs
        defender_players TEXT NOT NULL, -- JSON array of player IDs
        victor TEXT, -- 'ATTACKER' or 'DEFENDER'
        battle_data TEXT, -- JSON data for battle results
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        FOREIGN KEY (war_id) REFERENCES guild_wars (id)
      )`,

      // Guild territories
      `CREATE TABLE IF NOT EXISTS guild_territories (
        guild_id TEXT NOT NULL,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        control_level REAL DEFAULT 1.0, -- 0.0 to 1.0
        claimed_at INTEGER NOT NULL,
        claimed_by TEXT NOT NULL,
        last_contested INTEGER,
        defense_structures TEXT, -- JSON array of defense structures
        PRIMARY KEY (guild_id, sector_x, sector_y),
        FOREIGN KEY (guild_id) REFERENCES guilds (id),
        FOREIGN KEY (claimed_by) REFERENCES players (id)
      )`,

      // ===== ENVIRONMENTAL HAZARDS SYSTEM TABLES =====

      // Player countermeasures and hazard defenses
      `CREATE TABLE IF NOT EXISTS player_countermeasures (
        player_id TEXT NOT NULL,
        countermeasure_id TEXT NOT NULL,
        acquired_at INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        upgrade_level INTEGER DEFAULT 1,
        efficiency REAL DEFAULT 1.0,
        PRIMARY KEY (player_id, countermeasure_id),
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Player system health tracking
      `CREATE TABLE IF NOT EXISTS player_system_health (
        player_id TEXT NOT NULL,
        system_name TEXT NOT NULL,
        health_percentage REAL DEFAULT 1.0,
        last_repair INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        repair_count INTEGER DEFAULT 0,
        PRIMARY KEY (player_id, system_name),
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Hazard exposure history
      `CREATE TABLE IF NOT EXISTS hazard_exposure_history (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        hazard_id TEXT NOT NULL,
        hazard_type TEXT NOT NULL,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        exposure_start INTEGER NOT NULL,
        exposure_end INTEGER,
        total_exposure_time INTEGER DEFAULT 0,
        max_intensity REAL DEFAULT 0,
        damage_taken INTEGER DEFAULT 0,
        countermeasures_active TEXT, -- JSON array of active countermeasures
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (hazard_id) REFERENCES sector_hazards (id)
      )`,

      // Dynamic hazard events affecting multiple sectors
      `CREATE TABLE IF NOT EXISTS dynamic_hazard_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_name TEXT NOT NULL,
        center_sector_x INTEGER NOT NULL,
        center_sector_y INTEGER NOT NULL,
        affected_radius INTEGER NOT NULL,
        intensity REAL NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        event_data TEXT, -- JSON data for event-specific information
        affected_sectors TEXT -- JSON array of affected sector coordinates
      )`,

      // Player warning history and acknowledgments
      `CREATE TABLE IF NOT EXISTS player_warning_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        warning_type TEXT NOT NULL,
        hazard_id TEXT,
        sector_x INTEGER,
        sector_y INTEGER,
        warning_level TEXT NOT NULL, -- CRITICAL, HIGH, MEDIUM, LOW, INFO
        acknowledged BOOLEAN DEFAULT 0,
        acknowledged_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Hazard countermeasure research and upgrades
      `CREATE TABLE IF NOT EXISTS countermeasure_research (
        player_id TEXT NOT NULL,
        countermeasure_id TEXT NOT NULL,
        research_progress REAL DEFAULT 0.0,
        research_points_invested INTEGER DEFAULT 0,
        is_unlocked BOOLEAN DEFAULT 0,
        unlocked_at INTEGER,
        upgrade_level INTEGER DEFAULT 0,
        PRIMARY KEY (player_id, countermeasure_id),
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Sector hazard generation patterns and history
      `CREATE TABLE IF NOT EXISTS sector_hazard_patterns (
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        biome_type TEXT NOT NULL,
        generation_seed INTEGER NOT NULL,
        last_generated INTEGER NOT NULL,
        hazard_count INTEGER DEFAULT 0,
        generation_method TEXT DEFAULT 'procedural',
        pattern_data TEXT, -- JSON data for generation patterns
        special_rules TEXT, -- JSON array of applied special rules
        PRIMARY KEY (sector_x, sector_y)
      )`,

      // Player hazard statistics and achievements
      `CREATE TABLE IF NOT EXISTS player_hazard_stats (
        player_id TEXT PRIMARY KEY,
        total_hazards_encountered INTEGER DEFAULT 0,
        total_exposure_time INTEGER DEFAULT 0,
        total_damage_from_hazards INTEGER DEFAULT 0,
        hazards_survived INTEGER DEFAULT 0,
        countermeasures_deployed INTEGER DEFAULT 0,
        systems_repaired INTEGER DEFAULT 0,
        critical_warnings_received INTEGER DEFAULT 0,
        temporal_displacements INTEGER DEFAULT 0,
        wormhole_transits INTEGER DEFAULT 0,
        asteroid_collisions_avoided INTEGER DEFAULT 0,
        radiation_exposure_total REAL DEFAULT 0,
        most_dangerous_hazard TEXT,
        longest_exposure_time INTEGER DEFAULT 0,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // ===== RESEARCH & TECHNOLOGY SYSTEM TABLES =====

      // Research trees and technology definitions
      `CREATE TABLE IF NOT EXISTS research_technologies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        tree TEXT NOT NULL, -- 'MILITARY', 'ENGINEERING', 'SCIENCE', 'COMMERCE'
        tier INTEGER NOT NULL,
        research_cost INTEGER NOT NULL,
        research_time INTEGER NOT NULL, -- Time in milliseconds
        prerequisites TEXT NOT NULL, -- JSON array of prerequisite technology IDs
        unlocks TEXT NOT NULL, -- JSON array of unlocked items/abilities
        effects TEXT NOT NULL, -- JSON object for gameplay effects
        blueprints TEXT NOT NULL, -- JSON array of unlocked blueprints
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Player research progress and unlocks
      `CREATE TABLE IF NOT EXISTS player_research (
        player_id TEXT NOT NULL,
        technology_id TEXT NOT NULL,
        research_progress REAL DEFAULT 0.0, -- 0.0 to 1.0
        research_points_invested INTEGER DEFAULT 0,
        is_unlocked BOOLEAN DEFAULT 0,
        unlocked_at INTEGER, -- Timestamp when unlocked
        research_level INTEGER DEFAULT 0, -- For technologies with multiple levels
        PRIMARY KEY (player_id, technology_id),
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Active research projects
      `CREATE TABLE IF NOT EXISTS research_projects (
        id TEXT PRIMARY KEY,
        player_id TEXT,
        guild_id TEXT,
        technology_id TEXT NOT NULL,
        project_type TEXT NOT NULL, -- 'INDIVIDUAL', 'GUILD_COLLABORATION'
        research_points_allocated INTEGER NOT NULL,
        start_time INTEGER NOT NULL, -- Timestamp when project started
        estimated_completion INTEGER NOT NULL, -- Estimated completion timestamp
        actual_completion INTEGER, -- Actual completion timestamp
        status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'
        contributors TEXT, -- JSON array of contributor player IDs for guild projects
        bonus_factors TEXT, -- JSON object for various research bonuses
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (guild_id) REFERENCES guilds (id)
      )`,

      // Player research points and generation rates
      `CREATE TABLE IF NOT EXISTS player_research_points (
        player_id TEXT PRIMARY KEY,
        military_points INTEGER DEFAULT 0,
        engineering_points INTEGER DEFAULT 0,
        science_points INTEGER DEFAULT 0,
        commerce_points INTEGER DEFAULT 0,
        total_points_earned INTEGER DEFAULT 0,
        total_points_spent INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        generation_rate TEXT, -- JSON object with generation rates by source
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`,

      // Technology blueprints and unlocked crafting options
      `CREATE TABLE IF NOT EXISTS technology_blueprints (
        id TEXT PRIMARY KEY,
        technology_id TEXT NOT NULL,
        blueprint_type TEXT NOT NULL, -- 'weapon', 'defense', 'propulsion', 'utility', 'facility'
        name TEXT NOT NULL,
        description TEXT,
        stats TEXT NOT NULL, -- JSON object
        crafting_requirements TEXT, -- JSON object
        unlock_level INTEGER DEFAULT 1,
        rarity TEXT DEFAULT 'COMMON', -- 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Research laboratories and facilities
      `CREATE TABLE IF NOT EXISTS research_laboratories (
        id TEXT PRIMARY KEY,
        player_id TEXT,
        guild_id TEXT,
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        name TEXT NOT NULL,
        laboratory_type TEXT DEFAULT 'BASIC', -- 'BASIC', 'ADVANCED', 'QUANTUM', 'DIMENSIONAL'
        level INTEGER DEFAULT 1,
        specializations TEXT, -- JSON array of research tree specializations
        research_bonus REAL DEFAULT 1.0, -- Multiplier for research speed
        capacity INTEGER DEFAULT 1, -- Number of simultaneous projects
        power_consumption INTEGER DEFAULT 100,
        maintenance_cost INTEGER DEFAULT 50,
        is_active BOOLEAN DEFAULT 1,
        construction_progress REAL DEFAULT 1.0, -- 0.0 to 1.0
        last_maintenance INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (guild_id) REFERENCES guilds (id)
      )`,

      // Research collaboration and guild projects
      `CREATE TABLE IF NOT EXISTS research_collaborations (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        technology_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        description TEXT,
        required_points INTEGER NOT NULL,
        contributed_points INTEGER DEFAULT 0,
        contributors TEXT, -- JSON object mapping player_id to contribution amount
        rewards TEXT, -- JSON object defining rewards for contributors
        status TEXT DEFAULT 'OPEN', -- 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
        start_time INTEGER, -- Timestamp when project starts
        completion_time INTEGER, -- Timestamp when completed
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds (id),
        FOREIGN KEY (created_by) REFERENCES players (id)
      )`,

      // Research events and history
      `CREATE TABLE IF NOT EXISTS research_events (
        id TEXT PRIMARY KEY,
        player_id TEXT,
        guild_id TEXT,
        event_type TEXT NOT NULL, -- 'RESEARCH_COMPLETED', 'COLLABORATION_JOINED', 'BREAKTHROUGH', 'FAILURE', 'POINTS_AWARDED'
        technology_id TEXT,
        event_data TEXT, -- JSON object with event-specific data
        research_points_awarded INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (guild_id) REFERENCES guilds (id)
      )`,

      // Research station discoveries and alien technology
      `CREATE TABLE IF NOT EXISTS research_discoveries (
        id TEXT PRIMARY KEY,
        discovered_by TEXT NOT NULL, -- Player ID who made the discovery
        discovery_type TEXT NOT NULL, -- 'ALIEN_TECH', 'ANCIENT_RUIN', 'PROTOTYPE', 'BREAKTHROUGH'
        sector_x INTEGER NOT NULL,
        sector_y INTEGER NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        discovery_data TEXT, -- JSON object with discovery-specific information
        research_value INTEGER DEFAULT 0, -- Research points awarded
        technology_unlocked TEXT, -- Technology ID unlocked by this discovery
        shared_with_guild BOOLEAN DEFAULT 0,
        discovery_time INTEGER NOT NULL,
        analyzed BOOLEAN DEFAULT 0,
        analysis_results TEXT, -- JSON object with analysis data
        FOREIGN KEY (discovered_by) REFERENCES players (id)
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

  // ===== TRADING SYSTEM METHODS =====

  /**
   * Create a trading station
   */
  async createTradingStation(stationData) {
    const result = await this.run(
      `INSERT OR REPLACE INTO trading_stations 
       (id, sector_x, sector_y, station_name, station_type, biome_type, x, y, reputation_modifier) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stationData.id,
        stationData.sector_x,
        stationData.sector_y,
        stationData.station_name,
        stationData.station_type,
        stationData.biome_type,
        stationData.x,
        stationData.y,
        stationData.reputation_modifier || 1.0
      ]
    );
    return result;
  }

  /**
   * Get trading stations in a sector
   */
  async getTradingStations(sectorX, sectorY) {
    return await this.all(
      'SELECT * FROM trading_stations WHERE sector_x = ? AND sector_y = ? AND is_active = 1',
      [sectorX, sectorY]
    );
  }

  /**
   * Get trading station by ID
   */
  async getTradingStation(stationId) {
    return await this.get(
      'SELECT * FROM trading_stations WHERE id = ? AND is_active = 1',
      [stationId]
    );
  }

  /**
   * Update station inventory
   */
  async updateStationInventory(stationId, oreType, inventoryData) {
    const existing = await this.get(
      'SELECT station_id FROM station_inventory WHERE station_id = ? AND ore_type = ?',
      [stationId, oreType]
    );

    if (existing) {
      await this.run(
        `UPDATE station_inventory SET 
         quantity = ?, current_buy_price = ?, current_sell_price = ?, 
         supply_level = ?, demand_level = ?, last_price_update = CURRENT_TIMESTAMP
         WHERE station_id = ? AND ore_type = ?`,
        [
          inventoryData.quantity,
          inventoryData.current_buy_price,
          inventoryData.current_sell_price,
          inventoryData.supply_level,
          inventoryData.demand_level,
          stationId,
          oreType
        ]
      );
    } else {
      await this.run(
        `INSERT INTO station_inventory 
         (station_id, ore_type, quantity, base_buy_price, base_sell_price, 
          current_buy_price, current_sell_price, supply_level, demand_level) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stationId,
          oreType,
          inventoryData.quantity,
          inventoryData.base_buy_price,
          inventoryData.base_sell_price,
          inventoryData.current_buy_price,
          inventoryData.current_sell_price,
          inventoryData.supply_level,
          inventoryData.demand_level
        ]
      );
    }
  }

  /**
   * Get station inventory
   */
  async getStationInventory(stationId, oreType = null) {
    if (oreType) {
      return await this.get(
        'SELECT * FROM station_inventory WHERE station_id = ? AND ore_type = ?',
        [stationId, oreType]
      );
    } else {
      return await this.all(
        'SELECT * FROM station_inventory WHERE station_id = ?',
        [stationId]
      );
    }
  }

  /**
   * Record market price
   */
  async recordMarketPrice(stationId, oreType, buyPrice, sellPrice, volume = 0) {
    await this.run(
      'INSERT INTO market_prices (station_id, ore_type, buy_price, sell_price, volume_traded) VALUES (?, ?, ?, ?, ?)',
      [stationId, oreType, buyPrice, sellPrice, volume]
    );
  }

  /**
   * Get market price history
   */
  async getMarketHistory(stationId, oreType, limit = 50) {
    return await this.all(
      `SELECT * FROM market_prices 
       WHERE station_id = ? AND ore_type = ? 
       ORDER BY recorded_at DESC LIMIT ?`,
      [stationId, oreType, limit]
    );
  }

  /**
   * Create trade order
   */
  async createTradeOrder(orderData) {
    const result = await this.run(
      `INSERT INTO trade_orders 
       (id, player_id, station_id, order_type, ore_type, quantity, price_per_unit, total_value, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderData.id,
        orderData.player_id,
        orderData.station_id,
        orderData.order_type,
        orderData.ore_type,
        orderData.quantity,
        orderData.price_per_unit,
        orderData.total_value,
        orderData.expires_at
      ]
    );
    return result;
  }

  /**
   * Get trade orders
   */
  async getTradeOrders(stationId, orderType = null, status = 'active') {
    let sql = 'SELECT * FROM trade_orders WHERE station_id = ? AND status = ?';
    let params = [stationId, status];

    if (orderType) {
      sql += ' AND order_type = ?';
      params.push(orderType);
    }

    sql += ' ORDER BY created_at DESC';
    return await this.all(sql, params);
  }

  /**
   * Update trade order status
   */
  async updateTradeOrderStatus(orderId, status, completedAt = null) {
    const updates = ['status = ?'];
    const params = [status];

    if (completedAt || status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    params.push(orderId);
    await this.run(
      `UPDATE trade_orders SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Record trade transaction
   */
  async recordTrade(tradeData) {
    await this.run(
      `INSERT INTO trade_history 
       (buyer_id, seller_id, station_id, ore_type, quantity, price_per_unit, total_value, trade_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tradeData.buyer_id,
        tradeData.seller_id,
        tradeData.station_id,
        tradeData.ore_type,
        tradeData.quantity,
        tradeData.price_per_unit,
        tradeData.total_value,
        tradeData.trade_type
      ]
    );
  }

  /**
   * Get trade history for player
   */
  async getPlayerTradeHistory(playerId, limit = 50) {
    return await this.all(
      `SELECT th.*, ts.station_name 
       FROM trade_history th 
       LEFT JOIN trading_stations ts ON th.station_id = ts.id 
       WHERE th.buyer_id = ? OR th.seller_id = ? 
       ORDER BY th.traded_at DESC LIMIT ?`,
      [playerId, playerId, limit]
    );
  }

  /**
   * Create delivery contract
   */
  async createDeliveryContract(contractData) {
    const result = await this.run(
      `INSERT INTO delivery_contracts 
       (id, contract_giver, origin_station_id, destination_station_id, cargo_type, 
        cargo_quantity, base_reward, bonus_reward, distance, risk_level, deadline) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contractData.id,
        contractData.contract_giver,
        contractData.origin_station_id,
        contractData.destination_station_id,
        contractData.cargo_type,
        contractData.cargo_quantity,
        contractData.base_reward,
        contractData.bonus_reward || 0,
        contractData.distance,
        contractData.risk_level || 1,
        contractData.deadline
      ]
    );

    // Add cargo requirements
    if (contractData.cargo_requirements) {
      for (const cargo of contractData.cargo_requirements) {
        await this.run(
          'INSERT INTO contract_cargo (contract_id, ore_type, quantity_required) VALUES (?, ?, ?)',
          [contractData.id, cargo.ore_type, cargo.quantity]
        );
      }
    }

    return result;
  }

  /**
   * Get available delivery contracts
   */
  async getAvailableContracts(limit = 20) {
    return await this.all(
      `SELECT dc.*, 
              os.station_name as origin_name, 
              ds.station_name as destination_name,
              os.sector_x as origin_sector_x, os.sector_y as origin_sector_y,
              ds.sector_x as dest_sector_x, ds.sector_y as dest_sector_y
       FROM delivery_contracts dc
       LEFT JOIN trading_stations os ON dc.origin_station_id = os.id
       LEFT JOIN trading_stations ds ON dc.destination_station_id = ds.id
       WHERE dc.status = 'available' AND dc.deadline > CURRENT_TIMESTAMP
       ORDER BY dc.created_at DESC LIMIT ?`,
      [limit]
    );
  }

  /**
   * Accept delivery contract
   */
  async acceptDeliveryContract(contractId, playerId) {
    const result = await this.run(
      `UPDATE delivery_contracts 
       SET status = 'accepted', player_id = ?, accepted_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND status = 'available'`,
      [playerId, contractId]
    );
    
    if (result.changes === 0) {
      throw new Error('Contract not available or already accepted');
    }
    
    return result;
  }

  /**
   * Update contract status
   */
  async updateContractStatus(contractId, status, completedAt = null) {
    const updates = ['status = ?'];
    const params = [status];

    if (completedAt || status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    params.push(contractId);
    await this.run(
      `UPDATE delivery_contracts SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Get player's active contracts
   */
  async getPlayerContracts(playerId, status = null) {
    let sql = `SELECT dc.*, 
                      os.station_name as origin_name, 
                      ds.station_name as destination_name,
                      os.sector_x as origin_sector_x, os.sector_y as origin_sector_y,
                      ds.sector_x as dest_sector_x, ds.sector_y as dest_sector_y
               FROM delivery_contracts dc
               LEFT JOIN trading_stations os ON dc.origin_station_id = os.id
               LEFT JOIN trading_stations ds ON dc.destination_station_id = ds.id
               WHERE dc.player_id = ?`;
    
    let params = [playerId];

    if (status) {
      sql += ' AND dc.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY dc.accepted_at DESC';
    return await this.all(sql, params);
  }

  /**
   * Get contract cargo requirements
   */
  async getContractCargo(contractId) {
    return await this.all(
      'SELECT * FROM contract_cargo WHERE contract_id = ?',
      [contractId]
    );
  }

  /**
   * Update contract cargo delivery
   */
  async updateContractCargo(contractId, oreType, quantityDelivered) {
    await this.run(
      `UPDATE contract_cargo 
       SET quantity_delivered = quantity_delivered + ? 
       WHERE contract_id = ? AND ore_type = ?`,
      [quantityDelivered, contractId, oreType]
    );
  }

  // ===== FACTION SYSTEM METHODS =====

  /**
   * Create or update a faction
   */
  async saveFaction(factionData) {
    const result = await this.run(
      `INSERT OR REPLACE INTO factions 
       (id, name, type, config, resources, territory, allies, enemies, 
        home_base, current_strategy, stats, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        factionData.id,
        factionData.name,
        factionData.type,
        factionData.config,
        factionData.resources,
        factionData.territory,
        factionData.allies,
        factionData.enemies,
        factionData.homeBase,
        factionData.currentStrategy,
        factionData.stats,
        factionData.updated_at
      ]
    );
    return result;
  }

  /**
   * Get faction by ID
   */
  async getFaction(factionId) {
    return await this.get(
      'SELECT * FROM factions WHERE id = ?',
      [factionId]
    );
  }

  /**
   * Get all active factions
   */
  async getAllFactions() {
    return await this.all(
      'SELECT * FROM factions WHERE is_active = 1 ORDER BY name'
    );
  }

  /**
   * Create or update NPC fleet
   */
  async saveNPCFleet(fleetData) {
    const result = await this.run(
      `INSERT OR REPLACE INTO npc_fleets 
       (id, faction_id, name, ships, current_sector, destination, 
        mission, mission_data, resources, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fleetData.id,
        fleetData.faction_id,
        fleetData.name,
        fleetData.ships,
        fleetData.current_sector,
        fleetData.destination,
        fleetData.mission,
        fleetData.mission_data,
        fleetData.resources,
        fleetData.status,
        fleetData.created_at,
        fleetData.updated_at
      ]
    );
    return result;
  }

  /**
   * Get NPC fleets by faction
   */
  async getFactionFleets(factionId, status = null) {
    let sql = 'SELECT * FROM npc_fleets WHERE faction_id = ?';
    let params = [factionId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';
    return await this.all(sql, params);
  }

  /**
   * Get all active NPC fleets
   */
  async getAllNPCFleets() {
    return await this.all(
      `SELECT * FROM npc_fleets 
       WHERE status IN ('idle', 'moving', 'engaged', 'returning') 
       ORDER BY created_at DESC`
    );
  }

  /**
   * Update NPC fleet status
   */
  async updateFleetStatus(fleetId, status) {
    await this.run(
      'UPDATE npc_fleets SET status = ?, updated_at = ? WHERE id = ?',
      [status, Date.now(), fleetId]
    );
  }

  /**
   * Get player reputation with faction
   */
  async getPlayerReputation(playerId, factionId) {
    const result = await this.get(
      'SELECT reputation FROM player_reputation WHERE player_id = ? AND faction_id = ?',
      [playerId, factionId]
    );
    return result ? result.reputation : 0;
  }

  /**
   * Update player reputation with faction
   */
  async updatePlayerReputation(playerId, factionId, reputation) {
    await this.run(
      `INSERT OR REPLACE INTO player_reputation 
       (player_id, faction_id, reputation, updated_at) 
       VALUES (?, ?, ?, ?)`,
      [playerId, factionId, reputation, Date.now()]
    );
  }

  /**
   * Get all player reputations
   */
  async getPlayerReputations(playerId) {
    return await this.all(
      `SELECT pr.*, f.name as faction_name, f.type as faction_type 
       FROM player_reputation pr 
       LEFT JOIN factions f ON pr.faction_id = f.id 
       WHERE pr.player_id = ?`,
      [playerId]
    );
  }

  /**
   * Record reputation change event
   */
  async recordReputationChange(playerId, factionId, change, reason) {
    await this.run(
      `INSERT INTO faction_reputation_history 
       (player_id, faction_id, reputation_change, reason, timestamp) 
       VALUES (?, ?, ?, ?, ?)`,
      [playerId, factionId, change, reason, Date.now()]
    );
  }

  /**
   * Get reputation history for player
   */
  async getReputationHistory(playerId, factionId = null, limit = 50) {
    let sql = `SELECT re.*, f.name as faction_name 
               FROM faction_reputation_history re 
               LEFT JOIN factions f ON re.faction_id = f.id 
               WHERE re.player_id = ?`;
    let params = [playerId];

    if (factionId) {
      sql += ' AND re.faction_id = ?';
      params.push(factionId);
    }

    sql += ' ORDER BY re.timestamp DESC LIMIT ?';
    params.push(limit);

    return await this.all(sql, params);
  }

  /**
   * Get factions controlling a sector
   */
  async getFactionsInSector(sectorX, sectorY) {
    return await this.all(
      `SELECT f.*, ft.control_level 
       FROM faction_territory ft 
       LEFT JOIN factions f ON ft.faction_id = f.id 
       WHERE ft.sector_x = ? AND ft.sector_y = ?`,
      [sectorX, sectorY]
    );
  }

  /**
   * Set faction territory control
   */
  async setFactionTerritory(factionId, sectorX, sectorY, controlLevel = 1.0) {
    await this.run(
      `INSERT OR REPLACE INTO faction_territory 
       (faction_id, sector_x, sector_y, control_level, last_contested) 
       VALUES (?, ?, ?, ?, ?)`,
      [factionId, sectorX, sectorY, controlLevel, Date.now()]
    );
  }

  /**
   * Remove faction territory control
   */
  async removeFactionTerritory(factionId, sectorX, sectorY) {
    await this.run(
      'DELETE FROM faction_territory WHERE faction_id = ? AND sector_x = ? AND sector_y = ?',
      [factionId, sectorX, sectorY]
    );
  }

  /**
   * Get faction territories
   */
  async getFactionTerritories(factionId) {
    return await this.all(
      'SELECT * FROM faction_territory WHERE faction_id = ? ORDER BY control_level DESC',
      [factionId]
    );
  }

  /**
   * Record faction event
   */
  async recordFactionEvent(eventData) {
    await this.run(
      `INSERT INTO faction_events 
       (id, faction_id, event_type, event_data, sector_id, target_faction_id, created_at, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventData.id,
        eventData.faction_id,
        eventData.event_type,
        eventData.event_data,
        eventData.sector_id || null,
        eventData.target_faction_id || null,
        eventData.created_at,
        eventData.expires_at || null
      ]
    );
  }

  /**
   * Get faction events
   */
  async getFactionEvents(factionId = null, eventType = null, limit = 50) {
    let sql = 'SELECT * FROM faction_events WHERE 1=1';
    let params = [];

    if (factionId) {
      sql += ' AND faction_id = ?';
      params.push(factionId);
    }

    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return await this.all(sql, params);
  }

  /**
   * Update faction diplomacy
   */
  async updateFactionDiplomacy(factionA, factionB, relationType, strength) {
    await this.run(
      `INSERT OR REPLACE INTO faction_diplomacy 
       (faction_a, faction_b, relation_type, relation_strength, last_change) 
       VALUES (?, ?, ?, ?, ?)`,
      [factionA, factionB, relationType, strength, Date.now()]
    );

    // Also update reverse relationship
    await this.run(
      `INSERT OR REPLACE INTO faction_diplomacy 
       (faction_a, faction_b, relation_type, relation_strength, last_change) 
       VALUES (?, ?, ?, ?, ?)`,
      [factionB, factionA, relationType, strength, Date.now()]
    );
  }

  /**
   * Get faction relationships
   */
  async getFactionRelationships(factionId) {
    return await this.all(
      `SELECT fd.*, f.name as target_faction_name, f.type as target_faction_type 
       FROM faction_diplomacy fd 
       LEFT JOIN factions f ON fd.faction_b = f.id 
       WHERE fd.faction_a = ?`,
      [factionId]
    );
  }

  /**
   * Get faction statistics
   */
  async getFactionStats() {
    const factionCount = await this.get('SELECT COUNT(*) as count FROM factions');
    const fleetCount = await this.get('SELECT COUNT(*) as count FROM faction_fleets WHERE is_active = 1');
    const territoryCount = await this.get('SELECT COUNT(*) as count FROM faction_territory');
    const reputationEvents = await this.get('SELECT COUNT(*) as count FROM faction_reputation_history WHERE timestamp > ?', [Date.now() - 86400000]); // Last 24 hours

    const factionTypes = await this.all(
      'SELECT type, COUNT(*) as count FROM factions GROUP BY type'
    );

    const territoryDistribution = await this.all(
      `SELECT f.name, f.type, COUNT(ft.faction_id) as territory_count 
       FROM factions f 
       LEFT JOIN faction_territory ft ON f.id = ft.faction_id 
       GROUP BY f.id 
       ORDER BY territory_count DESC`
    );

    return {
      totalFactions: factionCount.count,
      totalFleets: fleetCount.count,
      totalTerritories: territoryCount.count,
      recentReputationEvents: reputationEvents.count,
      factionTypes,
      territoryDistribution
    };
  }

  // ===== ENVIRONMENTAL HAZARDS SYSTEM METHODS =====

  /**
   * Add countermeasure to player
   */
  async addPlayerCountermeasure(playerId, countermeasureId, upgradeLevel = 1) {
    const result = await this.run(
      `INSERT OR REPLACE INTO player_countermeasures 
       (player_id, countermeasure_id, acquired_at, upgrade_level) 
       VALUES (?, ?, ?, ?)`,
      [playerId, countermeasureId, Date.now(), upgradeLevel]
    );
    return result;
  }

  /**
   * Get player countermeasures
   */
  async getPlayerCountermeasures(playerId) {
    return await this.all(
      'SELECT * FROM player_countermeasures WHERE player_id = ? AND is_active = 1',
      [playerId]
    );
  }

  /**
   * Update player system health
   */
  async updatePlayerSystemHealth(playerId, systemName, healthPercentage) {
    await this.run(
      `INSERT OR REPLACE INTO player_system_health 
       (player_id, system_name, health_percentage) 
       VALUES (?, ?, ?)`,
      [playerId, systemName, Math.max(0, Math.min(1, healthPercentage))]
    );
  }

  /**
   * Get player system health
   */
  async getPlayerSystemHealth(playerId) {
    return await this.all(
      'SELECT * FROM player_system_health WHERE player_id = ?',
      [playerId]
    );
  }

  /**
   * Repair player system
   */
  async repairPlayerSystem(playerId, systemName, repairAmount = 1.0) {
    const result = await this.run(
      `UPDATE player_system_health 
       SET health_percentage = MIN(1.0, health_percentage + ?), 
           last_repair = ?, 
           repair_count = repair_count + 1
       WHERE player_id = ? AND system_name = ?`,
      [repairAmount, Date.now(), playerId, systemName]
    );
    return result;
  }

  /**
   * Record hazard exposure
   */
  async recordHazardExposure(exposureData) {
    await this.run(
      `INSERT INTO hazard_exposure_history 
       (id, player_id, hazard_id, hazard_type, sector_x, sector_y, 
        exposure_start, exposure_end, total_exposure_time, max_intensity, 
        damage_taken, countermeasures_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exposureData.id,
        exposureData.player_id,
        exposureData.hazard_id,
        exposureData.hazard_type,
        exposureData.sector_x,
        exposureData.sector_y,
        exposureData.exposure_start,
        exposureData.exposure_end || null,
        exposureData.total_exposure_time || 0,
        exposureData.max_intensity || 0,
        exposureData.damage_taken || 0,
        JSON.stringify(exposureData.countermeasures_active || [])
      ]
    );
  }

  /**
   * Update hazard exposure
   */
  async updateHazardExposure(exposureId, updateData) {
    const updates = [];
    const values = [];

    if (updateData.exposure_end !== undefined) {
      updates.push('exposure_end = ?');
      values.push(updateData.exposure_end);
    }
    if (updateData.total_exposure_time !== undefined) {
      updates.push('total_exposure_time = ?');
      values.push(updateData.total_exposure_time);
    }
    if (updateData.max_intensity !== undefined) {
      updates.push('max_intensity = ?');
      values.push(updateData.max_intensity);
    }
    if (updateData.damage_taken !== undefined) {
      updates.push('damage_taken = ?');
      values.push(updateData.damage_taken);
    }

    if (updates.length > 0) {
      values.push(exposureId);
      await this.run(
        `UPDATE hazard_exposure_history SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  /**
   * Get player hazard exposure history
   */
  async getPlayerHazardExposure(playerId, hazardType = null, limit = 50) {
    let sql = `SELECT * FROM hazard_exposure_history WHERE player_id = ?`;
    let params = [playerId];

    if (hazardType) {
      sql += ' AND hazard_type = ?';
      params.push(hazardType);
    }

    sql += ' ORDER BY exposure_start DESC LIMIT ?';
    params.push(limit);

    const exposures = await this.all(sql, params);
    
    // Parse JSON fields
    return exposures.map(exposure => ({
      ...exposure,
      countermeasures_active: JSON.parse(exposure.countermeasures_active || '[]')
    }));
  }

  /**
   * Create dynamic hazard event
   */
  async createDynamicHazardEvent(eventData) {
    await this.run(
      `INSERT INTO dynamic_hazard_events 
       (id, event_type, event_name, center_sector_x, center_sector_y, 
        affected_radius, intensity, created_at, expires_at, event_data, affected_sectors) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventData.id,
        eventData.event_type,
        eventData.event_name,
        eventData.center_sector_x,
        eventData.center_sector_y,
        eventData.affected_radius,
        eventData.intensity,
        eventData.created_at,
        eventData.expires_at,
        JSON.stringify(eventData.event_data || {}),
        JSON.stringify(eventData.affected_sectors || [])
      ]
    );
  }

  /**
   * Get active dynamic hazard events
   */
  async getActiveDynamicEvents() {
    const events = await this.all(
      'SELECT * FROM dynamic_hazard_events WHERE is_active = 1 AND expires_at > ?',
      [Date.now()]
    );

    // Parse JSON fields
    return events.map(event => ({
      ...event,
      event_data: JSON.parse(event.event_data || '{}'),
      affected_sectors: JSON.parse(event.affected_sectors || '[]')
    }));
  }

  /**
   * Expire dynamic hazard event
   */
  async expireDynamicEvent(eventId) {
    await this.run(
      'UPDATE dynamic_hazard_events SET is_active = 0 WHERE id = ?',
      [eventId]
    );
  }

  /**
   * Record player warning
   */
  async recordPlayerWarning(warningData) {
    await this.run(
      `INSERT INTO player_warning_history 
       (player_id, warning_type, hazard_id, sector_x, sector_y, warning_level, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        warningData.player_id,
        warningData.warning_type,
        warningData.hazard_id || null,
        warningData.sector_x || null,
        warningData.sector_y || null,
        warningData.warning_level,
        warningData.created_at || Date.now()
      ]
    );
  }

  /**
   * Acknowledge player warning
   */
  async acknowledgePlayerWarning(playerId, warningId) {
    await this.run(
      'UPDATE player_warning_history SET acknowledged = 1, acknowledged_at = ? WHERE id = ? AND player_id = ?',
      [Date.now(), warningId, playerId]
    );
  }

  /**
   * Get player warning history
   */
  async getPlayerWarningHistory(playerId, limit = 100) {
    return await this.all(
      'SELECT * FROM player_warning_history WHERE player_id = ? ORDER BY created_at DESC LIMIT ?',
      [playerId, limit]
    );
  }

  /**
   * Update countermeasure research
   */
  async updateCountermeasureResearch(playerId, countermeasureId, progress, pointsInvested) {
    const existing = await this.get(
      'SELECT * FROM countermeasure_research WHERE player_id = ? AND countermeasure_id = ?',
      [playerId, countermeasureId]
    );

    if (existing) {
      await this.run(
        `UPDATE countermeasure_research 
         SET research_progress = ?, research_points_invested = ?, 
             is_unlocked = CASE WHEN research_progress >= 1.0 THEN 1 ELSE is_unlocked END,
             unlocked_at = CASE WHEN research_progress >= 1.0 AND unlocked_at IS NULL THEN ? ELSE unlocked_at END
         WHERE player_id = ? AND countermeasure_id = ?`,
        [progress, pointsInvested, Date.now(), playerId, countermeasureId]
      );
    } else {
      await this.run(
        `INSERT INTO countermeasure_research 
         (player_id, countermeasure_id, research_progress, research_points_invested, is_unlocked, unlocked_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          playerId, 
          countermeasureId, 
          progress, 
          pointsInvested,
          progress >= 1.0 ? 1 : 0,
          progress >= 1.0 ? Date.now() : null
        ]
      );
    }
  }

  /**
   * Get player countermeasure research
   */
  async getPlayerCountermeasureResearch(playerId) {
    return await this.all(
      'SELECT * FROM countermeasure_research WHERE player_id = ?',
      [playerId]
    );
  }

  /**
   * Save sector hazard generation pattern
   */
  async saveSectorHazardPattern(patternData) {
    await this.run(
      `INSERT OR REPLACE INTO sector_hazard_patterns 
       (sector_x, sector_y, biome_type, generation_seed, last_generated, 
        hazard_count, generation_method, pattern_data, special_rules) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patternData.sector_x,
        patternData.sector_y,
        patternData.biome_type,
        patternData.generation_seed,
        patternData.last_generated,
        patternData.hazard_count,
        patternData.generation_method || 'procedural',
        JSON.stringify(patternData.pattern_data || {}),
        JSON.stringify(patternData.special_rules || [])
      ]
    );
  }

  /**
   * Get sector hazard pattern
   */
  async getSectorHazardPattern(sectorX, sectorY) {
    const pattern = await this.get(
      'SELECT * FROM sector_hazard_patterns WHERE sector_x = ? AND sector_y = ?',
      [sectorX, sectorY]
    );

    if (pattern) {
      return {
        ...pattern,
        pattern_data: JSON.parse(pattern.pattern_data || '{}'),
        special_rules: JSON.parse(pattern.special_rules || '[]')
      };
    }

    return null;
  }

  /**
   * Update player hazard statistics
   */
  async updatePlayerHazardStats(playerId, statsUpdate) {
    const existing = await this.get(
      'SELECT * FROM player_hazard_stats WHERE player_id = ?',
      [playerId]
    );

    const stats = existing || {};

    // Merge in updates
    Object.entries(statsUpdate).forEach(([key, value]) => {
      if (typeof value === 'number') {
        stats[key] = (stats[key] || 0) + value;
      } else {
        stats[key] = value;
      }
    });

    if (existing) {
      const updates = [];
      const values = [];

      Object.entries(statsUpdate).forEach(([key, value]) => {
        updates.push(`${key} = ?`);
        values.push(stats[key]);
      });

      values.push(playerId);
      await this.run(
        `UPDATE player_hazard_stats SET ${updates.join(', ')} WHERE player_id = ?`,
        values
      );
    } else {
      await this.run(
        `INSERT INTO player_hazard_stats 
         (player_id, total_hazards_encountered, total_exposure_time, total_damage_from_hazards,
          hazards_survived, countermeasures_deployed, systems_repaired, critical_warnings_received,
          temporal_displacements, wormhole_transits, asteroid_collisions_avoided, 
          radiation_exposure_total, most_dangerous_hazard, longest_exposure_time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          playerId,
          stats.total_hazards_encountered || 0,
          stats.total_exposure_time || 0,
          stats.total_damage_from_hazards || 0,
          stats.hazards_survived || 0,
          stats.countermeasures_deployed || 0,
          stats.systems_repaired || 0,
          stats.critical_warnings_received || 0,
          stats.temporal_displacements || 0,
          stats.wormhole_transits || 0,
          stats.asteroid_collisions_avoided || 0,
          stats.radiation_exposure_total || 0,
          stats.most_dangerous_hazard || null,
          stats.longest_exposure_time || 0
        ]
      );
    }
  }

  /**
   * Get player hazard statistics
   */
  async getPlayerHazardStats(playerId) {
    return await this.get(
      'SELECT * FROM player_hazard_stats WHERE player_id = ?',
      [playerId]
    );
  }

  /**
   * Get hazard system statistics
   */
  async getHazardSystemStats() {
    const totalHazards = await this.get('SELECT COUNT(*) as count FROM sector_hazards');
    const activeHazards = await this.get('SELECT COUNT(*) as count FROM sector_hazards WHERE expires_at IS NULL OR expires_at > ?', [Date.now()]);
    const totalExposures = await this.get('SELECT COUNT(*) as count FROM hazard_exposure_history');
    const activeEvents = await this.get('SELECT COUNT(*) as count FROM dynamic_hazard_events WHERE is_active = 1');
    const totalWarnings = await this.get('SELECT COUNT(*) as count FROM player_warning_history');

    const hazardTypes = await this.all(
      'SELECT hazard_type, COUNT(*) as count FROM sector_hazards GROUP BY hazard_type ORDER BY count DESC'
    );

    const recentExposures = await this.all(
      `SELECT hazard_type, COUNT(*) as count 
       FROM hazard_exposure_history 
       WHERE exposure_start > ? 
       GROUP BY hazard_type`,
      [Date.now() - 86400000] // Last 24 hours
    );

    return {
      totalHazards: totalHazards.count,
      activeHazards: activeHazards.count,
      totalExposures: totalExposures.count,
      activeEvents: activeEvents.count,
      totalWarnings: totalWarnings.count,
      hazardTypes,
      recentExposures
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