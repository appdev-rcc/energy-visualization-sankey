#!/bin/bash

# Master Validation Script for US Energy Sankey v5
# Comprehensive validation with real data (1800-2021)
# Ensures pixel-perfect accuracy during optimization

echo "🚀 US Energy Sankey v5 - Comprehensive Validation"
echo "================================================="
echo "Testing with real US energy data: 1800-2021 (222 years)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track validation results
NUMERICAL_RESULT=0
VISUAL_RESULT=0
PERFORMANCE_RESULT=0
BUILD_RESULT=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2 PASSED${NC}"
    else
        echo -e "${RED}❌ $2 FAILED${NC}"
    fi
}

# Function to cleanup background processes
cleanup() {
    echo -e "\n🧹 Cleaning up..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
        echo "   Server stopped"
    fi
}

# Trap to ensure cleanup on exit
trap cleanup EXIT INT TERM

# Step 1: Build the project
echo -e "${BLUE}📦 Step 1: Building project...${NC}"
npm run build
BUILD_RESULT=$?
print_status $BUILD_RESULT "Build"

if [ $BUILD_RESULT -ne 0 ]; then
    echo -e "${RED}Build failed. Cannot proceed with validation.${NC}"
    exit 1
fi

# Verify required build files exist
echo "🔍 Verifying build artifacts..."
if [ ! -f "dist/us-energy-sankey-v5.standalone.esm.js" ]; then
    echo -e "${RED}❌ Required standalone ESM build not found${NC}"
    exit 1
fi
if [ ! -f "examples/data/data.json" ]; then
    echo -e "${RED}❌ Required data file not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ All required files present${NC}"

# Step 2: Run numerical validation
echo -e "\n${BLUE}📊 Step 2: Running numerical validation...${NC}"
echo "Testing mathematical consistency with real data"
npm run test:numerical
NUMERICAL_RESULT=$?
print_status $NUMERICAL_RESULT "Numerical Validation"

# Step 3: Start server for visual/performance tests
echo -e "\n${BLUE}🌐 Step 3: Starting local server...${NC}"
npm run serve &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "Waiting for server to start..."
sleep 3

# Check if server is running
if ! curl -s http://localhost:8080 > /dev/null; then
    echo -e "${RED}❌ Server failed to start${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Server running on http://localhost:8080${NC}"

# Step 4: Run visual validation
echo -e "\n${BLUE}👁️  Step 4: Running visual validation...${NC}"
echo "Testing pixel-perfect accuracy across energy eras"
npm run test:visual
VISUAL_RESULT=$?
print_status $VISUAL_RESULT "Visual Validation"

# Step 5: Run performance validation
echo -e "\n${BLUE}⚡ Step 5: Running performance validation...${NC}"
echo "Testing performance with 222 years of real data"
npm run test:performance
PERFORMANCE_RESULT=$?
print_status $PERFORMANCE_RESULT "Performance Validation"

# Generate final report
echo -e "\n📋 VALIDATION SUMMARY"
echo "===================="
print_status $BUILD_RESULT "Build"
print_status $NUMERICAL_RESULT "Numerical Validation (Real Data Calculations)"
print_status $VISUAL_RESULT "Visual Validation (Pixel-Perfect Screenshots)"
print_status $PERFORMANCE_RESULT "Performance Validation (Speed & Memory)"

# Calculate overall result
OVERALL_RESULT=$((BUILD_RESULT + NUMERICAL_RESULT + VISUAL_RESULT + PERFORMANCE_RESULT))

if [ $OVERALL_RESULT -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL VALIDATIONS PASSED!${NC}"
    echo -e "${GREEN}✅ Your optimization maintains identical results${NC}"
    echo -e "${GREEN}✅ Ready for production deployment${NC}"
else
    echo -e "\n${RED}❌ VALIDATION FAILURES DETECTED${NC}"
    echo -e "${RED}⚠️  Do not proceed with optimization until all tests pass${NC}"
    
    # Provide specific guidance
    if [ $NUMERICAL_RESULT -ne 0 ]; then
        echo -e "${YELLOW}💡 Numerical failures: Check mathematical calculations and constants${NC}"
    fi
    if [ $VISUAL_RESULT -ne 0 ]; then
        echo -e "${YELLOW}💡 Visual failures: Check validation/diffs/ for pixel differences${NC}"
    fi
    if [ $PERFORMANCE_RESULT -ne 0 ]; then
        echo -e "${YELLOW}💡 Performance failures: Check if performance thresholds were exceeded${NC}"
    fi
fi

# Show validation artifacts
echo -e "\n📁 VALIDATION ARTIFACTS"
echo "======================"
echo "📊 Numerical test results: Jest output above"
echo "📸 Visual baselines: validation/baselines/"
echo "🔍 Visual differences: validation/diffs/"
echo "⚡ Performance data: validation/performance/"

exit $OVERALL_RESULT
