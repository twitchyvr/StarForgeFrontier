/**
 * ProceduralGeneration.js - Handles seed-based procedural generation for the galaxy
 * Generates consistent sectors, biomes, and distributions using deterministic algorithms
 */

const { BIOME_TYPES } = require('./Sector');

class ProceduralGeneration {
  constructor(galaxySeed = 12345) {
    this.galaxySeed = galaxySeed;
    this.noiseCache = new Map(); // Cache for performance
  }

  /**
   * Generate a consistent seed for a sector based on coordinates
   */
  generateSectorSeed(x, y) {
    // Use galaxy seed + coordinates to generate consistent sector seed
    const combined = this.galaxySeed + (x * 73856093) + (y * 19349663);
    return this.hashSeed(combined);
  }

  /**
   * Hash function for seed generation
   */
  hashSeed(seed) {
    let hash = seed;
    hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
    hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
    hash = (hash >> 16) ^ hash;
    return Math.abs(hash);
  }

  /**
   * Generate biome for a sector based on galactic position and patterns
   */
  generateSectorBiome(coordinates, seed) {
    const rng = this.createSeededRNG(seed);
    const distanceFromCenter = Math.sqrt(coordinates.x ** 2 + coordinates.y ** 2);
    
    // Generate noise values for different characteristics
    const biomeNoise = this.generateNoise(coordinates.x, coordinates.y, 0.1);
    const rarityNoise = this.generateNoise(coordinates.x, coordinates.y, 0.05);
    const spiralNoise = this.generateSpiralNoise(coordinates.x, coordinates.y);
    
    // Calculate biome weights based on galactic structure
    const biomeWeights = this.calculateBiomeWeights(
      coordinates, 
      distanceFromCenter, 
      biomeNoise, 
      rarityNoise, 
      spiralNoise
    );
    
    // Select biome based on weights
    const random = rng.next();
    let cumulativeWeight = 0;
    
    for (const [biomeKey, weight] of Object.entries(biomeWeights)) {
      cumulativeWeight += weight;
      if (random <= cumulativeWeight) {
        return BIOME_TYPES[biomeKey];
      }
    }
    
    return BIOME_TYPES.DEEP_SPACE; // Fallback
  }

  /**
   * Calculate biome distribution weights based on galactic position
   */
  calculateBiomeWeights(coordinates, distanceFromCenter, biomeNoise, rarityNoise, spiralNoise) {
    const { x, y } = coordinates;
    
    // Base weights by galactic zone
    let weights = {};
    
    if (distanceFromCenter < 3) {
      // Galactic core - high energy, dangerous
      weights = {
        ASTEROID_FIELD: 0.1,
        NEBULA: 0.15,
        DEEP_SPACE: 0.05,
        STELLAR_NURSERY: 0.35,
        ANCIENT_RUINS: 0.25,
        BLACK_HOLE_REGION: 0.1
      };
    } else if (distanceFromCenter < 8) {
      // Inner spiral arms - active star formation
      weights = {
        ASTEROID_FIELD: 0.2,
        NEBULA: 0.3,
        DEEP_SPACE: 0.1,
        STELLAR_NURSERY: 0.25,
        ANCIENT_RUINS: 0.1,
        BLACK_HOLE_REGION: 0.05
      };
    } else if (distanceFromCenter < 20) {
      // Mid galaxy - balanced regions
      weights = {
        ASTEROID_FIELD: 0.3,
        NEBULA: 0.25,
        DEEP_SPACE: 0.2,
        STELLAR_NURSERY: 0.15,
        ANCIENT_RUINS: 0.08,
        BLACK_HOLE_REGION: 0.02
      };
    } else if (distanceFromCenter < 35) {
      // Outer galaxy - sparse resources
      weights = {
        ASTEROID_FIELD: 0.4,
        NEBULA: 0.15,
        DEEP_SPACE: 0.35,
        STELLAR_NURSERY: 0.05,
        ANCIENT_RUINS: 0.04,
        BLACK_HOLE_REGION: 0.01
      };
    } else {
      // Galaxy rim - mostly empty space
      weights = {
        ASTEROID_FIELD: 0.3,
        NEBULA: 0.1,
        DEEP_SPACE: 0.55,
        STELLAR_NURSERY: 0.03,
        ANCIENT_RUINS: 0.02,
        BLACK_HOLE_REGION: 0.0
      };
    }
    
    // Apply noise-based modifications
    this.applyNoiseModifications(weights, biomeNoise, rarityNoise, spiralNoise);
    
    // Apply special formations
    this.applySpecialFormations(weights, coordinates, distanceFromCenter);
    
    return weights;
  }

  /**
   * Apply noise-based modifications to biome weights
   */
  applyNoiseModifications(weights, biomeNoise, rarityNoise, spiralNoise) {
    // Biome noise affects common vs rare biomes
    const commonBiomes = ['ASTEROID_FIELD', 'DEEP_SPACE'];
    const rareBiomes = ['ANCIENT_RUINS', 'BLACK_HOLE_REGION'];
    
    if (biomeNoise > 0.7) {
      // High noise favors uncommon biomes
      for (const biome of commonBiomes) {
        weights[biome] *= 0.7;
      }
      weights['NEBULA'] *= 1.3;
      weights['STELLAR_NURSERY'] *= 1.2;
    }
    
    if (rarityNoise > 0.8) {
      // Very high rarity noise creates rare biome clusters
      for (const biome of rareBiomes) {
        weights[biome] *= 3.0;
      }
    }
    
    // Spiral noise creates spiral arm patterns
    if (spiralNoise > 0.6) {
      weights['STELLAR_NURSERY'] *= 1.5;
      weights['NEBULA'] *= 1.3;
    }
  }

  /**
   * Apply special galactic formations
   */
  applySpecialFormations(weights, coordinates, distanceFromCenter) {
    const { x, y } = coordinates;
    
    // Central black hole region
    if (distanceFromCenter < 2) {
      weights['BLACK_HOLE_REGION'] *= 5.0;
      weights['DEEP_SPACE'] *= 0.1;
    }
    
    // Ancient civilization ruins in specific patterns
    const ruinPattern = this.generateNoise(x * 0.3, y * 0.3, 0.2);
    if (ruinPattern > 0.85 && distanceFromCenter > 5 && distanceFromCenter < 25) {
      weights['ANCIENT_RUINS'] *= 4.0;
    }
    
    // Nebula clusters along spiral arms
    const spiralArm = this.calculateSpiralArmProximity(x, y);
    if (spiralArm > 0.7) {
      weights['NEBULA'] *= 2.0;
      weights['STELLAR_NURSERY'] *= 1.5;
    }
  }

  /**
   * Calculate proximity to spiral arms
   */
  calculateSpiralArmProximity(x, y) {
    const angle = Math.atan2(y, x);
    const radius = Math.sqrt(x * x + y * y);
    
    // Two main spiral arms
    const arm1Angle = angle + radius * 0.1;
    const arm2Angle = angle + radius * 0.1 + Math.PI;
    
    const arm1Proximity = Math.abs(Math.sin(arm1Angle * 2));
    const arm2Proximity = Math.abs(Math.sin(arm2Angle * 2));
    
    return Math.max(arm1Proximity, arm2Proximity);
  }

  /**
   * Generate spiral noise pattern
   */
  generateSpiralNoise(x, y) {
    const angle = Math.atan2(y, x);
    const radius = Math.sqrt(x * x + y * y);
    
    // Create spiral pattern
    const spiralAngle = angle + radius * 0.2;
    const spiralValue = (Math.sin(spiralAngle) + 1) / 2;
    
    // Combine with radial pattern
    const radialPattern = Math.sin(radius * 0.1) * 0.5 + 0.5;
    
    return (spiralValue + radialPattern) / 2;
  }

  /**
   * Generate Perlin-like noise for natural patterns
   */
  generateNoise(x, y, frequency = 0.1) {
    const cacheKey = `${x}_${y}_${frequency}`;
    
    if (this.noiseCache.has(cacheKey)) {
      return this.noiseCache.get(cacheKey);
    }
    
    // Simple noise implementation using trigonometric functions
    const noise = (
      Math.sin(x * frequency) * Math.cos(y * frequency) +
      Math.sin(x * frequency * 2) * Math.cos(y * frequency * 2) * 0.5 +
      Math.sin(x * frequency * 4) * Math.cos(y * frequency * 4) * 0.25
    );
    
    const normalizedNoise = (noise + 1.75) / 3.5; // Normalize to 0-1
    
    // Cache the result
    this.noiseCache.set(cacheKey, normalizedNoise);
    
    return normalizedNoise;
  }

  /**
   * Create a seeded random number generator
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
   * Generate resource distribution modifiers for a sector
   */
  generateResourceModifiers(coordinates, biome, seed) {
    const rng = this.createSeededRNG(seed);
    const distanceFromCenter = Math.sqrt(coordinates.x ** 2 + coordinates.y ** 2);
    
    // Base modifiers
    let modifiers = {
      spawnRateMultiplier: 1.0,
      valueMultiplier: 1.0,
      rarityBonus: 0.0
    };
    
    // Distance-based modifiers
    if (distanceFromCenter > 30) {
      // Outer rim has fewer but more valuable resources
      modifiers.spawnRateMultiplier *= 0.6;
      modifiers.valueMultiplier *= 1.4;
    } else if (distanceFromCenter < 5) {
      // Inner galaxy has more resources but higher competition
      modifiers.spawnRateMultiplier *= 1.3;
      modifiers.rarityBonus += 0.1;
    }
    
    // Random variations
    modifiers.spawnRateMultiplier *= (0.8 + rng.next() * 0.4); // ±20% variation
    modifiers.valueMultiplier *= (0.9 + rng.next() * 0.2); // ±10% variation
    
    // Biome-specific modifiers
    modifiers.spawnRateMultiplier *= biome.baseOreSpawnRate;
    
    return modifiers;
  }

  /**
   * Generate trade route information between sectors
   */
  generateTradeRoutes(fromCoords, toCoords) {
    const distance = Math.sqrt(
      (toCoords.x - fromCoords.x) ** 2 + 
      (toCoords.y - fromCoords.y) ** 2
    );
    
    // Generate trade route efficiency based on established paths
    const routeNoise = this.generateNoise(
      (fromCoords.x + toCoords.x) / 2,
      (fromCoords.y + toCoords.y) / 2,
      0.05
    );
    
    const efficiency = Math.max(0.1, Math.min(1.0, routeNoise));
    
    return {
      distance,
      efficiency,
      establishedRoute: efficiency > 0.7,
      recommendedFuelReserve: Math.ceil(distance * 20 * (2 - efficiency))
    };
  }

  /**
   * Generate faction territory information
   */
  generateFactionTerritory(coordinates) {
    const distanceFromCenter = Math.sqrt(coordinates.x ** 2 + coordinates.y ** 2);
    
    // Define faction territories
    const factions = [
      { name: 'Terran Federation', centerX: -10, centerY: 5, radius: 8, color: '#0066CC' },
      { name: 'Zephyrian Empire', centerX: 12, centerY: -8, radius: 10, color: '#CC6600' },
      { name: 'Nomad Clans', centerX: -5, centerY: -15, radius: 6, color: '#009900' },
      { name: 'Ancient Watchers', centerX: 0, centerY: 0, radius: 3, color: '#9900CC' }
    ];
    
    for (const faction of factions) {
      const factionDistance = Math.sqrt(
        (coordinates.x - faction.centerX) ** 2 + 
        (coordinates.y - faction.centerY) ** 2
      );
      
      if (factionDistance <= faction.radius) {
        const influence = 1 - (factionDistance / faction.radius);
        return {
          faction: faction.name,
          influence: influence,
          color: faction.color,
          isCapital: factionDistance < 1
        };
      }
    }
    
    // Neutral space
    return {
      faction: 'Neutral Space',
      influence: 0,
      color: '#666666',
      isCapital: false
    };
  }

  /**
   * Generate wormhole network nodes
   */
  generateWormholeNodes(coordinates, seed) {
    const rng = this.createSeededRNG(seed);
    const distanceFromCenter = Math.sqrt(coordinates.x ** 2 + coordinates.y ** 2);
    
    // Wormholes are rare and follow specific patterns
    const wormholeNoise = this.generateNoise(coordinates.x * 0.2, coordinates.y * 0.2, 0.03);
    
    // Higher chance of wormholes at specific distances (wormhole rings)
    const ringDistances = [15, 25, 35];
    let ringProximity = 0;
    
    for (const ringDist of ringDistances) {
      const distToRing = Math.abs(distanceFromCenter - ringDist);
      if (distToRing < 2) {
        ringProximity = Math.max(ringProximity, 1 - distToRing / 2);
      }
    }
    
    const wormholeChance = (wormholeNoise + ringProximity) / 2;
    
    if (wormholeChance > 0.9 && rng.next() < 0.1) {
      // Generate wormhole destinations
      const destinations = this.generateWormholeDestinations(coordinates, rng);
      
      return {
        hasWormhole: true,
        stability: 0.5 + rng.next() * 0.5,
        destinations,
        lastStable: Date.now(),
        nextFluctuation: Date.now() + (60000 + rng.next() * 300000) // 1-6 minutes
      };
    }
    
    return { hasWormhole: false };
  }

  /**
   * Generate wormhole destinations
   */
  generateWormholeDestinations(originCoords, rng) {
    const destinations = [];
    const destCount = 1 + Math.floor(rng.next() * 2); // 1-2 destinations
    
    for (let i = 0; i < destCount; i++) {
      // Generate destination in different part of galaxy
      const angle = rng.next() * Math.PI * 2;
      const distance = 10 + rng.next() * 30; // 10-40 sectors away
      
      const destX = Math.round(originCoords.x + Math.cos(angle) * distance);
      const destY = Math.round(originCoords.y + Math.sin(angle) * distance);
      
      // Ensure destination is within galaxy bounds
      const destDistance = Math.sqrt(destX ** 2 + destY ** 2);
      if (destDistance <= 50) {
        destinations.push({
          coordinates: { x: destX, y: destY },
          stability: 0.3 + rng.next() * 0.7,
          fuelCostReduction: 0.2 + rng.next() * 0.6 // 20-80% fuel reduction
        });
      }
    }
    
    return destinations;
  }

  /**
   * Generate asteroid belt patterns
   */
  generateAsteroidBelts(coordinates, seed) {
    const rng = this.createSeededRNG(seed);
    const distanceFromCenter = Math.sqrt(coordinates.x ** 2 + coordinates.y ** 2);
    
    // Asteroid belts form at specific orbital distances
    const beltDistances = [8, 16, 28, 42];
    const belts = [];
    
    for (const beltDist of beltDistances) {
      const distToBelt = Math.abs(distanceFromCenter - beltDist);
      
      if (distToBelt < 3) { // Within 3 sectors of belt
        const density = Math.max(0, 1 - distToBelt / 3);
        const width = 1 + rng.next() * 2;
        
        belts.push({
          distance: beltDist,
          density: density,
          width: width,
          composition: this.generateBeltComposition(rng),
          hazardLevel: density * (0.5 + rng.next() * 0.5)
        });
      }
    }
    
    return belts;
  }

  /**
   * Generate asteroid belt composition
   */
  generateBeltComposition(rng) {
    const compositions = [
      { primary: 'iron', secondary: 'copper', rare: 'aluminum' },
      { primary: 'aluminum', secondary: 'iron', rare: 'energy_crystal' },
      { primary: 'copper', secondary: 'aluminum', rare: 'nanotubes' }
    ];
    
    return compositions[Math.floor(rng.next() * compositions.length)];
  }

  /**
   * Generate stellar phenomena for sector
   */
  generateStellarPhenomena(coordinates, biome, seed) {
    const rng = this.createSeededRNG(seed);
    const phenomena = [];
    
    // Biome-specific phenomena
    switch (biome.name) {
      case 'Stellar Nursery':
        // Proto-stars and stellar jets
        if (rng.next() < 0.4) {
          phenomena.push({
            type: 'protostar',
            x: (rng.next() - 0.5) * 1500,
            y: (rng.next() - 0.5) * 1500,
            luminosity: rng.next(),
            stellarWind: 0.3 + rng.next() * 0.7
          });
        }
        break;
        
      case 'Black Hole Region':
        // Accretion disks and gravitational lensing
        phenomena.push({
          type: 'black_hole',
          x: (rng.next() - 0.5) * 800,
          y: (rng.next() - 0.5) * 800,
          mass: 5 + rng.next() * 15, // Solar masses
          eventHorizon: 30 + rng.next() * 70,
          accretionDisk: rng.next() < 0.6
        });
        break;
        
      case 'Nebula':
        // Ionization fronts and emission regions
        if (rng.next() < 0.5) {
          phenomena.push({
            type: 'emission_region',
            x: (rng.next() - 0.5) * 1800,
            y: (rng.next() - 0.5) * 1800,
            spectrum: ['hydrogen', 'helium', 'oxygen'][Math.floor(rng.next() * 3)],
            intensity: rng.next()
          });
        }
        break;
    }
    
    return phenomena;
  }

  /**
   * Clear noise cache to free memory
   */
  clearCache() {
    this.noiseCache.clear();
    console.log('ProceduralGeneration cache cleared');
  }

  /**
   * Get galaxy structure info for a region
   */
  getGalaxyStructure(centerCoords, radius = 10) {
    const structure = {
      sectors: [],
      spiralArms: [],
      asteroidBelts: [],
      factionTerritories: new Map()
    };
    
    for (let x = centerCoords.x - radius; x <= centerCoords.x + radius; x++) {
      for (let y = centerCoords.y - radius; y <= centerCoords.y + radius; y++) {
        const coords = { x, y };
        const distance = Math.sqrt(
          (x - centerCoords.x) ** 2 + (y - centerCoords.y) ** 2
        );
        
        if (distance <= radius) {
          const seed = this.generateSectorSeed(x, y);
          const biome = this.generateSectorBiome(coords, seed);
          const faction = this.generateFactionTerritory(coords);
          const spiralProximity = this.calculateSpiralArmProximity(x, y);
          
          structure.sectors.push({
            coordinates: coords,
            biome: biome.name,
            faction: faction.faction,
            spiralProximity
          });
          
          // Track faction territories
          if (!structure.factionTerritories.has(faction.faction)) {
            structure.factionTerritories.set(faction.faction, []);
          }
          structure.factionTerritories.get(faction.faction).push(coords);
        }
      }
    }
    
    return structure;
  }

  /**
   * Calculate optimal travel routes between distant sectors
   */
  calculateOptimalRoute(fromCoords, toCoords, maxJumps = 10) {
    // Simple pathfinding implementation
    // In a real implementation, you'd use A* or similar algorithm
    
    const dx = toCoords.x - fromCoords.x;
    const dy = toCoords.y - fromCoords.y;
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    
    if (totalDistance <= maxJumps) {
      // Direct route possible
      return {
        route: [fromCoords, toCoords],
        totalFuelCost: this.calculateRouteFuelCost([fromCoords, toCoords]),
        totalTime: this.calculateRouteTime([fromCoords, toCoords]),
        isDirectRoute: true
      };
    }
    
    // Multi-jump route needed
    const waypoints = this.generateWaypoints(fromCoords, toCoords, maxJumps);
    
    return {
      route: waypoints,
      totalFuelCost: this.calculateRouteFuelCost(waypoints),
      totalTime: this.calculateRouteTime(waypoints),
      isDirectRoute: false
    };
  }

  /**
   * Generate waypoints for long-distance travel
   */
  generateWaypoints(fromCoords, toCoords, maxJumpDistance) {
    const waypoints = [fromCoords];
    let current = fromCoords;
    
    while (true) {
      const dx = toCoords.x - current.x;
      const dy = toCoords.y - current.y;
      const remainingDistance = Math.sqrt(dx * dx + dy * dy);
      
      if (remainingDistance <= maxJumpDistance) {
        waypoints.push(toCoords);
        break;
      }
      
      // Calculate next waypoint
      const ratio = maxJumpDistance / remainingDistance;
      const nextX = Math.round(current.x + dx * ratio);
      const nextY = Math.round(current.y + dy * ratio);
      
      current = { x: nextX, y: nextY };
      waypoints.push(current);
      
      // Safety check to prevent infinite loops
      if (waypoints.length > 20) {
        console.warn('Route calculation exceeded maximum waypoints');
        break;
      }
    }
    
    return waypoints;
  }

  /**
   * Calculate fuel cost for a route
   */
  calculateRouteFuelCost(waypoints) {
    let totalCost = 0;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      const distance = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
      totalCost += Math.ceil(distance * 50); // Base cost per sector
    }
    
    return totalCost;
  }

  /**
   * Calculate travel time for a route
   */
  calculateRouteTime(waypoints) {
    let totalTime = 0;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      const distance = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
      totalTime += Math.ceil(distance * 10000); // 10 seconds per sector
    }
    
    return totalTime;
  }
}

module.exports = ProceduralGeneration;