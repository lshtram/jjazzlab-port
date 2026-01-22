# Build Instructions for Codex (Offline Environment)

This repository is configured for **completely offline builds** - no external Maven repository access required.

## Quick Start

```bash
cd JJazzLab
mvn clean package -DskipTests -Dmaven.repo.local=../offline-repository/project-local-repo
```

## What's Included

- **Java 21** pre-configured in devcontainer
- **Maven 3.9.12** pre-installed
- **Complete offline Maven repository** at `offline-repository/project-local-repo/` (208MB)
  - All dependencies from Maven Central
  - All Apache NetBeans dependencies
  - All transitive dependencies

## Build Options

### Standard build (with tests):
```bash
cd JJazzLab
mvn clean install -Dmaven.repo.local=../offline-repository/project-local-repo
```

### Fast build (skip tests):
```bash
cd JJazzLab
mvn clean package -DskipTests -Dmaven.repo.local=../offline-repository/project-local-repo
```

### Using the build script:
```bash
./build.sh
```

## Expected Output

The build produces a NetBeans Platform application in:
```
JJazzLab/application/target/jjazzlab/
```

## Environment Details

- Java: OpenJDK 21.0.9 LTS
- Maven: 3.9.12
- Target Platform: NetBeans Platform (RELEASE280)

## No Network Required

This setup works in completely air-gapped environments - the only external dependency is the GitHub repository itself for the initial clone.
