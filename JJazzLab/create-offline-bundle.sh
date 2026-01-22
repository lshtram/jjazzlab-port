#!/bin/bash
# Create an offline Maven repository bundle for JJazzLab
# This script packages all Maven dependencies into a portable archive

set -e

echo "================================================"
echo "Creating Offline Maven Repository Bundle"
echo "================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "pom.xml" ]; then
    echo "Error: Must run from JJazzLab directory"
    exit 1
fi

# Build and download all dependencies
echo "Step 1: Building project and downloading all dependencies..."
mvn clean install -DskipTests -U
echo ""

# Create output directory  
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../offline-repository"
ARCHIVE_NAME="jjazzlab-maven-dependencies.tar.gz"

echo "Step 2: Packaging Maven repository..."
mkdir -p "$OUTPUT_DIR"

# Create the archive directly
echo "Creating archive from Maven repository..."
cd ~/.m2/repository

tar -czf "$OUTPUT_DIR/$ARCHIVE_NAME" \
    --exclude='*.repositories' \
    --exclude='_remote.repositories' \
    org/apache/netbeans/ \
    org/netbeans/ \
    org/jjazz/ \
    com/google/guava/ \
    com/thoughtworks/xstream/ \
    org/codehaus/plexus/ \
    org/apache/maven/ \
    org/apache/commons/ \
    commons-io/ \
    commons-codec/ \
    commons-logging/ \
    org/slf4j/ \
    junit/ \
    org/junit/ 2>/dev/null || true

# Get archive size
cd "$OUTPUT_DIR"
ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)

echo ""
echo "================================================"
echo "✅ Offline Repository Bundle Created!"
echo "================================================"
echo ""
echo "Archive: $OUTPUT_DIR/$ARCHIVE_NAME"
echo "Size: $ARCHIVE_SIZE"
echo ""
echo "To use this bundle:"
echo "  1. Extract: tar -xzf $ARCHIVE_NAME -C ~/.m2/repository/"
echo "  2. Build offline: cd JJazzLab && mvn -o clean install -DskipTests"
echo ""
echo "Or upload to GitHub Releases for easy distribution!"
echo ""
