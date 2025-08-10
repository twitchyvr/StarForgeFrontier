# StarForgeFrontier - Development Instructions

## Project Overview
StarForgeFrontier is a multiplayer spaceship building and space exploration game with full physics, upgrades, and an engaging in-game economy. Built with Node.js backend and HTML5 Canvas frontend.

**Current Version:** 0.2.0  
**Current Branch:** main  
**Project Status:** CI/CD pipeline operational, production-ready deployment

## Architecture Overview

### Backend (Node.js)
- **Entry Point:** `server.js` (legacy) / `server-enhanced.js` (production)
- **Framework:** Express.js with comprehensive middleware stack
- **WebSocket:** Real-time multiplayer communication using `ws` library
- **Game Loop:** 30fps server-side simulation with deterministic physics
- **State Management:** SQLite database with persistent data storage
- **Authentication:** JWT-based user authentication system
- **Health Monitoring:** Built-in health check endpoints and metrics

### Frontend (HTML5 Canvas)
- **Entry Point:** `public/index.html`
- **Game Engine:** Enhanced canvas renderer in `public/client-enhanced.js`
- **Authentication:** Dedicated auth interface (`public/auth.html`)
- **Styling:** Responsive CSS with dark mode support
- **Real-time Communication:** WebSocket client with reconnection handling

### Core Game Features
- **Multiplayer Support:** Real-time player synchronization with persistent sessions
- **Ship Building:** Functional modular spacecraft construction system with gameplay effects
  - **Engine Components:** Increase ship speed by 30% per engine module
  - **Cargo Components:** Boost capacity (+500 per module), collection range (+10 per module), and efficiency (+10% per module)
  - **Weapon Components:** Add damage (+25 per module) and range (+10 per module) for combat system
  - **Shield Components:** Increase max health (+100 per module) with health management
- **Procedural Galaxy System:** Infinite sector exploration with strategic resource distribution ✅
  - **6 Distinct Biomes:** Asteroid Field, Nebula, Deep Space, Stellar Nursery, Ancient Ruins, Black Hole Region
  - **16 Unique Ore Types:** Rarity-based distribution across different biomes for strategic exploration
  - **Warp Drive System:** Inter-sector travel with fuel costs (50 resources per sector) and efficiency bonuses
  - **Memory-Efficient Loading:** Maximum 25 active sectors with automatic cleanup system
  - **Interactive Galaxy Map:** Accessible via 'G' key with visual biome representation and navigation
  - **Seed-Based Generation:** Consistent procedural world generation for reliable exploration
- **Resource Economy:** Ore collection and credit-based upgrade system with cargo capacity limits
- **Dynamic Events:** Scheduled supernova events with resource spawning
- **Physics Simulation:** Server-authoritative movement and collision detection with component-based properties
- **User Management:** Registration, login, and profile systems  
- **Data Persistence:** Player progress and game state preservation across sectors
- **Real-time UI:** Ship statistics display showing speed, cargo usage, collection range, and sector information

## Development Workflow

### Branch Strategy
- **main:** Production-ready code, protected branch
- **develop:** Integration branch for feature development
- **feature/[name]:** Individual feature development
- **hotfix/[name]:** Critical production fixes
- **chore/[name]:** Maintenance tasks and tooling updates

### Commit Standards
Following Conventional Commits specification:
- **feat:** New features
- **fix:** Bug fixes
- **docs:** Documentation updates
- **style:** Code formatting changes
- **refactor:** Code restructuring without functional changes
- **test:** Adding or updating tests
- **chore:** Maintenance tasks

Example: `feat(game): add weapon module functionality`

### Development Environment Setup

#### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn package manager
- Git version control

#### Installation
```bash
# Clone repository
git clone <repository-url>
cd StarForgeFrontier

# Install dependencies
npm install

# Start development server
npm start
```

#### Available Scripts
- `npm start` - Start production server (enhanced)
- `npm run dev` - Start development server with hot reload
- `npm test` - Run comprehensive test suite (107 tests)
- `npm run lint` - Check code style
- `npm run build` - Build for production
- `npm run deploy` - Deploy to production
- `npm run backup` - Create database backup
- `npm run monitor` - Start monitoring dashboard
- `npm run health` - Run health checks

## Current Project Structure
```
StarForgeFrontier/
├── .github/workflows/      # GitHub Actions CI/CD pipelines
│   ├── ci.yml             # Continuous integration workflow
│   ├── deploy.yml         # Deployment automation
│   ├── render-deploy.yml  # Render.com deployment
│   └── test.yml          # Testing workflow
├── galaxy/                # Procedural galaxy system ✅
│   ├── Sector.js          # Individual sector representation
│   ├── SectorManager.js   # Memory-efficient sector management
│   ├── WarpSystem.js      # Inter-sector travel mechanics
│   └── ProceduralGeneration.js # Seed-based world generation
├── docs/                  # Galaxy system documentation ✅
│   ├── GALAXY_SYSTEM.md   # Comprehensive galaxy system guide
│   └── CLIENT_GALAXY_INTEGRATION.md # Frontend integration docs
├── monitoring/            # Observability and monitoring
│   ├── prometheus.yml     # Metrics collection config
│   ├── starforge_rules.yml # Alerting rules
│   └── grafana/          # Dashboard configurations
├── nginx/                 # Reverse proxy configuration
│   └── nginx.conf        # Load balancing and SSL
├── scripts/              # Utility and automation scripts
│   ├── backup.js         # Database backup system
│   └── monitor.js        # Real-time monitoring dashboard
├── tests/                # Comprehensive test suite
│   ├── client/           # Frontend tests
│   └── server/           # Backend tests (124 total tests)
│       └── galaxy-system.test.js # Galaxy system test suite ✅
├── public/               # Enhanced frontend assets
│   ├── index.html        # Main game interface with galaxy nav ✅
│   ├── auth.html         # Authentication interface
│   ├── client-enhanced.js # Enhanced game client with galaxy + null checks ✅
│   ├── research-system.js # Research interface (fixed reserved word) ✅
│   ├── galaxy-ui.js      # Interactive galaxy map interface ✅
│   ├── auth.js           # Authentication logic
│   ├── style.css         # Responsive game styling with galaxy themes ✅
│   ├── auth.css          # Authentication styling
│   └── icons/            # Complete PWA icon set (8 sizes) ✅
├── DEPLOYMENT.md         # Comprehensive deployment guide
├── Dockerfile            # Multi-stage container build
├── docker-compose.yml    # Production stack configuration
├── render.yaml           # Render.com deployment config
├── healthcheck.js        # Health monitoring utility
├── server-enhanced.js    # Production server with galaxy system ✅
├── database.js           # SQLite database with sector tables ✅
├── package.json          # Dependencies and deployment scripts
└── logs/                 # Application and health logs
```

## Active Development Areas

### Current Sprint Focus
1. **Core Game Mechanics** - Basic multiplayer functionality ✅
2. **UI/UX Enhancement** - Enhanced interface with authentication ✅
3. **Data Persistence** - SQLite integration and user management ✅
4. **Testing Infrastructure** - Comprehensive test suite (124 tests) ✅
5. **CI/CD Pipeline** - Automated deployment and monitoring ✅
6. **Procedural Galaxy System** - Infinite sector exploration (Issue #12) ✅
7. **JavaScript Error Fixes** - Critical client-side error resolution ✅
   - Fixed reserved word 'interface' in research-system.js (Issue #23) ✅
   - Added null check for closeShopBtn in client-enhanced.js (Issue #24) ✅
   - Generated complete PWA icon set (8 sizes) for mobile support ✅
8. **Gaming-Standard Transparent HUD System** - Critical UI fix implementation ✅
   - PR #39 successfully merged with agent approval (Issue #47) ✅
   - Transformed gameplay from "essentially unplayable" to professional standard ✅
   - 85% of screen now available for gameplay with transparent overlays ✅
9. **Ship Customization System** - Visual editor and advanced components (Issue #13) 🚧
10. **Performance Optimization** - Server and client-side optimizations (Issue #45) 🚧
11. **Environmental Hazards System** - Dynamic events and space hazards (Issue #46) 🚧
12. **Documentation** - API documentation and player guides

### Agent Review Process Status

#### Successfully Completed
- **PR #39**: Gaming-Standard Transparent HUD ✅ MERGED
  - Frontend-Lead Review: APPROVED with recommendations
  - UX-Designer Review: APPROVED - transformational improvement
  - Status: Successfully deployed to production

#### Pending Development Work  
- **PR #35**: Server Performance Optimization (Issue #45) 🔄 
  - Backend-Lead Review: REQUEST_CHANGES - Critical issues identified
  - System-Architect Review: REQUEST_CHANGES - Deployment complexity concerns
  - Status: 1-2 weeks development work needed before production ready

- **PR #33**: Environmental Hazards System (Issue #46) 🔄
  - QA-Lead Review: REQUEST_CHANGES - Missing test coverage
  - Status: Comprehensive test suite needed before production ready

### GitOps Workflow Management

#### Current Branch Status
- **main**: Production-ready, contains merged PR #39 (HUD system)
- **copilot/fix-4**: Draft PR #35 branch - needs critical fixes before merge
- **copilot/fix-18**: Draft PR #33 branch - needs comprehensive testing

#### Recommended Merge Sequence
1. **Priority 1**: Complete fixes for PR #35 (Server Performance) - addresses critical performance needs
2. **Priority 2**: Complete testing for PR #33 (Environmental Hazards) - adds gameplay features
3. **Priority 3**: Ship Customization System (Issue #13) - major feature development

#### Release Planning Strategy
- **Current Phase**: Bug fixes and testing completion for draft PRs
- **Next Release Target**: Version 2.2.0 with server optimizations
- **Future Release**: Version 2.3.0 with environmental hazards system
- **Major Release**: Version 3.0.0 with ship customization system

#### Git Workflow Coordination
- No merge conflicts expected between current PRs
- Server optimization changes are isolated to backend systems
- Environmental hazards system has minimal overlap with existing features
- Sequential merging recommended to maintain stability

## UI/UX Design Specifications

### Ship Customization and Visual Editor System (Issue #13)

#### Overview
The Ship Customization System transforms the current basic component purchasing into a comprehensive visual ship design experience with drag-and-drop module placement, advanced component systems, and real-time performance feedback.

#### 1. Visual Ship Editor Interface

##### Core Editor Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ Ship Editor - [Ship Name] [Save] [Load] [Share] [Exit]         │
├─────────────────┬───────────────────────────────┬───────────────┤
│                 │                               │               │
│ Component       │        Ship Grid              │  Performance  │
│ Library         │      (Main Editor)            │  Dashboard    │
│                 │                               │               │
│ ┌─────────────┐ │ ┌───────────────────────────┐ │ Speed: 2.6    │
│ │ Engines     │ │ │                           │ │ Cargo: 1500   │
│ │ ⚙ Engine    │ │ │     [Hull Outline]        │ │ Range: 50     │
│ │ ⚡ Reactor   │ │ │                           │ │ Health: 200   │
│ │             │ │ │  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐    │ │ Damage: 25    │
│ │ Cargo       │ │ │  │E│ │C│ │W│ │S│ │?│    │ │ W.Range: 10   │
│ │ 📦 Cargo    │ │ │  └─┘ └─┘ └─┘ └─┘ └─┘    │ │               │
│ │ 🔋 Battery  │ │ │                           │ │ Power Flow:   │
│ │             │ │ │     [Connection Lines]    │ │ ████████░░    │
│ │ Combat      │ │ │                           │ │ 80%           │
│ │ ⚔ Weapon    │ │ └───────────────────────────┘ │               │
│ │ 🛡 Shield   │ │                               │ Integrity:    │
│ │             │ │ Hull Type: [Medium ▼]        │ ██████████    │
│ │ Utility     │ │ Paint: [Blue ▼] [Custom...]  │ 100%          │
│ │ 📡 Sensor   │ │ Decal: [None ▼] [Browse...]  │               │
│ │ 💻 Computer │ │                               │ Mass: 850kg   │
│ │ 🛠 Repair   │ │ [Rotate] [Mirror] [Reset]    │ Cost: 1,250   │
│ └─────────────┘ │                               │               │
├─────────────────┴───────────────────────────────┴───────────────┤
│ Template Library: [Combat ▼] [Mining ▼] [Explorer ▼] [My Designs│
│ [Viper MK-I] [Hauler Pro] [Interceptor] [Custom Build #1] [+]   │
└─────────────────────────────────────────────────────────────────┘
```

##### Grid System Specifications
- **Grid Size**: 32x32 pixel cells for precise placement
- **Ship Hull Sizes**: 
  - Small: 15x10 grid (Fighters, Interceptors)
  - Medium: 25x15 grid (Multi-role ships)
  - Large: 35x20 grid (Cruisers, Haulers)
  - Capital: 50x30 grid (Battleships, Carriers)
- **Snap-to-Grid**: All modules snap to grid intersections
- **Visual Feedback**: Hover preview, placement validation, connection indicators

##### Module Placement System
```typescript
interface ModulePlacement {
  moduleType: string;           // 'engine', 'cargo', 'weapon', etc.
  gridX: number;               // Grid coordinate X (0-based)
  gridY: number;               // Grid coordinate Y (0-based)
  rotation: 0 | 90 | 180 | 270; // Rotation in degrees
  connections: Connection[];    // Power/data connections
  isValid: boolean;            // Placement validation
}

interface Connection {
  fromModule: string;          // Source module ID
  toModule: string;           // Target module ID
  connectionType: 'power' | 'data' | 'structural';
  efficiency: number;         // 0.0 to 1.0
}
```

##### Drag and Drop Behavior
1. **Drag from Library**: Click and drag components from library to grid
2. **Grid Snap**: Components automatically snap to valid grid positions
3. **Rotation**: Right-click during drag to rotate module
4. **Validation**: Real-time feedback on valid/invalid placement
5. **Connection Auto-routing**: Automatic power line routing between modules

#### 2. Advanced Component System

##### New Component Types
```typescript
interface ComponentDefinition {
  id: string;
  name: string;
  category: 'propulsion' | 'cargo' | 'combat' | 'utility' | 'power' | 'structure';
  size: { width: number; height: number }; // Grid cells
  cost: number;
  mass: number;
  powerConsumption: number;   // Watts required
  powerGeneration?: number;   // Watts generated (for reactors)
  effects: ComponentEffect[];
  connections: ConnectionPoint[];
  prerequisites?: string[];    // Required tech/modules
}
```

##### Component Categories and Effects

**Propulsion Systems**
- **Engine**: +30% speed, moderate power consumption
- **Thruster Pack**: +15% speed, +20% maneuverability, low power
- **Ion Drive**: +50% speed, high power consumption, long spinup

**Power Systems**
- **Reactor**: Generates 1000W, high mass, explosive when damaged
- **Solar Panel**: Generates 200W, no mass, fragile, efficiency varies by sector
- **Battery**: Stores 500Wh, emergency power backup

**Cargo Systems**
- **Cargo Bay**: +500 capacity, +10 collection range
- **Specialized Hold**: +300 specific ore capacity, +50% value for that ore type
- **Cargo Scanner**: +25 collection range, identifies ore quality

**Combat Systems**
- **Laser Cannon**: 25 damage, 10 range, low power
- **Plasma Torpedo**: 50 damage, 15 range, high power, area damage
- **Shield Generator**: +100 max health, constant power drain
- **Point Defense**: Automatic projectile interception

**Utility Systems**
- **Sensor Array**: +100% detection range, reveals hidden objects
- **Computer Core**: +20% efficiency for all systems, enables advanced targeting
- **Repair Drone**: Passive hull repair, +5 HP/second
- **Life Support**: Required for crew-dependent systems

##### Power System Design
```typescript
interface PowerSystem {
  totalGeneration: number;     // Total watts generated
  totalConsumption: number;    // Total watts required
  efficiency: number;          // 0.0 to 1.0 based on connections
  batteryCharge: number;       // 0 to 100%
  powerFlow: PowerConnection[]; // Visual power routing
}

interface PowerConnection {
  fromX: number; fromY: number;
  toX: number; toY: number;
  powerLevel: number;          // 0.0 to 1.0
  isActive: boolean;
}
```

#### 3. Ship Templates System

##### Template Structure
```typescript
interface ShipTemplate {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'mining' | 'exploration' | 'transport' | 'hybrid';
  hull: {
    size: 'small' | 'medium' | 'large' | 'capital';
    paintScheme: string;
    decals: DecalConfiguration[];
  };
  modules: ModulePlacement[];
  stats: ShipStats;
  cost: number;
  author: string;
  rating: number;              // 1-5 stars
  downloads: number;
  tags: string[];
  dateCreated: Date;
  isPublic: boolean;
}
```

##### Template Management UI
```
┌────────────────────────────────────────────────────────────┐
│ Ship Templates                                    [X]      │
├────────────────────────────────────────────────────────────┤
│ [My Designs] [Community] [Featured] [Search: ________]     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │[Preview] │ │[Preview] │ │[Preview] │ │[Preview] │      │
│ │Combat    │ │Mining    │ │Explorer  │ │Custom #1 │      │
│ │Viper MK-I│ │Hauler Pro│ │Scout     │ │My Design │      │
│ │⭐⭐⭐⭐⭐   │ │⭐⭐⭐⭐☆   │ │⭐⭐⭐☆☆   │ │Not Rated │      │
│ │1,250 cr  │ │850 cr    │ │650 cr    │ │2,100 cr  │      │
│ │[Load]    │ │[Load]    │ │[Load]    │ │[Delete]  │      │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                            │
│ Categories: [All▼] [Combat] [Mining] [Exploration]         │
│ Sort by: [Rating▼] [Cost] [Downloads] [Date]               │
│                                                            │
│ [Save Current Design] [Upload to Community] [Import File] │
└────────────────────────────────────────────────────────────┘
```

#### 4. Hull Customization System

##### Hull Frame Options
```typescript
interface HullConfiguration {
  frameType: 'small' | 'medium' | 'large' | 'capital';
  paintScheme: {
    primary: string;    // Hex color
    secondary: string;  // Hex color
    pattern: 'solid' | 'striped' | 'camo' | 'gradient';
  };
  decals: DecalPlacement[];
  materials: {
    hull: 'standard' | 'reinforced' | 'lightweight';
    coating: 'none' | 'stealth' | 'reflective' | 'ablative';
  };
}

interface DecalPlacement {
  decalId: string;
  x: number; y: number;
  scale: number;
  rotation: number;
  opacity: number;
}
```

##### Paint System UI
```
┌────────────────────────────────────────┐
│ Hull Customization            [X]      │
├────────────────────────────────────────┤
│ Frame Size: [Medium ▼]                 │
│                                        │
│ Paint Scheme:                          │
│ Primary:   [████] #0066FF              │
│ Secondary: [████] #FFFFFF              │
│ Pattern:   [Gradient ▼]                │
│                                        │
│ Decals:                                │
│ [Corporate] [Military] [Custom]        │
│ ┌──────┐ ┌──────┐ ┌──────┐            │
│ │[Logo]│ │[Star]│ │[Wing]│            │
│ │Corp  │ │Union │ │Ace   │            │
│ └──────┘ └──────┘ └──────┘            │
│                                        │
│ Hull Material:                         │
│ ◉ Standard  ○ Reinforced  ○ Lightweight│
│                                        │
│ Coating:                               │
│ ◉ None ○ Stealth ○ Reflective ○ Ablative│
│                                        │
│ [Preview] [Reset] [Apply]              │
└────────────────────────────────────────┘
```

#### 5. Performance Visualization System

##### Real-time Statistics Dashboard
```typescript
interface PerformanceDashboard {
  stats: {
    speed: number;
    cargoCapacity: number;
    collectionRange: number;
    maxHealth: number;
    damage: number;
    weaponRange: number;
    powerEfficiency: number;
    structuralIntegrity: number;
    mass: number;
    cost: number;
  };
  warnings: PerformanceWarning[];
  comparisons: ComparisonData[];
  graphs: PerformanceGraph[];
}

interface PerformanceWarning {
  type: 'power' | 'structural' | 'mass' | 'cost';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  affectedModules: string[];
}
```

##### Visualization Components

**Power Flow Visualization**
- Animated power lines between modules
- Color-coded efficiency (green = 100%, yellow = 75%, red = 50%)
- Power consumption indicators on each module
- Battery charge level visualization

**Structural Integrity Display**
- Heat map overlay showing stress points
- Connection strength indicators
- Failure probability warnings
- Weight distribution visualization

**Performance Comparison Charts**
```
┌─────────────────────────────────────────┐
│ Performance Comparison                  │
├─────────────────────────────────────────┤
│ Speed     ████████░░ 2.6 (+0.6)        │
│ Cargo     ██████████ 1500 (+500)       │
│ Health    ████████░░ 200 (+100)        │
│ Damage    ██░░░░░░░░ 25 (+25)           │
│ Range     ██░░░░░░░░ 50 (+10)           │
│ Power     ████████░░ 80% (-20%)         │
│                                         │
│ vs Base Hull: [▲Better] [▼Worse] [─Same]│
└─────────────────────────────────────────┘
```

#### 6. Technical Implementation Guidelines

##### Frontend Architecture
```
src/
├── ship-editor/
│   ├── components/
│   │   ├── ShipEditor.tsx        # Main editor container
│   │   ├── ComponentLibrary.tsx  # Drag source for modules
│   │   ├── ShipGrid.tsx         # Main building grid
│   │   ├── PerformanceDashboard.tsx # Stats display
│   │   └── TemplateManager.tsx   # Save/load system
│   ├── hooks/
│   │   ├── useShipBuilder.ts    # Ship building logic
│   │   ├── useDragDrop.ts       # Drag and drop handling
│   │   └── usePerformance.ts    # Performance calculations
│   ├── types/
│   │   ├── ship.types.ts        # Ship and module interfaces
│   │   ├── template.types.ts    # Template system types
│   │   └── editor.types.ts      # Editor-specific types
│   └── utils/
│       ├── shipCalculations.ts  # Performance calculations
│       ├── gridUtils.ts         # Grid manipulation
│       └── connectionRouting.ts  # Power line routing
```

##### Database Schema Updates
```sql
-- Ship templates table
CREATE TABLE ship_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  hull_config TEXT NOT NULL, -- JSON
  modules TEXT NOT NULL,     -- JSON array
  stats TEXT NOT NULL,       -- JSON
  author_id TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  rating REAL DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES players(id)
);

-- Component definitions table
CREATE TABLE component_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stats TEXT NOT NULL,       -- JSON
  cost INTEGER NOT NULL,
  unlock_level INTEGER DEFAULT 1
);

-- Player ship configurations
ALTER TABLE players ADD COLUMN ship_template_id TEXT;
ALTER TABLE players ADD COLUMN hull_config TEXT; -- JSON
```

##### API Endpoints
```typescript
// Ship editor endpoints
POST /api/ship/validate        // Validate ship configuration
POST /api/ship/calculate-stats // Calculate performance stats
POST /api/ship/save-template   // Save ship template
GET  /api/ship/templates       // Get available templates
GET  /api/ship/components      // Get component definitions
POST /api/ship/apply-design    // Apply design to player ship

// Template sharing endpoints
GET  /api/templates/community  // Get community templates
POST /api/templates/upload     // Share template
GET  /api/templates/:id        // Get specific template
POST /api/templates/:id/rate   // Rate a template
```

##### Performance Considerations
- **Grid Rendering**: Use HTML5 Canvas with efficient dirty rectangle updates
- **Drag Performance**: Debounce drag events and use requestAnimationFrame
- **Statistics**: Cache calculated stats and update only when modules change
- **Template Loading**: Implement pagination for large template libraries
- **Mobile Support**: Responsive grid system with touch-friendly controls

#### 7. User Experience Flow

##### New Player Onboarding
1. **Tutorial Mode**: Guided tour of ship editor interface
2. **Starter Templates**: Pre-built ships for immediate play
3. **Progressive Unlocks**: Components unlock as player levels up
4. **Helper Tooltips**: Contextual help for all editor functions

##### Power User Features
- **Keyboard Shortcuts**: Hotkeys for common operations
- **Batch Operations**: Select and modify multiple modules
- **Design Validation**: Real-time error checking and suggestions
- **Performance Optimization**: Auto-optimize button for different goals
- **Import/Export**: JSON-based design sharing outside the game

### CSS Styling Specifications for Ship Editor

#### Core Theme Variables
```css
:root {
  /* Ship Editor Color Palette */
  --editor-bg-primary: #0a1931;
  --editor-bg-secondary: #1a2b4a;
  --editor-bg-tertiary: #243456;
  --editor-border-primary: rgba(100, 200, 255, 0.3);
  --editor-border-secondary: rgba(100, 200, 255, 0.15);
  --editor-accent: #00d4ff;
  --editor-accent-hover: #33e0ff;
  --editor-text-primary: #ffffff;
  --editor-text-secondary: rgba(255, 255, 255, 0.7);
  --editor-text-muted: rgba(255, 255, 255, 0.5);
  
  /* Grid System */
  --grid-size: 32px;
  --grid-line: rgba(100, 200, 255, 0.1);
  --grid-snap: rgba(0, 212, 255, 0.3);
  
  /* Component Colors */
  --component-engine: #ff6b35;
  --component-cargo: #4ecdc4;
  --component-weapon: #ff4757;
  --component-shield: #5352ed;
  --component-power: #feca57;
  --component-utility: #48ca5e;
  --component-structure: #747d8c;
  
  /* Status Colors */
  --status-valid: #2ed573;
  --status-warning: #ffa502;
  --status-error: #ff3742;
  --status-neutral: #747d8c;
  
  /* Power Flow */
  --power-high: #2ed573;
  --power-medium: #ffa502;
  --power-low: #ff3742;
  --power-inactive: #474747;
}
```

#### Ship Editor Layout Components

##### Main Editor Container
```css
.ship-editor {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--editor-bg-primary);
  display: grid;
  grid-template-areas: 
    "header header header"
    "sidebar main-editor dashboard"
    "templates templates templates";
  grid-template-rows: 60px 1fr 120px;
  grid-template-columns: 300px 1fr 350px;
  gap: 1px;
  font-family: 'Segoe UI', sans-serif;
  color: var(--editor-text-primary);
  z-index: 1000;
}

.editor-header {
  grid-area: header;
  background: linear-gradient(135deg, var(--editor-bg-secondary), var(--editor-bg-tertiary));
  border-bottom: 1px solid var(--editor-border-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  backdrop-filter: blur(10px);
}

.editor-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--editor-accent);
  display: flex;
  align-items: center;
  gap: 12px;
}

.editor-actions {
  display: flex;
  gap: 10px;
}

.editor-btn {
  background: linear-gradient(135deg, var(--editor-bg-secondary), var(--editor-bg-tertiary));
  border: 1px solid var(--editor-border-primary);
  color: var(--editor-text-primary);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.editor-btn:hover {
  border-color: var(--editor-accent);
  background: linear-gradient(135deg, var(--editor-bg-tertiary), var(--editor-bg-secondary));
  transform: translateY(-1px);
}

.editor-btn.primary {
  background: linear-gradient(135deg, var(--editor-accent), #0099cc);
  border-color: var(--editor-accent);
}

.editor-btn.primary:hover {
  background: linear-gradient(135deg, var(--editor-accent-hover), var(--editor-accent));
}
```

##### Component Library Sidebar
```css
.component-library {
  grid-area: sidebar;
  background: linear-gradient(135deg, var(--editor-bg-secondary), var(--editor-bg-tertiary));
  border-right: 1px solid var(--editor-border-primary);
  overflow-y: auto;
  padding: 20px;
}

.component-category {
  margin-bottom: 24px;
}

.category-header {
  font-size: 14px;
  font-weight: 600;
  color: var(--editor-accent);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--editor-border-secondary);
}

.component-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.component-item {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--editor-border-secondary);
  border-radius: 8px;
  padding: 12px;
  cursor: grab;
  transition: all 0.2s ease;
  position: relative;
}

.component-item:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--editor-border-primary);
  transform: translateX(4px);
}

.component-item.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.component-name {
  font-weight: 600;
  color: var(--editor-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.component-stats {
  font-size: 12px;
  color: var(--editor-text-muted);
  display: flex;
  justify-content: space-between;
}

.component-cost {
  color: var(--editor-accent);
  font-weight: 600;
}

/* Component Type Colors */
.component-item[data-category="propulsion"] {
  border-left: 4px solid var(--component-engine);
}

.component-item[data-category="cargo"] {
  border-left: 4px solid var(--component-cargo);
}

.component-item[data-category="combat"] {
  border-left: 4px solid var(--component-weapon);
}

.component-item[data-category="power"] {
  border-left: 4px solid var(--component-power);
}

.component-item[data-category="utility"] {
  border-left: 4px solid var(--component-utility);
}
```

##### Main Ship Grid Editor
```css
.ship-grid-container {
  grid-area: main-editor;
  background: var(--editor-bg-primary);
  position: relative;
  overflow: hidden;
}

.ship-grid {
  width: 100%;
  height: 100%;
  background-image: 
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: var(--grid-size) var(--grid-size);
  position: relative;
  overflow: auto;
}

.ship-hull-outline {
  position: absolute;
  border: 2px solid var(--editor-accent);
  border-radius: 12px;
  background: rgba(0, 212, 255, 0.05);
  pointer-events: none;
  transition: all 0.3s ease;
}

.ship-hull-outline.small {
  width: calc(15 * var(--grid-size));
  height: calc(10 * var(--grid-size));
}

.ship-hull-outline.medium {
  width: calc(25 * var(--grid-size));
  height: calc(15 * var(--grid-size));
}

.ship-hull-outline.large {
  width: calc(35 * var(--grid-size));
  height: calc(20 * var(--grid-size));
}

.ship-hull-outline.capital {
  width: calc(50 * var(--grid-size));
  height: calc(30 * var(--grid-size));
}

.placed-module {
  position: absolute;
  width: var(--grid-size);
  height: var(--grid-size);
  border: 2px solid;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.placed-module:hover {
  transform: scale(1.05);
  z-index: 10;
}

.placed-module.selected {
  box-shadow: 0 0 0 3px var(--editor-accent);
}

.placed-module[data-type="engine"] {
  background: var(--component-engine);
  border-color: var(--component-engine);
  color: white;
}

.placed-module[data-type="cargo"] {
  background: var(--component-cargo);
  border-color: var(--component-cargo);
  color: white;
}

.placed-module[data-type="weapon"] {
  background: var(--component-weapon);
  border-color: var(--component-weapon);
  color: white;
}

.placed-module[data-type="shield"] {
  background: var(--component-shield);
  border-color: var(--component-shield);
  color: white;
}

.placed-module[data-type="power"] {
  background: var(--component-power);
  border-color: var(--component-power);
  color: black;
}

.placed-module[data-type="utility"] {
  background: var(--component-utility);
  border-color: var(--component-utility);
  color: white;
}

.power-connection {
  position: absolute;
  pointer-events: none;
  z-index: 5;
}

.power-line {
  stroke-width: 3;
  opacity: 0.8;
  transition: all 0.3s ease;
}

.power-line.high-efficiency {
  stroke: var(--power-high);
  filter: drop-shadow(0 0 4px var(--power-high));
}

.power-line.medium-efficiency {
  stroke: var(--power-medium);
  filter: drop-shadow(0 0 4px var(--power-medium));
}

.power-line.low-efficiency {
  stroke: var(--power-low);
  filter: drop-shadow(0 0 4px var(--power-low));
}

.power-line.inactive {
  stroke: var(--power-inactive);
  opacity: 0.3;
}

.drop-zone {
  position: absolute;
  border: 2px dashed var(--grid-snap);
  background: rgba(0, 212, 255, 0.1);
  border-radius: 6px;
  display: none;
  width: var(--grid-size);
  height: var(--grid-size);
}

.drop-zone.active {
  display: block;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.7; }
}
```

##### Performance Dashboard
```css
.performance-dashboard {
  grid-area: dashboard;
  background: linear-gradient(135deg, var(--editor-bg-secondary), var(--editor-bg-tertiary));
  border-left: 1px solid var(--editor-border-primary);
  padding: 20px;
  overflow-y: auto;
}

.dashboard-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--editor-border-secondary);
}

.dashboard-section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--editor-accent);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-item {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--editor-border-secondary);
  border-radius: 6px;
  padding: 12px;
}

.stat-label {
  font-size: 11px;
  color: var(--editor-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: var(--editor-accent);
}

.stat-change {
  font-size: 12px;
  margin-left: 6px;
}

.stat-change.positive {
  color: var(--status-valid);
}

.stat-change.negative {
  color: var(--status-error);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-fill.power {
  background: linear-gradient(90deg, var(--power-high), var(--power-medium), var(--power-low));
}

.progress-fill.integrity {
  background: linear-gradient(90deg, var(--status-valid), var(--status-warning), var(--status-error));
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-item {
  background: rgba(255, 167, 2, 0.1);
  border: 1px solid var(--status-warning);
  border-radius: 6px;
  padding: 10px;
  font-size: 12px;
}

.warning-item.critical {
  background: rgba(255, 55, 66, 0.1);
  border-color: var(--status-error);
}

.warning-item.info {
  background: rgba(45, 213, 115, 0.1);
  border-color: var(--status-valid);
}
```

##### Template Library Footer
```css
.template-library {
  grid-area: templates;
  background: linear-gradient(135deg, var(--editor-bg-secondary), var(--editor-bg-tertiary));
  border-top: 1px solid var(--editor-border-primary);
  padding: 20px;
  overflow-x: auto;
}

.template-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.template-filters {
  display: flex;
  gap: 12px;
  align-items: center;
}

.template-select {
  background: var(--editor-bg-primary);
  border: 1px solid var(--editor-border-secondary);
  color: var(--editor-text-primary);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.template-grid {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.template-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--editor-border-secondary);
  border-radius: 8px;
  padding: 12px;
  min-width: 160px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  border-color: var(--editor-border-primary);
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.template-preview {
  width: 100%;
  height: 60px;
  background: var(--editor-bg-primary);
  border-radius: 4px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.template-name {
  font-weight: 600;
  color: var(--editor-text-primary);
  margin-bottom: 4px;
  font-size: 13px;
}

.template-stats {
  font-size: 11px;
  color: var(--editor-text-muted);
  display: flex;
  justify-content: space-between;
}

.template-rating {
  color: var(--editor-accent);
}
```

#### Responsive Design Considerations

##### Mobile and Tablet Adaptations
```css
@media (max-width: 1200px) {
  .ship-editor {
    grid-template-areas: 
      "header header"
      "main-editor dashboard"
      "templates templates";
    grid-template-columns: 1fr 300px;
  }
  
  .component-library {
    position: fixed;
    left: -320px;
    top: 60px;
    width: 320px;
    height: calc(100vh - 60px);
    z-index: 2000;
    transition: left 0.3s ease;
  }
  
  .component-library.open {
    left: 0;
  }
  
  .sidebar-toggle {
    display: block;
  }
}

@media (max-width: 768px) {
  .ship-editor {
    grid-template-areas: 
      "header"
      "main-editor"
      "templates";
    grid-template-columns: 1fr;
    grid-template-rows: 60px 1fr 100px;
  }
  
  .performance-dashboard {
    position: fixed;
    right: -360px;
    top: 60px;
    width: 360px;
    height: calc(100vh - 160px);
    z-index: 2000;
    transition: right 0.3s ease;
  }
  
  .performance-dashboard.open {
    right: 0;
  }
  
  .dashboard-toggle {
    display: block;
  }
  
  .template-library {
    height: 80px;
  }
}
```

#### Animation and Interaction Effects

##### Drag and Drop Animations
```css
@keyframes modulePickup {
  from {
    transform: scale(1) rotate(0deg);
  }
  to {
    transform: scale(1.1) rotate(2deg);
  }
}

@keyframes moduleDrop {
  from {
    transform: scale(1.1) rotate(2deg);
  }
  to {
    transform: scale(1) rotate(0deg);
  }
}

.component-item.picked-up {
  animation: modulePickup 0.2s ease;
}

.placed-module.just-placed {
  animation: moduleDrop 0.3s ease;
}

.invalid-placement {
  animation: shake 0.3s ease;
  border-color: var(--status-error) !important;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
```

##### Power Flow Animation
```css
.power-line {
  stroke-dasharray: 10, 5;
  animation: powerFlow 2s linear infinite;
}

@keyframes powerFlow {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: 15;
  }
}

.power-line.inactive {
  animation: none;
}
```

### Known Technical Debt
- Limited error handling for edge cases in multiplayer sync
- Enhanced input validation needed for WebSocket messages
- Performance optimization for high-concurrency scenarios
- Advanced monitoring alerts and dashboards
- Mobile responsiveness improvements

### Dependencies
```json
{
  "express": "^4.18.4",    // Web server framework
  "ws": "^8.17.0",         // WebSocket implementation
  "uuid": "^9.0.1"         // Unique identifier generation
}
```

## Quality Assurance

### Code Review Requirements
- All changes must go through pull request review
- Minimum one approval required for merge
- Automated checks must pass (linting, tests)
- Documentation must be updated for API changes

### Testing Strategy
- **Unit Tests:** Individual function testing (124+ tests passing)
  - Ship component effects calculations and property updates
  - Database operations and player management
  - WebSocket message validation and game logic
  - Galaxy system sector management and warp mechanics ✅
- **Integration Tests:** Component interaction testing  
  - Ship building system with real-time property updates
  - Client-server communication and state synchronization
  - Galaxy navigation and cross-sector persistence ✅
- **End-to-End Tests:** Full gameplay scenario testing
- **Performance Tests:** Load and stress testing for multiplayer
- **Test Coverage:** Comprehensive test suite with 124+ tests covering all major systems including galaxy exploration

### Deployment Process
- **Development:** Auto-deploy on push to develop branch
- **Staging:** Automated deployment for pre-production testing
- **Production:** Automated deployment to Render.com (Virginia region)
  - **Live URL:** https://starforgefrontier.onrender.com
  - **Health Check:** https://starforgefrontier.onrender.com/api/health
- **Monitoring:** Real-time health checks and performance monitoring
- **Rollback:** Zero-downtime rollback capabilities
- **Backup:** Automated database backup and restore system

## Security Considerations
- Input validation on all WebSocket messages
- Rate limiting for player actions
- Secure connection handling (WSS in production)
- Resource limits to prevent abuse

## Performance Targets
- **Server:** Handle 100+ concurrent players
- **Client:** Maintain 60fps on mid-range hardware
- **Network:** <100ms latency for player actions
- **Memory:** <500MB server memory usage

## Contributing Guidelines

### Before Starting Development
1. Check out develop branch: `git checkout develop`
2. Create feature branch: `git checkout -b feature/your-feature-name`
3. Install dependencies: `npm install`
4. Start development server: `npm start`

### Development Checklist
- [ ] Code follows project style guidelines
- [ ] Unit tests written for new functionality
- [ ] Documentation updated for API changes
- [ ] Manual testing completed
- [ ] Performance impact assessed
- [ ] Security implications reviewed

### Pull Request Process
1. Push feature branch to remote
2. Create pull request targeting develop branch
3. Fill out PR template with changes description
4. Request review from team members
5. Address feedback and update code
6. Merge after approval and passing checks

## Troubleshooting

### Common Issues
- **Port 3000 in use:** Change PORT environment variable
- **WebSocket connection failed:** Check server status and firewall
- **Missing dependencies:** Run `npm install`
- **Game lag:** Check network connection and server performance

### Debug Mode
Set `NODE_ENV=development` for additional logging and debug features.

### Health Monitoring
Production health logs are available in `logs/` directory.
Use `/Users/mattrogers/Documents/Spaghetti/scripts/production-health-monitor.sh` for status checks.

---

---

## CI/CD Pipeline Status

### GitHub Actions Workflows
- ✅ **CI Pipeline:** Automated testing on all PRs and pushes
- ✅ **Deployment:** Automated production deployment to Render.com
- ✅ **Security Scanning:** Trivy vulnerability scanning
- ✅ **Quality Gates:** Code quality checks and test coverage

### Production Deployment
- **Platform:** Render.com (Virginia region)
- **Database:** SQLite with automated backups
- **Monitoring:** Prometheus + Grafana dashboards
- **Health Checks:** Automated endpoint monitoring
- **SSL/TLS:** Automatic HTTPS with Let's Encrypt

### Development Workflow
1. Create feature branch from `main`
2. Implement changes with tests
3. Push triggers CI pipeline (107 tests)
4. Create PR with automated checks
5. Merge triggers production deployment
6. Health checks verify deployment success

---

**Last Updated:** 2025-08-10  
**Maintained By:** GitOps Orchestrator Agent  
**Version:** 2.1.0 - Agent Review Process Implementation  
**Latest Changes:** 
- ✅ PR #39: Critical UI Fix successfully merged after comprehensive agent review
- ✅ Gaming-standard transparent HUD system implemented (85% screen visibility restored)
- 🔄 PR #35: Server Performance Optimization - awaiting fixes (Issue #45)
- 🔄 PR #33: Environmental Hazards System - needs test coverage (Issue #46)
- ✅ Agent Review Process operational with specialized reviews
- ✅ GitHub Issues created for tracking PR development requirements