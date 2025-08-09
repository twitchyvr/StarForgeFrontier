/**
 * Advanced Ship Editor for StarForgeFrontier
 * Visual drag-and-drop ship design system with component library
 */

class ShipEditor {
  constructor(gameClient) {
    this.gameClient = gameClient;
    this.canvas = null;
    this.ctx = null;
    this.isOpen = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.selectedComponent = null;
    this.hoveredComponent = null;
    this.rotationAngle = 0;
    
    // Grid settings
    this.gridSize = 20;
    this.gridWidth = 30;
    this.gridHeight = 20;
    
    // Ship design state
    this.currentDesign = {
      components: [],
      name: 'Untitled Design',
      hullType: 'standard',
      metadata: {
        created: Date.now(),
        modified: Date.now(),
        author: null,
        version: '1.0'
      }
    };
    
    // Component library
    this.componentLibrary = {
      hull: {
        name: 'Hull Section',
        icon: '⬛',
        color: '#4a90e2',
        size: { width: 2, height: 2 },
        cost: 0,
        powerConsumption: 0,
        structuralIntegrity: 10,
        description: 'Basic hull section providing structural support'
      },
      engine: {
        name: 'Engine Module',
        icon: '🔥',
        color: '#ff6b47',
        size: { width: 2, height: 3 },
        cost: 50,
        powerConsumption: 3,
        structuralIntegrity: 5,
        description: 'Provides thrust and maneuverability'
      },
      reactor: {
        name: 'Power Reactor',
        icon: '⚡',
        color: '#ffd700',
        size: { width: 3, height: 3 },
        cost: 120,
        powerProduction: 10,
        structuralIntegrity: 8,
        description: 'Generates power for ship systems'
      },
      cargo: {
        name: 'Cargo Bay',
        icon: '📦',
        color: '#7ed321',
        size: { width: 3, height: 2 },
        cost: 30,
        powerConsumption: 1,
        structuralIntegrity: 6,
        description: 'Increases cargo storage capacity'
      },
      weapon: {
        name: 'Weapon System',
        icon: '⚔️',
        color: '#d0021b',
        size: { width: 2, height: 1 },
        cost: 70,
        powerConsumption: 4,
        structuralIntegrity: 4,
        description: 'Offensive combat capabilities'
      },
      shield: {
        name: 'Shield Generator',
        icon: '🛡️',
        color: '#50e3c2',
        size: { width: 2, height: 2 },
        cost: 60,
        powerConsumption: 5,
        structuralIntegrity: 7,
        description: 'Defensive protection system'
      },
      life_support: {
        name: 'Life Support',
        icon: '🫁',
        color: '#9013fe',
        size: { width: 2, height: 2 },
        cost: 45,
        powerConsumption: 2,
        structuralIntegrity: 5,
        description: 'Maintains crew life support systems'
      },
      sensor: {
        name: 'Sensor Array',
        icon: '📡',
        color: '#f5a623',
        size: { width: 1, height: 2 },
        cost: 80,
        powerConsumption: 3,
        structuralIntegrity: 3,
        description: 'Advanced scanning and detection'
      },
      thruster: {
        name: 'Maneuvering Thruster',
        icon: '🚀',
        color: '#bd10e0',
        size: { width: 1, height: 1 },
        cost: 25,
        powerConsumption: 1,
        structuralIntegrity: 2,
        description: 'Improves ship agility and rotation'
      },
      warp_drive: {
        name: 'Warp Drive',
        icon: '🌀',
        color: '#00d4ff',
        size: { width: 4, height: 2 },
        cost: 150,
        powerConsumption: 8,
        structuralIntegrity: 10,
        description: 'Enables faster-than-light travel'
      }
    };
    
    // Ship templates for quick building
    this.shipTemplates = {
      fighter: {
        name: 'Fighter',
        description: 'Fast and agile combat vessel',
        components: [
          { type: 'hull', x: 14, y: 9, rotation: 0 },
          { type: 'engine', x: 12, y: 8, rotation: 0 },
          { type: 'weapon', x: 16, y: 9, rotation: 0 },
          { type: 'thruster', x: 13, y: 7, rotation: 0 },
          { type: 'thruster', x: 15, y: 7, rotation: 0 }
        ]
      },
      freighter: {
        name: 'Freighter',
        description: 'Heavy cargo transport vessel',
        components: [
          { type: 'hull', x: 13, y: 8, rotation: 0 },
          { type: 'hull', x: 15, y: 8, rotation: 0 },
          { type: 'engine', x: 11, y: 7, rotation: 0 },
          { type: 'cargo', x: 13, y: 10, rotation: 0 },
          { type: 'cargo', x: 16, y: 10, rotation: 0 },
          { type: 'reactor', x: 14, y: 5, rotation: 0 }
        ]
      },
      explorer: {
        name: 'Explorer',
        description: 'Long-range exploration vessel',
        components: [
          { type: 'hull', x: 14, y: 9, rotation: 0 },
          { type: 'warp_drive', x: 12, y: 7, rotation: 0 },
          { type: 'sensor', x: 17, y: 8, rotation: 0 },
          { type: 'life_support', x: 12, y: 11, rotation: 0 },
          { type: 'reactor', x: 13, y: 5, rotation: 0 }
        ]
      },
      battleship: {
        name: 'Battleship',
        description: 'Heavy combat vessel with strong defenses',
        components: [
          { type: 'hull', x: 13, y: 8, rotation: 0 },
          { type: 'hull', x: 15, y: 8, rotation: 0 },
          { type: 'hull', x: 14, y: 10, rotation: 0 },
          { type: 'engine', x: 11, y: 8, rotation: 0 },
          { type: 'weapon', x: 17, y: 8, rotation: 0 },
          { type: 'weapon', x: 13, y: 6, rotation: 0 },
          { type: 'shield', x: 15, y: 10, rotation: 0 },
          { type: 'shield', x: 13, y: 10, rotation: 0 },
          { type: 'reactor', x: 12, y: 5, rotation: 0 }
        ]
      }
    };
    
    this.init();
  }
  
  init() {
    this.createEditorUI();
    this.setupEventListeners();
    this.loadCurrentPlayerShip();
  }
  
  createEditorUI() {
    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'shipEditorModal';
    modal.className = 'ship-editor-modal hidden';
    
    modal.innerHTML = `
      <div class="ship-editor-container">
        <div class="ship-editor-header">
          <h2>Ship Designer</h2>
          <div class="ship-editor-controls">
            <button id="saveDesignBtn" class="editor-btn primary">💾 Save Design</button>
            <button id="loadDesignBtn" class="editor-btn secondary">📁 Load Design</button>
            <button id="resetDesignBtn" class="editor-btn warning">🔄 Reset</button>
            <button id="closeEditorBtn" class="editor-btn close">✕</button>
          </div>
        </div>
        
        <div class="ship-editor-body">
          <div class="component-library">
            <h3>Component Library</h3>
            <div class="component-categories">
              <div class="category active" data-category="all">All</div>
              <div class="category" data-category="core">Core</div>
              <div class="category" data-category="propulsion">Propulsion</div>
              <div class="category" data-category="combat">Combat</div>
              <div class="category" data-category="utility">Utility</div>
            </div>
            <div id="componentList" class="component-list">
              <!-- Components will be populated here -->
            </div>
            
            <div class="templates-section">
              <h4>Quick Templates</h4>
              <div id="templateList" class="template-list">
                <!-- Templates will be populated here -->
              </div>
            </div>
          </div>
          
          <div class="editor-workspace">
            <div class="workspace-header">
              <div class="design-info">
                <input type="text" id="designName" class="design-name-input" value="Untitled Design" placeholder="Ship Design Name">
                <div class="ship-stats">
                  <div class="stat-group">
                    <span class="stat-label">Power:</span>
                    <span id="powerBalance" class="stat-value power-positive">+0</span>
                  </div>
                  <div class="stat-group">
                    <span class="stat-label">Integrity:</span>
                    <span id="structuralIntegrity" class="stat-value">0</span>
                  </div>
                  <div class="stat-group">
                    <span class="stat-label">Cost:</span>
                    <span id="totalCost" class="stat-value">0</span>
                  </div>
                </div>
              </div>
              
              <div class="workspace-controls">
                <button id="rotateBtn" class="editor-btn">🔄 Rotate</button>
                <button id="validateBtn" class="editor-btn">✓ Validate</button>
                <button id="applyDesignBtn" class="editor-btn primary">🚀 Apply to Ship</button>
              </div>
            </div>
            
            <div class="design-canvas-container">
              <canvas id="shipDesignCanvas" width="600" height="400"></canvas>
              <div class="canvas-overlay">
                <div id="componentTooltip" class="component-tooltip hidden"></div>
              </div>
            </div>
          </div>
          
          <div class="design-inspector">
            <h3>Component Inspector</h3>
            <div id="componentDetails" class="component-details">
              <div class="no-selection">Click a component to view details</div>
            </div>
            
            <div class="validation-panel">
              <h4>Design Validation</h4>
              <div id="validationResults" class="validation-results">
                <div class="validation-item valid">
                  <span class="validation-icon">✓</span>
                  <span>Design validation will appear here</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Get canvas reference
    this.canvas = document.getElementById('shipDesignCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.populateComponentLibrary();
    this.populateTemplates();
    this.updateShipStats();
  }
  
  populateComponentLibrary() {
    const componentList = document.getElementById('componentList');
    
    Object.entries(this.componentLibrary).forEach(([type, component]) => {
      const componentElement = document.createElement('div');
      componentElement.className = 'library-component';
      componentElement.dataset.componentType = type;
      componentElement.draggable = true;
      
      componentElement.innerHTML = `
        <div class="component-icon" style="color: ${component.color}">${component.icon}</div>
        <div class="component-info">
          <div class="component-name">${component.name}</div>
          <div class="component-cost">${component.cost} credits</div>
        </div>
      `;
      
      componentList.appendChild(componentElement);
    });
  }
  
  populateTemplates() {
    const templateList = document.getElementById('templateList');
    
    Object.entries(this.shipTemplates).forEach(([key, template]) => {
      const templateElement = document.createElement('div');
      templateElement.className = 'template-item';
      templateElement.dataset.templateKey = key;
      
      templateElement.innerHTML = `
        <div class="template-name">${template.name}</div>
        <div class="template-description">${template.description}</div>
      `;
      
      templateList.appendChild(templateElement);
    });
  }
  
  setupEventListeners() {
    // Modal controls
    document.getElementById('closeEditorBtn').addEventListener('click', () => this.closeEditor());
    document.getElementById('saveDesignBtn').addEventListener('click', () => this.saveDesign());
    document.getElementById('loadDesignBtn').addEventListener('click', () => this.showLoadDialog());
    document.getElementById('resetDesignBtn').addEventListener('click', () => this.resetDesign());
    document.getElementById('applyDesignBtn').addEventListener('click', () => this.applyDesign());
    
    // Workspace controls
    document.getElementById('rotateBtn').addEventListener('click', () => this.rotateSelectedComponent());
    document.getElementById('validateBtn').addEventListener('click', () => this.validateDesign());
    
    // Design name input
    document.getElementById('designName').addEventListener('input', (e) => {
      this.currentDesign.name = e.target.value;
      this.currentDesign.metadata.modified = Date.now();
    });
    
    // Component library drag events
    const componentList = document.getElementById('componentList');
    componentList.addEventListener('dragstart', (e) => this.handleLibraryDragStart(e));
    
    // Canvas events
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    this.canvas.addEventListener('dragover', (e) => this.handleCanvasDragOver(e));
    this.canvas.addEventListener('drop', (e) => this.handleCanvasDrop(e));
    
    // Template selection
    document.getElementById('templateList').addEventListener('click', (e) => this.handleTemplateClick(e));
    
    // Category filtering
    document.querySelectorAll('.category').forEach(category => {
      category.addEventListener('click', (e) => this.filterComponents(e.target.dataset.category));
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      
      if (e.key === 'Delete' && this.selectedComponent) {
        this.deleteComponent(this.selectedComponent);
      } else if (e.key === 'r' || e.key === 'R') {
        this.rotateSelectedComponent();
      } else if (e.key === 'Escape') {
        this.selectedComponent = null;
        this.renderCanvas();
      }
    });
  }
  
  handleLibraryDragStart(e) {
    if (!e.target.classList.contains('library-component')) return;
    
    const componentType = e.target.dataset.componentType;
    e.dataTransfer.setData('text/plain', componentType);
    e.dataTransfer.effectAllowed = 'copy';
  }
  
  handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  
  handleCanvasDrop(e) {
    e.preventDefault();
    const componentType = e.dataTransfer.getData('text/plain');
    if (!componentType || !this.componentLibrary[componentType]) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const gridX = Math.floor(canvasX / this.gridSize);
    const gridY = Math.floor(canvasY / this.gridSize);
    
    this.addComponent(componentType, gridX, gridY);
  }
  
  handleCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const clickedComponent = this.getComponentAtPosition(canvasX, canvasY);
    
    if (clickedComponent) {
      this.selectedComponent = clickedComponent;
      this.showComponentDetails(clickedComponent);
    } else {
      this.selectedComponent = null;
      this.hideComponentDetails();
    }
    
    this.renderCanvas();
  }
  
  handleCanvasMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const hoveredComponent = this.getComponentAtPosition(canvasX, canvasY);
    
    if (hoveredComponent !== this.hoveredComponent) {
      this.hoveredComponent = hoveredComponent;
      
      if (hoveredComponent) {
        this.showTooltip(hoveredComponent, canvasX, canvasY);
      } else {
        this.hideTooltip();
      }
      
      this.renderCanvas();
    }
  }
  
  handleTemplateClick(e) {
    const templateItem = e.target.closest('.template-item');
    if (!templateItem) return;
    
    const templateKey = templateItem.dataset.templateKey;
    this.loadTemplate(templateKey);
  }
  
  addComponent(type, gridX, gridY) {
    const component = this.componentLibrary[type];
    if (!component) return;
    
    // Check if position is valid and not overlapping
    if (!this.isValidPlacement(type, gridX, gridY)) {
      this.gameClient.showNotification('Invalid placement - components overlap or exceed boundaries', 'warning');
      return;
    }
    
    const newComponent = {
      id: Date.now() + Math.random(),
      type,
      x: gridX,
      y: gridY,
      rotation: this.rotationAngle,
      connections: []
    };
    
    this.currentDesign.components.push(newComponent);
    this.currentDesign.metadata.modified = Date.now();
    
    this.updateShipStats();
    this.renderCanvas();
    this.validateDesign();
  }
  
  deleteComponent(component) {
    const index = this.currentDesign.components.indexOf(component);
    if (index > -1) {
      this.currentDesign.components.splice(index, 1);
      this.selectedComponent = null;
      this.currentDesign.metadata.modified = Date.now();
      
      this.updateShipStats();
      this.renderCanvas();
      this.hideComponentDetails();
      this.validateDesign();
    }
  }
  
  rotateSelectedComponent() {
    if (!this.selectedComponent) {
      this.rotationAngle = (this.rotationAngle + 90) % 360;
      return;
    }
    
    this.selectedComponent.rotation = (this.selectedComponent.rotation + 90) % 360;
    this.currentDesign.metadata.modified = Date.now();
    this.renderCanvas();
  }
  
  isValidPlacement(type, x, y) {
    const component = this.componentLibrary[type];
    
    // Check grid boundaries
    if (x < 0 || y < 0 || x + component.size.width > this.gridWidth || y + component.size.height > this.gridHeight) {
      return false;
    }
    
    // Check for overlaps
    for (const existingComponent of this.currentDesign.components) {
      if (this.componentsOverlap(
        { type, x, y, rotation: this.rotationAngle },
        existingComponent
      )) {
        return false;
      }
    }
    
    return true;
  }
  
  componentsOverlap(comp1, comp2) {
    const lib1 = this.componentLibrary[comp1.type];
    const lib2 = this.componentLibrary[comp2.type];
    
    // Simple AABB collision detection (could be enhanced for rotation)
    const rect1 = {
      x: comp1.x,
      y: comp1.y,
      width: lib1.size.width,
      height: lib1.size.height
    };
    
    const rect2 = {
      x: comp2.x,
      y: comp2.y,
      width: lib2.size.width,
      height: lib2.size.height
    };
    
    return !(rect1.x >= rect2.x + rect2.width ||
             rect2.x >= rect1.x + rect1.width ||
             rect1.y >= rect2.y + rect2.height ||
             rect2.y >= rect1.y + rect1.height);
  }
  
  getComponentAtPosition(canvasX, canvasY) {
    const gridX = Math.floor(canvasX / this.gridSize);
    const gridY = Math.floor(canvasY / this.gridSize);
    
    for (const component of this.currentDesign.components) {
      const lib = this.componentLibrary[component.type];
      if (gridX >= component.x && gridX < component.x + lib.size.width &&
          gridY >= component.y && gridY < component.y + lib.size.height) {
        return component;
      }
    }
    
    return null;
  }
  
  renderCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid
    this.drawGrid();
    
    // Draw components
    for (const component of this.currentDesign.components) {
      this.drawComponent(component);
    }
    
    // Draw connections (power flow)
    this.drawConnections();
    
    // Highlight selected/hovered components
    if (this.selectedComponent) {
      this.highlightComponent(this.selectedComponent, '#00d4ff', 3);
    }
    
    if (this.hoveredComponent && this.hoveredComponent !== this.selectedComponent) {
      this.highlightComponent(this.hoveredComponent, '#ffd700', 2);
    }
  }
  
  drawGrid() {
    this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
    this.ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x <= this.gridWidth; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.gridSize, 0);
      this.ctx.lineTo(x * this.gridSize, this.gridHeight * this.gridSize);
      this.ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= this.gridHeight; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.gridSize);
      this.ctx.lineTo(this.gridWidth * this.gridSize, y * this.gridSize);
      this.ctx.stroke();
    }
  }
  
  drawComponent(component) {
    const lib = this.componentLibrary[component.type];
    const x = component.x * this.gridSize;
    const y = component.y * this.gridSize;
    const width = lib.size.width * this.gridSize;
    const height = lib.size.height * this.gridSize;
    
    this.ctx.save();
    
    // Apply rotation
    if (component.rotation) {
      this.ctx.translate(x + width/2, y + height/2);
      this.ctx.rotate((component.rotation * Math.PI) / 180);
      this.ctx.translate(-width/2, -height/2);
    } else {
      this.ctx.translate(x, y);
    }
    
    // Draw component background
    this.ctx.fillStyle = lib.color + '40'; // Semi-transparent
    this.ctx.fillRect(0, 0, width, height);
    
    // Draw component border
    this.ctx.strokeStyle = lib.color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, width, height);
    
    // Draw component icon
    this.ctx.fillStyle = lib.color;
    this.ctx.font = `${Math.min(width, height) * 0.4}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(lib.icon, width/2, height/2);
    
    // Draw component name (if large enough)
    if (width > 60 && height > 40) {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '10px Arial';
      this.ctx.fillText(lib.name, width/2, height - 8);
    }
    
    this.ctx.restore();
  }
  
  highlightComponent(component, color, lineWidth) {
    const lib = this.componentLibrary[component.type];
    const x = component.x * this.gridSize;
    const y = component.y * this.gridSize;
    const width = lib.size.width * this.gridSize;
    const height = lib.size.height * this.gridSize;
    
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
    this.ctx.restore();
  }
  
  drawConnections() {
    // Draw power flow connections between components
    const reactors = this.currentDesign.components.filter(c => c.type === 'reactor');
    
    this.ctx.strokeStyle = '#ffd700';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    for (const reactor of reactors) {
      const reactorCenter = this.getComponentCenter(reactor);
      
      for (const component of this.currentDesign.components) {
        if (component === reactor) continue;
        
        const lib = this.componentLibrary[component.type];
        if (lib.powerConsumption && lib.powerConsumption > 0) {
          const componentCenter = this.getComponentCenter(component);
          
          this.ctx.beginPath();
          this.ctx.moveTo(reactorCenter.x, reactorCenter.y);
          this.ctx.lineTo(componentCenter.x, componentCenter.y);
          this.ctx.stroke();
        }
      }
    }
    
    this.ctx.setLineDash([]);
  }
  
  getComponentCenter(component) {
    const lib = this.componentLibrary[component.type];
    return {
      x: (component.x + lib.size.width / 2) * this.gridSize,
      y: (component.y + lib.size.height / 2) * this.gridSize
    };
  }
  
  updateShipStats() {
    let totalCost = 0;
    let powerProduction = 0;
    let powerConsumption = 0;
    let structuralIntegrity = 0;
    
    for (const component of this.currentDesign.components) {
      const lib = this.componentLibrary[component.type];
      totalCost += lib.cost || 0;
      powerProduction += lib.powerProduction || 0;
      powerConsumption += lib.powerConsumption || 0;
      structuralIntegrity += lib.structuralIntegrity || 0;
    }
    
    const powerBalance = powerProduction - powerConsumption;
    
    // Update UI
    document.getElementById('totalCost').textContent = totalCost;
    document.getElementById('structuralIntegrity').textContent = structuralIntegrity;
    
    const powerBalanceEl = document.getElementById('powerBalance');
    powerBalanceEl.textContent = powerBalance >= 0 ? `+${powerBalance}` : powerBalance;
    powerBalanceEl.className = `stat-value ${powerBalance >= 0 ? 'power-positive' : 'power-negative'}`;
  }
  
  validateDesign() {
    const validationResults = [];
    
    // Check for hull sections
    const hullCount = this.currentDesign.components.filter(c => c.type === 'hull').length;
    if (hullCount === 0) {
      validationResults.push({
        type: 'error',
        message: 'Design must contain at least one hull section'
      });
    }
    
    // Check power balance
    let powerProduction = 0;
    let powerConsumption = 0;
    
    for (const component of this.currentDesign.components) {
      const lib = this.componentLibrary[component.type];
      powerProduction += lib.powerProduction || 0;
      powerConsumption += lib.powerConsumption || 0;
    }
    
    if (powerConsumption > powerProduction) {
      validationResults.push({
        type: 'error',
        message: `Insufficient power: ${powerConsumption - powerProduction} units needed`
      });
    }
    
    // Check structural integrity
    const totalIntegrity = this.currentDesign.components.reduce((sum, c) => 
      sum + (this.componentLibrary[c.type].structuralIntegrity || 0), 0);
    
    if (totalIntegrity < 20) {
      validationResults.push({
        type: 'warning',
        message: 'Low structural integrity - ship may be fragile'
      });
    }
    
    // Check for essential systems
    const hasEngine = this.currentDesign.components.some(c => c.type === 'engine');
    if (!hasEngine) {
      validationResults.push({
        type: 'warning',
        message: 'No engine detected - ship will have limited mobility'
      });
    }
    
    this.displayValidationResults(validationResults);
    return validationResults.filter(r => r.type === 'error').length === 0;
  }
  
  displayValidationResults(results) {
    const container = document.getElementById('validationResults');
    container.innerHTML = '';
    
    if (results.length === 0) {
      container.innerHTML = `
        <div class="validation-item valid">
          <span class="validation-icon">✓</span>
          <span>Design is valid and ready to deploy</span>
        </div>
      `;
      return;
    }
    
    for (const result of results) {
      const item = document.createElement('div');
      item.className = `validation-item ${result.type}`;
      item.innerHTML = `
        <span class="validation-icon">${result.type === 'error' ? '✗' : '⚠'}</span>
        <span>${result.message}</span>
      `;
      container.appendChild(item);
    }
  }
  
  showComponentDetails(component) {
    const lib = this.componentLibrary[component.type];
    const detailsContainer = document.getElementById('componentDetails');
    
    detailsContainer.innerHTML = `
      <div class="component-detail-header">
        <span class="component-icon" style="color: ${lib.color}">${lib.icon}</span>
        <div class="component-title">
          <div class="component-name">${lib.name}</div>
          <div class="component-type">${component.type}</div>
        </div>
        <button class="delete-component-btn" onclick="shipEditor.deleteComponent(shipEditor.selectedComponent)">🗑️</button>
      </div>
      
      <div class="component-properties">
        <div class="property-row">
          <span class="property-label">Position:</span>
          <span class="property-value">${component.x}, ${component.y}</span>
        </div>
        <div class="property-row">
          <span class="property-label">Rotation:</span>
          <span class="property-value">${component.rotation}°</span>
        </div>
        <div class="property-row">
          <span class="property-label">Size:</span>
          <span class="property-value">${lib.size.width}×${lib.size.height}</span>
        </div>
        <div class="property-row">
          <span class="property-label">Cost:</span>
          <span class="property-value">${lib.cost} credits</span>
        </div>
        ${lib.powerConsumption ? `
          <div class="property-row">
            <span class="property-label">Power Usage:</span>
            <span class="property-value">${lib.powerConsumption} units</span>
          </div>
        ` : ''}
        ${lib.powerProduction ? `
          <div class="property-row">
            <span class="property-label">Power Output:</span>
            <span class="property-value">${lib.powerProduction} units</span>
          </div>
        ` : ''}
        <div class="property-row">
          <span class="property-label">Integrity:</span>
          <span class="property-value">${lib.structuralIntegrity}</span>
        </div>
      </div>
      
      <div class="component-description">
        ${lib.description}
      </div>
    `;
  }
  
  hideComponentDetails() {
    document.getElementById('componentDetails').innerHTML = `
      <div class="no-selection">Click a component to view details</div>
    `;
  }
  
  showTooltip(component, x, y) {
    const lib = this.componentLibrary[component.type];
    const tooltip = document.getElementById('componentTooltip');
    
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <span style="color: ${lib.color}">${lib.icon}</span> ${lib.name}
      </div>
      <div class="tooltip-info">
        Cost: ${lib.cost} | Power: ${lib.powerConsumption || 0}
      </div>
    `;
    
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
    tooltip.classList.remove('hidden');
  }
  
  hideTooltip() {
    document.getElementById('componentTooltip').classList.add('hidden');
  }
  
  loadTemplate(templateKey) {
    const template = this.shipTemplates[templateKey];
    if (!template) return;
    
    this.currentDesign.components = template.components.map(comp => ({
      ...comp,
      id: Date.now() + Math.random()
    }));
    
    this.currentDesign.name = template.name;
    document.getElementById('designName').value = template.name;
    
    this.updateShipStats();
    this.renderCanvas();
    this.validateDesign();
    
    this.gameClient.showNotification(`Loaded ${template.name} template`, 'success');
  }
  
  saveDesign() {
    const designData = JSON.stringify(this.currentDesign);
    const designName = this.currentDesign.name.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Save to localStorage
    const savedDesigns = JSON.parse(localStorage.getItem('starforge_ship_designs') || '{}');
    savedDesigns[designName] = this.currentDesign;
    localStorage.setItem('starforge_ship_designs', JSON.stringify(savedDesigns));
    
    // TODO: Also save to server if player is authenticated
    this.gameClient.showNotification(`Design "${this.currentDesign.name}" saved successfully`, 'success');
  }
  
  showLoadDialog() {
    const savedDesigns = JSON.parse(localStorage.getItem('starforge_ship_designs') || '{}');
    const designNames = Object.keys(savedDesigns);
    
    if (designNames.length === 0) {
      this.gameClient.showNotification('No saved designs found', 'warning');
      return;
    }
    
    // Create a simple selection dialog
    const selection = prompt(`Select a design to load:\n${designNames.map((name, i) => `${i + 1}: ${name}`).join('\n')}\n\nEnter the number:`);
    
    if (selection && !isNaN(selection)) {
      const index = parseInt(selection) - 1;
      if (index >= 0 && index < designNames.length) {
        const designName = designNames[index];
        this.currentDesign = { ...savedDesigns[designName] };
        document.getElementById('designName').value = this.currentDesign.name;
        
        this.updateShipStats();
        this.renderCanvas();
        this.validateDesign();
        
        this.gameClient.showNotification(`Loaded design "${designName}"`, 'success');
      }
    }
  }
  
  resetDesign() {
    if (confirm('Are you sure you want to reset the current design?')) {
      this.currentDesign = {
        components: [],
        name: 'Untitled Design',
        hullType: 'standard',
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          author: null,
          version: '1.0'
        }
      };
      
      document.getElementById('designName').value = this.currentDesign.name;
      this.selectedComponent = null;
      
      this.updateShipStats();
      this.renderCanvas();
      this.validateDesign();
      this.hideComponentDetails();
    }
  }
  
  applyDesign() {
    if (!this.validateDesign()) {
      this.gameClient.showNotification('Cannot apply invalid design', 'error');
      return;
    }
    
    // Convert design to game format
    const gameModules = this.currentDesign.components.map(comp => ({
      id: comp.type,
      x: comp.x * 22, // Convert grid to game coordinates
      y: comp.y * 22,
      rotation: comp.rotation
    }));
    
    // Send to game client
    if (this.gameClient && this.gameClient.ws && this.gameClient.ws.readyState === WebSocket.OPEN) {
      this.gameClient.ws.send(JSON.stringify({
        type: 'apply_ship_design',
        modules: gameModules,
        designName: this.currentDesign.name
      }));
      
      this.gameClient.showNotification(`Applied design "${this.currentDesign.name}" to your ship!`, 'success');
      this.closeEditor();
    } else {
      this.gameClient.showNotification('Cannot apply design - not connected to game', 'error');
    }
  }
  
  loadCurrentPlayerShip() {
    // Load current player ship configuration
    if (this.gameClient && this.gameClient.myId && this.gameClient.players[this.gameClient.myId]) {
      const player = this.gameClient.players[this.gameClient.myId];
      if (player.modules && player.modules.length > 0) {
        this.currentDesign.components = player.modules.map(mod => ({
          id: Date.now() + Math.random(),
          type: mod.id,
          x: Math.floor(mod.x / 22), // Convert game coordinates to grid
          y: Math.floor(mod.y / 22),
          rotation: mod.rotation || 0
        }));
        
        this.updateShipStats();
        this.renderCanvas();
        this.validateDesign();
      }
    }
  }
  
  filterComponents(category) {
    // Update active category
    document.querySelectorAll('.category').forEach(cat => cat.classList.remove('active'));
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    // Filter components based on category
    const components = document.querySelectorAll('.library-component');
    components.forEach(comp => {
      const type = comp.dataset.componentType;
      const lib = this.componentLibrary[type];
      let show = true;
      
      if (category !== 'all') {
        switch (category) {
          case 'core':
            show = ['hull', 'reactor', 'life_support'].includes(type);
            break;
          case 'propulsion':
            show = ['engine', 'thruster', 'warp_drive'].includes(type);
            break;
          case 'combat':
            show = ['weapon', 'shield'].includes(type);
            break;
          case 'utility':
            show = ['cargo', 'sensor'].includes(type);
            break;
        }
      }
      
      comp.style.display = show ? 'flex' : 'none';
    });
  }
  
  openEditor() {
    this.isOpen = true;
    document.getElementById('shipEditorModal').classList.remove('hidden');
    this.loadCurrentPlayerShip();
    this.renderCanvas();
  }
  
  closeEditor() {
    this.isOpen = false;
    document.getElementById('shipEditorModal').classList.add('hidden');
    this.selectedComponent = null;
    this.hoveredComponent = null;
  }
}

// Export for global access
window.ShipEditor = ShipEditor;