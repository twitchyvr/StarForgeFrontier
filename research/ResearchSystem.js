/**
 * ResearchSystem.js
 * Comprehensive Research and Technology System for StarForgeFrontier
 * Implements tech trees, research projects, and technology unlocks
 */

const { v4: uuidv4 } = require('uuid');

class ResearchSystem {
  constructor(database, skillSystem, guildSystem) {
    this.database = database;
    this.skillSystem = skillSystem;
    this.guildSystem = guildSystem;
    this.initialized = false;
    
    // Research trees configuration
    this.researchTrees = {
      MILITARY: {
        name: 'Military Technology',
        description: 'Advanced weapons, armor, and combat systems',
        color: '#ff4757',
        icon: '⚔️',
        baseResearchRate: 1.0,
        skillBonus: 'combat'
      },
      ENGINEERING: {
        name: 'Engineering Sciences',
        description: 'Ship systems, modules, and infrastructure',
        color: '#3742fa',
        icon: '⚙️',
        baseResearchRate: 1.2,
        skillBonus: 'engineering'
      },
      SCIENCE: {
        name: 'Scientific Research',
        description: 'Sensors, analysis, and exploration technology',
        color: '#2ed573',
        icon: '🔬',
        baseResearchRate: 1.1,
        skillBonus: 'exploration'
      },
      COMMERCE: {
        name: 'Commercial Technology',
        description: 'Trading, logistics, and economic systems',
        color: '#ffa502',
        icon: '💰',
        baseResearchRate: 0.9,
        skillBonus: 'trading'
      }
    };

    // Technology definitions
    this.technologies = this.initializeTechnologies();
    
    // Active research projects
    this.activeProjects = new Map();
    
    // Research point generation rates
    this.researchPointSources = {
      EXPLORATION: { baseRate: 2, description: 'Sector exploration and discovery' },
      TRADING: { baseRate: 1, description: 'Trading and commerce activities' },
      COMBAT: { baseRate: 3, description: 'Combat encounters and victories' },
      MINING: { baseRate: 1.5, description: 'Resource collection and analysis' },
      LABORATORY: { baseRate: 5, description: 'Research laboratory operations' },
      COLLABORATION: { baseRate: 10, description: 'Guild research collaboration' }
    };
  }

  /**
   * Initialize all technology definitions for the research trees
   */
  initializeTechnologies() {
    return {
      // === MILITARY TECHNOLOGY TREE ===
      MILITARY: {
        // Tier 1 - Basic Military
        BASIC_WEAPONS: {
          id: 'BASIC_WEAPONS',
          name: 'Basic Weaponry',
          description: 'Fundamental weapon systems and targeting',
          tier: 1,
          tree: 'MILITARY',
          researchCost: 100,
          researchTime: 3600000, // 1 hour in milliseconds
          prerequisites: [],
          unlocks: ['weapon_laser_mk1', 'targeting_computer_basic'],
          effects: {
            weaponDamage: 0.1, // +10% weapon damage
            weaponAccuracy: 0.05 // +5% accuracy
          },
          blueprints: [
            { type: 'weapon', name: 'Laser Cannon MK-I', stats: { damage: 30, range: 12, powerConsumption: 15 } }
          ]
        },
        ARMOR_TECH: {
          id: 'ARMOR_TECH',
          name: 'Armor Technology',
          description: 'Advanced hull plating and defensive systems',
          tier: 1,
          tree: 'MILITARY',
          researchCost: 120,
          researchTime: 4200000, // 1.2 hours
          prerequisites: [],
          unlocks: ['armor_plating_basic', 'shield_generator_mk1'],
          effects: {
            hullStrength: 0.15, // +15% hull strength
            shieldRegenRate: 0.1 // +10% shield regeneration
          },
          blueprints: [
            { type: 'defense', name: 'Reinforced Hull Plating', stats: { health: 150, resistance: 0.05 } }
          ]
        },
        
        // Tier 2 - Advanced Military
        ADVANCED_WEAPONS: {
          id: 'ADVANCED_WEAPONS',
          name: 'Advanced Weaponry',
          description: 'High-energy weapons and targeting systems',
          tier: 2,
          tree: 'MILITARY',
          researchCost: 300,
          researchTime: 7200000, // 2 hours
          prerequisites: ['BASIC_WEAPONS'],
          unlocks: ['weapon_plasma_mk1', 'targeting_advanced'],
          effects: {
            weaponDamage: 0.2,
            weaponRange: 0.15,
            criticalChance: 0.05
          },
          blueprints: [
            { type: 'weapon', name: 'Plasma Cannon MK-I', stats: { damage: 65, range: 18, powerConsumption: 35, areaEffect: true } }
          ]
        },
        SHIELD_SYSTEMS: {
          id: 'SHIELD_SYSTEMS',
          name: 'Shield Systems',
          description: 'Energy shields and defensive matrices',
          tier: 2,
          tree: 'MILITARY',
          researchCost: 280,
          researchTime: 6900000,
          prerequisites: ['ARMOR_TECH'],
          unlocks: ['shield_generator_mk2', 'defense_matrix'],
          effects: {
            shieldCapacity: 0.25,
            shieldRegenRate: 0.2,
            damageReduction: 0.1
          },
          blueprints: [
            { type: 'defense', name: 'Energy Shield Generator MK-II', stats: { shieldCapacity: 300, regenRate: 15 } }
          ]
        },

        // Tier 3 - Elite Military
        PARTICLE_WEAPONS: {
          id: 'PARTICLE_WEAPONS',
          name: 'Particle Beam Weapons',
          description: 'Cutting-edge particle acceleration technology',
          tier: 3,
          tree: 'MILITARY',
          researchCost: 800,
          researchTime: 18000000, // 5 hours
          prerequisites: ['ADVANCED_WEAPONS', 'SHIELD_SYSTEMS'],
          unlocks: ['weapon_particle_beam', 'quantum_targeting'],
          effects: {
            weaponDamage: 0.4,
            armorPenetration: 0.3,
            energyEfficiency: 0.15
          },
          blueprints: [
            { type: 'weapon', name: 'Particle Beam Cannon', stats: { damage: 120, range: 25, piercing: true, powerConsumption: 60 } }
          ]
        }
      },

      // === ENGINEERING TECHNOLOGY TREE ===
      ENGINEERING: {
        // Tier 1 - Basic Engineering
        PROPULSION_SYSTEMS: {
          id: 'PROPULSION_SYSTEMS',
          name: 'Advanced Propulsion',
          description: 'Improved engine efficiency and thrust systems',
          tier: 1,
          tree: 'ENGINEERING',
          researchCost: 150,
          researchTime: 5400000, // 1.5 hours
          prerequisites: [],
          unlocks: ['engine_ion_mk1', 'thruster_vectored'],
          effects: {
            shipSpeed: 0.2, // +20% ship speed
            fuelEfficiency: 0.15, // +15% fuel efficiency
            maneuverability: 0.1 // +10% maneuverability
          },
          blueprints: [
            { type: 'propulsion', name: 'Ion Engine MK-I', stats: { thrust: 150, efficiency: 0.85, powerConsumption: 25 } }
          ]
        },
        POWER_SYSTEMS: {
          id: 'POWER_SYSTEMS',
          name: 'Power Generation',
          description: 'Advanced reactors and power distribution',
          tier: 1,
          tree: 'ENGINEERING',
          researchCost: 180,
          researchTime: 5000000,
          prerequisites: [],
          unlocks: ['reactor_fusion_mk1', 'power_conduit_advanced'],
          effects: {
            powerGeneration: 0.25,
            powerEfficiency: 0.15,
            systemReliability: 0.1
          },
          blueprints: [
            { type: 'power', name: 'Fusion Reactor MK-I', stats: { powerOutput: 1500, efficiency: 0.9, mass: 200 } }
          ]
        },

        // Tier 2 - Advanced Engineering
        WARP_TECHNOLOGY: {
          id: 'WARP_TECHNOLOGY',
          name: 'Warp Drive Technology',
          description: 'Faster-than-light travel capabilities',
          tier: 2,
          tree: 'ENGINEERING',
          researchCost: 500,
          researchTime: 10800000, // 3 hours
          prerequisites: ['PROPULSION_SYSTEMS', 'POWER_SYSTEMS'],
          unlocks: ['warp_drive_mk1', 'navigation_quantum'],
          effects: {
            warpSpeed: 0.3,
            warpEfficiency: 0.2,
            maxWarpDistance: 0.25
          },
          blueprints: [
            { type: 'propulsion', name: 'Quantum Warp Drive MK-I', stats: { warpFactor: 2.5, fuelConsumption: 75, range: 15 } }
          ]
        },
        MINING_TECHNOLOGY: {
          id: 'MINING_TECHNOLOGY',
          name: 'Advanced Mining',
          description: 'Automated mining and resource processing',
          tier: 2,
          tree: 'ENGINEERING',
          researchCost: 350,
          researchTime: 8400000,
          prerequisites: ['POWER_SYSTEMS'],
          unlocks: ['mining_laser_advanced', 'processor_automated'],
          effects: {
            miningEfficiency: 0.4,
            cargoCapacity: 0.2,
            processingSpeed: 0.3
          },
          blueprints: [
            { type: 'utility', name: 'Quantum Mining Laser', stats: { efficiency: 1.8, range: 20, processingRate: 150 } }
          ]
        },

        // Tier 3 - Quantum Engineering
        QUANTUM_SYSTEMS: {
          id: 'QUANTUM_SYSTEMS',
          name: 'Quantum Engineering',
          description: 'Quantum mechanics applications in ship systems',
          tier: 3,
          tree: 'ENGINEERING',
          researchCost: 1200,
          researchTime: 25200000, // 7 hours
          prerequisites: ['WARP_TECHNOLOGY', 'MINING_TECHNOLOGY'],
          unlocks: ['quantum_computer', 'quantum_sensors'],
          effects: {
            systemEfficiency: 0.5,
            quantumEntanglement: true,
            multidimensionalAccess: true
          },
          blueprints: [
            { type: 'utility', name: 'Quantum Computer Core', stats: { processingPower: 10000, quantumStates: 64, reliability: 0.99 } }
          ]
        }
      },

      // === SCIENCE TECHNOLOGY TREE ===
      SCIENCE: {
        // Tier 1 - Basic Science
        SENSOR_TECHNOLOGY: {
          id: 'SENSOR_TECHNOLOGY',
          name: 'Advanced Sensors',
          description: 'Long-range detection and analysis systems',
          tier: 1,
          tree: 'SCIENCE',
          researchCost: 120,
          researchTime: 4500000,
          prerequisites: [],
          unlocks: ['sensor_array_mk1', 'scanner_deep_space'],
          effects: {
            detectionRange: 0.5, // +50% detection range
            scanAccuracy: 0.3, // +30% scan accuracy
            hazardDetection: 0.4 // +40% hazard detection
          },
          blueprints: [
            { type: 'utility', name: 'Deep Space Sensor Array', stats: { range: 100, accuracy: 0.9, powerConsumption: 20 } }
          ]
        },
        RESEARCH_METHODS: {
          id: 'RESEARCH_METHODS',
          name: 'Research Methodology',
          description: 'Improved research techniques and data analysis',
          tier: 1,
          tree: 'SCIENCE',
          researchCost: 100,
          researchTime: 3600000,
          prerequisites: [],
          unlocks: ['laboratory_basic', 'data_processor_mk1'],
          effects: {
            researchSpeed: 0.2, // +20% research speed
            dataAnalysis: 0.25, // +25% data analysis efficiency
            experimentSuccess: 0.15 // +15% experiment success rate
          },
          blueprints: [
            { type: 'facility', name: 'Research Laboratory', stats: { researchBonus: 0.3, capacity: 5, automation: 0.2 } }
          ]
        },

        // Tier 2 - Advanced Science
        XENOBIOLOGY: {
          id: 'XENOBIOLOGY',
          name: 'Xenobiology Research',
          description: 'Study of alien life forms and ecosystems',
          tier: 2,
          tree: 'SCIENCE',
          researchCost: 400,
          researchTime: 9000000, // 2.5 hours
          prerequisites: ['SENSOR_TECHNOLOGY', 'RESEARCH_METHODS'],
          unlocks: ['bio_scanner_mk1', 'habitat_analyzer'],
          effects: {
            biologicalDetection: 0.6,
            alienTechAnalysis: 0.3,
            ecosystemUnderstanding: 0.4
          },
          blueprints: [
            { type: 'utility', name: 'Xenobiological Scanner', stats: { bioDetection: 0.95, speciesDatabase: 1000, analysisSpeed: 50 } }
          ]
        },
        ASTROPHYSICS: {
          id: 'ASTROPHYSICS',
          name: 'Advanced Astrophysics',
          description: 'Deep space phenomena and stellar mechanics',
          tier: 2,
          tree: 'SCIENCE',
          researchCost: 450,
          researchTime: 10800000, // 3 hours
          prerequisites: ['SENSOR_TECHNOLOGY'],
          unlocks: ['stellar_cartography', 'gravity_detector'],
          effects: {
            stellarNavigation: 0.4,
            gravityManipulation: 0.2,
            cosmicPhenomenaUnderstanding: 0.5
          },
          blueprints: [
            { type: 'utility', name: 'Stellar Cartography System', stats: { mappingRange: 1000, accuracy: 0.98, updateRate: 1 } }
          ]
        },

        // Tier 3 - Theoretical Science
        DIMENSIONAL_PHYSICS: {
          id: 'DIMENSIONAL_PHYSICS',
          name: 'Dimensional Physics',
          description: 'Understanding of multidimensional space and time',
          tier: 3,
          tree: 'SCIENCE',
          researchCost: 1000,
          researchTime: 21600000, // 6 hours
          prerequisites: ['XENOBIOLOGY', 'ASTROPHYSICS'],
          unlocks: ['dimensional_scanner', 'spacetime_manipulator'],
          effects: {
            dimensionalDetection: true,
            timeDistortionResistance: 0.8,
            interdimensionalTravel: true
          },
          blueprints: [
            { type: 'utility', name: 'Dimensional Scanner Array', stats: { dimensions: 11, resolution: 0.001, stability: 0.95 } }
          ]
        }
      },

      // === COMMERCE TECHNOLOGY TREE ===
      COMMERCE: {
        // Tier 1 - Basic Commerce
        LOGISTICS_SYSTEMS: {
          id: 'LOGISTICS_SYSTEMS',
          name: 'Logistics Networks',
          description: 'Automated cargo and supply chain management',
          tier: 1,
          tree: 'COMMERCE',
          researchCost: 80,
          researchTime: 3000000,
          prerequisites: [],
          unlocks: ['cargo_optimizer', 'trade_analyzer'],
          effects: {
            cargoEfficiency: 0.3, // +30% cargo efficiency
            tradeProfits: 0.15, // +15% trade profits
            logisticsSpeed: 0.2 // +20% logistics speed
          },
          blueprints: [
            { type: 'utility', name: 'Automated Cargo System', stats: { efficiency: 1.4, capacity: 2000, sortingSpeed: 100 } }
          ]
        },
        MARKET_ANALYSIS: {
          id: 'MARKET_ANALYSIS',
          name: 'Market Analysis',
          description: 'Advanced economic modeling and prediction',
          tier: 1,
          tree: 'COMMERCE',
          researchCost: 90,
          researchTime: 3300000,
          prerequisites: [],
          unlocks: ['price_predictor', 'demand_analyzer'],
          effects: {
            priceAccuracy: 0.4, // +40% price prediction accuracy
            marketInsight: 0.3, // +30% market insight
            contractSuccess: 0.2 // +20% contract success rate
          },
          blueprints: [
            { type: 'utility', name: 'Market Analysis Computer', stats: { predictionAccuracy: 0.85, dataPoints: 10000, updateRate: 5 } }
          ]
        },

        // Tier 2 - Advanced Commerce
        BANKING_SYSTEMS: {
          id: 'BANKING_SYSTEMS',
          name: 'Galactic Banking',
          description: 'Secure financial networks and credit systems',
          tier: 2,
          tree: 'COMMERCE',
          researchCost: 350,
          researchTime: 8100000,
          prerequisites: ['LOGISTICS_SYSTEMS', 'MARKET_ANALYSIS'],
          unlocks: ['credit_system', 'secure_transactions'],
          effects: {
            transactionSecurity: 0.5,
            creditAccess: 0.4,
            interestRates: -0.2 // -20% better interest rates
          },
          blueprints: [
            { type: 'utility', name: 'Quantum Encryption Bank Terminal', stats: { security: 0.999, transactionSpeed: 1000, creditLimit: 1000000 } }
          ]
        },
        MANUFACTURING: {
          id: 'MANUFACTURING',
          name: 'Automated Manufacturing',
          description: 'Robotic assembly and quality control systems',
          tier: 2,
          tree: 'COMMERCE',
          researchCost: 400,
          researchTime: 9000000,
          prerequisites: ['LOGISTICS_SYSTEMS'],
          unlocks: ['fabricator_mk1', 'quality_control'],
          effects: {
            productionSpeed: 0.6,
            qualityControl: 0.3,
            resourceEfficiency: 0.25
          },
          blueprints: [
            { type: 'facility', name: 'Automated Fabricator', stats: { productionRate: 200, qualityRating: 0.95, energyEfficiency: 0.8 } }
          ]
        },

        // Tier 3 - Economic Dominance
        CORPORATE_NETWORKS: {
          id: 'CORPORATE_NETWORKS',
          name: 'Corporate Networks',
          description: 'Galaxy-spanning business and trade empires',
          tier: 3,
          tree: 'COMMERCE',
          researchCost: 900,
          researchTime: 18000000, // 5 hours
          prerequisites: ['BANKING_SYSTEMS', 'MANUFACTURING'],
          unlocks: ['corporate_hq', 'trade_monopoly'],
          effects: {
            tradeNetworkAccess: true,
            monopolyPower: 0.3,
            economicInfluence: 0.5
          },
          blueprints: [
            { type: 'facility', name: 'Corporate Headquarters', stats: { networkRange: 100, tradeBonus: 0.5, employees: 10000 } }
          ]
        }
      }
    };
  }

  /**
   * Initialize the research system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('Initializing Research System...');
      
      // Create database tables for research system
      await this.createDatabaseTables();
      
      // Load active research projects
      await this.loadActiveProjects();
      
      // Start research processing timer
      this.startResearchProcessing();
      
      this.initialized = true;
      console.log('Research System initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Research System:', error);
      throw error;
    }
  }

  /**
   * Create database tables for research system
   */
  async createDatabaseTables() {
    const tables = [
      // Research trees and technology definitions
      `CREATE TABLE IF NOT EXISTS research_technologies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        tree TEXT NOT NULL,
        tier INTEGER NOT NULL,
        research_cost INTEGER NOT NULL,
        research_time INTEGER NOT NULL,
        prerequisites TEXT NOT NULL, -- JSON array
        unlocks TEXT NOT NULL, -- JSON array
        effects TEXT NOT NULL, -- JSON object
        blueprints TEXT NOT NULL, -- JSON array
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Player research progress and unlocks
      `CREATE TABLE IF NOT EXISTS player_research (
        player_id TEXT NOT NULL,
        technology_id TEXT NOT NULL,
        research_progress REAL DEFAULT 0.0,
        research_points_invested INTEGER DEFAULT 0,
        is_unlocked BOOLEAN DEFAULT 0,
        unlocked_at DATETIME,
        research_level INTEGER DEFAULT 0,
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
        start_time INTEGER NOT NULL,
        estimated_completion INTEGER NOT NULL,
        actual_completion INTEGER,
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
        research_bonus REAL DEFAULT 1.0,
        capacity INTEGER DEFAULT 1, -- Number of simultaneous projects
        power_consumption INTEGER DEFAULT 100,
        maintenance_cost INTEGER DEFAULT 50,
        is_active BOOLEAN DEFAULT 1,
        construction_progress REAL DEFAULT 1.0,
        last_maintenance DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        start_time INTEGER,
        completion_time INTEGER,
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
        event_type TEXT NOT NULL, -- 'RESEARCH_COMPLETED', 'COLLABORATION_JOINED', 'BREAKTHROUGH', 'FAILURE'
        technology_id TEXT,
        event_data TEXT, -- JSON object with event-specific data
        research_points_awarded INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (guild_id) REFERENCES guilds (id)
      )`
    ];

    for (const sql of tables) {
      await this.database.run(sql);
    }

    console.log('Research system database tables created successfully');
  }

  /**
   * Load active research projects from database
   */
  async loadActiveProjects() {
    const projects = await this.database.all(
      `SELECT * FROM research_projects WHERE status = 'ACTIVE'`
    );

    for (const project of projects) {
      this.activeProjects.set(project.id, {
        ...project,
        contributors: JSON.parse(project.contributors || '[]'),
        bonusFactors: JSON.parse(project.bonus_factors || '{}')
      });
    }

    console.log(`Loaded ${projects.length} active research projects`);
  }

  /**
   * Start research processing timer
   */
  startResearchProcessing() {
    // Process research progress every minute
    this.researchTimer = setInterval(() => {
      this.processResearchProgress();
    }, 60000); // 60 seconds

    console.log('Research processing timer started');
  }

  /**
   * Process research progress for all active projects
   */
  async processResearchProgress() {
    const currentTime = Date.now();
    const completedProjects = [];

    for (const [projectId, project] of this.activeProjects) {
      try {
        // Check if project should be completed
        if (currentTime >= project.estimated_completion) {
          await this.completeResearchProject(projectId);
          completedProjects.push(projectId);
          continue;
        }

        // Update project progress
        const elapsedTime = currentTime - project.start_time;
        const totalTime = project.estimated_completion - project.start_time;
        const progress = Math.min(elapsedTime / totalTime, 1.0);

        // Update database with current progress
        await this.database.run(
          `UPDATE research_projects 
           SET updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [projectId]
        );

      } catch (error) {
        console.error(`Error processing research project ${projectId}:`, error);
      }
    }

    // Remove completed projects from active projects map
    completedProjects.forEach(projectId => {
      this.activeProjects.delete(projectId);
    });

    if (completedProjects.length > 0) {
      console.log(`Completed ${completedProjects.length} research projects`);
    }
  }

  /**
   * Get player's current research points
   */
  async getPlayerResearchPoints(playerId) {
    const points = await this.database.get(
      'SELECT * FROM player_research_points WHERE player_id = ?',
      [playerId]
    );

    if (!points) {
      // Initialize research points for new player
      await this.database.run(
        `INSERT INTO player_research_points (player_id) VALUES (?)`,
        [playerId]
      );
      
      return {
        player_id: playerId,
        military_points: 0,
        engineering_points: 0,
        science_points: 0,
        commerce_points: 0,
        total_points_earned: 0,
        total_points_spent: 0,
        generation_rate: '{}'
      };
    }

    return points;
  }

  /**
   * Award research points to player
   */
  async awardResearchPoints(playerId, pointsData, source = 'UNKNOWN') {
    const currentPoints = await this.getPlayerResearchPoints(playerId);
    
    const updates = [];
    const values = [];
    let totalAwarded = 0;

    // Update specific research point types
    if (pointsData.military) {
      updates.push('military_points = military_points + ?');
      values.push(pointsData.military);
      totalAwarded += pointsData.military;
    }
    if (pointsData.engineering) {
      updates.push('engineering_points = engineering_points + ?');
      values.push(pointsData.engineering);
      totalAwarded += pointsData.engineering;
    }
    if (pointsData.science) {
      updates.push('science_points = science_points + ?');
      values.push(pointsData.science);
      totalAwarded += pointsData.science;
    }
    if (pointsData.commerce) {
      updates.push('commerce_points = commerce_points + ?');
      values.push(pointsData.commerce);
      totalAwarded += pointsData.commerce;
    }

    if (updates.length === 0) return false;

    updates.push('total_points_earned = total_points_earned + ?');
    updates.push('last_updated = CURRENT_TIMESTAMP');
    values.push(totalAwarded);
    values.push(playerId);

    await this.database.run(
      `UPDATE player_research_points 
       SET ${updates.join(', ')} 
       WHERE player_id = ?`,
      values
    );

    // Record research event
    await this.database.run(
      `INSERT INTO research_events 
       (id, player_id, event_type, event_data, research_points_awarded) 
       VALUES (?, ?, 'POINTS_AWARDED', ?, ?)`,
      [
        uuidv4(),
        playerId,
        JSON.stringify({ source, points: pointsData }),
        totalAwarded
      ]
    );

    console.log(`Awarded ${totalAwarded} research points to player ${playerId} from ${source}`);
    return true;
  }

  /**
   * Start a new research project
   */
  async startResearchProject(playerId, technologyId, projectType = 'INDIVIDUAL', guildId = null) {
    const technology = this.getTechnology(technologyId);
    if (!technology) {
      throw new Error(`Technology ${technologyId} not found`);
    }

    // Check if player has met prerequisites
    const hasPrerequisites = await this.checkPrerequisites(playerId, technology.prerequisites);
    if (!hasPrerequisites) {
      throw new Error('Prerequisites not met for this technology');
    }

    // Check if player has sufficient research points
    const playerPoints = await this.getPlayerResearchPoints(playerId);
    const requiredPoints = this.getRequiredPoints(technology, playerPoints);
    
    if (requiredPoints > this.getAvailablePoints(playerPoints, technology.tree)) {
      throw new Error('Insufficient research points');
    }

    // Calculate research time with bonuses
    const researchTime = await this.calculateResearchTime(playerId, technology, guildId);
    const startTime = Date.now();
    const estimatedCompletion = startTime + researchTime;

    const projectId = uuidv4();
    const projectData = {
      id: projectId,
      player_id: playerId,
      guild_id: guildId,
      technology_id: technologyId,
      project_type: projectType,
      research_points_allocated: requiredPoints,
      start_time: startTime,
      estimated_completion: estimatedCompletion,
      status: 'ACTIVE',
      contributors: projectType === 'GUILD_COLLABORATION' ? [playerId] : [],
      bonus_factors: await this.calculateResearchBonuses(playerId, technology, guildId)
    };

    // Save to database
    await this.database.run(
      `INSERT INTO research_projects 
       (id, player_id, guild_id, technology_id, project_type, research_points_allocated, 
        start_time, estimated_completion, status, contributors, bonus_factors) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        playerId,
        guildId,
        technologyId,
        projectType,
        requiredPoints,
        startTime,
        estimatedCompletion,
        'ACTIVE',
        JSON.stringify(projectData.contributors),
        JSON.stringify(projectData.bonus_factors)
      ]
    );

    // Deduct research points
    await this.spendResearchPoints(playerId, technology.tree, requiredPoints);

    // Add to active projects
    this.activeProjects.set(projectId, projectData);

    console.log(`Started research project ${projectId} for technology ${technologyId}`);
    return projectId;
  }

  /**
   * Complete a research project and unlock technology
   */
  async completeResearchProject(projectId) {
    const project = this.activeProjects.get(projectId);
    if (!project) {
      throw new Error(`Research project ${projectId} not found`);
    }

    const technology = this.getTechnology(project.technology_id);
    if (!technology) {
      throw new Error(`Technology ${project.technology_id} not found`);
    }

    const completionTime = Date.now();

    try {
      // Update project status
      await this.database.run(
        `UPDATE research_projects 
         SET status = 'COMPLETED', actual_completion = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [completionTime, projectId]
      );

      // Unlock technology for player
      await this.unlockTechnology(project.player_id, project.technology_id);

      // If it's a guild project, unlock for all contributors
      if (project.project_type === 'GUILD_COLLABORATION' && project.contributors.length > 0) {
        for (const contributorId of project.contributors) {
          await this.unlockTechnology(contributorId, project.technology_id);
        }
      }

      // Record completion event
      await this.database.run(
        `INSERT INTO research_events 
         (id, player_id, guild_id, event_type, technology_id, event_data) 
         VALUES (?, ?, ?, 'RESEARCH_COMPLETED', ?, ?)`,
        [
          uuidv4(),
          project.player_id,
          project.guild_id,
          project.technology_id,
          JSON.stringify({
            project_id: projectId,
            completion_time: completionTime,
            research_time: completionTime - project.start_time
          })
        ]
      );

      console.log(`Research project ${projectId} completed successfully`);
      return true;

    } catch (error) {
      console.error(`Error completing research project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Unlock a technology for a player
   */
  async unlockTechnology(playerId, technologyId) {
    const technology = this.getTechnology(technologyId);
    if (!technology) {
      throw new Error(`Technology ${technologyId} not found`);
    }

    // Check if already unlocked
    const existing = await this.database.get(
      'SELECT * FROM player_research WHERE player_id = ? AND technology_id = ?',
      [playerId, technologyId]
    );

    if (existing && existing.is_unlocked) {
      return false; // Already unlocked
    }

    const unlockTime = Date.now();

    if (existing) {
      // Update existing record
      await this.database.run(
        `UPDATE player_research 
         SET is_unlocked = 1, unlocked_at = ?, research_progress = 1.0 
         WHERE player_id = ? AND technology_id = ?`,
        [unlockTime, playerId, technologyId]
      );
    } else {
      // Insert new record
      await this.database.run(
        `INSERT INTO player_research 
         (player_id, technology_id, research_progress, is_unlocked, unlocked_at) 
         VALUES (?, ?, 1.0, 1, ?)`,
        [playerId, technologyId, unlockTime]
      );
    }

    // Create technology blueprints for player
    await this.createTechnologyBlueprints(technologyId);

    console.log(`Technology ${technologyId} unlocked for player ${playerId}`);
    return true;
  }

  /**
   * Create technology blueprints in the database
   */
  async createTechnologyBlueprints(technologyId) {
    const technology = this.getTechnology(technologyId);
    if (!technology || !technology.blueprints) return;

    for (const blueprint of technology.blueprints) {
      const blueprintId = uuidv4();
      
      await this.database.run(
        `INSERT OR IGNORE INTO technology_blueprints 
         (id, technology_id, blueprint_type, name, description, stats, crafting_requirements) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          blueprintId,
          technologyId,
          blueprint.type,
          blueprint.name,
          blueprint.description || `Advanced ${blueprint.type} technology`,
          JSON.stringify(blueprint.stats),
          JSON.stringify(blueprint.craftingRequirements || {})
        ]
      );
    }
  }

  /**
   * Get a technology by ID
   */
  getTechnology(technologyId) {
    for (const treeKey in this.technologies) {
      if (this.technologies[treeKey][technologyId]) {
        return this.technologies[treeKey][technologyId];
      }
    }
    return null;
  }

  /**
   * Check if player has met technology prerequisites
   */
  async checkPrerequisites(playerId, prerequisites) {
    if (!prerequisites || prerequisites.length === 0) return true;

    const playerResearch = await this.database.all(
      'SELECT technology_id FROM player_research WHERE player_id = ? AND is_unlocked = 1',
      [playerId]
    );

    const unlockedTechs = playerResearch.map(r => r.technology_id);
    
    return prerequisites.every(prereq => unlockedTechs.includes(prereq));
  }

  /**
   * Calculate research time with bonuses
   */
  async calculateResearchTime(playerId, technology, guildId = null) {
    let baseTime = technology.researchTime;
    let bonusMultiplier = 1.0;

    // Skill bonuses
    if (this.skillSystem) {
      const treeConfig = this.researchTrees[technology.tree];
      if (treeConfig.skillBonus) {
        const skillLevel = await this.skillSystem.getPlayerSkillLevel(playerId, treeConfig.skillBonus);
        bonusMultiplier *= Math.max(0.5, 1.0 - (skillLevel * 0.05)); // 5% faster per skill level, max 50% reduction
      }
    }

    // Laboratory bonuses
    const laboratories = await this.getPlayerLaboratories(playerId);
    for (const lab of laboratories) {
      if (lab.is_active && lab.specializations.includes(technology.tree)) {
        bonusMultiplier *= Math.max(0.3, 1.0 - lab.research_bonus);
      }
    }

    // Guild bonuses
    if (guildId && this.guildSystem) {
      const guild = await this.guildSystem.getGuild(guildId);
      if (guild && guild.active_perks.includes('RESEARCH_ACCELERATION')) {
        bonusMultiplier *= 0.8; // 20% faster research
      }
    }

    return Math.floor(baseTime * bonusMultiplier);
  }

  /**
   * Calculate research bonuses for a project
   */
  async calculateResearchBonuses(playerId, technology, guildId = null) {
    const bonuses = {};

    // Add skill bonuses
    const treeConfig = this.researchTrees[technology.tree];
    if (treeConfig.skillBonus && this.skillSystem) {
      const skillLevel = await this.skillSystem.getPlayerSkillLevel(playerId, treeConfig.skillBonus);
      bonuses.skillBonus = skillLevel * 0.05;
    }

    // Add laboratory bonuses
    const laboratories = await this.getPlayerLaboratories(playerId);
    bonuses.laboratoryBonus = laboratories
      .filter(lab => lab.is_active && lab.specializations.includes(technology.tree))
      .reduce((total, lab) => total + lab.research_bonus, 0);

    // Add guild bonuses
    if (guildId) {
      bonuses.guildBonus = 0.2; // Placeholder guild bonus
    }

    return bonuses;
  }

  /**
   * Get required research points for a technology
   */
  getRequiredPoints(technology, playerPoints) {
    // Base cost with potential reductions based on related research
    return technology.researchCost;
  }

  /**
   * Get available points for a specific research tree
   */
  getAvailablePoints(playerPoints, tree) {
    const treeKey = tree.toLowerCase() + '_points';
    return playerPoints[treeKey] || 0;
  }

  /**
   * Spend research points
   */
  async spendResearchPoints(playerId, tree, amount) {
    const treeKey = tree.toLowerCase() + '_points';
    
    await this.database.run(
      `UPDATE player_research_points 
       SET ${treeKey} = ${treeKey} - ?, total_points_spent = total_points_spent + ? 
       WHERE player_id = ?`,
      [amount, amount, playerId]
    );
  }

  /**
   * Get player's research laboratories
   */
  async getPlayerLaboratories(playerId) {
    const labs = await this.database.all(
      'SELECT * FROM research_laboratories WHERE player_id = ? AND is_active = 1',
      [playerId]
    );

    return labs.map(lab => ({
      ...lab,
      specializations: JSON.parse(lab.specializations || '[]')
    }));
  }

  /**
   * Get player's research progress
   */
  async getPlayerResearchProgress(playerId) {
    const research = await this.database.all(
      'SELECT * FROM player_research WHERE player_id = ?',
      [playerId]
    );

    const projects = await this.database.all(
      'SELECT * FROM research_projects WHERE player_id = ? ORDER BY start_time DESC LIMIT 10',
      [playerId]
    );

    const points = await this.getPlayerResearchPoints(playerId);

    return {
      unlockedTechnologies: research.filter(r => r.is_unlocked),
      inProgressResearch: research.filter(r => !r.is_unlocked && r.research_progress > 0),
      activeProjects: projects.filter(p => p.status === 'ACTIVE'),
      recentProjects: projects.filter(p => p.status === 'COMPLETED').slice(0, 5),
      researchPoints: points
    };
  }

  /**
   * Generate research points based on player activities
   */
  async generateResearchPointsFromActivity(playerId, activityType, activityData = {}) {
    const source = this.researchPointSources[activityType];
    if (!source) return;

    let pointsToAward = {};
    const baseRate = source.baseRate;

    // Calculate points based on activity type
    switch (activityType) {
      case 'EXPLORATION':
        pointsToAward = {
          science: Math.floor(baseRate * 2),
          engineering: Math.floor(baseRate * 1)
        };
        break;
      
      case 'COMBAT':
        pointsToAward = {
          military: Math.floor(baseRate * 2),
          engineering: Math.floor(baseRate * 0.5)
        };
        break;
      
      case 'TRADING':
        pointsToAward = {
          commerce: Math.floor(baseRate * 2),
          science: Math.floor(baseRate * 0.5)
        };
        break;
      
      case 'MINING':
        pointsToAward = {
          engineering: Math.floor(baseRate * 1.5),
          science: Math.floor(baseRate * 1)
        };
        break;
      
      case 'LABORATORY':
        // Laboratory points are distributed based on specializations
        pointsToAward = {
          military: Math.floor(baseRate * 1.25),
          engineering: Math.floor(baseRate * 1.25),
          science: Math.floor(baseRate * 1.25),
          commerce: Math.floor(baseRate * 1.25)
        };
        break;
    }

    if (Object.keys(pointsToAward).length > 0) {
      await this.awardResearchPoints(playerId, pointsToAward, activityType);
    }
  }

  /**
   * Get research system statistics
   */
  async getResearchSystemStats() {
    const totalProjects = await this.database.get('SELECT COUNT(*) as count FROM research_projects');
    const activeProjects = await this.database.get('SELECT COUNT(*) as count FROM research_projects WHERE status = "ACTIVE"');
    const completedProjects = await this.database.get('SELECT COUNT(*) as count FROM research_projects WHERE status = "COMPLETED"');
    const totalLaboratories = await this.database.get('SELECT COUNT(*) as count FROM research_laboratories WHERE is_active = 1');
    
    const technologyUnlocks = await this.database.all(
      'SELECT technology_id, COUNT(*) as unlock_count FROM player_research WHERE is_unlocked = 1 GROUP BY technology_id ORDER BY unlock_count DESC LIMIT 10'
    );

    const researchByTree = await this.database.all(
      `SELECT 
        SUBSTR(technology_id, 1, INSTR(technology_id || '_', '_') - 1) as tree,
        COUNT(*) as research_count 
      FROM player_research WHERE is_unlocked = 1 
      GROUP BY tree`
    );

    return {
      totalProjects: totalProjects.count,
      activeProjects: activeProjects.count,
      completedProjects: completedProjects.count,
      totalLaboratories: totalLaboratories.count,
      popularTechnologies: technologyUnlocks,
      researchDistribution: researchByTree
    };
  }

  /**
   * Shutdown the research system
   */
  shutdown() {
    if (this.researchTimer) {
      clearInterval(this.researchTimer);
      this.researchTimer = null;
    }
    
    this.activeProjects.clear();
    this.initialized = false;
    console.log('Research System shutdown complete');
  }
}

module.exports = ResearchSystem;