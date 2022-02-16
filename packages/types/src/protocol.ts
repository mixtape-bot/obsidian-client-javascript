import type { PlayerEventType } from "./payloads";

export enum CloseCode {
    MissingAuthorization = 4001,
    MissingClientName,
    MissingUserId,
    AlreadyConnected = 4005,
    ErrorOccurred
}

export const closeCodeReasons: Record<CloseCode, string> = {
    [CloseCode.AlreadyConnected]: "A session for the supplied user already exists.",
    [CloseCode.ErrorOccurred]: "An error occurred while handling a received payload.",
    [CloseCode.MissingAuthorization]: "Invalid or missing authentication.",
    [CloseCode.MissingClientName]: "Missing 'Client-Name' header or query-parameter.",
    [CloseCode.MissingUserId]: "Missing 'User-Id' header or query-parameter."
}

export enum OpCode {
    SubmitVoiceServer,
    Stats,
    SetupResuming,
    SetupDispatchBuffer,
    PlayerEvent,
    PlayerUpdate,
    PlayTrack,
    StopTrack,
    Pause,
    Filters,
    Seek,
    Destroy,
    Configure
}

export type DiscordSnowflake = `${bigint}`;

export type Data<T extends ObsidianPayload> = T["d"];

export interface ObsidianPayload {
    op: OpCode;
    d: any;
}

export interface PlayerEvent extends ObsidianPayload {
    op: OpCode.PlayerEvent;
    d: {
        type: PlayerEventType;
        guild_id: DiscordSnowflake;
    }
}

