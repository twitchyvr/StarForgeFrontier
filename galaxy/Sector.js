/**
 * Sector.js - Individual sector representation in the galaxy
 * Handles sector-specific data including resources, biomes, and environmental effects
 */

const { v4: uuidv4 } = require('uuid');

// Biome definitions with unique characteristics
const BIOME_TYPES = {
  ASTEROID_FIELD: {
    name: 'Asteroid Field',
    description: 'Dense asteroid clusters rich in common ores',
    baseOreSpawnRate: 1.5,
    oreTypes: ['iron', 'copper', 'aluminum'],
    environmentalEffects: { warpCostMultiplier: 0.9 },
    color: '#8B7355'
  },
  NEBULA: {
    name: 'Nebula',
    description: 'Colorful gas clouds with rare energy crystals',
    baseOreSpawnRate: 0.8,
    oreTypes: ['energy_crystal', 'hydrogen', 'helium'],
    environmentalEffects: { warpCostMultiplier: 1.3, visibilityReduction: 0.7 },
    color: '#FF6B9D'
  },
  DEEP_SPACE: {
    name: 'Deep Space',
    description: 'Empty void with occasional rare materials',
    baseOreSpawnRate: 0.3,
    oreTypes: ['dark_matter', 'quantum_core'],
    environmentalEffects: { warpCostMultiplier: 0.7 },
    color: '#1a1a2e'
  },
  STELLAR_NURSERY: {
    name: 'Stellar Nursery',
    description: 'Young star formation region with exotic matter',
    baseOreSpawnRate: 1.2,
    oreTypes: ['plasma_core', 'stellar_carbon', 'fusion_catalyst'],
    environmentalEffects: { warpCostMultiplier: 1.5, radiationDamage: 2 },
    color: '#FFD700'
  },
  ANCIENT_RUINS: {
    name: 'Ancient Ruins',
    description: 'Remnants of an ancient civilization with advanced materials',
    baseOreSpawnRate: 0.6,
    oreTypes: ['ancient_alloy', 'nanotubes', 'quantum_processor'],
    environmentalEffects: { warpCostMultiplier: 1.1, ancientTech: true },
    color: '#4A90E2'
  },
  BLACK_HOLE_REGION: {
    name: 'Black Hole Region',
    description: 'Dangerous gravitational anomaly with compressed matter',
    baseOreSpawnRate: 0.4,
    oreTypes: ['compressed_matter', 'graviton_particle', 'singularity_core'],
    environmentalEffects: { warpCostMultiplier: 2.0, gravitationalPull: true },
    color: '#2C003E'
  }
};

// Ore type definitions with rarity and value
const ORE_TYPES = {
  // Common ores (Asteroid Fields)
  iron: { value: 25, rarity: 0.4, name: 'Iron Ore', color: '#CD853F' },
  copper: { value: 30, rarity: 0.35, name: 'Copper Ore', color: '#B87333' },
  aluminum: { value: 35, rarity: 0.25, name: 'Aluminum Ore', color: '#A8A8A8' },
  
  // Nebula ores
  energy_crystal: { value: 75, rarity: 0.15, name: 'Energy Crystal', color: '#00FFFF' },
  hydrogen: { value: 20, rarity: 0.5, name: 'Hydrogen Gas', color: '#E6E6FA' },
  helium: { value: 40, rarity: 0.35, name: 'Helium-3', color: '#FFFFE0' },
  
  // Deep space ores
  dark_matter: { value: 200, rarity: 0.05, name: 'Dark Matter', color: '#301934' },
  quantum_core: { value: 150, rarity: 0.08, name: 'Quantum Core', color: '#9370DB' },
  
  // Stellar nursery ores
  plasma_core: { value: 100, rarity: 0.12, name: 'Plasma Core', color: '#FF4500' },
  stellar_carbon: { value: 80, rarity: 0.18, name: 'Stellar Carbon', color: '#2F4F4F' },
  fusion_catalyst: { value: 120, rarity: 0.10, name: 'Fusion Catalyst', color: '#FFD700' },
  
  // Ancient ruins ores
  ancient_alloy: { value: 180, rarity: 0.06, name: 'Ancient Alloy', color: '#4682B4' },
  nanotubes: { value: 90, rarity: 0.14, name: 'Carbon Nanotubes', color: '#696969' },
  quantum_processor: { value: 250, rarity: 0.04, name: 'Quantum Processor', color: '#00CED1' },
  
  // Black hole region ores
  compressed_matter: { value: 300, rarity: 0.03, name: 'Compressed Matter', color: '#000080' },
  graviton_particle: { value: 220, rarity: 0.05, name: 'Graviton Particle', color: '#483D8B' },
  singularity_core: { value: 500, rarity: 0.01, name: 'Singularity Core', color: '#191970' }
};

class Sector {
  constructor(coordinates, seed, biomeType = null) {
    this.coordinates = coordinates; // { x, y }
    this.seed = seed;
    this.id = `sector_${coordinates.x}_${coordinates.y}`;
    
    // Create RNG before generating biome
    this.rng = this.createSeededRNG(seed);
    
    this.biome = biomeType || this.generateBiome();
    this.ores = [];
    this.events = [];
    this.lastUpdated = Date.now();
    this.isLoaded = false;
    this.playerCount = 0;
    
    // Environmental state
    this.environmentalHazards = [];
    this.dynamicEvents = [];
  }

  /**
   * Create a seeded random number generator for consistent procedural generation
   */
  createSeededRNG(seed) {
    return {
      seed: seed,
      next: function() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
      }
    };
  }

  /**
   * Generate biome type based on sector coordinates and seed
   */
  generateBiome() {
    const biomeKeys = Object.keys(BIOME_TYPES);
    const distanceFromCenter = Math.sqrt(this.coordinates.x ** 2 + this.coordinates.y ** 2);
    
    // Bias biome distribution based on distance from galactic center
    let biomeWeights = {};
    
    if (distanceFromCenter < 5) {
      // Inner galaxy - more stellar nurseries and black hole regions
      biomeWeights = {
        ASTEROID_FIELD: 0.2,
        NEBULA: 0.2,
        DEEP_SPACE: 0.1,
        STELLAR_NURSERY: 0.3,
        ANCIENT_RUINS: 0.15,
        BLACK_HOLE_REGION: 0.05
      };
    } else if (distanceFromCenter < 15) {
      // Mid galaxy - balanced distribution
      biomeWeights = {
        ASTEROID_FIELD: 0.25,
        NEBULA: 0.25,
        DEEP_SPACE: 0.2,
        STELLAR_NURSERY: 0.15,
        ANCIENT_RUINS: 0.1,
        BLACK_HOLE_REGION: 0.05
      };
    } else {
      // Outer galaxy - more deep space and asteroid fields
      biomeWeights = {
        ASTEROID_FIELD: 0.35,
        NEBULA: 0.15,
        DEEP_SPACE: 0.4,
        STELLAR_NURSERY: 0.05,
        ANCIENT_RUINS: 0.04,
        BLACK_HOLE_REGION: 0.01
      };
    }
    
    const random = this.rng.next();
    let cumulativeWeight = 0;
    
    for (const [biomeType, weight] of Object.entries(biomeWeights)) {
      cumulativeWeight += weight;
      if (random <= cumulativeWeight) {
        return BIOME_TYPES[biomeType];
      }
    }
    
    return BIOME_TYPES.ASTEROID_FIELD; // Fallback
  }

  /**
   * Load sector data and generate initial content
   */
  async load() {
    if (this.isLoaded) {
      return;
    }

    // Generate initial ores based on biome
    this.generateOres();
    
    // Generate environmental hazards
    this.generateEnvironmentalHazards();
    
    // Schedule dynamic events
    this.scheduleDynamicEvents();
    
    this.isLoaded = true;
    this.lastUpdated = Date.now();
    
    console.log(`Sector ${this.id} loaded - Biome: ${this.biome.name}, Ores: ${this.ores.length}`);
  }

  /**
   * Unload sector data to free memory
   */
  unload() {
    if (!this.isLoaded || this.playerCount > 0) {
      return false; // Don't unload if players are present
    }

    this.ores = [];
    this.events = [];
    this.environmentalHazards = [];
    this.dynamicEvents = [];
    this.isLoaded = false;
    
    console.log(`Sector ${this.id} unloaded`);
    return true;
  }

  /**
   * Generate ores based on biome characteristics
   */
  generateOres() {
    const baseCount = Math.floor(15 + this.rng.next() * 10); // 15-25 base ores
    const biomeCount = Math.floor(baseCount * this.biome.baseOreSpawnRate);
    
    this.ores = [];
    
    for (let i = 0; i < biomeCount; i++) {
      const oreType = this.selectOreType();
      const ore = {
        id: uuidv4(),
        type: oreType,
        x: (this.rng.next() - 0.5) * 2000, // -1000 to 1000
        y: (this.rng.next() - 0.5) * 2000,
        value: ORE_TYPES[oreType].value,
        spawnedAt: Date.now(),
        ...ORE_TYPES[oreType]
      };
      
      this.ores.push(ore);
    }
  }

  /**
   * Select ore type based on biome and rarity
   */
  selectOreType() {
    const availableOres = this.biome.oreTypes;
    const random = this.rng.next();
    let cumulativeRarity = 0;
    
    // Sort ores by rarity (most common first)
    const sortedOres = availableOres.sort((a, b) => ORE_TYPES[b].rarity - ORE_TYPES[a].rarity);
    
    for (const oreType of sortedOres) {
      cumulativeRarity += ORE_TYPES[oreType].rarity;
      if (random <= cumulativeRarity) {
        return oreType;
      }
    }
    
    return availableOres[0]; // Fallback to first ore type
  }

  /**
   * Generate environmental hazards specific to the biome
   * Now uses the comprehensive HazardGenerator system
   */
  generateEnvironmentalHazards() {
    // Initialize with empty array for backwards compatibility
    this.environmentalHazards = [];
    
    // The comprehensive hazard generation is now handled by HazardGenerator
    // This method is kept for backwards compatibility but will be replaced
    // by the new system in the enhanced sector loading process
    
    // Legacy hazard generation for compatibility
    switch (this.biome.name) {
      case 'Black Hole Region':
        // Gravitational anomalies (now compatible with new system)
        for (let i = 0; i < 2 + Math.floor(this.rng.next() * 3); i++) {
          this.environmentalHazards.push({
            id: uuidv4(),
            type: 'GRAVITATIONAL_ANOMALY', // Updated to match new system
            x: (this.rng.next() - 0.5) * 1800,
            y: (this.rng.next() - 0.5) * 1800,
            properties: {
              pullStrength: 0.3 + this.rng.next() * 0.7,
              radius: 100 + this.rng.next() * 100
            },
            magnitude: 0.5 + this.rng.next() * 0.5,
            createdAt: Date.now(),
            isActive: true
          });
        }
        break;
        
      case 'Stellar Nursery':
        // Cosmic radiation zones (updated)
        for (let i = 0; i < 1 + Math.floor(this.rng.next() * 2); i++) {
          this.environmentalHazards.push({
            id: uuidv4(),
            type: 'COSMIC_RADIATION', // Updated to match new system
            x: (this.rng.next() - 0.5) * 1600,
            y: (this.rng.next() - 0.5) * 1600,
            properties: {
              intensity: 1 + this.rng.next() * 4,
              radius: 150 + this.rng.next() * 150,
              radiationType: 'stellar'
            },
            magnitude: 0.6 + this.rng.next() * 0.4,
            createdAt: Date.now(),
            isActive: true
          });
        }
        break;
        
      case 'Nebula':
        // Nebula interference (updated)
        this.environmentalHazards.push({
          id: uuidv4(),
          type: 'NEBULA_INTERFERENCE', // Updated to match new system
          x: 0, // Sector-wide effect
          y: 0,
          properties: {
            gasType: 'ionized',
            density: 0.4 + this.rng.next() * 0.4,
            electricalActivity: this.rng.next() > 0.4
          },
          magnitude: 0.5 + this.rng.next() * 0.3,
          createdAt: Date.now(),
          isActive: true
        });
        
        // Magnetic storms in nebulae
        if (this.rng.next() < 0.3) {
          this.environmentalHazards.push({
            id: uuidv4(),
            type: 'MAGNETIC_STORM',
            x: (this.rng.next() - 0.5) * 2000,
            y: (this.rng.next() - 0.5) * 2000,
            properties: {
              fieldStrength: 0.5 + this.rng.next() * 0.5,
              duration: 30000 + this.rng.next() * 60000,
              startTime: Date.now() + this.rng.next() * 300000
            },
            magnitude: 0.4 + this.rng.next() * 0.4,
            createdAt: Date.now(),
            isActive: true,
            expiresAt: Date.now() + 30000 + this.rng.next() * 60000
          });
        }
        break;
    }
  }

  /**
   * Schedule dynamic events for this sector
   */
  scheduleDynamicEvents() {
    this.dynamicEvents = [];
    
    // Supernova events (reduced frequency per sector)
    if (this.rng.next() < 0.1) { // 10% chance per sector
      const delay = 60000 + this.rng.next() * 300000; // 1-6 minutes
      this.scheduleSectorEvent('supernova', delay);
    }
    
    // Biome-specific events
    switch (this.biome.name) {
      case 'Ancient Ruins':
        // Ancient technology activation
        if (this.rng.next() < 0.2) {
          const delay = 120000 + this.rng.next() * 600000; // 2-12 minutes
          this.scheduleSectorEvent('tech_activation', delay);
        }
        break;
        
      case 'Asteroid Field':
        // Asteroid collapse creating ore clusters
        if (this.rng.next() < 0.3) {
          const delay = 90000 + this.rng.next() * 180000; // 1.5-4.5 minutes
          this.scheduleSectorEvent('asteroid_collapse', delay);
        }
        break;
    }
  }

  /**
   * Schedule a sector-specific event
   */
  scheduleSectorEvent(eventType, delayMs) {
    const event = {
      type: eventType,
      sectorId: this.id,
      x: (this.rng.next() - 0.5) * 1800,
      y: (this.rng.next() - 0.5) * 1800,
      triggerAt: Date.now() + delayMs
    };
    
    this.dynamicEvents.push(event);
  }

  /**
   * Process events that are ready to trigger
   */
  processEvents() {
    const now = Date.now();
    const triggeredEvents = [];
    
    this.dynamicEvents = this.dynamicEvents.filter(event => {
      if (event.triggerAt <= now) {
        triggeredEvents.push(event);
        return false;
      }
      return true;
    });
    
    // Process each triggered event
    for (const event of triggeredEvents) {
      this.executeEvent(event);
    }
    
    return triggeredEvents;
  }

  /**
   * Execute a specific event in this sector
   */
  executeEvent(event) {
    switch (event.type) {
      case 'supernova':
        this.executeSupernovaEvent(event);
        break;
      case 'tech_activation':
        this.executeTechActivationEvent(event);
        break;
      case 'asteroid_collapse':
        this.executeAsteroidCollapseEvent(event);
        break;
    }
  }

  /**
   * Execute supernova event - creates high-value ore cluster
   */
  executeSupernovaEvent(event) {
    const oreCount = 20 + Math.floor(this.rng.next() * 20); // 20-40 ores
    
    for (let i = 0; i < oreCount; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      const distance = this.rng.next() * 200;
      
      // Higher chance of rare ores from supernova
      const oreType = this.selectSupernovaOreType();
      
      this.ores.push({
        id: uuidv4(),
        type: oreType,
        x: event.x + Math.cos(angle) * distance,
        y: event.y + Math.sin(angle) * distance,
        value: ORE_TYPES[oreType].value * 2, // Double value for supernova ores
        spawnedAt: Date.now(),
        isSupernova: true,
        ...ORE_TYPES[oreType]
      });
    }
    
    // Schedule next supernova for this sector
    const delay = (10 + this.rng.next() * 20) * 60 * 1000; // 10-30 minutes
    this.scheduleSectorEvent('supernova', delay);
  }

  /**
   * Select ore type for supernova events (biased toward rare ores)
   */
  selectSupernovaOreType() {
    const allOreTypes = Object.keys(ORE_TYPES);
    const rareOreTypes = allOreTypes.filter(type => ORE_TYPES[type].rarity <= 0.15);
    
    if (this.rng.next() < 0.6 && rareOreTypes.length > 0) {
      // 60% chance for rare ore
      return rareOreTypes[Math.floor(this.rng.next() * rareOreTypes.length)];
    } else {
      // Use biome-specific ores
      return this.selectOreType();
    }
  }

  /**
   * Execute tech activation event (Ancient Ruins)
   */
  executeTechActivationEvent(event) {
    // Spawn ancient technology ores
    const techOres = ['ancient_alloy', 'quantum_processor', 'nanotubes'];
    
    for (let i = 0; i < 5 + Math.floor(this.rng.next() * 5); i++) {
      const oreType = techOres[Math.floor(this.rng.next() * techOres.length)];
      
      this.ores.push({
        id: uuidv4(),
        type: oreType,
        x: event.x + (this.rng.next() - 0.5) * 300,
        y: event.y + (this.rng.next() - 0.5) * 300,
        value: ORE_TYPES[oreType].value * 1.5,
        spawnedAt: Date.now(),
        isTechActivation: true,
        ...ORE_TYPES[oreType]
      });
    }
  }

  /**
   * Execute asteroid collapse event
   */
  executeAsteroidCollapseEvent(event) {
    // Create dense cluster of common ores
    const commonOres = ['iron', 'copper', 'aluminum'];
    
    for (let i = 0; i < 15 + Math.floor(this.rng.next() * 10); i++) {
      const oreType = commonOres[Math.floor(this.rng.next() * commonOres.length)];
      const angle = this.rng.next() * Math.PI * 2;
      const distance = this.rng.next() * 150;
      
      this.ores.push({
        id: uuidv4(),
        type: oreType,
        x: event.x + Math.cos(angle) * distance,
        y: event.y + Math.sin(angle) * distance,
        value: ORE_TYPES[oreType].value,
        spawnedAt: Date.now(),
        isAsteroidCollapse: true,
        ...ORE_TYPES[oreType]
      });
    }
  }

  /**
   * Remove an ore from this sector
   */
  removeOre(oreId) {
    this.ores = this.ores.filter(ore => ore.id !== oreId);
  }

  /**
   * Get sector data for serialization
   */
  getSectorData() {
    return {
      id: this.id,
      coordinates: this.coordinates,
      biome: {
        name: this.biome.name,
        description: this.biome.description,
        color: this.biome.color,
        environmentalEffects: this.biome.environmentalEffects
      },
      ores: this.ores,
      environmentalHazards: this.environmentalHazards,
      playerCount: this.playerCount,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Update sector state (called by SectorManager)
   */
  update() {
    // Process scheduled events
    const triggeredEvents = this.processEvents();
    
    // Update environmental hazards
    this.updateEnvironmentalHazards();
    
    // Respawn ores if sector is getting depleted
    if (this.ores.length < 5 && this.playerCount > 0) {
      this.respawnOres();
    }
    
    this.lastUpdated = Date.now();
    
    return triggeredEvents;
  }

  /**
   * Update environmental hazards (move ion storms, etc.)
   */
  updateEnvironmentalHazards() {
    const now = Date.now();
    
    this.environmentalHazards = this.environmentalHazards.filter(hazard => {
      if (hazard.type === 'ion_storm' && hazard.duration) {
        return (now - hazard.startTime) < hazard.duration;
      }
      return true;
    });
  }

  /**
   * Respawn ores when sector is depleted
   */
  respawnOres() {
    const neededOres = Math.max(0, 10 - this.ores.length);
    
    for (let i = 0; i < neededOres; i++) {
      const oreType = this.selectOreType();
      
      this.ores.push({
        id: uuidv4(),
        type: oreType,
        x: (this.rng.next() - 0.5) * 2000,
        y: (this.rng.next() - 0.5) * 2000,
        value: ORE_TYPES[oreType].value,
        spawnedAt: Date.now(),
        isRespawned: true,
        ...ORE_TYPES[oreType]
      });
    }
  }

  /**
   * Calculate warp cost modifier for leaving this sector
   */
  getWarpCostModifier() {
    return this.biome.environmentalEffects.warpCostMultiplier || 1.0;
  }

  /**
   * Check if coordinates are within this sector's bounds
   */
  containsPosition(x, y) {
    // Each sector covers a 2000x2000 area centered on 0,0
    return Math.abs(x) <= 1000 && Math.abs(y) <= 1000;
  }

  /**
   * Add a player to this sector
   */
  addPlayer(playerId) {
    this.playerCount++;
  }

  /**
   * Remove a player from this sector
   */
  removePlayer(playerId) {
    this.playerCount = Math.max(0, this.playerCount - 1);
  }
}

module.exports = { Sector, BIOME_TYPES, ORE_TYPES };