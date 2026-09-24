# Local·WSL-server 운영 유사 검증 범위 revision — 2026-09-25

## 판정

`SCOPE_REVISION_QA_PASSED_PENDING_INTEGRATION`. 신산님의 직접 지시로 현 작업계획의 `ysna-server` 운영 검증을 WSL-server의 별도 격리 운영 유사 검증으로 변경한다. F-18 전체 인수와 F-19 착수는 아직 하지 않았고, Production은 `NOT_EXECUTED`, ReleaseDecision은 `DEFER`다. 최종 코드 QA SHA는 `378b337ad2ddc6069d2eb5549edbc224a9319aaf`다.

## 변경 전·후와 영향

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| F-18 | `ysna-server` Production·공유 PG18·공개 도메인 실측 | WSL-server 격리 운영 유사 target의 동일 Git commit/digest·분리 PG18·OIDC/object storage/network·rollback 검증 |
| F-19 | Local·WSL·Production의 9 Provider·Web·secret 회귀 | Local·WSL Test/Staging·WSL 격리 운영 유사 환경의 회귀 |
| F-20 | Production smoke·Monitoring 뒤 `RELEASED` | WSL 운영 유사 smoke·Monitoring 후 개발·테스트 완료만 판정; `RELEASED` 불가 |
| AV-OPS-013/016/017/020/023, AV-FLOW-020 | Production target을 필수 증거로 요구 | WSL 격리 target의 실제 증거 요구, Production은 미실행으로 명시 |

승인 근거와 정확한 authority SHA는 `docs/approvals/APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001.md`에 결박한다. 기존 완료 Package의 역사적 증거는 변경하지 않는다. `AGENTS.md`, 설계서, 작업계획서, 검증 매트릭스, 테스트계획서, 운영규칙, 개발환경 문서를 함께 정합화한다.

## 검증 계획과 미검증

- 코드 checkpoint `9da1060812020a0ea9b2b0aa837b3423324b7848`을 설정된 Git SSH alias로 게시하고, WSL-server 전용 `/srv/anvil-wsl/wsl-scope-revision-qa`에서 같은 HEAD를 detached checkout했다. Python 3.12 잠긴 dev 의존성에서 신규 범위·기존 F18 통제 19 PASS(exit 0/0.73초). 정확한 realpath·비-symlink·HEAD를 검사한 뒤 전용 경로만 제거해 잔류 0을 확인했다. 첫 정리 명령은 Windows→SSH 인용 오류(exit 1)였고 정정한 guard 명령으로 정리했다. 기존 서비스·DB·Docker·브라우저 변경은 없다.
- 로컬 Windows 범위·기존 F18 통제도 19 PASS(exit 0/13.92초). 이번 문서 변경 이후 실제 운영 유사 환경 검증을 수행한 것은 아니며 통제 코드의 QA만 수행했다.
- 첫 evidence projection은 Windows Git의 한글 경로 이스케이프로 `WSL_SCOPE_GIT_INVALID` fail-closed(exit 1)했다. 실제 Git 경로 회귀 테스트 RED 1건을 확인하고 `core.quotePath=false`·UTF-8 처리를 추가한 코드 checkpoint `378b337ad2ddc6069d2eb5549edbc224a9319aaf`를 게시했다. 같은 SHA에서 로컬 20 PASS(exit 0/14.68초), WSL-server `/srv/anvil-wsl/wsl-scope-revision-qa-r2`의 Python 3.12 잠긴 격리 환경 20 PASS(exit 0/0.68초). R2 realpath·비-symlink·HEAD 확인 뒤 제거·잔류 0. 이후 정본/코드 수정 없음.
- 정본 G-05가 새 승인 문서 hash, 설계·계획 hash, exact Git base/branch/upstream/remote, WSL QA SHA 이후 evidence-only 변경, 2-parent merge/tree 일치를 검증한다.
- 로컬과 WSL-server는 게시된 동일 code checkpoint에서 통제 테스트를 실행한다. WSL QA는 단일 격리 checkout·venv만 사용하고 완료 후 잔류 0을 확인한다.
- 문서 변경 자체는 F-18/F-19 기능·배포 PASS가 아니다. 9 Provider 실제 호출, 격리 PG18, OIDC/object storage, 브라우저 Network, Monitoring·rollback은 아직 `NOT_EXECUTED`다. `ysna-server`·공개 도메인·운영 DB는 접근하지 않는다.
- rollback은 이 문서 revision과 통제 projection을 후속 작업 branch에서 역변경하고 다시 G-05·WSL QA를 통과시킨 뒤 PR 병합하는 것이다. 승인된 기존 history를 force rewrite하지 않는다.
