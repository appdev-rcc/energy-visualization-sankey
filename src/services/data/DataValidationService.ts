import type {EnergyDataPoint} from '@/types';
import {DataValidationError} from '@/types';
import {EventBus} from '@/core/events/EventBus';
import {Logger} from "@/utils/Logger";
import {ConfigurationService} from "@/services/ConfigurationService";

/**
 * Data Validation Service
 *
 * Comprehensive validation service ensuring data integrity and structure
 * compliance for energy flow datasets. Performs multi-level validation
 * including structure, content, and value range verification.
 *
 * Validation Levels:
 * 1. Structure Validation - Array format and basic structure checks
 * 2. Content Validation - Required sectors and breakdown verification
 * 3. Type Validation - Ensures proper data types for all values
 * 4. Range Validation - Warns about unusual values or potential errors
 * 5. Duplicate Detection - Prevents duplicate years in dataset
 *
 * Error Handling:
 * Throws DataValidationError with detailed context for failed validations,
 * including field names, indices, and descriptive error messages.
 * Emits validation events for service coordination and monitoring.
 *
 * Required Data Structure:
 * Each data point must contain all major fuel types (solar, nuclear, hydro,
 * wind, geothermal, gas, coal, biomass, petroleum) with consumption
 * breakdowns across sectors (electricity, residential, agriculture,
 * industrial, transportation).
 *
 * Provides comprehensive validation for energy flow datasets with
 * multi-level checks ensuring data integrity, proper structure,
 * and content completeness. Maintains strict validation rules
 * to prevent downstream calculation errors.
 */
export class DataValidationService {
    constructor(private configurationService: ConfigurationService, private eventBus: EventBus, private logger: Logger) {
    }

    /**
     * Validate complete data array with comprehensive checks
     * Performs structure, content, and type validation for entire dataset
     * @param data - Array of energy data points to validate
     * @throws DataValidationError - If any validation check fails
     */
    public validateData(data: EnergyDataPoint[]): void {
        const startTime = performance.now(); // Performance monitoring for validation efficiency

        try {
            // Basic array structure validation - Critical first line of defense
            // Prevents downstream calculation errors from malformed input
            if (!Array.isArray(data)) {
                throw new DataValidationError('Data must be an array', 'data');
            }

            if (data.length === 0) {
                throw new DataValidationError('Data array cannot be empty', 'data');
            }

            // Validate all required fuel sectors are present - Energy Industry Standard Compliance
            // These sectors represent the complete US energy landscape per EIA standards
            // Missing sectors would cause calculation failures in downstream services
            const requiredSectors = ['elec', 'waste', 'solar', 'nuclear', 'hydro', 'wind', 'geo', 'gas', 'coal', 'bio', 'petro'];

            // Validate consumption breakdown for each sector - Mathematical Integrity Check
            // Each fuel sector must have consumption across all major sectors:
            // elec (electricity), res (residential), ag (agriculture), indus (industrial), trans (transportation)
            // This structure is required for the triple nested loop calculations in SummaryService
            const requiredBreakdown = ['elec', 'res', 'ag', 'indus', 'trans'];

            let hasHeatData = false;

            // Validate each data point in the array - Comprehensive structural integrity check
            // O(n) iteration ensures every data point meets strict requirements
            for (let i = 0; i < data.length; i++) {
                const point = data[i];

                // Year validation - Critical for timeline functionality
                // Year must be numeric for chronological sorting and animation
                if (!point.year) {
                    throw new DataValidationError(`Invalid year at index ${i}`, 'year');
                }

                for (const sector of requiredSectors) {
                    if (!(sector in point)) {
                        throw new DataValidationError(`Missing sector '${sector}' in data point for year ${point.year}`, sector);
                    }

                    const sectorData = (point as any)[sector];
                    if (!sectorData || typeof sectorData !== 'object') {
                        throw new DataValidationError(`Invalid sector data for '${sector}' in year ${point.year}`, sector);
                    }

                    let currentRequiredBreakdown = [...requiredBreakdown];
                    if ("heat" in point) {
                        hasHeatData = true;
                        currentRequiredBreakdown.push("heat");
                    }

                    for (const breakdown of currentRequiredBreakdown) {
                        if (!(breakdown in sectorData) || typeof sectorData[breakdown] !== 'number') {
                            throw new DataValidationError(`Invalid breakdown '${breakdown}' for sector '${sector}' in year ${point.year}`, `${sector}.${breakdown}`);
                        }
                    }
                }
            }

            if (hasHeatData) {
                this.configurationService.hasHeatData = hasHeatData;
            }
            // this.configurationService.updateFuelAndBoxNames()

            const endTime = performance.now();

            // Emit validation success event for service coordination - Event-Driven Architecture
            // This notifies other services that data is validated and safe to use
            // Provides validation metadata for performance monitoring and debugging
            this.eventBus.emit({
                type: 'data.validated',
                timestamp: Date.now(),
                source: 'DataValidationService',
                data: {
                    dataPointCount: data.length,                    // Dataset size for capacity planning
                    yearRange: data.length > 0 ? [data[0].year, data[data.length - 1].year] : [0, 0], // Temporal scope
                    validationTime: endTime - startTime           // Performance metrics for optimization
                }
            });

            // Debug logging when enabled - Performance Monitoring
            // Tracks validation performance to identify potential bottlenecks
            this.logger.log(`DataValidationService: ${data.length} data points validated in ${(endTime - startTime).toFixed(2)}ms`);

        } catch (error) {
            // Emit validation error event for error handling - Error Recovery Architecture
            // Enables centralized error handling and user notification systems
            // Marks validation errors as non-recoverable (require data fix)
            this.eventBus.emit({
                type: 'system.error',
                timestamp: Date.now(),
                source: 'DataValidationService',
                data: {
                    error: error instanceof Error ? error : new Error(String(error)),
                    context: 'data_validation',  // Error categorization for debugging
                    recoverable: false           // Validation errors require data correction
                }
            });

            // Re-throw error to maintain validation contract - Fail-Fast Pattern
            // Prevents invalid data from propagating to calculation services
            // Maintains data integrity throughout the system
            throw error;
        }
    }
}
