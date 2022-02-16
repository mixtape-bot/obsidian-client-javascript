export enum Filter {
    Volume = "volume",
    Tremolo = "tremolo",
    Equalizer = "equalizer",
    Distortion = "distortion",
    Timescale = "timescale",
    Karaoke = "karaoke",
    ChannelMix = "channel_mix",
    Vibrato = "vibrato",
    Rotation = "rotation",
    LowPass = "low_pass"
}

export type VolumeFilter = number;

export type TremoloFilter = OscillatingFilter;

export type EqualizerFilter = Array<EqualizerBand>;

export type DistortionFilter = Record<`${SOHCAHTOA}_${DistortionOption}` | DistortionOption, number>;

export type TimescaleFilter = {
    pitch: number;
    pitch_octaves: number;
    pitch_semi_tones: number;
    rate: number;
    rate_change: number;
    speed: number;
    speed_change: number;
};

export interface KaraokeFilter {
    filter_band: number;
    filter_width: number;
    level: number;
    mono_level: number;
}

export type ChannelMixFilter = Record<`${Direction}_to_${Direction}`, number>;

export type VibratoFilter = OscillatingFilter;

export type RotationFilter = number;

export type LowPassFilter = number;

export interface FilterMap {
    [Filter.Volume]: VolumeFilter;
    [Filter.Tremolo]: TremoloFilter;
    [Filter.Equalizer]: EqualizerFilter;
    [Filter.Distortion]: DistortionFilter;
    [Filter.Timescale]: TimescaleFilter;
    [Filter.Karaoke]: KaraokeFilter;
    [Filter.ChannelMix]: ChannelMixFilter;
    [Filter.Vibrato]: VibratoFilter;
    [Filter.Rotation]: RotationFilter;
    [Filter.LowPass]: LowPassFilter;
}

// export const test = (data: ChannelMixFilter) => void data;
//
// test({  })

export interface EqualizerBand {
    band: number;
    gain: number;
}

type Direction = "right" | "left";
type SOHCAHTOA = "sin" | "cos" | "tan";
type DistortionOption = "scale" | "offset"

interface OscillatingFilter {
    depth: number;
    frequency: number;
}
