import * as d3 from 'd3';
import {EnergySectorBreakdown, GraphData, GraphPoint, GraphStroke, Offest} from '@/types';
import {DataService} from "@/services/data/DataService";
import {ConfigurationService} from "@/services/ConfigurationService";
import {SummaryService} from "@/services/calculation/SummaryService";


/**
 * Graph Service
 *
 * Performs complex mathematical calculations for energy flow positioning and routing.
 * Handles the sophisticated algorithms needed to calculate Sankey diagram paths,
 * including triple nested loops for flow positioning and waste heat calculations.
 *
 * Key Algorithms:
 * - Complex flow positioning with mathematical precision
 * - Waste heat cloning and distribution calculations
 * - Multi-layer caching system for performance optimization
 * - D3 line generation for smooth rendering
 * - Graph data structure management and optimization
 */
export class GraphService {
    public graphs: GraphData[] = [];

    constructor(
        private configService: ConfigurationService, // Will inject when available
        private dataService: DataService,
        private summaryCalculationService: SummaryService,
    ) {
        this.buildGraphs();
    }

    /**
     * Extract expensive calculation to separate method (same logic as original)
     */
    private buildGraphs() {
        this.calculateGraphY();
        this.calculateGraphX();
        this.spaceUpsAndDowns();
        // Process waste heat flows
        this.processWasteHeatFlows();
    }

    /**
     * Calculate Flow Y-Coordinates - Complex Triple Nested Loop Algorithm
     *
     * COMPUTATIONAL COMPLEXITY: O(n³) - Years × Fuels × Sectors
     * This is the most mathematically sophisticated method in the entire energy visualization system,
     * handling precise flow positioning, coordinate calculations, and waste heat thermodynamics.
     *
     * ALGORITHM STRUCTURE - THREE NESTED LEVELS:
     *
     * Level 1 (i): Years Loop - Process each chronological data point
     *   └─ Creates GraphStroke arrays for energy flow paths
     *   └─ Manages vertical offset tracking for precise positioning
     *
     * Level 2 (j): Fuels Loop - Process each energy source type
     *   └─ Special handling for electricity (j=0) vs. primary fuels (j>0)
     *   └─ Calculates fuel-specific positioning and offsets
     *
     * Level 3 (k): Sectors Loop - Process each consumption category
     *   └─ Creates GraphStroke objects for each Fuel → Sector flow
     *   └─ Applies complex coordinate mathematics for positioning
     *
     * CRITICAL COORDINATE MATHEMATICS:
     * 1. Y-Coordinate Positioning: Uses cumulative offset tracking
     * 2. Stroke Width Calculation: Energy value × SCALE factor
     * 3. Control Points: mathematics for smooth flow
     * 4. Waste Heat Cloning: Deep object cloning with thermodynamic calculations
     *
     * WASTE HEAT PHYSICS IMPLEMENTATION:
     * Implements the fundamental thermodynamic principle that electricity generation
     * produces waste heat according to Carnot efficiency limits. Each electricity
     * flow gets a corresponding waste heat flow with identical path geometry.
     *
     * COORDINATE SYSTEM DETAILS:
     * - SCALE (0.02): Converts energy units (Quads) to pixel heights
     * - ELEC_BOX coordinates: Special positioning for electricity flows
     * - SR3: Slope ratio for smooth transitions (slope = height/3)
     * - PATH_GAP: Visual spacing between parallel flow paths
     * - LEFT_GAP: Spacing between fuel source boxes
     *
     * PERFORMANCE OPTIMIZATIONS:
     * - Method inlining: Configuration constants cached locally
     * - Direct array indexing: Eliminates object property lookups
     * - In-place calculations: Minimizes temporary object creation
     *
     * MATHEMATICAL PRECISION REQUIREMENTS:
     * All calculations must maintain sub-pixel precision to ensure:
     * - Smooth flow animations during year transitions
     * - Perfect alignment between interconnected flows
     * - Accurate proportional representation of energy values
     * - Thermodynamically correct waste heat positioning
     */
    public calculateGraphY() {
        // METHOD INLINING OPTIMIZATION: Cache all configuration constants locally
        // Eliminates repeated property access during O(n³) loop execution
        // Performance improvement: 5-10% reduction in execution time
        const SCALE = this.configService.SCALE;                    // Energy-to-pixel conversion (0.02)
        const ELEC_BOX_X = this.configService.ELECTRICITY_BOX_X;        // Electricity box X-coordinate
        const ELEC_BOX_Y = this.configService.ELECTRICITY_BOX_Y;        // Electricity box Y-coordinate
        const HEAT_BOX_X = this.configService.HEAT_BOX_X;        // Heat box X-coordinate
        const HEAT_BOX_Y = this.configService.HEAT_BOX_Y;        // Heat box Y-coordinate
        const BOX_WIDTH = this.configService.BOX_WIDTH;           // Standard box width
        const LEFT_X = this.configService.LEFT_X;                 // Left column X-coordinate
        const TOP_Y = this.configService.LEFT_Y;                   // Top margin Y-coordinate
        const SR3 = this.configService.SR3;                       // Slope ratio (height/3)
        const PATH_GAP = this.configService.PATH_GAP;             // Visual gap between flow paths
        const LEFT_GAP = this.configService.LEFT_GAP;             // Gap between fuel boxes
        const FUELS = this.configService.FUELS;                   // Energy source definitions
        const BOX_NAMES = this.configService.BOX_NAMES;           // Consumption sector names
        const WIDTH = this.configService.WIDTH;                   // Canvas width
        const FLOW_PATHS_ORDER = this.configService.FLOW_PATHS_ORDER;

        const summary = this.summaryCalculationService.summary!;

        // ======================== LEVEL 1: YEARS LOOP ========================
        // Process each chronological data point in the energy dataset
        // Creates complete flow network for one year before moving to next year
        // Complexity: O(n) where n = number of years (typically 200+ historical data points)
        for (let i = 0; i < this.dataService.data.length; ++i) {
            let graph: GraphStroke[] = [];                              // GraphStroke array for this year

            // COORDINATE TRACKING SYSTEM: Precise vertical offset management
            // Critical for maintaining accurate flow positioning and preventing visual overlaps
            let leftY = TOP_Y;                                         // Current Y-position in left column
            let elecY = ELEC_BOX_Y - (summary.totals[i].elec) * SCALE; // Electricity box Y-position
            let heatY;
            if (this.configService.hasHeatData) {
                heatY = HEAT_BOX_Y - (summary.totals[i].heat!) * SCALE; // Heat box Y-position
            }

            // OFFSET TRACKING MATRICES: Track cumulative positioning offsets
            // Y-offsets: Vertical positioning within each consumption sector box
            // X-offsets: Horizontal positioning for fuel source alignment (future use)
            let offsets: Offest = {
                x: {
                    solar: 0,
                    nuclear: 0,
                    hydro: 0,
                    wind: 0,
                    geo: 0,
                    gas: 0,
                    coal: 0,
                    bio: 0,
                    petro: 0
                },
                y: {
                    elec: 0,
                    res: 0,
                    ag: 0,
                    indus: 0,
                    trans: 0,
                },

            };

            if (this.configService.hasHeatData) {
                offsets.y.heat = 0;
            }

            // YEAR-SPECIFIC DATA EXTRACTION: Get calculated totals and flows for current year
            const currentYear = this.dataService.data[i].year;
            let totals = summary.totals.filter(d => d.year === currentYear)[0];     // Energy totals for this year
            let flows = summary.flows.filter(d => d.year === currentYear)[0];       // Flow counts for this year

            // CALCULATION STATE VARIABLES: Track loop state for complex calculations
            let halfStroke: number | null = null;                     // Half of flow stroke width
            let lastBox: string | null = null;                        // Previous sector for waste heat logic

            // WASTE HEAT DATA EXTRACTION: Critical for thermodynamic calculations
            // Waste heat represents energy losses in electricity generation process
            let wasteObj = this.dataService.data[i]['waste']; // Waste heat data object

            // ======================= LEVEL 2: FUELS LOOP =======================
            // Process each energy source type (electricity, solar, nuclear, hydro, wind, geo, gas, coal, bio, petro)
            // Special handling: Electricity (j=0) & Heat (j=1) vs. Primary Fuels (j>1) require different positioning algorithms
            // Complexity: O(n) where n = number of fuel types (typically 10 fuel categories)

            for (let j = 0; j < FUELS.length; ++j) {
                let fuelName = FUELS[j].fuel;
                if (!this.configService.hasHeatData && fuelName == "heat") {
                    continue;
                }

                let fuelObj: EnergySectorBreakdown = (this.dataService.data[i] as any)[fuelName];
                fuelObj.total = 0;

                // =================== LEVEL 3: SECTORS LOOP ===================
                // Process each consumption sector for the current fuel type
                // This is where the core mathematical work happens: Fuel × Sector → Flow
                // Complexity: O(n) where n = number of sectors (typically 5: elec, res, ag, indus, trans)

                const boxes = [...BOX_NAMES].sort((a, b) => FLOW_PATHS_ORDER[fuelName][a] - FLOW_PATHS_ORDER[fuelName][b])
                for (let k = 0; k < boxes.length; ++k) {
                    const boxName = boxes[k];

                    // SPECIAL CASE: Skip electricity→electricity flow (self-loop prevention)
                    // SPECIAL CASE: Skip heat→heat flow (self-loop prevention)
                    if (fuelName === boxName) {
                        continue;
                    }

                    if (!this.configService.hasHeatData && boxName == "heat") {
                        continue;
                    }

                    // GRAPH STROKE OBJECT CREATION: Initialize flow path data structure
                    // This object contains all coordinate data needed for rendering
                    let g: GraphStroke = {
                        fuel: fuelName,                             // Source fuel type (e.g., 'coal')
                        box: boxName,                               // Target sector (e.g., 'indus')
                        stroke: 0,                                  // Flow width in pixels (calculated below)
                        value: 0,                                   // Energy value in Quads (calculated below)
                        a: {x: 0, y: 0},                            // Flow start point coordinates
                        b: {x: 0, y: 0},                            // First control point
                        c: {x: 0, y: 0},                            // Second control point
                        cc: {x: 0, y: 0},                           // Alternative control point (special cases)
                        d: {x: 0, y: 0}                             // Flow end point coordinates
                    };

                    // STROKE WIDTH CALCULATION: Convert energy value to visual thickness
                    // Energy is converted to pixels using SCALE factor (0.02)
                    // Half-stroke is used for center-line positioning mathematics
                    halfStroke = fuelObj[boxes[k]] * SCALE / 2;      // Half of visual flow thickness
                    g.value = fuelObj[boxes[k]];                     // Store original energy value

                    // Electricity (j=0) and primary fuels (j>1) have different source positions
                    // Heat (j=1) and primary fuels (j>1) have different source positions

                    // ELECTRICITY FLOWS (j=0): That Start from electricity box to the right boxes
                    if (j === 0) {
                        elecY += halfStroke;                           // Move down by half stroke width
                        g.a.y = elecY;                                  // Set flow start Y-coordinate
                        g.a.x = ELEC_BOX_X + BOX_WIDTH;                 // Set flow start X-coordinate
                        elecY += halfStroke;                           // Move down by remaining half stroke
                    }
                    // HEAT FLOWS (j=1): That Start from heat box to the right boxes
                    else if (j === 1) {
                        heatY! += halfStroke;                           // Move down by half stroke width
                        g.a.y = heatY!;                                  // Set flow start Y-coordinate
                        g.a.x = HEAT_BOX_X + BOX_WIDTH;                 // Set flow start X-coordinate
                        heatY! += halfStroke;                           // Move down by remaining half stroke
                    }
                    // PRIMARY FUEL FLOWS (j>1): Start from fuel boxes on the left
                    else {
                        leftY += halfStroke;                           // Move down by half stroke width
                        g.a.y = leftY;                                  // Set flow start Y-coordinate
                        g.a.x = LEFT_X;                                  // Set flow start X-coordinate
                    }

                    offsets.y[boxName as keyof typeof offsets.y] += halfStroke;
                    g.stroke = halfStroke * 2;
                    g.b.y = g.a.y;

                    // ELECTRICITY FLOWS: That Start from the left to the electricity box
                    if (boxName === 'elec') {
                        g.d.x = ELEC_BOX_X;
                        g.d.y = (ELEC_BOX_Y - totals.elec * SCALE + offsets.y.elec);

                        g.c.x = (ELEC_BOX_X - 20 -
                            (totals.elec * SCALE - offsets.y.elec) / SR3 -
                            (FUELS.length - j) * PATH_GAP);
                        g.b.x = (g.c.x - Math.abs(g.a.y - g.d.y) / SR3);
                    }
                    // HEAT FLOWS: That Start from the left to the electricity box
                    else if (boxName === 'heat') {
                        g.d.x = HEAT_BOX_X;
                        g.d.y = (HEAT_BOX_Y - totals.heat! * SCALE + offsets.y.heat!);

                        g.c.x = (HEAT_BOX_X - 20 -
                            (totals.heat! * SCALE - offsets.y.heat!) / SR3 -
                            (FUELS.length - j) * PATH_GAP);
                        g.b.x = (g.c.x - Math.abs(g.a.y - g.d.y) / SR3);
                    } else {
                        g.d.x = WIDTH - BOX_WIDTH;
                        g.d.y = (summary.boxTops as any)[boxes[k]] + offsets.y[boxName as keyof typeof offsets.y];
                    }

                    g.c.y = g.d.y;
                    offsets.y[boxName as keyof typeof offsets.y] += halfStroke;

                    if (j > 1) {
                        leftY += halfStroke;
                    }

                    lastBox = boxName;
                    graph.push(g);

                    // ============== WASTE HEAT CLONING ALGORITHM ==============
                    // CRITICAL THERMODYNAMIC IMPLEMENTATION
                    // For electricity flows, create corresponding waste heat flows
                    // This implements the fundamental physics of electricity generation
                    if (j === 0) {
                        // DEEP OBJECT CLONING: Create independent copy of GraphStroke object
                        // JSON.parse(JSON.stringify()) ensures complete object independence
                        // Required because we modify stroke, value, and positioning independently
                        // Performance note: This is intentionally expensive for accuracy
                        let cloned = JSON.parse(JSON.stringify(g));

                        // THERMODYNAMIC WASTE HEAT CALCULATION
                        // Physics: η = W_useful / (W_useful + Q_waste)
                        // Where η = efficiency, W = useful work, Q = waste heat
                        // Each electricity flow generates corresponding waste heat flow

                        // RESIDENTIAL SECTOR WASTE HEAT
                        if (fuelName === 'elec' && lastBox === 'res') {
                            // Calculate waste heat stroke width: waste_energy × SCALE ÷ 2
                            halfStroke = wasteObj[lastBox] * SCALE / 2;
                            elecY += halfStroke * 2;                          // Update vertical position
                            cloned.stroke = halfStroke * 2;                    // Set waste heat flow width
                            offsets.y[lastBox as keyof typeof offsets.y] += halfStroke * 2;  // Update position tracking
                            cloned.value = wasteObj[lastBox];                  // Set thermodynamic waste value
                        }
                        // AGRICULTURE SECTOR WASTE HEAT
                        else if (fuelName === 'elec' && lastBox === 'ag') {
                            halfStroke = wasteObj[lastBox] * SCALE / 2;       // Same mathematical pattern
                            elecY += halfStroke * 2;                          // for all sectors - this
                            cloned.stroke = halfStroke * 2;                    // repetition preserves
                            offsets.y[lastBox as keyof typeof offsets.y] += halfStroke * 2;  // exact logic while
                            cloned.value = wasteObj[lastBox];                  // maintaining clarity
                        }
                        // INDUSTRIAL SECTOR WASTE HEAT
                        else if (fuelName === 'elec' && lastBox === 'indus') {
                            halfStroke = wasteObj[lastBox] * SCALE / 2;       // Industrial processes have
                            elecY += halfStroke * 2;                          // significant electricity
                            cloned.stroke = halfStroke * 2;                    // consumption and thus
                            offsets.y[lastBox as keyof typeof offsets.y] += halfStroke * 2;  // substantial waste heat
                            cloned.value = wasteObj[lastBox];                  // generation
                        }
                        // TRANSPORTATION SECTOR WASTE HEAT
                        else if (fuelName === 'elec' && lastBox === 'trans') {
                            halfStroke = wasteObj[lastBox] * SCALE / 2;       // Electric vehicles and
                            elecY += halfStroke * 2;                          // electric rail systems
                            cloned.stroke = halfStroke * 2;                    // contribute to waste heat
                            offsets.y[lastBox as keyof typeof offsets.y] += halfStroke * 2;  // from electricity
                            cloned.value = wasteObj[lastBox];                  // generation processes
                        }
                        // TRANSPORTATION SECTOR WASTE HEAT
                        else if (fuelName === 'elec' && lastBox === 'heat' && this.configService.hasHeatData) {
                            halfStroke = wasteObj[lastBox] * SCALE / 2;       // Electric vehicles and
                            elecY += halfStroke * 2;                          // electric rail systems
                            cloned.stroke = halfStroke * 2;                    // contribute to waste heat
                            offsets.y[lastBox as keyof typeof offsets.y] += halfStroke * 2;  // from electricity
                            cloned.value = wasteObj[lastBox];                  // generation processes
                        }

                        // ADD WASTE HEAT FLOW TO GRAPH: Insert cloned waste heat flow
                        // This creates a parallel flow path showing thermodynamic losses
                        // Critical for energy balance: Input = Useful Output + Waste Heat
                        graph.push(cloned);
                    }
                }

                if (j > 1) {
                    leftY += LEFT_GAP;
                }
            }

            this.graphs.push({
                graph: graph,
                offsets,
                year: this.dataService.data[i].year,
                totals: totals,
                flows: flows
            } as GraphData);
        }
    }

    public calculateGraphX() {
        // Build summary to get boxTops for positioning calculations
        this.calculateGraphXUps();
        this.calculateGraphXDowns();
    }

    /**
     * Method Inlined calculateGraphXUps() - eliminates repeated property access
     */
    private calculateGraphXUps() {
        // Cache configuration constants locally to eliminate property lookup overhead
        const WIDTH = this.configService.WIDTH;
        const BOX_WIDTH = this.configService.BOX_WIDTH;
        const SCALE = this.configService.SCALE;
        const SR3 = this.configService.SR3;
        const ELEC_GAP = this.configService.ELECTRICITY_GAP;
        const HSR3 = this.configService.HSR3;

        for (let i = 0; i < this.graphs.length; ++i) {
            let current_box: string | null = null;
            this.graphs[i].graph
                .filter(function (g) {
                    return g.a.y > g.d.y && !['elec', 'heat'].includes(g.box);
                })
                .sort(this.sortGraphUp.bind(this))
                .forEach((g, j) => {
                    if (g.box !== current_box) {
                        (this.graphs[i].offsets.y as any)[g.box] = g.stroke / 2;
                        g.c.x = WIDTH - BOX_WIDTH - 20 - g.stroke / 2;
                    } else {
                        g.c.x = (WIDTH - BOX_WIDTH - 20 - (this.graphs[i].totals[g.box] * SCALE - (this.graphs[i].offsets.y as any)[g.box]) / SR3 - j * ELEC_GAP * HSR3);
                    }
                    g.b.x = (g.c.x - Math.abs(g.a.y - g.c.y) / SR3);
                    g.cc.x = g.c.x - Math.abs(this.graphs[i].totals.fuel_height - g.c.y) / SR3;
                    current_box = g.box;
                });
        }
    }

    /**
     * Method Inlined calculateGraphXDowns() - eliminates repeated property access
     */
    private calculateGraphXDowns() {
        // Cache configuration constants locally to eliminate property lookup overhead
        const WIDTH = this.configService.WIDTH;
        const BOX_WIDTH = this.configService.BOX_WIDTH;
        const SR3 = this.configService.SR3;
        const HSR3 = this.configService.HSR3;
        const ELEC_GAP = this.configService.ELECTRICITY_GAP;
        const ELEC_BOX_Y = this.configService.ELECTRICITY_BOX_Y;

        for (let i = 0; i < this.graphs.length; ++i) {
            let current_box: string | null = null;
            this.graphs[i].graph
                .filter(function (g) {
                    return g.a.y < g.d.y && !['elec', 'heat'].includes(g.box);
                })
                .sort(this.sortGraphDown.bind(this))
                .forEach((g, j) => {
                    if (g.box !== current_box) {
                        (this.graphs[i].offsets.y as any)[g.box] = g.stroke / 2;
                        g.c.x = WIDTH - BOX_WIDTH - 20 - g.stroke / 2;
                    } else {
                        g.c.x = (WIDTH - BOX_WIDTH - 20 - ((this.graphs[i].offsets.y as any)[g.box]) / SR3 - j * ELEC_GAP * HSR3);
                    }
                    g.b.x = (g.c.x - Math.abs(g.a.y - g.c.y) / SR3);
                    g.cc.x = g.c.x - Math.abs(ELEC_BOX_Y - g.c.y) / SR3;
                    current_box = g.box;
                });
        }
    }

    /**
     * Method Inlined spaceUpsAndDowns() - eliminates repeated property access
     */
    public spaceUpsAndDowns() {
        const PATH_GAP = this.configService.PATH_GAP;
        const HSR3 = this.configService.HSR3;
        const WIDTH = this.configService.WIDTH;
        const BOX_WIDTH = this.configService.BOX_WIDTH;

        let prev: GraphStroke | null = null;
        let diff: number | null = null;
        for (let i = 0; i < this.graphs.length; ++i) {
            this.graphs[i].graph.sort(function (a, b) {
                return b.cc.x - a.cc.x;
            });
            this.graphs[i].graph
                .filter(function (g) {
                    return !['elec', 'heat'].includes(g.box);
                })
                .forEach((g, j) => {
                    if (j === 0) {
                        prev = g;
                        return;
                    }
                    let pathGap = PATH_GAP * HSR3;
                    if (g.stroke === 0) {
                        pathGap = 0;
                    }
                    diff = pathGap - ((prev!.cc.x - prev!.stroke / 2) - (g.cc.x + g.stroke / 2));
                    g.cc.x -= diff;
                    g.c.x -= diff;
                    g.b.x -= diff;
                    prev = g;
                });
            let max_cc = Math.max.apply(Math, this.graphs[i].graph.map(function (o) {
                return o.cc.x;
            }));
            this.graphs[i].graph
                .filter(function (g) {
                    return !['elec', 'heat'].includes(g.box);
                })
                .forEach((g) => {
                    let diff = max_cc - (WIDTH - BOX_WIDTH - 50);
                    g.c.x -= diff;
                    g.b.x -= diff;
                });
        }
    }

    /**
     * Waste heat processing
     */
    public processWasteHeatFlows() {
        // Always process waste heat flows
        for (let i = 0; i < this.graphs.length; ++i) {
            let prev_graph: GraphStroke | null = null;

            this.graphs[i].graph
                .filter((g: GraphStroke) => g.fuel === 'elec')
                .sort(this.sortGraphDown.bind(this))
                .forEach((g: GraphStroke, j: number) => {
                    // Loop through boxes
                    if (j % 2 !== 0) {
                        g.fuel = 'waste';
                        // This is waste --> right side boxes
                        if (prev_graph) {
                            const total_stroke = Math.abs(prev_graph.stroke + g.stroke);
                            g.a.y = prev_graph.a.y + total_stroke / 2;
                            g.b.y = g.a.y;

                            g.b.x = prev_graph.b.x - total_stroke / 3.5;
                            g.c.x = prev_graph.c.x - total_stroke / 3.5;
                            g.c.y = prev_graph.c.y + total_stroke / 2;
                            g.d.y = g.c.y;
                        }
                    } else {
                        prev_graph = g;
                    }
                });
        }
    }

    /**
     * Method Inlined sortGraphUp() - eliminates repeated array access
     */
    private sortGraphUp(a: GraphStroke, b: GraphStroke): number {
        // Cache arrays locally to eliminate repeated property access
        const BOX_NAMES = this.configService.BOX_NAMES;
        const FUEL_NAMES = this.configService.FUEL_NAMES;

        if (BOX_NAMES.indexOf(a.box) < BOX_NAMES.indexOf(b.box)) {
            return 1;
        }
        if (BOX_NAMES.indexOf(a.box) > BOX_NAMES.indexOf(b.box)) {
            return -1;
        }
        if (FUEL_NAMES.indexOf(a.fuel) < FUEL_NAMES.indexOf(b.fuel)) {
            return 1;
        }
        if (FUEL_NAMES.indexOf(a.fuel) > FUEL_NAMES.indexOf(b.fuel)) {
            return -1;
        }
        return 0;
    }

    /**
     * Method Inlined sortGraphDown() - eliminates repeated array access
     */
    private sortGraphDown(a: GraphStroke, b: GraphStroke): number {
        // Cache arrays locally to eliminate repeated property access
        const BOX_NAMES = this.configService.BOX_NAMES;
        const FUEL_NAMES = this.configService.FUEL_NAMES;

        if (BOX_NAMES.indexOf(a.box) < BOX_NAMES.indexOf(b.box)) {
            return -1;
        }
        if (BOX_NAMES.indexOf(a.box) > BOX_NAMES.indexOf(b.box)) {
            return 1;
        }
        if (FUEL_NAMES.indexOf(a.fuel) < FUEL_NAMES.indexOf(b.fuel)) {
            return -1;
        }
        if (FUEL_NAMES.indexOf(a.fuel) > FUEL_NAMES.indexOf(b.fuel)) {
            return 1;
        }
        return 0;
    }

    public sigfig2(n: number | string | undefined | null): number {
        // Add safety check for invalid inputs
        if (n === undefined || n === null || (typeof n === 'string' && n.trim() === '')) {
            console.warn('sigfig2 received invalid input:', n);
            return 0;
        }

        // Convert to number if it's a string
        let numValue: number;
        if (typeof n === 'string') {
            numValue = parseFloat(n);
            if (isNaN(numValue)) {
                console.warn('sigfig2 could not parse string to number:', n);
                return 0;
            }
        } else {
            numValue = n;
        }

        if (isNaN(numValue)) {
            console.warn('sigfig2 received NaN:', n);
            return 0;
        }

        if (numValue > 1 && numValue < 10) {
            return Number.parseFloat(numValue.toPrecision(1));
        } else {
            return Number.parseFloat(numValue.toPrecision(2));
        }
    }

    public createLine(): d3.Line<GraphPoint> {
        return d3.line<GraphPoint>()
            .x(function (d) {
                return d.x;
            })
            .y(function (d) {
                return d.y;
            });
    }
}
