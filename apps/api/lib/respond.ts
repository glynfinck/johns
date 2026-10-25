import { corsHeaders } from "./cors";
import { env } from "./env";

// Every /api/* response goes through these, so CORS and the error shape are
// the same everywhere.

function cors(request: Request): Record<string, string> {
  return corsHeaders(request.headers.get("origin"), env.allowedOrigins());
}

/** A JSON response, with CORS headers for an allowed web origin. */
export function json(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: cors(request) });
}

/** `{ "error": "..." }`: a sentence fit to show. Never a stack trace, a key or a query. */
export function error(request: Request, status: number, message: string): Response {
  return json(request, { error: message }, status);
}

/** Answers a browser's CORS preflight. Export it as OPTIONS from every route. */
export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: cors(request) });
}
