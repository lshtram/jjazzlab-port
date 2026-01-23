# MIDI Fixtures

This folder stores MIDI outputs used for Java↔TS parity checks.

## Java Export

Use the Yamaha CLI exporter to generate a baseline MIDI file. This repo is often built offline, so run directly with `javac/java`:

```bash
find JJazzLab/app/application/target/jjazzlab -type f -name '*.jar' | sort > web/tmp/jjazzlab-jars.txt
paste -sd: web/tmp/jjazzlab-jars.txt > web/tmp/jjazzlab-classpath.txt

javac -cp "$(cat web/tmp/jjazzlab-classpath.txt)" -d web/tmp/cli-classes \
  JJazzLab/app/Test/src/main/java/org/jjazz/test/ExportYamahaMidiCli.java \
  JJazzLab/core/SongStructure/src/main/java/org/jjazz/songstructure/SongStructureImpl.java

java -Djava.awt.headless=true \
  -Duser.home=/workspaces/jjazzlab-port/web/tmp/home \
  -Dnetbeans.user=/workspaces/jjazzlab-port/web/tmp/netbeans-user \
  --add-opens java.base/java.net=ALL-UNNAMED \
  -cp "web/tmp/cli-classes:$(cat web/tmp/jjazzlab-classpath.txt)" \
  org.jjazz.test.ExportYamahaMidiCli \
  --style "web/fixtures/styles/yamaha/jjazzlab_user_styles/jjazzlab_user_styles/Swing&Jazz/JazzBluesSimple.S740.sty" \
  --out "web/fixtures/midi/java/jazzblues_simple_12bar.mid"
```

The CLI supports these flags:

```
--style <file>   Yamaha .sty/.prs/.bcs/.sst file
--out <file>     Output MIDI file
--tempo <bpm>    Optional tempo override
--bars <n>       Optional bars (>= 12)
--exportable     Add export initialization events
```

## TS Harness (WIP)

Generate a basic MIDI file from the Yamaha style pattern (no chord adaptation yet):

```bash
cd web/app
npm run tools:yamaha -- \
  --style "../fixtures/styles/yamaha/jjazzlab_user_styles/jjazzlab_user_styles/Swing&Jazz/JazzBluesSimple.S740.sty" \
  --out "../fixtures/midi/ts/jazzblues_simple_12bar.mid" \
  --bars 12 \
  --part "Main A"
```

Compare summary stats against the Java export:

```bash
cd web/app
npm run tools:compare -- \
  --a "../fixtures/midi/java/jazzblues_simple_12bar.mid" \
  --b "../fixtures/midi/ts/jazzblues_simple_12bar.mid"
```
