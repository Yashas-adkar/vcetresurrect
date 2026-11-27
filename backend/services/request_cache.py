from concurrent.futures import Future
from copy import deepcopy
from threading import Lock
from time import monotonic
from typing import Callable, Generic, TypeVar

Value = TypeVar("Value")


class SingleFlightCache(Generic[Value]):
    """Bounded TTL cache that shares concurrent work for identical keys."""

    def __init__(self, *, max_entries: int, max_weight: int, ttl_seconds: float) -> None:
        self.max_entries = max_entries
        self.max_weight = max_weight
        self.ttl_seconds = ttl_seconds
        self._lock = Lock()
        self._entries: dict[str, tuple[float, int, Value]] = {}
        self._inflight: dict[str, Future[Value]] = {}
        self._weight = 0

    def get_or_compute(
        self,
        key: str,
        compute: Callable[[], Value],
        *,
        weight: Callable[[Value], int] | None = None,
        cache_if: Callable[[Value], bool] | None = None,
    ) -> Value:
        now = monotonic()
        with self._lock:
            self._remove_expired(now)
            cached = self._entries.pop(key, None)
            if cached is not None:
                expires_at, entry_weight, value = cached
                self._entries[key] = (expires_at, entry_weight, value)
                return deepcopy(value)

            pending = self._inflight.get(key)
            if pending is None:
                pending = Future()
                self._inflight[key] = pending
                is_owner = True
            else:
                is_owner = False

        if not is_owner:
            return deepcopy(pending.result())

        try:
            value = compute()
            entry_weight = max(1, weight(value) if weight else 1)
            stored_value = deepcopy(value)
            with self._lock:
                should_cache = cache_if is None or cache_if(value)
                if should_cache and entry_weight <= self.max_weight:
                    self._entries[key] = (
                        monotonic() + self.ttl_seconds,
                        entry_weight,
                        stored_value,
                    )
                    self._weight += entry_weight
                    self._evict_over_limit()
                self._inflight.pop(key, None)
                pending.set_result(stored_value)
            return deepcopy(value)
        except BaseException as error:
            with self._lock:
                self._inflight.pop(key, None)
                pending.set_exception(error)
            raise

    def get(self, key: str) -> Value | None:
        now = monotonic()
        with self._lock:
            self._remove_expired(now)
            cached = self._entries.pop(key, None)
            if cached is not None:
                expires_at, entry_weight, value = cached
                self._entries[key] = (expires_at, entry_weight, value)
                return deepcopy(value)
            pending = self._inflight.get(key)
        if pending is None:
            return None
        return deepcopy(pending.result())

    def _remove_expired(self, now: float) -> None:
        expired = [
            key for key, (expires_at, _, _) in self._entries.items()
            if expires_at <= now
        ]
        for key in expired:
            _, entry_weight, _ = self._entries.pop(key)
            self._weight -= entry_weight

    def _evict_over_limit(self) -> None:
        while len(self._entries) > self.max_entries or self._weight > self.max_weight:
            _, (_, entry_weight, _) = self._entries.pop(next(iter(self._entries)))
            self._weight -= entry_weight
