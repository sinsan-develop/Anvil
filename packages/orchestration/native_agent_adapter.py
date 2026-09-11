"""Provider-neutral lifecycle boundary for native coding-agent backends."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable


@runtime_checkable
class NativeCodingAgentAdapter(Protocol):
    """Keep backend lifecycle values opaque to the C-01 orchestration boundary."""

    async def probe_capabilities(self) -> object: ...

    async def start(self, packet: object) -> object: ...

    def stream_events(self, handle: object) -> AsyncIterator[object]: ...

    async def request_checkpoint(self, handle: object) -> object: ...

    async def steer(self, handle: object, instruction: object) -> None: ...

    async def stop(self, handle: object, reason: str) -> object: ...

    async def collect_result(self, handle: object) -> object: ...
