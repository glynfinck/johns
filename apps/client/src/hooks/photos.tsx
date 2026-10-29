import { createContext, useContext } from 'react';

/**
 * Each housemate's sign-in photo by user id, from the house's one read
 * (the house layout provides it). Outside a house there are none, and
 * every avatar shows initials.
 */
export const PhotosContext = createContext<ReadonlyMap<string, string>>(new Map());

/** A housemate's photo address, or null: no photo, or someone who has left. */
export function usePhoto(userId: string | null | undefined): string | null {
  const photos = useContext(PhotosContext);
  return (userId && photos.get(userId)) || null;
}
