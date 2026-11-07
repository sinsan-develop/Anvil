# FN16 책임 역할·예약 세션·binding 이력 결과

2026-10-29 / codex/av3-stage-b / 내부 source·합성 검수 완료, 전체 FN16 미완료

## 판정·근거

- WI `docs/work_packages/FN16_RESPONSIBLE_SESSION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md`, SHA256 `AE754C6CE502E16E0A2B4B765D1C4D6EB805AF2CEB8041C4C3F2FE3E637E19F9`.
- 시작 HEAD `a4f10b575486382899d1e424edccb45b2daabf1c`, 같은 승인 branch. 기존 보호 untracked8은 수정·stage하지 않았다. Main은 문서·검수·통합, fn16_primary는 신규3파일 단독 writer, fn16_review는 읽기 독립검수다.
- 역할 정의, 예약 세션과 binding 전체 버전, 선택 확정 임무·AUTO/일회소비 증거를 단일 RR에서 수집한다. 최초 session/binding의 공유 명령은 정상으로 보존하며 후속 binding의 actor 변경과 과거 소비를 현재 권한으로 재판정하지 않는다.
- 원 snapshot/명령 hash·국소 auth/audit를 검증한 뒤 actor/client를 익명 투영한다. RESERVED/CANDIDATE_ONLY·실행false 및 미검증 경계를 보존한다.

## 변경과 검증

신규 구현은 다음 세 경로뿐이며 기존 producer/SQL/시험 기대는 바꾸지 않았다.

| 파일 | 최종 SHA256 |
|---|---|
| apps/server/modules/backups/responsible-session-inventory.ts | B5883116BEF97BB88651CB51CDC9D53C24A39D67C9168427D24306A08366438E |
| tests/unit/FN16/responsible-session-inventory.test.ts | B3A763F7FF51BB5CB4FE39D6E48D4E5F0C9B9DECD2D1F600CB140C5AB7637FAA |
| tests/unit/FN16/responsible-session-inventory-schema.test.ts | 26ED2B9B0F2371A276A6F2E0BAA1832C24C92C74F1ED0A56AC91EEF574A56269 |

- Primary 0e5728: 미구현 source RED exit1. 최초09d3f8은 시험 harness 문자열 오기였고 교정 후 RED를 구분했다.
- 독립 시험 I1: 명령 중복/previous/connection 반례가 승인 불일치에서 먼저 거절될 가능성. AUTO 사례로 원 요청을 재결박한 두 시험 추가. M1: 두 사용자에 같은 client를 배정한 fixture를 사용자별로 교정. 조건 완화 없음.
- Main d56a05: 초기15 PASS/0 FAIL/skip0/971.8716ms. 최종 독립검수에서 요청 시각에 대한 소비 하한 I1 발견. 책임세션의 기존 계약에 없는 ownership 전용 조건 이월이었다.
- 정상 요청 시각 역전 반례 962bef: 1 FAIL/503/359.2593ms. source에서 추가 하한43자만 제거했다. 기존 소비≥결정시각·소비<만료시각, 사건 내부 일치와 감사 순서는 유지했다.
- **Main d43e83:** `node --test --test-reporter=tap tests/unit/FN16/responsible-session-inventory.test.ts tests/unit/FN16/responsible-session-inventory-schema.test.ts` → **16 PASS/0 FAIL/0 SKIP/843.1784ms, exit0**.
- 같은 최종 source에서 `npm run typecheck` exit0, `git diff --check` exit0, 3지문 일치.
- 독립 최종 scoped C0/I0/M0, 두 I1·M1 해결. 삭제한 하한만 되붙인 메모리 SHA가 직전 source35508956과 일치해 제품 변경 한 곳임을 확인했다.
- Main 76b749/b3f653/adc5ac의 전체 source·최종반례 읽기와 실제0016/0049/producer 대조를 수행했다. schema 시험은 실제 PostgreSQL 실행 증거가 아니다.

## 미검증·잔여·rollback

- 실제 DB/RLS/0049 적용·FS/원문·키·서비스·Agent 실행은 NOT_RUN, 변경0. 새 migration/API/runtime 호출선은 없다.
- 현재 connection/policy/assignment evidence 검증은 NOT_PERFORMED. 전체 승인·실행·provider 이력, 암호화 archive/복원·사용자 백업 화면 인수는 미완료다. `fullProjectCoverage/restorable/executionAuthorized/dispatchPerformed=false`를 유지한다.
- 실제 사용자 화면에서 새 백업 기능을 사용할 수 있게 됐다고 주장하지 않는다. 다음은 작업문맥·실행준비 이력의 누락을 확인하며 수동 정책 후보158E10BC 결정과 분리한다.
- rollback은 신규3파일 해당 변경을 정상 후속 commit으로 되돌리는 범위다. 실제 데이터 rollback은 없다. 보호8·P03 원/R1/R2 자료는 대상 밖이다.
- WORK_STATUS와 WORK_PLAN에 이 단위·오류·검수·미검증을 누적 기록했다. branch-only 결과이며 main 통합·전체 계획 완료가 아니다.
