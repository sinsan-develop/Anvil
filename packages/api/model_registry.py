"""D11 authenticated host API adapter. HTTP/capture 발급 endpoint 없음."""
from packages.knowledge.model_registry import ModelRegistry, ModelRegistryError, fields
from packages.knowledge.memory import to_primitive


class ModelRegistryAPI:
    def __init__(self, registry, context):
        if type(registry) is not ModelRegistry: raise ModelRegistryError("REGISTRY_HOST_REQUIRED")
        self.registry, self.context = registry, context

    def request(self, operation, payload, *, now):
        try:
            repo, ctx = self.registry, self.context
            if operation in ("query", "registry"):
                fields(payload, ""); value = repo.query(ctx, now=now)
            elif operation in ("prompt", "snapshot", "probe", "benchmark"):
                fields(payload, "capture_id")
                kind = "model" if operation in ("snapshot", "probe") else operation
                value = repo.publish(ctx, kind, payload["capture_id"], now=now)
            elif operation == "routing_candidate":
                fields(payload, "data"); value = repo.create_routing(ctx, payload["data"], now=now)
            elif operation == "activate":
                fields(payload, "target capture_id expected_version")
                value = repo.activate(ctx, payload["target"], payload["capture_id"], expected_version=payload["expected_version"], now=now)
            elif operation == "run_guard":
                fields(payload, "snapshot_ref"); value = repo.run_guard(ctx, payload["snapshot_ref"], now=now)
            elif operation == "export":
                fields(payload, ""); value = repo.export_state(ctx, now=now)
            elif operation == "import":
                fields(payload, "checkpoint"); value = repo.import_state(ctx, payload["checkpoint"], now=now)
            else: raise ModelRegistryError("INVALID_REGISTRY_INPUT")
            return dict(status=200, body=to_primitive(value))
        except ModelRegistryError as error:
            return dict(status=400, body=dict(reason=error.reason))
