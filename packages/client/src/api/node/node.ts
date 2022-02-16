import type WebSocket from "ws";
import { TypedEmitter } from "tiny-typed-emitter";
import { NodeStatus } from "./nodeStatus";
import { REST } from "./rest";
import { WebSocketPlayer } from "../player/ws";
import { RestPlayer } from "../player/api";
import type { Player } from "../player/base";
import type { Data, DiscordSnowflake, IncomingPayloads, OutgoingPayloads, Stats } from "@mixtape-bot/obsidian-api";
import { Connection, ConnectionInfo } from "./connection";
import { generateClientName } from "../../util/util";

export class Node extends TypedEmitter<{
    disconnected: (event: WebSocket.CloseEvent, reconnect?: number) => void;
    debug: (message: string) => void;
    ready: () => void;
    error: (error: any) => void;
    raw: (payload: IncomingPayloads) => void;
}> {

    readonly players: Map<DiscordSnowflake, Player>;
    readonly rest: REST;
    readonly sendGatewayPayload: Send

    userId?: DiscordSnowflake;
    stats: Data<Stats> | null;
    clientName: string;
    status: NodeStatus;

    readonly #_connection: Connection

    constructor(options: NodeOptions & ConnectionInfo) {
        super()

        this.#_connection = new Connection(this, options);

        this.userId = options.userId;
        this.players = new Map();
        this.rest = new REST(this);
        this.sendGatewayPayload = options.send;

        this.stats = null;
        this.clientName = options.clientName ?? generateClientName();
        this.status = NodeStatus.Idle;
    }

    /**
     * Current connection to the node.
     */
    get connection() {
        return this.#_connection
    }

    /**
     * Sends a payload to the node.
     * @param payload Payload to send
     * @param important Whether this payload is important
     */
    send(payload: OutgoingPayloads, important?: boolean): Promise<boolean> {
        return this.#_connection.send(payload, important);
    }

    /**
     * Creates a new player of the supplied type and guild.
     * @param guild The player's guild.
     * @param type The type of player. REST: player is controlled through rest, WebSocket: player is controlled through websocket.
     */
    createPlayer(guild: DiscordSnowflake, type: "rest" | "websocket" = "websocket"): Player {
        let player = this.players.get(guild);
        if (!player) {
            player ??= type === "websocket" ? new WebSocketPlayer(this, guild) : new RestPlayer(this, guild);
            this.players.set(guild, player);
        }

        return player;
    }

    /**
     * Connects to the node.
     */
    connect(userId: DiscordSnowflake | undefined = this.userId) {
        if (!userId) {
            throw new Error("No user id was provided.")
        }

        this.userId = userId;
        return this.#_connection.connect();
    }

    /**
     * Disconnects from the node.
     * @param code Disconnect code
     * @param reason Disconnect reason
     */
    disconnect(code?: number, reason?: string) {
        return this.#_connection.disconnect(code, reason);
    }

    /**
     * Handles a voice server or state updates received from the Discord gateway.
     * @param data The discord voice server or state data.
     */
    async handleVoiceUpdate(data: DiscordVoiceServer | DiscordVoiceState) {
        const player = this.players.get(data.guild_id),
            type = "token" in data ? "server" : "state";
    
        if (player) {
            this.emit("debug", `voice: handling voice ${type} update for "${data.guild_id}"`);
            await player.handleVoiceUpdate(data);
        } else {
            this.emit("debug", `voice: received voice ${type} update for unknown player.`);
        }
    }

}

export type Send = (id: DiscordSnowflake, payload: any) => void;

export interface DiscordVoiceServer {
    token: string;
    endpoint: string;
    guild_id: DiscordSnowflake;
}

export interface DiscordVoiceState {
    session_id: string;
    channel_id: DiscordSnowflake;
    guild_id: DiscordSnowflake;
    user_id: DiscordSnowflake;
}

export interface NodeOptions {
    clientName?: string;
    dispatchBufferTimeout?: number;
    resuming?: ResumingOptions;
    reconnect?: ReconnectOptions;
    userId?: DiscordSnowflake;
    send: Send;
}

export interface ReconnectOptions {
    tries?: number;
    delay?: number | ((currentTry: number) => number);
    auto: boolean;
}

export interface ResumingOptions {
    enabled: boolean;
    timeout?: number;
    key?: string;
}
