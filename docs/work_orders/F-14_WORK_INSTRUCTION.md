# F-14 WorkInstruction — PostgreSQL migration·backup/restore·artifact retention·재해복구

## 기준·권한

- 신산님이 승인한 `Anvil_작업계획서_v1.md` F-14 단일 Stage. 설계 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`, 계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`, 매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`, 테스트계획 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`, 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`.
- 기준 main `1584523ccca71bae4b3be01f592c7eb79c11935f`, branch `codex/f14-postgres-recovery`, worktree `D:\Project\Anvil\.codex-sandbox\f14-postgres-recovery`. F-13 PR #29 병합·원격 branch 삭제·merged-main G-05/659 PASS 6 SKIP·로컬 branch/worktree 정리를 Main이 확인했다.
- Main 어울은 범위·write lease·독립 검토·DB 격리 검증·PR 병합을 소유한다. `developer-primary-f14-r1`은 유효한 canonical worker/write lease의 두 fencing token과 아래 exact product scope 안에서 단일 writer로 TDD 구현한다.

## 제품 exact12 경로

1. `migrations/versions/0016_operations_recovery.py`
2. `packages/persistence/operations_repository.py`
3. `packages/recovery/disaster.py`
4. `packages/recovery/retention.py`
5. `packages/recovery/runbook.py`
6. `packages/recovery/__init__.py`
7. `tests/persistence/test_f14_operations_repository.py`
8. `tests/recovery/test_f14_disaster.py`
9. `tests/recovery/test_f14_retention.py`
10. `tests/recovery/test_f14_runbook.py`
11. `tests/integration/test_f14_postgres_compat.py`
12. `docs/04_test_reports/F-14_COMPLETION_REPORT.md`

범위 변경이 필요하면 제품 파일을 임의로 추가하지 말고 Main에 근거와 요청 경로를 보고한다. 승인된 기능·요구사항·중요 위험을 바꾸지 않는 내부 경로 조정은 Main이 WorkInstruction revision·hash·lease를 갱신한다.

## 구현 순서와 완료 조건

1. 기존 `0015_agent_team_owner`에서 단일 `0016` expand-compatible migration을 추가한다. F-13 `OperationsRepository.load/append(expected_sequence)`의 project+environment 단위 원자 CAS와 append-only audit을 PostgreSQL에서 구현하고 같은 repository를 쓰는 재인스턴스가 상태를 복원한다. token·secret 값은 DB event나 응답에 저장하지 않는다. 기존 테이블을 삭제·재작성하지 않는다.
2. backup/restore manifest는 Git SHA, DB migration head, PostgreSQL major/image digest/extension, schema·event sequence, artifact raw checksum, actor·시각·환경을 결박한다. 단순 `pg_dump` 성공·목록 확인을 복원 PASS로 승격하지 않는다. 대상 DB에 재생한 뒤 project/run/approval/progress 및 terminal Run의 학습·감사 계보를 원본과 대조한다. 불일치·누락·다른 commit/digest/head는 fail closed다.
3. artifact retention은 참조된 checkpoint/evidence/audit 원본과 유효 보존 기간을 보호한다. 삭제 실행은 하지 않는 dry-run/policy decision을 우선 구현한다. 데이터 손실 가능 migration downgrade/rollback은 사람의 유효한 결정 subject가 없으면 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 차단한다.
4. 화면 비의존 runbook API는 backup, restore 검증, migration rehearsal, rollback decision의 상태·입력·증거·next action을 구조화한다. 공개 `/api` route나 운영자 CLI 노출은 추가하지 않는다. 실제 화면은 U-10 이후이며 기본 운영 ASGI 자동 결선도 주장하지 않는다.
5. 단위·계약·migration 회귀 후 Main이 WSL-server에 Git exact SHA로 격리 checkout과 별도 임시 PostgreSQL 15/18 검증 자원을 만든다. 기존 `local-postgres`, 다른 프로젝트 DB/container, ysna `shared-db`는 변경하지 않는다. 임시 DB의 upgrade, 복원, 검증, 안전한 downgrade·차단 판정, 정리를 실측한다. F-17/F-20 Release Candidate/운영 승격 검증은 별도로 남긴다.

## 금지·보고

- 실 DB 백업/복원을 기존 운영 데이터에 직접 적용하지 않는다. WSL-server는 `ssh WSL-server`로만 접근하고, Docker·PostgreSQL은 WSL-server에서만 사용한다. 원격 source patch/scp, credential 원문 출력, 전역 환경변수 등록, force push, 새 작업 branch 생성 금지.
- 실제 PG15/PG18·컨테이너/이미지·브라우저·Provider/운영 검증을 실행하지 않았으면 `NOT_EXECUTED`로 명시한다. key 오류 단독은 제품 결함으로 판정하지 않는다.
- 완료보고에 시작 HEAD/status, 기준 hash, diff exact12, 테스트 명령/exit, 3회 정식 실패 횟수, 미검증, residual resources, rollback, progress/HANDOFF 갱신 여부를 판정→근거→조치 순으로 기록한다. Main 독립 리뷰와 최종 G-05, PR/merged-main smoke 전 acceptance를 주장하지 않는다.
