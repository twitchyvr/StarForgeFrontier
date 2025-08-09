/**
 * HazardSystem.js - Comprehensive environmental hazards system
 * Handles all aspects of environmental hazards in space exploration
 */

const { v4: uuidv4 } = require('uuid');

// Hazard type definitions with comprehensive properties
const HAZARD_TYPES = {
  ASTEROID_FIELD: {
    id: 'asteroid_field',
    name: 'Asteroid Field',
    description: 'Dense asteroid clusters that damage ships on collision',
    severity: 'medium',
    commonBiomes: ['ASTEROID_FIELD', 'ANCIENT_RUINS'],
    effects: {
      collision_damage: { min: 10, max: 50 },
      navigation_difficulty: 0.3,
      mining_bonus: 1.5
    },
    visualization: {
      color: '#8B7355',
      particles: 'asteroids',
      animation: 'rotating_debris'
    },
    audio: 'asteroid_ambient',
    duration: null, // Persistent
    countermeasures: ['enhanced_navigation', 'reinforced_hull']
  },

  SOLAR_FLARE: {
    id: 'solar_flare',
    name: 'Solar Flare',
    description: 'Electromagnetic radiation that disables electronics temporarily',
    severity: 'high',
    commonBiomes: ['STELLAR_NURSERY'],
    effects: {
      electronics_disable: { duration: 30000, chance: 0.8 }, // 30 seconds
      shield_drain: 0.5,
      communication_jamming: 0.9,
      energy_weapon_boost: 1.3
    },
    visualization: {
      color: '#FF4500',
      particles: 'electromagnetic_wave',
      animation: 'expanding_pulse'
    },
    audio: 'solar_flare_warning',
    duration: { min: 45000, max: 120000 }, // 45-120 seconds
    warning_time: 15000, // 15 second warning
    countermeasures: ['emp_shielding', 'backup_systems']
  },

  NEBULA_INTERFERENCE: {
    id: 'nebula_interference',
    name: 'Nebula Interference',
    description: 'Gas clouds that reduce visibility and sensor range',
    severity: 'low',
    commonBiomes: ['NEBULA'],
    effects: {
      visibility_reduction: 0.6,
      sensor_range_reduction: 0.7,
      warp_interference: 0.3,
      energy_regeneration: 1.2
    },
    visualization: {
      color: '#FF6B9D',
      particles: 'gas_clouds',
      animation: 'swirling_mist'
    },
    audio: 'nebula_static',
    duration: null, // Persistent in nebula sectors
    countermeasures: ['advanced_sensors', 'navigation_computer']
  },

  GRAVITATIONAL_ANOMALY: {
    id: 'gravitational_anomaly', 
    name: 'Gravitational Anomaly',
    description: 'Black hole gravity wells that pull ships and affect movement',
    severity: 'very_high',
    commonBiomes: ['BLACK_HOLE_REGION'],
    effects: {
      gravitational_pull: { strength: 0.8, radius: 300 },
      time_dilation: 0.95, // Slight time slowdown
      structural_stress: 2.0,
      exotic_matter_spawn: 0.3
    },
    visualization: {
      color: '#2C003E',
      particles: 'gravity_waves',
      animation: 'warping_space'
    },
    audio: 'gravity_distortion',
    duration: null, // Persistent
    countermeasures: ['gravity_compensators', 'structural_reinforcement']
  },

  MAGNETIC_STORM: {
    id: 'magnetic_storm',
    name: 'Magnetic Storm',
    description: 'Electromagnetic fields that interfere with navigation and systems',
    severity: 'medium',
    commonBiomes: ['STELLAR_NURSERY', 'BLACK_HOLE_REGION'],
    effects: {
      navigation_interference: 0.7,
      compass_deviation: { angle: 45, variance: 30 },
      electrical_damage: { chance: 0.2, damage: 15 },
      metal_ore_attraction: 2.0
    },
    visualization: {
      color: '#9370DB',
      particles: 'magnetic_field_lines',
      animation: 'pulsing_field'
    },
    audio: 'magnetic_interference',
    duration: { min: 60000, max: 180000 }, // 1-3 minutes
    warning_time: 20000, // 20 second warning
    countermeasures: ['magnetic_shielding', 'inertial_navigation']
  },

  COSMIC_RADIATION: {
    id: 'cosmic_radiation',
    name: 'Cosmic Radiation',
    description: 'High-energy particles that damage crew health and systems',
    severity: 'medium',
    commonBiomes: ['DEEP_SPACE', 'STELLAR_NURSERY'],
    effects: {
      crew_health_drain: { rate: 2, per_second: true }, // 2 health per second
      system_degradation: { rate: 0.1, systems: ['shields', 'life_support'] },
      mutation_chance: 0.01, // Rare beneficial effects
      radiation_sickness: { threshold: 100, duration: 300000 }
    },
    visualization: {
      color: '#00FF00',
      particles: 'radiation_particles',
      animation: 'particle_stream'
    },
    audio: 'radiation_warning',
    duration: { min: 120000, max: 300000 }, // 2-5 minutes
    warning_time: 30000, // 30 second warning
    countermeasures: ['radiation_shielding', 'medical_bay']
  },

  TEMPORAL_ANOMALY: {
    id: 'temporal_anomaly',
    name: 'Temporal Anomaly',
    description: 'Space-time distortions that cause unpredictable time effects',
    severity: 'extreme',
    commonBiomes: ['ANCIENT_RUINS', 'BLACK_HOLE_REGION'],
    effects: {
      time_acceleration: { factor: 0.5, duration: 30000 }, // Time moves slower
      time_deceleration: { factor: 2.0, duration: 30000 }, // Time moves faster
      temporal_displacement: { distance: 100, chance: 0.1 }, // Random teleport
      aging_effects: { crew: 0.1, equipment: 0.05 }
    },
    visualization: {
      color: '#00FFFF',
      particles: 'time_ripples',
      animation: 'reality_distortion'
    },
    audio: 'temporal_distortion',
    duration: { min: 30000, max: 90000 }, // 30-90 seconds
    warning_time: 10000, // 10 second warning
    countermeasures: ['temporal_stabilizers', 'chronometer_systems']
  },

  WORMHOLE: {
    id: 'wormhole',
    name: 'Wormhole',
    description: 'Space-time tunnels offering fast travel but with entry risks',
    severity: 'variable', // Depends on stability
    commonBiomes: ['DEEP_SPACE', 'BLACK_HOLE_REGION', 'ANCIENT_RUINS'],
    effects: {
      fast_travel: true,
      destination: null, // Set dynamically
      entry_damage: { chance: 0.3, damage: 25 },
      instability: 0.2, // Chance of malfunction
      exotic_radiation: 1.5
    },
    visualization: {
      color: '#00CED1',
      particles: 'wormhole_tunnel',
      animation: 'rotating_portal'
    },
    audio: 'wormhole_hum',
    duration: { min: 180000, max: 600000 }, // 3-10 minutes before collapse
    warning_time: 60000, // 1 minute warning before collapse
    countermeasures: ['wormhole_navigator', 'exotic_matter_stabilizer']
  }
};

// Hazard severity levels for balancing
const SEVERITY_LEVELS = {
  low: { damage_multiplier: 0.5, frequency: 0.8 },
  medium: { damage_multiplier: 1.0, frequency: 0.5 },
  high: { damage_multiplier: 1.5, frequency: 0.3 },
  very_high: { damage_multiplier: 2.0, frequency: 0.15 },
  extreme: { damage_multiplier: 3.0, frequency: 0.05 },
  variable: { damage_multiplier: 1.0, frequency: 0.2 }
};

// Countermeasure definitions
const COUNTERMEASURES = {
  enhanced_navigation: {
    name: 'Enhanced Navigation',
    description: 'Advanced navigation systems for hazardous areas',
    cost: 500,
    effects: { navigation_difficulty: -0.5, collision_avoidance: 0.3 }
  },
  reinforced_hull: {
    name: 'Reinforced Hull',
    description: 'Strengthened hull plating for impact protection',
    cost: 750,
    effects: { collision_damage: -0.4, structural_stress: -0.3 }
  },
  emp_shielding: {
    name: 'EMP Shielding',
    description: 'Electromagnetic pulse protection systems',
    cost: 600,
    effects: { electronics_disable: -0.7, communication_jamming: -0.5 }
  },
  backup_systems: {
    name: 'Backup Systems',
    description: 'Redundant systems for critical functions',
    cost: 400,
    effects: { system_failure: -0.6, recovery_time: -0.5 }
  },
  advanced_sensors: {
    name: 'Advanced Sensors',
    description: 'High-resolution sensors for improved detection',
    cost: 800,
    effects: { visibility_reduction: -0.4, sensor_range_reduction: -0.6 }
  },
  navigation_computer: {
    name: 'Navigation Computer',
    description: 'AI-assisted navigation and pathfinding',
    cost: 900,
    effects: { navigation_interference: -0.5, path_optimization: 0.3 }
  },
  gravity_compensators: {
    name: 'Gravity Compensators',
    description: 'Systems to counter gravitational effects',
    cost: 1200,
    effects: { gravitational_pull: -0.6, time_dilation: -0.2 }
  },
  structural_reinforcement: {
    name: 'Structural Reinforcement',
    description: 'Enhanced structural integrity systems',
    cost: 1000,
    effects: { structural_stress: -0.5, hull_integrity: 0.3 }
  },
  magnetic_shielding: {
    name: 'Magnetic Shielding',
    description: 'Protection against magnetic interference',
    cost: 700,
    effects: { navigation_interference: -0.6, electrical_damage: -0.8 }
  },
  inertial_navigation: {
    name: 'Inertial Navigation',
    description: 'Self-contained navigation system',
    cost: 650,
    effects: { compass_deviation: -0.9, magnetic_immunity: 1.0 }
  },
  radiation_shielding: {
    name: 'Radiation Shielding',
    description: 'Protection against harmful radiation',
    cost: 850,
    effects: { crew_health_drain: -0.8, system_degradation: -0.6 }
  },
  medical_bay: {
    name: 'Medical Bay',
    description: 'Advanced medical treatment facility',
    cost: 1100,
    effects: { radiation_sickness: -0.7, crew_recovery: 2.0 }
  },
  temporal_stabilizers: {
    name: 'Temporal Stabilizers',
    description: 'Devices to counter temporal effects',
    cost: 1500,
    effects: { time_distortion: -0.5, temporal_displacement: -0.8 }
  },
  chronometer_systems: {
    name: 'Chronometer Systems',
    description: 'Precise time measurement and sync',
    cost: 800,
    effects: { time_tracking: 1.0, temporal_immunity: 0.3 }
  },
  wormhole_navigator: {
    name: 'Wormhole Navigator',
    description: 'Specialized wormhole travel systems',
    cost: 2000,
    effects: { entry_damage: -0.7, instability: -0.5 }
  },
  exotic_matter_stabilizer: {
    name: 'Exotic Matter Stabilizer',
    description: 'Advanced exotic matter manipulation',
    cost: 2500,
    effects: { wormhole_stability: 0.8, exotic_radiation: -0.6 }
  }
};

/**
 * Main HazardSystem class that manages all environmental hazards
 */
class HazardSystem {
  constructor(database) {
    this.db = database;
    this.activeHazards = new Map(); // sector_id -> hazard array
    this.playerCountermeasures = new Map(); // player_id -> countermeasure array
    this.hazardEffects = new Map(); // player_id -> active effects
    this.updateInterval = 5000; // 5 seconds
    this.lastUpdate = Date.now();
  }

  /**
   * Initialize the hazard system
   */
  async initialize() {
    console.log('Initializing Environmental Hazards System...');
    
    // Load active hazards from database
    await this.loadActiveHazards();
    
    // Load player countermeasures
    await this.loadPlayerCountermeasures();
    
    // Start hazard processing loop
    this.startProcessingLoop();
    
    console.log('Environmental Hazards System initialized');
  }

  /**
   * Load active hazards from database
   */
  async loadActiveHazards() {
    try {
      const hazards = await this.db.all(
        'SELECT * FROM sector_hazards WHERE expires_at IS NULL OR expires_at > ?',
        [Date.now()]
      );

      for (const hazard of hazards) {
        const sectorKey = `${hazard.sector_x}_${hazard.sector_y}`;
        if (!this.activeHazards.has(sectorKey)) {
          this.activeHazards.set(sectorKey, []);
        }
        
        const hazardData = {
          id: hazard.id,
          type: hazard.hazard_type,
          x: hazard.x,
          y: hazard.y,
          properties: JSON.parse(hazard.properties || '{}'),
          createdAt: hazard.created_at,
          expiresAt: hazard.expires_at
        };

        this.activeHazards.get(sectorKey).push(hazardData);
      }

      console.log(`Loaded ${hazards.length} active hazards from database`);
    } catch (error) {
      console.error('Error loading active hazards:', error);
    }
  }

  /**
   * Load player countermeasures from database
   */
  async loadPlayerCountermeasures() {
    try {
      // This will be integrated with the skill system
      // For now, initialize empty countermeasures
      console.log('Player countermeasures loading will be integrated with skill system');
    } catch (error) {
      console.error('Error loading player countermeasures:', error);
    }
  }

  /**
   * Generate hazards for a sector based on its biome
   */
  generateSectorHazards(sector) {
    const hazards = [];
    const biome = sector.biome;
    const rng = sector.rng;

    // Get hazard types suitable for this biome
    const suitableHazards = this.getHazardTypesForBiome(biome.name);

    for (const hazardType of suitableHazards) {
      const hazardDef = HAZARD_TYPES[hazardType];
      const severityData = SEVERITY_LEVELS[hazardDef.severity];
      
      // Check spawn probability
      if (rng.next() < severityData.frequency) {
        const hazard = this.createHazard(hazardType, sector.coordinates, rng);
        if (hazard) {
          hazards.push(hazard);
        }
      }
    }

    // Add hazards to sector and database
    const sectorKey = `${sector.coordinates.x}_${sector.coordinates.y}`;
    this.activeHazards.set(sectorKey, hazards);

    // Persist to database
    this.persistHazards(sector.coordinates.x, sector.coordinates.y, hazards);

    return hazards;
  }

  /**
   * Get suitable hazard types for a biome
   */
  getHazardTypesForBiome(biomeName) {
    const hazardTypes = [];

    Object.entries(HAZARD_TYPES).forEach(([key, hazardDef]) => {
      if (hazardDef.commonBiomes.includes(biomeName.toUpperCase().replace(' ', '_'))) {
        hazardTypes.push(key);
      }
    });

    // Always have a chance for some universal hazards in any biome
    if (Math.random() < 0.1) hazardTypes.push('COSMIC_RADIATION');
    if (Math.random() < 0.05) hazardTypes.push('WORMHOLE');
    if (Math.random() < 0.03) hazardTypes.push('TEMPORAL_ANOMALY');

    return hazardTypes;
  }

  /**
   * Create a specific hazard instance
   */
  createHazard(hazardType, sectorCoords, rng) {
    const hazardDef = HAZARD_TYPES[hazardType];
    if (!hazardDef) return null;

    const hazard = {
      id: uuidv4(),
      type: hazardType,
      name: hazardDef.name,
      description: hazardDef.description,
      severity: hazardDef.severity,
      x: (rng.next() - 0.5) * 1800, // Within sector bounds
      y: (rng.next() - 0.5) * 1800,
      effects: { ...hazardDef.effects },
      visualization: { ...hazardDef.visualization },
      audio: hazardDef.audio,
      createdAt: Date.now(),
      expiresAt: null,
      isActive: true,
      properties: {}
    };

    // Set duration if specified
    if (hazardDef.duration) {
      const minDuration = hazardDef.duration.min || hazardDef.duration;
      const maxDuration = hazardDef.duration.max || hazardDef.duration;
      const duration = minDuration + rng.next() * (maxDuration - minDuration);
      hazard.expiresAt = Date.now() + duration;
    }

    // Add type-specific properties
    this.addTypeSpecificProperties(hazard, hazardDef, rng);

    return hazard;
  }

  /**
   * Add type-specific properties to hazards
   */
  addTypeSpecificProperties(hazard, hazardDef, rng) {
    switch (hazard.type) {
      case 'ASTEROID_FIELD':
        hazard.properties.asteroidCount = 15 + Math.floor(rng.next() * 20);
        hazard.properties.density = 0.3 + rng.next() * 0.5;
        break;

      case 'GRAVITATIONAL_ANOMALY':
        hazard.properties.pullStrength = hazard.effects.gravitational_pull.strength;
        hazard.properties.radius = hazard.effects.gravitational_pull.radius;
        hazard.properties.eventHorizon = hazard.properties.radius * 0.3;
        break;

      case 'WORMHOLE':
        // Generate random destination within reasonable range
        const distance = 5 + rng.next() * 20; // 5-25 sectors
        const angle = rng.next() * Math.PI * 2;
        hazard.properties.destinationX = Math.floor(Math.cos(angle) * distance);
        hazard.properties.destinationY = Math.floor(Math.sin(angle) * distance);
        hazard.properties.stability = 0.5 + rng.next() * 0.4; // 0.5-0.9
        hazard.effects.instability = 1.0 - hazard.properties.stability;
        break;

      case 'SOLAR_FLARE':
        hazard.properties.intensity = 0.5 + rng.next() * 0.5;
        hazard.properties.warningGiven = false;
        break;

      case 'MAGNETIC_STORM':
        hazard.properties.fieldStrength = 0.6 + rng.next() * 0.4;
        hazard.properties.fluctuation = 0.1 + rng.next() * 0.3;
        break;

      case 'COSMIC_RADIATION':
        hazard.properties.radiationType = ['gamma', 'beta', 'neutron'][Math.floor(rng.next() * 3)];
        hazard.properties.intensity = 0.4 + rng.next() * 0.6;
        break;

      case 'TEMPORAL_ANOMALY':
        hazard.properties.temporalType = ['acceleration', 'deceleration', 'loop'][Math.floor(rng.next() * 3)];
        hazard.properties.distortionLevel = 0.3 + rng.next() * 0.7;
        break;
    }
  }

  /**
   * Persist hazards to database
   */
  async persistHazards(sectorX, sectorY, hazards) {
    try {
      for (const hazard of hazards) {
        await this.db.saveSectorHazard({
          id: hazard.id,
          sector_x: sectorX,
          sector_y: sectorY,
          hazard_type: hazard.type,
          x: hazard.x,
          y: hazard.y,
          properties: hazard.properties,
          expires_at: hazard.expiresAt
        });
      }
    } catch (error) {
      console.error('Error persisting hazards:', error);
    }
  }

  /**
   * Get hazards for a specific sector
   */
  getSectorHazards(sectorX, sectorY) {
    const sectorKey = `${sectorX}_${sectorY}`;
    return this.activeHazards.get(sectorKey) || [];
  }

  /**
   * Process hazard effects on a player
   */
  processPlayerHazardEffects(playerId, playerPosition, sectorCoords) {
    const sectorHazards = this.getSectorHazards(sectorCoords.x, sectorCoords.y);
    const effects = [];

    for (const hazard of sectorHazards) {
      if (!hazard.isActive) continue;

      const distance = this.calculateDistance(playerPosition, hazard);
      const hazardDef = HAZARD_TYPES[hazard.type];
      const effect = this.calculateHazardEffect(hazard, hazardDef, distance, playerId);

      if (effect.magnitude > 0) {
        effects.push(effect);
      }
    }

    // Store active effects for this player
    this.hazardEffects.set(playerId, effects);
    return effects;
  }

  /**
   * Calculate hazard effect on player based on distance and countermeasures
   */
  calculateHazardEffect(hazard, hazardDef, distance, playerId) {
    const baseEffect = {
      hazardId: hazard.id,
      type: hazard.type,
      magnitude: 0,
      effects: {},
      warnings: [],
      audioQueue: []
    };

    // Get player countermeasures
    const playerCountermeasures = this.playerCountermeasures.get(playerId) || [];

    // Calculate base magnitude based on hazard properties
    let magnitude = 1.0;
    
    // Distance falloff for area-effect hazards
    if (hazard.type === 'GRAVITATIONAL_ANOMALY') {
      const radius = hazard.properties.radius || 300;
      if (distance < radius) {
        magnitude = 1.0 - (distance / radius);
      } else {
        magnitude = 0;
      }
    } else if (hazard.type === 'COSMIC_RADIATION') {
      // Radiation has long range with gradual falloff
      magnitude = Math.max(0, 1.0 - (distance / 1000));
    } else if (hazard.type === 'NEBULA_INTERFERENCE') {
      // Nebula effects are sector-wide
      magnitude = 1.0;
    } else {
      // Standard falloff for other hazards
      magnitude = Math.max(0, 1.0 - (distance / 500));
    }

    // Apply countermeasure reductions
    for (const countermeasure of playerCountermeasures) {
      const countermeasureDef = COUNTERMEASURES[countermeasure];
      if (countermeasureDef) {
        // Apply countermeasure effects
        Object.entries(countermeasureDef.effects).forEach(([effectType, reduction]) => {
          if (hazardDef.effects[effectType] !== undefined && reduction < 0) {
            magnitude *= (1 + reduction); // reduction is negative
          }
        });
      }
    }

    baseEffect.magnitude = Math.max(0, magnitude);

    // Calculate specific effects based on hazard type
    if (baseEffect.magnitude > 0) {
      this.calculateSpecificEffects(baseEffect, hazard, hazardDef, magnitude);
    }

    return baseEffect;
  }

  /**
   * Calculate specific effects for different hazard types
   */
  calculateSpecificEffects(effect, hazard, hazardDef, magnitude) {
    switch (hazard.type) {
      case 'ASTEROID_FIELD':
        effect.effects.collisionRisk = magnitude * 0.3;
        effect.effects.navigationDifficulty = magnitude * hazardDef.effects.navigation_difficulty;
        effect.effects.miningBonus = hazardDef.effects.mining_bonus;
        break;

      case 'SOLAR_FLARE':
        effect.effects.electronicsDisable = magnitude * hazardDef.effects.electronics_disable.chance;
        effect.effects.shieldDrain = magnitude * hazardDef.effects.shield_drain;
        effect.effects.communicationJamming = magnitude * hazardDef.effects.communication_jamming;
        effect.effects.energyWeaponBoost = hazardDef.effects.energy_weapon_boost;
        
        // Warning system
        if (hazard.properties.warningGiven === false && hazard.expiresAt) {
          const timeToFlare = hazard.expiresAt - Date.now();
          if (timeToFlare <= (hazardDef.warning_time || 15000)) {
            effect.warnings.push('SOLAR_FLARE_IMMINENT');
            effect.audioQueue.push('solar_flare_warning');
            hazard.properties.warningGiven = true;
          }
        }
        break;

      case 'NEBULA_INTERFERENCE':
        effect.effects.visibilityReduction = magnitude * hazardDef.effects.visibility_reduction;
        effect.effects.sensorRangeReduction = magnitude * hazardDef.effects.sensor_range_reduction;
        effect.effects.warpInterference = magnitude * hazardDef.effects.warp_interference;
        effect.effects.energyRegeneration = hazardDef.effects.energy_regeneration;
        break;

      case 'GRAVITATIONAL_ANOMALY':
        const pullStrength = hazard.properties.pullStrength || 0.8;
        effect.effects.gravitationalPull = magnitude * pullStrength;
        effect.effects.timeDilation = 1.0 - (magnitude * (1.0 - hazardDef.effects.time_dilation));
        effect.effects.structuralStress = magnitude * hazardDef.effects.structural_stress;
        
        // Event horizon warning
        if (magnitude > 0.7) {
          effect.warnings.push('EVENT_HORIZON_PROXIMITY');
          effect.audioQueue.push('gravity_distortion');
        }
        break;

      case 'MAGNETIC_STORM':
        effect.effects.navigationInterference = magnitude * hazardDef.effects.navigation_interference;
        effect.effects.compassDeviation = {
          angle: hazardDef.effects.compass_deviation.angle * magnitude,
          variance: hazardDef.effects.compass_deviation.variance
        };
        effect.effects.electricalDamageChance = magnitude * hazardDef.effects.electrical_damage.chance;
        break;

      case 'COSMIC_RADIATION':
        effect.effects.crewHealthDrain = magnitude * hazardDef.effects.crew_health_drain.rate;
        effect.effects.systemDegradation = magnitude * hazardDef.effects.system_degradation.rate;
        effect.effects.radiationLevel = magnitude * 100;
        
        // Radiation warnings
        if (magnitude > 0.5) {
          effect.warnings.push('HIGH_RADIATION_EXPOSURE');
          effect.audioQueue.push('radiation_warning');
        }
        break;

      case 'TEMPORAL_ANOMALY':
        const temporalType = hazard.properties.temporalType || 'acceleration';
        if (temporalType === 'acceleration') {
          effect.effects.timeAcceleration = hazardDef.effects.time_acceleration.factor;
        } else if (temporalType === 'deceleration') {
          effect.effects.timeDeceleration = hazardDef.effects.time_deceleration.factor;
        }
        effect.effects.temporalDisplacementChance = magnitude * hazardDef.effects.temporal_displacement.chance;
        
        effect.warnings.push('TEMPORAL_DISTORTION_DETECTED');
        effect.audioQueue.push('temporal_distortion');
        break;

      case 'WORMHOLE':
        effect.effects.wormholeEntry = true;
        effect.effects.destination = {
          x: hazard.properties.destinationX,
          y: hazard.properties.destinationY
        };
        effect.effects.entryDamageChance = magnitude * hazardDef.effects.entry_damage.chance;
        effect.effects.instability = hazard.effects.instability;
        
        // Collapse warning
        if (hazard.expiresAt) {
          const timeToCollapse = hazard.expiresAt - Date.now();
          if (timeToCollapse <= (hazardDef.warning_time || 60000)) {
            effect.warnings.push('WORMHOLE_COLLAPSE_IMMINENT');
            effect.audioQueue.push('wormhole_collapse_warning');
          }
        }
        break;
    }
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Update hazard states (called periodically)
   */
  updateHazards() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [sectorKey, hazards] of this.activeHazards.entries()) {
      for (let i = hazards.length - 1; i >= 0; i--) {
        const hazard = hazards[i];
        
        // Check if hazard has expired
        if (hazard.expiresAt && now > hazard.expiresAt) {
          hazards.splice(i, 1);
          expiredCount++;
          
          // Remove from database
          this.removeHazardFromDatabase(hazard.id);
        }
      }
    }

    if (expiredCount > 0) {
      console.log(`Cleaned up ${expiredCount} expired hazards`);
    }

    this.lastUpdate = now;
  }

  /**
   * Remove hazard from database
   */
  async removeHazardFromDatabase(hazardId) {
    try {
      await this.db.run('DELETE FROM sector_hazards WHERE id = ?', [hazardId]);
    } catch (error) {
      console.error('Error removing hazard from database:', error);
    }
  }

  /**
   * Add countermeasure to player
   */
  addPlayerCountermeasure(playerId, countermeasureId) {
    if (!this.playerCountermeasures.has(playerId)) {
      this.playerCountermeasures.set(playerId, []);
    }
    
    const playerCountermeasures = this.playerCountermeasures.get(playerId);
    if (!playerCountermeasures.includes(countermeasureId)) {
      playerCountermeasures.push(countermeasureId);
    }
  }

  /**
   * Remove countermeasure from player
   */
  removePlayerCountermeasure(playerId, countermeasureId) {
    const playerCountermeasures = this.playerCountermeasures.get(playerId);
    if (playerCountermeasures) {
      const index = playerCountermeasures.indexOf(countermeasureId);
      if (index > -1) {
        playerCountermeasures.splice(index, 1);
      }
    }
  }

  /**
   * Get player's active hazard effects
   */
  getPlayerHazardEffects(playerId) {
    return this.hazardEffects.get(playerId) || [];
  }

  /**
   * Start the hazard processing loop
   */
  startProcessingLoop() {
    setInterval(() => {
      this.updateHazards();
    }, this.updateInterval);
  }

  /**
   * Get hazard definitions for client
   */
  getHazardDefinitions() {
    return {
      types: HAZARD_TYPES,
      severityLevels: SEVERITY_LEVELS,
      countermeasures: COUNTERMEASURES
    };
  }

  /**
   * Force spawn a specific hazard (for testing/events)
   */
  async spawnHazard(sectorX, sectorY, hazardType, x, y, properties = {}) {
    const hazardDef = HAZARD_TYPES[hazardType];
    if (!hazardDef) {
      throw new Error(`Unknown hazard type: ${hazardType}`);
    }

    const hazard = {
      id: uuidv4(),
      type: hazardType,
      name: hazardDef.name,
      description: hazardDef.description,
      severity: hazardDef.severity,
      x: x || 0,
      y: y || 0,
      effects: { ...hazardDef.effects },
      visualization: { ...hazardDef.visualization },
      audio: hazardDef.audio,
      createdAt: Date.now(),
      expiresAt: null,
      isActive: true,
      properties: { ...properties }
    };

    // Set duration if specified
    if (hazardDef.duration) {
      const minDuration = hazardDef.duration.min || hazardDef.duration;
      const maxDuration = hazardDef.duration.max || hazardDef.duration;
      const duration = minDuration + Math.random() * (maxDuration - minDuration);
      hazard.expiresAt = Date.now() + duration;
    }

    // Add to active hazards
    const sectorKey = `${sectorX}_${sectorY}`;
    if (!this.activeHazards.has(sectorKey)) {
      this.activeHazards.set(sectorKey, []);
    }
    this.activeHazards.get(sectorKey).push(hazard);

    // Persist to database
    await this.persistHazards(sectorX, sectorY, [hazard]);

    return hazard;
  }

  /**
   * Get hazard statistics
   */
  getHazardStatistics() {
    let totalHazards = 0;
    const hazardCounts = {};
    const sectorCounts = {};

    for (const [sectorKey, hazards] of this.activeHazards.entries()) {
      totalHazards += hazards.length;
      sectorCounts[sectorKey] = hazards.length;

      for (const hazard of hazards) {
        hazardCounts[hazard.type] = (hazardCounts[hazard.type] || 0) + 1;
      }
    }

    return {
      totalHazards,
      hazardCounts,
      sectorCounts,
      activeSectors: this.activeHazards.size
    };
  }
}

module.exports = { HazardSystem, HAZARD_TYPES, COUNTERMEASURES, SEVERITY_LEVELS };