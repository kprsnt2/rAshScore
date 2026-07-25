import { getEnv } from "./env";

interface CacheEntry<T> {
    data: T;
    expiry: number;
}

export class LRUCache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private maxSize: number;
    private ttl: number;

    constructor(maxSize = 100, ttlMs?: number) {
        this.maxSize = maxSize;
        this.ttl = ttlMs || getEnv().CACHE_TTL_MS;
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check expiry
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.data;
    }

    set(key: string, data: T): void {
        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, {
            data,
            expiry: Date.now() + this.ttl,
        });
    }

    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        // Clean expired entries and return size
        const entries = Array.from(this.cache.entries());
        for (const [key, entry] of entries) {
            if (Date.now() > entry.expiry) {
                this.cache.delete(key);
            }
        }
        return this.cache.size;
    }
}

// Singleton cache instances
export const brandResultCache = new LRUCache<unknown>(100);

// Cache key generator
export function generateCacheKey(brand: string): string {
    return `brand:${brand.toLowerCase().trim()}`;
}
