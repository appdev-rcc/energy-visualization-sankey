/**
 * Performance Validation Script for US Energy Sankey v5
 * Measures performance with REAL data (1800-2021, 222 years)
 * Tests initialization, animation, and memory usage
 */

import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RealDataPerformanceValidator {
    constructor() {
        this.browser = null;
        this.performanceDir = path.join(__dirname, '../validation/performance');
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.performanceDir)) {
            fs.mkdirSync(this.performanceDir, {recursive: true});
            console.log(`Created performance directory: ${this.performanceDir}`);
        }
    }

    async setup() {
        console.log('Setting up browser for performance validation...');
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--enable-precise-memory-info'
            ]
        });
    }

    async measureInitializationPerformance() {
        const page = await this.browser.newPage();

        try {
            console.log('Measuring initialization performance with 222 years of real data...');

            // Navigate to the test page first
            await page.goto('http://localhost:8080/examples/visual-test.html', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            const metrics = await page.evaluate(() => {
                return new Promise((resolve) => {
                    const overallStart = performance.now();

                    // Wait for sankey to be available and initialized
                    const checkForSankey = () => {
                        if (window.sankey && window.sankey.isInitialized()) {
                            const overallEnd = performance.now();
                            const dataService = window.sankey.getDataService();

                            resolve({
                                totalTime: overallEnd - overallStart,
                                dataPointCount: dataService.data.length,
                                firstYear: dataService.firstYear,
                                lastYear: dataService.lastYear,
                                memoryUsage: performance.memory ? {
                                    used: performance.memory.usedJSHeapSize,
                                    total: performance.memory.totalJSHeapSize,
                                    limit: performance.memory.jsHeapSizeLimit
                                } : null,
                                timestamp: new Date().toISOString()
                            });
                        } else {
                            setTimeout(checkForSankey, 50);
                        }
                    };

                    checkForSankey();
                });
            });

            await page.close();
            return metrics;

        } catch (error) {
            await page.close();
            throw error;
        }
    }

    async measureAnimationPerformance() {
        const page = await this.browser.newPage();

        try {
            console.log('Measuring animation performance across historical periods...');

            // Navigate to the page
            await page.goto('http://localhost:8080/examples/visual-test.html', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Wait for sankey to initialize
            await page.waitForFunction(() => {
                return window.sankey && window.sankey.isInitialized() && window.sankey.getYears().length === 222;
            }, {timeout: 20000});

            const animationMetrics = await page.evaluate(() => {
                return new Promise((resolve) => {
                    const sankey = window.sankey;
                    if (!sankey) {
                        resolve({error: 'Sankey not available'});
                        return;
                    }

                    // Test years representing major energy transitions
                    const testYears = [1800, 1850, 1900, 1950, 1980, 2000, 2021];
                    let currentYearIndex = 0;
                    let frameCount = 0;
                    let totalFrameTime = 0;
                    const frameTimes = [];
                    const yearTransitionTimes = [];

                    const startTime = performance.now();

                    const measureFrame = () => {
                        const frameStart = performance.now();
                        frameCount++;

                        // Switch to next test year every 10 frames
                        if (frameCount % 10 === 0 && currentYearIndex < testYears.length - 1) {
                            currentYearIndex++;
                            const transitionStart = performance.now();
                            sankey.setYear(testYears[currentYearIndex]);
                            const transitionEnd = performance.now();
                            yearTransitionTimes.push(transitionEnd - transitionStart);
                        }

                        if (frameCount < 70) { // Test 70 frames across all years
                            requestAnimationFrame(() => {
                                const frameEnd = performance.now();
                                const frameTime = frameEnd - frameStart;
                                frameTimes.push(frameTime);
                                totalFrameTime += frameTime;
                                measureFrame();
                            });
                        } else {
                            const endTime = performance.now();
                            const totalDuration = endTime - startTime;

                            resolve({
                                totalDuration,
                                frameCount,
                                averageFrameTime: totalFrameTime / frameCount,
                                averageFPS: (frameCount / totalDuration) * 1000,
                                minFrameTime: Math.min(...frameTimes),
                                maxFrameTime: Math.max(...frameTimes),
                                yearTransitions: yearTransitionTimes.length,
                                averageTransitionTime: yearTransitionTimes.reduce((a, b) => a + b, 0) / yearTransitionTimes.length,
                                testedYears: testYears.slice(0, currentYearIndex + 1),
                                memoryUsage: performance.memory ? {
                                    used: performance.memory.usedJSHeapSize,
                                    total: performance.memory.totalJSHeapSize
                                } : null
                            });
                        }
                    };

                    measureFrame();
                });
            });

            await page.close();
            return animationMetrics;

        } catch (error) {
            await page.close();
            throw error;
        }
    }

    async measureMemoryUsage() {
        const page = await this.browser.newPage();

        try {
            console.log('Measuring memory usage patterns...');

            await page.goto('http://localhost:8080/examples/visual-test.html', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            await page.waitForFunction(() => {
                return window.sankey && window.sankey.isInitialized();
            }, {timeout: 20000});

            const memoryMetrics = await page.evaluate(() => {
                return new Promise((resolve) => {
                    const sankey = window.sankey;
                    const measurements = [];

                    const takeMeasurement = (label) => {
                        if (performance.memory) {
                            measurements.push({
                                label,
                                used: performance.memory.usedJSHeapSize,
                                total: performance.memory.totalJSHeapSize,
                                timestamp: performance.now()
                            });
                        }
                    };

                    takeMeasurement('initial');

                    // Force garbage collection if available
                    if (window.gc) {
                        window.gc();
                    }

                    takeMeasurement('after_gc');

                    // Trigger heavy operations
                    sankey.setYear(2021);
                    takeMeasurement('after_year_change');

                    sankey.play();
                    setTimeout(() => {
                        takeMeasurement('during_animation');
                        sankey.pause();

                        setTimeout(() => {
                            takeMeasurement('after_pause');

                            resolve({
                                measurements,
                                peakMemory: Math.max(...measurements.map(m => m.used)),
                                memoryGrowth: measurements[measurements.length - 1].used - measurements[0].used
                            });
                        }, 1000);
                    }, 2000);
                });
            });

            await page.close();
            return memoryMetrics;

        } catch (error) {
            await page.close();
            throw error;
        }
    }

    async runCompletePerformanceValidation() {
        console.log('Starting comprehensive performance validation...\n');

        const results = {};

        try {
            // Measure initialization performance
            console.log('1/3 Testing initialization performance...');
            results.initialization = await this.measureInitializationPerformance();
            this.reportInitializationResults(results.initialization);

            // Measure animation performance
            console.log('\n2/3 Testing animation performance...');
            results.animation = await this.measureAnimationPerformance();
            this.reportAnimationResults(results.animation);

            // Measure memory usage
            console.log('\n3/3 Testing memory usage...');
            results.memory = await this.measureMemoryUsage();
            this.reportMemoryResults(results.memory);

            // Save complete results
            this.savePerformanceBaseline(results);

            return results;

        } catch (error) {
            console.error('Performance validation failed:', error);
            throw error;
        }
    }

    reportInitializationResults(metrics) {
        if (metrics.error) {
            console.error(`Initialization error: ${metrics.error}`);
            return;
        }

        console.log(`Initialization Results:`);
        console.log(`   Total time: ${metrics.totalTime.toFixed(2)}ms`);
        console.log(`   Data points: ${metrics.dataPointCount} years (${metrics.firstYear}-${metrics.lastYear})`);

        if (metrics.memoryUsage) {
            console.log(`   Memory usage: ${(metrics.memoryUsage.used / 1024 / 1024).toFixed(2)}MB`);
        }
    }

    reportAnimationResults(metrics) {
        if (metrics.error) {
            console.error(`Animation error: ${metrics.error}`);
            return;
        }

        console.log(`Animation Results:`);
        console.log(`   Duration: ${metrics.totalDuration.toFixed(2)}ms`);
        console.log(`   Frames: ${metrics.frameCount}`);
        console.log(`   Average FPS: ${metrics.averageFPS.toFixed(2)}`);
        console.log(`   Avg frame time: ${metrics.averageFrameTime.toFixed(2)}ms`);
        console.log(`   Frame time range: ${metrics.minFrameTime.toFixed(2)}ms - ${metrics.maxFrameTime.toFixed(2)}ms`);
        console.log(`   Year transitions: ${metrics.yearTransitions}`);
        console.log(`   Avg transition time: ${metrics.averageTransitionTime.toFixed(2)}ms`);
        console.log(`   Tested years: ${metrics.testedYears.join(', ')}`);
    }

    reportMemoryResults(metrics) {
        console.log(`Memory Results:`);
        console.log(`   Peak memory: ${(metrics.peakMemory / 1024 / 1024).toFixed(2)}MB`);
        console.log(`   Memory growth: ${(metrics.memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

        console.log(`   Memory progression:`);
        metrics.measurements.forEach(m => {
            console.log(`     ${m.label}: ${(m.used / 1024 / 1024).toFixed(2)}MB`);
        });
    }

    savePerformanceBaseline(results) {
        const baselineFile = path.join(this.performanceDir, 'real-data-baseline.json');
        const summaryFile = path.join(this.performanceDir, 'performance-summary.json');

        // Save detailed results
        fs.writeFileSync(baselineFile, JSON.stringify(results, null, 2));

        // Save summary for easy comparison
        const summary = {
            timestamp: new Date().toISOString(),
            dataPoints: results.initialization?.dataPointCount || 0,
            initTime: results.initialization?.totalTime || 0,
            avgFPS: results.animation?.averageFPS || 0,
            peakMemoryMB: results.memory ? (results.memory.peakMemory / 1024 / 1024) : 0,
            version: '5.0.0'
        };

        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

        console.log(`\nPerformance baseline saved:`);
        console.log(`   Details: ${baselineFile}`);
        console.log(`   Summary: ${summaryFile}`);
    }

    async teardown() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Browser closed');
        }
    }
}

// Main execution
async function main() {
    const validator = new RealDataPerformanceValidator();

    try {
        await validator.setup();
        const results = await validator.runCompletePerformanceValidation();

        console.log('\nPerformance validation completed successfully!');

        // Performance thresholds (adjust based on your requirements)
        const thresholds = {
            maxInitTime: 5000, // 5 seconds
            minFPS: 30,
            maxMemoryMB: 100
        };

        let failed = false;

        if (results.initialization?.totalTime > thresholds.maxInitTime) {
            console.error(`Initialization too slow: ${results.initialization.totalTime.toFixed(2)}ms > ${thresholds.maxInitTime}ms`);
            failed = true;
        }

        if (results.animation?.averageFPS < thresholds.minFPS) {
            console.error(`FPS too low: ${results.animation.averageFPS.toFixed(2)} < ${thresholds.minFPS}`);
            failed = true;
        }

        if (results.memory?.peakMemory > thresholds.maxMemoryMB * 1024 * 1024) {
            console.error(`Memory usage too high: ${(results.memory.peakMemory / 1024 / 1024).toFixed(2)}MB > ${thresholds.maxMemoryMB}MB`);
            failed = true;
        }

        if (failed) {
            process.exit(1);
        }

    } catch (error) {
        console.error('Performance validation crashed:', error);
        process.exit(1);
    } finally {
        await validator.teardown();
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
