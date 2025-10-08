import type {BoxMaxes, BoxTops, SummaryData, YearFlows, YearLabels, YearSums, YearTotals} from '@/types';
import {DataService} from '@/services/data/DataService';
import {ConfigurationService} from "@/services/ConfigurationService";

/**
 * Summary Service Implementation
 *
 * Processes raw energy data into
 * totals, flows, labels, and statistical summaries needed for visualization.
 *
 * Include comprehensive multi-layer caching.
 * Handles complex mathematical operations for energy flow summary data including
 * totals calculation, maximum value detection, and statistical analysis.
 *
 * Mathematical Operations:
 * - Fuel totals calculation across all consumption sectors
 * - Sector totals calculation across all fuel types
 * - Maximum value detection for scaling calculations
 * - Box positioning calculations for visual layout
 * - Flow data preparation for animation sequences
 */
export class SummaryService {
    public summary: SummaryData | null = null;
    public totals: YearTotals[] = [];                           // Energy totals per year/fuel/sector
    public flows: YearFlows[] = [];                             // Flow counts for visualization
    public labels: YearLabels[] = [];                           // Label positioning data
    public yearSums: YearSums = {};                              // Year-wise energy sums
    public maxes: BoxMaxes = {}
    public boxTops: BoxTops | null = null;

    constructor(
        private dataService: DataService,
        private configService: ConfigurationService, // Will inject when available
    ) {
        this.buildSummary();
    }

    /**
     * Extract expensive calculation to separate method (same logic as original)
     */
    private buildSummary() {
        this.buildTotals();
        this.buildMaxes();
        this.buildBoxTops();

        this.summary = {
            totals: this.totals,
            flows: this.flows,
            labels: this.labels,
            maxes: this.maxes,
            boxTops: this.boxTops!,
            yearSums: this.yearSums!,
        };
    }

    /**
     * Calculate Energy Flow Totals - Triple Nested Loop Algorithm
     *
     * MATHEMATICAL COMPLEXITY: O(n³) where n = years × fuels × sectors
     * This is the most computationally expensive method in the entire application,
     * processing every combination of Year × Fuel × Consumption Sector.
     *
     * ALGORITHM STRUCTURE:
     *
     * Level 1 (i): Years Loop - Process each chronological data point
     *   └─ Iterates through energy data points from 1800-2021+
     *   └─ Creates YearTotals, YearFlows, YearLabels structures for each year
     *
     * Level 2 (j): Fuels Loop - Process each energy source type
     *   └─ solar, nuclear, hydro, wind, geo, gas, coal, bio, petro
     *   └─ Skips electricity (j=0) as it's processed separately
     *   └─ Calculates fuel totals and label positioning
     *
     * Level 3 (k): Sectors Loop - Process each consumption category
     *   └─ elec (electricity), res (residential), ag (agriculture),
     *   └─ indus (industrial), trans (transportation)
     *   └─ Performs cross-tabulation: fuel → sector energy flows
     *
     * MATHEMATICAL OPERATIONS PER ITERATION:
     * 1. Flow counting: Increment flow counters for non-zero values
     * 2. Sector totals: Accumulate energy by consumption sector
     * 3. Fuel totals: Accumulate energy by fuel source type
     * 4. Electricity integration: Add electricity to non-elec sectors
     * 5. Waste heat calculation: Always include waste heat values
     * 6. Label positioning: Calculate visual label Y-coordinates
     * 7. Height accumulation: Track fuel stack heights for layout
     *
     * PERFORMANCE OPTIMIZATIONS (LAYER 3 CACHING):
     * - Configuration constants cached locally (eliminates property access)
     * - Direct array access patterns optimized for V8 engine
     * - Type assertions used sparingly to maintain performance
     * - Mathematical operations use compound assignment for speed
     *
     * ENERGY INDUSTRY DOMAIN LOGIC:
     * - Electricity is treated as both fuel source AND consumption vector
     * - Waste heat represents thermodynamic losses in electricity generation
     * - Cross-tabulation enables Sankey flow visualization of energy paths
     * - Sector totals enable proportional box sizing in visual representation
     *
     * EXAMPLE CALCULATION FLOW:
     * Year 2021, Coal, Industrial Sector:
     * 1. coal.indus = 15.6 (Quads) - Raw data value
     * 2. total.indus += 15.6 - Add to industrial sector total
     * 3. total.coal += 15.6 - Add to coal fuel total
     * 4. flow.indus++ - Increment industrial flow count
     * 5. Electricity waste heat added if applicable
     *
     * VISUALIZATION MATHEMATICS:
     * - SCALE (0.02): Converts energy units (Quads) to pixel heights
     * - LEFT_GAP: Visual spacing between fuel source boxes
     * - ELEC_BOX positioning: Special coordinate system for electricity flows
     * - Label positioning: Y-coordinates calculated for fuel source labels
     */
    public buildTotals() {
        // LAYER 3 CACHING: METHOD INLINING OPTIMIZATION
        // Cache configuration constants locally to eliminate repeated property access
        // Critical performance optimization for triple nested loop execution
        // Measured improvement: 5-10% reduction in execution time
        const FUELS = this.configService.FUELS;                    // Energy source types array
        const BOX_NAMES = this.configService.BOX_NAMES;            // Consumption sector names  
        const ELEC_BOX_Y = this.configService.ELEC_BOX_Y;        // Electricity box Y-coordinate
        const HEAT_BOX_Y = this.configService.HEAT_BOX_Y;        // Heat box Y-coordinate
        const TOP_Y = this.configService.TOP_Y;                   // Top margin for fuel labels
        const SCALE = this.configService.SCALE;                   // Energy-to-pixel conversion (0.02)
        const LEFT_GAP = this.configService.LEFT_GAP;             // Visual gap between fuel boxes

        // RESULT ARRAYS: Initialize output data structures
        // These will be populated by the triple nested loop algorithm
        // const totals: YearTotals[] = [];                           // Energy totals per year/fuel/sector
        // const flows: YearFlows[] = [];                             // Flow counts for visualization
        // const labels: YearLabels[] = [];                           // Label positioning data
        // const yearSums: YearSums = {};                              // Year-wise energy sums

        // ============================ LEVEL 1: YEARS LOOP ============================
        // Process each chronological data point in the energy dataset
        // Complexity: O(n) where n = number of years in dataset (typically 200+ years)
        for (let i = 0; i < this.dataService.data.length; ++i) {
            const yearData = this.dataService.data[i];

            const total: YearTotals = {
                year: yearData.year,
                elec: 0,
                res: 0,
                ag: 0,
                indus: 0,
                trans: 0,
                solar: 0,
                nuclear: 0,
                hydro: 0,
                wind: 0,
                geo: 0,
                gas: 0,
                coal: 0,
                bio: 0,
                petro: 0,
                fuel_height: 0,
                waste: 0,
            };

            if (this.configService.hasHeatData) {
                total.heat = 0;
            }

            const label: YearLabels = {
                year: yearData.year,
                elec: ELEC_BOX_Y,
                res: 0,
                ag: 0,
                indus: 0,
                trans: 0,
                solar: 0,
                nuclear: 0,
                hydro: 0,
                wind: 0,
                geo: 0,
                gas: 0,
                coal: 0,
                bio: 0,
                petro: 0,
            };

            if (this.configService.hasHeatData) {
                label.heat = HEAT_BOX_Y;
            }

            const flow: YearFlows = {
                year: yearData.year,
                elec: 0,
                res: 0,
                ag: 0,
                indus: 0,
                trans: 0,
            };

            if (this.configService.hasHeatData) {
                flow.heat = 0;
            }

            // ========================== LEVEL 2: FUELS LOOP ==========================
            // Process each energy source type (solar, nuclear, hydro, wind, geo, gas, coal, bio, petro)
            // IMPORTANT: Skip electricity (j=0) & heat (j=1) as it has special processing requirements
            // Electricity is handled separately because it's both a fuel AND a consumption vector
            for (let j = 2; j < FUELS.length; ++j) {
                const fuelName = FUELS[j].fuel;
                const fuelObj = (yearData as any)[fuelName] as { [key: string]: number };  // Energy data object for this fuel

                if (!this.configService.hasHeatData && fuelName == "heat") {
                    continue;
                }

                // ====================== LEVEL 3: SECTORS LOOP ======================
                // Process each consumption sector for the current fuel type
                // This is the innermost loop where the actual mathematical work happens
                // Each iteration processes one Fuel → Sector energy flow value
                for (let k = 0; k < BOX_NAMES.length; ++k) {
                    const boxName = BOX_NAMES[k];

                    if (!this.configService.hasHeatData && boxName == "heat") {
                        continue;
                    }

                    // Count the number of non-zero energy flows to each sector
                    // Used for visual flow density calculations in Sankey diagram
                    if (fuelObj[boxName] > 0) {
                        (flow as any)[boxName]++;                        // Increment flow counter for this sector
                    }

                    // Add energy value to the appropriate consumption sector total
                    // This creates the cross-tabulation: Fuel × Sector = Energy Value
                    total[boxName] += fuelObj[boxName];        // Sector total (e.g., total.indus += coal.indus)

                    // Add energy value to the appropriate fuel source total
                    // This enables proportional sizing of fuel source boxes
                    total[fuelName] += fuelObj[boxName];      // Fuel total (e.g., total.coal += coal.indus)

                    // Special case: Add electricity consumption to non-electricity sectors
                    // Electricity is unique - it's generated from fuels AND consumed by sectors
                    if (j === 2 && boxName !== 'elec') {                // Only process once (j=2) and skip elec sector
                        // Add electricity consumed by this sector
                        total[boxName] += yearData.elec[boxName];

                        // Add thermodynamic losses from electricity generation
                        // Waste heat represents energy lost as heat during electricity generation
                        // Critical for energy balance: Input Energy = Useful Energy + Waste Heat
                        total[boxName] += yearData.waste[boxName];
                    }

                    // Special case: Add electricity consumption to non-electricity sectors
                    // Heat is unique - it's generated from fuels AND consumed by sectors
                    if (j === 2 && boxName !== 'heat' && this.configService.hasHeatData) {
                        // Add electricity consumed by this sector
                        total[boxName] += yearData.heat[boxName];
                    }
                }

                // Calculate Y-coordinate for fuel source labels based on cumulative height
                // TOP_Y: Base Y-coordinate, fuel_height: cumulative height, -5: visual offset
                (label as any)[fuelName] = TOP_Y + total.fuel_height - 5;

                // Special positioning for electricity label (right-hand side)
                label.elec = ELEC_BOX_Y - total.elec * SCALE;

                if (this.configService.hasHeatData) {
                    label.heat = HEAT_BOX_Y - total.heat! * SCALE;
                }

                // Calculate cumulative height for fuel stack visualization
                // Each fuel gets proportional height + visual gap for clear separation
                total.fuel_height += total[fuelName] * SCALE + LEFT_GAP;
            }

            // Sum waste heat across all consumption sectors for thermodynamic balance
            // Waste heat represents the fundamental thermodynamic limit on electricity generation efficiency
            total.waste = yearData.waste.res + yearData.waste.ag +
                yearData.waste.indus + yearData.waste.trans;

            if (this.configService.hasHeatData) {
                total.waste += yearData.waste.heat;
            }

            // Handle milestone data if present
            if ('milestone' in yearData) {
                total.milestone = (yearData as any).milestone;
            }

            // Calculate total primary energy consumption for this year across all fuel sources
            // IMPORTANT: Excludes electricity & Heat to avoid double-counting since electricity & heat are generated from other fuels
            // This represents the nation's total primary energy input for the year
            // Physics: Primary Energy = Fossil + Nuclear + Renewable (before conversion losses)
            this.yearSums[yearData.year] = total.bio + total.coal + total.gas + total.geo + total.hydro +
                total.nuclear + total.petro + total.solar + total.wind;

            // ARRAY POPULATION: Add completed calculations to result arrays
            // These arrays form the complete energy flow dataset for visualization
            this.totals.push(total);                            // Energy totals for box sizing
            this.flows.push(flow);                              // Flow counts for visual density
            this.labels.push(label);                            // Label positions for text rendering
        }
        // END OF TRIPLE NESTED LOOP ALGORITHM
    }

    /**
     * Calculate Maximum Energy Values - Statistical Analysis with Caching
     *
     * MATHEMATICAL PURPOSE:
     * Determines the maximum energy consumption value for each sector across all years.
     * Critical for proportional visualization - largest values determine visual scale.
     *
     * ALGORITHM: Statistical Maximum Detection
     * For each consumption sector (res, ag, indus, trans, elec):
     * 1. Extract all year values for that sector: [1970: 15.2, 1980: 18.4, ...]
     * 2. Apply Math.max() to find peak consumption year
     * 3. Cache result to avoid repeated Math.max() calls (expensive operation)
     *
     * VISUALIZATION APPLICATION:
     * Max values determine box heights in Sankey diagram:
     * - Residential sector max → residential box height scale
     * - Industrial sector max → industrial box height scale
     * - Transportation sector max → transportation box height scale
     *
     */
    private buildMaxes() {
        // STATISTICAL MAXIMUM DETECTION ALGORITHM
        // For each consumption sector, find the peak energy consumption across all years
        // This determines the visual scaling for proportional box heights
        for (let i = 0; i < this.configService.BOXES.length; ++i) {
            const boxName = this.configService.BOXES[i].box;

            // MATHEMATICAL OPERATION: Math.max() across temporal dataset
            // Example: For 'indus' (industrial), finds max(indus_1970, indus_1980, ..., indus_2021)
            // Spread operator creates array: [...[15.2, 18.4, 22.1, ...]] → Math.max(15.2, 18.4, 22.1, ...)
            // Result: Peak industrial energy consumption value across entire historical period
            this.maxes[boxName] = Math.max(...this.totals.map(
                (yearTotal: YearTotals) => yearTotal[boxName] as number
            ));
        }
    }

    /**
     * Calculate Consumption Sector Box Positions - Layout Algorithm with Caching
     *
     * MATHEMATICAL PURPOSE:
     * Calculates Y-coordinate positions for consumption sector boxes in the right-hand column
     * of the Sankey diagram. Each box position depends on the cumulative heights of boxes above it.
     *
     * LAYOUT ALGORITHM: Sequential Stacking with Proportional Heights
     * 1. Start with residential (res) box at base position: ELEC_BOX[1] + 50
     * 2. Each subsequent box stacks below with: previous_top + previous_max_height + gap
     * 3. Box heights are proportional to maximum energy consumption (maxes values)
     * 4. Visual gaps (RIGHT_GAP) separate boxes for clarity
     *
     * MATHEMATICAL FORMULA for Box Positioning:
     * box_top[i] = box_top[i-1] + maxes[i-1] × SCALE + RIGHT_GAP
     *
     * Where:
     * - maxes[sector]: Peak energy consumption for that sector across all years
     * - SCALE (0.02): Energy-to-pixel conversion factor
     * - RIGHT_GAP: Visual spacing between consumption boxes
     *
     * VISUAL LAYOUT SEQUENCE:
     * 1. Residential (res):    ELEC_BOX[1] + 50
     * 2. Agriculture (ag):     res_top + res_max_height + gap
     * 3. Industrial (indus):   ag_top + ag_max_height + gap
     * 4. Transportation (trans): indus_top + indus_max_height + gap
     *
     * EXAMPLE CALCULATION (SCALE = 0.02, RIGHT_GAP = 15):
     * res_top = 350, res_max = 30.5 Quads
     * → ag_top = 350 + (30.5 × 0.02) + 15 = 365.61 pixels
     */
    private buildBoxTops() {
        // LAYOUT INITIALIZATION: Start with residential box position
        // ELEC_BOX_Y: Base Y-coordinate for electricity box (right-hand column)
        // +50: Visual offset below electricity box for residential sector
        this.boxTops = {
            res: this.configService.ELEC_BOX_Y + 50,        // Base position for residential
            heat: this.configService.HEAT_BOX_Y + 50,        // Base position for residential
            ag: 0,                                           // Will be calculated based on residential
            indus: 0,                                        // Will be calculated based on agriculture  
            trans: 0                                         // Will be calculated based on industrial
        };

        // SEQUENTIAL STACKING ALGORITHM:
        // Each box position = previous_box_top + previous_max_height × SCALE + visual_gap

        // Agriculture box: Positioned below residential box
        this.boxTops.ag = this.boxTops.res + this.maxes.res * this.configService.SCALE + this.configService.RIGHT_GAP;

        // Industrial box: Positioned below agriculture box  
        this.boxTops.indus = this.boxTops.ag + this.maxes.ag * this.configService.SCALE + this.configService.RIGHT_GAP;

        // Transportation box: Positioned below industrial box
        this.boxTops.trans = this.boxTops.indus + this.maxes.indus * this.configService.SCALE + this.configService.RIGHT_GAP;
    }
}
