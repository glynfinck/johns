/**
 * React Query's cache keys. Everything a house's screens read sits under
 * `houseKey(id)`, so reading the house again after a move or a Realtime
 * change (an invalidation of that key) refreshes all of it, the Wall too.
 */
export const houseKey = (houseId: string) => ['house', houseId] as const;

/** The Wall's events, under the house. */
export const wallKey = (houseId: string) => [...houseKey(houseId), 'wall'] as const;
