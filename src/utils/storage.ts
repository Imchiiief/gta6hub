// =============================================================================
// Leonida Hub — localStorage State Synchronization Wrapper
// src/utils/storage.ts
//
// Single source of truth for reading, mutating, and persisting the visitor's
// collectible tracking progress in the browser. No backend, no auth — every
// byte of state lives in localStorage under the key 'gta6_tracker_progress'.
//
// Safe to import into any Astro component or island. Every exported function
// guards against `window` being undefined so this module never throws during
// Astro's server-side render pass.
// =============================================================================

// -----------------------------------------------------------------------------
// Types — data shapes
// -----------------------------------------------------------------------------

/**
 * A single collectible record as defined in src/data/collectibles.json.
 * Mirrors the "items" array entries exactly: a composite ID, a category tag
 * matching the categories index, a flat human-readable location string, an
 * explicit 3D coordinate object, and a nullable video URL.
 */
export interface CollectibleItem {
  readonly id: string;
  readonly category: string;
  readonly location: string;
  readonly coordinates: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly video_url: string | null;
}

/**
 * The visitor's saved progress — which collectible IDs have been marked
 * as found. Stored as a plain string array (not a Set) because JSON has
 * no native Set type and we want a direct, lossless round-trip through
 * localStorage with no serialization adapter.
 */
export interface UserProgress {
  /** IDs of every collectible the visitor has marked as collected. */
  readonly completedIds: string[];
  /** ISO 8601 timestamp of the most recent mutation. */
  readonly lastUpdatedAt: string;
}

/**
 * Visitor-configurable display preferences. Persisted alongside progress
 * so a single localStorage read/write hydrates the entire UI.
 */
export interface Preferences {
  /** Hide collectible cards that are already marked as completed. */
  readonly hideCompleted: boolean;
  /** Active category filter, or null to show every category. */
  readonly categoryFilter: string | null;
}

/**
 * The full persisted application state — the exact shape written to and
 * read from localStorage as a single JSON blob. Treated as immutable:
 * every mutation in this module produces a brand-new AppState object
 * rather than modifying an existing one in place.
 */
export interface AppState {
  readonly schemaVersion: string;
  readonly progress: UserProgress;
  readonly preferences: Preferences;
}

/**
 * Computed, non-persisted completion statistics derived from AppState at
 * render time. Never written to localStorage — always recalculated fresh
 * from the current item catalogue and completed ID list.
 */
export interface CompletionStats {
  readonly total: number;
  readonly completed: number;
  /** Completion percentage as a string fixed to exactly one decimal place, e.g. "33.3". */
  readonly percent: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** The single localStorage key under which AppState is persisted. */
const STORAGE_KEY = "gta6_tracker_progress" as const;

/** Current AppState schema version. Bump on breaking shape changes. */
const SCHEMA_VERSION = "1.0.0" as const;

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

/**
 * Returns true only when running in a browser context with a usable
 * localStorage implementation. Some browsers throw on `localStorage`
 * access in private/incognito modes with storage disabled, so this
 * also wraps the property access itself in a try/catch.
 */
function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Builds a brand-new, frozen default AppState with empty progress and
 * default preferences. Used on first visit and as the fallback whenever
 * stored data is missing, corrupt, or fails shape validation.
 *
 * `Object.freeze` is applied at every nesting level so the fallback state
 * is genuinely immutable, not just immutable-by-convention.
 */
function buildDefaultState(): AppState {
  const emptyIds: string[] = [];
  const progress: UserProgress = Object.freeze({
    completedIds: Object.freeze(emptyIds) as string[],
    lastUpdatedAt: new Date().toISOString(),
  });

  const preferences: Preferences = Object.freeze({
    hideCompleted: false,
    categoryFilter: null,
  });

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    progress,
    preferences,
  });
}

/**
 * Structurally validates an unknown parsed value against the AppState
 * shape before trusting it. Returns true only if every required field
 * is present with the correct primitive type.
 *
 * This is a manual type guard rather than a schema library dependency,
 * keeping the module self-contained with zero runtime dependencies.
 */
function isValidAppState(value: unknown): value is AppState {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  if (typeof candidate["schemaVersion"] !== "string") return false;

  const progress = candidate["progress"];
  if (typeof progress !== "object" || progress === null) return false;
  const progressRecord = progress as Record<string, unknown>;

  if (!Array.isArray(progressRecord["completedIds"])) return false;
  if (
    !progressRecord["completedIds"].every(
      (entry): entry is string => typeof entry === "string"
    )
  ) {
    return false;
  }
  if (typeof progressRecord["lastUpdatedAt"] !== "string") return false;

  const preferences = candidate["preferences"];
  if (typeof preferences !== "object" || preferences === null) return false;
  const preferencesRecord = preferences as Record<string, unknown>;

  if (typeof preferencesRecord["hideCompleted"] !== "boolean") return false;
  if (
    preferencesRecord["categoryFilter"] !== null &&
    typeof preferencesRecord["categoryFilter"] !== "string"
  ) {
    return false;
  }

  return true;
}

/**
 * Writes an AppState object to localStorage synchronously as JSON.
 * This is the module's single "cache flush" path — every mutator below
 * routes through this function so there is exactly one place where the
 * browser's persistent store is touched.
 *
 * Wrapped in try/catch to gracefully handle quota-exceeded errors or
 * browsers that revoke storage access mid-session.
 *
 * @param state - The full AppState to persist.
 * @returns true if the write succeeded, false otherwise.
 */
function flushToCache(state: AppState): boolean {
  if (!isStorageAvailable()) return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("[storage] Failed to flush AppState to localStorage:", error);
    return false;
  }
}

/**
 * Deep-freezes a validated AppState (and its nested progress/preferences/
 * completedIds objects) so every code path returning state from this
 * module carries the same immutability guarantee — not just the
 * freshly-constructed default state, but state freshly parsed from
 * localStorage too.
 *
 * `Object.freeze` is shallow by nature, so each nesting level must be
 * frozen explicitly; this function makes that contract impossible to
 * accidentally skip on a future code path.
 *
 * @param state - An AppState already confirmed valid by isValidAppState.
 * @returns The same object graph with every level frozen.
 */
function deepFreezeAppState(state: AppState): AppState {
  Object.freeze(state.progress.completedIds);
  Object.freeze(state.progress);
  Object.freeze(state.preferences);
  return Object.freeze(state);
}

// -----------------------------------------------------------------------------
// Public API — state initialisation
// -----------------------------------------------------------------------------

/**
 * Reads and parses AppState from localStorage.
 *
 * Safe to call during Astro's server-side render pass: if `window` is
 * undefined (SSR context), immediately returns a frozen default state
 * without touching any browser API, bypassing any server-side crash.
 *
 * On the client, if no stored value exists, if the stored value is not
 * valid JSON, or if the parsed JSON does not match the expected AppState
 * shape, falls back to a freshly constructed, immutable default state.
 *
 * @returns The current AppState, or a frozen default fallback if unavailable.
 */
export function getInitialState(): AppState {
  if (!isStorageAvailable()) {
    return buildDefaultState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (raw === null) {
    return buildDefaultState();
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isValidAppState(parsed)) {
      console.warn(
        "[storage] Stored AppState failed shape validation. Falling back to default state."
      );
      return buildDefaultState();
    }

    return deepFreezeAppState(parsed);
  } catch (error) {
    console.error(
      "[storage] Failed to parse stored AppState JSON. Falling back to default state:",
      error
    );
    return buildDefaultState();
  }
}

// -----------------------------------------------------------------------------
// Public API — mutation
// -----------------------------------------------------------------------------

/**
 * Toggles a single collectible's completed status.
 *
 * If `itemId` is currently present in `completedIds` (an active completion
 * marker), it is spliced out — un-marking it as collected. If absent, it
 * is pushed onto a new array — marking it as collected. The operation is
 * fully immutable: a new AppState, new UserProgress, and new completedIds
 * array are constructed on every call; nothing on the previous state is
 * mutated in place.
 *
 * The resulting state is flushed synchronously to localStorage before
 * this function returns, so the caller can trust that the persisted
 * value and the returned value are identical at the moment of return.
 *
 * @param itemId - The collectible ID to toggle (e.g. "hp-042").
 * @returns The newly computed, frozen AppState after the toggle and flush.
 */
export function toggleCollectible(itemId: string): AppState {
  const currentState = getInitialState();
  const isActiveMarker = currentState.progress.completedIds.includes(itemId);

  const nextCompletedIds: string[] = isActiveMarker
    ? currentState.progress.completedIds.filter((id) => id !== itemId)
    : [...currentState.progress.completedIds, itemId];

  const nextProgress: UserProgress = Object.freeze({
    completedIds: Object.freeze(nextCompletedIds) as string[],
    lastUpdatedAt: new Date().toISOString(),
  });

  const nextState: AppState = Object.freeze({
    schemaVersion: currentState.schemaVersion,
    progress: nextProgress,
    preferences: currentState.preferences,
  });

  flushToCache(nextState);

  return nextState;
}

/**
 * Updates one or more preference fields and flushes the result to cache.
 * Performs a shallow merge against the current preferences object.
 *
 * @param partial - Any subset of Preferences fields to update.
 * @returns The newly computed, frozen AppState after the update and flush.
 */
export function updatePreferences(partial: Partial<Preferences>): AppState {
  const currentState = getInitialState();

  const nextPreferences: Preferences = Object.freeze({
    ...currentState.preferences,
    ...partial,
  });

  const nextState: AppState = Object.freeze({
    schemaVersion: currentState.schemaVersion,
    progress: currentState.progress,
    preferences: nextPreferences,
  });

  flushToCache(nextState);

  return nextState;
}

/**
 * Wipes all tracked progress (completed IDs) back to an empty array while
 * preserving the visitor's existing preferences. Flushes immediately.
 *
 * @returns The newly computed, frozen AppState after the reset and flush.
 */
export function resetProgress(): AppState {
  const currentState = getInitialState();

  const emptyIds: string[] = [];
  const nextProgress: UserProgress = Object.freeze({
    completedIds: Object.freeze(emptyIds) as string[],
    lastUpdatedAt: new Date().toISOString(),
  });

  const nextState: AppState = Object.freeze({
    schemaVersion: currentState.schemaVersion,
    progress: nextProgress,
    preferences: currentState.preferences,
  });

  flushToCache(nextState);

  return nextState;
}

// -----------------------------------------------------------------------------
// Public API — statistics
// -----------------------------------------------------------------------------

/**
 * Computes completion statistics by cross-referencing the full collectible
 * catalogue against the visitor's list of completed IDs.
 *
 * Pure function: takes its inputs explicitly, touches no global state, and
 * performs no I/O. Runs a single O(n) pass — builds a Set from
 * `completedIds` for O(1) membership checks, then maps over `items` once
 * to count matches, avoiding the O(n*m) cost of calling `.includes()`
 * inside a loop over `items` for large catalogues (500+ collectibles).
 *
 * The returned `percent` is a string fixed to exactly one decimal place
 * (e.g. "33.3", "100.0", "0.0") using `Number.prototype.toFixed(1)`, so
 * it is display-ready with no further formatting required by the caller.
 * Returns "0.0" when `items` is empty, never "NaN".
 *
 * @param items        - The full collectible catalogue (collectibles.json items array).
 * @param completedIds - The visitor's array of completed collectible IDs.
 * @returns An object with total count, completed count, and a percent
 *          string fixed to one decimal place.
 */
export function computeStats(
  items: CollectibleItem[],
  completedIds: string[]
): CompletionStats {
  const completedSet = new Set(completedIds);

  const total = items.length;
  const completed = items.reduce(
    (count, item) => (completedSet.has(item.id) ? count + 1 : count),
    0
  );

  const percent: string =
    total === 0 ? (0).toFixed(1) : ((completed / total) * 100).toFixed(1);

  return {
    total,
    completed,
    percent,
  };
}
