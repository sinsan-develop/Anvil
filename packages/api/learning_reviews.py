"""D-05 host-context API projection. 실제 HTTP/queue 연결 없음."""
from packages.knowledge.reviews import LearningReviewRepository, ReviewError
from packages.knowledge.memory import to_primitive


class LearningReviewsAPI:
    def __init__(self, repository, context):
        if type(repository) is not LearningReviewRepository:
            raise ReviewError("SOURCE_HOST_AUTHORITY_REQUIRED")
        self.repository, self.context = repository, context

    def request(self, operation, payload, *, now, request_id=None):
        try:
            if type(payload) is not dict or type(operation) is not str:
                raise ReviewError("INVALID_REVIEW_INPUT")
            data = dict(payload)
            if operation == "create":
                if "expected_version" not in data:
                    raise ReviewError("INVALID_REVIEW_INPUT")
                expected = data.pop("expected_version")
                result = self.repository.create(self.context, data, expected_version=expected, request_id=request_id, now=now)
            elif operation == "get" and set(data) == {"review_id"}:
                result = self.repository.get(self.context, data["review_id"], now=now)
            elif operation == "list" and not data:
                result = self.repository.list(self.context, now=now)
            else:
                raise ReviewError("INVALID_REVIEW_INPUT")
            return {"status": 201 if operation == "create" else 200, "body": to_primitive(result)}
        except ReviewError as error:
            status = 404 if error.reason.endswith("NOT_FOUND") else 403 if error.reason in ("SOURCE_HOST_AUTHORITY_REQUIRED", "REVIEW_ATTESTATION_REQUIRED", "REVIEW_AUTHORITY_MISMATCH") else 409 if error.reason in ("REVIEW_REPLAY_CONFLICT", "REVIEW_VERSION_CONFLICT", "REVIEW_ALREADY_EXISTS", "LEARNING_SOURCE_REVOKED") else 400
            return {"status": status, "body": {"reason": error.reason}}
