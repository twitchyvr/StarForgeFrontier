/**
 * HazardEffects.js - Ship system impacts, warnings, and countermeasure handling
 * Processes hazard effects on player ships and manages warning systems
 */

const { HAZARD_TYPES, COUNTERMEASURES } = require('./HazardSystem');

/**
 * Ship system definitions for hazard effects
 */
const SHIP_SYSTEMS = {
  navigation: {
    name: 'Navigation System',
    criticalLevel: 0.2,
    degradationRate: 0.05,
    repairCost: 100,
    effects: ['movement_speed', 'accuracy', 'auto_pilot']
  },
  
  shields: {
    name: 'Shield Generator',
    criticalLevel: 0.1,
    degradationRate: 0.08,
    repairCost: 150,
    effects: ['max_health', 'damage_resistance', 'energy_absorption']
  },
  
  weapons: {
    name: 'Weapon Systems',
    criticalLevel: 0.3,
    degradationRate: 0.04,
    repairCost: 120,
    effects: ['damage_output', 'targeting', 'reload_speed']
  },
  
  engines: {
    name: 'Propulsion System',
    criticalLevel: 0.15,
    degradationRate: 0.06,
    repairCost: 200,
    effects: ['max_speed', 'acceleration', 'fuel_efficiency']
  },
  
  sensors: {
    name: 'Sensor Array',
    criticalLevel: 0.25,
    degradationRate: 0.03,
    repairCost: 80,
    effects: ['detection_range', 'ore_scanning', 'hazard_warning']
  },
  
  life_support: {
    name: 'Life Support',
    criticalLevel: 0.05,
    degradationRate: 0.02,
    repairCost: 250,
    effects: ['crew_health', 'oxygen_generation', 'temperature_control']
  },
  
  communications: {
    name: 'Communications',
    criticalLevel: 0.4,
    degradationRate: 0.02,
    repairCost: 60,
    effects: ['multiplayer_sync', 'emergency_beacon', 'trade_communications']
  },
  
  computer: {
    name: 'Computer Core',
    criticalLevel: 0.1,
    degradationRate: 0.04,
    repairCost: 300,
    effects: ['automation', 'calculations', 'system_integration']
  }
};

/**
 * Warning system configuration
 */
const WARNING_SYSTEM = {
  priorities: {
    CRITICAL: { level: 5, color: '#FF0000', audio: 'critical_alarm', flash: true },
    HIGH: { level: 4, color: '#FF4500', audio: 'high_warning', flash: false },
    MEDIUM: { level: 3, color: '#FFA500', audio: 'medium_beep', flash: false },
    LOW: { level: 2, color: '#FFFF00', audio: 'low_tone', flash: false },
    INFO: { level: 1, color: '#00FF00', audio: 'info_chime', flash: false }
  },
  
  messages: {
    // Asteroid Field warnings
    ASTEROID_COLLISION_IMMINENT: {
      priority: 'CRITICAL',
      message: 'COLLISION WARNING: Large asteroid detected directly ahead',
      icon: 'asteroid',
      duration: 5000,
      repeat: true
    },
    ASTEROID_FIELD_DETECTED: {
      priority: 'MEDIUM',
      message: 'Asteroid field detected. Reduce speed and engage enhanced navigation',
      icon: 'asteroid_field',
      duration: 3000,
      repeat: false
    },
    
    // Solar Flare warnings
    SOLAR_FLARE_IMMINENT: {
      priority: 'CRITICAL',
      message: 'SOLAR FLARE IMMINENT: Prepare for electromagnetic interference',
      icon: 'solar_flare',
      duration: 8000,
      repeat: true,
      countdown: true
    },
    ELECTRONICS_OFFLINE: {
      priority: 'HIGH',
      message: 'Electronics systems disabled by solar radiation',
      icon: 'system_failure',
      duration: 4000,
      repeat: false
    },
    
    // Gravitational warnings
    EVENT_HORIZON_PROXIMITY: {
      priority: 'CRITICAL',
      message: 'DANGER: Approaching black hole event horizon',
      icon: 'black_hole',
      duration: 10000,
      repeat: true,
      escape_instructions: 'Engage maximum thrust perpendicular to gravitational pull'
    },
    GRAVITATIONAL_STRESS: {
      priority: 'HIGH',
      message: 'Hull integrity compromised by tidal forces',
      icon: 'hull_damage',
      duration: 5000,
      repeat: false
    },
    
    // Radiation warnings
    HIGH_RADIATION_EXPOSURE: {
      priority: 'HIGH',
      message: 'Dangerous radiation levels detected. Seek shelter immediately',
      icon: 'radiation',
      duration: 6000,
      repeat: true,
      health_advisory: true
    },
    RADIATION_SICKNESS: {
      priority: 'CRITICAL',
      message: 'Crew suffering from radiation poisoning. Medical attention required',
      icon: 'medical_emergency',
      duration: 8000,
      repeat: true
    },
    
    // Temporal warnings
    TEMPORAL_DISTORTION_DETECTED: {
      priority: 'MEDIUM',
      message: 'Temporal distortion field detected. Time flow may be affected',
      icon: 'temporal_anomaly',
      duration: 4000,
      repeat: false
    },
    TIME_DISPLACEMENT_RISK: {
      priority: 'HIGH',
      message: 'WARNING: Risk of temporal displacement',
      icon: 'time_distortion',
      duration: 5000,
      repeat: true
    },
    
    // Wormhole warnings
    WORMHOLE_COLLAPSE_IMMINENT: {
      priority: 'HIGH',
      message: 'Wormhole destabilizing. Exit immediately or prepare for emergency jump',
      icon: 'wormhole_collapse',
      duration: 7000,
      repeat: true,
      countdown: true
    },
    WORMHOLE_ENTRY_RISK: {
      priority: 'MEDIUM',
      message: 'Wormhole entry detected. Structural damage possible',
      icon: 'wormhole_entry',
      duration: 4000,
      repeat: false
    },
    
    // System warnings
    SYSTEM_FAILURE_IMMINENT: {
      priority: 'HIGH',
      message: 'Critical system failure detected. Immediate maintenance required',
      icon: 'system_warning',
      duration: 5000,
      repeat: false
    },
    COUNTERMEASURE_ACTIVATED: {
      priority: 'INFO',
      message: 'Hazard countermeasure system activated',
      icon: 'shield_active',
      duration: 2000,
      repeat: false
    }
  }
};

/**
 * Effect calculation formulas
 */
const EFFECT_FORMULAS = {
  // Damage calculations
  collision_damage: (hazard, ship, countermeasures) => {
    let baseDamage = hazard.effects.collision_damage?.max || 25;
    let protection = countermeasures.includes('reinforced_hull') ? 0.6 : 1.0;
    protection *= countermeasures.includes('enhanced_navigation') ? 0.8 : 1.0;
    return Math.floor(baseDamage * protection);
  },
  
  // System degradation
  system_degradation: (hazard, system, countermeasures) => {
    let baseRate = hazard.effects.system_degradation?.rate || 0.1;
    let protection = 1.0;
    
    // Apply system-specific countermeasures
    if (system === 'shields' && countermeasures.includes('backup_systems')) {
      protection *= 0.5;
    }
    if (system === 'navigation' && countermeasures.includes('inertial_navigation')) {
      protection *= 0.3;
    }
    
    return baseRate * protection;
  },
  
  // Movement modifications
  movement_modifier: (hazard, ship, countermeasures) => {
    let modifier = 1.0;
    
    if (hazard.effects.gravitational_pull) {
      const pullStrength = hazard.effects.gravitational_pull;
      modifier -= pullStrength * 0.5;
      
      if (countermeasures.includes('gravity_compensators')) {
        modifier += pullStrength * 0.3;
      }
    }
    
    return Math.max(0.1, modifier);
  },
  
  // Health effects
  crew_health_effect: (hazard, exposure_time, countermeasures) => {
    let healthLoss = 0;
    
    if (hazard.effects.crew_health_drain) {
      healthLoss = hazard.effects.crew_health_drain * (exposure_time / 1000);
      
      if (countermeasures.includes('radiation_shielding')) {
        healthLoss *= 0.2;
      }
      if (countermeasures.includes('medical_bay')) {
        healthLoss *= 0.5;
      }
    }
    
    return Math.floor(healthLoss);
  }
};

/**
 * HazardEffects class manages all hazard impact calculations
 */
class HazardEffects {
  constructor() {
    this.activeEffects = new Map(); // playerId -> effects array
    this.systemHealth = new Map(); // playerId -> system health map
    this.warningQueue = new Map(); // playerId -> warning queue
    this.countermeasures = new Map(); // playerId -> active countermeasures
    this.exposureHistory = new Map(); // playerId -> hazard exposure tracking
  }

  /**
   * Initialize effects system for a player
   */
  initializePlayer(playerId) {
    // Initialize system health to 100% for all systems
    const systemHealth = {};
    Object.keys(SHIP_SYSTEMS).forEach(system => {
      systemHealth[system] = 1.0; // 100% health
    });
    
    this.systemHealth.set(playerId, systemHealth);
    this.activeEffects.set(playerId, []);
    this.warningQueue.set(playerId, []);
    this.countermeasures.set(playerId, []);
    this.exposureHistory.set(playerId, new Map());
  }

  /**
   * Process hazard effects on a player
   */
  processHazardEffects(playerId, hazardEffects, playerPosition, deltaTime) {
    if (!this.activeEffects.has(playerId)) {
      this.initializePlayer(playerId);
    }

    const results = {
      systemDamage: {},
      movementModifier: 1.0,
      healthEffects: { damage: 0, recovery: 0 },
      warnings: [],
      audioQueue: [],
      visualEffects: [],
      countermeasureRecommendations: []
    };

    const playerCountermeasures = this.countermeasures.get(playerId) || [];
    const systemHealth = this.systemHealth.get(playerId);

    // Process each active hazard effect
    for (const hazardEffect of hazardEffects) {
      const hazardType = HAZARD_TYPES[hazardEffect.type];
      if (!hazardType) continue;

      // Update exposure history
      this.updateExposureHistory(playerId, hazardEffect, deltaTime);

      // Calculate specific effects
      this.calculateSystemEffects(hazardEffect, systemHealth, playerCountermeasures, results);
      this.calculateMovementEffects(hazardEffect, playerCountermeasures, results);
      this.calculateHealthEffects(hazardEffect, playerId, deltaTime, results);
      this.generateWarnings(hazardEffect, results);
      this.generateVisualEffects(hazardEffect, results);
      this.recommendCountermeasures(hazardEffect, playerCountermeasures, results);
    }

    // Apply system degradation over time
    this.applySystemDegradation(systemHealth, deltaTime);

    // Update active effects
    this.activeEffects.set(playerId, hazardEffects);

    return results;
  }

  /**
   * Update player's hazard exposure history
   */
  updateExposureHistory(playerId, hazardEffect, deltaTime) {
    const exposureHistory = this.exposureHistory.get(playerId);
    const hazardId = hazardEffect.hazardId;

    if (!exposureHistory.has(hazardId)) {
      exposureHistory.set(hazardId, {
        totalExposure: 0,
        firstExposure: Date.now(),
        lastExposure: Date.now(),
        maxIntensity: hazardEffect.magnitude,
        hazardType: hazardEffect.type
      });
    }

    const exposure = exposureHistory.get(hazardId);
    exposure.totalExposure += deltaTime;
    exposure.lastExposure = Date.now();
    exposure.maxIntensity = Math.max(exposure.maxIntensity, hazardEffect.magnitude);
  }

  /**
   * Calculate effects on ship systems
   */
  calculateSystemEffects(hazardEffect, systemHealth, countermeasures, results) {
    const effects = hazardEffect.effects;

    // Electronics system effects (solar flares, magnetic storms)
    if (effects.electronicsDisable > 0) {
      const disableChance = effects.electronicsDisable * hazardEffect.magnitude;
      if (Math.random() < disableChance) {
        const affectedSystems = ['navigation', 'sensors', 'communications', 'computer'];
        
        for (const system of affectedSystems) {
          const protection = countermeasures.includes('emp_shielding') ? 0.3 : 1.0;
          const damage = 0.1 * protection;
          systemHealth[system] = Math.max(0, systemHealth[system] - damage);
          results.systemDamage[system] = (results.systemDamage[system] || 0) + damage;
        }
      }
    }

    // Shield drain effects
    if (effects.shieldDrain > 0) {
      const drainAmount = effects.shieldDrain * hazardEffect.magnitude;
      const protection = countermeasures.includes('backup_systems') ? 0.5 : 1.0;
      const actualDrain = drainAmount * protection;
      
      systemHealth.shields = Math.max(0, systemHealth.shields - actualDrain);
      results.systemDamage.shields = (results.systemDamage.shields || 0) + actualDrain;
    }

    // Navigation system effects (nebulae, magnetic storms)
    if (effects.navigationInterference > 0) {
      const interference = effects.navigationInterference * hazardEffect.magnitude;
      const protection = countermeasures.includes('inertial_navigation') ? 0.1 : 1.0;
      const actualInterference = interference * protection;
      
      systemHealth.navigation = Math.max(0, systemHealth.navigation - actualInterference * 0.05);
      results.systemDamage.navigation = (results.systemDamage.navigation || 0) + actualInterference * 0.05;
    }

    // Sensor degradation (nebulae, cosmic radiation)
    if (effects.sensorRangeReduction > 0) {
      const reduction = effects.sensorRangeReduction * hazardEffect.magnitude;
      const protection = countermeasures.includes('advanced_sensors') ? 0.4 : 1.0;
      const actualReduction = reduction * protection;
      
      systemHealth.sensors = Math.max(0, systemHealth.sensors - actualReduction * 0.02);
      results.systemDamage.sensors = (results.systemDamage.sensors || 0) + actualReduction * 0.02;
    }

    // Structural stress (gravitational anomalies, black holes)
    if (effects.structuralStress > 0) {
      const stress = effects.structuralStress * hazardEffect.magnitude;
      const protection = countermeasures.includes('structural_reinforcement') ? 0.5 : 1.0;
      const actualStress = stress * protection;
      
      // Affects hull integrity (engines system represents hull)
      systemHealth.engines = Math.max(0, systemHealth.engines - actualStress * 0.03);
      results.systemDamage.engines = (results.systemDamage.engines || 0) + actualStress * 0.03;
    }
  }

  /**
   * Calculate movement effects
   */
  calculateMovementEffects(hazardEffect, countermeasures, results) {
    const effects = hazardEffect.effects;

    // Gravitational pull effects
    if (effects.gravitationalPull > 0) {
      const pullEffect = effects.gravitationalPull * hazardEffect.magnitude;
      const protection = countermeasures.includes('gravity_compensators') ? 0.4 : 1.0;
      const actualPull = pullEffect * protection;
      
      // Reduce movement speed
      results.movementModifier *= (1.0 - actualPull * 0.5);
    }

    // Navigation difficulty (asteroid fields)
    if (effects.navigationDifficulty > 0) {
      const difficulty = effects.navigationDifficulty * hazardEffect.magnitude;
      const protection = countermeasures.includes('enhanced_navigation') ? 0.3 : 1.0;
      const actualDifficulty = difficulty * protection;
      
      results.movementModifier *= (1.0 - actualDifficulty * 0.3);
    }

    // Time dilation effects
    if (effects.timeDilation !== undefined) {
      results.movementModifier *= effects.timeDilation;
    }

    // Ensure minimum movement speed
    results.movementModifier = Math.max(0.1, results.movementModifier);
  }

  /**
   * Calculate health and crew effects
   */
  calculateHealthEffects(hazardEffect, playerId, deltaTime, results) {
    const effects = hazardEffect.effects;
    const exposure = this.exposureHistory.get(playerId).get(hazardEffect.hazardId);

    // Crew health drain (radiation, life support failure)
    if (effects.crewHealthDrain > 0) {
      const drainRate = effects.crewHealthDrain * hazardEffect.magnitude;
      const protection = this.countermeasures.get(playerId).includes('radiation_shielding') ? 0.2 : 1.0;
      const actualDrain = drainRate * protection * (deltaTime / 1000);
      
      results.healthEffects.damage += actualDrain;
    }

    // Radiation exposure accumulation
    if (effects.radiationLevel > 0) {
      const radiationDose = effects.radiationLevel * hazardEffect.magnitude * (deltaTime / 1000);
      
      if (exposure) {
        exposure.radiationDose = (exposure.radiationDose || 0) + radiationDose;
        
        // Radiation sickness threshold
        if (exposure.radiationDose > 100) {
          results.healthEffects.damage += (exposure.radiationDose - 100) * 0.1;
          
          // Generate radiation sickness warning
          if (exposure.radiationDose > 150) {
            results.warnings.push('RADIATION_SICKNESS');
          }
        }
      }
    }

    // Health recovery bonuses (nebula energy, medical bay)
    if (effects.energyRegeneration > 1.0) {
      results.healthEffects.recovery += (effects.energyRegeneration - 1.0) * 10 * (deltaTime / 1000);
    }
  }

  /**
   * Generate warnings based on hazard effects
   */
  generateWarnings(hazardEffect, results) {
    const effects = hazardEffect.effects;
    const magnitude = hazardEffect.magnitude;

    // High magnitude warnings
    if (magnitude > 0.8) {
      if (hazardEffect.type === 'GRAVITATIONAL_ANOMALY') {
        results.warnings.push('EVENT_HORIZON_PROXIMITY');
      } else if (hazardEffect.type === 'COSMIC_RADIATION') {
        results.warnings.push('HIGH_RADIATION_EXPOSURE');
      } else if (hazardEffect.type === 'ASTEROID_FIELD') {
        results.warnings.push('ASTEROID_COLLISION_IMMINENT');
      }
    }

    // Specific effect warnings
    if (effects.electronicsDisable > 0.5) {
      results.warnings.push('ELECTRONICS_OFFLINE');
    }

    if (effects.structuralStress > 1.5) {
      results.warnings.push('GRAVITATIONAL_STRESS');
    }

    if (effects.temporalDisplacementChance > 0.1) {
      results.warnings.push('TIME_DISPLACEMENT_RISK');
    }

    if (effects.wormholeEntry) {
      results.warnings.push('WORMHOLE_ENTRY_RISK');
    }

    // Add warnings from hazard effect directly
    if (hazardEffect.warnings) {
      results.warnings.push(...hazardEffect.warnings);
    }
  }

  /**
   * Generate visual effects for hazards
   */
  generateVisualEffects(hazardEffect, results) {
    const hazardType = HAZARD_TYPES[hazardEffect.type];
    const magnitude = hazardEffect.magnitude;

    const visualEffect = {
      type: hazardEffect.type,
      intensity: magnitude,
      visualization: hazardType.visualization,
      position: { x: hazardEffect.x || 0, y: hazardEffect.y || 0 },
      duration: 5000 + magnitude * 3000 // 5-8 seconds based on intensity
    };

    // Add specific visual modifications based on effects
    if (hazardEffect.effects.visibilityReduction > 0) {
      visualEffect.screenEffects = ['fog_overlay'];
      visualEffect.fogIntensity = hazardEffect.effects.visibilityReduction;
    }

    if (hazardEffect.effects.electronicsDisable > 0) {
      visualEffect.screenEffects = (visualEffect.screenEffects || []).concat(['static_interference']);
      visualEffect.staticIntensity = hazardEffect.effects.electronicsDisable;
    }

    if (hazardEffect.effects.gravitationalPull > 0) {
      visualEffect.screenEffects = (visualEffect.screenEffects || []).concat(['screen_distortion']);
      visualEffect.distortionLevel = hazardEffect.effects.gravitationalPull;
    }

    if (hazardEffect.effects.radiationLevel > 50) {
      visualEffect.screenEffects = (visualEffect.screenEffects || []).concat(['radiation_overlay']);
      visualEffect.radiationIntensity = Math.min(1.0, hazardEffect.effects.radiationLevel / 100);
    }

    results.visualEffects.push(visualEffect);

    // Add audio effects
    if (hazardEffect.audioQueue) {
      results.audioQueue.push(...hazardEffect.audioQueue);
    }
    if (hazardType.audio) {
      results.audioQueue.push(hazardType.audio);
    }
  }

  /**
   * Recommend countermeasures based on active hazards
   */
  recommendCountermeasures(hazardEffect, playerCountermeasures, results) {
    const recommendations = [];
    const hazardType = HAZARD_TYPES[hazardEffect.type];

    for (const countermeasure of hazardType.countermeasures || []) {
      if (!playerCountermeasures.includes(countermeasure)) {
        const countermeasureDef = COUNTERMEASURES[countermeasure];
        if (countermeasureDef) {
          recommendations.push({
            id: countermeasure,
            name: countermeasureDef.name,
            description: countermeasureDef.description,
            cost: countermeasureDef.cost,
            effectiveness: this.calculateCountermeasureEffectiveness(hazardEffect, countermeasure),
            priority: this.getCountermeasurePriority(hazardEffect, countermeasure)
          });
        }
      }
    }

    // Sort by priority and effectiveness
    recommendations.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.effectiveness - a.effectiveness;
    });

    results.countermeasureRecommendations.push(...recommendations.slice(0, 3)); // Top 3 recommendations
  }

  /**
   * Calculate countermeasure effectiveness against a hazard
   */
  calculateCountermeasureEffectiveness(hazardEffect, countermeasure) {
    const countermeasureDef = COUNTERMEASURES[countermeasure];
    if (!countermeasureDef) return 0;

    let effectiveness = 0;
    const effects = hazardEffect.effects;

    // Calculate effectiveness based on what the countermeasure counters
    Object.entries(countermeasureDef.effects).forEach(([effectType, value]) => {
      if (effects[effectType] !== undefined && value < 0) {
        // Negative values in countermeasures are reductions
        effectiveness += Math.abs(value) * (effects[effectType] || 0);
      }
    });

    return Math.min(1.0, effectiveness);
  }

  /**
   * Get countermeasure priority based on hazard severity and effects
   */
  getCountermeasurePriority(hazardEffect, countermeasure) {
    const magnitude = hazardEffect.magnitude;
    const effects = hazardEffect.effects;

    let priority = 1;

    // High priority for life-threatening effects
    if (effects.crewHealthDrain > 0 || effects.radiationLevel > 50) {
      if (['radiation_shielding', 'medical_bay'].includes(countermeasure)) {
        priority = 5;
      }
    }

    // High priority for system-critical effects
    if (effects.electronicsDisable > 0.5 || effects.structuralStress > 1.5) {
      if (['emp_shielding', 'structural_reinforcement', 'backup_systems'].includes(countermeasure)) {
        priority = 4;
      }
    }

    // Medium priority for navigation effects
    if (effects.navigationInterference > 0.5 || effects.gravitationalPull > 0.5) {
      if (['enhanced_navigation', 'gravity_compensators', 'inertial_navigation'].includes(countermeasure)) {
        priority = 3;
      }
    }

    // Scale priority by magnitude
    priority = Math.floor(priority * (0.5 + magnitude * 0.5));

    return Math.max(1, priority);
  }

  /**
   * Apply gradual system degradation over time
   */
  applySystemDegradation(systemHealth, deltaTime) {
    const degradationRate = deltaTime / 60000; // Per minute

    Object.entries(systemHealth).forEach(([system, health]) => {
      const systemDef = SHIP_SYSTEMS[system];
      if (health > 0 && health < 1.0) {
        // Damaged systems degrade faster
        const additionalDegradation = systemDef.degradationRate * degradationRate * (1.0 - health);
        systemHealth[system] = Math.max(0, health - additionalDegradation);
      }
    });
  }

  /**
   * Add countermeasure to player
   */
  addCountermeasure(playerId, countermeasureId) {
    if (!this.countermeasures.has(playerId)) {
      this.countermeasures.set(playerId, []);
    }
    
    const playerCountermeasures = this.countermeasures.get(playerId);
    if (!playerCountermeasures.includes(countermeasureId)) {
      playerCountermeasures.push(countermeasureId);
      console.log(`Player ${playerId} acquired countermeasure: ${countermeasureId}`);
    }
  }

  /**
   * Remove countermeasure from player
   */
  removeCountermeasure(playerId, countermeasureId) {
    const playerCountermeasures = this.countermeasures.get(playerId);
    if (playerCountermeasures) {
      const index = playerCountermeasures.indexOf(countermeasureId);
      if (index > -1) {
        playerCountermeasures.splice(index, 1);
        console.log(`Player ${playerId} lost countermeasure: ${countermeasureId}`);
      }
    }
  }

  /**
   * Repair ship system
   */
  repairSystem(playerId, system, amount = 1.0) {
    const systemHealth = this.systemHealth.get(playerId);
    if (systemHealth && systemHealth[system] !== undefined) {
      const systemDef = SHIP_SYSTEMS[system];
      systemHealth[system] = Math.min(1.0, systemHealth[system] + amount);
      
      return {
        success: true,
        newHealth: systemHealth[system],
        repairCost: Math.floor(systemDef.repairCost * amount)
      };
    }
    
    return { success: false, error: 'System not found' };
  }

  /**
   * Get player system health status
   */
  getSystemHealth(playerId) {
    const systemHealth = this.systemHealth.get(playerId);
    if (!systemHealth) return null;

    const status = {};
    Object.entries(systemHealth).forEach(([system, health]) => {
      const systemDef = SHIP_SYSTEMS[system];
      status[system] = {
        health: health,
        status: this.getSystemStatus(health, systemDef),
        effects: this.getSystemEffects(health, systemDef),
        repairCost: systemDef.repairCost
      };
    });

    return status;
  }

  /**
   * Get system status description
   */
  getSystemStatus(health, systemDef) {
    if (health <= systemDef.criticalLevel) return 'CRITICAL';
    if (health <= 0.3) return 'DAMAGED';
    if (health <= 0.6) return 'DEGRADED';
    if (health <= 0.9) return 'FUNCTIONAL';
    return 'OPTIMAL';
  }

  /**
   * Get system effects based on health
   */
  getSystemEffects(health, systemDef) {
    const effects = {};
    
    systemDef.effects.forEach(effect => {
      // Linear degradation of system effects
      effects[effect] = health;
    });

    return effects;
  }

  /**
   * Get warning messages for player
   */
  getWarningMessages(playerId) {
    const warnings = this.warningQueue.get(playerId) || [];
    const messages = [];

    for (const warningType of warnings) {
      const warningDef = WARNING_SYSTEM.messages[warningType];
      if (warningDef) {
        messages.push({
          type: warningType,
          priority: warningDef.priority,
          message: warningDef.message,
          icon: warningDef.icon,
          duration: warningDef.duration,
          color: WARNING_SYSTEM.priorities[warningDef.priority].color,
          audio: WARNING_SYSTEM.priorities[warningDef.priority].audio,
          flash: WARNING_SYSTEM.priorities[warningDef.priority].flash,
          timestamp: Date.now()
        });
      }
    }

    // Sort by priority level
    messages.sort((a, b) => {
      const priorityA = WARNING_SYSTEM.priorities[a.priority].level;
      const priorityB = WARNING_SYSTEM.priorities[b.priority].level;
      return priorityB - priorityA;
    });

    return messages;
  }

  /**
   * Clear old warnings
   */
  clearExpiredWarnings(playerId) {
    // This would typically be called periodically to clean up old warnings
    // For now, we'll just clear the queue
    this.warningQueue.set(playerId, []);
  }

  /**
   * Get exposure history for player
   */
  getExposureHistory(playerId, hazardType = null) {
    const exposure = this.exposureHistory.get(playerId);
    if (!exposure) return [];

    const history = Array.from(exposure.values());
    
    if (hazardType) {
      return history.filter(exp => exp.hazardType === hazardType);
    }
    
    return history;
  }

  /**
   * Calculate total hazard resistance
   */
  calculateHazardResistance(playerId) {
    const countermeasures = this.countermeasures.get(playerId) || [];
    const resistance = {};

    Object.keys(HAZARD_TYPES).forEach(hazardType => {
      resistance[hazardType] = 0;
    });

    for (const countermeasure of countermeasures) {
      const countermeasureDef = COUNTERMEASURES[countermeasure];
      if (countermeasureDef) {
        // Calculate resistance bonuses
        Object.entries(countermeasureDef.effects).forEach(([effectType, value]) => {
          if (value < 0) {
            // Negative values provide resistance
            const resistanceBonus = Math.abs(value);
            
            // Apply to relevant hazard types
            Object.entries(HAZARD_TYPES).forEach(([hazardType, hazardDef]) => {
              if (hazardDef.effects[effectType] !== undefined) {
                resistance[hazardType] = Math.min(1.0, resistance[hazardType] + resistanceBonus);
              }
            });
          }
        });
      }
    }

    return resistance;
  }

  /**
   * Get statistics about hazard effects
   */
  getEffectStatistics() {
    return {
      activePlayers: this.activeEffects.size,
      totalWarnings: Array.from(this.warningQueue.values()).reduce((sum, warnings) => sum + warnings.length, 0),
      systemFailures: this.getSystemFailureCount(),
      countermeasureDeployments: this.getCountermeasureCount()
    };
  }

  /**
   * Count system failures across all players
   */
  getSystemFailureCount() {
    let failureCount = 0;
    
    for (const systemHealth of this.systemHealth.values()) {
      Object.entries(systemHealth).forEach(([system, health]) => {
        const systemDef = SHIP_SYSTEMS[system];
        if (health <= systemDef.criticalLevel) {
          failureCount++;
        }
      });
    }
    
    return failureCount;
  }

  /**
   * Count active countermeasures across all players
   */
  getCountermeasureCount() {
    let totalCount = 0;
    
    for (const playerCountermeasures of this.countermeasures.values()) {
      totalCount += playerCountermeasures.length;
    }
    
    return totalCount;
  }
}

module.exports = { 
  HazardEffects, 
  SHIP_SYSTEMS, 
  WARNING_SYSTEM, 
  EFFECT_FORMULAS 
};