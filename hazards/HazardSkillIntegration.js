/**
 * HazardSkillIntegration.js - Integration between hazard system and skill system
 * Provides hazard mitigation skills and connects them to countermeasure effectiveness
 */

const { HAZARD_TYPES, COUNTERMEASURES } = require('./HazardSystem');

/**
 * Hazard mitigation skill definitions for integration with the main skill system
 */
const HAZARD_MITIGATION_SKILLS = {
  // Navigation & Hazard Avoidance
  hazard_navigation: {
    name: 'Hazard Navigation',
    description: 'Advanced navigation techniques for dangerous sectors',
    maxLevel: 20,
    skillTree: 'exploration',
    effects: {
      asteroid_collision_avoidance: { perLevel: 0.05, type: 'multiplicative' },
      navigation_in_hazards: { perLevel: 0.03, type: 'multiplicative' },
      warp_accuracy_in_storms: { perLevel: 0.04, type: 'multiplicative' }
    },
    prerequisites: ['navigation:10']
  },

  advanced_sensors: {
    name: 'Advanced Sensor Systems',
    description: 'Enhanced sensor arrays for hazard detection and analysis',
    maxLevel: 18,
    skillTree: 'exploration',
    effects: {
      hazard_detection_range: { perLevel: 0.06, type: 'multiplicative' },
      hazard_analysis_speed: { perLevel: 0.04, type: 'multiplicative' },
      early_warning_time: { perLevel: 0.05, type: 'additive' } // 5% more warning time per level
    },
    prerequisites: ['scanning_systems:8']
  },

  // Engineering & System Hardening
  structural_engineering: {
    name: 'Structural Engineering',
    description: 'Reinforced hull and structural systems for hazard resistance',
    maxLevel: 16,
    skillTree: 'engineering',
    effects: {
      gravitational_stress_resistance: { perLevel: 0.04, type: 'multiplicative' },
      hull_integrity_bonus: { perLevel: 0.03, type: 'multiplicative' },
      collision_damage_reduction: { perLevel: 0.05, type: 'multiplicative' }
    },
    prerequisites: ['system_integration:6']
  },

  electromagnetic_hardening: {
    name: 'Electromagnetic Hardening',
    description: 'EMP and radiation shielding for electronic systems',
    maxLevel: 15,
    skillTree: 'engineering',
    effects: {
      emp_resistance: { perLevel: 0.06, type: 'multiplicative' },
      electronics_failure_resistance: { perLevel: 0.04, type: 'multiplicative' },
      solar_flare_protection: { perLevel: 0.05, type: 'multiplicative' }
    },
    prerequisites: ['power_systems:10']
  },

  radiation_shielding: {
    name: 'Radiation Shielding',
    description: 'Advanced protection against cosmic radiation and particle storms',
    maxLevel: 14,
    skillTree: 'engineering',
    effects: {
      radiation_damage_reduction: { perLevel: 0.07, type: 'multiplicative' },
      crew_health_protection: { perLevel: 0.05, type: 'multiplicative' },
      system_degradation_resistance: { perLevel: 0.04, type: 'multiplicative' }
    },
    prerequisites: ['structural_engineering:8']
  },

  // Specialized Hazard Skills
  gravitational_physics: {
    name: 'Gravitational Physics',
    description: 'Understanding of gravity wells and space-time distortions',
    maxLevel: 12,
    skillTree: 'exploration',
    effects: {
      gravity_well_navigation: { perLevel: 0.08, type: 'multiplicative' },
      black_hole_survival: { perLevel: 0.06, type: 'multiplicative' },
      gravitational_assist_bonus: { perLevel: 0.04, type: 'multiplicative' }
    },
    prerequisites: ['deep_space_exploration:5', 'hazard_navigation:12']
  },

  temporal_mechanics: {
    name: 'Temporal Mechanics',
    description: 'Advanced understanding of time distortions and temporal anomalies',
    maxLevel: 10,
    skillTree: 'exploration',
    effects: {
      temporal_distortion_resistance: { perLevel: 0.1, type: 'multiplicative' },
      time_displacement_recovery: { perLevel: 0.08, type: 'multiplicative' },
      chronometer_stability: { perLevel: 0.05, type: 'multiplicative' }
    },
    prerequisites: ['xenoarchaeology:10', 'gravitational_physics:6']
  },

  wormhole_theory: {
    name: 'Wormhole Theory',
    description: 'Safe navigation and utilization of wormhole phenomena',
    maxLevel: 8,
    skillTree: 'exploration',
    effects: {
      wormhole_stability_detection: { perLevel: 0.12, type: 'multiplicative' },
      wormhole_entry_safety: { perLevel: 0.09, type: 'multiplicative' },
      exotic_matter_handling: { perLevel: 0.06, type: 'multiplicative' }
    },
    prerequisites: ['temporal_mechanics:5']
  },

  // Emergency Response Skills
  damage_control: {
    name: 'Damage Control',
    description: 'Rapid system repair and emergency procedures',
    maxLevel: 20,
    skillTree: 'engineering',
    effects: {
      emergency_repair_speed: { perLevel: 0.05, type: 'multiplicative' },
      system_failure_recovery: { perLevel: 0.04, type: 'multiplicative' },
      backup_system_efficiency: { perLevel: 0.03, type: 'multiplicative' }
    },
    prerequisites: ['advanced_engineering:5']
  },

  crisis_management: {
    name: 'Crisis Management',
    description: 'Leadership and coordination during hazardous situations',
    maxLevel: 15,
    skillTree: 'leadership',
    effects: {
      crew_panic_resistance: { perLevel: 0.04, type: 'multiplicative' },
      emergency_response_time: { perLevel: 0.05, type: 'multiplicative' },
      system_prioritization: { perLevel: 0.03, type: 'multiplicative' }
    },
    prerequisites: ['crew_management:8']
  },

  // Medical & Life Support
  space_medicine: {
    name: 'Space Medicine',
    description: 'Treatment of radiation sickness and space-related injuries',
    maxLevel: 12,
    skillTree: 'leadership',
    effects: {
      radiation_treatment_effectiveness: { perLevel: 0.08, type: 'multiplicative' },
      crew_recovery_speed: { perLevel: 0.06, type: 'multiplicative' },
      life_support_efficiency: { perLevel: 0.04, type: 'multiplicative' }
    },
    prerequisites: ['crisis_management:6']
  }
};

/**
 * Hazard-specific countermeasure unlock requirements
 */
const COUNTERMEASURE_SKILL_REQUIREMENTS = {
  enhanced_navigation: {
    requiredSkills: { hazard_navigation: 5 },
    effectivenessBonus: 0.2 // 20% more effective with skill
  },
  
  reinforced_hull: {
    requiredSkills: { structural_engineering: 8 },
    effectivenessBonus: 0.3
  },
  
  emp_shielding: {
    requiredSkills: { electromagnetic_hardening: 6 },
    effectivenessBonus: 0.25
  },
  
  backup_systems: {
    requiredSkills: { damage_control: 10 },
    effectivenessBonus: 0.2
  },
  
  advanced_sensors: {
    requiredSkills: { advanced_sensors: 12 },
    effectivenessBonus: 0.15
  },
  
  navigation_computer: {
    requiredSkills: { hazard_navigation: 15, advanced_sensors: 8 },
    effectivenessBonus: 0.3
  },
  
  gravity_compensators: {
    requiredSkills: { gravitational_physics: 8 },
    effectivenessBonus: 0.35
  },
  
  structural_reinforcement: {
    requiredSkills: { structural_engineering: 12 },
    effectivenessBonus: 0.25
  },
  
  magnetic_shielding: {
    requiredSkills: { electromagnetic_hardening: 10 },
    effectivenessBonus: 0.2
  },
  
  inertial_navigation: {
    requiredSkills: { hazard_navigation: 18 },
    effectivenessBonus: 0.4
  },
  
  radiation_shielding: {
    requiredSkills: { radiation_shielding: 10 },
    effectivenessBonus: 0.3
  },
  
  medical_bay: {
    requiredSkills: { space_medicine: 8 },
    effectivenessBonus: 0.25
  },
  
  temporal_stabilizers: {
    requiredSkills: { temporal_mechanics: 6 },
    effectivenessBonus: 0.5
  },
  
  chronometer_systems: {
    requiredSkills: { temporal_mechanics: 4 },
    effectivenessBonus: 0.2
  },
  
  wormhole_navigator: {
    requiredSkills: { wormhole_theory: 6 },
    effectivenessBonus: 0.4
  },
  
  exotic_matter_stabilizer: {
    requiredSkills: { wormhole_theory: 8, temporal_mechanics: 10 },
    effectivenessBonus: 0.5
  }
};

/**
 * HazardSkillIntegrator class manages the integration between hazards and skills
 */
class HazardSkillIntegrator {
  constructor(skillSystem, hazardEffectsSystem, database) {
    this.skillSystem = skillSystem;
    this.hazardEffects = hazardEffectsSystem;
    this.db = database;
    this.playerSkillBonuses = new Map(); // Cache for calculated bonuses
  }

  /**
   * Initialize hazard skill integration
   */
  async initialize() {
    // Add hazard mitigation skills to the main skill system
    this.addHazardSkillsToSkillTrees();
    
    console.log('Hazard skill integration initialized');
  }

  /**
   * Add hazard mitigation skills to the main skill trees
   */
  addHazardSkillsToSkillTrees() {
    for (const [skillId, skillDef] of Object.entries(HAZARD_MITIGATION_SKILLS)) {
      const treeKey = skillDef.skillTree;
      
      if (this.skillSystem.skillTrees[treeKey]) {
        this.skillSystem.skillTrees[treeKey].skills[skillId] = skillDef;
      }
    }
  }

  /**
   * Calculate hazard resistance bonuses for a player
   */
  async calculateHazardResistance(playerId) {
    const playerSkills = await this.skillSystem.getPlayerSkills(playerId);
    const resistance = {};

    // Initialize resistance values for all hazard types
    Object.keys(HAZARD_TYPES).forEach(hazardType => {
      resistance[hazardType] = {
        damageReduction: 0,
        durationReduction: 0,
        detectionBonus: 0,
        recoveryBonus: 0
      };
    });

    // Calculate bonuses from skills
    for (const [skillId, playerSkill] of Object.entries(playerSkills)) {
      const skillDef = HAZARD_MITIGATION_SKILLS[skillId];
      if (!skillDef) continue;

      const level = playerSkill.level || 0;
      this.applySkillEffectsToResistance(skillId, level, skillDef, resistance);
    }

    // Cache the results
    this.playerSkillBonuses.set(playerId, {
      resistance,
      calculatedAt: Date.now()
    });

    return resistance;
  }

  /**
   * Apply skill effects to hazard resistance
   */
  applySkillEffectsToResistance(skillId, level, skillDef, resistance) {
    const effects = skillDef.effects;

    // Apply effects based on skill specialization
    switch (skillId) {
      case 'hazard_navigation':
        this.applyNavigationEffects(level, effects, resistance);
        break;
      case 'structural_engineering':
        this.applyStructuralEffects(level, effects, resistance);
        break;
      case 'electromagnetic_hardening':
        this.applyEMPEffects(level, effects, resistance);
        break;
      case 'radiation_shielding':
        this.applyRadiationEffects(level, effects, resistance);
        break;
      case 'gravitational_physics':
        this.applyGravityEffects(level, effects, resistance);
        break;
      case 'temporal_mechanics':
        this.applyTemporalEffects(level, effects, resistance);
        break;
      case 'wormhole_theory':
        this.applyWormholeEffects(level, effects, resistance);
        break;
      case 'advanced_sensors':
        this.applySensorEffects(level, effects, resistance);
        break;
      case 'damage_control':
        this.applyDamageControlEffects(level, effects, resistance);
        break;
    }
  }

  /**
   * Apply navigation skill effects
   */
  applyNavigationEffects(level, effects, resistance) {
    const bonus = level * (effects.asteroid_collision_avoidance?.perLevel || 0);
    resistance.ASTEROID_FIELD.damageReduction += bonus;
    
    // General navigation benefits all hazard types
    Object.values(resistance).forEach(hazardRes => {
      hazardRes.recoveryBonus += level * 0.02; // 2% faster recovery per level
    });
  }

  /**
   * Apply structural engineering effects
   */
  applyStructuralEffects(level, effects, resistance) {
    const gravityBonus = level * (effects.gravitational_stress_resistance?.perLevel || 0);
    const hullBonus = level * (effects.hull_integrity_bonus?.perLevel || 0);
    const collisionBonus = level * (effects.collision_damage_reduction?.perLevel || 0);
    
    resistance.GRAVITATIONAL_ANOMALY.damageReduction += gravityBonus;
    resistance.ASTEROID_FIELD.damageReduction += collisionBonus;
    
    // Hull integrity helps with all physical damage
    ['ASTEROID_FIELD', 'GRAVITATIONAL_ANOMALY', 'MAGNETIC_STORM'].forEach(hazardType => {
      resistance[hazardType].damageReduction += hullBonus;
    });
  }

  /**
   * Apply electromagnetic hardening effects
   */
  applyEMPEffects(level, effects, resistance) {
    const empBonus = level * (effects.emp_resistance?.perLevel || 0);
    const electronicsBonus = level * (effects.electronics_failure_resistance?.perLevel || 0);
    const solarBonus = level * (effects.solar_flare_protection?.perLevel || 0);
    
    resistance.SOLAR_FLARE.damageReduction += solarBonus;
    resistance.MAGNETIC_STORM.damageReduction += empBonus;
    
    // Electronics protection helps with system-based hazards
    ['SOLAR_FLARE', 'MAGNETIC_STORM', 'COSMIC_RADIATION'].forEach(hazardType => {
      resistance[hazardType].durationReduction += electronicsBonus;
    });
  }

  /**
   * Apply radiation shielding effects
   */
  applyRadiationEffects(level, effects, resistance) {
    const radiationBonus = level * (effects.radiation_damage_reduction?.perLevel || 0);
    const healthBonus = level * (effects.crew_health_protection?.perLevel || 0);
    const degradationBonus = level * (effects.system_degradation_resistance?.perLevel || 0);
    
    resistance.COSMIC_RADIATION.damageReduction += radiationBonus;
    resistance.SOLAR_FLARE.damageReduction += radiationBonus * 0.5;
    
    // Health and system protection
    Object.values(resistance).forEach(hazardRes => {
      hazardRes.recoveryBonus += healthBonus;
    });
  }

  /**
   * Apply gravitational physics effects
   */
  applyGravityEffects(level, effects, resistance) {
    const gravityBonus = level * (effects.gravity_well_navigation?.perLevel || 0);
    const blackHoleBonus = level * (effects.black_hole_survival?.perLevel || 0);
    
    resistance.GRAVITATIONAL_ANOMALY.damageReduction += gravityBonus;
    resistance.GRAVITATIONAL_ANOMALY.durationReduction += blackHoleBonus;
    
    // Gravitational assist for faster travel
    Object.values(resistance).forEach(hazardRes => {
      hazardRes.recoveryBonus += level * 0.01;
    });
  }

  /**
   * Apply temporal mechanics effects
   */
  applyTemporalEffects(level, effects, resistance) {
    const temporalBonus = level * (effects.temporal_distortion_resistance?.perLevel || 0);
    const displacementBonus = level * (effects.time_displacement_recovery?.perLevel || 0);
    
    resistance.TEMPORAL_ANOMALY.damageReduction += temporalBonus;
    resistance.TEMPORAL_ANOMALY.recoveryBonus += displacementBonus;
  }

  /**
   * Apply wormhole theory effects
   */
  applyWormholeEffects(level, effects, resistance) {
    const stabilityBonus = level * (effects.wormhole_stability_detection?.perLevel || 0);
    const safetyBonus = level * (effects.wormhole_entry_safety?.perLevel || 0);
    
    resistance.WORMHOLE.damageReduction += safetyBonus;
    resistance.WORMHOLE.detectionBonus += stabilityBonus;
  }

  /**
   * Apply sensor effects
   */
  applySensorEffects(level, effects, resistance) {
    const detectionBonus = level * (effects.hazard_detection_range?.perLevel || 0);
    const warningBonus = level * (effects.early_warning_time?.perLevel || 0);
    
    // Better sensors help with all hazard types
    Object.values(resistance).forEach(hazardRes => {
      hazardRes.detectionBonus += detectionBonus;
      hazardRes.recoveryBonus += warningBonus * 0.5;
    });
  }

  /**
   * Apply damage control effects
   */
  applyDamageControlEffects(level, effects, resistance) {
    const repairBonus = level * (effects.emergency_repair_speed?.perLevel || 0);
    const recoveryBonus = level * (effects.system_failure_recovery?.perLevel || 0);
    
    // Faster repairs help with all hazard types
    Object.values(resistance).forEach(hazardRes => {
      hazardRes.recoveryBonus += repairBonus;
      hazardRes.durationReduction += recoveryBonus;
    });
  }

  /**
   * Check if player can use a countermeasure
   */
  async canPlayerUseCountermeasure(playerId, countermeasureId) {
    const requirements = COUNTERMEASURE_SKILL_REQUIREMENTS[countermeasureId];
    if (!requirements) return true; // No requirements

    const playerSkills = await this.skillSystem.getPlayerSkills(playerId);
    
    for (const [requiredSkill, requiredLevel] of Object.entries(requirements.requiredSkills)) {
      const playerSkill = playerSkills[requiredSkill];
      if (!playerSkill || playerSkill.level < requiredLevel) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get countermeasure effectiveness bonus from skills
   */
  async getCountermeasureEffectiveness(playerId, countermeasureId) {
    const requirements = COUNTERMEASURE_SKILL_REQUIREMENTS[countermeasureId];
    if (!requirements) return 1.0; // No bonus

    const canUse = await this.canPlayerUseCountermeasure(playerId, countermeasureId);
    if (!canUse) return 0.5; // Reduced effectiveness without skills

    const playerSkills = await this.skillSystem.getPlayerSkills(playerId);
    let effectivenessMultiplier = 1.0 + requirements.effectivenessBonus;

    // Additional bonuses based on skill levels above minimum
    for (const [requiredSkill, requiredLevel] of Object.entries(requirements.requiredSkills)) {
      const playerSkill = playerSkills[requiredSkill];
      if (playerSkill && playerSkill.level > requiredLevel) {
        const extraLevels = playerSkill.level - requiredLevel;
        effectivenessMultiplier += extraLevels * 0.02; // 2% per extra level
      }
    }

    return Math.min(2.0, effectivenessMultiplier); // Cap at 200% effectiveness
  }

  /**
   * Award skill experience based on hazard encounters
   */
  async awardHazardExperience(playerId, hazardType, exposureTime, damageDealt) {
    const experienceGains = {};

    // Base experience from exposure time (1 XP per second)
    const baseXP = Math.floor(exposureTime / 1000);

    // Bonus XP for surviving damage
    const survivalXP = Math.floor(damageDealt / 10);

    // Distribute XP to relevant skills
    switch (hazardType) {
      case 'ASTEROID_FIELD':
        experienceGains.hazard_navigation = baseXP * 1.5;
        experienceGains.structural_engineering = survivalXP;
        break;
        
      case 'SOLAR_FLARE':
        experienceGains.electromagnetic_hardening = baseXP * 1.2;
        experienceGains.damage_control = survivalXP;
        break;
        
      case 'COSMIC_RADIATION':
        experienceGains.radiation_shielding = baseXP * 1.3;
        experienceGains.space_medicine = survivalXP;
        break;
        
      case 'GRAVITATIONAL_ANOMALY':
        experienceGains.gravitational_physics = baseXP * 2.0;
        experienceGains.structural_engineering = survivalXP;
        break;
        
      case 'TEMPORAL_ANOMALY':
        experienceGains.temporal_mechanics = baseXP * 3.0;
        experienceGains.crisis_management = survivalXP;
        break;
        
      case 'WORMHOLE':
        experienceGains.wormhole_theory = baseXP * 2.5;
        experienceGains.hazard_navigation = baseXP * 0.5;
        break;
        
      case 'MAGNETIC_STORM':
        experienceGains.electromagnetic_hardening = baseXP;
        experienceGains.hazard_navigation = baseXP * 0.8;
        break;
        
      case 'NEBULA_INTERFERENCE':
        experienceGains.advanced_sensors = baseXP;
        experienceGains.hazard_navigation = baseXP * 0.6;
        break;
    }

    // Award the experience
    for (const [skillId, xp] of Object.entries(experienceGains)) {
      if (xp > 0) {
        await this.skillSystem.awardSkillExperience(playerId, skillId, xp);
      }
    }
  }

  /**
   * Get hazard skill recommendations for player
   */
  async getSkillRecommendations(playerId, recentHazardExposures) {
    const recommendations = [];
    const playerSkills = await this.skillSystem.getPlayerSkills(playerId);
    
    // Analyze recent hazard encounters
    const hazardCounts = {};
    for (const exposure of recentHazardExposures) {
      hazardCounts[exposure.hazardType] = (hazardCounts[exposure.hazardType] || 0) + 1;
    }
    
    // Recommend skills based on most encountered hazards
    for (const [hazardType, count] of Object.entries(hazardCounts)) {
      const recommendedSkills = this.getRecommendedSkillsForHazard(hazardType);
      
      for (const skillId of recommendedSkills) {
        const currentLevel = playerSkills[skillId]?.level || 0;
        const maxLevel = HAZARD_MITIGATION_SKILLS[skillId]?.maxLevel || 0;
        
        if (currentLevel < maxLevel) {
          recommendations.push({
            skillId,
            reason: `Improve resistance to ${hazardType.replace('_', ' ').toLowerCase()}`,
            priority: count * (maxLevel - currentLevel),
            currentLevel,
            maxLevel
          });
        }
      }
    }
    
    // Sort by priority
    recommendations.sort((a, b) => b.priority - a.priority);
    
    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  /**
   * Get recommended skills for a specific hazard type
   */
  getRecommendedSkillsForHazard(hazardType) {
    const skillMap = {
      ASTEROID_FIELD: ['hazard_navigation', 'structural_engineering'],
      SOLAR_FLARE: ['electromagnetic_hardening', 'damage_control'],
      COSMIC_RADIATION: ['radiation_shielding', 'space_medicine'],
      GRAVITATIONAL_ANOMALY: ['gravitational_physics', 'structural_engineering'],
      TEMPORAL_ANOMALY: ['temporal_mechanics', 'crisis_management'],
      WORMHOLE: ['wormhole_theory', 'hazard_navigation'],
      MAGNETIC_STORM: ['electromagnetic_hardening', 'hazard_navigation'],
      NEBULA_INTERFERENCE: ['advanced_sensors', 'hazard_navigation']
    };
    
    return skillMap[hazardType] || ['hazard_navigation'];
  }

  /**
   * Get integration statistics
   */
  getIntegrationStats() {
    return {
      hazardSkills: Object.keys(HAZARD_MITIGATION_SKILLS).length,
      countermeasureRequirements: Object.keys(COUNTERMEASURE_SKILL_REQUIREMENTS).length,
      cachedPlayerBonuses: this.playerSkillBonuses.size
    };
  }
}

module.exports = { 
  HazardSkillIntegrator,
  HAZARD_MITIGATION_SKILLS,
  COUNTERMEASURE_SKILL_REQUIREMENTS
};