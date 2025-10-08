/**
 * Visual Validation Script for US Energy Sankey v5
 * Using REAL data from examples/data/data.json (1800-2021)
 * Pixel-perfect comparison across key historical periods
 */

import {chromium} from 'playwright';
import pixelmatch from 'pixelmatch';
import {PNG} from 'pngjs';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RealDataVisualValidator {
    constructor() {
        this.browser = null;
        this.baselineDir = path.join(__dirname, '../validation/baselines');
        this.outputDir = path.join(__dirname, '../validation/output');
        this.diffDir = path.join(__dirname, '../validation/diffs');

        // Test scenarios based on ACTUAL US energy history
        this.testScenarios = [
            {
                name: 'colonial-1800.png',
                year: 1800,
                description: 'Colonial America - Wood burning era',
                significance: 'Baseline minimal energy usage'
            },
            {
                name: 'industrial-1900.png',
                year: 1900,
                description: 'Industrial Revolution - Coal emergence',
                significance: 'Industrial transformation period'
            },
            {
                name: 'postwar-1950.png',
                year: 1950,
                description: 'Post-war boom - Coal dominant + steam locomotives retired',
                significance: 'Transportation electrification milestone'
            },
            {
                name: 'nuclear-1980.png',
                year: 1980,
                description: 'Nuclear age - Atomic energy adoption',
                significance: 'Nuclear power peak period'
            },
            {
                name: 'modern-2000.png',
                year: 2000,
                description: 'Modern era - Diversified energy mix',
                significance: 'Pre-renewable diversity'
            },
            {
                name: 'renewable-2020.png',
                year: 2020,
                description: 'Renewable era - Solar and wind growth',
                significance: 'Clean energy transition'
            },
            {
                name: 'current-2021.png',
                year: 2021,
                description: 'Latest available data',
                significance: 'Most recent energy snapshot'
            },
            {
                name: 'waste-visible-2000.png',
                year: 2000,
                wasteVisible: true,
                description: 'Waste heat visible - Modern era',
                significance: 'Full energy flow visualization'
            },
            {
                name: 'waste-hidden-2000.png',
                year: 2000,
                wasteVisible: false,
                description: 'Waste heat hidden - Modern era',
                significance: 'Clean flow visualization'
            }
        ];

        this.ensureDirectories();
    }

    ensureDirectories() {
        [this.baselineDir, this.outputDir, this.diffDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, {recursive: true});
                console.log(`📁 Created directory: ${dir}`);
            }
        });
    }

    async setup() {
        console.log('🚀 Setting up browser for visual validation...');
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-running-insecure-content'
            ]
        });
    }

    async captureScenario(scenario) {
        const page = await this.browser.newPage();

        try {
            // Set consistent viewport for all tests
            await page.setViewportSize({width: 1400, height: 900});

            // Navigate to the test page
            console.log(`📸 Capturing: ${scenario.description}`);
            await page.goto('http://localhost:8080/examples/visual-test.html', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Wait for sankey initialization with REAL data validation
            await page.waitForFunction(() => {
                return window.sankey &&
                    window.sankey.isInitialized() &&
                    window.sankey.getYears().length === 222 && // Verify all 222 years loaded
                    window.sankey.getYears().includes(1800) &&
                    window.sankey.getYears().includes(2021);
            }, {timeout: 20000});

            // Set specific year from real dataset
            if (scenario.year) {
                await page.evaluate((year) => {
                    console.log(`Setting year to ${year}`);
                    window.sankey.setYear(year);
                }, scenario.year);

                // Wait for year transition to complete
                await page.waitForTimeout(1000);

                // Verify year was set correctly
                const actualYear = await page.evaluate(() => {
                    return window.sankey.getCurrentYear();
                });

                if (actualYear !== scenario.year) {
                    console.warn(`⚠️ Year mismatch: expected ${scenario.year}, got ${actualYear}`);
                }
            }

            // Handle waste heat visibility
            if (scenario.wasteVisible !== undefined) {
                await page.evaluate((visible) => {
                    const currentState = window.sankey.isWasteHeatVisible();
                    console.log(`Waste heat: current=${currentState}, target=${visible}`);
                    if (currentState !== visible) {
                        window.sankey.toggleWasteHeat();
                    }
                }, scenario.wasteVisible);

                // Wait for waste heat toggle to complete
                await page.waitForTimeout(500);
            }

            // Wait for any final rendering
            await page.waitForTimeout(1500);

            // Additional wait for stability
            await page.waitForLoadState('networkidle');

            // Capture screenshot
            const screenshot = await page.screenshot({
                path: path.join(this.outputDir, scenario.name),
                fullPage: false,
                clip: {x: 0, y: 0, width: 1400, height: 1000} // Consistent clipping
            });

            console.log(`✅ Captured: ${scenario.name} (${scenario.year || 'default'})`);
            return screenshot;

        } catch (error) {
            console.error(`❌ Failed to capture ${scenario.name}:`, error.message);
            throw error;
        } finally {
            await page.close();
        }
    }

    async compareWithBaseline(filename) {
        const baselinePath = path.join(this.baselineDir, filename);
        const outputPath = path.join(this.outputDir, filename);
        const diffPath = path.join(this.diffDir, filename);

        if (!fs.existsSync(baselinePath)) {
            console.log(`📝 Creating new baseline: ${filename}`);
            fs.copyFileSync(outputPath, baselinePath);
            return {match: true, isNewBaseline: true};
        }

        try {
            const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
            const current = PNG.sync.read(fs.readFileSync(outputPath));

            const {width, height} = baseline;
            const diff = new PNG({width, height});

            const pixelDiffCount = pixelmatch(
                baseline.data,
                current.data,
                diff.data,
                width,
                height,
                {
                    threshold: 0.005, // Very strict threshold for energy visualization
                    includeAA: false,
                    alpha: 0.1,
                    diffColor: [255, 0, 0] // Red diff highlights
                }
            );

            const totalPixels = width * height;
            const diffPercentage = (pixelDiffCount / totalPixels) * 100;

            if (pixelDiffCount > 0) {
                fs.writeFileSync(diffPath, PNG.sync.write(diff));
            } else {
                // Remove diff file if no differences
                if (fs.existsSync(diffPath)) {
                    fs.unlinkSync(diffPath);
                }
            }

            return {
                match: pixelDiffCount === 0,
                pixelDiffCount,
                diffPercentage,
                totalPixels,
                diffPath: pixelDiffCount > 0 ? diffPath : null
            };

        } catch (error) {
            console.error(`❌ Error comparing ${filename}:`, error.message);
            return {
                match: false,
                error: error.message
            };
        }
    }

    async validateAllScenarios() {
        console.log('🎯 Starting visual validation with REAL US energy data (1800-2021)...\n');
        console.log(`Testing ${this.testScenarios.length} scenarios across 222 years of energy history\n`);

        const results = [];

        for (let i = 0; i < this.testScenarios.length; i++) {
            const scenario = this.testScenarios[i];
            console.log(`[${i + 1}/${this.testScenarios.length}] ${scenario.description}`);
            console.log(`   Significance: ${scenario.significance}`);

            try {
                await this.captureScenario(scenario);
                const comparison = await this.compareWithBaseline(scenario.name);

                results.push({
                    scenario: scenario.name,
                    description: scenario.description,
                    year: scenario.year,
                    significance: scenario.significance,
                    ...comparison
                });

                if (comparison.error) {
                    console.error(`❌ ${scenario.name}: ${comparison.error}`);
                } else if (!comparison.match && !comparison.isNewBaseline) {
                    console.error(`❌ ${scenario.name}: ${comparison.pixelDiffCount} pixels different (${comparison.diffPercentage.toFixed(3)}%)`);
                    console.error(`   Diff saved to: ${comparison.diffPath}`);
                } else if (comparison.isNewBaseline) {
                    console.log(`📝 ${scenario.name}: New baseline created`);
                } else {
                    console.log(`✅ ${scenario.name}: Perfect pixel match`);
                }

            } catch (error) {
                console.error(`💥 ${scenario.name}: Capture failed - ${error.message}`);
                results.push({
                    scenario: scenario.name,
                    description: scenario.description,
                    year: scenario.year,
                    match: false,
                    error: error.message
                });
            }

            console.log(''); // Empty line for readability
        }

        return results;
    }

    async teardown() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Browser closed');
        }
    }

    generateReport(results) {
        console.log(`\n📊 VISUAL VALIDATION REPORT`);
        console.log(`${'='.repeat(50)}`);

        const total = results.length;
        const newBaselines = results.filter(r => r.isNewBaseline).length;
        const passed = results.filter(r => r.match && !r.isNewBaseline).length;
        const failed = results.filter(r => !r.match && !r.isNewBaseline).length;
        const errors = results.filter(r => r.error).length;

        console.log(`Total scenarios: ${total}`);
        console.log(`New baselines: ${newBaselines}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Errors: ${errors}`);

        if (failed > 0) {
            console.log(`\n❌ FAILED SCENARIOS:`);
            results.filter(r => !r.match && !r.isNewBaseline && !r.error).forEach(r => {
                console.log(`   ${r.scenario} (${r.year}): ${r.diffPercentage.toFixed(3)}% difference`);
                console.log(`   ${r.description}`);
                console.log(`   Diff: ${r.diffPath}`);
            });
        }

        if (errors > 0) {
            console.log(`\n💥 ERROR SCENARIOS:`);
            results.filter(r => r.error).forEach(r => {
                console.log(`   ${r.scenario}: ${r.error}`);
            });
        }

        return {total, newBaselines, passed, failed, errors};
    }
}

// Main execution
async function main() {
    const validator = new RealDataVisualValidator();

    try {
        await validator.setup();
        const results = await validator.validateAllScenarios();
        const summary = validator.generateReport(results);

        if (summary.failed > 0 || summary.errors > 0) {
            console.error(`\n❌ Visual validation failed: ${summary.failed} failures, ${summary.errors} errors`);
            process.exit(1);
        } else if (summary.newBaselines > 0) {
            console.log(`\n📝 ${summary.newBaselines} new baselines created. Re-run to validate against them.`);
        } else {
            console.log(`\n✅ All ${summary.passed} visual validations passed! Pixel-perfect accuracy maintained.`);
        }

    } catch (error) {
        console.error('❌ Visual validation crashed:', error);
        process.exit(1);
    } finally {
        await validator.teardown();
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
