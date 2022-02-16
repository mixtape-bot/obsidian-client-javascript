import { Pool } from "undici";

import type { Node } from "./node";
import type { LoadTracksResponse, TrackInfo } from "@mixtape-bot/obsidian-api/dist/tracks";
import type { DispatchOptions } from "undici/types/dispatcher";

export class REST {
    readonly node: Node;
    readonly pool: Pool;

    requests: number;

    constructor(node: Node) {
        this.node = node;
        this.pool = new Pool(`http${this.node.connection.secure ? "s" : ""}://${node.connection.address}`)
        this.requests = 0;
    }

    /**
     * Loads tracks using the supplied identifier.
     * @param {string} identifier
     * @returns {Promise<LoadTracksResponse>}
     */
    loadTracks(identifier: string): Promise<LoadTracksResponse> {
        return this
            .do(`/loadtracks?identifier=${identifier}`)
            .then(res => res.json());
    }

    /**
     * Decodes a track string.
     * @param {string} track base64 encoded track.
     * @returns {Promise<TrackInfo>}
     */
    decodeTracks(track: string): Promise<TrackInfo>;

    /**
     * Decodes multiple track strings.
     * @param {string} tracks array of base64 encoded tracks.
     * @returns {Promise<TrackInfo[]>}
     */
    decodeTracks(...tracks: string[]): Promise<TrackInfo[]>;

    async decodeTracks(...args: string[]): Promise<TrackInfo | TrackInfo[]> {
        if (args.length > 1) {
            return this.do("/decodetracks", {
                body: JSON.stringify({ tracks: args }),
                method: "POST",
            }).then(res => res.json());
        }

        return this
            .do(`/decodetrack?track=${args[0]}`)
            .then(res => res.json());
    }

    /**
     * Makes a request to
     * @param {string} endpoint the request endpoint.
     * @param {Partial<Omit<Dispatcher.DispatchOptions, "path">>} options
     * @returns {Promise<Response>}
     */
    async do(endpoint: string, options: Partial<Omit<DispatchOptions, "path">> = {}): Promise<Response> {
        endpoint = /^\//.test(endpoint) ? endpoint : `/${endpoint}`;

        const headers: Record<string, any> = {
            "Client-Name": this.node.clientName,
            "User-Id": this.node.userId,
            ...(options?.headers ?? {}),
        };

        if (this.node.connection.info.password) {
            headers.Authorization = this.node.connection.info.password;
        }

        return new Promise((resolve, reject) => {
            const response: Response = {
                body: Buffer.alloc(0),
                status: 200,
                headers: {},
                json() {
                    return JSON.parse(this.text())
                },
                text() {
                    return this.body.toString("utf8")
                }
            }

            this.pool.request({
                method: "GET",
                path: encodeURI(endpoint),
                ...(options ?? {}),
                headers,
            }, (err, resp) => {
                this.requests++;
                if (err) {
                    return reject(err);
                }

                response.status = resp.statusCode;
                response.headers = resp.headers;

                resp.body.on("data", buffer => response.body = Buffer.concat([ response.body, buffer ]));
                resp.body.on("end", () => resolve(response))
            });
        })
    }
}

interface Response {
    status: number;
    headers: any;
    body: Buffer;
    json(): any;
    text(): string;
}
