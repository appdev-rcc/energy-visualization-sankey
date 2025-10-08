# Energy Sankey Visualization Library

A modern TypeScript library for creating interactive Sankey diagrams that visualize energy flows from sources to
consumption sectors. Built with event-driven architecture, comprehensive type safety, and optimized for smooth animation
across historical energy data.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Data Format](#data-format)
- [Architecture](#architecture)
- [Development](#development)
- [Examples](#examples)
- [Browser Support](#browser-support)
- [Contributing](#contributing)
- [License](#license)

## Overview

This library transforms complex energy consumption data into interactive, animated flow diagrams using D3.js v7. It
visualizes energy flows from sources (solar, nuclear, coal, etc.) to consumption sectors (residential, industrial,
transportation, etc.) with smooth timeline animations and comprehensive user controls.

### Key Capabilities

- **Interactive Energy Flow Visualization**: Real-time Sankey diagrams showing energy source-to-consumption
  relationships
- **Timeline Animation**: Smooth animation across decades of historical energy data
- **Event-Driven Architecture**: Decoupled services communicating through type-safe events
- **Mobile Responsive**: Touch-optimized controls and responsive layouts
- **Accessibility Support**: Full keyboard navigation and screen reader compatibility
- **Mathematical Accuracy**: Precise energy flow calculations following EIA standards

## Features

### Core Features

- **Multiple Energy Sources**: Solar, nuclear, hydro, wind, geothermal, natural gas, coal, biomass, petroleum
- **Sectoral Analysis**: Electricity, residential, agriculture, industrial, transportation
- **Waste Heat Visualization**: Thermodynamically accurate waste heat calculations
- **Historical Timeline**: Animated progression through energy data with user controls
- **Interactive Elements**: Hover tooltips, click selection, play/pause controls

### Technical Features

- **TypeScript**: Full type safety with comprehensive interfaces
- **Event-Driven**: Services communicate through type-safe event bus
- **Modular Architecture**: Clean separation of concerns with focused services
- **Performance Optimized**: Caching and efficient rendering
- **Multiple Build Formats**: ESM, UMD, standalone versions available

### User Experience

- **Animation Controls**: Play, pause, speed adjustment, year scrubbing
- **Keyboard Navigation**: Full accessibility with keyboard shortcuts
- **Mobile Support**: Touch gestures and responsive design
- **Waste Heat Toggle**: Show/hide electricity waste heat flows

## Installation

### NPM Installation

```bash
npm install energy-visualization-sankey
```

### Direct Browser Usage

For quick prototyping or simple integration, use the standalone build that includes D3:

```html
<!-- Standalone UMD (compatible with older browsers) -->
<script src="https://cdn.jsdelivr.net/npm/energy-visualization-sankey@1.0.1/dist/sankey.standalone.esm.js"></script>
<script>
    const sankey = new Sankey('container', options);
</script>
```

### With External D3

If you already have D3 v7 in your project:

```html

<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/energy-visualization-sankey@1.0.1/dist/sankey.umd.js"></script>
```

## Quick Start

### Basic Example

```typescript
import Sankey from 'energy-visualization-sankey';

// Load your energy data
const energyData = [
    {
        year: 2020,
        milestone: "Renewable energy growth",
        solar: {elec: 131, res: 0, ag: 0, indus: 0, trans: 0},
        nuclear: {elec: 843, res: 0, ag: 0, indus: 0, trans: 0},
        hydro: {elec: 259, res: 0, ag: 0, indus: 0, trans: 0},
        wind: {elec: 380, res: 0, ag: 0, indus: 0, trans: 0},
        geo: {elec: 18, res: 5, ag: 0, indus: 0, trans: 0},
        gas: {elec: 1624, res: 187, ag: 12, indus: 442, trans: 3},
        coal: {elec: 774, res: 0, ag: 0, indus: 65, trans: 0},
        bio: {elec: 56, res: 21, ag: 0, indus: 135, trans: 140},
        petro: {elec: 17, res: 89, ag: 23, indus: 456, trans: 2456},
        elec: {elec: 0, res: 1539, ag: 18, indus: 1059, trans: 26},
        waste: {elec: 0, res: 0, ag: 0, indus: 0, trans: 0}
    }
    // ... more years
];

// Create the visualization
const sankey = new Sankey('sankey-container', {
    data: energyData,
    country: "U.S.",
    includeControls: true,
    includeTimeline: true,
    includeWasteToggle: true,
    autoPlay: false,
    showWasteHeat: true,
    animationSpeed: 200,
    loopAnimation: false
});
```

### HTML Structure

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="./src/styles/sankey.css">
    <link rel="stylesheet" href="./src/styles/controls.css">
</head>
<body>
<div id="sankey-container"></div>

<script type="module">
    import Sankey from 'https://cdn.jsdelivr.net/npm/energy-visualization-sankey@1.0.1/dist/sankey.standalone.esm.js';
    // Initialize as shown above
</script>
</body>
</html>
```

## API Reference

### Constructor

```
new Sankey(container: string | HTMLElement, options: SankeyOptions)
```

### SankeyOptions Interface

```typescript
interface SankeyOptions {
    data: EnergyDataPoint[];           // Required: Energy flow data
    country: string;                   // Required: Country identifier
    includeControls?: boolean;         // Show play/pause controls (default: true)
    includeTimeline?: boolean;         // Show timeline slider (default: true)
    includeWasteToggle?: boolean;      // Show waste heat toggle (default: true)
    autoPlay?: boolean;                // Start animation automatically (default: false)
    showWasteHeat?: boolean;           // Show waste heat flows (default: true)
    animationSpeed?: number;           // Animation speed in ms (default: 200)
    width?: number | null;             // Container width (null = dynamic)
    height?: number;                   // Container height (default: 620)
    loopAnimation?: boolean;           // Loop animation (default: false)
    debugLogging?: boolean;            // Enable debug logging (default: false)
}
```

### Public Methods

#### Animation Control

- `play(): this` - Start timeline animation
- `pause(): this` - Pause timeline animation
- `setYear(year: number): this` - Navigate to specific year
- `setSpeed(speed: number): this` - Set animation playback speed (milliseconds per year)

#### State Query

- `getCurrentYear(): number` - Get currently displayed year
- `isPlaying(): boolean` - Check if animation is running
- `isInitialized(): boolean` - Check if visualization is ready
- `getYears(): readonly number[]` - Get all available years

#### Feature Control

- `toggleWasteHeat(): this` - Toggle waste heat flow visibility
- `isWasteHeatVisible(): boolean` - Check waste heat visibility state

#### Lifecycle

- `destroy(): void` - Clean up resources and DOM elements

#### Development/Testing

- `getDataService(): DataService` - Access internal data service (for testing)

### Method Chaining

All control methods return `this` for fluent API usage:

```typescript
sankey
    .setYear(1950)
    .setSpeed(100)
    .play();
```

## Data Format

Energy data must follow this structure with all required properties:

### EnergyDataPoint Interface

```typescript
interface EnergyDataPoint {
    year: number;                    // Required: Year for this data point
    milestone?: string;              // Optional: Historical context

    // Energy Sources (all required with sector breakdown)
    solar: EnergySectorBreakdown;
    nuclear: EnergySectorBreakdown;
    hydro: EnergySectorBreakdown;
    wind: EnergySectorBreakdown;
    geo: EnergySectorBreakdown;      // Geothermal
    gas: EnergySectorBreakdown;      // Natural gas
    coal: EnergySectorBreakdown;
    bio: EnergySectorBreakdown;      // Biomass
    petro: EnergySectorBreakdown;    // Petroleum

    // Special categories
    elec: EnergySectorBreakdown;     // Electricity distribution
    waste: EnergySectorBreakdown;    // Waste heat
    heat: EnergySectorBreakdown;     // Direct heat (optional)
}

interface EnergySectorBreakdown {
    elec: number;    // Electricity generation
    res: number;     // Residential/Commercial
    ag: number;      // Agriculture
    indus: number;   // Industrial
    trans: number;   // Transportation
    heat: number;    // Direct heat applications (optional in some datasets)
}
```

### Example Data Structure

```
{
  "year": 2020,
  "milestone": "COVID-19 pandemic impact on energy consumption",
  "solar": { "elec": 131, "res": 0, "ag": 0, "indus": 0, "trans": 0 },
  "nuclear": { "elec": 843, "res": 0, "ag": 0, "indus": 0, "trans": 0 },
  "hydro": { "elec": 259, "res": 0, "ag": 0, "indus": 0, "trans": 0 },
  "wind": { "elec": 380, "res": 0, "ag": 0, "indus": 0, "trans": 0 },
  "geo": { "elec": 18, "res": 5, "ag": 0, "indus": 0, "trans": 0 },
  "gas": { "elec": 1624, "res": 187, "ag": 12, "indus": 442, "trans": 3 },
  "coal": { "elec": 774, "res": 0, "ag": 0, "indus": 65, "trans": 0 },
  "bio": { "elec": 56, "res": 21, "ag": 0, "indus": 135, "trans": 140 },
  "petro": { "elec": 17, "res": 89, "ag": 23, "indus": 456, "trans": 2456 },
  "elec": { "elec": 0, "res": 1539, "ag": 18, "indus": 1059, "trans": 26 },
  "waste": { "elec": 0, "res": 0, "ag": 0, "indus": 0, "trans": 0 }
}
```

## Architecture

The library uses a clean, event-driven architecture with focused service layers:

### Service Overview

```
Sankey (Main Orchestrator)
├── EventBus (Type-safe communication hub)
├── ConfigurationService (Mathematical constants & visual settings)
├── DataValidationService (Input validation & structure verification)
├── DataService (Data access, sorting & navigation)
├── SummaryService (Energy totals calculation with caching)
├── GraphService (Flow positioning & coordinate calculations)
├── RenderingService (SVG generation & D3.js integration)
├── AnimationService (Timeline management & user controls)
└── InteractionService (User input & accessibility)
```

### Key Architectural Benefits

- **Event-Driven Communication**: Services communicate through typed events, enabling loose coupling
- **Dependency Injection**: Services receive dependencies explicitly through constructors
- **Immutable Data**: All data structures are immutable for safety and predictability
- **Type Safety**: Comprehensive TypeScript coverage with 15+ interface definitions
- **Memory Management**: Automatic cleanup and resource management
- **Performance Optimization**: Strategic caching in calculation services

### Build Outputs

The library provides multiple build formats:

| Build Type         | File                       | Use Case                        | D3 Included |
|--------------------|----------------------------|---------------------------------|-------------|
| **ES Module**      | `sankey.esm.js`            | Modern bundlers (Webpack, Vite) | No          |
| **UMD**            | `sankey.umd.js`            | Browser script tag              | No          |
| **UMD Minified**   | `sankey.umd.min.js`        | Production browser              | No          |
| **Standalone ES**  | `sankey.standalone.esm.js` | Modern browsers, no bundler     | Yes         |
| **Standalone UMD** | `sankey.standalone.umd.js` | Any browser environment         | Yes         |
| **Standalone Min** | `sankey.standalone.min.js` | Production, no bundler          | Yes         |

## Development

### Building from Source

```bash
# Clone the repository
cd sankey

# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build (all formats)
npm run build

# Type checking only
npm run type-check

# Clean build artifacts
npm run clean
```

### Testing

```bash
# Run all tests
npm test

# Run numerical validation tests
npm run test:numerical

# Run visual validation tests (requires browser)
npm run test:visual

# Run performance validation
npm run test:performance

# Full validation suite
npm run validate:full
```

### Development Server

```bash
# Start local development server
npm run serve

# Navigate to http://localhost:8080/examples/data-us.html
```

### Project Structure

```
src/
├── core/
│   ├── Sankey.ts    # Main orchestrator class
│   ├── events/
│   │   └── EventBus.ts           # Event communication system
│   └── types/
│       └── events.ts             # Event type definitions
├── services/
│   ├── ConfigurationService.ts   # Constants & settings
│   ├── data/
│   │   ├── DataService.ts        # Data access & navigation
│   │   └── DataValidationService.ts # Input validation
│   ├── calculation/
│   │   ├── SummaryService.ts     # Energy totals calculation
│   │   └── GraphService.ts       # Flow positioning algorithms
│   ├── RenderingService.ts       # SVG generation & D3 integration
│   ├── AnimationService.ts       # Timeline management
│   └── InteractionService.ts     # User input handling
├── styles/
│   ├── sankey.css               # Main visualization styles
│   └── controls.css             # Control panel styles
├── types/
│   └── index.ts                 # Public type definitions
├── utils/
│   └── Logger.ts               # Logging utilities
└── index.ts                    # Public API exports
```

## Browser Support

| Browser           | Minimum Version | Notes                                   |
|-------------------|-----------------|-----------------------------------------|
| **Chrome**        | 88+             | Full support with hardware acceleration |
| **Firefox**       | 85+             | Full support                            |
| **Safari**        | 14+             | Full support                            |
| **Edge**          | 88+             | Full support                            |
| **Mobile Safari** | 14+             | Touch-optimized interactions            |
| **Chrome Mobile** | 88+             | Touch and gesture support               |

### Requirements

- **ES Modules Support**: For standalone ESM builds
- **D3.js v7 Compatible**: Uses modern D3 APIs
- **TypeScript 5.3+**: For development and type definitions
- **Modern JavaScript**: ES2018+ features used

## Contributing

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/appdev-rcc/energy-visualization-sankey.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature`
5. Make your changes with tests
6. Run the full test suite: `npm run validate:full`
7. Submit a pull request

### Contribution Guidelines

- **Code Style**: Follow TypeScript best practices with existing ESLint configuration
- **Testing**: Maintain test coverage for new features
- **Performance**: Benchmark changes against existing performance
- **Documentation**: Update README and inline documentation for API changes
- **Types**: Ensure full TypeScript coverage for public APIs

### Reporting Issues

When reporting issues, include:

- Browser and version
- Dataset size and structure
- Steps to reproduce
- Console errors (if any)
- Expected vs actual behavior

## License

MIT License. See [LICENSE](LICENSE) file for details.

---

**Developed by the Research Computing Center (RCC), University of Chicago**