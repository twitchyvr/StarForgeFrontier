# Client-Side Galaxy Integration Guide

## Overview

This guide explains how to integrate the galaxy system into the client-side JavaScript for StarForgeFrontier.

## New UI Elements Required

### Galaxy Map
- **Sector Grid Display** - Visual representation of nearby sectors
- **Biome Color Coding** - Different colors for each biome type
- **Player Markers** - Show current player location and other players
- **Navigation Controls** - Click-to-select target sectors

### Warp Interface
- **Warp Targets List** - Available destinations with costs
- **Fuel Calculator** - Real-time fuel cost calculation
- **Travel Time Display** - Estimated arrival time
- **Warp Progress Bar** - Current warp operation status
- **Emergency Warp Button** - Instant but expensive escape

### Sector Information Panel
- **Current Biome** - Name, description, and effects
- **Ore Types** - Available resources in current sector
- **Environmental Hazards** - Active hazards and effects
- **Player Count** - Number of players in sector

## WebSocket Message Handling

### Sending Requests

```javascript
// Request galaxy map
function requestGalaxyMap(radius = 5) {
  ws.send(JSON.stringify({
    type: 'request_galaxy_map',
    radius: radius
  }));
}

// Request warp targets
function requestWarpTargets(maxRange = 5) {
  ws.send(JSON.stringify({
    type: 'request_warp_targets',
    maxRange: maxRange
  }));
}

// Initiate warp
function initiateWarp(targetX, targetY, isEmergency = false) {
  ws.send(JSON.stringify({
    type: 'initiate_warp',
    targetX: targetX,
    targetY: targetY,
    isEmergencyWarp: isEmergency
  }));
}

// Cancel warp
function cancelWarp() {
  ws.send(JSON.stringify({
    type: 'cancel_warp'
  }));
}
```

### Handling Responses

```javascript
// Handle incoming messages
ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'galaxy_map':
      updateGalaxyMap(data.mapData, data.currentSector);
      break;
      
    case 'warp_targets':
      updateWarpTargets(data.destinations, data.warpDriveRating);
      break;
      
    case 'warp_result':
      handleWarpResult(data.result);
      break;
      
    case 'warp_completed':
      handleWarpCompletion(data.result);
      break;
      
    case 'sector_event':
      handleSectorEvent(data.event);
      break;
      
    case 'ore_collected':
      handleOreCollection(data);
      break;
  }
};
```

## UI Implementation Examples

### Galaxy Map Display

```javascript
function updateGalaxyMap(mapData, currentSector) {
  const mapContainer = document.getElementById('galaxy-map');
  mapContainer.innerHTML = '';
  
  mapData.forEach(sector => {
    const sectorElement = document.createElement('div');
    sectorElement.className = 'sector-tile';
    sectorElement.style.backgroundColor = sector.biome.color;
    
    // Highlight current sector
    if (sector.coordinates.x === currentSector.x && 
        sector.coordinates.y === currentSector.y) {
      sectorElement.classList.add('current-sector');
    }
    
    sectorElement.innerHTML = `
      <div class="sector-coords">${sector.coordinates.x},${sector.coordinates.y}</div>
      <div class="sector-biome">${sector.biome.name}</div>
      <div class="sector-players">${sector.playerCount} players</div>
    `;
    
    sectorElement.addEventListener('click', () => {
      selectWarpTarget(sector.coordinates);
    });
    
    mapContainer.appendChild(sectorElement);
  });
}
```

### Warp Interface

```javascript
function updateWarpTargets(destinations, warpRating) {
  const targetsList = document.getElementById('warp-targets');
  targetsList.innerHTML = '';
  
  // Update warp drive rating display
  document.getElementById('warp-rating').textContent = warpRating.rating;
  document.getElementById('fuel-efficiency').textContent = `${warpRating.fuelEfficiency}%`;
  
  destinations.forEach(dest => {
    const targetElement = document.createElement('div');
    targetElement.className = 'warp-target';
    
    if (!dest.canAfford) {
      targetElement.classList.add('insufficient-fuel');
    }
    
    targetElement.innerHTML = `
      <div class="target-coords">${dest.coordinates.x}, ${dest.coordinates.y}</div>
      <div class="target-biome" style="color: ${dest.biome.color}">${dest.biome.name}</div>
      <div class="target-cost">
        <span class="fuel-cost">${dest.fuelCost} fuel</span>
        <span class="travel-time">${Math.ceil(dest.travelTime/1000)}s</span>
      </div>
      <div class="target-distance">${dest.distance.toFixed(1)} sectors</div>
    `;
    
    if (dest.canAfford) {
      targetElement.addEventListener('click', () => {
        initiateWarp(dest.coordinates.x, dest.coordinates.y);
      });
    }
    
    targetsList.appendChild(targetElement);
  });
}
```

### Ore Collection Enhancement

```javascript
function handleOreCollection(oreData) {
  // Enhanced ore collection with type information
  const message = `Collected ${oreData.oreName} (+${oreData.value} resources)`;
  
  // Display notification with ore-specific color
  showNotification(message, {
    color: oreData.oreColor,
    category: 'resource-collection',
    duration: 3000
  });
  
  // Update resource counter
  updateResourceDisplay();
  
  // Visual effect based on ore type
  createOreCollectionEffect(oreData.oreType, oreData.oreColor);
}
```

### Warp Progress Display

```javascript
function handleWarpResult(result) {
  if (result.success) {
    // Show warp progress
    const progressBar = document.getElementById('warp-progress');
    const progressContainer = document.getElementById('warp-container');
    
    progressContainer.style.display = 'block';
    
    // Animate progress bar
    const duration = result.travelTime;
    const startTime = Date.now();
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      
      progressBar.style.width = `${progress}%`;
      document.getElementById('warp-eta').textContent = 
        `ETA: ${Math.ceil((duration - elapsed) / 1000)}s`;
      
      if (progress < 100) {
        requestAnimationFrame(updateProgress);
      }
    };
    
    updateProgress();
  } else {
    showNotification(`Warp Failed: ${result.reason}`, { category: 'error' });
  }
}
```

## CSS Styling Examples

### Galaxy Map Styles

```css
.galaxy-map {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
  padding: 10px;
  background: #000;
}

.sector-tile {
  width: 60px;
  height: 60px;
  border: 1px solid #333;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.sector-tile:hover {
  border-color: #fff;
  transform: scale(1.05);
}

.current-sector {
  border: 2px solid #00ff00 !important;
  box-shadow: 0 0 10px #00ff00;
}

.sector-coords {
  font-size: 8px;
  color: #fff;
  position: absolute;
  top: 2px;
  left: 2px;
}

.sector-biome {
  font-size: 7px;
  color: #fff;
  position: absolute;
  bottom: 10px;
  left: 2px;
  right: 2px;
  text-align: center;
}

.sector-players {
  font-size: 6px;
  color: #ffff00;
  position: absolute;
  bottom: 2px;
  right: 2px;
}
```

### Warp Interface Styles

```css
.warp-interface {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  border-radius: 8px;
  padding: 15px;
  color: #fff;
}

.warp-target {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #555;
  border-radius: 4px;
  padding: 8px;
  margin: 5px 0;
  cursor: pointer;
  transition: background 0.2s;
}

.warp-target:hover {
  background: rgba(255, 255, 255, 0.2);
}

.warp-target.insufficient-fuel {
  opacity: 0.5;
  cursor: not-allowed;
}

.warp-progress {
  background: #333;
  border-radius: 10px;
  overflow: hidden;
  height: 20px;
  margin: 10px 0;
}

.warp-progress-bar {
  background: linear-gradient(90deg, #0066cc, #00aaff);
  height: 100%;
  transition: width 0.1s;
}
```

## Integration Checklist

- [ ] Add galaxy map UI component
- [ ] Implement warp interface
- [ ] Update ore collection display with ore types
- [ ] Add sector information panel
- [ ] Integrate new WebSocket message handlers
- [ ] Update resource/fuel display
- [ ] Add warp progress indicators
- [ ] Implement emergency warp button
- [ ] Add sector transition animations
- [ ] Update minimap for multi-sector view

## Performance Considerations

- **Throttle map updates** - Don't redraw galaxy map every frame
- **Cache sector previews** - Store biome/faction info client-side
- **Lazy load details** - Only request full sector data when needed
- **Optimize rendering** - Use CSS transforms for smooth animations
- **Batch requests** - Combine multiple sector queries where possible