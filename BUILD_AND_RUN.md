# JJazzLab Build Environment Setup

## ✅ Environment Status: READY

The JJazzLab build environment has been successfully configured!

### Installed Tools
- **Java**: OpenJDK 23.0.1 (required for JJazzLab 5.1)
- **Maven**: 4.0.0-rc-5
- **Build System**: Apache NetBeans Platform (via Maven)

### Project Information
- **Version**: 5.1
- **Architecture**: NetBeans Platform Application
- **Modules**: 66+ modules successfully built
- **Build Time**: ~85 seconds on first build

## Building the Project

### Clean Build
```bash
cd /workspaces/jjazzlab-port/JJazzLab
mvn clean install -DskipTests
```

### Quick Rebuild (after changes)
```bash
cd /workspaces/jjazzlab-port/JJazzLab
mvn install -DskipTests
```

### Build with Tests
```bash
cd /workspaces/jjazzlab-port/JJazzLab
mvn clean install
```

### Build Specific Module
```bash
cd /workspaces/jjazzlab-port/JJazzLab/core/<module-name>
mvn clean install
```

## Running JJazzLab

### Command Line (Headless Environment)
In a dev container without a display, you can't run the GUI directly, but you can:

1. **Test the build artifacts**:
```bash
ls -la app/application/target/jjazzlab/bin/
```

2. **Inspect the application structure**:
```bash
cd app/application/target/jjazzlab
tree -L 2
```

### Running with Display (Local Machine or with X11 forwarding)
```bash
cd /workspaces/jjazzlab-port/JJazzLab
./app/application/target/jjazzlab/bin/jjazzlab
```

Or use the Maven NetBeans Platform plugin:
```bash
cd /workspaces/jjazzlab-port/JJazzLab
mvn nbm:run-platform
```

## Project Structure

```
JJazzLab/
├── core/           # Core libraries (66 modules)
│   ├── Harmony/    # Chord and harmony logic
│   ├── Midi/       # MIDI handling
│   ├── Rhythm/     # Rhythm engine
│   ├── Song/       # Song structure
│   └── ...
├── app/            # Application modules
│   ├── application/    # Main application
│   ├── MixConsole/     # Mixing console UI
│   ├── PianoRoll/      # Piano roll editor
│   └── ...
├── plugins/        # Plugin modules
│   ├── YamJJazz/       # Yamaha style support
│   ├── JJSwing/        # Swing rhythm generator
│   └── FluidSynthEmbeddedSynth/  # Built-in synth
└── pom.xml         # Root Maven configuration
```

## Development Tips

### IDE Setup
JJazzLab is designed to work best with Apache NetBeans IDE, but you can use:
- VS Code with Java extensions
- IntelliJ IDEA (import as Maven project)
- Eclipse (import as Maven project)

### Hot Reload
When developing, you can use NetBeans Platform's development mode:
```bash
mvn nbm:run-platform -Dnetbeans.run.params.debug="-J-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=8000"
```

### Adding New Modules
1. Create module structure under `core/`, `app/`, or `plugins/`
2. Add module to parent `pom.xml`
3. Follow NetBeans Platform module conventions

## Troubleshooting

### Java Version Issues
If you see compiler errors, ensure Java 23 is active:
```bash
java -version  # Should show 23.0.1
sdk use java 23.0.1-open  # Switch if needed
```

### Maven Memory Issues
If build fails with OutOfMemoryError:
```bash
export MAVEN_OPTS="-Xmx2048m -XX:MaxPermSize=512m"
mvn clean install
```

### Module Resolution Issues
If modules can't find dependencies:
```bash
cd /workspaces/jjazzlab-port/JJazzLab
mvn dependency:tree  # View dependency tree
mvn dependency:resolve  # Force dependency download
```

## Testing

### Run All Tests
```bash
mvn test
```

### Run Specific Module Tests
```bash
cd core/Harmony
mvn test
```

### Code Coverage
```bash
mvn clean test jacoco:report
```

## Deployment

### Create Distribution Package
```bash
mvn clean install
mvn nbm:cluster-app
mvn nbm:build-installers
```

The installers will be created in:
```
app/application/target/jjazzlab-installers/
```

## Resources

- **Official Documentation**: https://jjazzlab.gitbook.io/developer-guide/
- **User Guide**: https://jjazzlab.gitbook.io/user-guide/
- **Source Repository**: https://github.com/jjazzboss/JJazzLab
- **Website**: https://www.jjazzlab.org

## License

Lesser GPL v2.1 (LGPL v2.1)
See LICENSE file in the project root.

---

**Build Environment Created**: January 22, 2026
**Last Successful Build**: ✅ SUCCESS (01:25 min)
