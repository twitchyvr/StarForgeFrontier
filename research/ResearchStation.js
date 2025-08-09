/**
 * ResearchStation.js
 * Research stations and laboratories for the Research & Technology System
 * Handles laboratory construction, upgrades, and research facility management
 */

const { v4: uuidv4 } = require('uuid');

class ResearchStation {
  constructor(database, sectorManager) {
    this.database = database;
    this.sectorManager = sectorManager;
    
    // Laboratory types and their capabilities
    this.laboratoryTypes = {
      BASIC: {
        name: 'Basic Research Lab',
        description: 'Entry-level research facility for fundamental technologies',
        constructionCost: 5000,
        constructionTime: 7200000, // 2 hours
        researchBonus: 0.2, // 20% faster research
        capacity: 1, // 1 simultaneous project
        powerConsumption: 100,
        maintenanceCost: 50,
        maxLevel: 5,
        unlockRequirement: null,
        specializations: ['MILITARY', 'ENGINEERING', 'SCIENCE', 'COMMERCE']
      },
      
      ADVANCED: {
        name: 'Advanced Research Complex',
        description: 'High-tech facility with specialized equipment and automation',
        constructionCost: 15000,
        constructionTime: 14400000, // 4 hours
        researchBonus: 0.4, // 40% faster research
        capacity: 3, // 3 simultaneous projects
        powerConsumption: 250,
        maintenanceCost: 125,
        maxLevel: 8,
        unlockRequirement: 'RESEARCH_METHODS',
        specializations: ['MILITARY', 'ENGINEERING', 'SCIENCE', 'COMMERCE']
      },
      
      QUANTUM: {
        name: 'Quantum Research Institute',
        description: 'Cutting-edge facility utilizing quantum computing and manipulation',
        constructionCost: 50000,
        constructionTime: 28800000, // 8 hours
        researchBonus: 0.75, // 75% faster research
        capacity: 5, // 5 simultaneous projects
        powerConsumption: 500,
        maintenanceCost: 300,
        maxLevel: 10,
        unlockRequirement: 'QUANTUM_SYSTEMS',
        specializations: ['ENGINEERING', 'SCIENCE']
      },
      
      DIMENSIONAL: {
        name: 'Dimensional Research Nexus',
        description: 'Ultimate research facility accessing multiple dimensions',
        constructionCost: 150000,
        constructionTime: 57600000, // 16 hours
        researchBonus: 1.5, // 150% faster research
        capacity: 10, // 10 simultaneous projects
        powerConsumption: 1000,
        maintenanceCost: 750,
        maxLevel: 15,
        unlockRequirement: 'DIMENSIONAL_PHYSICS',
        specializations: ['SCIENCE']
      },
      
      // Specialized laboratories
      MILITARY_LAB: {
        name: 'Military Research Facility',
        description: 'Specialized facility for weapons and defense research',
        constructionCost: 25000,
        constructionTime: 18000000, // 5 hours
        researchBonus: 0.8, // 80% faster military research
        capacity: 4,
        powerConsumption: 350,
        maintenanceCost: 200,
        maxLevel: 12,
        unlockRequirement: 'ADVANCED_WEAPONS',
        specializations: ['MILITARY']
      },
      
      ENGINEERING_LAB: {
        name: 'Engineering Workshop',
        description: 'Advanced facility for ship systems and propulsion research',
        constructionCost: 30000,
        constructionTime: 21600000, // 6 hours
        researchBonus: 0.9, // 90% faster engineering research
        capacity: 4,
        powerConsumption: 400,
        maintenanceCost: 225,
        maxLevel: 12,
        unlockRequirement: 'WARP_TECHNOLOGY',
        specializations: ['ENGINEERING']
      }
    };
    
    // Upgrade paths for laboratories
    this.upgradeOptions = {
      AUTOMATION: {
        name: 'Research Automation',
        description: 'Automated research systems reduce time requirements',
        cost: 2000,
        researchBonusIncrease: 0.1,
        unlockRequirement: 'RESEARCH_METHODS'
      },
      PARALLEL_PROCESSING: {
        name: 'Parallel Processing',
        description: 'Increases laboratory capacity for simultaneous projects',
        cost: 5000,
        capacityIncrease: 1,
        unlockRequirement: 'QUANTUM_SYSTEMS'
      },
      POWER_EFFICIENCY: {
        name: 'Power Optimization',
        description: 'Reduces power consumption and operational costs',
        cost: 3000,
        powerReduction: 0.2,
        maintenanceReduction: 0.15,
        unlockRequirement: 'POWER_SYSTEMS'
      },
      SPECIALIZATION: {
        name: 'Research Specialization',
        description: 'Focus on specific research trees for maximum efficiency',
        cost: 4000,
        specializedBonus: 0.3, // 30% additional bonus for specialized trees
        unlockRequirement: 'ADVANCED_WEAPONS' // Or other tree-specific requirements
      }
    };
  }

  /**
   * Build a new research laboratory
   */
  async buildLaboratory(playerId, sectorX, sectorY, x, y, laboratoryType, name, guildId = null) {
    const labConfig = this.laboratoryTypes[laboratoryType];
    if (!labConfig) {
      throw new Error(`Invalid laboratory type: ${laboratoryType}`);
    }

    // Check if player has unlock requirement
    if (labConfig.unlockRequirement) {
      const hasRequirement = await this.checkPlayerTechnologyUnlocked(playerId, labConfig.unlockRequirement);
      if (!hasRequirement) {
        throw new Error(`Technology ${labConfig.unlockRequirement} required to build this laboratory`);
      }
    }

    // Check if player has sufficient resources
    const playerData = await this.database.getPlayerData(playerId);
    if (playerData.resources < labConfig.constructionCost) {
      throw new Error('Insufficient resources to build laboratory');
    }

    // Check if location is valid (not occupied)
    const existingLab = await this.getLaboratoryAtLocation(sectorX, sectorY, x, y);
    if (existingLab) {
      throw new Error('Location already occupied by another laboratory');
    }

    const labId = uuidv4();
    const currentTime = Date.now();
    const completionTime = currentTime + labConfig.constructionTime;

    // Create laboratory record
    await this.database.run(
      `INSERT INTO research_laboratories 
       (id, player_id, guild_id, sector_x, sector_y, x, y, name, laboratory_type, 
        research_bonus, capacity, power_consumption, maintenance_cost, 
        construction_progress, created_at, updated_at, specializations) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?)`,
      [
        labId,
        playerId,
        guildId,
        sectorX,
        sectorY,
        x,
        y,
        name,
        laboratoryType,
        labConfig.researchBonus,
        labConfig.capacity,
        labConfig.powerConsumption,
        labConfig.maintenanceCost,
        currentTime,
        currentTime,
        JSON.stringify(labConfig.specializations)
      ]
    );

    // Deduct construction cost
    await this.database.updatePlayerStats(playerId, { 
      resources: playerData.resources - labConfig.constructionCost 
    });

    // Start construction timer (in a real implementation, this would be handled by a background process)
    setTimeout(async () => {
      await this.completeLaboratoryConstruction(labId);
    }, labConfig.constructionTime);

    console.log(`Started construction of ${laboratoryType} laboratory ${labId} for player ${playerId}`);
    return {
      laboratorId: labId,
      constructionTime: labConfig.constructionTime,
      estimatedCompletion: completionTime
    };
  }

  /**
   * Complete laboratory construction
   */
  async completeLaboratoryConstruction(labId) {
    await this.database.run(
      `UPDATE research_laboratories 
       SET construction_progress = 1.0, is_active = 1, updated_at = ? 
       WHERE id = ?`,
      [Date.now(), labId]
    );

    const lab = await this.getLaboratory(labId);
    if (lab) {
      console.log(`Laboratory ${labId} construction completed`);
      
      // Notify player (in a real implementation, this would send a notification)
      // await this.notifyPlayer(lab.player_id, 'LABORATORY_COMPLETED', lab);
    }
  }

  /**
   * Upgrade a laboratory
   */
  async upgradeLaboratory(playerId, labId, upgradeType) {
    const lab = await this.getLaboratory(labId);
    if (!lab) {
      throw new Error('Laboratory not found');
    }

    if (lab.player_id !== playerId) {
      throw new Error('You do not own this laboratory');
    }

    const upgrade = this.upgradeOptions[upgradeType];
    if (!upgrade) {
      throw new Error(`Invalid upgrade type: ${upgradeType}`);
    }

    // Check technology requirement
    if (upgrade.unlockRequirement) {
      const hasRequirement = await this.checkPlayerTechnologyUnlocked(playerId, upgrade.unlockRequirement);
      if (!hasRequirement) {
        throw new Error(`Technology ${upgrade.unlockRequirement} required for this upgrade`);
      }
    }

    // Check resources
    const playerData = await this.database.getPlayerData(playerId);
    if (playerData.resources < upgrade.cost) {
      throw new Error('Insufficient resources for upgrade');
    }

    // Apply upgrade
    const updates = ['level = level + 1', 'updated_at = ?'];
    const values = [Date.now()];

    if (upgrade.researchBonusIncrease) {
      updates.push('research_bonus = research_bonus + ?');
      values.push(upgrade.researchBonusIncrease);
    }

    if (upgrade.capacityIncrease) {
      updates.push('capacity = capacity + ?');
      values.push(upgrade.capacityIncrease);
    }

    if (upgrade.powerReduction) {
      updates.push('power_consumption = power_consumption * ?');
      values.push(1 - upgrade.powerReduction);
    }

    if (upgrade.maintenanceReduction) {
      updates.push('maintenance_cost = maintenance_cost * ?');
      values.push(1 - upgrade.maintenanceReduction);
    }

    values.push(labId);

    await this.database.run(
      `UPDATE research_laboratories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Deduct upgrade cost
    await this.database.updatePlayerStats(playerId, {
      resources: playerData.resources - upgrade.cost
    });

    console.log(`Laboratory ${labId} upgraded with ${upgradeType}`);
    return true;
  }

  /**
   * Get laboratory by ID
   */
  async getLaboratory(labId) {
    const lab = await this.database.get(
      'SELECT * FROM research_laboratories WHERE id = ?',
      [labId]
    );

    if (lab) {
      return {
        ...lab,
        specializations: JSON.parse(lab.specializations || '[]')
      };
    }

    return null;
  }

  /**
   * Get laboratory at specific location
   */
  async getLaboratoryAtLocation(sectorX, sectorY, x, y, tolerance = 50) {
    const labs = await this.database.all(
      `SELECT * FROM research_laboratories 
       WHERE sector_x = ? AND sector_y = ? 
       AND ABS(x - ?) < ? AND ABS(y - ?) < ?`,
      [sectorX, sectorY, x, tolerance, y, tolerance]
    );

    return labs.length > 0 ? labs[0] : null;
  }

  /**
   * Get all laboratories for a player
   */
  async getPlayerLaboratories(playerId) {
    const labs = await this.database.all(
      'SELECT * FROM research_laboratories WHERE player_id = ? ORDER BY created_at DESC',
      [playerId]
    );

    return labs.map(lab => ({
      ...lab,
      specializations: JSON.parse(lab.specializations || '[]')
    }));
  }

  /**
   * Get all laboratories in a sector
   */
  async getSectorLaboratories(sectorX, sectorY) {
    const labs = await this.database.all(
      `SELECT rl.*, p.username as owner_name, g.name as guild_name 
       FROM research_laboratories rl
       LEFT JOIN players p ON rl.player_id = p.id
       LEFT JOIN guilds g ON rl.guild_id = g.id
       WHERE rl.sector_x = ? AND rl.sector_y = ? AND rl.is_active = 1`,
      [sectorX, sectorY]
    );

    return labs.map(lab => ({
      ...lab,
      specializations: JSON.parse(lab.specializations || '[]')
    }));
  }

  /**
   * Calculate research bonus for a laboratory
   */
  calculateLaboratoryBonus(laboratory, technologyTree) {
    let bonus = laboratory.research_bonus;

    // Check if laboratory specializes in this research tree
    const specializations = JSON.parse(laboratory.specializations || '[]');
    if (specializations.includes(technologyTree)) {
      // Specialized laboratories get additional bonus
      bonus += 0.2; // +20% for specialization
    }

    // Level-based bonus
    const levelBonus = (laboratory.level - 1) * 0.05; // 5% per level above 1
    bonus += levelBonus;

    return bonus;
  }

  /**
   * Perform laboratory maintenance
   */
  async performMaintenance(playerId, labId) {
    const lab = await this.getLaboratory(labId);
    if (!lab) {
      throw new Error('Laboratory not found');
    }

    if (lab.player_id !== playerId) {
      throw new Error('You do not own this laboratory');
    }

    const playerData = await this.database.getPlayerData(playerId);
    if (playerData.resources < lab.maintenance_cost) {
      throw new Error('Insufficient resources for maintenance');
    }

    const currentTime = Date.now();
    await this.database.run(
      'UPDATE research_laboratories SET last_maintenance = ?, updated_at = ? WHERE id = ?',
      [currentTime, currentTime, labId]
    );

    // Deduct maintenance cost
    await this.database.updatePlayerStats(playerId, {
      resources: playerData.resources - lab.maintenance_cost
    });

    console.log(`Performed maintenance on laboratory ${labId}`);
    return true;
  }

  /**
   * Deactivate/destroy a laboratory
   */
  async deactivateLaboratory(playerId, labId) {
    const lab = await this.getLaboratory(labId);
    if (!lab) {
      throw new Error('Laboratory not found');
    }

    if (lab.player_id !== playerId) {
      throw new Error('You do not own this laboratory');
    }

    // Check if there are active research projects
    const activeProjects = await this.database.all(
      'SELECT * FROM research_projects WHERE player_id = ? AND status = "ACTIVE"',
      [playerId]
    );

    if (activeProjects.length > 0) {
      throw new Error('Cannot deactivate laboratory with active research projects');
    }

    await this.database.run(
      'UPDATE research_laboratories SET is_active = 0, updated_at = ? WHERE id = ?',
      [Date.now(), labId]
    );

    // Refund a portion of the construction cost
    const labConfig = this.laboratoryTypes[lab.laboratory_type];
    const refund = Math.floor(labConfig.constructionCost * 0.3); // 30% refund

    const playerData = await this.database.getPlayerData(playerId);
    await this.database.updatePlayerStats(playerId, {
      resources: playerData.resources + refund
    });

    console.log(`Laboratory ${labId} deactivated, refunded ${refund} resources`);
    return { refund };
  }

  /**
   * Check if player has a technology unlocked
   */
  async checkPlayerTechnologyUnlocked(playerId, technologyId) {
    const research = await this.database.get(
      'SELECT is_unlocked FROM player_research WHERE player_id = ? AND technology_id = ?',
      [playerId, technologyId]
    );

    return research && research.is_unlocked;
  }

  /**
   * Generate discoveries in research stations
   */
  async generateResearchDiscovery(sectorX, sectorY) {
    // Random chance for discoveries in sectors with research facilities
    const labs = await this.getSectorLaboratories(sectorX, sectorY);
    if (labs.length === 0) return null;

    // Higher chance with more advanced laboratories
    const totalResearchPower = labs.reduce((sum, lab) => sum + lab.research_bonus * lab.level, 0);
    const discoveryChance = Math.min(0.1, totalResearchPower * 0.01); // Max 10% chance

    if (Math.random() > discoveryChance) return null;

    const discoveryTypes = ['ALIEN_TECH', 'ANCIENT_RUIN', 'PROTOTYPE', 'BREAKTHROUGH'];
    const discoveryType = discoveryTypes[Math.floor(Math.random() * discoveryTypes.length)];

    const discovery = {
      id: uuidv4(),
      discovery_type: discoveryType,
      sector_x: sectorX,
      sector_y: sectorY,
      x: Math.random() * 800 - 400,
      y: Math.random() * 800 - 400,
      research_value: Math.floor(50 + Math.random() * 200),
      discovery_time: Date.now(),
      discovery_data: this.generateDiscoveryData(discoveryType)
    };

    return discovery;
  }

  /**
   * Generate discovery-specific data
   */
  generateDiscoveryData(discoveryType) {
    const data = {
      rarity: ['common', 'uncommon', 'rare', 'epic'][Math.floor(Math.random() * 4)],
      complexity: Math.floor(Math.random() * 5) + 1
    };

    switch (discoveryType) {
      case 'ALIEN_TECH':
        data.origin = ['Ancient Civilization', 'Unknown Species', 'Precursor Technology'][Math.floor(Math.random() * 3)];
        data.danger_level = Math.floor(Math.random() * 3) + 1;
        break;

      case 'ANCIENT_RUIN':
        data.age = Math.floor(Math.random() * 1000000) + 100000; // 100k to 1M years old
        data.preservation = Math.random();
        break;

      case 'PROTOTYPE':
        data.development_stage = ['Concept', 'Early Prototype', 'Advanced Prototype'][Math.floor(Math.random() * 3)];
        data.functionality = Math.random();
        break;

      case 'BREAKTHROUGH':
        data.impact_level = ['Minor', 'Significant', 'Major', 'Revolutionary'][Math.floor(Math.random() * 4)];
        data.applications = Math.floor(Math.random() * 3) + 1;
        break;
    }

    return data;
  }

  /**
   * Record a research discovery
   */
  async recordDiscovery(playerId, discoveryData) {
    await this.database.run(
      `INSERT INTO research_discoveries 
       (id, discovered_by, discovery_type, sector_x, sector_y, x, y, 
        discovery_data, research_value, discovery_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        discoveryData.id,
        playerId,
        discoveryData.discovery_type,
        discoveryData.sector_x,
        discoveryData.sector_y,
        discoveryData.x,
        discoveryData.y,
        JSON.stringify(discoveryData.discovery_data),
        discoveryData.research_value,
        discoveryData.discovery_time
      ]
    );

    console.log(`Recorded research discovery ${discoveryData.id} by player ${playerId}`);
    return discoveryData.id;
  }

  /**
   * Get laboratory statistics
   */
  async getLaboratoryStats() {
    const totalLabs = await this.database.get('SELECT COUNT(*) as count FROM research_laboratories WHERE is_active = 1');
    const labsByType = await this.database.all(
      'SELECT laboratory_type, COUNT(*) as count FROM research_laboratories WHERE is_active = 1 GROUP BY laboratory_type'
    );
    const avgLevel = await this.database.get('SELECT AVG(level) as avg_level FROM research_laboratories WHERE is_active = 1');
    const totalDiscoveries = await this.database.get('SELECT COUNT(*) as count FROM research_discoveries');

    return {
      totalLaboratories: totalLabs.count,
      laboratoryDistribution: labsByType,
      averageLevel: Math.round(avgLevel.avg_level * 10) / 10,
      totalDiscoveries: totalDiscoveries.count
    };
  }
}

module.exports = ResearchStation;