/*
 *  DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS HEADER.
 *
 *  Copyright @2019 Jerome Lelasseux. All rights reserved.
 *
 *  This file is part of the JJazzLab software.
 *
 *  JJazzLab is free software: you can redistribute it and/or modify
 *  it under the terms of the Lesser GNU General Public License (LGPLv3)
 *  as published by the Free Software Foundation, either version 3 of the License,
 *  or (at your option) any later version.
 *
 *  JJazzLab is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with JJazzLab.  If not, see <https://www.gnu.org/licenses/>
 *
 *  Contributor(s):
 */
package org.jjazz.test;

import java.io.File;
import java.text.ParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;
import javax.sound.midi.MidiSystem;
import org.jjazz.chordleadsheet.api.ChordLeadSheet;
import org.jjazz.chordleadsheet.api.ChordLeadSheetFactory;
import org.jjazz.chordleadsheet.api.item.CLI_Factory;
import org.jjazz.chordleadsheet.api.item.CLI_Section;
import org.jjazz.harmony.api.TimeSignature;
import org.jjazz.midimix.api.MidiMix;
import org.jjazz.midi.api.InstrumentMix;
import org.jjazz.rhythm.api.RhythmVoice;
import org.jjazz.rhythmmusicgeneration.api.SongSequenceBuilder;
import org.jjazz.song.api.Song;
import org.jjazz.song.api.SongFactory;
import org.jjazz.songcontext.api.SongContext;
import org.jjazz.songstructure.SongStructureImpl;
import org.jjazz.songstructure.api.SongPart;
import org.jjazz.songstructure.api.event.SgsActionEvent;
import org.jjazz.yamjjazz.rhythm.YamJJazzRhythmImpl;

/**
 * CLI utility to export a Yamaha style with a simple progression to a MIDI file.
 */
public final class ExportYamahaMidiCli
{

    private static final Logger LOGGER = Logger.getLogger(ExportYamahaMidiCli.class.getSimpleName());

    private ExportYamahaMidiCli()
    {
    }

    public static void main(String[] args) throws Exception
    {
        System.setProperty("java.awt.headless", "true");
        System.setProperty("jjazz.skipAdaptedRhythms", "true");
        Args parsed = Args.parse(args);
        if (parsed.showHelp)
        {
            printUsage();
            return;
        }

        File styleFile = requireFile(parsed.stylePath, "--style");
        File outFile = requireOutput(parsed.outPath);

        YamJJazzRhythmImpl rhythm = new YamJJazzRhythmImpl(styleFile);
        TimeSignature ts = rhythm.getTimeSignature();
        if (!TimeSignature.FOUR_FOUR.equals(ts))
        {
            throw new IllegalArgumentException("Only 4/4 supported for now. style=" + styleFile.getName() + " ts=" + ts);
        }

        int bars = parsed.bars;
        ChordLeadSheet cls = buildBluesLeadSheet(bars, ts);

        SongStructureImpl sgs = new SongStructureImpl(cls);
        CLI_Section section = cls.getSection(0);
        SongPart spt = sgs.createSongPart(rhythm, section.getData().getName(), 0, bars, section, false);
        addSongPartUnsafe(sgs, spt);

        Song song = SongFactory.getInstance().createSong("YamahaBlues", sgs, false);
        int tempo = parsed.tempo > 0 ? parsed.tempo : rhythm.getPreferredTempo();
        song.setTempo(tempo);

        MidiMix midiMix = buildMidiMix(rhythm);
        midiMix.setSong(song);

        SongContext context = new SongContext(song, midiMix);
        SongSequenceBuilder builder = new SongSequenceBuilder(context);
        SongSequenceBuilder.SongSequence songSequence = builder.buildAll(true);
        if (parsed.exportable)
        {
            builder.makeSequenceExportable(songSequence, true);
        }

        if (outFile.getParentFile() != null)
        {
            outFile.getParentFile().mkdirs();
        }
        MidiSystem.write(songSequence.sequence, 1, outFile);
        LOGGER.info("MIDI exported to " + outFile.getAbsolutePath());
    }

    private static MidiMix buildMidiMix(YamJJazzRhythmImpl rhythm)
    {
        MidiMix mix = new MidiMix();
        for (RhythmVoice rv : rhythm.getRhythmVoices())
        {
            int channel = rv.getPreferredChannel();
            if (mix.getInstrumentMix(channel) != null)
            {
                channel = mix.findFreeChannel(rv.isDrums());
                if (channel == -1)
                {
                    throw new IllegalStateException("No free MIDI channel for " + rv.getName());
                }
            }
            InstrumentMix insMix = new InstrumentMix(rv.getPreferredInstrument(), rv.getPreferredInstrumentSettings());
            mix.setInstrumentMix(channel, rv, insMix);
        }
        return mix;
    }

    private static void addSongPartUnsafe(SongStructureImpl sgs, SongPart spt)
    {
        try
        {
            var start = SongStructureImpl.class.getDeclaredMethod(
                    "fireSgsActionEventStart",
                    SgsActionEvent.API_ID.class,
                    Object.class);
            var add = SongStructureImpl.class.getDeclaredMethod("addSongPartImpl", SongPart.class);
            var complete = SongStructureImpl.class.getDeclaredMethod(
                    "fireSgsActionEventComplete",
                    SgsActionEvent.API_ID.class);
            start.setAccessible(true);
            add.setAccessible(true);
            complete.setAccessible(true);
            start.invoke(sgs, SgsActionEvent.API_ID.AddSongParts, List.of(spt));
            add.invoke(sgs, spt);
            complete.invoke(sgs, SgsActionEvent.API_ID.AddSongParts);
        } catch (ReflectiveOperationException ex)
        {
            throw new IllegalStateException("Failed to add SongPart without triggering rhythm database.", ex);
        }
    }

    private static ChordLeadSheet buildBluesLeadSheet(int bars, TimeSignature ts) throws ParseException
    {
        if (bars < 12)
        {
            throw new IllegalArgumentException("bars must be >= 12 for blues progression. bars=" + bars);
        }
        ChordLeadSheetFactory factory = ChordLeadSheetFactory.getDefault();
        ChordLeadSheet cls = factory.createEmptyLeadSheet("A", ts, bars, null);
        CLI_Factory cliFactory = CLI_Factory.getDefault();

        addChord(cls, cliFactory, "Bb7", 0);
        addChord(cls, cliFactory, "Eb7", 4);
        addChord(cls, cliFactory, "Bb7", 6);
        addChord(cls, cliFactory, "F7", 8);
        addChord(cls, cliFactory, "Eb7", 9);
        addChord(cls, cliFactory, "Bb7", 10);
        addChord(cls, cliFactory, "F7", 11);

        return cls;
    }

    private static void addChord(ChordLeadSheet cls, CLI_Factory factory, String chord, int bar) throws ParseException
    {
        cls.addItem(factory.createChordSymbol(chord, bar, 0));
    }

    private static File requireFile(String path, String flag)
    {
        if (path == null || path.isBlank())
        {
            throw new IllegalArgumentException("Missing required flag " + flag);
        }
        File file = new File(path);
        if (!file.isFile())
        {
            throw new IllegalArgumentException("File not found: " + file.getAbsolutePath());
        }
        return file;
    }

    private static File requireOutput(String path)
    {
        if (path == null || path.isBlank())
        {
            throw new IllegalArgumentException("Missing required flag --out");
        }
        return new File(path);
    }

    private static void printUsage()
    {
        System.err.println("Usage: ExportYamahaMidiCli --style <file> --out <file> [--tempo <bpm>] [--bars <n>] [--exportable]");
    }

    private static final class Args
    {
        final String stylePath;
        final String outPath;
        final int tempo;
        final int bars;
        final boolean exportable;
        final boolean showHelp;

        private Args(String stylePath, String outPath, int tempo, int bars, boolean exportable, boolean showHelp)
        {
            this.stylePath = stylePath;
            this.outPath = outPath;
            this.tempo = tempo;
            this.bars = bars;
            this.exportable = exportable;
            this.showHelp = showHelp;
        }

        static Args parse(String[] args)
        {
            Map<String, String> values = new HashMap<>();
            boolean exportable = false;
            boolean help = false;
            for (int i = 0; i < args.length; i++)
            {
                String arg = args[i];
                if ("--exportable".equals(arg))
                {
                    exportable = true;
                    continue;
                }
                if ("--help".equals(arg) || "-h".equals(arg))
                {
                    help = true;
                    continue;
                }
                if (arg.startsWith("--"))
                {
                    if (i + 1 >= args.length)
                    {
                        throw new IllegalArgumentException("Missing value for " + arg);
                    }
                    values.put(arg, args[++i]);
                }
            }

            int tempo = parseInt(values.get("--tempo"), -1);
            int bars = parseInt(values.get("--bars"), 12);
            return new Args(values.get("--style"), values.get("--out"), tempo, bars, exportable, help);
        }

        private static int parseInt(String value, int fallback)
        {
            if (value == null)
            {
                return fallback;
            }
            return Integer.parseInt(value);
        }
    }
}
