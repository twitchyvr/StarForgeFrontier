# Galaxy System Documentation

## Overview

The Galaxy System extends StarForgeFrontier with a procedural galaxy map, allowing players to explore multiple sectors beyond the original single-sector gameplay. The system maintains full backward compatibility while adding rich new gameplay mechanics.

## Architecture

### Core Components

1. **Sector.js** - Individual sector representation with biomes and resources
2. **SectorManager.js** - Memory-efficient sector loading/unloading management
3. **WarpSystem.js** - Inter-sector travel with fuel costs and time mechanics
4. **ProceduralGeneration.js** - Seed-based procedural generation algorithms

### Database Schema Extensions

New tables added to support galaxy functionality:
- `galaxy_sectors` - Sector metadata and biome information
- `sector_ores` - Sector-specific resource distribution
- `sector_hazards` - Environmental hazards per sector
- `player_sector_locations` - Player current location and warp history
- `warp_routes` - Travel history and route optimization data
- `sector_discoveries` - Exploration progress tracking

## Features

### Biome System

Six distinct biome types with unique characteristics:

1. **Asteroid Field** - Dense ore clusters, common materials
2. **Nebula** - Colorful gas clouds with energy crystals
3. **Deep Space** - Sparse resources, easy travel
4. **Stellar Nursery** - Exotic matter, radiation hazards
5. **Ancient Ruins** - Advanced materials, rare technology
6. **Black Hole Region** - Compressed matter, gravitational anomalies

### Resource Distribution

- **16 unique ore types** with varying rarity and value
- **Biome-specific ore distributions** - each biome has preferred ore types
- **Dynamic ore spawning** - sectors replenish resources over time
- **Event-based ore creation** - supernovas, tech activations, asteroid collapses

### Warp System

- **Fuel-based travel** - resources consumed for inter-sector travel
- **Travel time mechanics** - realistic delays based on distance
- **Ship efficiency** - engines and warp drives reduce costs
- **Emergency warps** - instant but expensive escape mechanism
- **Warp cooldowns** - prevents rapid sector hopping

### Procedural Generation

- **Seed-based consistency** - same coordinates always generate same content
- **Galactic structure** - spiral arms, faction territories, asteroid belts
- **Distance-based distribution** - biome frequency varies by galactic position
- **Noise-based patterns** - natural-looking resource and biome distribution

## API Endpoints

### Galaxy Map
```
GET /api/galaxy/map/:x/:y?radius=5
```
Returns galaxy map data centered on coordinates with specified radius.

### Warp Targets
```
GET /api/galaxy/warp-targets/:playerId?range=5
```
Returns available warp destinations for a player within range.

### Initiate Warp
```
POST /api/galaxy/warp
Body: { playerId, targetX, targetY, isEmergencyWarp }
```
Initiates warp travel to target sector coordinates.

### Galaxy Statistics
```
GET /api/galaxy/stats
```
Returns comprehensive galaxy system statistics.

### Player Warp Stats
```
GET /api/player/:playerId/warp-stats
```
Returns player's warp history and statistics.

### Player Discoveries
```
GET /api/player/:playerId/discoveries
```
Returns list of sectors discovered by player.

## WebSocket Messages

### Client to Server

- `request_galaxy_map` - Request galaxy map around current position
- `request_warp_targets` - Request available warp destinations
- `initiate_warp` - Start warp to target coordinates
- `cancel_warp` - Cancel ongoing warp operation
- `request_warp_status` - Get current warp progress
- `request_sector_info` - Get detailed current sector information

### Server to Client

- `galaxy_map` - Galaxy map data response
- `warp_targets` - Available warp destinations
- `warp_result` - Warp initiation result
- `warp_completed` - Warp travel completed
- `warp_cancelled` - Warp cancellation result
- `warp_status` - Current warp operation status
- `sector_info` - Detailed sector information
- `sector_event` - Dynamic sector events (supernovas, etc.)
- `ore_collected` - Enhanced ore collection with type information

## Backward Compatibility

The galaxy system maintains full backward compatibility:

- **Existing saves work** - Players start in sector (0,0) with existing positions
- **Legacy ore collection** - Falls back to original system if sector system unavailable
- **Gradual adoption** - Players can continue single-sector gameplay
- **Database migration** - New tables don't affect existing data

## Ship Modules

### New Modules

- **Warp Drive** (150 resources) - Reduces warp fuel cost by 25% and travel time by 20%
- **Scanner** (80 resources) - Increases ore detection range by 15% per module

### Enhanced Effects

- **Engines** - Now also improve warp efficiency
- **All modules** - Tracked for warp efficiency calculations

## Environmental Effects

### Biome-Specific Effects

- **Black Hole Region** - 2x warp costs, gravitational hazards
- **Nebula** - 1.3x warp costs, reduced visibility, ion storms
- **Stellar Nursery** - 1.5x warp costs, radiation damage
- **Deep Space** - 0.7x warp costs, optimal for travel
- **Asteroid Field** - 0.9x warp costs, frequent ore respawning
- **Ancient Ruins** - 1.1x warp costs, technology activation events

## Performance Optimizations

### Memory Management

- **Sector Loading** - Only 25 sectors loaded simultaneously
- **Automatic Cleanup** - Unused sectors unloaded every 5 minutes
- **Player-Based Preloading** - Adjacent sectors loaded around active players
- **Database Persistence** - Sector data saved/loaded efficiently

### Caching

- **Noise Cache** - Procedural generation results cached for performance
- **Seed Consistency** - Same inputs always produce same outputs
- **Lazy Loading** - Sectors only generated when needed

## Usage Examples

### Basic Warp Travel
```javascript
// Client sends warp request
ws.send(JSON.stringify({
  type: 'initiate_warp',
  targetX: 1,
  targetY: 0
}));

// Server responds with warp result
{
  type: 'warp_result',
  result: {
    success: true,
    fuelCost: 75,
    travelTime: 15000,
    arrivalTime: 1699123456789
  }
}
```

### Galaxy Map Request
```javascript
// Request map around current position
ws.send(JSON.stringify({
  type: 'request_galaxy_map',
  radius: 3
}));

// Receive map data
{
  type: 'galaxy_map',
  mapData: [
    {
      coordinates: { x: 0, y: 0 },
      biome: { name: 'Asteroid Field', color: '#8B7355' },
      playerCount: 2,
      isLoaded: true
    }
    // ... more sectors
  ]
}
```

## Configuration

### Adjustable Parameters

- `maxLoadedSectors` - Memory limit for active sectors (default: 25)
- `galaxyRadius` - Maximum distance from center (default: 50)
- `cleanupInterval` - Sector cleanup frequency (default: 5 minutes)
- `MAX_WARP_RANGE` - Maximum single warp distance (default: 10 sectors)
- `BASE_FUEL_COST_PER_SECTOR` - Base fuel cost (default: 50 resources)

### Biome Weights

Biome distribution varies by galactic position:
- **Core** (0-3 sectors) - High energy, dangerous biomes
- **Inner** (3-8 sectors) - Active star formation
- **Mid** (8-20 sectors) - Balanced distribution
- **Outer** (20-35 sectors) - Sparse resources
- **Rim** (35+ sectors) - Mostly empty space

## Testing

Run galaxy system tests:
```bash
npm run test:server -- --testNamePattern="Galaxy System"
```

The test suite covers:
- Sector generation and loading
- Procedural generation consistency
- Warp system mechanics
- Database integration
- Backward compatibility

## Future Enhancements

Potential future additions:
- **Faction warfare** - Territory control and conflicts
- **Trade routes** - Economic gameplay between sectors
- **Wormhole networks** - Fast travel between distant sectors
- **Sector ownership** - Player-controlled territory
- **Dynamic events** - Galaxy-wide phenomena
- **Multiplayer coordination** - Fleet operations across sectors