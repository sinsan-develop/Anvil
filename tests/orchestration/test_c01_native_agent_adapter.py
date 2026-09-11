import asyncio
from dataclasses import dataclass

import pytest

import packages.orchestration as orchestration


@dataclass(frozen=True)
class _Handle:
    backend: str
    packet: object


class _DeterministicNativeCodingBackend:
    def __init__(self, backend: str, result: object) -> None:
        self.backend = backend
        self.result = result

    async def probe_capabilities(self) -> object:
        return {"coding": True, "checkpoint": True, "steer": True}

    async def start(self, packet: object) -> object:
        return _Handle(self.backend, packet)

    async def stream_events(self, handle: object):
        yield {"type": "started", "packet": handle.packet}

    async def request_checkpoint(self, handle: object) -> object:
        return {"checkpoint_ref": handle.packet["resume_ref"]}

    async def steer(self, handle: object, instruction: object) -> None:
        assert handle.packet is not None
        assert instruction == {"instruction": "continue"}

    async def stop(self, handle: object, reason: str) -> object:
        return {"status": "STOPPED", "reason": reason, "packet": handle.packet}

    async def collect_result(self, handle: object) -> object:
        assert handle.packet is not None
        return self.result


@pytest.mark.parametrize("backend", ["claude", "codex", "local"])
def test_native_coding_backends_preserve_opaque_governance_references(backend: str):
    packet = {
        "task_graph_ref": "task-graph:1",
        "permission_ref": "permission:1",
        "evidence_ref": "evidence:1",
        "resume_ref": "checkpoint:1",
    }
    expected_result = {
        "task_graph_ref": "task-graph:1",
        "permission_ref": "permission:1",
        "evidence_ref": "evidence:1",
        "resume_ref": "checkpoint:1",
        "status": "COMPLETED",
    }
    adapter = _DeterministicNativeCodingBackend(backend, expected_result)

    assert isinstance(adapter, orchestration.NativeCodingAgentAdapter)

    async def exercise_boundary():
        capabilities = await adapter.probe_capabilities()
        handle = await adapter.start(packet)
        events = [event async for event in adapter.stream_events(handle)]
        checkpoint = await adapter.request_checkpoint(handle)
        await adapter.steer(handle, {"instruction": "continue"})
        stopped = await adapter.stop(handle, "test complete")
        result = await adapter.collect_result(handle)
        return capabilities, handle, events, checkpoint, stopped, result

    capabilities, handle, events, checkpoint, stopped, result = asyncio.run(
        exercise_boundary()
    )

    assert capabilities == {"coding": True, "checkpoint": True, "steer": True}
    assert handle.packet is packet
    assert events == [{"type": "started", "packet": packet}]
    assert checkpoint == {"checkpoint_ref": packet["resume_ref"]}
    assert stopped == {"status": "STOPPED", "reason": "test complete", "packet": packet}
    assert result is expected_result
