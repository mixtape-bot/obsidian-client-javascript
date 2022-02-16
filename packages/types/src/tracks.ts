import type { Exception } from "./payloads";

export interface Track {
    track: string;
    info: TrackInfo;
}

export interface TrackInfo {
    title: string;
    author: string;
    uri: string;
    identifier: string;
    length: bigint;
    position: bigint;
    is_stream: boolean;
    is_seekable: boolean;
    source_name: string;
}

export declare enum LoadType {
    Track = "TRACK",
    TrackCollection = "TRACK_COLLECTION",
    None = "NONE",
    Failed = "FAILED"
}

export interface LoadTracksResponse {
    load_type: LoadType;
    collection_info: CollectionInfo | null;
    tracks: Track[];
    exception: Exception | null;
}

export interface CollectionInfo {
    name: string;
    url: string | null;
    selected_track: number;
    type: TrackCollectionType;
}

// export type LoadedCollectionType = PlaylistLoadedCollectionType | AlbumLoadedCollectionType | SearchResultLoadedCollectionType;

/* base things */
export type TrackCollectionType = "Playlist" | "Album" | "SearchResult" | "Unknown" | string;

// export interface BaseLoadedCollectionType {
//     name: TrackCollectionType;
//     d: any;
// }

// /* playlist */
// export interface PlaylistLoadedCollectionType extends BaseLoadedCollectionType {
//     name: "Playlist";
//     d: never;
// }

// /* album */
// export interface AlbumLoadedCollectionType extends BaseLoadedCollectionType {
//     name: "Album";
//     d: AlbumLoadedCollectionTypeData;
// }

// export interface AlbumLoadedCollectionTypeData {
//     artist: string;
// }

// /* search result */
// export interface SearchResultLoadedCollectionType extends BaseLoadedCollectionType {
//     name: "SearchResult";
//     d: SearchResultLoadedCollectionTypeData;
// }

// export interface SearchResultLoadedCollectionTypeData {
//     query: string;
// }
