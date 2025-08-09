/**
 * Guild Hall Class for StarForgeFrontier
 * Manages guild facilities, buildings, and infrastructure
 */

const { v4: uuidv4 } = require('uuid');

class GuildHall {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.guildId = data.guildId;
    this.name = data.name || 'Guild Hall';
    this.sectorX = data.sectorX;
    this.sectorY = data.sectorY;
    this.x = data.x;
    this.y = data.y;
    
    // Hall properties
    this.level = data.level || 1;
    this.hallType = data.hallType || 'BASIC'; // BASIC, ADVANCED, FORTRESS, CITADEL
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.constructionProgress = data.constructionProgress || 100; // Percentage complete
    this.constructionStarted = data.constructionStarted || Date.now();
    this.constructionCompleted = data.constructionCompleted || Date.now();
    
    // Facilities and buildings
    this.facilities = data.facilities || {
      hangar: { level: 1, capacity: 5, active: true },
      workshop: { level: 1, efficiency: 1.0, active: true },
      laboratory: { level: 0, researchSpeed: 0, active: false },
      barracks: { level: 0, defenseBonus: 0, active: false },
      market: { level: 0, tradingBonus: 0, active: false },
      vault: { level: 1, capacity: 10000, active: true }
    };

    // Resources and maintenance
    this.maintenanceCost = data.maintenanceCost || 100; // Per day
    this.lastMaintenance = data.lastMaintenance || Date.now();
    this.powerLevel = data.powerLevel || 100; // 0-100%
    this.defenseLevel = data.defenseLevel || 50; // Base defense
    
    // Special features
    this.upgrades = data.upgrades || [];
    this.activeModules = data.activeModules || [];
    this.storedResources = data.storedResources || {
      credits: 0,
      ores: {}
    };

    // Access control
    this.accessLevel = data.accessLevel || 'MEMBERS'; // OFFICERS, MEMBERS, ALL
    this.isPublic = data.isPublic !== undefined ? data.isPublic : false;
    
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Get available facility types
   */
  static getFacilityTypes() {
    return {
      hangar: {
        name: 'Ship Hangar',
        description: 'Stores guild ships and provides repair services',
        maxLevel: 10,
        baseCost: 5000,
        benefits: 'Ship storage, repair services, fleet coordination'
      },
      workshop: {
        name: 'Engineering Workshop',
        description: 'Improves component crafting and ship modification efficiency',
        maxLevel: 8,
        baseCost: 3000,
        benefits: 'Crafting bonuses, component upgrades, research assistance'
      },
      laboratory: {
        name: 'Research Laboratory',
        description: 'Accelerates guild research and unlocks advanced technologies',
        maxLevel: 10,
        baseCost: 8000,
        benefits: 'Research speed, technology unlocks, data analysis'
      },
      barracks: {
        name: 'Defense Barracks',
        description: 'Provides guild hall defense and military coordination',
        maxLevel: 6,
        baseCost: 4000,
        benefits: 'Hall defense, military bonuses, strategic planning'
      },
      market: {
        name: 'Trading Post',
        description: 'Improves guild trading operations and market access',
        maxLevel: 7,
        baseCost: 6000,
        benefits: 'Trading bonuses, market information, contract access'
      },
      vault: {
        name: 'Secure Vault',
        description: 'Safely stores guild resources and valuables',
        maxLevel: 5,
        baseCost: 2000,
        benefits: 'Resource storage, security, insurance'
      },
      communications: {
        name: 'Communications Array',
        description: 'Improves guild coordination and information gathering',
        maxLevel: 8,
        baseCost: 4500,
        benefits: 'Member coordination, intelligence, long-range communication'
      },
      medical: {
        name: 'Medical Bay',
        description: 'Provides healing and medical services for guild members',
        maxLevel: 6,
        baseCost: 3500,
        benefits: 'Health restoration, medical supplies, crew efficiency'
      }
    };
  }

  /**
   * Get available hall upgrade types
   */
  static getHallTypes() {
    return {
      BASIC: {
        name: 'Basic Hall',
        maxFacilities: 4,
        maxLevel: 3,
        constructionTime: 24 * 60 * 60 * 1000, // 24 hours
        cost: 10000,
        defenseBonus: 1.0
      },
      ADVANCED: {
        name: 'Advanced Hall',
        maxFacilities: 6,
        maxLevel: 5,
        constructionTime: 48 * 60 * 60 * 1000, // 48 hours
        cost: 25000,
        defenseBonus: 1.5,
        requirements: { guildLevel: 10 }
      },
      FORTRESS: {
        name: 'Guild Fortress',
        maxFacilities: 8,
        maxLevel: 8,
        constructionTime: 72 * 60 * 60 * 1000, // 72 hours
        cost: 50000,
        defenseBonus: 2.5,
        requirements: { guildLevel: 20, territories: 3 }
      },
      CITADEL: {
        name: 'Guild Citadel',
        maxFacilities: 10,
        maxLevel: 10,
        constructionTime: 120 * 60 * 60 * 1000, // 120 hours
        cost: 100000,
        defenseBonus: 4.0,
        requirements: { guildLevel: 35, territories: 5, members: 25 }
      }
    };
  }

  /**
   * Check if construction is complete
   */
  isConstructionComplete() {
    return this.constructionProgress >= 100;
  }

  /**
   * Update construction progress
   */
  updateConstructionProgress() {
    if (this.constructionProgress >= 100) {
      return this.constructionProgress;
    }

    const elapsed = Date.now() - this.constructionStarted;
    const hallType = GuildHall.getHallTypes()[this.hallType];
    
    if (hallType) {
      this.constructionProgress = Math.min(100, (elapsed / hallType.constructionTime) * 100);
      
      if (this.constructionProgress >= 100) {
        this.constructionCompleted = Date.now();
        this.isActive = true;
      }
    }

    return this.constructionProgress;
  }

  /**
   * Upgrade a facility
   */
  async upgradeFacility(facilityType, database = null) {
    if (!this.facilities[facilityType]) {
      throw new Error('Facility does not exist');
    }

    const facility = this.facilities[facilityType];
    const facilityInfo = GuildHall.getFacilityTypes()[facilityType];
    
    if (!facilityInfo) {
      throw new Error('Invalid facility type');
    }

    if (facility.level >= facilityInfo.maxLevel) {
      throw new Error('Facility already at maximum level');
    }

    const hallType = GuildHall.getHallTypes()[this.hallType];
    if (facility.level >= hallType.maxLevel) {
      throw new Error(`Hall type ${this.hallType} cannot support level ${facility.level + 1} facilities`);
    }

    // Calculate upgrade cost
    const upgradeCost = facilityInfo.baseCost * Math.pow(2, facility.level);
    
    // Upgrade the facility
    facility.level++;
    this.updateFacilityEffects(facilityType);
    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        'UPDATE guild_halls SET facilities = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(this.facilities), this.updatedAt, this.id]
      );
    }

    return { 
      success: true, 
      newLevel: facility.level, 
      cost: upgradeCost,
      facility: this.facilities[facilityType]
    };
  }

  /**
   * Update facility effects based on level
   */
  updateFacilityEffects(facilityType) {
    const facility = this.facilities[facilityType];
    
    switch (facilityType) {
      case 'hangar':
        facility.capacity = 5 + (facility.level * 3); // +3 ships per level
        break;
      case 'workshop':
        facility.efficiency = 1.0 + (facility.level * 0.15); // +15% per level
        break;
      case 'laboratory':
        facility.researchSpeed = facility.level * 0.1; // +10% per level
        break;
      case 'barracks':
        facility.defenseBonus = facility.level * 10; // +10 defense per level
        break;
      case 'market':
        facility.tradingBonus = facility.level * 0.05; // +5% per level
        break;
      case 'vault':
        facility.capacity = 10000 * Math.pow(2, facility.level - 1); // Double per level
        break;
      case 'communications':
        facility.coordinationBonus = facility.level * 0.05; // +5% per level
        break;
      case 'medical':
        facility.healingRate = facility.level * 0.1; // +10% per level
        break;
    }
  }

  /**
   * Add a new facility
   */
  async addFacility(facilityType, database = null) {
    if (this.facilities[facilityType]) {
      throw new Error('Facility already exists');
    }

    const facilityInfo = GuildHall.getFacilityTypes()[facilityType];
    if (!facilityInfo) {
      throw new Error('Invalid facility type');
    }

    const hallType = GuildHall.getHallTypes()[this.hallType];
    const activeFacilities = Object.values(this.facilities).filter(f => f.active).length;
    
    if (activeFacilities >= hallType.maxFacilities) {
      throw new Error(`Hall type ${this.hallType} can only support ${hallType.maxFacilities} facilities`);
    }

    // Add the new facility at level 1
    this.facilities[facilityType] = {
      level: 1,
      active: true
    };

    this.updateFacilityEffects(facilityType);
    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        'UPDATE guild_halls SET facilities = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(this.facilities), this.updatedAt, this.id]
      );
    }

    return {
      success: true,
      facility: this.facilities[facilityType],
      cost: facilityInfo.baseCost
    };
  }

  /**
   * Calculate total hall bonuses
   */
  calculateHallBonuses() {
    const bonuses = {
      crafting_efficiency: 0,
      research_speed: 0,
      defense_bonus: 0,
      trading_bonus: 0,
      storage_capacity: 0,
      coordination_bonus: 0,
      healing_rate: 0
    };

    // Add facility bonuses
    for (const [facilityType, facility] of Object.entries(this.facilities)) {
      if (!facility.active) continue;

      switch (facilityType) {
        case 'workshop':
          bonuses.crafting_efficiency += (facility.efficiency - 1.0);
          break;
        case 'laboratory':
          bonuses.research_speed += facility.researchSpeed || 0;
          break;
        case 'barracks':
          bonuses.defense_bonus += facility.defenseBonus || 0;
          break;
        case 'market':
          bonuses.trading_bonus += facility.tradingBonus || 0;
          break;
        case 'vault':
          bonuses.storage_capacity += facility.capacity || 0;
          break;
        case 'communications':
          bonuses.coordination_bonus += facility.coordinationBonus || 0;
          break;
        case 'medical':
          bonuses.healing_rate += facility.healingRate || 0;
          break;
      }
    }

    // Add hall level bonuses
    const levelBonus = this.level * 0.02; // 2% per hall level
    bonuses.crafting_efficiency += levelBonus;
    bonuses.research_speed += levelBonus;

    // Add hall type bonuses
    const hallType = GuildHall.getHallTypes()[this.hallType];
    if (hallType) {
      bonuses.defense_bonus *= hallType.defenseBonus;
    }

    return bonuses;
  }

  /**
   * Store resources in the hall
   */
  async storeResources(resourceType, amount, database = null) {
    const vault = this.facilities.vault;
    if (!vault || !vault.active) {
      throw new Error('No active vault facility');
    }

    const currentStorage = this.getCurrentStorageUsed();
    const storageNeeded = typeof amount === 'number' ? amount / 100 : 100; // Credits are light, ores are heavy

    if (currentStorage + storageNeeded > vault.capacity) {
      throw new Error('Insufficient storage capacity');
    }

    if (resourceType === 'credits') {
      this.storedResources.credits += amount;
    } else if (resourceType === 'ore') {
      if (!this.storedResources.ores[amount.oreType]) {
        this.storedResources.ores[amount.oreType] = 0;
      }
      this.storedResources.ores[amount.oreType] += amount.quantity;
    }

    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        'UPDATE guild_halls SET stored_resources = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(this.storedResources), this.updatedAt, this.id]
      );
    }

    return this.storedResources;
  }

  /**
   * Retrieve resources from the hall
   */
  async retrieveResources(resourceType, amount, database = null) {
    if (resourceType === 'credits') {
      if (this.storedResources.credits < amount) {
        throw new Error('Insufficient stored credits');
      }
      this.storedResources.credits -= amount;
    } else if (resourceType === 'ore') {
      if (!this.storedResources.ores[amount.oreType] || 
          this.storedResources.ores[amount.oreType] < amount.quantity) {
        throw new Error(`Insufficient stored ${amount.oreType} ore`);
      }
      this.storedResources.ores[amount.oreType] -= amount.quantity;
    }

    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        'UPDATE guild_halls SET stored_resources = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(this.storedResources), this.updatedAt, this.id]
      );
    }

    return this.storedResources;
  }

  /**
   * Get current storage usage
   */
  getCurrentStorageUsed() {
    let used = this.storedResources.credits / 100; // Credits are light
    
    for (const [oreType, quantity] of Object.entries(this.storedResources.ores)) {
      used += quantity; // Ores take 1 unit of storage each
    }

    return used;
  }

  /**
   * Pay maintenance costs
   */
  async payMaintenance(database = null) {
    const daysSinceLastMaintenance = (Date.now() - this.lastMaintenance) / (24 * 60 * 60 * 1000);
    if (daysSinceLastMaintenance < 1) {
      return { required: false, cost: 0 };
    }

    const totalCost = Math.floor(this.maintenanceCost * daysSinceLastMaintenance);
    
    if (this.storedResources.credits < totalCost) {
      // Insufficient funds - reduce power level
      this.powerLevel = Math.max(0, this.powerLevel - 10);
      if (this.powerLevel <= 0) {
        // Shut down non-essential facilities
        for (const facility of Object.values(this.facilities)) {
          if (facility.active && !['vault', 'hangar'].includes(facility.type)) {
            facility.active = false;
          }
        }
      }
      return { required: true, cost: totalCost, paid: false, powerLevel: this.powerLevel };
    }

    // Pay maintenance
    this.storedResources.credits -= totalCost;
    this.lastMaintenance = Date.now();
    this.powerLevel = Math.min(100, this.powerLevel + 5); // Restore power

    // Reactivate facilities if power is sufficient
    if (this.powerLevel > 50) {
      for (const facility of Object.values(this.facilities)) {
        if (!facility.active) {
          facility.active = true;
        }
      }
    }

    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        'UPDATE guild_halls SET stored_resources = ?, last_maintenance = ?, power_level = ?, facilities = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(this.storedResources), this.lastMaintenance, this.powerLevel, JSON.stringify(this.facilities), this.updatedAt, this.id]
      );
    }

    return { required: true, cost: totalCost, paid: true, powerLevel: this.powerLevel };
  }

  /**
   * Upgrade hall to next tier
   */
  async upgradeHallType(newType, database = null) {
    const currentTypeData = GuildHall.getHallTypes()[this.hallType];
    const newTypeData = GuildHall.getHallTypes()[newType];
    
    if (!newTypeData) {
      throw new Error('Invalid hall type');
    }

    if (newTypeData.cost <= currentTypeData.cost) {
      throw new Error('Cannot downgrade hall type');
    }

    // Check requirements
    if (newTypeData.requirements) {
      // This would need to be checked by the caller with guild data
      throw new Error('Requirements not met for hall upgrade');
    }

    this.hallType = newType;
    this.constructionStarted = Date.now();
    this.constructionProgress = 0;
    this.isActive = false;
    this.updatedAt = Date.now();

    // Save to database if provided
    if (database) {
      await database.run(
        'UPDATE guild_halls SET hall_type = ?, construction_started = ?, construction_progress = ?, is_active = ?, updated_at = ? WHERE id = ?',
        [this.hallType, this.constructionStarted, this.constructionProgress, this.isActive, this.updatedAt, this.id]
      );
    }

    return { success: true, newType, constructionTime: newTypeData.constructionTime };
  }

  /**
   * Get hall summary for display
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      hallType: this.hallType,
      location: { sectorX: this.sectorX, sectorY: this.sectorY, x: this.x, y: this.y },
      isActive: this.isActive,
      constructionProgress: this.constructionProgress,
      facilities: Object.keys(this.facilities).filter(f => this.facilities[f].active).length,
      powerLevel: this.powerLevel,
      storageUsed: this.getCurrentStorageUsed(),
      storageCapacity: this.facilities.vault?.capacity || 0
    };
  }

  /**
   * Serialize hall data for database storage
   */
  serialize() {
    return {
      id: this.id,
      guild_id: this.guildId,
      name: this.name,
      sector_x: this.sectorX,
      sector_y: this.sectorY,
      x: this.x,
      y: this.y,
      level: this.level,
      hall_type: this.hallType,
      is_active: this.isActive,
      construction_progress: this.constructionProgress,
      construction_started: this.constructionStarted,
      construction_completed: this.constructionCompleted,
      facilities: JSON.stringify(this.facilities),
      maintenance_cost: this.maintenanceCost,
      last_maintenance: this.lastMaintenance,
      power_level: this.powerLevel,
      defense_level: this.defenseLevel,
      upgrades: JSON.stringify(this.upgrades),
      active_modules: JSON.stringify(this.activeModules),
      stored_resources: JSON.stringify(this.storedResources),
      access_level: this.accessLevel,
      is_public: this.isPublic,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Create guild hall from database data
   */
  static fromDatabase(data) {
    return new GuildHall({
      id: data.id,
      guildId: data.guild_id,
      name: data.name,
      sectorX: data.sector_x,
      sectorY: data.sector_y,
      x: data.x,
      y: data.y,
      level: data.level,
      hallType: data.hall_type,
      isActive: data.is_active,
      constructionProgress: data.construction_progress,
      constructionStarted: data.construction_started,
      constructionCompleted: data.construction_completed,
      facilities: data.facilities ? JSON.parse(data.facilities) : {},
      maintenanceCost: data.maintenance_cost,
      lastMaintenance: data.last_maintenance,
      powerLevel: data.power_level,
      defenseLevel: data.defense_level,
      upgrades: data.upgrades ? JSON.parse(data.upgrades) : [],
      activeModules: data.active_modules ? JSON.parse(data.active_modules) : [],
      storedResources: data.stored_resources ? JSON.parse(data.stored_resources) : { credits: 0, ores: {} },
      accessLevel: data.access_level,
      isPublic: data.is_public,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    });
  }
}

module.exports = GuildHall;