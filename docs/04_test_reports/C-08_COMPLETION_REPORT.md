# C-08 완료 보고서

## 판정

`COMPLETED` — fixture 기반 Repository Intelligence 확장과 정적 검증을 완료했다.

## 기준선

- Work Package: C-08
- 시작 branch: `codex/c08-repository-intelligence`
- 시작 HEAD: `b923309` (`docs: issue C-08 repository intelligence work instruction`)
- 시작 상태: WorkInstruction/InvocationPrompt만 포함된 clean worktree

## 조치 및 변경

- `packages/repository_intelligence/indexes.py`: Python AST 및 TypeScript 정규식 기반 symbol/dependency/test/impact 인덱스, 보수적 parse/path warning, stable sort와 canonical SHA-256 추가
- `packages/repository_intelligence/models.py`, `scanner.py`: 기존 `ScanResult`/`scan_repository` 계약에 JSON-safe 인덱스 필드 연결. 기존 pre/post no-write proof는 유지
- `tests/repository_intelligence/`: Python/TypeScript fixture, deterministic hash, hostile path 회귀 테스트 추가

## 검증 증거

- `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/repository_intelligence/test_indexes.py -q --disable-warnings` → 종료 코드 0, `3 passed`
- `C:\Users\cyhuh\anaconda3\python.exe -m compileall -q packages/repository_intelligence tests/repository_intelligence` → 종료 코드 0
- `git diff --check` → 종료 코드 0

전체 `tests` 실행은 기존 서로 다른 디렉터리의 `test_models.py` 모듈명 충돌로 수집 단계에서 중단되며, 본 변경의 실패로 분류하지 않는다. 실제 Provider/DB/API/브라우저/배포/운영 성능은 범위 밖으로 미검증이다.

## 잔여 위험 및 복구

## 재작업 이력

- `FAILURE_REPORT` 1회: 독립 검증에서 내부 symlink 판정, Python unresolved import, JS/TS `require`, 참조 인덱스 및 ScanResult hash/schema 노출, impact의 의존·테스트 연결이 부족하다고 판정했다.
- 조치: resolve 전 lstat 검사와 경로 경고, known stems 기반 import 판정, require 파싱, `references` 필드, `index_sha256` 및 schema fields 연결, impact 관련 경로 확장을 적용했다.
- 재검증: 동일 targeted pytest `3 passed`, compileall 및 diff check 통과.
- `FAILURE_REPORT` 2회차: Python import와 상대 require의 확장자/모듈 경로 해석이 불충분했다.
- 조치: 표준 외부 모듈 분류, Python known stems 판정, 상대 require의 확장자 및 `index` 후보 정규화를 추가하고 회귀 테스트를 확장했다.

- 외부 parser 없이 보수적으로 분석하므로 난해한 TypeScript 문법은 warning 없이 미색인될 수 있다.
- 영향 투영은 지정 심볼/경로와 직접 관찰된 행을 중심으로 하며 의미론적 호출 그래프가 아니다.
- 롤백은 C-08 커밋을 revert하면 된다. 기존 inventory, manifest, Git 및 no-write proof 동작은 변경하지 않았다.
