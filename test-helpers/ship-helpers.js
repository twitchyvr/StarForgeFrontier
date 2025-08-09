/**
 * Test helpers for ship component system
 * These functions mirror the server-side ship property calculations
 */

// Component effect definitions (mirroring server constants)
const BASE_SPEED = 2.0;
const BASE_CARGO_CAPACITY = 1000;
const BASE_COLLECTION_RANGE = 40;

const COMPONENT_EFFECTS = {
  engine: {
    speedMultiplier: 0.3,  // +30% speed per engine
    accelerationBonus: 0.2 // +20% responsiveness
  },
  cargo: {
    capacityBonus: 500,    // +500 capacity per cargo module
    efficiencyBonus: 0.1   // +10% resource collection per cargo
  },
  weapon: {
    damageBonus: 25,       // +25 damage per weapon
    rangeBonus: 10         // +10 range per weapon
  },
  shield: {
    healthBonus: 100,      // +100 health per shield
    regenBonus: 2          // +2 health regen per shield per second
  }
};

// Calculate ship properties based on installed components
function calculateShipProperties(player) {
  if (!player.modules || player.modules.length === 0) {
    return {
      speed: BASE_SPEED,
      cargoCapacity: BASE_CARGO_CAPACITY,
      collectionRange: BASE_COLLECTION_RANGE,
      maxHealth: 100,
      damage: 0,
      weaponRange: 0
    };
  }

  // Count components
  const componentCounts = {};
  player.modules.forEach(module => {
    if (module.id !== 'hull') {
      componentCounts[module.id] = (componentCounts[module.id] || 0) + 1;
    }
  });

  // Calculate properties
  let speed = BASE_SPEED;
  let cargoCapacity = BASE_CARGO_CAPACITY;
  let collectionRange = BASE_COLLECTION_RANGE;
  let maxHealth = 100;
  let damage = 0;
  let weaponRange = 0;

  // Apply engine effects
  if (componentCounts.engine) {
    const engines = componentCounts.engine;
    speed = BASE_SPEED * (1 + engines * COMPONENT_EFFECTS.engine.speedMultiplier);
  }

  // Apply cargo effects
  if (componentCounts.cargo) {
    const cargoModules = componentCounts.cargo;
    cargoCapacity = BASE_CARGO_CAPACITY + (cargoModules * COMPONENT_EFFECTS.cargo.capacityBonus);
    collectionRange = BASE_COLLECTION_RANGE + (cargoModules * 10); // Wider collection range
  }

  // Apply weapon effects
  if (componentCounts.weapon) {
    const weapons = componentCounts.weapon;
    damage = weapons * COMPONENT_EFFECTS.weapon.damageBonus;
    weaponRange = weapons * COMPONENT_EFFECTS.weapon.rangeBonus;
  }

  // Apply shield effects
  if (componentCounts.shield) {
    const shields = componentCounts.shield;
    maxHealth = 100 + (shields * COMPONENT_EFFECTS.shield.healthBonus);
  }

  return {
    speed: Math.round(speed * 100) / 100, // Round to 2 decimals
    cargoCapacity,
    collectionRange,
    maxHealth,
    damage,
    weaponRange,
    componentCounts
  };
}

// Update player ship properties based on components
function updateShipProperties(player) {
  const properties = calculateShipProperties(player);
  
  // Store properties on player object for easy access
  player.shipProperties = properties;
  
  // Initialize health if not set
  if (player.health === undefined) {
    player.health = properties.maxHealth;
  }
  
  // Cap current health to max health if shields were added
  if (player.health > properties.maxHealth) {
    player.health = properties.maxHealth;
  }
  
  return properties;
}

module.exports = {
  calculateShipProperties,
  updateShipProperties,
  BASE_SPEED,
  BASE_CARGO_CAPACITY,
  BASE_COLLECTION_RANGE,
  COMPONENT_EFFECTS
};