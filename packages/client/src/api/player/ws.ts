import { Player, PlayOptions, VoiceServer } from "./base";
import { Filter, FilterMap, OpCode } from "@mixtape-bot/obsidian-api";

export type PartialFilterMap = Partial<FilterMap>

export class WebSocketPlayer extends Player {

    play(track: string | { track: string }, options: PlayOptions = {}): Promise<boolean> {
        return this.node.send({
            op: OpCode.PlayTrack,
            d: {
                track: typeof track === "string" ? track : track.track,
                guild_id: this.guild,
                end_time: options.endTime,
                no_replace: options.noReplace,
                start_time: options.startTime
            }
        });
    }

    stop(): Promise<boolean> {
        return this.node.send({
            op: OpCode.StopTrack,
            d: { guild_id: this.guild }
        });
    }

    pause(state = true): Promise<boolean> {
        this.paused = state;
        return this.node.send({
            op: OpCode.Pause,
            d: {
                guild_id: this.guild,
                state
            }
        });
    }

    destroy(): Promise<boolean> {
        return this.node.send({
            op: OpCode.Destroy,
            d: { guild_id: this.guild }
        });
    }

    seek(position: number): Promise<boolean> {
        return this.node.send({
            op: OpCode.Seek,
            d: {
                guild_id: this.guild, position
            }
        });
    }

    setFilters(filters: FilterMap): Promise<boolean>;
    setFilters<F extends Filter>(filter: F, data: FilterMap[F]): Promise<boolean>;
    setFilters(filters: Filter | PartialFilterMap, data?: FilterMap[Filter]): Promise<boolean> {
        const _filters = typeof filters === "object"
            ? filters
            : { ...this.filters, [filters]: data }

        return this.node.send({
            op: OpCode.Filters,
            d: {
                guild_id: this.guild,
                filters: _filters
            }
        });
    }

    submitVoiceServer(data: VoiceServer): Promise<boolean> {
        return this.node.send({
            op: OpCode.SubmitVoiceServer,
            d: {
                guild_id: this.guild,
                session_id: data.sessionId,
                endpoint: data.endpoint,
                token: data.token
            }
        });
    }

}
