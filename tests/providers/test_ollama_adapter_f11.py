"""F-11 local Ollama wire and pre-send SSRF boundary (synthetic host only)."""
import json

import pytest

from packages.llm_gateway.contracts import GatewayRequest, UsageProvenance
from packages.providers.ollama_adapter import OllamaAdapter
from packages.providers.ollama_endpoint import EndpointPolicy, EndpointPermit
from packages.providers.ollama_errors import OllamaAdapterError
from packages.providers.ollama_models import TransportResponse


class Resolver:
    def __init__(self, addresses=("127.0.0.1",)):
        self.addresses = addresses
        self.calls = []

    def resolve(self, host):
        self.calls.append(host)
        return self.addresses


class Connection:
    def __init__(self, peer="127.0.0.1", answer=None, fail=None):
        self.peer_ip = peer
        self.answer = answer
        self.fail = fail
        self.sent = []
        self.closed = False
        self.responses = []

    def request(self, *, method, path, payload, request_id, stream, allow_redirects, use_proxy):
        self.sent.append((method, path, payload, request_id, stream, allow_redirects, use_proxy))
        if self.fail:
            raise self.fail
        if self.responses:
            return self.responses.pop(0)
        return self.answer

    def close(self):
        self.closed = True


class Transport:
    def __init__(self, connection=None):
        self.connection = connection or Connection()
        self.connects = []

    def connect(self, *, scheme, host, port, pinned_ip, allow_proxy):
        self.connects.append((scheme, host, port, pinned_ip, allow_proxy))
        return self.connection


def setup(addresses=("127.0.0.1",), peer="127.0.0.1", answer=None):
    resolver = Resolver(addresses)
    transport = Transport(Connection(peer, answer))
    policy = EndpointPolicy("local", (EndpointPermit("local", "http", "localhost", 11434, ("127.0.0.1",)),))
    adapter = OllamaAdapter("http://localhost:11434", policy, resolver, transport)
    return adapter, resolver, transport


def ask(ident="f11:1", signal=None, model="llama3.2"):
    return GatewayRequest("ollama", model, "hello", ident, signal)


def chat(content="answer", **extra):
    return {"model": "llama3.2", "message": {"role": "assistant", "content": content},
            "done": True, "done_reason": "stop", "prompt_eval_count": 3, "eval_count": 5, **extra}


def wire(body, status=200):
    return TransportResponse(status, (), body)


def test_pre_send_peer_is_validated_and_path_is_adapter_owned():
    adapter, resolver, transport = setup(answer=wire(chat()))
    result = adapter.generate(ask())
    assert resolver.calls == ["localhost"]
    assert transport.connects == [("http", "localhost", 11434, "127.0.0.1", False)]
    assert transport.connection.sent == [("POST", "/api/chat", {"model": "llama3.2",
        "messages": [{"role": "user", "content": "hello"}], "stream": False}, "f11:1", False, False, False)]
    assert (result.output_text, result.final_usage.total_tokens, result.usage_provenance) == (
        "answer", 8, UsageProvenance.PROVIDER_FINAL)
    assert "localhost" not in str(adapter.receipt("f11:1"))


def test_wrong_connected_peer_closes_without_sending():
    adapter, _, transport = setup(peer="127.0.0.2", answer=wire(chat()))
    with pytest.raises(OllamaAdapterError, match="ENDPOINT_PEER_MISMATCH"):
        adapter.generate(ask())
    assert transport.connection.sent == [] and transport.connection.closed


@pytest.mark.parametrize("url", [
    "http://localhost:11434/api/chat", "http://localhost:11434/?x=1",
    "http://localhost:11434/#x", "http://u@localhost:11434",
    "http://local%68ost:11434", "http://localhost.:11434", "http://LOCALHOST:11434",
    "http://127.1:11434", "http://2130706433:11434", "http://0x7f000001:11434",
    "http://[::ffff:127.0.0.1]:11434", "http://localhost:11434:80",
])
def test_ambiguous_or_user_owned_endpoint_is_rejected(url):
    adapter, resolver, transport = setup(answer=wire(chat()))
    with pytest.raises(OllamaAdapterError):
        OllamaAdapter(url, adapter.policy, resolver, transport)
    assert not resolver.calls and not transport.connects


@pytest.mark.parametrize("ip", [
    "169.254.169.254", "169.254.0.1", "fe80::1", "::", "224.0.0.1", "ff02::1",
    "0.0.0.0", "fd00:ec2::254", "100.100.100.200", "192.0.0.192",
    "64:ff9b::a9fe:a9fe", "2002:a9fe:a9fe::1", "2001::1",
])
def test_forbidden_targets_rejected_even_if_explicitly_allowlisted(ip):
    with pytest.raises(OllamaAdapterError):
        permit = EndpointPermit("local", "http", "localhost", 11434, (ip,))
        EndpointPolicy("local", (permit,)).authorize("http://localhost:11434", Resolver((ip,)))


def test_mixed_dns_and_rebinding_never_connect():
    adapter, _, transport = setup(addresses=("127.0.0.1", "169.254.169.254"), answer=wire(chat()))
    with pytest.raises(OllamaAdapterError):
        adapter.generate(ask())
    assert not transport.connects
    adapter, _, transport = setup(addresses=("127.0.0.2",), answer=wire(chat()))
    with pytest.raises(OllamaAdapterError):
        adapter.generate(ask())
    assert not transport.connects


def test_environment_allowlist_and_no_implicit_loopback():
    with pytest.raises(OllamaAdapterError):
        EndpointPolicy("prod", ()).authorize("http://localhost:11434", Resolver())
    policy = EndpointPolicy("prod", (EndpointPermit("test", "http", "localhost", 11434,
                                                   ("127.0.0.1",)),))
    with pytest.raises(OllamaAdapterError):
        policy.authorize("http://localhost:11434", Resolver())


def test_each_request_resolves_fresh_and_redirect_fails_closed():
    adapter, resolver, transport = setup(answer=wire(chat()))
    adapter.generate(ask())
    adapter.generate(ask("f11:2"))
    assert resolver.calls == ["localhost", "localhost"]
    transport.connection.answer = wire({"error": "redirect"}, 302)
    with pytest.raises(OllamaAdapterError, match="REDIRECT_BLOCKED"):
        adapter.generate(ask("f11:3"))


def test_ndjson_stream_final_usage_and_replay():
    frames = [
        {"model": "llama3.2", "message": {"role": "assistant", "content": "ans"}, "done": False},
        {"model": "llama3.2", "message": {"role": "assistant", "content": "wer"}, "done": False},
        chat(content=""),
    ]
    adapter, _, transport = setup(answer=wire("\n".join(json.dumps(x) for x in frames) + "\n"))
    first = adapter.stream(ask())
    assert first.chunks == ("ans", "wer")
    assert first.response.final_usage.total_tokens == 8
    assert adapter.stream(ask()) is first and len(transport.connection.sent) == 1
    assert transport.connection.sent[0][2]["stream"] is True


def test_native_ndjson_usage_only_final_without_message_is_accepted():
    final = chat(content="")
    del final["message"]
    frames = [
        {"model": "llama3.2", "message": {"role": "assistant", "content": "answer"}, "done": False},
        final,
    ]
    adapter, _, _ = setup(answer=wire("\n".join(json.dumps(x) for x in frames) + "\n"))
    result = adapter.stream(ask())
    assert result.chunks == ("answer",)
    assert result.response.final_usage.total_tokens == 8
    assert result.response.usage_provenance is UsageProvenance.PROVIDER_FINAL


@pytest.mark.parametrize("extra", [
    {"message": {"role": "assistant", "content": "unexpected"}},
    {"message": {"role": "assistant", "content": "", "tool_calls": [{"name": "x"}]}},
    {"message": {"role": "assistant", "content": "", "tool_calls": []}},
    {"message": {"role": "assistant", "content": "", "images": []}},
    {"message": {"role": "assistant", "content": ["not text"]}},
    {"tool_calls": [{"name": "x"}]},
    {"error": "synthetic"},
    {"error": ""},
    {"done_reason": "length"},
])
def test_native_usage_only_final_rejects_content_tool_error_or_incomplete(extra):
    final = chat(content="")
    del final["message"]
    final.update(extra)
    frames = [{"model": "llama3.2", "message": {"role": "assistant", "content": "answer"},
               "done": False}, final]
    adapter, _, _ = setup(answer=wire("\n".join(json.dumps(x) for x in frames) + "\n"))
    with pytest.raises(OllamaAdapterError):
        adapter.stream(ask())


@pytest.mark.parametrize("body", [
    chat(done=False), chat(message={"role": "assistant", "content": "", "tool_calls": [{"name": "x"}]}),
    chat(message={"role": "assistant", "content": ["not text"]}), chat(done_reason="length"),
    chat(prompt_eval_count=-1), chat(eval_count=True), chat(content=""),
])
def test_nonfinal_tool_nontext_or_invalid_usage_fails_closed(body):
    adapter, _, _ = setup(answer=wire(body))
    with pytest.raises(OllamaAdapterError):
        adapter.generate(ask())


def test_abort_before_send_and_request_identity_conflict():
    adapter, _, transport = setup(answer=wire(chat()))
    response = adapter.generate(ask(signal=lambda: True))
    assert response.abort_status == "ABORTED" and transport.connection.sent == []
    with pytest.raises(OllamaAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.generate(GatewayRequest("ollama", "llama3.2", "different", "f11:1"))


def test_probe_classifies_install_offline_missing_model_and_available():
    adapter, _, transport = setup(answer=wire({"version": "0.6.0"}))
    transport.connection.answer = wire({"version": "0.6.0"})
    transport.connection.responses = [wire({"version": "0.6.0"}),
                                      wire({"models": [{"name": "llama3.2"}]}),
                                      wire({"models": [{"name": "llama3.2"}]})]
    result = adapter.health("llama3.2", request_id="health:1")
    assert result.to_dict()["status"] == "AVAILABLE"
    assert [x[1] for x in transport.connection.sent] == ["/api/version", "/api/tags", "/api/ps"]
    assert "localhost" not in str(result)


def test_probe_installation_requires_explicit_host_evidence_and_offline_is_distinct():
    adapter, _, transport = setup()
    transport.installation_status = lambda: False
    assert adapter.health("llama3.2", request_id="health:missing").to_dict()["status"] == "NOT_INSTALLED"
    assert not transport.connects
    del transport.installation_status
    transport.connection.fail = ConnectionError("http://localhost:11434 synthetic failure")
    assert adapter.health("llama3.2", request_id="health:offline").to_dict()["status"] == "OFFLINE"


def test_probe_missing_model_and_stream_ready_requires_successful_stream():
    adapter, _, transport = setup()
    transport.connection.responses = [wire({"version": "0.6.0"}), wire({"models": []})]
    assert adapter.health("llama3.2", request_id="health:missing-model").to_dict()["status"] == "MODEL_NOT_PULLED"
    frames = [{"model": "llama3.2", "message": {"role": "assistant", "content": "yes"}, "done": False}, chat("")]
    transport.connection.answer = wire("\n".join(json.dumps(x) for x in frames) + "\n")
    adapter.stream(ask("f11:ready"))
    transport.connection.responses = [wire({"version": "0.6.0"}),
        wire({"models": [{"name": "llama3.2"}]}), wire({"models": []})]
    assert adapter.health("llama3.2", request_id="health:ready").to_dict()["stream_status"] == "READY"


@pytest.mark.parametrize("frames", [
    [{"model": "llama3.2", "message": {"role": "assistant", "content": "x"}, "done": False}],
    [chat(""), chat("")],
    [{"model": "llama3.2", "message": {"role": "assistant", "content": "x", "tool_calls": ["x"]}, "done": False}, chat("")],
])
def test_stream_missing_final_duplicate_final_and_tool_frame_are_rejected(frames):
    adapter, _, transport = setup(answer=wire("\n".join(json.dumps(x) for x in frames) + "\n"))
    with pytest.raises(OllamaAdapterError):
        adapter.stream(ask())
    assert transport.connection.closed


def test_transport_exception_and_response_never_expose_endpoint():
    adapter, _, transport = setup()
    transport.connection.fail = RuntimeError("http://localhost:11434/api/chat synthetic")
    with pytest.raises(OllamaAdapterError) as caught:
        adapter.generate(ask())
    assert "localhost" not in str(caught.value)


def test_explicit_private_permit_and_ipv6_loopback_are_accepted():
    for endpoint, host, ip in (("http://ollama.internal:11434", "ollama.internal", "10.0.0.2"),
                               ("http://[::1]:11434", "::1", "::1")):
        policy = EndpointPolicy("local", (EndpointPermit("local", "http", host, 11434, (ip,)),))
        target = policy.authorize(endpoint, Resolver((ip,)))
        assert target.pinned_ip == ip


def test_discovery_uses_live_tags_without_cloud_registry_or_endpoint():
    adapter, _, transport = setup()
    transport.connection.responses = [wire({"version": "0.6.0"}),
        wire({"models": [{"name": "llama3.2"}, {"name": "mistral"}, {"name": "llama3.2"}]})]
    found = adapter.discover(request_id="discover:1").to_dict()
    assert found == {"provider": "ollama", "models": ["llama3.2", "mistral"],
                     "status": "AVAILABLE", "stream_status": "STREAM_UNVERIFIED"}
    assert [sent[1] for sent in transport.connection.sent] == ["/api/version", "/api/tags"]


@pytest.mark.parametrize("host", ["metadata", "metadata.google.internal", "instance-data"])
def test_metadata_hostname_is_never_approved(host):
    with pytest.raises(OllamaAdapterError):
        EndpointPermit("local", "http", host, 11434, ("127.0.0.1",))


def test_response_secret_and_stream_post_send_abort_are_safe():
    adapter, _, _ = setup(answer=wire(chat("api_key=synthetic")))
    with pytest.raises(OllamaAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        adapter.generate(ask())
    signal = {"aborted": False}
    frames = [{"model": "llama3.2", "message": {"role": "assistant", "content": "yes"}, "done": False}, chat("")]
    adapter, _, transport = setup(answer=wire("\n".join(json.dumps(x) for x in frames) + "\n"))
    old_request = transport.connection.request
    def abort_during_send(**kwargs):
        signal["aborted"] = True
        return old_request(**kwargs)
    transport.connection.request = abort_during_send
    response = adapter.stream(ask("abort:2", lambda: signal["aborted"])).response
    assert response.abort_status == "ABORT_REQUESTED_UPSTREAM_COMPLETED"
    assert response.final_usage.total_tokens == 8


@pytest.mark.parametrize("failure_at", ["tags", "ps"])
def test_health_probe_transport_failure_at_any_stage_is_offline(failure_at):
    adapter, _, transport = setup()
    class FailingConnection(Connection):
        def request(self, **kwargs):
            if kwargs["path"] == f"/api/{failure_at}":
                raise ConnectionError("http://localhost:11434 synthetic")
            if kwargs["path"] == "/api/version":
                return wire({"version": "0.6.0"})
            return wire({"models": [{"name": "llama3.2"}]})
    transport.connection = FailingConnection()
    result = adapter.health("llama3.2", request_id=f"health:{failure_at}").to_dict()
    assert result == {"status": "OFFLINE", "stream_status": "STREAM_UNVERIFIED"}


def test_health_optional_ps_404_keeps_available_but_loaded_unknown():
    adapter, _, transport = setup()
    transport.connection.responses = [wire({"version": "0.6.0"}),
        wire({"models": [{"name": "llama3.2"}]}), wire({"error": "missing"}, 404)]
    result = adapter.health("llama3.2", request_id="health:ps404").to_dict()
    assert result["status"] == "AVAILABLE" and result["model_loaded"] is None


@pytest.mark.parametrize("bad_stage", ["version", "tags", "ps", "ps-entry"])
def test_health_malformed_probe_evidence_is_unavailable(bad_stage):
    adapter, _, transport = setup()
    bodies = {"version": {"version": "0.6.0"}, "tags": {"models": [{"name": "llama3.2"}]},
              "ps": {"models": [{"name": "llama3.2"}]}}
    if bad_stage == "ps-entry":
        bodies["ps"] = {"models": ["invalid"]}
    else:
        bodies[bad_stage] = {"unexpected": True}
    transport.connection.responses = [wire(bodies[key]) for key in ("version", "tags", "ps")]
    assert adapter.health("llama3.2", request_id=f"health:malformed:{bad_stage}").to_dict()["status"] == "UNAVAILABLE"
