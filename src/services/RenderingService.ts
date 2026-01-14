import * as d3 from 'd3';
import {GraphPoint, GraphStroke, YearTotals} from '@/types';
import {EventBus} from '@/core/events/EventBus';
import {ConfigurationService} from '@/services/ConfigurationService';
import {SummaryService} from '@/services/calculation/SummaryService';
import {GraphService} from '@/services/calculation/GraphService';
import {DataService} from "@/services/data/DataService";

// ==================== D3 SELECTION TYPES ====================

type D3SVGSelection = d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
type D3DivSelection = d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

// ==================== RENDERING DATA INTERFACES ====================

/**
 * Chart Rendering Service - D3.js SVG Generation & Visual Rendering Engine
 *
 * ARCHITECTURAL RESPONSIBILITY: Mathematical Data → Visual SVG Transformation
 *
 * This service implements sophisticated D3.js patterns to transform mathematical energy flow
 * calculations into interactive SVG visualizations. It manages the complete visual rendering
 * pipeline from raw data to user-ready interactive charts.
 *
 * D3.JS DESIGN PATTERNS IMPLEMENTED:
 * 1. **Selection Patterns**: Efficient DOM element selection and manipulation
 * 2. **Data Binding**: Binding energy data to SVG elements with enter/update/exit patterns
 * 3. **Method Chaining**: Fluent D3 API usage for concise and readable code
 * 4. **Event Handling**: Mouse interactions with tooltip integration
 * 5. **Transition Management**: Smooth animations for year-to-year transitions
 * 6. **Scale Management**: Coordinate transformations and responsive scaling
 *
 * SVG GENERATION ARCHITECTURE:
 * - **Fuel Boxes**: Left column showing energy sources (solar, coal, etc.)
 * - **Sector Boxes**: Right column showing consumption sectors (residential, industrial, etc.)
 * - **Flow Paths**: connecting fuel sources to consumption sectors
 * - **Labels & Text**: Dynamic text elements with data-driven content
 * - **Tooltips**: Interactive information overlays with precise positioning
 *
 * VISUAL RENDERING PIPELINE:
 * Mathematical Data → D3 Selections → SVG Elements → Interactive Features → User Interface
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Efficient DOM manipulation using D3 selections
 * - Minimal DOM re-creation during year transitions
 * - Event delegation for tooltip management
 * - CSS class-based styling for performance
 * - Cached line generator for path creation
 */
export class RenderingService {
    private lineGenerator: d3.Line<GraphPoint>;

    constructor(
        private configService: ConfigurationService,
        private summaryCalculationService: SummaryService,
        private graphCalculationService: GraphService,
        private dataService: DataService,
        private eventBus: EventBus
    ) {
        // Initialize D3 line generator for smooth rendering
        this.lineGenerator = d3.line<GraphPoint>()
            .x((d: GraphPoint) => d.x)
            .y((d: GraphPoint) => d.y);
    }

    /**
     * Draws the animated header elements (year and energy units) as separate SVG overlays
     */
    public drawHeader(): void {

        // Create Energy Usage Overlay in the title section
        this.createEnergyUsageOverlay();

        // Create Year Overlay in separate year section
        this.createYearOverlay();
    }

    /**
     * Creates the energy usage SVG overlay in the title section
     */
    private createEnergyUsageOverlay(): void {
        const energyContainer = d3.select('.energy-usage-overlay');

        const energySvg = energyContainer
            .append('svg')
            .attr('id', 'energy-usage-overlay')
            .attr('class', 'energy-svg-overlay')
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '25%')
            .style('width', '100%')
            .style('height', '25px')
            .style('pointer-events', 'none')
            .style('overflow', 'visible');

        // Draw energy usage units (will be populated by animation)
        energySvg.append('text')
            .text('0 W/capita') // Will be updated by animation to show actual energy usage
            .attr('text-anchor', 'right')
            .attr('x', 0)
            .attr('y', 18)
            .attr('class', 'unit year-total animate title-bottom')
            .attr('data-incr', '0')
            .attr('data-value', '0')
            .style('font-size', '0.9em')
            .style('font-weight', 'bold');
    }

    /**
     * Creates the year SVG overlay in the year section
     */
    private createYearOverlay(): void {
        const firstYear = this.dataService.firstYear!;

        const yearContainer = d3.select('.year-overlay');

        const yearSvg = yearContainer
            .append('svg')
            .attr('id', 'year-overlay')
            .attr('class', 'year-svg-overlay')
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('width', '100%')
            .style('height', '100%')
            .style('pointer-events', 'none')
            .style('overflow', 'visible');

        // Draw year (will be populated by animation)
        yearSvg.append('text')
            .text(firstYear.toString())
            .attr('text-anchor', 'middle')
            .attr('x', '50%')
            .attr('y', '90%')
            .attr('class', 'year animate')
            .attr('data-incr', '0')
            .attr('data-value', firstYear)
            .style('font-size', '3.1em')
            .style('font-weight', 'bold')
            .style('letter-spacing', '0.05em')
            .style('font-variant-numeric', 'tabular-nums');
    }

    /**
     * Draw Fuel Source Labels - Left Column Energy Source Visualization
     *
     * RENDERING RESPONSIBILITY: Create dynamic fuel source labels with proportional positioning
     *
     * This method implements D3.js text element creation for fuel source identification.
     * Label positions are calculated dynamically based on energy totals to maintain
     * accurate visual alignment with proportional fuel box heights.
     *
     * D3.JS TEXT RENDERING PATTERNS:
     * - Dynamic content from configuration and energy data
     * - Conditional visibility based on energy values (hidden if zero)
     * - Data attributes for animation and programmatic access
     * - CSS classes for styling and state management
     *
     * PROPORTIONAL POSITIONING ALGORITHM:
     * Y-position calculated dynamically: TOP_Y + cumulative_energy_heights + gaps
     * Ensures perfect alignment between fuel labels and their corresponding flow origins
     */
    public drawLeftLabels(svg: D3SVGSelection, totals: YearTotals): void {
        // Electricity & Heat (index 0, 1) are handled separately due to special positioning requirements
        const leftFuels = this.configService.FUELS.slice(2); // Remove electricity & heat from array

        svg.selectAll('.fuel-label-left')
            .data(leftFuels)
            .join('text')
            .attr('class', (d: any) => `label animate fuel ${d.fuel} fuel-label-left`) // CSS classes for styling
            .text((d: any) => d.name)                                       // Human-readable fuel name
            .attr('x', this.configService.LEFT_X)                           // X-position: left column alignment
            .attr('y', (d: any, i: number) => {                            // Y-position: calculated per fuel
                // Calculate cumulative Y position for this fuel
                let cumulativeTop = this.configService.LEFT_Y;
                for (let j = 0; j < i; j++) {
                    const prevFuel = leftFuels[j];
                    const prevFuelTotal = totals[prevFuel.fuel] || 0;
                    cumulativeTop += prevFuelTotal * this.configService.SCALE + this.configService.LEFT_GAP;
                }
                return cumulativeTop - 5;                                   // Apply visual offset
            })
            .attr('data-incr', '0')                                         // Animation increment tracking
            .attr('data-fuel', (d: any) => d.fuel)                         // Fuel identifier for interactions
            .attr('data-value', (d: any) => {                              // Formatted energy value
                const fuelTotal = totals[d.fuel] || 0;
                return this.graphCalculationService.sigfig2(fuelTotal);
            })
            .classed('hidden', (d: any) => {                               // Hide labels for zero-energy fuels
                const fuelTotal = totals[d.fuel] || 0;
                return fuelTotal === 0;
            });
    }

    /**
     * Draw Energy Sector Boxes & Labels - Right Column Consumption Visualization
     *
     * RENDERING RESPONSIBILITY: Create interactive sector boxes with labels and totals
     *
     * This method implements the most complex D3.js element creation patterns, generating
     * rectangular sector boxes with multi-line labels and dynamic energy totals.
     * Demonstrates advanced SVG composition with nested text elements.
     *
     * ADVANCED D3.JS PATTERNS DEMONSTRATED:
     * 1. **Conditional Positioning**: Different algorithms for electricity vs. sector boxes
     * 2. **Complex Text Composition**: Multi-line labels using tspan elements
     * 3. **Dynamic Sizing**: Proportional box heights based on energy consumption
     * 4. **Data-Driven Visibility**: Conditional hiding based on energy values
     * 5. **Nested Element Creation**: Text elements with multiple tspan children
     * 6. **Special Case Handling**: Residential/Commercial label splitting
     *
     * SVG ELEMENT ARCHITECTURE:
     * Each sector generates: Rectangle (visual box) + Text (label + total + waste)
     * - Rectangle: Proportionally sized based on energy consumption
     * - Text Label: Human-readable sector name with special formatting
     * - Energy Total: Numeric display of energy consumption value
     * - Waste Total: Thermodynamic losses for electricity-consuming sectors
     */
    public drawBoxes(
        svg: D3SVGSelection,
        totals: YearTotals,
    ): void {
        const boxtops = this.summaryCalculationService.summary!.boxTops;                                   // Calculated box positions

        // SECTOR BOX GENERATION LOOP: Create visual elements for each consumption sector
        for (let i = 0; i < this.configService.BOXES.length; i++) {
            const boxConfig = this.configService.BOXES[i];

            let x: number;                                                  // Calculated X-coordinate
            let y: number;                                                  // Calculated Y-coordinate

            if (!this.configService.hasHeatData && boxConfig.box == "heat") {
                continue;
            }

            // CONDITIONAL POSITIONING ALGORITHM: Electricity vs. Regular Sectors
            if (boxConfig.box === 'elec') {
                // ELECTRICITY BOX: Special central positioning
                x = this.configService.ELECTRICITY_BOX_X;                         // Configured X-position
                y = this.configService.ELECTRICITY_BOX_Y - totals.elec * this.configService.SCALE;  // Dynamic Y-position
            } else if (boxConfig.box === 'heat') {
                // ELECTRICITY BOX: Special central positioning
                x = this.configService.HEAT_BOX_X;                         // Configured X-position
                y = this.configService.HEAT_BOX_Y - totals.heat! * this.configService.SCALE;  // Dynamic Y-position
            } else {
                // CONSUMPTION SECTORS: Right column with calculated positioning
                x = this.configService.WIDTH - this.configService.BOX_WIDTH;  // Right-aligned positioning
                y = boxtops[boxConfig.box] || 0;                                     // Pre-calculated Y-positions
            }

            const boxTotal = (totals as any)[boxConfig.box] || 0;                 // Energy consumption for this sector

            // D3.JS RECTANGLE CREATION: Visual sector box with proportional sizing
            svg.append('rect')                                              // Create SVG rectangle
                .attr('x', x)                                               // Horizontal position
                .attr('y', y)                                               // Vertical position
                .attr('width', this.configService.BOX_WIDTH)                // Standard box width
                .attr('height', boxTotal > 0 ? boxTotal * this.configService.SCALE + this.configService.BLEED : 0)  // Proportional height
                .attr('class', `box sector animate ${boxConfig.box}`)             // CSS classes for styling
                .classed('fuel', ['elec', 'heat'].includes(boxConfig.box))                        // Special class for electricity
                .attr('data-sector', boxConfig.box)                               // Sector identifier
                .attr('data-fuel', ['elec', 'heat'].includes(boxConfig.box) ? boxConfig.box : '')
                .attr('data-incr', '0');                                    // Animation increment tracking

            // COMPLEX TEXT ELEMENT CREATION: Multi-line label with totals
            const text = svg.append('text')                                 // Create main text element
                .text(boxConfig.box === 'res' ? 'Residential' : boxConfig.name)        // Primary label text
                .attr('x', x)                                               // Horizontal alignment
                .attr('y', y - 5)                                           // Vertical position above box
                .attr('dy', boxConfig.box === 'res' ? '-1.8em' : '-0.8em')       // Line spacing adjustment
                .attr('data-sector', boxConfig.box)                               // Sector identification
                .attr('data-fuel', ['elec', 'heat'].includes(boxConfig.box) ? boxConfig.box : '')
                .attr('class', `label sector animate ${boxConfig.box}`)           // CSS classes
                .classed('hidden', boxTotal === 0)                          // Conditional visibility
                .classed('fuel', ['elec', 'heat'].includes(boxConfig.box));                        // Special class for electricity

            // SPECIAL CASE: RESIDENTIAL SECTOR MULTI-LINE LABEL
            if (boxConfig.box === 'res') {
                text.append('tspan')                                        // Create second line
                    .text('/Commercial')                                    // Complete sector name
                    .attr('x', x)                                           // Horizontal alignment
                    .attr('dy', '1em')                                      // Line spacing
                    .attr('data-incr', '0');                                // Animation tracking
            }

            // ENERGY TOTAL DISPLAY: Numerical energy consumption value
            text.append('tspan')                                            // Create total value tspan
                .attr('class', `total sector animate ${boxConfig.box}`)           // CSS classes for styling
                .attr('data-sector', boxConfig.box)                               // Sector identification
                .attr('data-value', boxTotal)                               // Raw energy value
                .text(this.graphCalculationService.sigfig2(boxTotal))       // Formatted display value
                .attr('x', x)                                               // Horizontal position
                .attr('dy', '1.2em')                                        // Vertical offset
                .attr('data-incr', '0');                                    // Animation increment

            // WASTE HEAT DISPLAY: Thermodynamic losses for electricity consumption
            text.append('tspan')                                            // Create waste total tspan
                .attr('class', `total waste-level sector animate ${boxConfig.box}`)  // CSS classes
                .attr('data-sector', boxConfig.box)                               // Sector identification
                .attr('data-value', '0')                                    // Initial waste value
                .text(this.graphCalculationService.sigfig2(0))              // Formatted waste display
                .attr('x', x + this.configService.BOX_WIDTH)                // Right-aligned positioning
                .attr('dy', '0')                                            // Same line as totals
                .attr('text-anchor', 'end')                                 // Right text alignment
                .attr('data-incr', '0');                                    // Animation tracking
        }
    }

    /**
     * Draw Interactive Energy Flow Paths - Advanced D3.js SVG Path Rendering
     *
     * RENDERING RESPONSIBILITY: Transform Mathematical Flow Data → Interactive SVG Paths
     *
     * This method implements the most sophisticated D3.js rendering patterns in the entire
     * visualization system, creating interactive paths that represent energy
     * flows between fuel sources and consumption sectors.
     *
     * ADVANCED D3.JS PATTERNS IMPLEMENTED:
     * 1. **Complex Path Generation**: Mathematical GraphStroke data → SVG path strings
     * 2. **Interactive Event Binding**: Mouse event handlers for tooltip interactions
     * 3. **Dynamic Content Creation**: Data-driven SVG element creation with unique attributes
     * 4. **Transition Management**: Smooth fade-in/fade-out tooltip animations
     * 5. **Context-Aware Selection**: Targeting existing fuel group containers
     * 6. **Performance Optimization**: Efficient DOM manipulation and event delegation
     *
     * ENERGY FLOW VISUALIZATION ARCHITECTURE:
     * Each energy flow (Fuel → Sector) becomes an SVG <path> element with:
     * - Geometry calculated by GraphService
     * - Stroke width proportional to energy quantity (visual data encoding)
     * - Interactive tooltip showing detailed energy values on hover
     * - CSS classes enabling styling and animation hooks
     * - Data attributes for programmatic access and filtering
     *
     * TOOLTIP INTERACTION DESIGN:
     * - Mouseover: 200ms fade-in with energy flow details
     * - Mouseout: 500ms fade-out for smooth visual transitions
     * - Dynamic positioning: Follows cursor with offset for readability
     * - Content formatting: "Fuel → Sector" with numerical energy value
     *
     * SVG PATH GENERATION PIPELINE:
     * Mathematical Coordinates → parseLineData() → SVG Path String → Interactive Path Element
     */
    public drawFlows(svg: D3SVGSelection, yearIndex: number, tooltip: D3DivSelection): void {
        // DATA RETRIEVAL: Get mathematical flow calculations for target year
        const graphs = this.graphCalculationService.graphs;

        const graphData = graphs[yearIndex];

        // Filter valid strokes and group by fuel for optimized rendering
        const validStrokes = graphData.graph.filter(stroke =>
            stroke.b.x !== null && stroke.b.x !== undefined
        );

        // Group strokes by fuel for efficient fuel-based rendering
        const strokesByFuel = validStrokes.reduce((groups: any, stroke: any) => {
            if (!groups[stroke.fuel]) groups[stroke.fuel] = [];
            groups[stroke.fuel].push(stroke);
            return groups;
        }, {});

        Object.entries(strokesByFuel).forEach(([fuel, strokes]: [string, any]) => {
            svg.select(`.fuel.${fuel}`)                             // Target existing fuel group container
                .selectAll('.flow-path')                          // Select flow paths within fuel group
                .data(strokes)                                              // Bind stroke data
                .join('path')
                .attr('class', (d: any) => `flow animate ${d.fuel} ${d.box} flow-path`)  // CSS classes
                .attr('d', (d: any) => this.parseLineData(d))     // Set path geometry
                .attr('stroke-width', (d: any) => d.stroke > 0 ? d.stroke + this.configService.BLEED : 0)  // Visual thickness
                .attr('data-fuel', (d: any) => d.fuel)         // Data attribute for fuel identification
                .attr('data-sector', (d: any) => d.box)        // Data attribute for sector identification
                .attr('data-incr', '0')                        // Animation increment tracking
                .attr('stroke-linejoin', (d: any) => d.fuel !== 'waste' ? 'round' : '')  // Rounded joins

                // ================= INTERACTIVE TOOLTIP SYSTEM =================

                // MOUSEOVER EVENT: Show detailed energy flow information
                .on('mouseover', (event: any, d: any) => {
                    // Clear any existing tooltip styles for clean state
                    tooltip.attr('style', '');

                    // D3.JS TRANSITION: Smooth fade-in animation (200ms)
                    tooltip.transition()
                        .duration(200)                          // Fast appearance for responsive feel
                        .style('opacity', 0.9);                 // Nearly opaque for readability

                    // TOOLTIP CONTENT GENERATION: Format energy flow information
                    const fuelName = this.configService.getFuelDisplayName(d.fuel);    // Human-readable fuel name
                    const sectorName = this.configService.getBoxDisplayName(d.box);    // Human-readable sector name  
                    const value = this.graphCalculationService.sigfig2(d.value);       // Formatted energy value

                    // CROSS-BROWSER MOUSE POSITION: Handle D3 v7 event changes
                    // Get mouse position from the event parameter
                    const mouseX = event?.pageX || 0;
                    const mouseY = event?.pageY || 0;

                    // TOOLTIP POSITIONING & CONTENT: Set HTML content and position
                    tooltip.html(`${fuelName} → ${sectorName}<div class='fuel_value'>${value}</div>`)
                        .style('left', `${mouseX}px`)           // Horizontal position follows cursor
                        .style('top', `${mouseY - 28}px`);     // Vertical offset prevents cursor overlap

                    this.highlightFuel(svg, fuelName)
                })  // Bind context for access to service methods

                // MOUSEOUT EVENT: Hide tooltip with smooth transition
                .on('mouseout', () => {
                    // D3.JS TRANSITION: Smooth fade-out animation (500ms)  
                    tooltip.transition()
                        .duration(500)                          // Slower fade-out allows reading time
                        .style('opacity', 0);                   // Fade to transparent

                    this.resetHighlight(svg)
                });
        });

        // EVENT SYSTEM INTEGRATION: Notify other services of rendering completion
        // Enables coordinated updates across the visualization system
        this.eventBus.emit({
            type: 'rendering.completed',
            timestamp: Date.now(),
            source: 'ChartRenderingService',
            data: {
                type: 'flows',
                year: graphData.year,
                flowCount: graphData.graph.length
            }
        });
    }

    /**
     * Clear chart content
     */
    public clearChart(svg: D3SVGSelection): void {
        svg.selectAll('*').remove();
    }

    public drawInitialChart(svg: D3SVGSelection, tooltip: D3DivSelection): boolean {
        const firstYearIndex = 0; // First year index

        const graphs = this.graphCalculationService.graphs;

        // Add fuel layers initialization
        // creates these groups and drawFlows() selects them
        for (const fuel of this.configService.FUELS) {
            svg.append('g').attr('class', `fuel ${fuel.fuel}`);
        }
        svg.append('g').attr('class', 'fuel waste');

        // Draw title with header information
        this.drawHeader();

        this.drawFlows(svg, firstYearIndex, tooltip);
        this.drawLeftLabels(svg, graphs[firstYearIndex].totals as YearTotals);
        this.drawBoxes(svg, graphs[firstYearIndex].totals as YearTotals);

        return true;
    }

    /**
     * Highlight specific fuel flows
     */
    public highlightFuel(svg: D3SVGSelection, fuelName: string): void {
        svg.selectAll('.flow')
            .style('opacity', function (this: any) {
                const fuel = d3.select(this).attr('data-fuel');
                return fuel === fuelName ? 1.0 : 0.3;
            });
    }

    /**
     * Reset highlighting
     */
    public resetHighlight(svg: D3SVGSelection): void {
        svg.selectAll('.flow')
            .style('opacity', function (this: any) {
                const fuel = d3.select(this).attr('data-fuel');
                return fuel === 'waste' ? 0.6 : 0.8;
            });
    }

    public parseLineData(stroke: GraphStroke): string {
        const points: GraphPoint[] = [stroke.a, stroke.b, stroke.c, stroke.d];
        return this.lineGenerator(points) || '';
    }
}
