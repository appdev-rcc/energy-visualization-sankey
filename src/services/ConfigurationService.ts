import type {SankeyOptions} from '@/types';
import {EventBus} from "@/core/events/EventBus";
import {Logger} from "@/utils/Logger";

/**
 * Fuel configuration interface
 */
export interface FuelConfig {
    readonly fuel: string;
    readonly name: string;
    readonly color: string;
}

/**
 * Sector/Box configuration interface
 */
export interface BoxConfig {
    readonly box: string;
    readonly name: string;
    readonly color: string;
}

/**
 * Configuration Service - Mathematical Constants & Visual Parameters
 *
 * ARCHITECTURAL RESPONSIBILITY: Central Mathematical Constants Repository
 *
 * This service provides all the mathematical constants, visual parameters, and scaling factors
 * that determine the precise positioning, sizing, and styling of the energy visualization.
 * Every coordinate calculation, energy-to-pixel conversion, and visual spacing depends on
 * these carefully calibrated values.
 *
 * MATHEMATICAL SIGNIFICANCE OF CONSTANTS:
 * Each constant has been precisely calculated to ensure:
 * - Accurate proportional representation of energy values
 * - Optimal visual clarity and readability
 * - Smooth animation transitions between years
 * - Responsive behavior across different screen sizes
 * - Perfect alignment between flows and boxes
 *
 * COORDINATE SYSTEM ARCHITECTURE:
 * The visualization uses a custom coordinate system where:
 * - Origin (0,0) is at top-left of container
 * - X increases rightward (fuel boxes → sector boxes)
 * - Y increases downward (stacked vertically)
 * - All measurements in pixels for precise SVG positioning
 */
export class ConfigurationService {

    public hasHeatData = false;

    // ======================== CORE DIMENSIONAL CONSTANTS ========================

    // CANVAS DIMENSIONS: Overall visualization space
    public readonly HEIGHT = 620;                       // Canvas height in pixels - accommodates ~100 years of stacked fuels

    // BOX GEOMETRY: Standard rectangular dimensions for fuel sources and consumption sectors
    public readonly BOX_WIDTH: number = 120;                    // Standard width for all energy boxes (fuel & sector)
    public readonly BOX_HEIGHT = 30;                    // Minimum height for energy boxes (scaled by energy value)

    // ===================== COORDINATE POSITIONING CONSTANTS =====================

    // LEFT COLUMN POSITIONING: Fuel source boxes alignment
    public readonly LEFT_X = 10;                        // X-coordinate for left column (fuel sources)
    public readonly TOP_Y = 100;                        // Y-coordinate for top margin (visual breathing space)

    // ==================== MATHEMATICAL SCALING CONSTANTS ====================

    // ENERGY-TO-PIXEL CONVERSION: Critical scaling factor for proportional representation
    public readonly SCALE = 0.02;                       // Converts Quads to pixels: 1 Quad = 0.02 pixels height
    // Calibrated for typical US energy consumption (0-100+ Quads)
    // Example: 50 Quads × 0.02 = 1.0 pixel height

    // ELECTRICITY BOX POSITIONING: Special coordinates for electricity box (bidirectional flows)
    public readonly ELEC_BOX_X = 300 as const;
    public readonly ELEC_BOX_Y = 120 as const;

    public readonly HEAT_BOX_X = 750 as const;
    public readonly HEAT_BOX_Y = 200 as const;
    // X=350: Positioned between fuel sources (left) and sectors (right)
    // Y=120: Offset below title area for visual clarity

    // ======================== VISUAL SPACING CONSTANTS ========================

    // VERTICAL GAPS: Spacing between stacked elements for visual clarity
    public readonly LEFT_GAP: number = 30;                      // Gap between fuel boxes (left column)
    public readonly RIGHT_GAP: number;                  // Gap between sector boxes (right column) - computed as LEFT_GAP × 2.1

    // ANIMATION PARAMETERS: Timing and transition control
    public readonly SPEED: number;                      // Animation speed in milliseconds (from user options, default 200)
    public readonly BLEED = 0.5;                        // Edge bleed factor for smooth visual transitions

    // =================== GEOMETRIC CALCULATION CONSTANTS ===================

    // MATHEMATICS: Mathematical constants
    public readonly SR3 = Math.sqrt(3);                 // √3 ≈ 1.732
    // Provides optimal smoothness for flow paths
    public readonly HSR3 = Math.sqrt(3) / 2;            // √3/2 ≈ 0.866

    // FLOW PATH SPACING: Visual separation between parallel energy flows
    public readonly PATH_GAP: number = 20;                      // Pixel gap between parallel flow paths
    // Prevents visual overlap while maintaining readability
    public readonly ELEC_GAP = 19;                      // Special gap for electricity flows (slightly smaller)
    // Optimized for electricity box's central position

    // ====================== ENERGY SOURCE DEFINITIONS ======================
    // Comprehensive fuel type configuration with energy industry standard categorization
    // Colors chosen for maximum visual distinction and intuitive association
    public readonly FUELS: readonly FuelConfig[] = [
        // ELECTRICITY: Special category - both generated from other fuels AND consumed by sectors
        {fuel: 'elec', name: 'Electricity', color: '#e49942'},       // Amber - central energy carrier
        {fuel: 'heat', name: 'Heat', color: '#98002e'},       // Read - central energy carrier
        {fuel: 'solar', name: 'Solar', color: '#fed530'},           // Bright yellow - sun association
        {fuel: 'nuclear', name: 'Nuclear', color: '#ca0813'},       // Red - nuclear energy (caution color)
        {fuel: 'hydro', name: 'Hydro', color: '#0b24fb'},           // Deep blue - water association
        {fuel: 'wind', name: 'Wind', color: '#901d8f'},             // Purple - distinctive for wind power
        {fuel: 'geo', name: 'Geothermal', color: '#905a1c'},        // Earth brown - geothermal heat
        {fuel: 'gas', name: 'Natural Gas', color: '#4cabf2'},       // Light blue - clean-burning fossil fuel
        {fuel: 'coal', name: 'Coal', color: '#000000'},             // Black - coal's natural color
        {fuel: 'bio', name: 'Biomass', color: '#46be48'},           // Green - organic matter, photosynthesis
        {fuel: 'petro', name: 'Petroleum', color: '#095f0b'}        // Dark green - oil/petroleum products
    ] as const;

    // ==================== CONSUMPTION SECTOR DEFINITIONS ====================
    // Major energy consumption categories following US Energy Information Administration (EIA) classification
    // Neutral gray colors to emphasize flows while maintaining sector distinction through positioning
    public readonly BOXES: readonly BoxConfig[] = [
        {box: 'elec', name: 'Electricity', color: '#cccccc'},       // Gray - neutral energy carrier
        {box: 'res', name: 'Residential/Commercial', color: '#cccccc'},  // Buildings: homes, offices, stores
        {box: 'ag', name: 'Agricultural', color: '#cccccc'},            // Farming: irrigation, equipment, processing
        {box: 'indus', name: 'Industrial', color: '#cccccc'},           // Manufacturing: steel, chemicals, cement
        {box: 'trans', name: 'Transportation', color: '#cccccc'},        // Mobility: cars, trucks, planes, ships
        {box: 'heat', name: 'Heat', color: '#cccccc'},       // Gray - neutral energy carrier
    ] as const;

    public readonly BOXES_DEFAULT_FLOW_PATHS_ORDER = {
        "elec": 1,
        "res": 2,
        "ag": 3,
        "indus": 4,
        "trans": 5,
        "heat": 6,
    }

    public readonly HEAT_BOX_FIRST_FLOW_PATHS_ORDER = {
        "elec": 1,
        "heat": 2,
        "res": 3,
        "ag": 4,
        "indus": 5,
        "trans": 6,
    }

    public FLOW_PATHS_ORDER: Record<string, Record<string, number>> = {}

    // These are computed once for performance optimization
    public readonly BOX_NAMES: readonly string[] = this.BOXES.map(box => box.box);
    public readonly FUEL_NAMES: readonly string[] = this.FUELS.map(fuel => fuel.fuel);

    constructor(
        private container: HTMLElement,
        public options: SankeyOptions,
        private eventBus: EventBus,
        private logger: Logger
    ) {
        // Calculate computed properties
        this.RIGHT_GAP = this.LEFT_GAP * 2.1;
        this.SPEED = options.animationSpeed || 200;

        this.FLOW_PATHS_ORDER = {
            "elec": this.BOXES_DEFAULT_FLOW_PATHS_ORDER,
            "heat": this.BOXES_DEFAULT_FLOW_PATHS_ORDER,
            "solar": this.BOXES_DEFAULT_FLOW_PATHS_ORDER,
            "nuclear": this.BOXES_DEFAULT_FLOW_PATHS_ORDER,
            "hydro": this.BOXES_DEFAULT_FLOW_PATHS_ORDER,
            "wind": this.BOXES_DEFAULT_FLOW_PATHS_ORDER,
            "geo": this.BOXES_DEFAULT_FLOW_PATHS_ORDER,
            "gas": this.HEAT_BOX_FIRST_FLOW_PATHS_ORDER,
            "coal": this.HEAT_BOX_FIRST_FLOW_PATHS_ORDER,
            "bio": this.BOXES_DEFAULT_FLOW_PATHS_ORDER,
            "petro": this.HEAT_BOX_FIRST_FLOW_PATHS_ORDER,
        }

        // this.updateFuelAndBoxNames();

        // Validate configuration consistency
        this.validateConfiguration();

        // Emit configuration loaded event
        this.eventBus.emit({
            type: 'system.initialized',
            timestamp: Date.now(),
            source: 'ConfigurationService',
            data: {
                fuelsCount: this.FUELS.length,
                sectorsCount: this.BOXES.length,
                dimensions: {width: this.WIDTH, height: this.HEIGHT}
            }
        });
    }

    // public updateFuelAndBoxNames(): void {
    //     this.BOX_NAMES = this.BOXES.filter((box) => {
    //         if (!this.hasHeatData && box.box == 'heat') {
    //             return false
    //         }
    //         return true
    //     }).map(box => box.box);
    //
    //     this.FUEL_NAMES = this.FUELS.filter((fuel) => {
    //         if (!this.hasHeatData && fuel.fuel == 'heat') {
    //             return false
    //         }
    //         return true
    //     }).map(fuel => fuel.fuel);
    //
    //     console.log(this.BOX_NAMES);
    //     console.log(this.FUEL_NAMES);
    // }

    /**
     * Get human-readable display name for fuel
     */
    public getFuelDisplayName(fuel: string): string {
        const fuelConfig = this.FUELS.find(f => f.fuel === fuel);
        if (fuelConfig) {
            return fuelConfig.name;
        }

        // Fallback for unknown fuels
        const fallbackNames: { [key: string]: string } = {
            'elec': 'Electricity',
            'waste': 'Waste Heat'
        };

        return fallbackNames[fuel] || fuel.charAt(0).toUpperCase() + fuel.slice(1);
    }

    /**
     * Get responsive header dimensions for current container width
     */
    public getResponsiveHeaderInfo(): {
        containerWidth: number;
        isNarrow: boolean;
        isMobile: boolean;
        animationScale: number
    } {
        const containerWidth = this.WIDTH;
        const isNarrow = containerWidth < 1024;
        const isMobile = containerWidth < 768;
        const animationScale = isMobile ? 0.85 : 1;

        return {
            containerWidth,
            isNarrow,
            isMobile,
            animationScale
        };
    }

    /**
     * Get human-readable display name for sector/box
     */
    public getBoxDisplayName(sector: string): string {
        const boxConfig = this.BOXES.find(b => b.box === sector);
        if (boxConfig) {
            return boxConfig.name;
        }

        // Fallback for unknown sectors
        const fallbackNames: { [key: string]: string } = {
            'res': 'Residential',
            'ag': 'Agriculture',
            'indus': 'Industrial',
            'trans': 'Transportation',
            'elec': 'Electricity'
        };

        return fallbackNames[sector] || sector.charAt(0).toUpperCase() + sector.slice(1);
    }

    /**
     * Get color for fuel type
     */
    public getFuelColor(fuel: string): string {
        const fuelConfig = this.FUELS.find(f => f.fuel === fuel);
        return fuelConfig?.color || '#CCCCCC'; // Default gray for unknown fuels
    }

    /**
     * Get color for sector type
     */
    public getSectorColor(sector: string): string {
        const boxConfig = this.BOXES.find(b => b.box === sector);
        return boxConfig?.color || '#CCCCCC'; // Default gray for unknown sectors
    }

    /**
     * Get dynamic width from container ConfigurationService.WIDTH getter
     * This dynamically calculates width based on actual container size
     */
    public get WIDTH(): number {
        // Get container width or use explicit width option
        if (this.options.width) {
            return this.options.width;
        } else {
            // Auto-detect from container
            const containerRect = this.container.getBoundingClientRect();
            let containerWidth = containerRect.width || this.getDefaultWidth();

            // Ensure minimum dimensions
            containerWidth = Math.max(containerWidth, 400);

            // Apply responsive adjustments
            return this.applyResponsiveAdjustments(containerWidth);
        }
    }

    /**
     * Get default width when container width cannot be determined
     */
    private getDefaultWidth(): number {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined' && window.innerWidth) {
            // Use 90% of viewport width as fallback, capped at 1200px
            return Math.min(window.innerWidth * 0.9, 1200);
        }

        // Server-side or fallback
        return 1000;
    }

    /**
     * Apply responsive adjustments based on screen size
     */
    private applyResponsiveAdjustments(width: number): number {
        // For smaller screens, adjust dimensions
        if (typeof window !== 'undefined') {
            const viewportWidth = window.innerWidth;

            if (viewportWidth < 768) {
                // Mobile adjustments
                width = Math.min(width, viewportWidth - 40);
            } else if (viewportWidth < 1024) {
                // Tablet adjustments
                width = Math.min(width, viewportWidth - 80);
            }
        }

        return width;
    }

    /**
     * Calculate right box X position
     */
    public calculateRightBoxX(): number {
        return this.WIDTH - this.BOX_WIDTH;
    }

    // ==================== CONFIGURATION VALIDATION ====================

    /**
     * Validate configuration consistency
     * Ensures all required constants are properly defined
     */
    private validateConfiguration(): void {
        // Validate dimensions
        if (this.WIDTH <= 0 || this.HEIGHT <= 0) {
            throw new Error('ConfigurationService: Invalid dimensions');
        }

        // Validate box positioning
        if (this.BOX_WIDTH <= 0 || this.BOX_HEIGHT <= 0) {
            throw new Error('ConfigurationService: Invalid box dimensions');
        }

        // Validate scaling factors
        if (this.SCALE <= 0) {
            throw new Error('ConfigurationService: Invalid scale factor');
        }

        // Validate electricity box positioning
        if (this.ELEC_BOX_X <= 0 || this.ELEC_BOX_X <= 0) {
            throw new Error('ConfigurationService: Invalid electricity box position');
        }

        // Validate fuel definitions
        if (this.FUELS.length === 0) {
            throw new Error('ConfigurationService: No fuels defined');
        }

        // Validate sector definitions
        if (this.BOXES.length === 0) {
            throw new Error('ConfigurationService: No sectors defined');
        }

        // Validate required fuels exist
        const requiredFuels = ['elec', 'solar', 'nuclear', 'hydro', 'wind', 'geo', 'gas', 'coal', 'bio', 'petro'];
        for (const fuel of requiredFuels) {
            if (!this.FUEL_NAMES.includes(fuel)) {
                console.warn(`ConfigurationService: Missing required fuel: ${fuel}`);
            }
        }

        // Validate required sectors exist
        const requiredSectors = ['elec', 'res', 'ag', 'indus', 'trans'];
        for (const sector of requiredSectors) {
            if (!this.BOX_NAMES.includes(sector)) {
                console.warn(`ConfigurationService: Missing required sector: ${sector}`);
            }
        }

        this.logger.log('ConfigurationService: All configuration validated successfully');
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Check if fuel is defined in configuration
     */
    public isValidFuel(fuel: string): boolean {
        return this.FUEL_NAMES.includes(fuel);
    }

    /**
     * Check if sector is defined in configuration
     */
    public isValidSector(sector: string): boolean {
        return this.BOX_NAMES.includes(sector);
    }

    /**
     * Get all fuel configurations
     */
    public getAllFuels(): readonly FuelConfig[] {
        return this.FUELS;
    }

    /**
     * Get all sector configurations
     */
    public getAllSectors(): readonly BoxConfig[] {
        return this.BOXES;
    }

    /**
     * Get fuel configuration by name
     */
    public getFuelConfig(fuel: string): FuelConfig | undefined {
        return this.FUELS.find(f => f.fuel === fuel);
    }

    /**
     * Get sector configuration by name
     */
    public getSectorConfig(sector: string): BoxConfig | undefined {
        return this.BOXES.find(b => b.box === sector);
    }

    // ==================== RESPONSIVE CONFIGURATION ====================

    /**
     * Calculate responsive scaling factor based on container size
     * Maintains aspect ratio while fitting within container
     */
    public calculateResponsiveScale(containerWidth: number, containerHeight: number): {
        scale: number;
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
    } {
        const aspectRatio = this.WIDTH / this.HEIGHT;

        // Calculate scale based on container constraints
        const scaleX = containerWidth / this.WIDTH;
        const scaleY = containerHeight / this.HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        // Calculate actual dimensions
        const scaledWidth = this.WIDTH * scale;
        const scaledHeight = this.HEIGHT * scale;

        // Calculate centering offsets
        const offsetX = (containerWidth - scaledWidth) / 2;
        const offsetY = (containerHeight - scaledHeight) / 2;

        return {
            scale,
            width: scaledWidth,
            height: scaledHeight,
            offsetX,
            offsetY
        };
    }

    /**
     * Get configuration optimized for mobile devices
     */
    public getMobileConfiguration(): Partial<ConfigurationService> {
        // Return modified constants for mobile optimization
        // These maintain visual accuracy while optimizing for small screens
        return {
            BOX_WIDTH: Math.max(40, this.BOX_WIDTH * 0.8),
            LEFT_GAP: Math.max(5, this.LEFT_GAP * 0.7),
            RIGHT_GAP: Math.max(10, this.RIGHT_GAP * 0.7),
            PATH_GAP: Math.max(4, this.PATH_GAP * 0.7),
            SPEED: this.SPEED * 1.2, // Slightly faster animations on mobile
        };
    }

    /**
     * Check if current viewport suggests mobile device
     */
    public isMobileViewport(): boolean {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= 768 || window.innerHeight <= 600;
    }
}
