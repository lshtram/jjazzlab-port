# OFFLINE BUILD SETUP

## Location of Offline Maven Repository

**Absolute Path:** `/workspaces/jjazzlab-port/offline-repository/project-local-repo`

**Relative Path (from repo root):** `offline-repository/project-local-repo`

## Repository Contents

- **318 JAR files** containing all Maven dependencies
- All dependencies from Maven Central
- All Apache NetBeans Platform dependencies (RELEASE280)
- All transitive dependencies

## Verification

The repository contains the exact plugin Codex is looking for:

```bash
$ ls -lh offline-repository/project-local-repo/org/apache/netbeans/utilities/nbm-maven-plugin/14.2/
-rw-rw-rw- 1 vscode vscode 165K Jul 31  2024 nbm-maven-plugin-14.2.jar
-rw-rw-rw- 1 vscode vscode  19K Jul 31  2024 nbm-maven-plugin-14.2.pom
```

## Maven Build Command

**From repository root:**

```bash
cd JJazzLab
mvn clean package -DskipTests -Dmaven.repo.local="$(pwd)/../offline-repository/project-local-repo"
```

**Or with absolute path (RECOMMENDED FOR CODEX):**

```bash
cd JJazzLab  
mvn clean package -DskipTests -Dmaven.repo.local=/workspaces/jjazzlab-port/offline-repository/project-local-repo
```

## Test Script

Run the test script to verify the offline repository:

```bash
./test-offline-build.sh
```

## Troubleshooting

If Maven still tries to access external repositories, add `-o` for strict offline mode:

```bash
mvn -o clean package -DskipTests -Dmaven.repo.local=/workspaces/jjazzlab-port/offline-repository/project-local-repo
```
