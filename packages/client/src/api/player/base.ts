import { TypedEmitter } from "tiny-typed-emitter";
import { Filter, OpCode, PlayerEvents, PlayerEventType, PlayerUpdate } from "@mixtape-bot/obsidian-api";

import type * as Server from "@mixtape-bot/obsidian-api";

import type { DiscordVoiceServer, DiscordVoiceState, Node } from "../node/Node";

export abstract class Player extends TypedEmitter<{
    trackStart: (event: Server.Data<Server.TrackStartEvent>) => void;
    trackEnd: (event: Server.Data<Server.TrackEndEvent>) => void;
    trackStuck: (event: Server.Data<Server.TrackStuckEvent>) => void;
    trackError: (event: Server.Data<Server.TrackExceptionEvent>) => void;
    channelLeave: (channelId: string) => void;
    channelJoin: (channelId: string) => void;
    channelMove: (oldChannelId: string, newChannelId: string) => void;
    debug: (message: string) => void;
}> {
    readonly node: Node;
    readonly guild: Server.DiscordSnowflake;

    /**
     * Voice channel for this player.
     */
    channel: Server.DiscordSnowflake | null;

    /**
     * The track that this player is currently playing, or null if nothing is playing.
     */
    track: string | null;

    /**
     * Whether this player is playing something.
     */
    playing: boolean;

    /**
     * Whether this player is paused.
     */
    paused: boolean;

    /**
     * Current track position in milliseconds.2
     */
    position: number;

    /**
     * The filters that are currently active.
     */
    filters: Partial<Server.FilterMap>;

    /**
     * If this player is connected to a voice channel.
     */
    connected: boolean;

    /**
     * Frame stats for this player.
     */
    frames: Server.FrameStats;

    #_server: Partial<VoiceServer> = {}

    constructor(node: Node, guild: Server.DiscordSnowflake) {
        super();

        this.node = node;
        this.guild = guild;

        this.channel = null;
        this.track = null;
        this.playing = false;
        this.paused = false;
        this.position = 0;
        this.filters = {}
        this.connected = false;
        this.frames = { loss: 0, sent: 0, usable: false }
    }

    /**
     * Connects to the supplied voice channel
     * @param channel Voice channel id
     * @param options Connect options.
     */
    join(channel: Server.DiscordSnowflake | { id: Server.DiscordSnowflake }, options: ConnectOptions = {}): this {
        let channelId = typeof channel === "object" ? channel.id : channel;

        this.debug("voice:", `updating voice state of the bot; guild=${this.guild}, channel=${channelId}`)
        this.node.sendGatewayPayload(this.guild, {
            op: 4,
            d: {
                guild_id: this.guild,
                channel_id: channelId,
                self_deaf: options.deaf ?? false,
                self_mute: options.mute ?? false
            }
        });

        return this
    }

    /**
     * Leaves the connected voice channel.
     * @param force Whether to force disconnect, `false` by default.
     */
    leave(force = false): this {
        if (!force && !this.channel) {
            return this;
        }

        this.channel = null;
        this.node.sendGatewayPayload(this.guild, {
            op: 4,
            d: {
                guild_id: this.guild,
                channel_id: null,
                self_deaf: false,
                self_mute: false
            }
        });

        return this;
    }

    /**
     * Resumes playback.
     * @returns `true` if the request went through.
     */
    resume(): Promise<boolean> {
        if (!this.paused) {
            return Promise.resolve(false);
        }

        return this.pause(false);
    }

    /**
     * Plays the supplied track.
     * @param track Track to play
     * @param options Options used to specify the start and end time of the track, and whether to replace the currently playing track.
     * @returns `true` if the request went through,
     */
    abstract play(track: string | { track: string }, options?: PlayOptions): Promise<boolean>

    /**
     * Stops the current track.
     * @returns `true` if the request went through,
     */
    abstract stop(): Promise<boolean>;

    /**
     * Change the pause state of this player. `true` pauses playback, vice versa
     * @param state Pause state, defaults to true.
     * @returns `true` if the request went through.
     */
    abstract pause(state?: boolean): Promise<boolean>;

    /**
     * Seek to a position in the current track.
     * @param position Position to seek to, in milliseconds.
     * @returns `true` if the request went through.
     */
    abstract seek(position: number): Promise<boolean>;

    /**
     * Destroys this player
     * @returns `true` if the request went through.
     */
    abstract destroy(): Promise<boolean>;

    /**
     * Replaces all filters with the one's provided.
     * @param filters The filters to use
     */
    abstract setFilters(filters: Server.FilterMap): Promise<boolean>;

    /**
     * Set a single filter's data
     * @param filter Filter to set
     * @param data Data to use.
     */
    abstract setFilters<F extends Filter>(filter: F, data: Partial<Server.FilterMap[F]>): Promise<boolean>;

    /**
     * Submits the supplied voice server ro the node.
     * @param data The voice server data.
     */
    abstract submitVoiceServer(data: VoiceServer): Promise<boolean>;

    /**
     * Handles an incoming player event.
     * @param event The player event to handle.
     */
    onEvent(event: Server.Data<PlayerEvents>) {
        switch (event.type) {
            case PlayerEventType.TrackEnd:
                if (event.reason !== "REPLACED") {
                    this.playing = false;
                }

                this.playing = false;
                this.track = null;
                this.emit("trackEnd", event);
                break
            case PlayerEventType.TrackStart:
                this.playing = true;
                this.track = event.track;
                this.emit("trackStart", event);
                break
            case PlayerEventType.TrackException:
                break
            case PlayerEventType.TrackStuck:
                this.emit("trackStuck", event);
                break
            case PlayerEventType.WebsocketClosed:
                this.connected = false;
                break
            case PlayerEventType.WebsocketOpen:
                this.connected = true
                break
        }
    }

    async handleVoiceUpdate(update: DiscordVoiceState | DiscordVoiceServer) {
        /* update our local voice server data. */
        if ("token" in update) {
            this.#_server.token = update.token;
            this.#_server.endpoint = update.endpoint;
        } else {
            if (update.user_id !== this.node.userId) {
                return;
            }

            const channel = update.channel_id;
            if(!channel && this.channel) {
                this.emit("channelLeave", this.channel);
                this.channel = null;
                this.#_server = {};
            } else if (channel && !this.channel) {
                this.channel = update.channel_id;
                this.emit("channelJoin", this.channel!);
            } else if (channel !== this.channel) {
                this.emit("channelMove", this.channel!, update.channel_id!);
                this.channel = update.channel_id;
            }

            this.#_server.sessionId = update.session_id;
        }

        /* check if we have everything. */
        if (!this.#_server.sessionId || !this.#_server.token || !this.#_server.endpoint) {
            return
        }

        /* submit the voice server to the node. */
        this.debug("voice:", "submitting voice server data");
        await this.submitVoiceServer(this.#_server as VoiceServer);
    }

    /**
     * Handles an incoming payload for this player.
     * @param payload The payload to handle.
     */
    handlePayload(payload: PlayerEvents | PlayerUpdate) {
        switch (payload.op) {
            case OpCode.PlayerUpdate:
                this.position = payload.d.current_track.position;
                this.track = payload.d.current_track.track;
                this.filters = payload.d.filters;
                this.frames = payload.d.frames;
                break;
            case OpCode.PlayerEvent:
                this.onEvent(payload.d);
                break
        }
    }

    private debug(...msg: string[]) {
        return this.emit("debug", msg.join(" "))
    }
}

export interface ConnectOptions {
    deaf?: boolean;
    mute?: boolean;
}

export interface PlayOptions {
    endTime?: number;
    startTime?: number;
    noReplace?: boolean;
}

export interface VoiceServer {
    token: string;
    endpoint: string;
    sessionId: string;
}
