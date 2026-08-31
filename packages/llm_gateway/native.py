"""Native model adapter boundary used by the minimal kernel."""

from .contracts import CapabilityProbe, GatewayRequest, GatewayResponse, ProviderAdapter


class NativeAgentAdapter:
    def __init__(self, provider: ProviderAdapter) -> None:
        self._provider = provider

    def probe(self, required: set[str] | frozenset[str] = frozenset()) -> CapabilityProbe:
        return self._provider.probe(required)

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        return self._provider.generate(request)
