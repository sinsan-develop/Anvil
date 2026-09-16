# D-08 WorkInstruction — Skill create/patch/split/merge/archive evolution

## 1. 식별·권위
- Work Package: `D-08`; 선행: `D-07 ACCEPTED`
- 기준: `Anvil_설계서_v2.md` 36.11~36.12, 46.16, 48.9; 작업계획 D-08
- 검증: `AV-LRN-017`; 구현자: `developer-primary-d08-r1`

## 2. 목표
D-05 Reflection과 D-06 learning candidate 계보를 받아 기존 D-07 Skill version을 대상으로
`create | patch | split | merge | archive` 후보를 결정론적으로 stage하고, static/security/permission 검사,
과거 Run replay, 최소 3개 대표 작업 sandbox pilot, baseline 비교, 사람 승인 또는 사전 신뢰된 저위험 patch 정책을 거쳐
오직 다음 Task/Run LearningSnapshot부터 활성화한다. 모든 version·snapshot·rollback 계보는 불변으로 남긴다.

## 3. product exact write scope
- `packages/knowledge/__init__.py`
- `packages/knowledge/skill_evolution.py`
- `packages/api/skill_evolution.py`
- `tests/knowledge/test_skill_evolution_d08.py`
- `tests/api/test_skill_evolution_d08.py`
- `docs/04_test_reports/D-08_COMPLETION_REPORT.md`

## 4. 필수 계약
1. 후보는 D-05 review/reflection, D-06 candidate/source/approval lineage와 target Skill id/version/content hash에 결박한다.
   요청 payload가 source, approval, trust, actor, pilot 결과를 자가 부여할 수 없다.
2. action은 `create | patch | split | merge | archive`만 허용한다. 같은 목적 없음+반복 재사용 증거는 create,
   procedure/pitfall/verification 보완은 patch, 과대 trigger는 split, 실질 중복은 merge, 유효성 상실은 archive로 분류한다.
3. 모든 변경은 immutable before/after version과 diff, 근거, 예상 재사용 범위, security/secret/permission 검사 결과를 가진
   pending candidate로만 stage된다. 후보 생성만으로 catalog·현재 Run 행동을 바꾸지 않는다.
4. version 의미는 설명·pitfall·verification 보완=`PATCH`, trigger·지원 작업 확대=`MINOR`, 입출력·권한·결과 계약 변경=`MAJOR`로 강제한다.
5. replay/pilot은 동일 baseline과 candidate를 비교하고 품질·비용·trigger precision/recall·regression·permission drift를 기록한다.
   새 Skill 최초 활성화에는 서로 다른 대표 작업 3개 이상의 PASS, 재현성, secret scan, 권한 적정성이 모두 필요하다.
6. 기본 `review_required`와 `observe_only`는 사람 승인 전 활성화하지 않는다. 승인 주체·subject hash가 일치하지 않거나
   만료/철회/다른 candidate approval이면 거부한다.
7. `trusted_auto`는 이미 사람 승인·활성화된 기존 Skill의 기존 신뢰 범위 안에서 의미·권한·trigger 범위를 확대하지 않는
   저위험 PATCH만 허용한다. create/split/merge/archive, implicit trigger 확대, scope 확대, tool/write/network/secret capability 확대,
   script 추가·변경, Hook/permission/policy 유도, regression/evidence 부족은 항상 사람 승인 대상으로 남긴다.
8. 활성화는 현재 Task/Run snapshot을 변경하지 않고 exact next Task/Run selection에 한 번만 반영한다. catalog head 경쟁은
   compare-and-swap으로 처리하며 replay/concurrency에서도 이중 활성화하지 않는다.
9. rollback은 활성화 직전 immutable snapshot으로 복귀하고 해당 version을 사용한 Run과 영향 범위, 실패 evidence를 반례로 연결한다.
   archive는 자동 삭제가 아니며 `trusted_auto`로 수행하지 않는다.
10. source revoke/license/security quarantine은 후보 평가·활성화·next-run selection을 차단하고 이미 진행 중인 Run은 기존 snapshot으로 격리한다.
11. API는 propose/evaluate/record-pilot/approve/activate/rollback/archive 조회의 authenticated host-context adapter만 제공한다.
    raw authority·approval·trust·actor를 body에서 받지 않는다.
12. Hook 생성·실행, 실제 filesystem pending directory, DB/HTTP/browser/deployment, 신규 Skill `trusted_auto` 활성화는 범위 밖이다.

## 5. 검증·보고
- create/patch/split/merge/archive 분류, immutable version/diff/staging, 잘못된 단일 행동·모델 추측 후보 거부
- 새 Skill 무승인/2개 pilot/secret·permission 실패 활성화 거부, exact 3+ pilot+사람 승인 활성화 및 다음 Run 반영
- trusted_auto 허용 저위험 PATCH와 create/split/merge/archive·권한/trigger/script 확대 거부
- concurrent activation one-shot, source revoke/quarantine, rollback snapshot·영향 계보
- focused 두 test, `tests/knowledge tests/api`, compileall, diff-check
- 실제 filesystem/DB/HTTP/browser/deployment와 Hook 실행은 미실행으로 기록

## 6. 완료 후
Main 독립 검토 전 ACCEPTED가 아니며, D-Skill Gate는 D-07~08 완료·3+ pilot/replay·사람 승인·rollback 증거를 모두 확인한 뒤에만 판정한다.
