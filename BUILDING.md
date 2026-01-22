# Building JJazzLab - Network and Repository Configuration

## TL;DR for Restricted Environments

If you're in a sandboxed environment with limited network access (like Codex online), the build may fail to download dependencies. Here's how to fix it:

### Quick Fix for Codex/Sandbox Environments

```bash
# Use Maven Central only (most reliable)
cd JJazzLab
mvn clean install -DskipTests -s ../.mvn/settings.xml
```

The `.mvn/settings.xml` file configures Maven to prioritize Maven Central, which should be accessible from most environments.

## Repository Configuration

### Primary Repository: Maven Central
- **URL**: `https://repo.maven.apache.org/maven2`
- **Contains**: All NetBeans Platform artifacts, including `nbm-maven-plugin:14.2`
- **Accessibility**: Should be available from most environments

### Secondary Repository: Apache NetBeans
- **URL**: `https://netbeans.apache.org/maven2`
- **Purpose**: Fallback for NetBeans-specific artifacts
- **Note**: May be blocked in some sandboxed environments

## Verification: NBM Plugin is on Maven Central

You can verify the plugin is available:

```bash
curl -I "https://repo.maven.apache.org/maven2/org/apache/netbeans/utilities/nbm-maven-plugin/14.2/nbm-maven-plugin-14.2.pom"
# Should return: HTTP/1.1 200 OK
```

Direct URL: https://repo.maven.apache.org/maven2/org/apache/netbeans/utilities/nbm-maven-plugin/14.2/

## Troubleshooting Network Issues

### Problem: "Could not resolve nbm-maven-plugin"

This means Maven cannot reach the repository to download the plugin.

**Solution 1**: Use Maven Central explicitly
```bash
cd JJazzLab
mvn clean install -DskipTests -s ../.mvn/settings.xml
```

**Solution 2**: Check repository accessibility
```bash
# Test Maven Central access
curl -I https://repo.maven.apache.org/maven2/

# Test NetBeans repository access (may fail in sandboxes)
curl -I https://netbeans.apache.org/maven2/
```

**Solution 3**: Use offline mode with pre-populated repository
```bash
# If you have a pre-populated ~/.m2/repository with all dependencies:
mvn -o clean install -DskipTests
```

**Solution 4**: Configure HTTP proxy (if applicable)
```bash
export MAVEN_OPTS="-Dhttp.proxyHost=proxy.example.com -Dhttp.proxyPort=8080"
mvn clean install -DskipTests
```

### Problem: "Repository netbeans is blocked"

Some environments explicitly block certain repository URLs.

**Solution**: Use Maven Central only

Edit `JJazzLab/pom.xml` and remove the NetBeans repository section (lines 54-64), keeping only Maven Central. Since all artifacts are mirrored to Central, this should work.

### Problem: Network timeout

**Solution**: Increase Maven timeout
```bash
export MAVEN_OPTS="-Dmaven.wagon.http.connectionTimeout=60000 -Dmaven.wagon.http.readTimeout=60000"
mvn clean install -DskipTests
```

## Build Modes

### Standard Build (with tests)
```bash
cd JJazzLab
mvn clean install
```

### Fast Build (skip tests)
```bash
cd JJazzLab
mvn clean install -DskipTests
```

### Package Only (no install)
```bash
cd JJazzLab
mvn clean package -DskipTests
```

### Offline Build (requires pre-populated ~/.m2/repository)
```bash
cd JJazzLab
mvn -o clean install -DskipTests
```

### With Custom Settings
```bash
cd JJazzLab
mvn clean install -DskipTests -s ../.mvn/settings.xml
```

## Pre-populated Repository Archive

For truly offline or highly restricted environments, you can pre-populate the Maven repository.

### Creating a Repository Archive (from a working environment)

```bash
# After a successful build, package the Maven repository
cd ~/.m2/repository
tar -czf /tmp/jjazzlab-m2-repo.tar.gz \
    org/apache/netbeans/ \
    org/netbeans/ \
    org/jjazzlab/ \
    com/google/guava/ \
    com/thoughtworks/xstream/ \
    org/codehaus/plexus/
```

### Using a Pre-populated Repository

```bash
# Extract the archive to your home directory
tar -xzf jjazzlab-m2-repo.tar.gz -C ~/.m2/repository/

# Build offline
cd JJazzLab
mvn -o clean install -DskipTests
```

## Dependency Overview

### Critical Dependencies (Must be available)
- `org.apache.netbeans.utilities:nbm-maven-plugin:14.2` ✅ On Maven Central
- `org.netbeans.api:*:RELEASE280` ✅ On Maven Central  
- `org.netbeans.modules:*:RELEASE280` ✅ On Maven Central
- `com.google.guava:guava:33.2.1-jre` ✅ On Maven Central
- `com.thoughtworks.xstream:xstream:1.4.20` ✅ On Maven Central

### Total Dependencies
- **Direct**: ~50 artifacts
- **Transitive**: ~200 artifacts
- **Total Download Size**: ~300 MB (first build only)

All dependencies are available on Maven Central.

## For Codex and AI Agents

If you're an AI agent trying to build this project in a sandboxed environment:

1. **Network Access**: Ensure `https://repo.maven.apache.org/maven2` is accessible
2. **Maven Settings**: Use the provided `.mvn/settings.xml` configuration
3. **Build Command**: `mvn clean install -DskipTests -s .mvn/settings.xml`
4. **Fallback**: Request a pre-populated `~/.m2/repository` archive from the user

### Recommended Build Sequence

```bash
# 1. Verify Java version
java -version  # Must be 23.x

# 2. Verify Maven Central access
curl -I https://repo.maven.apache.org/maven2/

# 3. Clean any cached failed attempts
rm -rf ~/.m2/repository/org/apache/netbeans/utilities/nbm-maven-plugin/

# 4. Build with explicit settings
cd JJazzLab
mvn clean install -DskipTests -s ../.mvn/settings.xml -U

# 5. If step 4 fails, try with verbose output
mvn clean install -DskipTests -s ../.mvn/settings.xml -U -X 2>&1 | tee build.log
```

## Alternative: Build in Docker

If the environment has Docker but restricted network:

```dockerfile
FROM maven:3.9-eclipse-temurin-23

# Copy pre-populated repository (if available)
COPY m2-repository.tar.gz /tmp/
RUN tar -xzf /tmp/m2-repository.tar.gz -C /root/

# Copy source code
COPY JJazzLab /build/JJazzLab
WORKDIR /build/JJazzLab

# Build offline
RUN mvn -o clean install -DskipTests
```

## Repository Contents

The Maven Central repository contains complete NetBeans Platform distributions:

- **NBM Maven Plugin**: `org/apache/netbeans/utilities/nbm-maven-plugin/14.2/`
- **NetBeans APIs**: `org/netbeans/api/` (100+ modules)
- **NetBeans Modules**: `org/netbeans/modules/` (200+ modules)
- **NetBeans External**: `org/netbeans/external/` (bundled libraries)

All with version `RELEASE280` (NetBeans 28.0)

## Success Criteria

A successful build will:
1. Download ~200-300 MB of dependencies (first time only)
2. Compile 66 modules (core + app + plugins)
3. Generate NBM files for each module
4. Create application bundle at `app/application/target/jjazzlab/`
5. Show `BUILD SUCCESS` message
6. Complete in 2-3 minutes (first build) or 30-60 seconds (subsequent)

## Still Having Issues?

1. Check Maven logs: `mvn -X clean install -DskipTests 2>&1 | tee build.log`
2. Verify repository access: `curl -v https://repo.maven.apache.org/maven2/`
3. Check proxy settings: `echo $http_proxy $https_proxy`
4. Try with fresh Maven cache: `rm -rf ~/.m2/repository && mvn clean install`
5. Contact repository maintainer for pre-populated archive

---

**Repository Configuration Updated**: January 22, 2026  
**NBM Plugin Version**: 14.2 (verified on Maven Central)  
**NetBeans Version**: RELEASE280  
**Maven Central URL**: https://repo.maven.apache.org/maven2  
