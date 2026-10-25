/** React Query's cache keys: one entry per house holds everything its screens read. */
export const houseKey = (houseId: string) => ['house', houseId] as const;
