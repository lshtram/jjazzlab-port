# JJazzLab Environment Setup Guide

This repository contains the complete JJazzLab source code and is configured to work out-of-the-box in GitHub Codespaces or any devcontainer-compatible environment.

## Quick Start (GitHub Codespaces)

### Option 1: Automatic Setup (Recommended)
1. Click "Code" → "Codespaces" → "Create codespace on main"
2. Wait for the devcontainer to build (~2-3 minutes)
3. The environment will be automatically configured with:
   - Java 23 (OpenJDK)
   - Maven 4.x
   - All necessary VS Code extensions
4. Build the project:
   ```bash
   ./build.sh
   ```

### Option 2: Manual Setup
If the automatic setup fails or you're using a different environment:

```bash
# 1. Ensure Java 23 is installed
java -version  # Should show 23.x

# 2. If not, run the setup script
./.devcontainer/setup.sh

# 3. Build the project
cd JJazzLab
mvn clean install -DskipTests
```

## What's Included

### ✅ All Dependencies Handled by Maven
Maven will automatically download all required dependencies from Maven Central:
- Apache NetBeans Platform modules
- Third-party libraries (Guava, XStream, Commons, etc.)
- Build plugins

**You don't need to commit or push any JAR files or dependencies!**

### ✅ Devcontainer Configuration
The `.devcontainer/devcontainer.json` file ensures:
- Java 23 is automatically installed
- Maven is configured
- VS Code Java extensions are installed
- Maven local repository is cached for faster builds

### ✅ Build Scripts and Documentation
- `build.sh` - Quick build script
- `BUILD_AND_RUN.md` - Detailed build and development guide
- `README.md` - Project overview
- `.devcontainer/setup.sh` - Environment setup script

## System Requirements

### Minimum Requirements
- **Java**: OpenJDK 23.0.1 or later (Java 23.x)
- **Maven**: 3.8+ or 4.x
- **Memory**: 2GB+ RAM for build process
- **Disk**: ~500MB for source + ~500MB for Maven dependencies
- **Internet**: Required for downloading Maven dependencies on first build

### Supported Environments
- ✅ GitHub Codespaces (recommended)
- ✅ VS Code with Remote - Containers
- ✅ Docker containers with devcontainer spec
- ✅ Local Linux/Mac/Windows with Java 23 and Maven

## First Build

### Expected Behavior
```bash
cd JJazzLab
mvn clean install -DskipTests
```

**First build**: ~2-3 minutes (downloads dependencies)
**Subsequent builds**: ~30-60 seconds (dependencies cached)

### Successful Build Output
```
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:25 min
[INFO] Finished at: 2026-01-22T16:19:55Z
[INFO] ------------------------------------------------------------------------
```

### Build Artifacts
After a successful build, you'll find:
```
JJazzLab/app/application/target/jjazzlab/
├── bin/              # Executable launchers
├── etc/              # Configuration files
├── jjazzlab/         # JJazzLab modules
├── platform/         # NetBeans platform modules
└── extra/            # Additional modules
```

## Troubleshooting

### Issue: "Java version mismatch"
**Solution**: Ensure Java 23 is active:
```bash
java -version  # Should show 23.0.1 or 23.x
sdk use java 23.0.1-open  # If using SDKMan
```

### Issue: "Cannot resolve dependencies"
**Solution**: Clear Maven cache and retry:
```bash
rm -rf ~/.m2/repository
mvn clean install -DskipTests -U
```

### Issue: "OutOfMemoryError during build"
**Solution**: Increase Maven memory:
```bash
export MAVEN_OPTS="-Xmx2048m -XX:MaxPermSize=512m"
mvn clean install -DskipTests
```

### Issue: Devcontainer fails to build
**Solution**: Try manual setup:
```bash
# Install Java 23 manually
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk install java 23.0.1-open
sdk use java 23.0.1-open

# Verify and build
java -version
cd JJazzLab
mvn clean install -DskipTests
```

## Working with the Repository

### Clone and Build
```bash
git clone https://github.com/lshtram/jjazzlab-port.git
cd jjazzlab-port
./build.sh
```

### Development Workflow
```bash
# Make changes to source files
# Rebuild specific module
cd JJazzLab/core/YourModule
mvn install

# Or rebuild entire project
cd /workspaces/jjazzlab-port/JJazzLab
mvn install -DskipTests
```

### Running the Application
**Note**: JJazzLab is a GUI application. In a headless environment (like Codespaces), you can build and test the code, but to run the full GUI you'll need:

```bash
# On local machine with display
cd JJazzLab
mvn nbm:run-platform

# Or use the built launcher
./app/application/target/jjazzlab/bin/jjazzlab
```

For Codespaces, you can:
- Build and test the code ✅
- Run unit tests ✅
- Create installers ✅
- Package for distribution ✅

## What Gets Pushed to the Repository?

### ✅ DO COMMIT
- Source code (`.java`, `.form`, `.xml`)
- Build configuration (`pom.xml`, `nbactions.xml`)
- Resources (icons, properties, fonts)
- Documentation (`.md` files)
- Scripts (`build.sh`, setup scripts)
- Devcontainer configuration (`.devcontainer/`)
- Git configuration (`.gitignore`, `.gitattributes`)

### ❌ DO NOT COMMIT
- Built artifacts (`target/` directories) - excluded by `.gitignore`
- Maven dependencies (`~/.m2/repository/`)
- IDE-specific files (`.vscode/`, `.idea/` - unless devcontainer configs)
- Compiled classes (`.class` files)
- Temporary files
- User-specific settings

## Why This Setup Works for New Environments

### Maven Dependency Management
Maven automatically handles all dependencies:
- Declares dependencies in `pom.xml` files
- Downloads from Maven Central on first build
- Caches in `~/.m2/repository/` (local cache)
- No need to commit 100s of MB of JARs!

### Devcontainer Benefits
1. **Reproducible** - Same environment every time
2. **Fast Setup** - Auto-installs required tools
3. **Isolated** - Doesn't affect host system
4. **Cached** - Reuses downloaded dependencies
5. **Documented** - Configuration is in the repo

### SDKMan for Java Management
- Allows easy installation of specific Java versions
- Works on Linux and macOS
- Can manage multiple Java versions simultaneously

## For AI Agents / Codex

When opening this repository in a new sandbox:

1. **The devcontainer will automatically**:
   - Install Java 23
   - Configure Maven
   - Set up the Java development environment
   - Install VS Code extensions

2. **All dependencies are fetched via Maven**:
   - Just run `mvn clean install -DskipTests`
   - Maven downloads everything needed from Central Repository
   - First build takes 2-3 minutes
   - Subsequent builds are much faster

3. **No additional setup needed**:
   - The repository contains everything required
   - Build scripts are included
   - Documentation is comprehensive
   - Environment is reproducible

## Testing the Setup

### Verify Java Installation
```bash
java -version
# Expected: openjdk version "23.0.1"
```

### Verify Maven Installation
```bash
mvn -version
# Expected: Apache Maven 4.x or 3.8+
```

### Test Build
```bash
cd JJazzLab
mvn clean install -DskipTests
# Expected: BUILD SUCCESS
```

### Check Build Output
```bash
ls -la app/application/target/jjazzlab/bin/
# Expected: jjazzlab launcher files
```

## Additional Resources

- **Build Guide**: [BUILD_AND_RUN.md](BUILD_AND_RUN.md)
- **JJazzLab Developer Guide**: https://jjazzlab.gitbook.io/developer-guide/
- **NetBeans Platform**: https://netbeans.org/features/platform/
- **Maven Documentation**: https://maven.apache.org/guides/

## License

JJazzLab is licensed under LGPL v2.1
See the LICENSE file in the JJazzLab directory for details.

---

**Last Updated**: January 22, 2026  
**JJazzLab Version**: 5.1  
**Java Version Required**: 23  
**Build Status**: ✅ Verified Working
