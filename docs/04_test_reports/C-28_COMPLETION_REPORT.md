# C-28 완료보고 — developer-primary-c28-r1

## 판정

`COMPLETED` — 승인된 mockup/interaction contract 산출물과 기본 검증 완료. focused32/관련 비네트워크 UI41/JSON contract/syntax/diff-check PASS. **사용자 확인 PENDING, 실제 browser 검증 NOT_EXECUTED, C29 연결 BLOCKED_USER_CONFIRMATION**을 유지한다. Developer 완료는 사용자 인수·독립 acceptance·운영 UI 완성이 아니다. formal FAILURE_REPORT0.

## 판단 이유 / 기준선

- cwd `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`; branch `codex/c09-execution-backends-r1`; HEAD `98e218264bf54db04a1bd35a67273b713805a649` 실제 확인.
- WI `docs/work_orders/C-28_WORK_INSTRUCTION.md` SHA256 `480B701EC789BC1517DA50425C08203BF4286E2C94FCC9A1DE68582F97C094E6`; prompt SHA256 `166C8C790A2ED87B82E15F0E7A5F1471DFDEC1A5387E13E4C76BB07D7AD71207`. 두 파일 전부 읽기.
- 권위: 설계 §51.3~51.5, 계획 C28, baseline `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`.
- 최초 host14:28:55 KST에는 lease 발효 전이고 projection scope에 불필요한 `packages/agent_team/__init__.py`가 포함되어 있었다. mutation0 상태로 Main에 보고했다. Main이 exact7 projection을 정정했고 **2026-09-19T14:30:06+09:00**에 발효/exact7 일치를 재확인한 뒤 테스트 작성했다. 이 통제 경계 확인은 정식 제품 실패가 아니다.
- seq1247, worker `worker-lease-c28-r1-20260919-001`, execution `c28-r1-execution-fence-epoch-1-98e218264bf54db0`; write `write-lease-c28-r1-20260919-001`, write fence `c28-r1-write-fence-epoch-1-98e218264bf54db0`; window `2026-09-19T14:30:00+09:00`~`2026-09-20T02:30:00+09:00`.
- 기존 dirty/untracked와 C22~C27 제품·exports·control은 보존했다. C28 exact7 신규 산출물만 작성했다. stage/commit/push/merge/progress/HANDOFF/control 수정0.

## 조치 / exact7

| 경로 | 변경 |
|---|---|
| apps/web/c28-agent-console-mockup.html | 기존 UI와 분리한 mockup 진입점, local relative assets, connect-src none CSP |
| apps/web/src/app/c28-console.js | 순수 state/reducer/view/render 및 mockup-only click/keyboard 연결 |
| apps/web/src/styles/c28-console.css | 1920 우선 12px 운영 Console, 4메뉴/sidebar/cards/table/dialog 및 responsive 규칙 |
| apps/web/tests/c28-console.test.mjs | 32 UI contract/adversarial/interaction 테스트 |
| docs/evidence/ui/C-28_MOCKUP_EVIDENCE.md | 산출물 hash·검토 동선·미검증·사용자 확인 PENDING |
| docs/evidence/ui/C-28_INTERACTION_CONTRACT.json | C22~C27 owner mapping, C29 GET 상대경로 후보와 미구현/확인 gate |
| docs/04_test_reports/C-28_COMPLETION_REPORT.md | 본 보고서 |

### 계약 / 구현 판단

- 기존 C22~C27 DTO/API를 변경하거나 재구현하지 않고 화면에 표시할 read-only 의미를 매핑한다. 실제 owner service 호출은 없다. mockup 레이아웃의 역할 행은 명시적 예시이며 실제 Agent 실행이나 운영 데이터가 아니다.
- Team: 5역할/권한 차등, owner-role 대화 자리, parent-child trace, provider/model/artifact/evidence/deploy readiness. MoA: proposal/critique/synthesis/provenance 및 Main 통합 경계. SNS/Daon: identity/permission/session/receipt/privacy/delivery. 보조 채널: Telegram intent-only와 Kakao OPEN_DECISION.
- 상태 ready는 `LAYOUT_EXAMPLE_NOT_RUNTIME_READY`다. permission/error/empty/offline은 별도 설명과 차단을 표시하고, 미검증/빈 상태를 성공으로 승격하지 않는다. quota 미보고는 `Quota not reported`다.
- Pause/Resume은 notice `REQUESTED_NOT_APPLIED`만 설정한다. 고위험 클릭은 dialog, 확인은 `HUMAN_APPROVAL_REQUIRED`만 표시한다. 실제 승인·release·apply·deploy·Run 변경·전송0. 확인 버튼은 사용자 mockup 인수 증거도 생성하지 않는다.
- same-origin 경로 후보4개는 JSON에서 `PROPOSED_NOT_IMPLEMENTED`로 명시한다. 기존 BFF/router/API/UI 진입점에 연결하지 않았다. path validator는 absolute URL, protocol-relative, backslash, traversal/encoding/query를 거부한다. HTML은 로컬 상대 script/style만 사용하고 CSP connect-src none이다.
- 반환 state/view는 frozen이며 allowed enum 외 입력과 accessor property를 거부한다. JS Proxy 일반 sandbox를 제공한다는 주장은 하지 않는다. 모든 동적 HTML 값은 제한된 state 또는 escaped constant를 사용한다.
- reducer/render는 실제 함수, mount tests는 최소 DOM boundary fixture다. 따라서 클릭/키보드 handler 로직 증거이지 실제 browser 렌더·접근성·Network 증거가 아니다. Shift+Tab 초기 dialog focus 이탈을 실제 RED로 고정한 뒤 동일 key handler에서 수정했다.
- 사용자 확인은 PENDING/evidence_ref null/confirmed_target_hash null. Main이 정확한 artifact hash와 실제 사용자 확인 evidence를 결박하기 전 C29 연결을 시작할 수 없다.

## TDD / 정확한 명령 및 결과

런타임 `C:\Program Files\nodejs\node.exe`, `node --version` = `v24.18.0`. cwd는 위 canonical root.

Focused:

```text
node --test apps/web/tests/c28-console.test.mjs
```

| 단계 | exit / 결과 |
|---|---|
| 초기 RED | 1 / 0 PASS, 29 FAIL, 87.0486ms; C28 interaction module missing |
| 최소 GREEN | 0 / 29 PASS, 94.2375ms |
| mount/keyboard 보강 RED | 1 / 31 PASS, 1 FAIL, 93.3371ms; 초기 dialog Shift+Tab 시 last focus 미이동 |
| 최종 focused GREEN | 0 / **32 PASS, 0 FAIL, skip0, 92.4529ms** |

TDD/systematic-debugging 절차가 초기 handler의 포커스 경계 보완에 영향을 주었다. RED/내부 보완은 formal FAILURE_REPORT가 아니며 count0이다.

관련 비네트워크 UI 회귀 — exit0 **41 PASS, 0 FAIL, skip0, 129.0994ms**:

```text
node --test apps/web/tests/c28-console.test.mjs apps/web/tests/app-shell.test.mjs apps/web/tests/ui-preview-model.test.mjs apps/web/tests/ui-preview-shell.test.mjs
```

Node의 기존 root package.json `type` 미지정으로 `MODULE_TYPELESS_PACKAGE_JSON` 경고가 나온다. 기존 모듈에도 같은 경고가 있으며 실행 실패가 아니다. 범위 밖 package.json은 수정하지 않았다.

JSON contract 검증 — exit0 `JSON CONTRACT PASS: 4 inert relative routes; user confirmation PENDING; IO0`:

```text
node --input-type=module -e "import {readFileSync} from 'node:fs'; import {sameOriginPath} from './apps/web/src/app/c28-console.js'; const c=JSON.parse(readFileSync('docs/evidence/ui/C-28_INTERACTION_CONTRACT.json','utf8')); if(c.schema!=='c28-interaction/v1'||c.user_confirmation.status!=='PENDING'||c.user_confirmation.evidence_ref!==null||c.integration.status!=='BLOCKED_USER_CONFIRMATION'||c.handoff.length!==4)throw Error('CONTRACT_INVALID'); for(const r of c.handoff){sameOriginPath(r.path);if(r.status!=='PROPOSED_NOT_IMPLEMENTED'||r.method!=='GET')throw Error('ROUTE_INVALID')} console.log('JSON CONTRACT PASS: 4 inert relative routes; user confirmation PENDING; IO0');"
```

구문 및 diff — exit0:

```text
node --check apps/web/src/app/c28-console.js
node --check apps/web/tests/c28-console.test.mjs
git diff --check
git diff --cached --name-only
```

staged0. Python compileall은 JS/HTML/CSS package에 해당하지 않으므로 Node 구문검사로 대체했고 이를 browser build PASS라고 표시하지 않는다.

Canonical checker — exit1, NOT_VERIFIED/NOT_PASS:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
```

기존 `scripts/check_project_progress.py:32957` 과거 C03 embedded fixture 문자열의 `SyntaxError: leading zeros in decimal integer literals are not permitted; use an 0o prefix for octal integers`. Main 소유 파일을 수정하지 않았고 테스트 PASS로 대체하지 않았다.

## 미검증 / 다음 조치 / rollback

- 실제 browser/screenshot/pixel/responsive/accessibility/Network 검증 및 사용자 확인 NOT_EXECUTED. static module preview hosting/file URL 로딩도 미검증이다. mockup evidence는 산출물·Node 계약 증거로만 명시했다.
- 실제 BFF/API/HTTP/DB/WSL/Provider/Telegram/Kakao/Oracle/deploy0. 실제 HTTP server를 여는 UI runtime/proxy tests 및 repository 전체 Python suite는 이번 UI-only 범위에서 실행하지 않았다. 41건을 전체 제품 Gate로 승격하지 않는다.
- C29 진입 전 Main이 정확한 mockup을 사용자에게 제시하고 확인 evidence를 기록해야 한다. 같은 시점에 기존 checker 복구와 독립 검토도 Main 소유다. Developer는 C29를 시작하지 않았다.
- rollback: Main 검토하에 C28 신규 exact7 산출물만 제거/되돌림 대상으로 삼는다. 기존 web/index/server/model/styles와 C22~C27/control/dirty/untracked는 보존한다. reset/clean/stash/광범위 삭제 금지. 본 작업에서 cleanup·rollback 실행0.

## SHA256

| 경로 | SHA256 |
|---|---|
| apps/web/c28-agent-console-mockup.html | 12118D77CC0C66E22D15D90B5670CAFD5DA3A990A6DE7A6579E3FEAE81850706 |
| apps/web/src/app/c28-console.js | A64E11E2C4FE7265D6E413656F244CFD9267F9CBF485D04D8E4C205ED5380AED |
| apps/web/src/styles/c28-console.css | 7BC97363164528121AEE800AC9BAE0BF50791D1C8EF0136A826CBFCE93583A43 |
| apps/web/tests/c28-console.test.mjs | 4EA9E60DCCE58989158811ADB6A3A16C1C6911A7B11ED1271AF21367E427717F |
| docs/evidence/ui/C-28_MOCKUP_EVIDENCE.md | F5E5C3820F60A7DB1CCC60A92DEE7D2AC4FC8EF5DEA201A207B51D80C8BE02C4 |
| docs/evidence/ui/C-28_INTERACTION_CONTRACT.json | 2A1E5473B85B0D2AC4826B37C1CCF3B35082E56DF3F8C02C70950572E50FE9E8 |

보고서 자체 hash는 최종 응답에서 제공한다.
