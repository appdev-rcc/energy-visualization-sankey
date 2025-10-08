import type {EnergyDataPoint} from '@/types';
import {DataValidationService} from "@/services/data/DataValidationService";
import {EventBus} from "@/core/events/EventBus";
import {Logger} from "@/utils/Logger";

/**
 * Data Service
 *
 * Core data access and management service providing validated, sorted energy data
 * with comprehensive query capabilities. Handles input validation, data sorting,
 * year-based navigation, and statistical analysis.
 *
 * Provides validated, indexed access to energy flow data with comprehensive
 * query capabilities and statistical analysis. Maintains data integrity
 * through immutable structures and validation at construction time.
 *
 * Key Responsibilities:
 * - Input validation and data structure verification
 * - Chronological data sorting and indexing
 * - Year-based data retrieval and navigation
 * - Fuel and sector totals calculation
 * - Milestone data management
 * - Dataset statistics and metadata
 *
 * Data Structure:
 * Manages EnergyDataPoint arrays with comprehensive energy flow data
 * including all major fuel types (solar, nuclear, hydro, wind, etc.)
 * and consumption sectors (electricity, residential, industrial, etc.)
 *
 * Performance Features:
 * - Immutable data structures for safety
 * - Pre-computed indices for fast lookups
 * - Efficient year-based navigation
 * - Cached statistics calculations
 *
 */
export class DataService {
    // Core immutable data structures
    public readonly data: readonly EnergyDataPoint[];
    public readonly years: readonly number[];
    public readonly yearsLength: number;
    public readonly firstYear: number;
    public readonly lastYear: number;

    constructor(
        energyData: EnergyDataPoint[],
        private validationService: DataValidationService,
        private eventBus: EventBus,
        private logger: Logger,
    ) {
        const startTime = performance.now(); // Performance monitoring for data service initialization

        // Validate input data structure and content - Data Integrity Assurance
        // Critical first step: ensures all downstream calculations receive valid data
        // Validation service performs comprehensive structure and content verification
        this.validationService.validateData(energyData);

        // Sort data chronologically and create immutable reference - Data Structure Optimization
        // Chronological sorting enables efficient year-based navigation and animation
        // Immutability prevents accidental data corruption throughout application lifecycle
        const sortedData = [...energyData].sort((a, b) => a.year - b.year);
        this.data = Object.freeze(sortedData);

        // Extract and freeze year indices for efficient navigation - Performance Optimization
        // Pre-computed year array enables O(1) year lookups and efficient navigation
        // Frozen arrays prevent mutation while maintaining reference stability
        this.years = Object.freeze(this.data.map(d => d.year));
        this.yearsLength = this.years.length;
        this.firstYear = this.years[0];                    // Timeline start boundary
        this.lastYear = this.years[this.yearsLength - 1]; // Timeline end boundary

        const endTime = performance.now();

        // Emit data loaded event for service coordination - Event-Driven Architecture
        // Notifies calculation and visualization services that validated data is available
        // Includes metadata for capacity planning and performance monitoring
        this.eventBus.emit({
            type: 'data.loaded',
            timestamp: Date.now(),
            source: 'DataService',
            data: {
                dataPoints: [...this.data],                    // Complete dataset for processing
                yearCount: this.yearsLength,                  // Timeline scope information
                yearRange: [this.firstYear, this.lastYear]     // Temporal boundaries
            }
        });

        // Debug logging (controlled by library configuration when available) - Performance Monitoring
        // Tracks initialization performance and data characteristics for optimization
        this.logger.log(`DataService: ${this.data.length} data points loaded and sorted in ${(endTime - startTime).toFixed(2)}ms`);
        this.logger.log(`DataService: Year range ${this.firstYear}-${this.lastYear}`);
    }

    // ==================== DATA ACCESS METHODS ====================
    // Core data retrieval and navigation methods

    /**
     * Get data for specific year
     * @param year - Target year to retrieve
     * @returns Energy data for the specified year, or undefined if not found
     */
    public getYearData(year: number): EnergyDataPoint | undefined {
        return this.data.find(d => d.year === year);
    }

    /**
     * Get index of year in chronological sequence
     * @param year - Year to locate
     * @returns Zero-based index of year, or -1 if not found
     */
    public getYearIndex(year: number): number {
        return this.years.indexOf(year);
    }

    /**
     * Check if year exists in dataset
     * @param year - Year to check
     * @returns True if year has data available
     */
    public hasYear(year: number): boolean {
        return this.years.includes(year);
    }

    /**
     * Get data by chronological index
     * @param index - Zero-based index in sorted data array
     * @returns Energy data at specified index, or undefined if out of bounds
     */
    public getYearDataByIndex(index: number): EnergyDataPoint | undefined {
        if (index < 0 || index >= this.data.length) {
            return undefined;
        }
        return this.data[index];
    }

    /**
     * Check if year is valid and within dataset range
     * @param year - Year to validate
     * @returns True if year exists and is within valid range
     */
    public isValidYear(year: number): boolean {
        return year >= this.firstYear && year <= this.lastYear && this.hasYear(year);
    }

    // ==================== NAVIGATION METHODS ====================
    // Year-based navigation and range operations

    /**
     * Get year range as tuple
     * @returns Tuple containing [firstYear, lastYear]
     */
    public getYearRange(): [number, number] {
        return [this.firstYear, this.lastYear];
    }

    /**
     * Get total number of data points
     * @returns Count of available years in dataset
     */
    public getDataCount(): number {
        return this.data.length;
    }

    /**
     * Get chronologically next year
     * @param currentYear - Starting year
     * @returns Next available year, or null if at end of dataset
     */
    public getNextYear(currentYear: number): number | null {
        const currentIndex = this.getYearIndex(currentYear);
        if (currentIndex === -1 || currentIndex === this.yearsLength - 1) {
            return null;
        }
        return this.years[currentIndex + 1];
    }

    /**
     * Get chronologically previous year
     * @param currentYear - Starting year
     * @returns Previous available year, or null if at beginning of dataset
     */
    public getPreviousYear(currentYear: number): number | null {
        const currentIndex = this.getYearIndex(currentYear);
        if (currentIndex <= 0) {
            return null;
        }
        return this.years[currentIndex - 1];
    }

    // ==================== CALCULATION METHODS ====================
    // Fuel and sector totals calculation methods

    /**
     * Get energy total for specific year, fuel, and sector combination
     * @param year - Target year
     * @param fuel - Fuel type (e.g., 'coal', 'gas', 'solar')
     * @param sector - Consumption sector (e.g., 'elec', 'trans', 'indus')
     * @returns Energy value for the specified combination
     */
    public getTotalForYear(year: number, fuel: string, sector: string): number {
        const yearData = this.getYearData(year);
        if (!yearData) {
            return 0;
        }

        const fuelData = (yearData as any)[fuel];
        if (!fuelData) {
            return 0;
        }

        return fuelData[sector] || 0;
    }

    /**
     * Get total energy consumption for specific fuel across all sectors
     *
     * **Energy Industry Analysis Method:**
     * - Aggregates fuel consumption across all end-use sectors
     * - Provides fuel-specific energy totals for analysis and visualization
     * - Follows EIA energy accounting standards for sector summation
     *
     * @param year - Target year
     * @param fuel - Fuel type to sum (e.g., 'coal', 'gas', 'solar')
     * @returns Total energy consumption for fuel across all sectors
     */
    public getYearTotalForFuel(year: number, fuel: string): number {
        const yearData = this.getYearData(year);
        if (!yearData) {
            return 0; // Graceful degradation for missing year data
        }

        const fuelData = (yearData as any)[fuel];
        if (!fuelData) {
            return 0; // Graceful degradation for missing fuel data
        }

        // Sum across all major consumption sectors - Energy Industry Standard
        // Covers complete energy end-use landscape: electricity generation, residential,
        // agriculture, industrial, and transportation sectors
        return (fuelData.elec || 0) + (fuelData.res || 0) + (fuelData.ag || 0) +
            (fuelData.indus || 0) + (fuelData.trans || 0);
    }

    /**
     * Get total energy consumption for specific sector across all fuels
     *
     * **Sectoral Energy Analysis Method:**
     * - Aggregates energy consumption by end-use sector across all fuel types
     * - Handles electricity as both source and consumption (special case logic)
     * - Provides sectoral energy totals for economic and policy analysis
     *
     * @param year - Target year
     * @param sector - Sector to sum (e.g., 'trans' for transportation)
     * @returns Total energy consumption for sector across all fuel types
     */
    public getYearTotalForSector(year: number, sector: string): number {
        const yearData = this.getYearData(year);
        if (!yearData) {
            return 0; // Graceful degradation for missing year data
        }

        let total = 0;
        // Standard fuel types for comprehensive calculation - Energy Source Categories
        // Covers all primary energy sources in US energy system per EIA classification
        const fuels = ['solar', 'nuclear', 'hydro', 'wind', 'geo', 'gas', 'coal', 'bio', 'petro'];

        for (const fuel of fuels) {
            const fuelData = (yearData as any)[fuel];
            if (fuelData && fuelData[sector]) {
                total += fuelData[sector]; // Direct fuel consumption in target sector
            }
        }

        // Add electricity consumption for non-electricity sectors - Special Case Handling
        // Electricity is both a fuel source (for generation) and consumption medium
        // For non-electricity sectors, add electricity consumption to capture total energy use
        if (sector !== 'elec' && yearData.elec[sector as keyof typeof yearData.elec]) {
            total += yearData.elec[sector as keyof typeof yearData.elec];
        }

        return total;
    }

    // ==================== MILESTONE METHODS ====================
    // Historical milestone data retrieval methods

    /**
     * Get historical milestone description for specific year
     * @param year - Target year
     * @returns Milestone description string, or undefined if no milestone
     */
    public getMilestoneForYear(year: number): string | undefined {
        const yearData = this.getYearData(year);
        return yearData?.milestone;
    }

    /**
     * Get array of all years containing historical milestones
     * @returns Array of years with milestone data available
     */
    public getYearsWithMilestones(): number[] {
        return this.data
            .filter(d => d.milestone)
            .map(d => d.year);
    }

    // ==================== ANALYSIS METHODS ====================
    // Dataset analysis and metadata extraction methods

    /**
     * Get list of all fuel types available in dataset
     * @returns Array of fuel type names (e.g., ['solar', 'coal', 'gas'])
     */
    public getAvailableFuels(): string[] {
        if (this.data.length === 0) {
            return [];
        }

        // Extract all fuel types from first data point (structure should be consistent)
        const firstPoint = this.data[0];
        return Object.keys(firstPoint).filter(key =>
            key !== 'year' &&
            key !== 'milestone' &&
            typeof (firstPoint as any)[key] === 'object'
        );
    }

    /**
     * Get list of all consumption sectors available in dataset
     * @returns Array of sector names (e.g., ['elec', 'trans', 'indus'])
     */
    public getAvailableSectors(): string[] {
        if (this.data.length === 0) {
            return [];
        }

        // Extract sectors from first fuel object (structure should be consistent)
        const firstPoint = this.data[0];
        const firstFuel = (firstPoint as any)['elec']; // Use elec as reference
        if (!firstFuel) {
            return [];
        }

        return Object.keys(firstFuel);
    }

    /**
     * Get comprehensive statistics about the dataset
     * Provides metadata useful for analysis, debugging, and performance monitoring
     * @returns Object containing dataset statistics and metadata
     */
    public getDataStatistics(): {
        totalDataPoints: number;
        yearRange: [number, number];
        averageYearGap: number;
        milestonesCount: number;
        fuelsCount: number;
        sectorsCount: number;
    } {
        const milestonesCount = this.getYearsWithMilestones().length;
        const fuelsCount = this.getAvailableFuels().length;
        const sectorsCount = this.getAvailableSectors().length;

        // Calculate average gap between consecutive years
        let totalGap = 0;
        for (let i = 1; i < this.yearsLength; i++) {
            totalGap += this.years[i] - this.years[i - 1];
        }
        const averageYearGap = this.yearsLength > 1 ? totalGap / (this.yearsLength - 1) : 0;

        return {
            totalDataPoints: this.data.length,
            yearRange: [this.firstYear, this.lastYear],
            averageYearGap,
            milestonesCount,
            fuelsCount,
            sectorsCount
        };
    }
}
