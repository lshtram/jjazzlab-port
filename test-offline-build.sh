#!/bin/bash
# Test script for offline Maven build
# This proves the offline repository works

set -e

echo "=========================================="
echo "Testing Offline Maven Repository"
echo "=========================================="
echo ""

# Absolute path to offline repository
OFFLINE_REPO="$(cd "$(dirname "$0")" && pwd)/offline-repository/project-local-repo"

echo "Offline repository location:"
echo "  $OFFLINE_REPO"
echo ""

# Check if repository exists
if [ ! -d "$OFFLINE_REPO" ]; then
    echo "ERROR: Offline repository not found at $OFFLINE_REPO"
    exit 1
fi

# Count JAR files
JAR_COUNT=$(find "$OFFLINE_REPO" -name "*.jar" | wc -l)
echo "JAR files in offline repository: $JAR_COUNT"
echo ""

# Check for the specific plugin Codex mentioned
PLUGIN_JAR="$OFFLINE_REPO/org/apache/netbeans/utilities/nbm-maven-plugin/14.2/nbm-maven-plugin-14.2.jar"
if [ -f "$PLUGIN_JAR" ]; then
    echo "✓ Found nbm-maven-plugin-14.2.jar"
    ls -lh "$PLUGIN_JAR"
else
    echo "✗ Missing nbm-maven-plugin-14.2.jar"
    exit 1
fi
echo ""

echo "=========================================="
echo "Running Maven Build with Offline Repository"
echo "=========================================="
echo ""

cd JJazzLab

# Run Maven with explicit offline repository
mvn clean package \
    -DskipTests \
    -Dmaven.repo.local="$OFFLINE_REPO" \
    -X 2>&1 | head -100

echo ""
echo "Build command used:"
echo "  mvn clean package -DskipTests -Dmaven.repo.local=\"$OFFLINE_REPO\""
