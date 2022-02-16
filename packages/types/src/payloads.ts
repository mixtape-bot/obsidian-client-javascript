import type { DiscordSnowflake, ObsidianPayload, OpCode, PlayerEvent } from "./protocol";
import type { FilterMap } from "./filters";

interface MakePayload<O extends OpCode, D> extends ObsidianPayload {
    op: O;
    d: D;
}

interface MakePlayerEvent<T extends PlayerEventType, D> extends PlayerEvent {
    op: OpCode.PlayerEvent
    d: {
        type: T;
        guild_id: DiscordSnowflake;
    } & D;
}

export type OutgoingPayloads = SubmitVoiceServer | SetupResuming | SetupDispatchBuffer | PlayTrack | StopTrack | Pause | Filters | Seek | Destroy | Configure;
export type IncomingPayloads = Stats | PlayerEvents | PlayerUpdate;
export type PlayerEvents = TrackStartEvent | TrackEndEvent | TrackExceptionEvent | TrackStuckEvent | WebsocketClosedEvent | WebsocketOpenEvent;


export enum PlayerEventType {
    TrackStart = "TRACK_START",
    TrackEnd = "TRACK_END",
    TrackStuck = "TRACK_STUCK",
    TrackException = "TRACK_EXCEPTION",
    WebsocketOpen = "WEBSOCKET_OPEN",
    WebsocketClosed = "WEBSOCKET_CLOSED"
}

/* payloads. */
export type SubmitVoiceServer = MakePayload<OpCode.SubmitVoiceServer, {
    guild_id: DiscordSnowflake;
    token: string;
    session_id: string;
    endpoint: string;
}>;

export type Stats = MakePayload<OpCode.Stats, {
    memory: Record<"heap_used" | "non_heap_used", HeapInfo>;
    cpu: CpuInfo;
    threads: ThreadInfo;
    frames: Array<IdentifiedFrameStats>;
    players: PlayersInfo
}>;

export type SetupResuming = MakePayload<OpCode.SetupResuming, {
    key: string;
    timeout: number;
}>;

export type SetupDispatchBuffer = MakePayload<OpCode.SetupDispatchBuffer, {
    timeout: number;
}>;

export type TrackStartEvent = MakePlayerEvent<PlayerEventType.TrackStart, {
    track: string;
}>;

export type TrackEndEvent = MakePlayerEvent<PlayerEventType.TrackEnd, {
    track: string;
    reason: TrackEndReason;
}>;

export type TrackStuckEvent = MakePlayerEvent<PlayerEventType.TrackStuck, {
    track: string;
    threshold_ms: number;
}>;

export type TrackExceptionEvent = MakePlayerEvent<PlayerEventType.TrackException, {
    track: string;
    exception: Exception
}>;

export type WebsocketOpenEvent = MakePlayerEvent<PlayerEventType.WebsocketOpen, {
    target: string;
    ssrc: number;
}>;

export type WebsocketClosedEvent = MakePlayerEvent<PlayerEventType.WebsocketClosed, {
    code: number;
    reason: string;
    by_remote: boolean;
}>;

export type PlayerUpdate = MakePayload<OpCode.PlayerUpdate, {
    guild_id: DiscordSnowflake;
    frames: FrameStats;
    current_track: CurrentTrack;
    filters: FilterMap;
}>;

export type PlayTrack = MakePayload<OpCode.PlayTrack, {
    guild_id: DiscordSnowflake;
    track: string;
    start_time?: number;
    end_time?: number;
    no_replace?: boolean;
}>;

export type StopTrack = MakePayload<OpCode.StopTrack, {
    guild_id: DiscordSnowflake;
}>;

export type Pause = MakePayload<OpCode.Pause, {
    guild_id: DiscordSnowflake;
    state: boolean;
}>;

export type Filters = MakePayload<OpCode.Filters, {
    guild_id: DiscordSnowflake;
    filters: FilterMap;
}>;

export type Seek = MakePayload<OpCode.Seek, {
    guild_id: DiscordSnowflake;
    position: number;
}>;

export type Destroy = MakePayload<OpCode.Destroy, {
    guild_id: DiscordSnowflake;
}>;

export type Configure = MakePayload<OpCode.Configure, {
    guild_id: DiscordSnowflake;
    pause?: boolean;
    filters?: FilterMap;
    send_player_updates?: boolean;
}>;

/* other types */

export type IdentifiedFrameStats = FrameStats & { guild_id: DiscordSnowflake; }

export enum TrackEndReason {
    Stopped = "STOPPED",
    Replaced = "REPLACED",
    Cleanup = "CLEANUP",
    LoadFailed = "LOAD_FAILED",
    Finished = "FINISHED"
}

export enum ExceptionSeverity {
    Common = "COMMON",
    Fault = "FAULT",
    Suspicious = "SUSPICIOUS"
}

export interface CurrentTrack {
    track: string;
    paused: boolean;
    position: number;
}

export interface Exception {
    message: string;
    cause: string;
    severity: ExceptionSeverity;
}

export interface PlayersInfo {
    active: number;
    total: number;
}

export interface FrameStats {
    loss: number;
    sent: number;
    usable: boolean;
}

export interface ThreadInfo {
    running: number;
    daemon: number;
    peak: number;
    total_started: number;
}

export interface CpuInfo {
    cores: number;
    system_load: number;
    process_load: number;
}

export interface HeapInfo {
    init: number;
    max: number;
    committed: number;
    used: number;
}

