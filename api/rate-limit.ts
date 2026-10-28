/**
 * Simple in-memory token-bucket rate limiter.
 * Keyed by IP address. No dependencies.
 */

interface Bucket {
	tokens: number;
	lastRefill: number;
}

export class RateLimiter {
	private buckets = new Map<string, Bucket>();
	private maxTokens: number;
	private refillRate: number; // tokens per second
	private cleanupInterval: ReturnType<typeof setInterval>;

	/**
	 * @param maxTokens  Burst capacity per key
	 * @param refillRate Tokens restored per second
	 */
	constructor(maxTokens: number, refillRate: number) {
		this.maxTokens = maxTokens;
		this.refillRate = refillRate;

		// Evict stale buckets every 5 minutes
		this.cleanupInterval = setInterval(() => {
			const cutoff = Date.now() - 5 * 60 * 1000;
			for (const [key, bucket] of this.buckets) {
				if (bucket.lastRefill < cutoff) this.buckets.delete(key);
			}
		}, 5 * 60 * 1000);
	}

	/** Returns true if the request is allowed, false if rate-limited. */
	consume(key: string): boolean {
		const now = Date.now();
		let bucket = this.buckets.get(key);

		if (!bucket) {
			bucket = { tokens: this.maxTokens, lastRefill: now };
			this.buckets.set(key, bucket);
		}

		// Refill tokens based on elapsed time
		const elapsed = (now - bucket.lastRefill) / 1000;
		bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRate);
		bucket.lastRefill = now;

		if (bucket.tokens < 1) {
			return false;
		}

		bucket.tokens -= 1;
		return true;
	}

	close() {
		clearInterval(this.cleanupInterval);
	}
}
