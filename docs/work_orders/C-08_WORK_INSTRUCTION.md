# C-08 WorkInstruction — Repository Intelligence 확장

## 범위

`packages/repository_intelligence`의 기존 read-only inventory 기반 스캔을 확장하여 fixture Python/TypeScript 저장소에서 다음을 결정적으로 산출한다.

- symbol index: 정의/참조 가능한 심볼의 이름, 종류, 상대 경로, 라인
- dependency index: import/require 관계와 unresolved 여부
- test index: 테스트 파일·테스트 심볼과 대상 소스 연결 근거
- impact projection: 지정 심볼/경로의 관련 파일·테스트·위험 근거

기존 ScanRequest/ScanResult 계약과 no-write pre/post proof는 유지한다. 출력은 JSON-safe이며 stable sort와 canonical SHA-256을 사용한다. Python 표준 라이브러리만 사용하고, 파서 실패는 보수적으로 구조화된 경고/근거로 표현한다.

## 허용 경로

- `packages/repository_intelligence/**`
- `tests/repository_intelligence/**`
- `docs/04_test_reports/C-08_COMPLETION_REPORT.md`

기존 문서·historical progress/event/hash는 변경하지 않는다.

## 금지

- 저장소 파일 쓰기, Git index/refs 변경, 프로세스 실행, 네트워크/DB/API/browser 호출
- 외부 parser 의존성 추가
- 기존 public API의 의미 변경
- fixture 외 실제 프로젝트의 성공 주장

## 완료 조건

1. Python/TypeScript fixture에서 symbols, dependencies, tests, impact가 생성된다.
2. 경로는 repository root 밖으로 탈출하지 않고 symlink/junction 및 unsupported language를 안전하게 거부/표시한다.
3. 동일 입력의 결과 hash가 반복 실행에서 동일하며 기존 no-write proof가 유지된다.
4. 신규 및 기존 repository intelligence 테스트, compileall, `git diff --check`가 통과한다.
5. 완료 보고서에 시작 HEAD/branch/status, 변경 파일·diff, 정확한 명령/결과, 미검증 범위와 rollback을 기록한다.

## 검증 범위

fixture/unit/정적 검증만 수행한다. 실제 Provider, DB, API, 브라우저, 배포 및 운영 성능은 미검증으로 명시한다.
