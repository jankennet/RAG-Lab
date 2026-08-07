import { NextResponse } from "next/server";
import { rateLimit, getRateLimitKey } from "@/server/middleware/rate-limit";

/**
 * Apply rate limiting for an API route.
 * Returns a NextResponse error when the request should be blocked.
 */
export function applyApiGuard(
  request: Request,
  rateLimitConfig: { limit: number; windowMs: number },
): NextResponse | null {
  const key = getRateLimitKey(request);
  const rl = rateLimit(key, rateLimitConfig.limit, rateLimitConfig.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 },
    );
  }

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
  /** 10 requests per minute — for key deletion (cheap, no external calls) */
  keyClear: { limit: 10, windowMs: 60_000 },
};