import { NextResponse } from "next/server";
import { rateLimit, getRateLimitKey } from "@/server/middleware/rate-limit";

/**
 * Check if the request is authorized.
 * Supports bearer tokens via AUTH_TOKEN env var.
 * If AUTH_TOKEN is not set, the API is open (print a warning).
 */
export function checkAuth(request: Request): { authorized: boolean; response?: NextResponse } {
  const authToken = process.env.AUTH_TOKEN;
  if (!authToken) {
    // No auth configured — API open. Print warning once per process.
    if (!(globalThis as Record<string, unknown>).__authWarned) {
      console.warn("[auth] AUTH_TOKEN not set — API routes are public.");
      (globalThis as Record<string, unknown>).__authWarned = true;
    }
    return { authorized: true };
  }

  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Missing authorization header" }, { status: 401 }),
    };
  }

  const token = header.slice(7);
  if (token !== authToken) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Invalid authorization token" }, { status: 401 }),
    };
  }

  return { authorized: true };
}

/**
 * Apply rate limiting and auth check for an API route.
 * Returns a NextResponse error when the request should be blocked.
 */
export function applyApiGuard(
  request: Request,
  rateLimitConfig: { limit: number; windowMs: number },
): NextResponse | null {
  // Auth check
  const auth = checkAuth(request);
  if (!auth.authorized && auth.response) return auth.response;

  // Rate limit
  const key = getRateLimitKey(request);
  const rl = rateLimit(key, rateLimitConfig.limit, rateLimitConfig.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 },
    );
  }

  // No error — allow
  return null;
}

/**
 * Generic error message for unhandled exceptions.
 * Never exposes real error details to the client.
 */
export function serverError(): NextResponse {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * Generic bad-request error (use for input validation failures).
 */
export function badRequest(message = "Invalid request"): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Rate limit presets.
 */
export const RateLimits = {
  /** 20 requests per minute — for chat */
  chat: { limit: 20, windowMs: 60_000 },
  /** 5 requests per minute — for key submission */
  keySession: { limit: 5, windowMs: 60_000 },
  /** 3 requests per minute — for key validation */
  keyValidate: { limit: 3, windowMs: 60_000 },
  /** 10 requests per minute — generic read endpoints */
  default: { limit: 10, windowMs: 60_000 },
  /** 60 requests per minute — for dataset read */
  datasets: { limit: 30, windowMs: 60_000 },
};