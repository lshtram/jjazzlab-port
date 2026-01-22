# Offline Build Solution for JJazzLab

## Problem: Network-Restricted Environments

If your build environment (like Codex) cannot access external Maven repositories, you can use a **pre-built offline repository bundle** that contains all dependencies.

## Solution: Offline Maven Repository Bundle

Instead of committing 200-300MB of JAR files to the Git repository (bad practice), we provide a separate downloadable archive containing all Maven dependencies.

## Option 1: Create Your Own Bundle (Recommended)

If you have a working build environment with internet access:

```bash
cd JJazzLab
./create-offline-bundle.sh
```

This creates: `../offline-repository/jjazzlab-maven-dependencies.tar.gz` (~200-300MB)

## Option 2: Download Pre-built Bundle

**TODO**: Upload the bundle to GitHub Releases and link here.

For now, you can get it from:
1. Ask the repository owner to run the script and share the archive
2. Or build it yourself once in an unrestricted environment

## Using the Offline Bundle

### Step 1: Extract the bundle

```bash
# Extract dependencies to your Maven repository
tar -xzf jjazzlab-maven-dependencies.tar.gz -C ~/.m2/repository/
```

### Step 2: Build offline

```bash
cd JJazzLab
mvn -o clean install -DskipTests
```

The `-o` flag tells Maven to work **offline** (no network access needed).

## For Codex and AI Agents

If you're Codex or another AI agent in a sandboxed environment:

### Request the Bundle

Ask the user to provide the `jjazzlab-maven-dependencies.tar.gz` file. They can:
1. Run `./create-offline-bundle.sh` in an environment with internet
2. Upload the resulting archive to a file-sharing service
3. Or add it to GitHub Releases

### Use the Bundle

Once you have the archive:

```bash
# Extract it
tar -xzf jjazzlab-maven-dependencies.tar.gz -C ~/.m2/repository/

# Verify extraction
ls ~/.m2/repository/org/apache/netbeans/utilities/nbm-maven-plugin/14.2/
# Should show: nbm-maven-plugin-14.2.jar, nbm-maven-plugin-14.2.pom, etc.

# Build offline
cd JJazzLab
mvn -o clean install -DskipTests
```

## Bundle Contents

The offline bundle includes:
- ✅ NetBeans Platform artifacts (~150MB)
- ✅ Apache Maven plugins (~30MB)
- ✅ Common dependencies (Guava, XStream, Commons, etc.) (~50MB)
- ✅ JUnit and testing frameworks
- ✅ All transitive dependencies

**Total Size**: ~200-300MB compressed

## Why Not Commit JARs to Git?

Committing JAR files to the Git repository is **not recommended** because:

1. **Repo Bloat**: Git repos become 200-300MB+ (vs ~45MB for source only)
2. **Clone Time**: Much slower to clone the repository
3. **Version Control**: Binary files don't diff well
4. **Maven Best Practice**: Dependencies should be declared, not vendored
5. **Updates**: Manual process to update dependencies
6. **Licensing**: Potential issues redistributing third-party JARs

## Hybrid Approach: Store Bundle on GitHub Releases

**Best solution for teams**:

1. Keep the Git repo clean (source code only)
2. Upload `jjazzlab-maven-dependencies.tar.gz` to GitHub Releases
3. Users download it once, extract, and build offline
4. Update bundle only when dependencies change

### How to Set This Up

```bash
# 1. Create the bundle
cd JJazzLab
./create-offline-bundle.sh

# 2. Upload to GitHub Releases
# Go to: https://github.com/lshtram/jjazzlab-port/releases
# Create new release (e.g., v5.1-dependencies)
# Upload: offline-repository/jjazzlab-maven-dependencies.tar.gz

# 3. Users download from releases:
# wget https://github.com/lshtram/jjazzlab-port/releases/download/v5.1-deps/jjazzlab-maven-dependencies.tar.gz
```

Then document in README:

```markdown
## Building Without Internet Access

1. Download dependencies bundle:
   https://github.com/lshtram/jjazzlab-port/releases/download/v5.1-deps/jjazzlab-maven-dependencies.tar.gz

2. Extract: tar -xzf jjazzlab-maven-dependencies.tar.gz -C ~/.m2/repository/

3. Build: cd JJazzLab && mvn -o clean install -DskipTests
```

## Comparison of Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **Maven Central** (current) | Standard practice, small repo, auto-updates | Requires network access |
| **Offline Bundle** (this solution) | No network needed, one-time download | Manual updates, separate file |
| **Commit JARs to Git** | Everything in one place | Huge repo, bad practice, slow clones |

## Recommendation

Use the **Offline Bundle** approach:
- Keeps Git repo clean and fast
- Provides offline build capability
- Follows Maven best practices
- Easy to update (just regenerate bundle)

## Creating Updated Bundles

When dependencies change:

```bash
cd JJazzLab

# Update dependencies in pom.xml
# ... make changes ...

# Create new bundle
./create-offline-bundle.sh

# Upload new bundle to GitHub Releases as new version
# e.g., v5.2-dependencies
```

---

**Solution Status**: ✅ READY  
**Bundle Script**: `JJazzLab/create-offline-bundle.sh`  
**Build Command**: `mvn -o clean install -DskipTests`  
**Bundle Size**: ~200-300MB  
**Git Repo Size**: ~45MB (source only)
