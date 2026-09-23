# D-07 WorkInstruction — Skill catalog L0/L1/L2 progressive loader·사용 기록

## 1. 식별·권위
- Work Package: `D-07`; 선행: `D-Learning Gate ACCEPTED`
- 기준: `Anvil_설계서_v2.md` 36.9~36.10, 46.16-1~2, 48.9; 작업계획 D-07
- 검증: `AV-LRN-015`, `AV-LRN-016`; 구현자: `developer-primary-d07-r1`

## 2. 목표
D-06에서 사람 승인·활성화되고 다음 Task/Run에 선택된 Skill만 L0 catalog에 노출하고, 선택 뒤 L1 `SKILL.md`
전체를 읽으며 본문이 명시한 reference/script/example만 L2로 지연 로드한다. 선택·로드·사용 결과 계보를 남긴다.

## 3. product exact write scope
- `packages/knowledge/__init__.py`
- `packages/knowledge/skills.py`
- `packages/api/skills.py`
- `tests/knowledge/test_skills_d07.py`
- `tests/api/test_skills_d07.py`
- `docs/04_test_reports/D-07_COMPLETION_REPORT.md`

## 4. 필수 계약
1. Skill은 D-06 ACTIVE activation ID/version/hash, candidate/review/source lineage와 exact next-run selection에 결박한다.
2. immutable Skill version은 name, description, tags, scope, status, trigger/exclusion, risk, capabilities, `SKILL.md` body/hash,
   L2 resource 목록·hash를 가진다. payload가 activation/source/approval을 자가 부여할 수 없다.
3. L0는 name/description/tags/scope/version/hash/status와 안전한 trigger metadata만 반환하고 body·resource content를 노출하지 않는다.
   세션 catalog 전체는 최대 2,000 token 상당의 결정론적 예산을 지키며 초과는 명시적으로 잘라 기록한다.
4. matcher는 L0에서 task/scope/trigger/exclusion을 함께 평가해 deterministic 최대 N개만 후보화한다. exclusion이 우선한다.
5. implicit 호출은 ACTIVE, exact selection, trigger match, exclusion miss, low-risk/read-only/no external-send인 Skill만 허용한다.
   고위험·write·network·secret·external-send Skill은 explicit invocation 또는 별도 사전 승인 없이는 선택하지 않는다.
6. explicit 호출도 다른 scope/version/hash, inactive/rolled-back/quarantined/revoked activation, 현재 Run 미선택 Skill을 우회하지 못한다.
7. L1은 선택된 Skill의 `SKILL.md` 전체 body와 hash를 한 번에 반환하며 부분 읽기·다른 version alias·선택 전 로드를 차단한다.
8. L2는 L1 본문 manifest가 명시한 exact resource path/kind/hash만 명시 요청으로 반환한다. catalog/match/L1이 L2 content를 암시 로드하지 않는다.
9. source revoke/license/security quarantine 또는 D-06 rollback 뒤 신규 catalog/match/L1/L2/use를 즉시 차단하고 과거 사용 audit은 보존한다.
10. usage는 selection→L1/L2→Task/Run→success/failure·evidence를 결박하며 replay/concurrency에서 canonical하다.
11. API는 catalog/match/select/load-l1/load-l2/record-use의 authenticated host-context adapter만 제공하고 raw authority·approval을 받지 않는다.
12. 실제 filesystem Skill 디렉터리, script 실행, Skill evolution/create/patch/split/merge/archive는 D-08 이후 범위다.

## 5. 검증·보고
- implicit 비대상·exclusion·고위험 Skill 미로드, explicit도 scope/selection/revoke 우회 차단
- L0 body/L2 비노출·예산, L1 전체 body, L2 명시 exact hash만 로드
- selection/usage replay·concurrency·source revoke/rollback 회귀
- focused 두 test, `tests/knowledge tests/api`, compileall, diff-check
- 실제 filesystem/script/DB/HTTP/browser/deployment는 미실행으로 기록

## 6. 완료 후
Main 독립 검토 전 ACCEPTED가 아니며 D-08을 시작하지 않는다.
