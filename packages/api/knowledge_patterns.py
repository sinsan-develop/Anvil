"""인증된 host context용 D-04 순수 API adapter. 실제 HTTP/AST/fetch 없음."""
from packages.knowledge.patterns import PatternRepository, PatternError
from packages.knowledge.memory import to_primitive


class KnowledgePatternsAPI:
    def __init__(self, repository, context):
        if type(repository) is not PatternRepository:
            raise PatternError("SOURCE_HOST_AUTHORITY_REQUIRED")
        self.repository, self.context = repository, context

    def request(self, operation, payload, *, now, request_id=None):
        try:
            if type(payload) is not dict or type(operation) is not str:
                raise PatternError("INVALID_PATTERN_INPUT")
            data = dict(payload)
            if operation == "extract":
                if "expected_version" not in data:
                    raise PatternError("INVALID_PATTERN_INPUT")
                expected = data.pop("expected_version")
                result = self.repository.extract(self.context, data, expected_version=expected, request_id=request_id, now=now)
            elif operation == "search":
                result = self.repository.search(self.context, data, now=now)
            elif operation == "get":
                if set(data) != {"artifact_id", "version"}:
                    raise PatternError("INVALID_PATTERN_INPUT")
                result = self.repository.get(self.context, data["artifact_id"], version=data["version"], now=now)
            elif operation == "load-reference":
                if set(data) != {"pattern_ref", "reference_ref"}:
                    raise PatternError("INVALID_PATTERN_INPUT")
                result = self.repository.load_reference(self.context, **data, now=now)
            else:
                raise PatternError("INVALID_PATTERN_INPUT")
            return {"status": 201 if operation == "extract" else 200, "body": to_primitive(result)}
        except PatternError as error:
            status = 404 if error.reason in ("PATTERN_NOT_FOUND", "SOURCE_NOT_FOUND") else 403 if error.reason in ("SOURCE_HOST_AUTHORITY_REQUIRED", "PATTERN_ATTESTATION_REQUIRED") else 409 if error.reason in ("REQUEST_REPLAY", "PATTERN_VERSION_CONFLICT", "LEARNING_SOURCE_REVOKED") else 400
            return {"status": status, "body": {"reason": error.reason}}
