/**
 * Simple sliding window rate limiter
 */
export class RateLimiter {
  private requests = new Map<string, number[]>();
  private windowMs: number;
  private maxRequests: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodically clean up old entries to prevent memory leaks
    setInterval(() => this.cleanup(), Math.min(windowMs * 2, 3600000));
  }

  /**
   * Checks the current rate limit status without recording a request.
   * Use this to peek at remaining quota.
   */
  peek(userId: string): {
    allowed: boolean;
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();
    let userRequests = this.requests.get(userId) || [];

    // Filter out requests outside the current window
    userRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (userRequests.length < this.maxRequests) {
      return {
        allowed: true,
        remaining: this.maxRequests - userRequests.length,
        resetMs: 0
      };
    }

    // Rate limited - calculate time until the oldest request expires
    const oldestRequest = userRequests[0];
    const resetMs = oldestRequest + this.windowMs - now;

    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, resetMs)
    };
  }

  /**
   * Checks if a user is within their rate limit.
   * If allowed, it records the request.
   */
  check(userId: string): {
    allowed: boolean;
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();
    let userRequests = this.requests.get(userId) || [];

    // Filter out requests outside the current window
    userRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (userRequests.length < this.maxRequests) {
      userRequests.push(now);
      this.requests.set(userId, userRequests);
      
      return {
        allowed: true,
        remaining: this.maxRequests - userRequests.length,
        resetMs: 0
      };
    }

    // Rate limited - calculate time until the oldest request expires
    const oldestRequest = userRequests[0];
    const resetMs = oldestRequest + this.windowMs - now;

    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, resetMs)
    };
  }

  /**
   * Remove expired timestamps and empty users from the map
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [userId, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(timestamp => now - timestamp < this.windowMs);
      if (validTimestamps.length === 0) {
        this.requests.delete(userId);
      } else if (validTimestamps.length < timestamps.length) {
        this.requests.set(userId, validTimestamps);
      }
    }
  }
}

// Default instance: 5 requests per 1 minute
export const defaultRateLimiter = new RateLimiter(5, 60 * 1000);
