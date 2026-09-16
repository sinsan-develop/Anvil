"""D-03 host-context API projection; HTTP/authentication transport는 후속 계층 소유."""
from packages.knowledge.sources import LearningSourceRepository, SourceError, to_primitive


class LearningSourcesAPI:
    def __init__(self, repository, context):
        if type(repository) is not LearningSourceRepository:
            raise SourceError("SOURCE_HOST_AUTHORITY_REQUIRED")
        self.repository, self.context = repository, context

    def request(self, operation, payload, *, request_id=None, now):
        try:
            if type(payload) is not dict or type(operation) is not str:
                raise SourceError("INVALID_SOURCE_INPUT")
            data = dict(payload)
            if operation == "register":
                if "expected_version" not in data:
                    raise SourceError("INVALID_SOURCE_INPUT")
                expected = data.pop("expected_version")
                result = self.repository.register(self.context, data, expected_version=expected, request_id=request_id, now=now)
            elif operation in ("revoke", "quarantine"):
                if set(data) != {"source_id", "expected_version", "reason"}:
                    raise SourceError("INVALID_SOURCE_INPUT")
                result = self.repository.transition(self.context, data["source_id"], "REVOKED" if operation == "revoke" else "QUARANTINED",
                                                    data["reason"], expected_version=data["expected_version"], request_id=request_id, now=now)
            elif operation in ("get", "list-derived", "get-impact"):
                field = "impact_id" if operation == "get-impact" else "source_id"
                if set(data) != {field}:
                    raise SourceError("INVALID_SOURCE_INPUT")
                method = {"get": self.repository.get, "list-derived": self.repository.list_derived, "get-impact": self.repository.get_impact}[operation]
                result = method(self.context, data[field], now=now)
            else:
                raise SourceError("INVALID_SOURCE_INPUT")
            return {"status": 201 if operation in ("register", "revoke", "quarantine") else 200, "body": to_primitive(result)}
        except SourceError as error:
            status = 404 if error.reason == "SOURCE_NOT_FOUND" else 403 if "AUTHORITY" in error.reason else 409 if error.reason in ("REQUEST_REPLAY", "SOURCE_VERSION_CONFLICT", "STALE_SOURCE_TIME", "LEARNING_SOURCE_REVOKED") else 400
            return {"status": status, "body": {"reason": error.reason}}
