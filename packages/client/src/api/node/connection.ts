import WebSocket from "ws";
import { NodeStatus } from "./nodeStatus";
import { IncomingPayloads, ObsidianPayload, OpCode, OutgoingPayloads } from "@mixtape-bot/obsidian-api";
import { generateRandomKey } from "../../util/util";

import type { Node, NodeOptions, ReconnectOptions, ResumingOptions } from "./node";

export class Connection {

    static RESUMING_DEFAULTS: () => Required<ResumingOptions> = () => ({
        enabled: true,
        key: generateRandomKey(8),
        timeout: 60000
    });

    static RECONNECT_DEFAULTS: Required<ReconnectOptions> = {
        auto: true,
        tries: 3,
        delay: 5000
    }

    readonly node: Node
    readonly info: ConnectionInfo;

    currentReconnect: number;
    dispatchBufferTimeout?: number;
    resumingOptions: Required<ResumingOptions>;
    reconnectOptions: Required<ReconnectOptions>;

    #_connectedAt!: number;
    #_ws!: WebSocket;
    #_queue: QueuedPayload[] = [];


    constructor(node: Node, options: NodeOptions & ConnectionInfo) {
        this.node = node;

        this.info = { password: options.password, port: options.port, host: options.host }

        this.dispatchBufferTimeout = options.dispatchBufferTimeout;
        this.resumingOptions = Object.assign(Connection.RESUMING_DEFAULTS(), options.resuming ?? {});
        this.reconnectOptions = Object.assign(Connection.RECONNECT_DEFAULTS, options.reconnect ?? {});
        this.currentReconnect = 0;
    }

    /**
     * Whether this node is secured via SSL
     */
    get secure() {
        return this.info.port === 443
    }

    /**
     * Whether this connection is active.
     */
    get active() {
        return this.#_ws?.readyState === WebSocket.OPEN;
    }

    /**
     * The address of the node.
     */
    get address(): string {
        return `${this.info.host}:${this.info.port}`
    }

    /**
     * Sends a payload to the node.
     * @param data The payload to send
     * @param important Whether this is an important payload.
     */
    send(data: OutgoingPayloads, important = false): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.active
                ? this._send(data, err => err ? reject(err) : resolve(true))
                : this.#_queue[important ? "unshift" : "push"]({ resolve, reject, data });
        });
    }

    /**
     * Connects to the node.
     */
    async connect() {
        if (this.#_ws) {
            this.disconnect();
        }

        const headers: Record<string, string | undefined> = {
            "Client-Name": this.node.clientName,
            "User-Id": this.node.userId
        }

        /* try to assign the password, if specified. */
        if (this.info.password) {
            headers["Authorization"] = this.info.password;
        }

        /* try to assign the resume key if we're reconnecting AND resuming is enabled. */
        if (this.node.status === NodeStatus.Reconnecting && this.resumingOptions.enabled) {
            headers["Resume-Key"] = this.resumingOptions.key;
        }

        this.node.emit("debug", "ws: connecting...");

        /* create the connection. */
        this.#_connectedAt = Date.now();
        this.#_ws = new WebSocket(`ws${this.secure ? "s" : ""}://${this.address}/magma`, { headers });
        if (this.node.status !== NodeStatus.Reconnecting) {
            this.assignEvents();
        }
    }

    /**
     * Disconnects from the node.
     * @param code Disconnect code
     * @param reason Disconnect reason
     */
    disconnect(code = 1000, reason = "Disconnecting...") {
        this.node.emit("debug", `ws: disconnecting... code=${code}, reason=${reason}`)
        this.node.status = NodeStatus.Disconnecting;
        this.#_ws.close(code, reason);
    }

    /**
     * Attempts to reconnect
     * @param event The close event that triggered this reconnect.
     */
    async reconnect(event: WebSocket.CloseEvent): Promise<void> {
        if (this.node.status !== NodeStatus.Reconnecting) {
            return;
        }

        this.node.emit("debug", `reconnect: current try = ${this.currentReconnect}`)

        try {
            await this.connect();
            this.assignEvents();

            this.node.status = NodeStatus.Connected;
            this.node.emit("debug", `reconnect: ${this.currentReconnect}/${this.reconnectOptions.tries}`)

            /* reset the number of reconnects. */
            this.currentReconnect = 0;
        } catch (ex) {
            this.node.emit("error", ex)
            if (this.currentReconnect + 1 >= this.reconnectOptions.tries) {
                this.node.emit("debug", "reconnect: ran out of tries...");
                this.node.emit("disconnected", event, this.currentReconnect);
                return
            }

            this.currentReconnect++;

            /* delay! */
            await new Promise(res => {
                const delay = typeof this.reconnectOptions.delay === "function"
                    ? this.reconnectOptions.delay(this.currentReconnect)
                    : this.reconnectOptions.delay

                setTimeout(res, delay)
            });

            return this.reconnect(event)
        }
    }

    /**
     * Flushes the payload queue.
     */
    flushQueue() {
        if (!this.#_queue.length || this.node.status !== NodeStatus.Connected) {
            return;
        }

        this.node.emit("debug", "ws: flushing queue...")
        for (const entry of this.#_queue) {
            try {
                this._send(entry.data, err => err ? entry.reject(err) : entry.resolve(true))
            } catch (ex) {
                entry.reject(ex);
            }
        }

        this.#_queue = [];
    }

    /**
     * Assigns event listeners to the current websocket instance.
     */
    assignEvents() {
        this.#_ws.onopen = this._onopen.bind(this);
        this.#_ws.onerror = this._onerror.bind(this);
        this.#_ws.onclose = this._onclose.bind(this);
        this.#_ws.onmessage = this._onmessage.bind(this);
    }

    private _onerror(event: WebSocket.ErrorEvent) {
        const error = new Error(event.error ? event.error : event.message)
        this.node.emit("error", error);
    }

    private async _onmessage({ data }: WebSocket.MessageEvent) {
        if (data instanceof ArrayBuffer) {
            data = Buffer.from(data);
        } else if (Array.isArray(data)) {
            data = Buffer.concat(data);
        }

        let payload: IncomingPayloads;
        try {
            payload = JSON.parse(data.toString())
        } catch (ex) {
            return this.node.emit("error", ex);
        }

        this.node.emit("debug", `<<< op '${OpCode[payload.op]}': ${JSON.stringify(payload.d)}`);

        switch (payload.op) {
            case OpCode.Stats:
                this.node.stats = payload.d;
                break
            default:
                const player = this.node.players.get(payload.d.guild_id);
                if (!player) {
                    break;
                }

                player.handlePayload(payload);
        }

        this.node.emit("raw", payload)
    }

    private async _onopen() {
        if (this.node.status === NodeStatus.Reconnecting) {

        }

        this.node.status = NodeStatus.Connected;

        this.flushQueue();
        this.node.emit("debug", `ws: took ${Math.round(Date.now() - this.#_connectedAt)}ms`);

        if (this.resumingOptions.enabled) {
            const d = { key: this.resumingOptions.key, timeout: this.resumingOptions.timeout }
            await this.send({ op: OpCode.SetupResuming, d }, true);
        }

        if (this.dispatchBufferTimeout) {
            const d = { timeout: this.dispatchBufferTimeout }
            await this.send({ op: OpCode.SetupDispatchBuffer, d }, true);
        }

        this.node.emit("ready");
    }

    private _onclose(event: WebSocket.CloseEvent) {
        /* check if we're manually disconnecting, if so don't reconnect. */
        if (this.node.status === NodeStatus.Disconnecting) {
            this.node.status = NodeStatus.Disconnected
            this.node.emit("disconnected", event);
            return;
        }

        /* change the status of this node. */
        this.node.status = NodeStatus.Disconnected;

        /* attempt to reconnect. */
        if (this.reconnectOptions.auto) {
            this.node.status = NodeStatus.Reconnecting;
            return this.reconnect(event);
        } else {
            this.node.emit("disconnected", event);
        }
    }

    private _send(data: ObsidianPayload, callback: (err?: Error) => void) {
        this.node.emit("debug", `>>> op '${OpCode[data.op]}': ${JSON.stringify(data.d)}`)
        this.#_ws.send(JSON.stringify(data), callback);
    }

}

export interface QueuedPayload {
    resolve: (success: boolean) => void;
    reject: (reason: any) => void;
    data: OutgoingPayloads;
}

export interface ConnectionInfo {
    host: string;
    port: number;
    password?: string;
}
