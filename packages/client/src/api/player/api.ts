import { Player, PlayOptions, VoiceServer } from "./base";
import type { Filter, FilterMap } from "@mixtape-bot/obsidian-api";

export class RestPlayer extends Player {
    get endpoint(): string {
        return `/players/${this.guild}`;
    }

    async destroy(): Promise<boolean> {
        await this.node.rest.do(this.endpoint, { method: "POST" });
        return true;
    }

    async pause(state?: boolean): Promise<boolean> {
        await this.node.rest.do(`${this.endpoint}/pause`, {
            method: "POST",
            body: JSON.stringify({ state }),
        });

        return true;
    }

    async play(track: string | { track: string }, options?: PlayOptions): Promise<boolean> {
        const body = {
            track: typeof track === "string" ? track : track.track,
            end_time: options?.endTime,
            start_time: options?.startTime,
            no_replace: options?.noReplace,
        };

        await this.node.rest.do(`${this.endpoint}/play`, {
            method: "POST",
            body: JSON.stringify(body),
        });

        return true;
    }

    async seek(position: number): Promise<boolean> {
        await this.node.rest.do(`${this.endpoint}/seek`, {
            method: "POST",
            body: JSON.stringify({ position }),
        });

        return true;
    }

    setFilters(filters: FilterMap): Promise<boolean>;
    setFilters<F extends Filter>(filter: F, data: FilterMap[F]): Promise<boolean>;
    async setFilters(filters: FilterMap | Filter, data?: FilterMap[Filter]): Promise<boolean> {
        const body = typeof filters === "object"
            ? filters
            : { ...this.filters, [filters]: data };

        await this.node.rest.do(`${this.endpoint}/filters`, {
            method: "POST",
            body: JSON.stringify(body),
        });

        return true;
    }

    async stop(): Promise<boolean> {
        await this.node.rest.do(`${this.endpoint}/stop`, { method: "POST" });
        return true;
    }

    async submitVoiceServer(data: VoiceServer): Promise<boolean> {
        await this.node.rest.do(`${this.endpoint}/submit-voice-server`, {
            method: "POST",
            body: JSON.stringify({
                endpoint: data.endpoint,
                token: data.token,
                session_id: data.sessionId,
            })
        });

        return true;
    }

}
