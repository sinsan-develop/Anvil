# F-18 WSL 운영 유사 R6 WorkInstruction — S3 호환 ArtifactStore

## 기준·권한

- 승인된 F-18의 object storage adapter만 구현한다. 기존 단일 `codex/f18-wsl-ops` branch, Local 개발→승인 Git push→`ssh WSL-server` 격리 QA 순서다. `ysna-server`, Production, 기존 WSL 서비스/DB, 실제 계정·Secret은 대상이 아니다.
- 기존 `ArtifactStore`의 `put(ArtifactWriteRequest, bytes) -> ArtifactMetadata`와 `read(ArtifactMetadata) -> bytes` 계약을 유지한다. `FileSystemArtifactStore`를 교체하거나 기본값을 바꾸지 않는다. 새 S3 호환 adapter는 직접 import하며 브라우저·API 공개 계약에는 손대지 않는다.
- R5 seq1528에 활성 제품 writer가 없다. Main이 R6 새 worker/write epoch4 token과 exact6을 발급한 뒤에만 제품 mutation을 시작한다. exact6: `packages/artifacts/object_store.py`, `tests/artifacts/test_s3_artifact_store.py`, `pyproject.toml`, `uv.lock`, `deploy/wsl/requirements-runtime.txt`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

## 구현·검증

1. 주입받은 S3 client와 고정 bucket/prefix만 사용한다. 요청 내용의 byte-size·SHA-256을 네트워크 호출 전에 검증하고 content-addressed key `sha256/<첫 2자리>/<64 hex>`를 만든다. prefix는 canonical·비 traversal로 검증한다. 외부 사용자 입력으로 endpoint나 bucket을 바꾸지 않는다.
2. `put_object`에 `IfNoneMatch="*"`를 반드시 전달해 기존 key 덮어쓰기를 금지한다. 412(existing key)에서는 `get_object` 내용을 다시 확인해 동일하면 dedupe, 다르면 `ArtifactCollision`; 409 충돌은 무제한 재시도하지 말고 보수적으로 실패 또는 제한된 동일 조건 재시도한다. transport/권한 오류를 성공으로 바꾸지 않는다. `read`는 metadata의 key가 해당 content hash·prefix와 일치하는지 검사하고 반환 bytes의 size/hash를 검증한다. Secret/endpoint는 오류·repr·보고서에 출력하지 않는다.
3. 테스트는 실제 adapter 메서드를 호출하고 fake client는 S3 transport 경계만 대체한다. 사전 hash/size 거부 시 호출0, IfNoneMatch 전달, 동일 content dedupe, 충돌·경로 변조·읽기 오염·transport 오류를 RED→GREEN으로 확인한다. 기존 `tests/artifacts/test_artifact_store.py` 회귀도 통과시킨다.
4. `boto3`를 직접 runtime dependency/lock과 Web image runtime requirements에 일관되게 선언한다. 범위 밖 패키지 버전을 재선택하지 않는다. Local 잠금 설치·테스트·diff-check와 clean commit을 Main에게 전달한다. Main만 push/WSL 자원 생성·실측·정리를 수행한다.
5. Main은 같은 게시 SHA의 WSL-server 전용 MinIO container에서 합성 key/bucket으로 실제 put/read/dedupe/충돌을 검사한다. 이 결과만으로 OIDC·network policy·PG18·전체 3-image digest·backup/rollback·브라우저·Production을 PASS라 하지 않는다. F-18 accepted=false, F-19 차단을 유지한다.

## 복구

- 제품 변경 rollback은 R6 exact6 commit만 revert한다. 전용 WSL 임시 자원은 Main이 생성 전 이름·범위·수명을 `WORK_STATUS`에 기록하고, 사용 후 exact ID/label/경로를 확인해 제거한다. 기존 Docker/DB/service와 사용자 자료는 변경·삭제하지 않는다.
