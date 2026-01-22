#!/bin/bash
# JJazzLab Quick Build Script

set -e  # Exit on error

cd "$(dirname "$0")/JJazzLab"

echo "================================================"
echo "JJazzLab Build Script"
echo "================================================"
echo ""

# Check Java version
echo "Checking Java version..."
java -version 2>&1 | head -1
echo ""

# Parse command line arguments
SKIP_TESTS="-DskipTests"
CLEAN="clean"
TARGET="install"

while [[ $# -gt 0 ]]; do
    case $1 in
        --with-tests)
            SKIP_TESTS=""
            shift
            ;;
        --no-clean)
            CLEAN=""
            shift
            ;;
        --package)
            TARGET="package"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --with-tests     Run tests during build"
            echo "  --no-clean       Skip clean phase (faster rebuild)"
            echo "  --package        Only package, don't install"
            echo "  --help           Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run with --help for usage information"
            exit 1
            ;;
    esac
done

# Build command
BUILD_CMD="mvn $CLEAN $TARGET $SKIP_TESTS"

echo "Build command: $BUILD_CMD"
echo ""
echo "Starting build..."
echo "================================================"
echo ""

# Run Maven build
$BUILD_CMD

# Check if build was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "✅ BUILD SUCCESSFUL!"
    echo "================================================"
    echo ""
    echo "Application location:"
    echo "  app/application/target/jjazzlab/"
    echo ""
    echo "To run (if display available):"
    echo "  ./app/application/target/jjazzlab/bin/jjazzlab"
    echo ""
    echo "Or use Maven:"
    echo "  cd JJazzLab && mvn nbm:run-platform"
    echo ""
else
    echo ""
    echo "================================================"
    echo "❌ BUILD FAILED"
    echo "================================================"
    echo ""
    echo "Check the error messages above for details."
    exit 1
fi
