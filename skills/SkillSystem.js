/**
 * Skill System for StarForgeFrontier
 * Manages player character progression, skill trees, and abilities
 */

const { v4: uuidv4 } = require('uuid');

class SkillSystem {
  constructor(database) {
    this.db = database;
    this.skillTrees = this.initializeSkillTrees();
    this.maxSkillLevel = 100;
    this.skillPointsPerLevel = 2;
  }

  /**
   * Initialize skill trees with their structure and requirements
   */
  initializeSkillTrees() {
    return {
      combat: {
        name: 'Combat',
        description: 'Weapons mastery, tactical combat, and ship-to-ship warfare',
        skills: {
          weapon_systems: {
            name: 'Weapon Systems',
            description: 'Increases weapon damage and reduces firing delay',
            maxLevel: 20,
            effects: {
              weapon_damage_bonus: { perLevel: 0.05, type: 'multiplicative' }, // 5% per level
              weapon_cooldown_reduction: { perLevel: 0.02, type: 'multiplicative' } // 2% per level
            },
            prerequisites: []
          },
          tactical_systems: {
            name: 'Tactical Systems',
            description: 'Improves targeting systems and combat awareness',
            maxLevel: 15,
            effects: {
              weapon_range_bonus: { perLevel: 0.03, type: 'multiplicative' }, // 3% per level
              target_lock_speed: { perLevel: 0.04, type: 'multiplicative' } // 4% per level
            },
            prerequisites: ['weapon_systems:5']
          },
          shield_mastery: {
            name: 'Shield Mastery',
            description: 'Increases shield effectiveness and regeneration',
            maxLevel: 18,
            effects: {
              shield_capacity_bonus: { perLevel: 0.04, type: 'multiplicative' }, // 4% per level
              shield_regen_rate: { perLevel: 0.03, type: 'multiplicative' } // 3% per level
            },
            prerequisites: []
          },
          combat_tactics: {
            name: 'Combat Tactics',
            description: 'Advanced combat maneuvers and fleet coordination',
            maxLevel: 12,
            effects: {
              evasion_bonus: { perLevel: 0.02, type: 'multiplicative' }, // 2% per level
              critical_hit_chance: { perLevel: 0.01, type: 'additive' } // 1% per level
            },
            prerequisites: ['tactical_systems:8', 'weapon_systems:10']
          }
        }
      },

      engineering: {
        name: 'Engineering',
        description: 'Ship systems, power management, and component efficiency',
        skills: {
          power_systems: {
            name: 'Power Systems',
            description: 'Improves power generation and distribution efficiency',
            maxLevel: 20,
            effects: {
              power_generation_bonus: { perLevel: 0.03, type: 'multiplicative' }, // 3% per level
              power_efficiency: { perLevel: 0.02, type: 'multiplicative' } // 2% per level
            },
            prerequisites: []
          },
          propulsion_systems: {
            name: 'Propulsion Systems',
            description: 'Increases ship speed and maneuverability',
            maxLevel: 18,
            effects: {
              engine_efficiency: { perLevel: 0.04, type: 'multiplicative' }, // 4% per level
              fuel_efficiency: { perLevel: 0.03, type: 'multiplicative' } // 3% per level
            },
            prerequisites: []
          },
          system_integration: {
            name: 'System Integration',
            description: 'Optimizes component synergy and reduces system strain',
            maxLevel: 15,
            effects: {
              component_synergy: { perLevel: 0.025, type: 'multiplicative' }, // 2.5% per level
              maintenance_reduction: { perLevel: 0.02, type: 'multiplicative' } // 2% per level
            },
            prerequisites: ['power_systems:8', 'propulsion_systems:6']
          },
          advanced_engineering: {
            name: 'Advanced Engineering',
            description: 'Unlocks prototype components and experimental systems',
            maxLevel: 10,
            effects: {
              prototype_unlock: { perLevel: 1, type: 'unlock' }, // Unlocks advanced components
              system_overcharge: { perLevel: 0.05, type: 'multiplicative' } // 5% per level
            },
            prerequisites: ['system_integration:10']
          }
        }
      },

      trading: {
        name: 'Trading',
        description: 'Commerce, negotiation, and economic manipulation',
        skills: {
          market_analysis: {
            name: 'Market Analysis',
            description: 'Better understanding of market trends and prices',
            maxLevel: 20,
            effects: {
              price_visibility: { perLevel: 0.1, type: 'additive' }, // 10% more price info per level
              profit_margin_bonus: { perLevel: 0.02, type: 'multiplicative' } // 2% per level
            },
            prerequisites: []
          },
          negotiation: {
            name: 'Negotiation',
            description: 'Improves trading prices and contract terms',
            maxLevel: 18,
            effects: {
              buy_price_reduction: { perLevel: 0.015, type: 'multiplicative' }, // 1.5% per level
              sell_price_bonus: { perLevel: 0.02, type: 'multiplicative' } // 2% per level
            },
            prerequisites: []
          },
          logistics: {
            name: 'Logistics',
            description: 'Optimizes cargo management and delivery efficiency',
            maxLevel: 15,
            effects: {
              cargo_efficiency: { perLevel: 0.03, type: 'multiplicative' }, // 3% per level
              delivery_time_bonus: { perLevel: 0.025, type: 'multiplicative' } // 2.5% per level
            },
            prerequisites: ['market_analysis:5']
          },
          economic_warfare: {
            name: 'Economic Warfare',
            description: 'Advanced trading strategies and market manipulation',
            maxLevel: 12,
            effects: {
              market_influence: { perLevel: 0.04, type: 'multiplicative' }, // 4% per level
              exclusive_contracts: { perLevel: 1, type: 'unlock' } // Unlocks special contracts
            },
            prerequisites: ['negotiation:10', 'logistics:8']
          }
        }
      },

      exploration: {
        name: 'Exploration',
        description: 'Navigation, surveying, and deep space discovery',
        skills: {
          navigation: {
            name: 'Navigation',
            description: 'Reduces warp costs and improves travel efficiency',
            maxLevel: 20,
            effects: {
              warp_cost_reduction: { perLevel: 0.025, type: 'multiplicative' }, // 2.5% per level
              navigation_accuracy: { perLevel: 0.02, type: 'multiplicative' } // 2% per level
            },
            prerequisites: []
          },
          scanning_systems: {
            name: 'Scanning Systems',
            description: 'Improves sensor range and detection capabilities',
            maxLevel: 18,
            effects: {
              sensor_range_bonus: { perLevel: 0.05, type: 'multiplicative' }, // 5% per level
              ore_detection_bonus: { perLevel: 0.03, type: 'multiplicative' } // 3% per level
            },
            prerequisites: []
          },
          xenoarchaeology: {
            name: 'Xenoarchaeology',
            description: 'Allows discovery and analysis of alien artifacts',
            maxLevel: 15,
            effects: {
              artifact_detection: { perLevel: 0.04, type: 'multiplicative' }, // 4% per level
              artifact_value_bonus: { perLevel: 0.06, type: 'multiplicative' } // 6% per level
            },
            prerequisites: ['scanning_systems:8']
          },
          deep_space_exploration: {
            name: 'Deep Space Exploration',
            description: 'Unlocks access to dangerous but rewarding sectors',
            maxLevel: 10,
            effects: {
              hazard_resistance: { perLevel: 0.05, type: 'multiplicative' }, // 5% per level
              rare_sector_access: { perLevel: 1, type: 'unlock' } // Unlocks rare sectors
            },
            prerequisites: ['navigation:12', 'xenoarchaeology:8']
          }
        }
      },

      leadership: {
        name: 'Leadership',
        description: 'Fleet command, crew management, and organizational skills',
        skills: {
          crew_management: {
            name: 'Crew Management',
            description: 'Improves crew efficiency and ship operations',
            maxLevel: 20,
            effects: {
              crew_efficiency: { perLevel: 0.025, type: 'multiplicative' }, // 2.5% per level
              experience_gain_bonus: { perLevel: 0.02, type: 'multiplicative' } // 2% per level
            },
            prerequisites: []
          },
          fleet_coordination: {
            name: 'Fleet Coordination',
            description: 'Enables command of multiple ships and AI assistants',
            maxLevel: 15,
            effects: {
              ai_ship_efficiency: { perLevel: 0.04, type: 'multiplicative' }, // 4% per level
              fleet_size_bonus: { perLevel: 0.2, type: 'additive' } // +0.2 ships per level
            },
            prerequisites: ['crew_management:8']
          },
          diplomacy: {
            name: 'Diplomacy',
            description: 'Improves faction relations and conflict resolution',
            maxLevel: 18,
            effects: {
              reputation_gain_bonus: { perLevel: 0.03, type: 'multiplicative' }, // 3% per level
              diplomacy_options: { perLevel: 1, type: 'unlock' } // Unlocks dialogue options
            },
            prerequisites: []
          },
          strategic_command: {
            name: 'Strategic Command',
            description: 'Advanced fleet tactics and large-scale operations',
            maxLevel: 12,
            effects: {
              strategic_bonuses: { perLevel: 0.05, type: 'multiplicative' }, // 5% per level
              command_range_bonus: { perLevel: 0.1, type: 'multiplicative' } // 10% per level
            },
            prerequisites: ['fleet_coordination:10', 'diplomacy:8']
          }
        }
      }
    };
  }

  /**
   * Calculate skill points required for a level
   */
  getSkillPointsForLevel(level) {
    // Exponential cost increase: level^1.5 * base_cost
    const baseCost = 10;
    return Math.floor(Math.pow(level, 1.5) * baseCost);
  }

  /**
   * Get total skill points required up to level
   */
  getTotalSkillPointsToLevel(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) {
      total += this.getSkillPointsForLevel(i);
    }
    return total;
  }

  /**
   * Award skill points to player based on activity
   */
  async awardSkillPoints(playerId, activity, amount) {
    const skillPointMap = {
      combat: ['weapon_kill', 'enemy_destroyed', 'combat_victory'],
      engineering: ['component_installed', 'system_optimized', 'repair_completed'],
      trading: ['trade_completed', 'contract_delivered', 'profit_earned', 'ore_collected'],
      exploration: ['sector_discovered', 'ore_collected', 'artifact_found'],
      leadership: ['mission_led', 'crew_trained', 'diplomacy_success']
    };

    // Determine which skill trees should receive points
    const eligibleTrees = [];
    for (const [tree, activities] of Object.entries(skillPointMap)) {
      if (activities.includes(activity)) {
        eligibleTrees.push(tree);
      }
    }

    if (eligibleTrees.length === 0) {
      return;
    }

    // Award points to eligible trees
    for (const tree of eligibleTrees) {
      await this.addSkillPoints(playerId, tree, amount);
    }
  }

  /**
   * Add skill points to a specific tree
   */
  async addSkillPoints(playerId, skillTree, points) {
    const existing = await this.db.get(
      'SELECT * FROM player_skill_points WHERE player_id = ? AND skill_tree = ?',
      [playerId, skillTree]
    );

    if (existing) {
      await this.db.run(
        'UPDATE player_skill_points SET available_points = available_points + ?, total_earned = total_earned + ? WHERE player_id = ? AND skill_tree = ?',
        [points, points, playerId, skillTree]
      );
    } else {
      await this.db.run(
        'INSERT INTO player_skill_points (player_id, skill_tree, available_points, total_earned) VALUES (?, ?, ?, ?)',
        [playerId, skillTree, points, points]
      );
    }
  }

  /**
   * Spend skill points to upgrade a skill
   */
  async upgradeSkill(playerId, skillTree, skillName) {
    const skill = this.skillTrees[skillTree]?.skills[skillName];
    if (!skill) {
      throw new Error('Invalid skill');
    }

    // Get current skill level
    const currentSkill = await this.db.get(
      'SELECT level FROM player_skills WHERE player_id = ? AND skill_tree = ? AND skill_name = ?',
      [playerId, skillTree, skillName]
    );

    const currentLevel = currentSkill ? currentSkill.level : 0;
    const newLevel = currentLevel + 1;

    if (newLevel > skill.maxLevel) {
      throw new Error('Skill already at maximum level');
    }

    // Check prerequisites
    const prereqsMet = await this.checkPrerequisites(playerId, skill.prerequisites);
    if (!prereqsMet) {
      throw new Error('Prerequisites not met');
    }

    // Calculate cost
    const cost = this.getSkillPointsForLevel(newLevel);

    // Check available points
    const skillPoints = await this.db.get(
      'SELECT available_points FROM player_skill_points WHERE player_id = ? AND skill_tree = ?',
      [playerId, skillTree]
    );

    if (!skillPoints || skillPoints.available_points < cost) {
      throw new Error('Insufficient skill points');
    }

    // Begin transaction
    await this.db.run('BEGIN TRANSACTION');

    try {
      // Deduct skill points
      await this.db.run(
        'UPDATE player_skill_points SET available_points = available_points - ? WHERE player_id = ? AND skill_tree = ?',
        [cost, playerId, skillTree]
      );

      // Update or insert skill level
      if (currentSkill) {
        await this.db.run(
          'UPDATE player_skills SET level = ?, updated_at = CURRENT_TIMESTAMP WHERE player_id = ? AND skill_tree = ? AND skill_name = ?',
          [newLevel, playerId, skillTree, skillName]
        );
      } else {
        await this.db.run(
          'INSERT INTO player_skills (player_id, skill_tree, skill_name, level) VALUES (?, ?, ?, ?)',
          [playerId, skillTree, skillName, newLevel]
        );
      }

      // Record skill upgrade event
      await this.db.run(
        'INSERT INTO skill_events (id, player_id, event_type, skill_tree, skill_name, old_level, new_level, skill_points_spent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), playerId, 'skill_upgrade', skillTree, skillName, currentLevel, newLevel, cost]
      );

      await this.db.run('COMMIT');
      return { success: true, newLevel, pointsSpent: cost };
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Check if skill prerequisites are met
   */
  async checkPrerequisites(playerId, prerequisites) {
    if (!prerequisites || prerequisites.length === 0) {
      return true;
    }

    for (const prereq of prerequisites) {
      const [skillPath, requiredLevel] = prereq.split(':');
      const [skillTree, skillName] = skillPath.split('.');

      const skill = await this.db.get(
        'SELECT level FROM player_skills WHERE player_id = ? AND skill_tree = ? AND skill_name = ?',
        [playerId, skillTree || skillPath, skillName || skillPath]
      );

      const currentLevel = skill ? skill.level : 0;
      if (currentLevel < parseInt(requiredLevel)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all player skills
   */
  async getPlayerSkills(playerId) {
    const skills = await this.db.all(
      'SELECT * FROM player_skills WHERE player_id = ?',
      [playerId]
    );

    const skillPoints = await this.db.all(
      'SELECT * FROM player_skill_points WHERE player_id = ?',
      [playerId]
    );

    // Convert to structured format
    const result = {
      skills: {},
      skillPoints: {}
    };

    for (const skill of skills) {
      if (!result.skills[skill.skill_tree]) {
        result.skills[skill.skill_tree] = {};
      }
      result.skills[skill.skill_tree][skill.skill_name] = {
        level: skill.level,
        updatedAt: skill.updated_at
      };
    }

    for (const points of skillPoints) {
      result.skillPoints[points.skill_tree] = points.available_points;
    }

    return result;
  }

  /**
   * Calculate skill effects for a player
   */
  async calculatePlayerSkillEffects(playerId) {
    const playerSkills = await this.getPlayerSkills(playerId);
    const effects = {};

    // Calculate effects from all skills
    for (const [treeName, treeSkills] of Object.entries(playerSkills.skills)) {
      const skillTree = this.skillTrees[treeName];
      if (!skillTree) continue;

      for (const [skillName, playerSkill] of Object.entries(treeSkills)) {
        const skill = skillTree.skills[skillName];
        if (!skill || !skill.effects) continue;

        for (const [effectName, effectData] of Object.entries(skill.effects)) {
          if (!effects[effectName]) {
            effects[effectName] = { value: 0, type: effectData.type };
          }

          const effectValue = effectData.perLevel * playerSkill.level;

          if (effectData.type === 'additive') {
            effects[effectName].value += effectValue;
          } else if (effectData.type === 'multiplicative') {
            if (effects[effectName].value === 0) {
              effects[effectName].value = effectValue;
            } else {
              effects[effectName].value = (1 + effects[effectName].value) * (1 + effectValue) - 1;
            }
          } else if (effectData.type === 'unlock') {
            effects[effectName].value += effectValue;
          }
        }
      }
    }

    return effects;
  }

  /**
   * Get skill tree information
   */
  getSkillTreeInfo(treeName) {
    return this.skillTrees[treeName] || null;
  }

  /**
   * Get all skill trees
   */
  getAllSkillTrees() {
    return this.skillTrees;
  }

  /**
   * Get player's skill progress in a tree
   */
  async getSkillTreeProgress(playerId, treeName) {
    const tree = this.skillTrees[treeName];
    if (!tree) return null;

    const playerSkills = await this.db.all(
      'SELECT * FROM player_skills WHERE player_id = ? AND skill_tree = ?',
      [playerId, treeName]
    );

    const skillPoints = await this.db.get(
      'SELECT available_points FROM player_skill_points WHERE player_id = ? AND skill_tree = ?',
      [playerId, treeName]
    );

    const progress = {
      tree: tree,
      availablePoints: skillPoints ? skillPoints.available_points : 0,
      skills: {}
    };

    // Add all skills from the tree with current levels
    for (const [skillName, skillData] of Object.entries(tree.skills)) {
      const playerSkill = playerSkills.find(s => s.skill_name === skillName);
      const currentLevel = playerSkill ? playerSkill.level : 0;

      progress.skills[skillName] = {
        ...skillData,
        currentLevel,
        nextLevelCost: currentLevel < skillData.maxLevel ? this.getSkillPointsForLevel(currentLevel + 1) : null,
        canUpgrade: await this.canUpgradeSkill(playerId, treeName, skillName, currentLevel)
      };
    }

    return progress;
  }

  /**
   * Check if a skill can be upgraded
   */
  async canUpgradeSkill(playerId, skillTree, skillName, currentLevel) {
    const skill = this.skillTrees[skillTree]?.skills[skillName];
    if (!skill || currentLevel >= skill.maxLevel) {
      return false;
    }

    // Check prerequisites
    const prereqsMet = await this.checkPrerequisites(playerId, skill.prerequisites);
    if (!prereqsMet) {
      return false;
    }

    // Check skill points
    const cost = this.getSkillPointsForLevel(currentLevel + 1);
    const skillPoints = await this.db.get(
      'SELECT available_points FROM player_skill_points WHERE player_id = ? AND skill_tree = ?',
      [playerId, skillTree]
    );

    return skillPoints && skillPoints.available_points >= cost;
  }

  /**
   * Get skill upgrade history for player
   */
  async getSkillHistory(playerId, limit = 20) {
    return await this.db.all(
      'SELECT * FROM skill_events WHERE player_id = ? ORDER BY created_at DESC LIMIT ?',
      [playerId, limit]
    );
  }

  /**
   * Reset all skills for a player (with confirmation)
   */
  async resetPlayerSkills(playerId, confirmationCode) {
    if (confirmationCode !== 'RESET_SKILLS_CONFIRMED') {
      throw new Error('Invalid confirmation code');
    }

    await this.db.run('BEGIN TRANSACTION');

    try {
      // Calculate total points to refund
      const skills = await this.db.all(
        'SELECT * FROM player_skills WHERE player_id = ?',
        [playerId]
      );

      const refundByTree = {};
      for (const skill of skills) {
        if (!refundByTree[skill.skill_tree]) {
          refundByTree[skill.skill_tree] = 0;
        }
        refundByTree[skill.skill_tree] += this.getTotalSkillPointsToLevel(skill.level);
      }

      // Clear all skills
      await this.db.run('DELETE FROM player_skills WHERE player_id = ?', [playerId]);

      // Refund skill points
      for (const [tree, points] of Object.entries(refundByTree)) {
        const existing = await this.db.get(
          'SELECT available_points FROM player_skill_points WHERE player_id = ? AND skill_tree = ?',
          [playerId, tree]
        );

        if (existing) {
          await this.db.run(
            'UPDATE player_skill_points SET available_points = available_points + ? WHERE player_id = ? AND skill_tree = ?',
            [points, playerId, tree]
          );
        } else {
          await this.db.run(
            'INSERT INTO player_skill_points (player_id, skill_tree, available_points) VALUES (?, ?, ?)',
            [playerId, tree, points]
          );
        }
      }

      // Record reset event
      await this.db.run(
        'INSERT INTO skill_events (id, player_id, event_type, data) VALUES (?, ?, ?, ?)',
        [uuidv4(), playerId, 'skill_reset', JSON.stringify(refundByTree)]
      );

      await this.db.run('COMMIT');
      return { success: true, refundedPoints: refundByTree };
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }
}

module.exports = SkillSystem;