import time
from typing import Optional, Dict, Tuple
from bodhion.env import REDIS_KEY_PREFIX


class RateLimiter:
    """
    General-purpose rate limiter using Redis with a rolling window strategy.
    Falls back to in-memory storage if Redis is not available.
    """

    # In-memory fallback storage
    _memory_store: Dict[str, Dict[int, int]] = {}

    def __init__(
        self,
        redis_client,
        limit: int,
        window: int,
        bucket_size: int = 60,
        enabled: bool = True,
    ):
        """
        :param redis_client: Redis client instance or None
        :param limit: Max allowed events in the window
        :param window: Time window in seconds
        :param bucket_size: Bucket resolution
        :param enabled: Turn on/off rate limiting globally
        """
        self.r = redis_client
        self.limit = limit
        self.window = window
        self.bucket_size = bucket_size
        self.num_buckets = window // bucket_size
        self.enabled = enabled

    def _bucket_key(self, key: str, bucket_index: int) -> str:
        return f"{REDIS_KEY_PREFIX}:ratelimit:{key.lower()}:{bucket_index}"

    def _current_bucket(self) -> int:
        return int(time.time()) // self.bucket_size

    def _redis_available(self) -> bool:
        return self.r is not None

    def is_limited(self, key: str) -> bool:
        """
        Main rate-limit check.
        Gracefully handles missing or failing Redis.
        """
        if not self.enabled:
            return False

        if self._redis_available():
            try:
                return self._is_limited_redis(key)
            except Exception:
                return self._is_limited_memory(key)
        else:
            return self._is_limited_memory(key)

    def get_count(self, key: str) -> int:
        if not self.enabled:
            return 0

        if self._redis_available():
            try:
                return self._get_count_redis(key)
            except Exception:
                return self._get_count_memory(key)
        else:
            return self._get_count_memory(key)

    def remaining(self, key: str) -> int:
        used = self.get_count(key)
        return max(0, self.limit - used)

    def _is_limited_redis(self, key: str) -> bool:
        now_bucket = self._current_bucket()
        bucket_key = self._bucket_key(key, now_bucket)

        attempts = self.r.incr(bucket_key)
        if attempts == 1:
            self.r.expire(bucket_key, self.window + self.bucket_size)

        # Collect buckets
        buckets = [
            self._bucket_key(key, now_bucket - i) for i in range(self.num_buckets + 1)
        ]

        counts = self.r.mget(buckets)
        total = sum(int(c) for c in counts if c)

        return total > self.limit

    def _get_count_redis(self, key: str) -> int:
        now_bucket = self._current_bucket()
        buckets = [
            self._bucket_key(key, now_bucket - i) for i in range(self.num_buckets + 1)
        ]
        counts = self.r.mget(buckets)
        return sum(int(c) for c in counts if c)

    def _is_limited_memory(self, key: str) -> bool:
        now_bucket = self._current_bucket()

        # Init storage
        if key not in self._memory_store:
            self._memory_store[key] = {}

        store = self._memory_store[key]

        # Increment bucket
        store[now_bucket] = store.get(now_bucket, 0) + 1

        # Drop expired buckets
        min_bucket = now_bucket - self.num_buckets
        expired = [b for b in store if b < min_bucket]
        for b in expired:
            del store[b]

        # Count totals
        total = sum(store.values())
        return total > self.limit

    def _get_count_memory(self, key: str) -> int:
        now_bucket = self._current_bucket()
        if key not in self._memory_store:
            return 0

        store = self._memory_store[key]
        min_bucket = now_bucket - self.num_buckets

        # Remove expired
        expired = [b for b in store if b < min_bucket]
        for b in expired:
            del store[b]

        return sum(store.values())


class AsyncMcpRateLimiter:
    """
    Async rate limiter for MCP tool calls using Redis sorted sets (sliding window).
    Falls back to allowing all calls when Redis is unavailable.

    Two limits are checked: per-minute and per-day.
    Returns (is_limited, retry_after_seconds).
    """

    def __init__(self, redis_client, calls_per_minute: int = 0, calls_per_day: int = 0):
        self.redis = redis_client
        self.calls_per_minute = calls_per_minute
        self.calls_per_day = calls_per_day

    def _key(self, user_id: str, server_id: str, window: str) -> str:
        return f"{REDIS_KEY_PREFIX}:mcp_rl:{server_id}:{user_id}:{window}"

    async def check(self, user_id: str, server_id: str) -> Tuple[bool, int]:
        """
        Returns (is_rate_limited, retry_after_seconds).
        If Redis is unavailable, always allows (returns False, 0).
        """
        if self.redis is None:
            return False, 0
        if not self.calls_per_minute and not self.calls_per_day:
            return False, 0

        now = time.time()
        now_ms = int(now * 1000)

        try:
            if self.calls_per_minute:
                key = self._key(user_id, server_id, "min")
                window_start = now_ms - 60_000
                await self.redis.zremrangebyscore(key, "-inf", window_start)
                count = await self.redis.zcard(key)
                if count >= self.calls_per_minute:
                    oldest = await self.redis.zrange(key, 0, 0, withscores=True)
                    if oldest:
                        oldest_ms = oldest[0][1]
                        retry = max(1, int((oldest_ms + 60_000 - now_ms) / 1000))
                    else:
                        retry = 60
                    return True, retry
                await self.redis.zadd(key, {str(now_ms): now_ms})
                await self.redis.expire(key, 120)

            if self.calls_per_day:
                key = self._key(user_id, server_id, "day")
                window_start = now_ms - 86_400_000
                await self.redis.zremrangebyscore(key, "-inf", window_start)
                count = await self.redis.zcard(key)
                if count >= self.calls_per_day:
                    oldest = await self.redis.zrange(key, 0, 0, withscores=True)
                    if oldest:
                        oldest_ms = oldest[0][1]
                        retry = max(1, int((oldest_ms + 86_400_000 - now_ms) / 1000))
                    else:
                        retry = 3600
                    return True, retry
                await self.redis.zadd(key, {str(now_ms): now_ms})
                await self.redis.expire(key, 90_000)

        except Exception:
            return False, 0

        return False, 0
