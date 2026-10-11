import type { MetadataRoute } from "next";

import { APP_NAME, GROUND, TAGLINE } from "@/lib/config";

/** Installable, which is what lets an iPhone receive reminders at all. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: TAGLINE,
    start_url: "/today",
    display: "standalone",
    background_color: GROUND.light,
    theme_color: GROUND.light,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
