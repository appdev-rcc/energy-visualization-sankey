import * as d3 from 'd3';
import {GraphData, SankeyOptions} from '@/types';
import {EventBus} from '@/core/events/EventBus';
import {SummaryService} from '@/services/calculation/SummaryService';
import {GraphService} from '@/services/calculation/GraphService';
import {Logger} from "@/utils/Logger";
import {DataService} from "@/services/data/DataService";
import {ConfigurationService} from "@/services/ConfigurationService";

// ==================== D3 SELECTION TYPES ====================

type D3SVGSelection = d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
type D3DivSelection = d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

// ==================== ANIMATION INTERFACES ====================

interface AnimationState {
    currentYearIndex: number;
    isAnimating: boolean;
    animationTimer: number | null;
    speed: number;
}

export interface GraphNest {
    strokes: { [year: number]: { [fuel: string]: { [sector: string]: number } } };
    tops: { [year: number]: { [fuel: string]: number } };
    heights: { [year: number]: { [sector: string]: number } };
    waste: { [year: number]: { [sector: string]: number } };
}

/**
 * Animation Control Service - Advanced Timeline Management & Smooth Transitions
 *
 * ARCHITECTURAL RESPONSIBILITY: Temporal Visualization Control & User Interaction
 *
 * This service implements sophisticated animation control patterns for temporal energy
 * visualizations, managing smooth year-to-year transitions, timeline navigation,
 * milestone events, and user interaction with historical energy data.
 *
 * TEMPORAL VISUALIZATION PATTERNS:
 * 1. **Timeline Navigation**: Seamless movement through 200+ years of energy history
 * 2. **State Management**: Centralized animation state with event-driven updates
 * 3. **Smooth Transitions**: D3.js-powered animations with configurable timing
 * 4. **Milestone Integration**: Interactive historical event markers and dialogs
 * 5. **User Controls**: Play/pause/seek controls with keyboard accessibility
 * 6. **Loop Management**: Configurable animation looping for presentations
 *
 * ANIMATION ARCHITECTURE:
 * - **Timeline State**: Current year, animation status, timing controls
 * - **Transition Management**: Smooth interpolation between energy data years
 * - **Interactive Controls**: Slider, buttons, and keyboard input handling
 * - **Milestone System**: Historical event markers with contextual information
 * - **Performance Optimization**: Efficient DOM updates and animation scheduling
 *
 * USER INTERACTION DESIGN:
 * - Intuitive timeline slider with year selection
 * - Responsive play/pause controls
 * - Keyboard navigation (arrow keys, space bar)
 * - Milestone hover/click interactions
 * - Configurable playback speed controls
 *
 * EVENT-DRIVEN INTEGRATION:
 * Communicates with other services via event bus for coordinated visual updates,
 * ensuring synchronized animation across all visualization components.
 */
export class AnimationService {
    // ANIMATION STATE MANAGEMENT: Centralized temporal navigation state
    // Tracks current position, timing, and animation status for coordinated updates
    private state: AnimationState = {
        currentYearIndex: 0,                    // Array index of current year in timeline
        isAnimating: false,                     // Animation playback status flag
        animationTimer: null,                   // JavaScript timer ID for animation loop
        speed: 200                              // Animation speed in milliseconds per year
    };

    // VISUALIZATION REFERENCES: D3.js selections and data structures
    // Maintained for efficient updates during animation transitions
    private svg: D3SVGSelection | null = null;              // Main chart SVG element
    private tooltip: D3DivSelection | null = null;          // Interactive tooltip element
    private graphs: GraphData[] = [];                       // Pre-calculated visualization data
    private graphNest: GraphNest | null = null;             // Nested data structure for efficient access
    private sliderWidth: number | null = null;

    constructor(
        private configService: ConfigurationService,
        private summaryCalculationService: SummaryService,
        private graphCalculationService: GraphService,
        private dataService: DataService,
        private options: SankeyOptions,
        private eventBus: EventBus,
        private logger: Logger,
    ) {
        // ANIMATION TIMING INITIALIZATION: Configure playback speed from user options
        // Speed determines milliseconds between year transitions during animation
        // Range: 50ms (very fast) to 1000ms+ (very slow) for different presentation needs
        this.state.speed = this.configService.SPEED;

        // ANIMATION CONTROL SERVICE READY: Timeline management system initialized
        // All temporal visualization capabilities are now available for energy data navigation
    }

    /**
     * Receives pre-built data structures and sets up animation system
     */
    public setupAnimation(
        graphs: GraphData[],
        graphNest: GraphNest,
        svg: D3SVGSelection,
        tooltip: D3DivSelection
    ): void {
        this.logger.log('AnimationService: Setting up animation controls...');

        // Extract years from graphs
        this.state.currentYearIndex = 0;

        // Store references in state
        this.svg = svg;
        this.tooltip = tooltip;
        this.graphs = graphs;
        this.graphNest = graphNest;

        // Set up complete timeline controls
        this.setupTimelineControls();

        // Initialize with first year
        this.setYear(this.dataService.firstYear);

        this.logger.log(`AnimationControlService: Animation setup complete for ${this.dataService.yearsLength} years`);
    }


    /**
     * Sets up slider, year labels, tick marks, and milestone interactions
     */
    private setupTimelineControls(): void {
        // Range slider event handler
        const animationServiceRef = this; // Capture reference for closure
        d3.select('#rangeSlider').on('input', function (this: any) {
            const rangeElement = this as HTMLInputElement; // 'this' is the slider element
            const value = parseFloat(rangeElement.value);

            // Call animation service method
            animationServiceRef.setYear(value);

            // Update slider indicator position
            animationServiceRef.updateSliderIndicator();
        });

        // Create timeline sliders
        const rangeSliderElement = document.getElementById('rangeSlider');
        this.sliderWidth = rangeSliderElement ?
            rangeSliderElement.getBoundingClientRect().width : 1200;

        // Top year labels
        const svgTopYear = d3.select('#axisTop')
            .style('margin', '-5px')
            .style('margin-left', '5px')
            .append('svg')
            .attr('id', 'sliderYear')
            .attr('width', this.sliderWidth)
            .attr('height', 40)
            .attr('preserveAspectRatio', 'xMinYMin meet')
            .attr('viewBox', `0 0 ${this.sliderWidth} 40`);

        // Bottom tick marks
        const svgTick = d3.select('#testTick')
            .style('height', '15px')
            .style('margin', '-5px')
            .style('margin-top', '-7px')
            .style('margin-left', '5px')
            .append('svg')
            .attr('id', 'slider')
            .attr('width', this.sliderWidth)
            .attr('height', 50)
            .attr('preserveAspectRatio', 'xMinYMin meet')
            .attr('viewBox', `0 0 ${this.sliderWidth} 50`);

        // Set up milestone years and dialogs
        this.setupMilestones(svgTopYear, svgTick);

        // Initialize slider range and position
        const rangeSlider = document.getElementById('rangeSlider') as HTMLInputElement;
        if (rangeSlider) {
            rangeSlider.min = this.dataService.firstYear.toString();
            rangeSlider.max = this.dataService.lastYear.toString();
            rangeSlider.value = this.dataService.firstYear.toString();

            // Initialize indicator position
            this.updateSliderIndicator();
        }
    }

    /**
     * Creates milestone markers and dialog interactions
     */
    private setupMilestones(
        svgTopYear: D3SVGSelection,
        svgTick: D3SVGSelection,
    ): void {
        // All milestone years identified for timeline visualization
        const scale = d3.scaleLinear()
            .range([0, this.sliderWidth! - this.configService.LEFT_X])
            .domain([this.dataService.firstYear, this.dataService.lastYear]);

        let step = 15;
        if (this.dataService.yearsLength < 50) {
            step = 5;
        }
        const yearTop = [];
        for (let i = 5; i < this.dataService.yearsLength; i += step) {
            yearTop.push(this.dataService.years[i]);
        }

        // Top axis with year labels
        const axisTop = d3.axisTop(scale)
            .tickValues(yearTop)
            .tickFormat(d => Math.floor(d as number).toString());

        const gY = svgTopYear.append("g")
            .attr("transform", "translate(0, 53)")
            .call(axisTop)
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll("line").remove());

        gY.selectAll('.tick text').attr('y', -25);

        // Extract milestone years
        const milestoneYears: number[] = this.dataService.getYearsWithMilestones();

        // Bottom axis with milestone markers
        const axisBottom = d3.axisBottom(scale)
            .tickValues(milestoneYears)
            .tickFormat(() => "\u25CF"); // Black dot character

        const gX = svgTick.append("g")
            .attr("transform", "translate(4, 0)")
            .call(axisBottom)
            .call(g => g.select(".domain").remove());

        gX.selectAll('.tick text')
            .attr("data-toggle", "dialog")
            .style("font-size", "20px")
            .attr('y', 3);

        // Set up milestone dialog interactions
        this.setupMilestoneDialogs(gX);
    }

    /**
     * Handles milestone dot clicks and dialog positioning
     */
    private setupMilestoneDialogs(
        gX: any,
    ): void {

        // Create dialog object
        const milestoneDialog = this.createMilestoneDialog();

        // Global click handler for closing dialog
        setTimeout(() => {
            document.addEventListener('click', (event: MouseEvent) => {
                const dialog = document.getElementById('dialog');
                if (!dialog || !milestoneDialog.isOpen) return;

                const isClickInsideDialog = dialog.contains(event.target as Node);
                const tickElement = (event.target as Element).closest('.tick');
                const isClickOnMilestone = tickElement !== null;

                if (!isClickInsideDialog && !isClickOnMilestone) {
                    milestoneDialog.close();
                }
            }, true);
        }, 100);

        // Milestone click handlers (proper D3 context)
        // Configure interactive milestone click handlers
        const animationServiceRef = this; // Capture reference for closure

        gX.selectAll(".tick").select("text")
            .on("click", function (this: any, event: any, d: any) {
                // Milestone interaction detected for year navigation
                const clickedElement = this as HTMLElement; // Now 'this' is the DOM element
                const year = d; // Year is passed as data

                // Stop propagation
                if (event) {
                    event.stopPropagation();
                }

                // Set diagram to this year
                animationServiceRef.setYear(year);

                // Update slider
                const rangeSlider = d3.select('#rangeSlider').node() as HTMLInputElement;
                if (rangeSlider) {
                    rangeSlider.focus();
                    rangeSlider.value = year.toString();
                }

                animationServiceRef.updateSliderIndicator();

                // Stop any running animation
                if (animationServiceRef.state.animationTimer) {
                    animationServiceRef.pause();
                }

                d3.select("#play-button").classed("playbutton", true);

                // Show milestone dialog
                const yearData = animationServiceRef.dataService.getYearData(year);
                // Year milestone information retrieved

                if (!yearData?.milestone) {
                    // No milestone data available for specified year
                    return;
                }

                // Display milestone dialog with historical content

                // Calculate dialog positioning
                const milestoneYearGroups = {
                    left: yearData.year >= 1800 && yearData.year <= 1862,
                    center: yearData.year >= 1877 && yearData.year <= 1933,
                    right: yearData.year >= 1947 && yearData.year <= 2019,
                };

                const dialogContent = `<b>${yearData.year}: </b>${yearData.milestone}`;
                const dialogWidth = Math.ceil(animationServiceRef.sliderWidth! / 2);
                const rect = clickedElement.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                let leftPosition: number;

                if (milestoneYearGroups.left) {
                    leftPosition = rect.left + scrollLeft;
                } else if (milestoneYearGroups.right) {
                    leftPosition = rect.right + scrollLeft - dialogWidth;
                } else {
                    leftPosition = rect.left + scrollLeft + (rect.width / 2) - (dialogWidth / 2);
                }

                leftPosition = Math.max(10, Math.min(leftPosition, window.innerWidth - dialogWidth - 10));

                if (milestoneDialog.isOpen) {
                    milestoneDialog.close();
                }

                setTimeout(() => {
                    milestoneDialog.html(dialogContent);
                    const topPosition = rect.bottom + scrollTop + 5;

                    if (milestoneDialog.dialog) {
                        milestoneDialog.dialog.style.width = `${dialogWidth}px`;
                        milestoneDialog.dialog.style.left = `${leftPosition}px`;
                        milestoneDialog.dialog.style.top = `${topPosition}px`;
                    }

                    milestoneDialog.open();

                    // Mobile adjustments
                    if (window.innerWidth < 768) {
                        milestoneDialog.dialog.style.width = `${window.innerWidth - 20}px`;
                    }
                }, 20);
            })
            .style('cursor', 'pointer')
            .attr('title', function (this: any, d: any) {
                const year = d as number;
                const milestoneData = animationServiceRef.dataService!.getYearData(year);
                return milestoneData?.milestone ? `Click to see ${year} milestone` : '';
            });
    }

    /**
     * Creates dialog element with same styling and behavior
     */
    private createMilestoneDialog(): any {
        let dialogElement = document.getElementById('dialog');
        if (!dialogElement) {
            dialogElement = document.createElement('div');
            dialogElement.id = 'dialog';
            dialogElement.style.opacity = '0';
            document.body.appendChild(dialogElement);
        }

        return {
            isOpen: false,
            dialog: dialogElement,
            open() {
                this.dialog.style.display = 'block';
                this.dialog.style.visibility = 'visible';
                this.dialog.style.position = 'absolute';
                this.dialog.style.background = '#fff';
                this.dialog.style.border = '1px solid #ddd';
                this.dialog.style.borderRadius = '4px';
                this.dialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                this.dialog.style.padding = '15px';
                this.dialog.style.zIndex = '1000';
                this.dialog.style.fontSize = '14px';
                this.dialog.style.lineHeight = '1.4';
                this.dialog.style.color = '#333';
                this.dialog.style.maxWidth = '90vw';
                this.dialog.style.opacity = '1';
                this.isOpen = true;
            },
            close() {
                this.dialog.style.opacity = '0';
                this.dialog.style.display = 'none';
                this.isOpen = false;
            },
            html(content: string) {
                this.dialog.innerHTML = content;
            },
            option(options: { width?: number | string; position?: any }) {
                if (options.width) {
                    this.dialog.style.width = typeof options.width === 'number' ?
                        `${options.width}px` : options.width;
                }
            }
        };
    }

    /**
     * Set up play/pause button controls
     */
    private setupPlayControls(): void {
        const playButton = document.getElementById('play-button');
        if (!playButton) return;

        playButton.addEventListener('click', () => {
            if (this.state.isAnimating) {
                this.pause();
            } else {
                this.play();
            }
        });

        // Set initial state
        playButton.className = 'playbutton';
        this.state.isAnimating = false;
    }

    /**
     * Set up year display element
     */
    private setupYearDisplay(): void {
        const yearOutput = document.getElementById('dynamicYear') as HTMLOutputElement;
        if (yearOutput) {
            yearOutput.textContent = this.dataService.years[0].toString();
        }
    }

    /**
     * Set Year - Programmatic Timeline Navigation with Coordinated Updates
     *
     * NAVIGATION RESPONSIBILITY: Move visualization to specific year with system-wide coordination
     *
     * This method implements the core temporal navigation functionality, orchestrating
     * synchronized updates across all visualization components when changing years.
     * Essential for both user interaction (slider) and programmatic control (API).
     *
     * COORDINATED UPDATE SEQUENCE:
     * 1. **State Validation**: Verify target year exists in available data
     * 2. **State Update**: Update internal animation state to new year
     * 3. **UI Synchronization**: Update slider position to reflect state
     * 4. **Visualization Update**: Trigger complex chart transition animations
     * 5. **Visual Indicators**: Update timeline position indicators
     * 6. **Display Update**: Update year text display elements
     * 7. **Event Broadcasting**: Notify other services of year change
     *
     * ANIMATION INTEGRATION:
     * Seamlessly integrates with animation playback - can be called during
     * active animation for smooth seeking or by user interaction for direct navigation.
     *
     * PERFORMANCE CONSIDERATIONS:
     * Efficiently updates only necessary DOM elements and triggers minimal
     * re-calculations by leveraging pre-computed mathematical data structures.
     */
    public setYear(year: number): void {
        // YEAR VALIDATION: Ensure target year exists in available data
        const yearIndex = this.dataService.getYearIndex(year);
        if (yearIndex === -1) {
            console.warn(`AnimationControlService: Year ${year} not found in available years`);
            return;
        }

        // PREVIOUS STATE TRACKING: Capture current state for event data and comparison
        const previousYear = this.getCurrentYear();

        // STATE UPDATE: Set new current year position in timeline
        this.state.currentYearIndex = yearIndex;

        // UI SYNCHRONIZATION: Update range slider position to reflect new state
        // Critical for maintaining UI consistency when year is changed programmatically
        const rangeSlider = document.getElementById('rangeSlider') as HTMLInputElement;
        if (rangeSlider) {
            rangeSlider.value = year.toString();
        }

        // VISUALIZATION UPDATE: Trigger complex chart transition to new year
        // This is the core visualization update mechanism - handles all visual transitions
        this.animatePeriod(yearIndex);

        // DISPLAY ELEMENT UPDATES: Update year text display
        this.updateYearDisplay(year);

        // EVENT SYSTEM INTEGRATION: Notify other services of year change
        // Enables coordinated updates across the entire visualization system
        this.eventBus.emit({
            type: 'year.changed',
            timestamp: Date.now(),
            source: 'AnimationControlService',
            data: {
                year, // New target year
                previousYear, // Previous year for transition context
                yearIndex, // Array index for efficient data access
                isAnimating: this.state.isAnimating // Animation state for context
            },
        });
    }

    /**
     * Handles the complex animation transitions between years
     */
    private animatePeriod(yearIndex: number): void {
        if (!this.svg || !this.graphs || !this.graphNest) return;

        const svg = this.svg;
        const tooltip = this.tooltip;
        const graphs = this.graphs;
        const graphNest = this.graphNest;

        // Hide/show labels based on data values
        svg.selectAll('.label')
            .classed('hidden', function (this: any) {
                const d = d3.select(this);
                if (d.classed('sector')) {
                    const sector = d.attr('data-sector');
                    return graphs[yearIndex]?.totals[sector] <= 0;
                } else if (d.classed('fuel')) {
                    const fuel = d.attr('data-fuel');
                    return graphs[yearIndex]?.totals[fuel] <= 0;
                }
                return false;
            });

        // Set up hover interactions and animations
        const configService = this.configService;
        const graphCalculationService = this.graphCalculationService;
        const summaryCalculationService = this.summaryCalculationService;
        const years = this.dataService.years;

        d3.selectAll('.animate')
            .on('mouseover', function (this: any, event: any) {
                if (!tooltip) return;

                const d = d3.select(this);

                if (d.classed('flow')) {
                    const fuel = d.attr('data-fuel');
                    const sector = d.attr('data-sector');

                    const flowData = graphs[yearIndex]?.graph.find((e: any) =>
                        e.fuel === fuel && e.box === sector
                    );

                    if (flowData) {
                        tooltip.attr("style", "");
                        tooltip.transition().duration(200).style('opacity', 1);

                        const fuelName = configService.getFuelDisplayName(flowData.fuel);
                        const sectorName = configService.getBoxDisplayName(flowData.box);
                        const value = graphCalculationService.sigfig2(flowData.value);

                        // use event object for mouse position
                        const mouseX = event?.pageX || 0;
                        const mouseY = event?.pageY || 0;

                        tooltip.html(`${fuelName} → ${sectorName}<div class='fuel_value'>${value}</div>`)
                            .style('left', `${mouseX}px`)
                            .style('top', `${mouseY - 35}px`);
                    }
                } else if (d.classed('fuel') && !d.classed('elec') && !d.classed('heat')) {
                    if (!tooltip) return;

                    tooltip.attr("style", "");
                    tooltip.transition().duration(200).style('opacity', 1);

                    const fuel = d.attr('data-fuel');
                    const value = parseFloat(d.attr('data-value') || '0');
                    const fuelName = configService.getFuelDisplayName(fuel);

                    // use event object for mouse position
                    const mouseX = event?.pageX || 0;
                    const mouseY = event?.pageY || 0;

                    tooltip.html(`${fuelName} → ${graphCalculationService.sigfig2(value)}`)
                        .style('left', `${mouseX}px`)
                        .style('top', `${mouseY - 35}px`);
                }
            })
            .on('mouseout', () => {
                if (tooltip) {
                    tooltip.transition().duration(500).style('opacity', 0);
                }
            })
            .transition()
            .duration(5 * this.configService.SPEED)
            .ease(d3.easeLinear)
            .on('start', function (this: any) {
                const d = d3.select(this);
                const activeTransition = d3.active(this);

                if (!activeTransition) return;

                activeTransition
                    .attr('d', function (this: any) {
                        if (d.classed('flow')) {
                            const fuel = d.attr('data-fuel');
                            const sector = d.attr('data-sector');

                            const flowData = graphs[yearIndex]?.graph.find((e: any) =>
                                e.fuel === fuel && e.box === sector
                            );

                            if (flowData) {
                                const lineGen = graphCalculationService.createLine();
                                return lineGen([flowData.a, flowData.b, flowData.c, flowData.d]);
                            }
                        }
                        return d.attr('d');
                    })
                    .attr('stroke-width', function (this: any) {
                        if (d.classed('flow')) {
                            // access stroke value directly
                            let s = graphNest.strokes[years[yearIndex]][d.attr('data-fuel')][d.attr('data-sector')] as unknown as number;
                            if (s > 0) {
                                return s + configService.BLEED;
                            }
                            return 0;
                        }
                        return d.attr('stroke-width');
                    })
                    .attr('y', function (this: any) {
                        if (d.classed('box') && d.classed('fuel')) {
                            return graphNest.tops[years[yearIndex]][d.attr('data-fuel')];
                        } else if (d.classed('label') && d.classed('fuel')) {
                            return graphNest.tops[years[yearIndex]][d.attr('data-fuel')] - 5;
                        }
                        return d.attr('y');
                    })
                    .attr('height', function (this: any) {
                        if (d.classed('box') && d.classed('sector')) {
                            return graphNest.heights[years[yearIndex]][d.attr('data-sector')];
                        }
                        return d.attr('height');
                    })
                    .attr('data-value', function (this: any) {
                        if (d.classed('label') && d.classed('fuel') && !d.classed('elec') && !d.classed('heat')) {
                            return graphs[yearIndex].totals[d.attr('data-fuel')];
                        }
                        return d.attr('data-value');
                    })
                    .tween('text', function (this: any): any {
                        const that = this as HTMLElement;

                        if (d.classed('year')) {
                            const a = parseInt(that.textContent || '0');
                            const b = years[yearIndex];
                            return function (t: number) {
                                const v = a + (b - a) * t;
                                that.setAttribute('data-value', v.toString());
                                that.textContent = Math.round(v).toString();
                            };
                        } else if (d.classed('year-total')) {
                            // calculate total energy usage per capita
                            return function (t: number) {
                                const yearSums = summaryCalculationService.yearSums!;
                                const sum_value = Math.floor(yearSums[years[yearIndex]] || 0);
                                that.setAttribute('data-value', sum_value.toString());
                                that.textContent = `${Math.round(sum_value)} W/capita`;
                            };
                        } else if (d.classed('waste-level')) {
                            // animate waste heat values
                            const a = parseFloat(that.getAttribute('data-value') || '0');
                            const b = graphNest.waste[years[yearIndex]]?.[that.getAttribute('data-sector') || ''] || 0;
                            return function (t: number) {
                                const v = a + (b - a) * t;
                                that.setAttribute('data-value', v.toString());
                                that.textContent = (graphCalculationService.sigfig2(v) || 0).toString();
                            };
                        } else if (d.classed('total')) {
                            const a = parseFloat(that.getAttribute('data-value') || '0');
                            const b = graphs[yearIndex].totals[that.getAttribute('data-sector') || ''] || 0;
                            return function (t: number) {
                                const v = a + (b - a) * t;
                                that.setAttribute('data-value', v.toString());
                                that.textContent = graphCalculationService.sigfig2(v).toString();
                            };
                        }

                        return null;
                    });
            });

        // Update slider position
        this.updateSliderIndicator();
    }

    /**
     * Updates the position and content of the year indicator above the slider
     */
    private updateSliderIndicator(): void {
        const slider = document.getElementById("rangeSlider") as HTMLInputElement;
        const indicator = document.getElementById('dynamicYear') as HTMLElement;

        if (!slider || !indicator) return;

        // Get current year and slider state
        const currentYear = this.getCurrentYear();
        const minYear = this.dataService.firstYear;
        const maxYear = this.dataService.lastYear;

        // Calculate precise positioning
        const position = this.calculateIndicatorPosition(slider, currentYear, minYear, maxYear);

        // Apply positioning and content
        this.applyIndicatorPosition(indicator, position, currentYear);
    }

    private calculateIndicatorPosition(
        slider: HTMLInputElement,
        currentYear: number,
        minYear: number,
        maxYear: number
    ): number {
        const sliderRect = slider.getBoundingClientRect();
        const progress = (currentYear - minYear) / (maxYear - minYear);

        // Account for thumb dimensions (11px width from CSS)
        const thumbWidth = 11;
        const effectiveWidth = sliderRect.width - thumbWidth;
        const thumbCenter = (thumbWidth / 2) + (progress * effectiveWidth);

        // Center 54px indicator over thumb
        return thumbCenter - 26; // 54px / 2 = 26px
    }

    private applyIndicatorPosition(
        indicator: HTMLElement,
        position: number,
        year: number
    ): void {
        indicator.style.left = `${position}px`;
        indicator.textContent = year.toString();

        this.logger.log(`AnimationControlService: Indicator positioned: ${position.toFixed(1)}px for year ${year}`);
    }

    private updateYearDisplay(year: number): void {
        const yearOutput = document.getElementById('dynamicYear') as HTMLOutputElement;
        if (yearOutput) {
            yearOutput.textContent = year.toString();
        }
    }

    // ==================== PUBLIC ANIMATION CONTROL METHODS ====================

    /**
     * Start Animation Playback - Temporal Visualization Timeline Control
     *
     * PLAYBACK RESPONSIBILITY: Initiate automated year-by-year progression through energy data
     *
     * This method starts the animation loop that automatically advances through years
     * of energy data, creating a cinematic progression through US energy history.
     * Essential for presentation mode and automated demonstration of energy trends.
     *
     * ANIMATION LIFECYCLE MANAGEMENT:
     * 1. **Guard Clause**: Prevent multiple simultaneous animations
     * 2. **State Update**: Set animation flag for system-wide coordination
     * 3. **UI Update**: Change play button to pause state for user feedback
     * 4. **Timer Initialization**: Start interval-based animation loop
     * 5. **Event Broadcasting**: Notify other services animation has started
     *
     * TIMING MECHANISM:
     * Uses JavaScript setInterval() for consistent frame timing at configured speed.
     * Timer interval determined by this.state.speed (milliseconds between years).
     * Each timer tick calls nextFrame() for year progression logic.
     *
     * USER INTERACTION INTEGRATION:
     * Updates visual play button state to indicate animation status,
     * providing immediate visual feedback for user understanding.
     */
    public play(): void {
        // GUARD CLAUSE: Prevent multiple simultaneous animations
        // Essential for preventing timer conflicts and state corruption
        if (this.state.isAnimating) return;

        // STATE UPDATE: Set animation active flag for system coordination
        this.state.isAnimating = true;

        // UI FEEDBACK: Update play button visual state for user clarity
        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.className = 'playpaused';                    // Visual state: playing → show pause icon
        }

        // ANIMATION TIMER INITIALIZATION: Start automated year progression
        // setInterval creates consistent timing for smooth temporal navigation
        this.state.animationTimer = window.setInterval(() => {
            this.nextFrame();                                       // Advance to next year in sequence
        }, this.state.speed);                                       // Configurable timing (50-1000ms typically)

        // EVENT SYSTEM INTEGRATION: Broadcast animation start to other services
        // Enables coordinated behavior across visualization components during playback
        this.eventBus.emit({
            type: 'animation.started',
            timestamp: Date.now(),
            source: 'AnimationControlService',
            data: {
                isPlaying: true,
                currentYear: this.getCurrentYear(), // Starting year for context
                speed: this.state.speed // Playback speed for coordination
            },
        });
    }

    /**
     * Pause Animation Playback - Temporal Visualization Control
     *
     * PAUSE RESPONSIBILITY: Stop automated timeline progression while preserving current position
     *
     * This method halts the animation loop while maintaining the current year position,
     * enabling users to pause for detailed examination of specific time periods.
     * Critical for interactive exploration and presentation control.
     *
     * PAUSE LIFECYCLE MANAGEMENT:
     * 1. **Guard Clause**: Ensure animation is actually running before stopping
     * 2. **State Update**: Clear animation flag for system coordination
     * 3. **UI Update**: Restore play button state for user interface consistency
     * 4. **Timer Cleanup**: Properly clear interval timer to prevent memory leaks
     * 5. **Event Broadcasting**: Notify other services animation has stopped
     *
     * RESOURCE MANAGEMENT:
     * Properly clears JavaScript interval timer to prevent continued execution
     * and potential memory leaks during long-running visualization sessions.
     */
    public pause(): void {
        // GUARD CLAUSE: Only pause if animation is currently active
        // Prevents unnecessary state changes and event emissions
        if (!this.state.isAnimating) return;

        // STATE UPDATE: Clear animation active flag for system coordination
        this.state.isAnimating = false;

        // UI FEEDBACK: Restore play button visual state
        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.className = 'playbutton';                    // Visual state: paused → show play icon
        }

        // TIMER CLEANUP: Stop animation interval and prevent memory leaks
        if (this.state.animationTimer) {
            clearInterval(this.state.animationTimer);               // Stop the automated year progression
            this.state.animationTimer = null;                       // Clear timer reference
        }

        // EVENT SYSTEM INTEGRATION: Broadcast animation stop to other services
        // Enables coordinated pause behavior across visualization components
        this.eventBus.emit({
            type: 'animation.stopped',
            timestamp: Date.now(),
            source: 'AnimationControlService',
            data: {
                isPlaying: false,
                currentYear: this.getCurrentYear(), // Current position preserved
                speed: this.state.speed // Speed settings maintained
            }
        });
    }

    /**
     * Move to next frame in animation
     * Stop at end instead of looping
     */
    private nextFrame(): void {
        // Handle end of animation based on loopAnimation option
        if (this.state.currentYearIndex + 1 >= this.dataService.yearsLength) {
            this.state.currentYearIndex = 0;

            if (!this.options.loopAnimation) {
                // Stop at end
                this.pause();
                return;
            }
        }

        this.nextYear()
    }

    /**
     * Set animation speed AnimationService.setSpeed()
     */
    public setSpeed(speed: number): void {
        if (speed <= 0) {
            throw new Error('Animation speed must be positive');
        }

        this.state.speed = speed;

        // If currently playing, restart with new speed
        if (this.state.isAnimating) {
            this.pause();
            setTimeout(() => {
                this.play();
            }, 100);
        }

        // Emit speed changed event
        this.eventBus.emit({
            type: 'speed.changed',
            timestamp: Date.now(),
            source: 'AnimationControlService',
            data: {
                speed
            }
        });

        // Animation speed updated for timeline playback
    }

    /**
     * Check if animation is currently playing
     */
    public isPlaying(): boolean {
        return this.state.isAnimating;
    }

    /**
     * Get current year
     */
    public getCurrentYear(): number {
        return this.dataService.years[this.state.currentYearIndex] || this.dataService.firstYear;
    }

    /**
     * Move to next year
     */
    public nextYear(): void {
        if (this.state.currentYearIndex < this.dataService.yearsLength - 1) {
            this.state.currentYearIndex++;
            this.setYear(this.dataService.years[this.state.currentYearIndex]);
        }
    }

    /**
     * Move to previous year
     */
    public previousYear(): void {
        if (this.state.currentYearIndex > 0) {
            this.state.currentYearIndex--;
            this.setYear(this.dataService.years[this.state.currentYearIndex]);
        }
    }

    /**
     * Clean up animation resources
     */
    public cleanup(): void {
        this.pause();

        // Clear state
        this.state.currentYearIndex = 0;
        this.state.isAnimating = false;
        this.svg = null;
        this.tooltip = null;
        this.graphs = [];
        this.graphNest = null;

        // Animation service cleanup completed successfully
    }
}
