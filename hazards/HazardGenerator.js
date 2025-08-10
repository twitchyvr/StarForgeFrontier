/**
 * HazardGenerator.js - Procedural hazard generation system
 * Handles intelligent placement and generation of environmental hazards
 */

const { HAZARD_TYPES, SEVERITY_LEVELS } = require('./HazardSystem');
const { v4: uuidv4 } = require('uuid');

/**
 * Biome-specific hazard generation rules
 */
const BIOME_HAZARD_RULES = {
  'ASTEROID_FIELD': {
    primaryHazards: ['ASTEROID_FIELD'],
    secondaryHazards: ['MAGNETIC_STORM', 'COSMIC_RADIATION'],
    rareHazards: ['TEMPORAL_ANOMALY', 'WORMHOLE'],
    hazardDensity: 'high',
    clusteringFactor: 0.7, // Tends to cluster hazards
    exclusionZones: ['safe_lane'], // Areas to avoid hazards
    specialRules: {
      // Create asteroid highways - safe corridors through fields
      asteroid_highways: {
        enabled: true,
        width: 200,
        count: 2
      },
      // Mining hazard bonus areas
      rich_zones: {
        enabled: true,
        oreMultiplier: 2.0,
        hazardMultiplier: 1.5
      }
    }
  },

  'NEBULA': {
    primaryHazards: ['NEBULA_INTERFERENCE'],
    secondaryHazards: ['COSMIC_RADIATION', 'MAGNETIC_STORM'],
    rareHazards: ['TEMPORAL_ANOMALY', 'WORMHOLE'],
    hazardDensity: 'medium',
    clusteringFactor: 0.3, // More spread out
    exclusionZones: [],
    specialRules: {
      // Visibility pockets - areas with better visibility
      visibility_pockets: {
        enabled: true,
        count: 3,
        radius: 150
      },
      // Energy phenomena
      energy_storms: {
        enabled: true,
        intensity: 0.6
      }
    }
  },

  'DEEP_SPACE': {
    primaryHazards: ['COSMIC_RADIATION'],
    secondaryHazards: ['WORMHOLE', 'TEMPORAL_ANOMALY'],
    rareHazards: ['GRAVITATIONAL_ANOMALY'],
    hazardDensity: 'low',
    clusteringFactor: 0.1, // Very spread out
    exclusionZones: [],
    specialRules: {
      // Void zones - completely empty areas
      void_zones: {
        enabled: true,
        count: 1,
        radius: 300
      },
      // Ancient signatures
      ancient_signatures: {
        enabled: true,
        temporalAnomalyChance: 0.15
      }
    }
  },

  'STELLAR_NURSERY': {
    primaryHazards: ['SOLAR_FLARE', 'COSMIC_RADIATION'],
    secondaryHazards: ['MAGNETIC_STORM', 'GRAVITATIONAL_ANOMALY'],
    rareHazards: ['TEMPORAL_ANOMALY'],
    hazardDensity: 'very_high',
    clusteringFactor: 0.8, // Highly clustered around star formation
    exclusionZones: ['protostar_exclusion'],
    specialRules: {
      // Stellar formation zones
      protostar_zones: {
        enabled: true,
        count: 2,
        radius: 250,
        hazardMultiplier: 2.0
      },
      // Solar wind corridors
      solar_winds: {
        enabled: true,
        directionCount: 4,
        length: 600
      }
    }
  },

  'ANCIENT_RUINS': {
    primaryHazards: ['TEMPORAL_ANOMALY'],
    secondaryHazards: ['GRAVITATIONAL_ANOMALY', 'COSMIC_RADIATION'],
    rareHazards: ['WORMHOLE'],
    hazardDensity: 'medium',
    clusteringFactor: 0.5, // Moderate clustering around ruins
    exclusionZones: ['artifact_sites'],
    specialRules: {
      // Technology activation zones
      tech_zones: {
        enabled: true,
        count: 3,
        radius: 180,
        temporalAnomalyChance: 0.8
      },
      // Ancient defense systems
      defense_systems: {
        enabled: true,
        gravitationalTraps: true
      }
    }
  },

  'BLACK_HOLE_REGION': {
    primaryHazards: ['GRAVITATIONAL_ANOMALY'],
    secondaryHazards: ['TEMPORAL_ANOMALY', 'COSMIC_RADIATION'],
    rareHazards: ['WORMHOLE'],
    hazardDensity: 'extreme',
    clusteringFactor: 0.9, // Extremely clustered around black hole
    exclusionZones: ['event_horizon'],
    specialRules: {
      // Accretion disk
      accretion_disk: {
        enabled: true,
        radius: 400,
        hazardMultiplier: 3.0
      },
      // Hawking radiation zones
      hawking_radiation: {
        enabled: true,
        cosmicRadiationIntensity: 2.0
      },
      // Gravitational lensing effects
      lensing_effects: {
        enabled: true,
        wormholeChance: 0.3
      }
    }
  }
};

/**
 * Hazard placement patterns for intelligent positioning
 */
const PLACEMENT_PATTERNS = {
  clustered: {
    name: 'Clustered',
    description: 'Hazards grouped together in dangerous zones',
    algorithm: 'cluster_based',
    parameters: { clusterCount: 3, clusterRadius: 200, hazardsPerCluster: 4 }
  },
  
  scattered: {
    name: 'Scattered',
    description: 'Hazards spread randomly across the sector',
    algorithm: 'random_placement',
    parameters: { minDistance: 150, maxDistance: 800 }
  },

  linear: {
    name: 'Linear',
    description: 'Hazards arranged in lines or corridors',
    algorithm: 'linear_placement',
    parameters: { lineCount: 2, lineLength: 600, hazardSpacing: 100 }
  },

  radial: {
    name: 'Radial',
    description: 'Hazards emanating from a central point',
    algorithm: 'radial_placement',
    parameters: { centerX: 0, centerY: 0, armCount: 4, armLength: 500 }
  },

  perimeter: {
    name: 'Perimeter',
    description: 'Hazards around the edges of the sector',
    algorithm: 'perimeter_placement',
    parameters: { perimeterMargin: 100, hazardDensity: 0.3 }
  },

  grid: {
    name: 'Grid',
    description: 'Hazards in regular grid pattern with variations',
    algorithm: 'grid_placement',
    parameters: { gridSize: 300, variance: 100 }
  }
};

/**
 * Dynamic hazard events that can occur over time
 */
const DYNAMIC_EVENTS = {
  solar_storm: {
    name: 'Solar Storm',
    description: 'Massive solar flare activity affecting multiple sectors',
    duration: { min: 300000, max: 600000 }, // 5-10 minutes
    affectedRadius: 3, // Sectors
    hazardTypes: ['SOLAR_FLARE', 'MAGNETIC_STORM'],
    triggerConditions: {
      biomes: ['STELLAR_NURSERY'],
      playerActivity: 'high',
      probability: 0.1
    }
  },

  void_storm: {
    name: 'Void Storm',
    description: 'Temporal-spatial disturbances in deep space',
    duration: { min: 180000, max: 360000 }, // 3-6 minutes
    affectedRadius: 2,
    hazardTypes: ['TEMPORAL_ANOMALY', 'COSMIC_RADIATION'],
    triggerConditions: {
      biomes: ['DEEP_SPACE'],
      timeOfDay: 'any',
      probability: 0.05
    }
  },

  gravitational_cascade: {
    name: 'Gravitational Cascade',
    description: 'Chain reaction of gravitational anomalies',
    duration: { min: 240000, max: 480000 }, // 4-8 minutes
    affectedRadius: 2,
    hazardTypes: ['GRAVITATIONAL_ANOMALY'],
    triggerConditions: {
      biomes: ['BLACK_HOLE_REGION'],
      existingHazards: ['GRAVITATIONAL_ANOMALY'],
      probability: 0.15
    }
  },

  wormhole_instability: {
    name: 'Wormhole Instability',
    description: 'Existing wormholes become unstable and spawn new ones',
    duration: { min: 120000, max: 300000 }, // 2-5 minutes
    affectedRadius: 1,
    hazardTypes: ['WORMHOLE', 'TEMPORAL_ANOMALY'],
    triggerConditions: {
      existingHazards: ['WORMHOLE'],
      probability: 0.2
    }
  },
  
  // Emergency Scenarios
  distress_call: {
    name: 'Distress Call',
    description: 'Emergency beacon detected - rescue mission available',
    duration: { min: 300000, max: 900000 }, // 5-15 minutes
    affectedRadius: 1,
    hazardTypes: [], // No additional hazards, this is a mission event
    triggerConditions: {
      playerActivity: 'medium',
      probability: 0.3
    },
    missionType: 'rescue',
    rewards: {
      experience: 150,
      resources: 200,
      reputation: 50
    }
  },
  
  evacuation_mission: {
    name: 'Colony Evacuation',
    description: 'Civilian colony under threat requires immediate evacuation',
    duration: { min: 600000, max: 1200000 }, // 10-20 minutes
    affectedRadius: 2,
    hazardTypes: ['SOLAR_FLARE', 'COSMIC_RADIATION'], // Hazards threatening the colony
    triggerConditions: {
      biomes: ['STELLAR_NURSERY', 'ASTEROID_FIELD'],
      playerActivity: 'high',
      probability: 0.15
    },
    missionType: 'evacuation',
    rewards: {
      experience: 300,
      resources: 500,
      reputation: 100,
      civiliansToEvacuate: 50
    }
  },
  
  disaster_response: {
    name: 'Disaster Response',
    description: 'Natural disaster requires immediate humanitarian aid',
    duration: { min: 900000, max: 1800000 }, // 15-30 minutes
    affectedRadius: 3,
    hazardTypes: ['GRAVITATIONAL_ANOMALY', 'ASTEROID_FIELD'], // Disaster effects
    triggerConditions: {
      biomes: ['BLACK_HOLE_REGION', 'ASTEROID_FIELD'],
      probability: 0.1
    },
    missionType: 'disaster_relief',
    rewards: {
      experience: 400,
      resources: 750,
      reputation: 150,
      suppliesNeeded: 100
    }
  },
  
  pirate_raid_response: {
    name: 'Pirate Raid Emergency',
    description: 'Trading convoy under pirate attack needs assistance',
    duration: { min: 180000, max: 480000 }, // 3-8 minutes
    affectedRadius: 1,
    hazardTypes: [], // Combat scenario, not environmental
    triggerConditions: {
      biomes: ['DEEP_SPACE'],
      playerActivity: 'high',
      probability: 0.25
    },
    missionType: 'combat_assistance',
    rewards: {
      experience: 250,
      resources: 400,
      reputation: 75,
      pirates: 3
    }
  },
  
  medical_emergency: {
    name: 'Medical Emergency',
    description: 'Critical medical supplies needed for plague outbreak',
    duration: { min: 1200000, max: 2400000 }, // 20-40 minutes
    affectedRadius: 2,
    hazardTypes: ['COSMIC_RADIATION'], // Radiation causing the medical issues
    triggerConditions: {
      probability: 0.08
    },
    missionType: 'medical_supply',
    rewards: {
      experience: 350,
      resources: 600,
      reputation: 120,
      medicalSuppliesNeeded: 25
    }
  }
};

/**
 * HazardGenerator class for procedural hazard creation
 */
class HazardGenerator {
  constructor(sectorManager, database) {
    this.sectorManager = sectorManager;
    this.database = database;
    this.dynamicEvents = new Map(); // sector -> active events
    this.generationHistory = new Map(); // Track generation patterns
    this.exclusionZones = new Map(); // sector -> exclusion zones
  }

  /**
   * Generate hazards for a specific sector
   */
  generateSectorHazards(sector) {
    const biomeRules = BIOME_HAZARD_RULES[sector.biome.name.toUpperCase().replace(' ', '_')];
    if (!biomeRules) {
      console.warn(`No hazard rules defined for biome: ${sector.biome.name}`);
      return [];
    }

    const hazards = [];
    const sectorKey = `${sector.coordinates.x}_${sector.coordinates.y}`;
    
    // Initialize exclusion zones for this sector
    this.initializeExclusionZones(sector, biomeRules);

    // Generate primary hazards
    const primaryHazards = this.generateHazardsByType(
      sector, 
      biomeRules.primaryHazards, 
      'primary',
      biomeRules
    );
    hazards.push(...primaryHazards);

    // Generate secondary hazards
    const secondaryHazards = this.generateHazardsByType(
      sector, 
      biomeRules.secondaryHazards, 
      'secondary',
      biomeRules
    );
    hazards.push(...secondaryHazards);

    // Generate rare hazards
    const rareHazards = this.generateHazardsByType(
      sector, 
      biomeRules.rareHazards, 
      'rare',
      biomeRules
    );
    hazards.push(...rareHazards);

    // Apply special rules
    this.applySpecialRules(sector, biomeRules, hazards);

    // Apply placement patterns
    this.applyPlacementPattern(sector, hazards, biomeRules);

    // Store generation history
    this.generationHistory.set(sectorKey, {
      timestamp: Date.now(),
      biome: sector.biome.name,
      hazardCount: hazards.length,
      patterns: this.getUsedPatterns(hazards)
    });

    console.log(`Generated ${hazards.length} hazards for sector ${sectorKey} (${sector.biome.name})`);
    return hazards;
  }

  /**
   * Generate hazards by type category (primary, secondary, rare)
   */
  generateHazardsByType(sector, hazardTypes, category, biomeRules) {
    const hazards = [];
    const densityMultiplier = this.getDensityMultiplier(biomeRules.hazardDensity);

    for (const hazardType of hazardTypes) {
      const hazardDef = HAZARD_TYPES[hazardType];
      if (!hazardDef) continue;

      const severityData = SEVERITY_LEVELS[hazardDef.severity];
      let spawnChance = severityData.frequency * densityMultiplier;

      // Adjust spawn chance by category
      switch (category) {
        case 'primary':
          spawnChance *= 1.2; // 20% higher chance
          break;
        case 'secondary':
          spawnChance *= 0.7; // 30% lower chance
          break;
        case 'rare':
          spawnChance *= 0.3; // 70% lower chance
          break;
      }

      // Check if we should spawn this hazard type
      if (sector.rng.next() < spawnChance) {
        const count = this.getHazardCount(hazardType, category, biomeRules);
        
        for (let i = 0; i < count; i++) {
          const hazard = this.createHazardInstance(hazardType, sector);
          if (hazard && this.isValidPlacement(hazard, sector)) {
            hazards.push(hazard);
          }
        }
      }
    }

    return hazards;
  }

  /**
   * Get density multiplier based on biome density setting
   */
  getDensityMultiplier(density) {
    switch (density) {
      case 'low': return 0.5;
      case 'medium': return 1.0;
      case 'high': return 1.5;
      case 'very_high': return 2.0;
      case 'extreme': return 3.0;
      default: return 1.0;
    }
  }

  /**
   * Determine how many hazards of a type to spawn
   */
  getHazardCount(hazardType, category, biomeRules) {
    const baseCount = {
      primary: { min: 1, max: 3 },
      secondary: { min: 0, max: 2 },
      rare: { min: 0, max: 1 }
    };

    const range = baseCount[category];
    return range.min + Math.floor(Math.random() * (range.max - range.min + 1));
  }

  /**
   * Create a hazard instance with intelligent positioning
   */
  createHazardInstance(hazardType, sector) {
    const hazardDef = HAZARD_TYPES[hazardType];
    if (!hazardDef) return null;

    // Generate position using sector RNG for consistency
    let x, y;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      x = (sector.rng.next() - 0.5) * 1800; // -900 to 900
      y = (sector.rng.next() - 0.5) * 1800;
      attempts++;
    } while (attempts < maxAttempts && !this.isPositionValid(x, y, sector));

    if (attempts >= maxAttempts) {
      console.warn(`Could not find valid position for hazard ${hazardType} in sector ${sector.id}`);
      // Use position anyway, but mark for later adjustment
    }

    const hazard = {
      id: uuidv4(),
      type: hazardType,
      name: hazardDef.name,
      description: hazardDef.description,
      severity: hazardDef.severity,
      x: x,
      y: y,
      effects: { ...hazardDef.effects },
      visualization: { ...hazardDef.visualization },
      audio: hazardDef.audio,
      createdAt: Date.now(),
      expiresAt: null,
      isActive: true,
      properties: {},
      generationMethod: 'procedural'
    };

    // Set duration if specified
    if (hazardDef.duration) {
      const minDuration = hazardDef.duration.min || hazardDef.duration;
      const maxDuration = hazardDef.duration.max || hazardDef.duration;
      const duration = minDuration + sector.rng.next() * (maxDuration - minDuration);
      hazard.expiresAt = Date.now() + duration;
    }

    // Add type-specific properties
    this.addHazardSpecificProperties(hazard, hazardDef, sector);

    return hazard;
  }

  /**
   * Add type-specific properties to generated hazards
   */
  addHazardSpecificProperties(hazard, hazardDef, sector) {
    const rng = sector.rng;

    switch (hazard.type) {
      case 'ASTEROID_FIELD':
        hazard.properties.asteroidCount = 10 + Math.floor(rng.next() * 25);
        hazard.properties.density = 0.2 + rng.next() * 0.6;
        hazard.properties.composition = this.generateAsteroidComposition(rng);
        break;

      case 'SOLAR_FLARE':
        hazard.properties.intensity = 0.4 + rng.next() * 0.6;
        hazard.properties.frequency = rng.next() > 0.7 ? 'burst' : 'sustained';
        hazard.properties.warningGiven = false;
        hazard.properties.peakTime = hazard.createdAt + (hazard.expiresAt - hazard.createdAt) * 0.3;
        break;

      case 'NEBULA_INTERFERENCE':
        hazard.properties.gasType = ['hydrogen', 'helium', 'ionized'][Math.floor(rng.next() * 3)];
        hazard.properties.density = 0.3 + rng.next() * 0.5;
        hazard.properties.electricalActivity = rng.next() > 0.6;
        break;

      case 'GRAVITATIONAL_ANOMALY':
        const strength = 0.5 + rng.next() * 0.5;
        hazard.properties.pullStrength = strength;
        hazard.properties.radius = 200 + Math.floor(rng.next() * 200);
        hazard.properties.eventHorizon = hazard.properties.radius * 0.2;
        hazard.properties.tidalForces = strength > 0.7;
        break;

      case 'MAGNETIC_STORM':
        hazard.properties.fieldStrength = 0.4 + rng.next() * 0.6;
        hazard.properties.polarity = rng.next() > 0.5 ? 'positive' : 'negative';
        hazard.properties.fluctuation = 0.1 + rng.next() * 0.4;
        hazard.properties.resonanceFreq = 50 + Math.floor(rng.next() * 200); // Hz
        break;

      case 'COSMIC_RADIATION':
        hazard.properties.radiationType = ['gamma', 'beta', 'neutron', 'cosmic'][Math.floor(rng.next() * 4)];
        hazard.properties.intensity = 0.3 + rng.next() * 0.7;
        hazard.properties.source = rng.next() > 0.8 ? 'pulsar' : 'background';
        hazard.properties.particleCount = Math.floor(rng.next() * 1000000);
        break;

      case 'TEMPORAL_ANOMALY':
        hazard.properties.temporalType = ['acceleration', 'deceleration', 'loop', 'fracture'][Math.floor(rng.next() * 4)];
        hazard.properties.distortionLevel = 0.2 + rng.next() * 0.8;
        hazard.properties.stability = rng.next();
        hazard.properties.chronoParticles = rng.next() > 0.7;
        break;

      case 'WORMHOLE':
        // Generate destination within reasonable range
        const distance = 3 + rng.next() * 15; // 3-18 sectors
        const angle = rng.next() * Math.PI * 2;
        hazard.properties.destinationX = Math.floor(sector.coordinates.x + Math.cos(angle) * distance);
        hazard.properties.destinationY = Math.floor(sector.coordinates.y + Math.sin(angle) * distance);
        hazard.properties.stability = 0.4 + rng.next() * 0.5;
        hazard.properties.aperture = 50 + Math.floor(rng.next() * 100);
        hazard.properties.exoticMatter = rng.next() * 100;
        hazard.effects.instability = 1.0 - hazard.properties.stability;
        break;
    }
  }

  /**
   * Generate asteroid composition for asteroid fields
   */
  generateAsteroidComposition(rng) {
    const compositions = ['metallic', 'rocky', 'ice', 'mixed'];
    const weights = [0.3, 0.4, 0.2, 0.1];
    
    let random = rng.next();
    let cumulativeWeight = 0;
    
    for (let i = 0; i < compositions.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return compositions[i];
      }
    }
    
    return 'rocky'; // Fallback
  }

  /**
   * Initialize exclusion zones for a sector
   */
  initializeExclusionZones(sector, biomeRules) {
    const sectorKey = `${sector.coordinates.x}_${sector.coordinates.y}`;
    const exclusionZones = [];

    // Add biome-specific exclusion zones
    for (const zoneType of biomeRules.exclusionZones) {
      switch (zoneType) {
        case 'safe_lane':
          // Create safe corridors through dangerous areas
          exclusionZones.push({
            type: 'corridor',
            x1: -800, y1: 0, x2: 800, y2: 0,
            width: 150,
            description: 'Safe navigation corridor'
          });
          break;

        case 'protostar_exclusion':
          // Exclusion zone around forming stars
          exclusionZones.push({
            type: 'circle',
            x: 0, y: 0, radius: 300,
            description: 'Protostar exclusion zone'
          });
          break;

        case 'artifact_sites':
          // Protected areas around ancient artifacts
          const artifactCount = 1 + Math.floor(sector.rng.next() * 2);
          for (let i = 0; i < artifactCount; i++) {
            exclusionZones.push({
              type: 'circle',
              x: (sector.rng.next() - 0.5) * 1000,
              y: (sector.rng.next() - 0.5) * 1000,
              radius: 100,
              description: 'Ancient artifact site'
            });
          }
          break;

        case 'event_horizon':
          // Black hole event horizon
          exclusionZones.push({
            type: 'circle',
            x: 0, y: 0, radius: 150,
            description: 'Black hole event horizon'
          });
          break;
      }
    }

    this.exclusionZones.set(sectorKey, exclusionZones);
  }

  /**
   * Check if a position is valid (not in exclusion zones)
   */
  isPositionValid(x, y, sector) {
    const sectorKey = `${sector.coordinates.x}_${sector.coordinates.y}`;
    const exclusionZones = this.exclusionZones.get(sectorKey) || [];

    for (const zone of exclusionZones) {
      if (this.isInExclusionZone(x, y, zone)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if coordinates are within an exclusion zone
   */
  isInExclusionZone(x, y, zone) {
    switch (zone.type) {
      case 'circle':
        const dx = x - zone.x;
        const dy = y - zone.y;
        return Math.sqrt(dx * dx + dy * dy) < zone.radius;

      case 'corridor':
        // Check if point is within corridor width of the line
        const lineLength = Math.sqrt((zone.x2 - zone.x1) ** 2 + (zone.y2 - zone.y1) ** 2);
        if (lineLength === 0) return false;

        const t = Math.max(0, Math.min(1, 
          ((x - zone.x1) * (zone.x2 - zone.x1) + (y - zone.y1) * (zone.y2 - zone.y1)) / (lineLength ** 2)
        ));

        const projX = zone.x1 + t * (zone.x2 - zone.x1);
        const projY = zone.y1 + t * (zone.y2 - zone.y1);
        const distance = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);

        return distance < zone.width / 2;

      default:
        return false;
    }
  }

  /**
   * Check if hazard placement is valid considering other hazards
   */
  isValidPlacement(hazard, sector) {
    // Check minimum distance from other hazards of same type
    const minDistance = this.getMinimumDistance(hazard.type);
    
    for (const existingHazard of sector.environmentalHazards || []) {
      if (existingHazard.type === hazard.type) {
        const distance = Math.sqrt(
          (hazard.x - existingHazard.x) ** 2 + 
          (hazard.y - existingHazard.y) ** 2
        );
        
        if (distance < minDistance) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get minimum distance between hazards of the same type
   */
  getMinimumDistance(hazardType) {
    const distances = {
      'ASTEROID_FIELD': 200,
      'SOLAR_FLARE': 100,
      'NEBULA_INTERFERENCE': 300,
      'GRAVITATIONAL_ANOMALY': 400,
      'MAGNETIC_STORM': 150,
      'COSMIC_RADIATION': 200,
      'TEMPORAL_ANOMALY': 250,
      'WORMHOLE': 500
    };

    return distances[hazardType] || 150;
  }

  /**
   * Apply special rules for biome-specific behavior
   */
  applySpecialRules(sector, biomeRules, hazards) {
    const specialRules = biomeRules.specialRules;
    if (!specialRules) return;

    Object.entries(specialRules).forEach(([ruleName, ruleConfig]) => {
      if (ruleConfig.enabled) {
        this.applySpecialRule(ruleName, ruleConfig, sector, hazards);
      }
    });
  }

  /**
   * Apply a specific special rule
   */
  applySpecialRule(ruleName, ruleConfig, sector, hazards) {
    switch (ruleName) {
      case 'asteroid_highways':
        this.createAsteroidHighways(ruleConfig, sector, hazards);
        break;

      case 'rich_zones':
        this.createRichZones(ruleConfig, sector, hazards);
        break;

      case 'visibility_pockets':
        this.createVisibilityPockets(ruleConfig, sector, hazards);
        break;

      case 'void_zones':
        this.createVoidZones(ruleConfig, sector, hazards);
        break;

      case 'protostar_zones':
        this.createProtostarZones(ruleConfig, sector, hazards);
        break;

      case 'tech_zones':
        this.createTechZones(ruleConfig, sector, hazards);
        break;

      case 'accretion_disk':
        this.createAccretionDisk(ruleConfig, sector, hazards);
        break;
    }
  }

  /**
   * Create safe corridors through asteroid fields
   */
  createAsteroidHighways(ruleConfig, sector, hazards) {
    const highways = [];
    for (let i = 0; i < ruleConfig.count; i++) {
      const angle = (i / ruleConfig.count) * Math.PI * 2;
      const startX = Math.cos(angle) * 800;
      const startY = Math.sin(angle) * 800;
      const endX = Math.cos(angle + Math.PI) * 800;
      const endY = Math.sin(angle + Math.PI) * 800;

      highways.push({
        type: 'safe_corridor',
        x1: startX, y1: startY,
        x2: endX, y2: endY,
        width: ruleConfig.width,
        description: `Asteroid Highway ${i + 1}`
      });
    }

    // Remove hazards that interfere with highways
    for (let i = hazards.length - 1; i >= 0; i--) {
      const hazard = hazards[i];
      for (const highway of highways) {
        if (this.isInExclusionZone(hazard.x, hazard.y, {
          type: 'corridor',
          ...highway
        })) {
          hazards.splice(i, 1);
          break;
        }
      }
    }
  }

  /**
   * Create mining bonus zones
   */
  createRichZones(ruleConfig, sector, hazards) {
    // Add properties to existing asteroid hazards
    hazards.forEach(hazard => {
      if (hazard.type === 'ASTEROID_FIELD') {
        hazard.properties.miningBonus = ruleConfig.oreMultiplier;
        hazard.properties.hazardIntensity = ruleConfig.hazardMultiplier;
      }
    });
  }

  /**
   * Create areas with better visibility in nebulae
   */
  createVisibilityPockets(ruleConfig, sector, hazards) {
    for (let i = 0; i < ruleConfig.count; i++) {
      const pocketX = (sector.rng.next() - 0.5) * 1400;
      const pocketY = (sector.rng.next() - 0.5) * 1400;

      // Reduce nebula interference in these areas
      hazards.forEach(hazard => {
        if (hazard.type === 'NEBULA_INTERFERENCE') {
          const distance = Math.sqrt(
            (hazard.x - pocketX) ** 2 + (hazard.y - pocketY) ** 2
          );
          
          if (distance < ruleConfig.radius) {
            const reduction = 1 - (distance / ruleConfig.radius);
            hazard.properties.visibilityReduction = Math.max(
              0.1,
              (hazard.properties.visibilityReduction || 0.6) * (1 - reduction * 0.8)
            );
          }
        }
      });
    }
  }

  /**
   * Create completely empty zones in deep space
   */
  createVoidZones(ruleConfig, sector, hazards) {
    const voidX = (sector.rng.next() - 0.5) * 1000;
    const voidY = (sector.rng.next() - 0.5) * 1000;

    // Remove hazards within void zone
    for (let i = hazards.length - 1; i >= 0; i--) {
      const hazard = hazards[i];
      const distance = Math.sqrt(
        (hazard.x - voidX) ** 2 + (hazard.y - voidY) ** 2
      );

      if (distance < ruleConfig.radius) {
        hazards.splice(i, 1);
      }
    }
  }

  /**
   * Create high-intensity zones around protostars
   */
  createProtostarZones(ruleConfig, sector, hazards) {
    for (let i = 0; i < ruleConfig.count; i++) {
      const protostarX = (sector.rng.next() - 0.5) * 800;
      const protostarY = (sector.rng.next() - 0.5) * 800;

      // Intensify hazards near protostars
      hazards.forEach(hazard => {
        const distance = Math.sqrt(
          (hazard.x - protostarX) ** 2 + (hazard.y - protostarY) ** 2
        );

        if (distance < ruleConfig.radius) {
          const intensification = ruleConfig.hazardMultiplier * (1 - distance / ruleConfig.radius);
          
          // Apply intensification to hazard properties
          if (hazard.type === 'SOLAR_FLARE' || hazard.type === 'COSMIC_RADIATION') {
            hazard.properties.intensity = Math.min(1.0, 
              (hazard.properties.intensity || 0.5) * (1 + intensification)
            );
          }
        }
      });
    }
  }

  /**
   * Create technology activation zones in ancient ruins
   */
  createTechZones(ruleConfig, sector, hazards) {
    for (let i = 0; i < ruleConfig.count; i++) {
      const techX = (sector.rng.next() - 0.5) * 1200;
      const techY = (sector.rng.next() - 0.5) * 1200;

      // Higher chance for temporal anomalies in tech zones
      if (sector.rng.next() < ruleConfig.temporalAnomalyChance) {
        const temporalHazard = this.createHazardInstance('TEMPORAL_ANOMALY', sector);
        if (temporalHazard) {
          temporalHazard.x = techX + (sector.rng.next() - 0.5) * ruleConfig.radius;
          temporalHazard.y = techY + (sector.rng.next() - 0.5) * ruleConfig.radius;
          temporalHazard.properties.ancientTech = true;
          hazards.push(temporalHazard);
        }
      }
    }
  }

  /**
   * Create accretion disk around black holes
   */
  createAccretionDisk(ruleConfig, sector, hazards) {
    // Create ring of intense hazards around center
    const ringCount = 8;
    const radius = ruleConfig.radius;

    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      // Add gravitational anomaly
      const gravHazard = this.createHazardInstance('GRAVITATIONAL_ANOMALY', sector);
      if (gravHazard) {
        gravHazard.x = x;
        gravHazard.y = y;
        gravHazard.properties.pullStrength *= ruleConfig.hazardMultiplier;
        hazards.push(gravHazard);
      }

      // Add cosmic radiation
      const radHazard = this.createHazardInstance('COSMIC_RADIATION', sector);
      if (radHazard) {
        radHazard.x = x + (sector.rng.next() - 0.5) * 100;
        radHazard.y = y + (sector.rng.next() - 0.5) * 100;
        radHazard.properties.intensity *= ruleConfig.hazardMultiplier;
        hazards.push(radHazard);
      }
    }
  }

  /**
   * Apply placement patterns to organize hazards
   */
  applyPlacementPattern(sector, hazards, biomeRules) {
    const clusteringFactor = biomeRules.clusteringFactor || 0.5;
    
    if (clusteringFactor > 0.6) {
      this.applyClusteredPlacement(hazards, sector);
    } else if (clusteringFactor < 0.3) {
      this.applyScatteredPlacement(hazards, sector);
    }
    // Medium clustering (0.3-0.6) keeps original placement
  }

  /**
   * Apply clustered placement pattern
   */
  applyClusteredPlacement(hazards, sector) {
    const clusters = 2 + Math.floor(sector.rng.next() * 3); // 2-4 clusters
    const clusterCenters = [];

    // Generate cluster centers
    for (let i = 0; i < clusters; i++) {
      clusterCenters.push({
        x: (sector.rng.next() - 0.5) * 1200,
        y: (sector.rng.next() - 0.5) * 1200
      });
    }

    // Assign hazards to nearest clusters and adjust positions
    hazards.forEach(hazard => {
      let nearestCluster = clusterCenters[0];
      let minDistance = Infinity;

      for (const cluster of clusterCenters) {
        const distance = Math.sqrt(
          (hazard.x - cluster.x) ** 2 + (hazard.y - cluster.y) ** 2
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestCluster = cluster;
        }
      }

      // Move hazard closer to cluster center
      const pullStrength = 0.6;
      hazard.x += (nearestCluster.x - hazard.x) * pullStrength;
      hazard.y += (nearestCluster.y - hazard.y) * pullStrength;

      // Add some randomization to avoid perfect overlap
      hazard.x += (sector.rng.next() - 0.5) * 100;
      hazard.y += (sector.rng.next() - 0.5) * 100;
    });
  }

  /**
   * Apply scattered placement pattern
   */
  applyScatteredPlacement(hazards, sector) {
    const minDistance = 200;

    hazards.forEach((hazard, index) => {
      let attempts = 0;
      let validPosition = false;

      while (!validPosition && attempts < 20) {
        const newX = (sector.rng.next() - 0.5) * 1600;
        const newY = (sector.rng.next() - 0.5) * 1600;

        let tooClose = false;
        for (let i = 0; i < index; i++) {
          const distance = Math.sqrt(
            (newX - hazards[i].x) ** 2 + (newY - hazards[i].y) ** 2
          );
          if (distance < minDistance) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose && this.isPositionValid(newX, newY, sector)) {
          hazard.x = newX;
          hazard.y = newY;
          validPosition = true;
        }

        attempts++;
      }
    });
  }

  /**
   * Get patterns used in hazard generation
   */
  getUsedPatterns(hazards) {
    const patterns = new Set();

    hazards.forEach(hazard => {
      if (hazard.properties.pattern) {
        patterns.add(hazard.properties.pattern);
      }
    });

    return Array.from(patterns);
  }

  /**
   * Trigger a dynamic event affecting multiple sectors
   */
  async triggerDynamicEvent(eventType, centerSector, intensity = 1.0) {
    const eventDef = DYNAMIC_EVENTS[eventType];
    if (!eventDef) {
      throw new Error(`Unknown dynamic event type: ${eventType}`);
    }

    const eventId = uuidv4();
    const eventData = {
      id: eventId,
      type: eventType,
      name: eventDef.name,
      description: eventDef.description,
      centerSector: centerSector,
      affectedRadius: eventDef.affectedRadius,
      intensity: intensity,
      createdAt: Date.now(),
      expiresAt: Date.now() + (eventDef.duration.min + Math.random() * (eventDef.duration.max - eventDef.duration.min)),
      affectedSectors: []
    };

    // Determine affected sectors
    for (let dx = -eventDef.affectedRadius; dx <= eventDef.affectedRadius; dx++) {
      for (let dy = -eventDef.affectedRadius; dy <= eventDef.affectedRadius; dy++) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= eventDef.affectedRadius) {
          eventData.affectedSectors.push({
            x: centerSector.x + dx,
            y: centerSector.y + dy,
            intensity: Math.max(0.1, 1.0 - (distance / eventDef.affectedRadius))
          });
        }
      }
    }

    // Store the event
    this.dynamicEvents.set(eventId, eventData);

    // Generate hazards in affected sectors
    for (const affectedSector of eventData.affectedSectors) {
      await this.spawnEventHazards(eventType, affectedSector, eventData);
    }

    console.log(`Dynamic event "${eventDef.name}" triggered affecting ${eventData.affectedSectors.length} sectors`);
    return eventData;
  }

  /**
   * Spawn hazards for dynamic events
   */
  async spawnEventHazards(eventType, sectorCoords, eventData) {
    const eventDef = DYNAMIC_EVENTS[eventType];
    const hazardsToSpawn = eventDef.hazardTypes;

    for (const hazardType of hazardsToSpawn) {
      // Create temporary sector-like object for RNG consistency
      const tempSector = {
        coordinates: { x: sectorCoords.x, y: sectorCoords.y },
        rng: {
          seed: sectorCoords.x * 1000 + sectorCoords.y + Date.now(),
          next: function() {
            this.seed = (this.seed * 9301 + 49297) % 233280;
            return this.seed / 233280;
          }
        }
      };

      if (tempSector.rng.next() < (0.5 * sectorCoords.intensity)) {
        const hazard = this.createHazardInstance(hazardType, tempSector);
        if (hazard) {
          hazard.properties.dynamicEvent = eventData.id;
          hazard.properties.eventIntensity = sectorCoords.intensity;
          hazard.expiresAt = eventData.expiresAt; // Event hazards expire with the event

          // Save to database
          if (this.database) {
            await this.database.saveSectorHazard({
              id: hazard.id,
              sector_x: sectorCoords.x,
              sector_y: sectorCoords.y,
              hazard_type: hazard.type,
              x: hazard.x,
              y: hazard.y,
              properties: hazard.properties,
              expires_at: hazard.expiresAt
            });
          }
        }
      }
    }
  }

  /**
   * Clean up expired dynamic events
   */
  cleanupExpiredEvents() {
    const now = Date.now();
    for (const [eventId, eventData] of this.dynamicEvents.entries()) {
      if (eventData.expiresAt < now) {
        this.dynamicEvents.delete(eventId);
        console.log(`Dynamic event "${eventData.name}" has expired`);
      }
    }
  }

  /**
   * Get generation statistics
   */
  getGenerationStats() {
    const stats = {
      totalGenerated: 0,
      byBiome: {},
      byHazardType: {},
      activeDynamicEvents: this.dynamicEvents.size,
      averageHazardsPerSector: 0
    };

    let totalSectors = 0;
    for (const [sectorKey, history] of this.generationHistory.entries()) {
      totalSectors++;
      stats.totalGenerated += history.hazardCount;
      
      if (!stats.byBiome[history.biome]) {
        stats.byBiome[history.biome] = 0;
      }
      stats.byBiome[history.biome] += history.hazardCount;
    }

    if (totalSectors > 0) {
      stats.averageHazardsPerSector = stats.totalGenerated / totalSectors;
    }

    return stats;
  }

  /**
   * Handle emergency scenario events
   */
  async handleEmergencyScenario(eventType, eventData) {
    const eventDef = DYNAMIC_EVENTS[eventType];
    if (!eventDef || !eventDef.missionType) {
      return null;
    }

    const scenario = {
      id: eventData.id,
      type: eventType,
      missionType: eventDef.missionType,
      name: eventDef.name,
      description: eventDef.description,
      location: eventData.centerSector,
      rewards: eventDef.rewards,
      status: 'active',
      participants: [],
      progress: 0,
      createdAt: Date.now(),
      expiresAt: eventData.expiresAt,
      metadata: this.generateScenarioMetadata(eventDef)
    };

    // Store in database
    if (this.database) {
      await this.database.createDynamicHazardEvent({
        id: scenario.id,
        event_type: eventType,
        event_name: scenario.name,
        center_sector_x: scenario.location.x,
        center_sector_y: scenario.location.y,
        affected_radius: eventDef.affectedRadius,
        intensity: 1.0,
        created_at: Date.now(),
        expires_at: scenario.expiresAt,
        event_data: {
          mission_type: eventDef.missionType,
          mission_data: scenario.metadata,
          rewards: eventDef.rewards
        },
        affected_sectors: [scenario.location]
      });
    }

    return scenario;
  }

  /**
   * Generate scenario-specific metadata
   */
  generateScenarioMetadata(eventDef) {
    const metadata = {};

    switch (eventDef.missionType) {
      case 'rescue':
        metadata.survivors = 1 + Math.floor(Math.random() * 5);
        metadata.difficulty = ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)];
        metadata.rescueShipType = ['civilian_transport', 'research_vessel', 'cargo_freighter'][Math.floor(Math.random() * 3)];
        break;

      case 'evacuation':
        metadata.civiliansToEvacuate = eventDef.rewards.civiliansToEvacuate;
        metadata.colonyType = ['mining_outpost', 'research_station', 'agricultural_colony'][Math.floor(Math.random() * 3)];
        metadata.threatLevel = ['moderate', 'severe', 'critical'][Math.floor(Math.random() * 3)];
        metadata.evacuationShipsRequired = Math.ceil(metadata.civiliansToEvacuate / 10);
        break;

      case 'disaster_relief':
        metadata.suppliesNeeded = eventDef.rewards.suppliesNeeded;
        metadata.disasterType = ['earthquake', 'volcanic_eruption', 'meteor_impact'][Math.floor(Math.random() * 3)];
        metadata.affectedPopulation = 100 + Math.floor(Math.random() * 500);
        metadata.urgencyLevel = ['high', 'critical'][Math.floor(Math.random() * 2)];
        break;

      case 'combat_assistance':
        metadata.pirateCount = eventDef.rewards.pirates;
        metadata.convoySize = 2 + Math.floor(Math.random() * 4);
        metadata.cargoValue = 1000 + Math.floor(Math.random() * 5000);
        metadata.pirateShipTypes = ['fighter', 'raider', 'destroyer'];
        break;

      case 'medical_supply':
        metadata.medicalSuppliesNeeded = eventDef.rewards.medicalSuppliesNeeded;
        metadata.plagueType = ['radiation_sickness', 'alien_pathogen', 'genetic_disorder'][Math.floor(Math.random() * 3)];
        metadata.infectedPopulation = 50 + Math.floor(Math.random() * 200);
        metadata.timeRemaining = eventDef.duration.min;
        break;
    }

    return metadata;
  }

  /**
   * Process emergency scenario participation
   */
  async processScenarioParticipation(scenarioId, playerId, actionType, actionData) {
    const scenario = this.dynamicEvents.get(scenarioId);
    if (!scenario || scenario.status !== 'active') {
      return { success: false, message: 'Scenario not found or inactive' };
    }

    const result = { success: false, message: 'Unknown error', rewards: null };

    switch (scenario.missionType) {
      case 'rescue':
        result = await this.processRescueMission(scenario, playerId, actionType, actionData);
        break;

      case 'evacuation':
        result = await this.processEvacuationMission(scenario, playerId, actionType, actionData);
        break;

      case 'disaster_relief':
        result = await this.processDisasterReliefMission(scenario, playerId, actionType, actionData);
        break;

      case 'combat_assistance':
        result = await this.processCombatAssistance(scenario, playerId, actionType, actionData);
        break;

      case 'medical_supply':
        result = await this.processMedicalSupplyMission(scenario, playerId, actionType, actionData);
        break;
    }

    // Update scenario progress
    if (result.success) {
      scenario.progress += result.progressIncrease || 0;
      
      if (!scenario.participants.includes(playerId)) {
        scenario.participants.push(playerId);
      }

      // Check if scenario is completed
      if (scenario.progress >= 100) {
        scenario.status = 'completed';
        await this.completeScenario(scenario);
      }
    }

    return result;
  }

  /**
   * Process rescue mission actions
   */
  async processRescueMission(scenario, playerId, actionType, actionData) {
    if (actionType === 'rescue_survivors') {
      const rescued = Math.min(actionData.capacity || 5, scenario.metadata.survivors);
      scenario.metadata.survivors -= rescued;
      
      const progressIncrease = (rescued / (scenario.metadata.survivors + rescued)) * 100;
      
      return {
        success: true,
        message: `Rescued ${rescued} survivors`,
        progressIncrease,
        rewards: {
          experience: Math.floor(scenario.rewards.experience * (rescued / 5)),
          resources: Math.floor(scenario.rewards.resources * (rescued / 5)),
          reputation: Math.floor(scenario.rewards.reputation * (rescued / 5))
        }
      };
    }
    
    return { success: false, message: 'Invalid rescue action' };
  }

  /**
   * Process evacuation mission actions
   */
  async processEvacuationMission(scenario, playerId, actionType, actionData) {
    if (actionType === 'evacuate_civilians') {
      const evacuated = Math.min(actionData.capacity || 10, scenario.metadata.civiliansToEvacuate);
      scenario.metadata.civiliansToEvacuate -= evacuated;
      
      const progressIncrease = (evacuated / (scenario.metadata.civiliansToEvacuate + evacuated)) * 100;
      
      return {
        success: true,
        message: `Evacuated ${evacuated} civilians`,
        progressIncrease,
        rewards: {
          experience: Math.floor(scenario.rewards.experience * (evacuated / 50)),
          resources: Math.floor(scenario.rewards.resources * (evacuated / 50)),
          reputation: Math.floor(scenario.rewards.reputation * (evacuated / 50))
        }
      };
    }
    
    return { success: false, message: 'Invalid evacuation action' };
  }

  /**
   * Process disaster relief mission actions
   */
  async processDisasterReliefMission(scenario, playerId, actionType, actionData) {
    if (actionType === 'deliver_supplies') {
      const delivered = Math.min(actionData.supplies || 10, scenario.metadata.suppliesNeeded);
      scenario.metadata.suppliesNeeded -= delivered;
      
      const progressIncrease = (delivered / (scenario.metadata.suppliesNeeded + delivered)) * 100;
      
      return {
        success: true,
        message: `Delivered ${delivered} supply units`,
        progressIncrease,
        rewards: {
          experience: Math.floor(scenario.rewards.experience * (delivered / 100)),
          resources: Math.floor(scenario.rewards.resources * (delivered / 100)),
          reputation: Math.floor(scenario.rewards.reputation * (delivered / 100))
        }
      };
    }
    
    return { success: false, message: 'Invalid relief action' };
  }

  /**
   * Process combat assistance actions
   */
  async processCombatAssistance(scenario, playerId, actionType, actionData) {
    if (actionType === 'defeat_pirates') {
      const defeated = Math.min(actionData.defeated || 1, scenario.metadata.pirateCount);
      scenario.metadata.pirateCount -= defeated;
      
      const progressIncrease = (defeated / (scenario.metadata.pirateCount + defeated)) * 100;
      
      return {
        success: true,
        message: `Defeated ${defeated} pirate ships`,
        progressIncrease,
        rewards: {
          experience: Math.floor(scenario.rewards.experience * (defeated / 3)),
          resources: Math.floor(scenario.rewards.resources * (defeated / 3)),
          reputation: Math.floor(scenario.rewards.reputation * (defeated / 3))
        }
      };
    }
    
    return { success: false, message: 'Invalid combat action' };
  }

  /**
   * Process medical supply mission actions
   */
  async processMedicalSupplyMission(scenario, playerId, actionType, actionData) {
    if (actionType === 'deliver_medical_supplies') {
      const delivered = Math.min(actionData.supplies || 5, scenario.metadata.medicalSuppliesNeeded);
      scenario.metadata.medicalSuppliesNeeded -= delivered;
      
      const progressIncrease = (delivered / (scenario.metadata.medicalSuppliesNeeded + delivered)) * 100;
      
      return {
        success: true,
        message: `Delivered ${delivered} medical supply units`,
        progressIncrease,
        rewards: {
          experience: Math.floor(scenario.rewards.experience * (delivered / 25)),
          resources: Math.floor(scenario.rewards.resources * (delivered / 25)),
          reputation: Math.floor(scenario.rewards.reputation * (delivered / 25))
        }
      };
    }
    
    return { success: false, message: 'Invalid medical action' };
  }

  /**
   * Complete a scenario and distribute final rewards
   */
  async completeScenario(scenario) {
    console.log(`Emergency scenario "${scenario.name}" completed with ${scenario.participants.length} participants`);
    
    // Mark event as completed in database
    if (this.database) {
      await this.database.expireDynamicHazardEvent(scenario.id);
    }
    
    // Remove from active events
    this.dynamicEvents.delete(scenario.id);
  }

  /**
   * Get active emergency scenarios
   */
  getActiveEmergencyScenarios() {
    const scenarios = [];
    
    for (const [eventId, eventData] of this.dynamicEvents.entries()) {
      const eventDef = DYNAMIC_EVENTS[eventData.type];
      if (eventDef && eventDef.missionType) {
        scenarios.push({
          id: eventId,
          type: eventData.type,
          missionType: eventDef.missionType,
          name: eventDef.name,
          description: eventDef.description,
          location: eventData.centerSector,
          rewards: eventDef.rewards,
          expiresAt: eventData.expiresAt,
          metadata: eventData.metadata || {},
          participants: eventData.participants || [],
          progress: eventData.progress || 0
        });
      }
    }
    
    return scenarios;
  }
}

module.exports = { HazardGenerator, BIOME_HAZARD_RULES, PLACEMENT_PATTERNS, DYNAMIC_EVENTS };