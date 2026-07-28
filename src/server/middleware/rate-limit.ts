// Simple in-memory rate limiter. Resets on server restart.
// For production, replace with @upstash/ratelimit or Redis-based solution.

import { createHash } from "crypto";

const buckets = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

/**
 * Check if a request is rate-limited.
 * @param key Unique identifier (e.g. IP address or token hash)
 * @param limit Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 * @returns Object with `allowed` boolean and `remaining` count
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanup();

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  bucket.count++;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * Get an identifier for rate limiting.
 * In production, prefer CF-Connecting-IP or X-Forwarded-For over raw IP.
 */
export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "127.0.0.1";
  // Hash the IP so we don't store raw IPs in memory
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}