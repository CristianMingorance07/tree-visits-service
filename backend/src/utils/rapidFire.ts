import { config } from '../config';

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 30_000; // 30-second sliding window

// Prune stale buckets every minute — does not keep the process alive
const pruner = setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter(t => t > cutoff);
    if (!bucket.timestamps.length) buckets.delete(key);
  }
}, 60_000);

if (typeof pruner.unref === 'function') pruner.unref();

export function isRapidFire(ip: string, customerId: string): boolean {
  const key = `${ip}\0${customerId}`;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter(t => t > cutoff);
  bucket.timestamps.push(now);

  return bucket.timestamps.length > config.rapidFireMaxHits;
}

export function _resetBucketsForTest(): void {
  buckets.clear();
}
