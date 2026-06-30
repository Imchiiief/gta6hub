// =============================================================================
// Leonida Hub — Collectibles Tracking System
// Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

/**
 * World-space 3D coordinate using GTA VI's Leonida coordinate system.
 * X: West (-) to East (+)
 * Y: South (-) to North (+)
 * Z: Below sea level (-) to Above sea level (+)
 */
export interface Coordinate3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Bounding box defined by two diagonal corners in world space.
 * Used to define region boundaries on the Leonida map.
 */
export interface BoundingBox {
  readonly southWest: Coordinate3D;
  readonly northEast: Coordinate3D;
}

// -----------------------------------------------------------------------------
// Region
// -----------------------------------------------------------------------------

/**
 * Top-level geographic zone within the state of Leonida.
 */
export type RegionId =
  | "vice_city"
  | "leonida_keys"
  | "port_gellhorn"
  | "everglades"
  | "grassrivers"
  | "hove_beach_leonida"
  | "ocean_drive"
  | "little_havana"
  | "vice_city_beach"
  | "downtown_vice"
  | "harbor_district";

/**
 * A named sub-area within a region (neighbourhood, landmark, district).
 */
export interface SubArea {
  readonly id: string;
  readonly label: string;
  readonly regionId: RegionId;
}

/**
 * Full geographic descriptor for a collectible's location.
 */
export interface LocationDescriptor {
  readonly regionId: RegionId;
  readonly regionLabel: string;
  readonly subArea: SubArea;
  readonly bounds: BoundingBox;
  /** Human-readable directions from the nearest landmark. */
  readonly approachNote: string;
}

// -----------------------------------------------------------------------------
// Video Metadata
// -----------------------------------------------------------------------------

export type VideoProvider = "youtube" | "rumble" | "tiktok" | "twitter";

/**
 * Rich metadata for a guide video linked to a collectible.
 * All timestamps are in seconds from the start of the video.
 */
export interface VideoMetadata {
  readonly provider: VideoProvider;
  /** Full canonical URL to the video. */
  readonly url: string;
  /** Provider-native video ID (e.g. YouTube watch?v= value). */
  readonly videoId: string;
  /** Embed-safe iframe src URL. */
  readonly embedUrl: string;
  /** Direct thumbnail URL at highest available resolution. */
  readonly thumbnailUrl: string;
  readonly title: string;
  readonly channelName: string;
  /** ISO 8601 publish date string, e.g. "2026-11-22". */
  readonly publishedAt: string;
  /** Total video duration in seconds. */
  readonly durationSeconds: number;
  /** Second within the video where this collectible's guide begins. */
  readonly timestampSeconds: number;
  /** Human-readable timestamp label, e.g. "4:32". */
  readonly timestampLabel: string;
}

// -----------------------------------------------------------------------------
// Collectible Types
// -----------------------------------------------------------------------------

/**
 * All supported collectible categories in GTA VI.
 * Extend this union as Rockstar confirms additional types post-launch.
 */
export type CollectibleType =
  | "hidden_package"
  | "stunt_jump"
  | "unique_stunt_jump"
  | "letter_scrap"
  | "spaceship_part"
  | "nuclear_waste"
  | "signal_jammer"
  | "playing_card"
  | "action_figure";

/**
 * Difficulty rating for reaching or completing the collectible.
 */
export type DifficultyRating = "easy" | "medium" | "hard" | "expert";

/**
 * Whether the collectible requires a specific vehicle, time of day,
 * or story-mode chapter to be accessible.
 */
export interface AccessRequirement {
  readonly type: "vehicle" | "time_of_day" | "story_chapter" | "weather";
  readonly label: string;
  readonly description: string;
}

// -----------------------------------------------------------------------------
// Reward
// -----------------------------------------------------------------------------

/**
 * The in-game reward issued upon collecting this item.
 * cashAmount is in GTA$ (in-game currency).
 */
export interface CollectibleReward {
  readonly cashAmount: number;
  readonly rpAmount: number;
  /** Any non-cash reward (vehicle unlock, weapon skin, etc.). */
  readonly bonusItem: string | null;
  /** Reward description shown to the player on-screen. */
  readonly displayLabel: string;
}

// -----------------------------------------------------------------------------
// Stunt Jump specific
// -----------------------------------------------------------------------------

/**
 * Additional data exclusive to stunt jump collectibles.
 */
export interface StuntJumpData {
  /** The vehicle class recommended for a successful jump. */
  readonly recommendedVehicleClass:
    | "any"
    | "motorcycle"
    | "sports"
    | "muscle"
    | "super"
    | "boat"
    | "plane";
  /** Minimum approach speed in km/h for the jump to register. */
  readonly minApproachSpeedKmh: number;
  /** Approximate distance of the jump in metres. */
  readonly jumpDistanceMetres: number;
  /** Landing zone coordinate. */
  readonly landingZone: Coordinate3D;
  /** Whether this jump counts toward 100% story completion. */
  readonly countsTowardCompletion: boolean;
}

// -----------------------------------------------------------------------------
// Core Collectible Record
// -----------------------------------------------------------------------------

/**
 * The canonical master record for a single collectible item.
 * This is the shape stored in collectibles.json and consumed by all
 * tracking components, map overlays, and progress utilities.
 */
export interface CollectibleRecord {
  /** Stable, URL-safe unique identifier. Format: `{type}_{zero_padded_index}` */
  readonly id: string;
  readonly type: CollectibleType;
  /** Display number shown to the player (1-based, per collectible type). */
  readonly index: number;
  readonly title: string;
  readonly description: string;
  readonly difficulty: DifficultyRating;
  readonly coordinates: Coordinate3D;
  readonly location: LocationDescriptor;
  readonly reward: CollectibleReward;
  readonly accessRequirements: AccessRequirement[];
  /** Null if no guide video has been catalogued yet. */
  readonly video: VideoMetadata | null;
  /**
   * Stunt-jump specific data. Present only when type === "stunt_jump"
   * or type === "unique_stunt_jump". Null for all other types.
   */
  readonly stuntJump: StuntJumpData | null;
  /** ISO 8601 date this record was added to the master data file. */
  readonly addedAt: string;
  /** ISO 8601 date this record was last verified in-game. */
  readonly verifiedAt: string;
  /** Username of the contributor who submitted this record. */
  readonly contributor: string;
}

// -----------------------------------------------------------------------------
// Master Data File Shape
// -----------------------------------------------------------------------------

/**
 * Root shape of src/data/collectibles.json.
 * Consumed at build time by Astro content pipelines.
 */
export interface CollectiblesMasterData {
  readonly schemaVersion: string;
  readonly gameVersion: string;
  /** ISO 8601 timestamp of the last data file update. */
  readonly lastUpdated: string;
  readonly totalByType: Record<CollectibleType, number>;
  readonly collectibles: CollectibleRecord[];
}

// -----------------------------------------------------------------------------
// Client-Side Tracking State (localStorage)
// -----------------------------------------------------------------------------

/**
 * The shape written to localStorage under the key `leonida_hub_progress`.
 * Keyed by collectible ID for O(1) lookup.
 */
export interface TrackingState {
  /** ISO 8601 timestamp of when tracking was first initialised. */
  readonly initialisedAt: string;
  /** ISO 8601 timestamp of the most recent state mutation. */
  lastUpdatedAt: string;
  /**
   * Map of collectible ID → collected flag.
   * Only IDs with a `true` value are written; uncollected items are absent.
   */
  collected: Record<string, true>;
}

/**
 * Derived progress summary computed from TrackingState at runtime.
 * Never persisted — always derived on read.
 */
export interface ProgressSummary {
  readonly totalCollectibles: number;
  readonly totalCollected: number;
  readonly percentComplete: number;
  readonly byType: Record<
    CollectibleType,
    {
      readonly total: number;
      readonly collected: number;
      readonly percentComplete: number;
    }
  >;
}
