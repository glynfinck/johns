import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the service worker and the manifest:
     * the session only needs refreshing on paths that can read it. Nothing
     * under /api/ reads a cookie session: the cron tick brings its own
     * secret, and the app's routes a bearer token (lib/auth.ts).
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
