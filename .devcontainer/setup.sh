#!/bin/bash
# JJazzLab Environment Setup Script
# This script ensures Java 23 is installed and sets up the environment

set -e

echo "================================================"
echo "JJazzLab Environment Setup"
echo "================================================"
echo ""

# Check if Java 23 is installed
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}' | awk -F '.' '{print $1}')

if [ "$JAVA_VERSION" != "23" ]; then
    echo "⚠️  Java 23 not found. Current version: Java $JAVA_VERSION"
    echo "Installing Java 23 using SDKMan..."
    echo ""
    
    # Install SDKMan if not present
    if [ ! -d "$HOME/.sdkman" ]; then
        echo "Installing SDKMan..."
        curl -s "https://get.sdkman.io" | bash
        source "$HOME/.sdkman/bin/sdkman-init.sh"
    else
        source "$HOME/.sdkman/bin/sdkman-init.sh"
    fi
    
    # Install Java 23
    echo "Installing Java 23..."
    sdk install java 23.0.1-open || true
    sdk use java 23.0.1-open
    
    echo ""
    echo "✅ Java 23 installed successfully!"
else
    echo "✅ Java 23 is already installed"
fi

echo ""
java -version
echo ""

# Check Maven
echo "Checking Maven..."
if command -v mvn &> /dev/null; then
    echo "✅ Maven is installed"
    mvn -version | head -n 1
else
    echo "⚠️  Maven not found. Please install Maven 3.8+ or 4.x"
    exit 1
fi

echo ""
echo "================================================"
echo "Environment setup complete!"
echo "================================================"
echo ""
echo "To build JJazzLab, run:"
echo "  cd JJazzLab && mvn clean install -DskipTests"
echo ""
echo "Or use the build script:"
echo "  ./build.sh"
echo ""
