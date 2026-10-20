# FN02 빈 프로젝트 적용 전환 — 저장 보호 차이와 후속 검수

## 2026-10-20 후속: code-only 정식 채택·명시 등록 후보

PMO는 기존 승인 FN02의 실제 사용 연결을 위한 이 source 후속을 위임 범위로 확인했다. 앞선 runner등록0은 당시 범위/실행 사실이며 영구 금지가 아니다. 아래 과거 후보·미실행 기록과 원 지문은 소급 변경하지 않는다.

- 기존 `.sql.pending`는 보존하고 같은 바이트의 `0031_empty_project_methodology_application.sql`을 추가했다. 두 SHA256은 모두 E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6이다. SQL 본문·기존 SQL/권한·guard·과거 snapshot·실제 DB는 변경0.
- 새 `scripts/fn02-method-application-migration.ts`는 기존 legacy44+sourceRoot/sourceRead2+0012~0017 여섯 개의 **정확52 선행**을 명시한다. 실경로/SQL root·각 checksum·후보 E9를 대조하며 누락/추가/중복/지문 불일치·지원 밖 future 상태는 DDL 전에 거절한다. 정확52일 때0031 SQL/기록만, 정확53 재호출은 DDL0. 선행을 자동 적용하거나 glob으로 찾지 않는다.
- 기존 세 경로 중 source-root-migration.ts/기존 SOURCE_ROOT_REGISTRY_ONLY와 source-read-migration.ts는 유지한다. migrate-development.ts에 **명시적인** ANVIL_MIGRATION_MODE=FN02_METHOD_APPLICATION_ONLY만 추가해 기존 대상 확인/BEGIN/advisory lock 안에서 새 helper를 소비하고 COMMIT한다. 이 분기에는 seed/계정/fixture0이며 default45·기존 mode의 목록은 그대로다. 보호 config 없이 닫히는 기존 동작도 보존한다.
- 현재 정식 schema의 마지막 보존 기록은46이며 PG는exited다. 최신 schema를 live 조회한 것이 아니다. QA53을 정식의 현재 상태로 간주하지 않는다. 이 후보를46에 호출하면 누락 선행으로 거절해야 하며46→53 일괄 적용·서비스 재개·실제 사용자 정책·Agent 실행 허가가 아니다.
- 신규 함수 부재4RED125.0284ms→신규4/직접 기존5 9PASS1298.3009ms. CLI mode/config 기대 거절과 후보 뒤 future 상태 거절을 추가해10PASS2249.67ms. 테스트 env 추론 type 오류1은 명시 ProcessEnv로 정정하고 fresh typecheck exit0. DB 실행/COMMIT 증거로 승격하지 않는다.
- 기존 pending 배선 검사의 소스 문자열 부재는 새 helper를 통한 간접 명시 등록 부재를 증명하지 않는다. 과거 결과는 당시 사실로 보존하고 이번 등록 동작은 새 manifest/거절·재호출/정확 SQL 소비 검사로 구분한다. 기존 검사 삭제·기준 완화0.

최종 code-only 독립 검토 C0/I0/M0, 신규5·직접 기존5·기존 pending 배선4 총14PASS2183.861ms·fresh type0·diff0다. SQL 두 파일은 각각35477bytes/E9, helper190441A5756967F535A911EADDAECCDEB8B01D6CD15226AF7BA86ABDBC8F6A9D, runnerECA900DDD9895F12EFE128DDA2E81F4813CBB9E3B016040E02A2A96988A7321D, 시험6C3982B2F66CECE6522CBADDD1D623492515050519E0CD0F5A99353D6EB6C116다. 검수자는 실제 시험을 실행하지 않았고 source 검토만 했다.

정식 DB 접속/forward 실행·서비스 시작·기존 특정 거절/미채택 계약 해제는0이다. 신규 정식 helper의 실제 PG 적용/COMMIT·동시 재호출·객체 정의/파일 교체 경쟁은 미검증이며, 앞선 pending SQL 시험을 새 runner 실행 증거로 전용하지 않는다. 별도 실행은 정확 게시 후보와 정식 현재 manifest·백업·영향/복구·명령/플랫폼 승인을 대조한 후에만 수행한다.

- 담당: Main 어울. 2026-10-20, 기존 Stage B/FN02 구현의 부분 작업이다.
- 상위 범위: `docs/contracts/INTERFACES.md`의 `applyMethodology(methodologyRef,expectedApplicationVersion,reason)` 및 FN02 카드. 새 Agent/계정·방법론 기능을 제안하지 않는다.
- 상태: 서버 source 후보·합성 DB 검수 및 새 **미적용** forward 후보 작성. `0031_empty_project_methodology_application.sql.pending`는 실제 runner 등록/실행/정식 적용 0이며 실제 DB/양성 COMMIT/served 미검증이다. 아래 내용은 현재 SQL의 실행 허가나 이미 적용된 보호가 아니다.

## 1. 현재 구현과 필요한 제한

기존 `/api/v1/projects/:projectId/commands`의 `applyMethodology`만 사용한다. `targetId=projectId`, `expectedVersion=expectedApplicationVersion`으로 현재 적용 세대를 CAS한다. 현재 HUMAN·OWNER/client/control·별도 명시 정책은 기존 command transaction을 사용한다. 추가 baseline/approval 참조를 이 기능이 임의 해석하지 않는다. REQUIRE_APPROVAL의 기존 미연결 거절을 AUTO로 바꾸지 않는다.

현재 source는 같은 project/control 잠금 안에서 `assignment_drafts`, `execution_preparations`, `agent_sessions`, `executions`, `execution_grants`, `writer_claims`, `execution_commands`의 **실제 부재**를 한 번에 조회한다. 하나라도 있거나 결과가 불명이면 `EXECUTION_STATE_UNVERIFIED`다. 만료/회수/완료 상태를 빈 이력으로 간주하지 않는다. `assignment_drafts=0`에서 다른 원장 부재를 추론하지 않는다.

고정 적용본 hash·현재 세대, 프로젝트 전용 방법론의 현재 head/hash·확정·최신 ACCEPTED 검토의 확정 포함·prepared forms를 확인한다. 새 UUID/적용세대/snapshot만 append하고 기존 snapshot을 갱신하지 않는다. 적용 이유는 snapshot 형식을 바꾸지 않고 불변 commands receipt data에 보존한다. 이 작업은 Agent 실행·기존 실행 재개·writer 회수 검증이 아니다.

## 2. 현재 SQL이 양성을 막는 정확 지점

`0011_project_creation.sql`의 `guard_initial_project_methodology`는 createProject 사건·최초 세대 1만 허용한다. 현재 후보를 실제 DB에서 실행하면 그 guard를 통과했다고 주장할 수 없다. 현 SQL을 수정하거나 transaction 설정으로 createProject를 위장하지 않는다.

정상 서비스의 project/control 잠금만으로 직접 DML 경합까지 보장하지 않는다. 특히 `0012_assignment_drafts.sql`의 기존 직접 INSERT guard에는 명시 project 잠금이 없고, `0017_execution_authority.sql`에는 assignment FK가 없는 실행/grant 경로가 있다. 합성 resolver의 반환값을 실제 빈 이력/OS 안전의 근거로 쓰지 않는다.

## 3. 필요한 forward 보호 diff — 후보 작성, 미적용

1. 기존 SQL 파일·초기 createProject 분기·UPDATE/DELETE 금지·과거 행을 보존한다. 새 파일명/순서는 실제 runner와 현재 migration 목록을 대조한 뒤 정한다.
2. project_methodologies INSERT guard에 별도 `applyMethodology` 분기를 추가할 경우, 현재 actor/client/control/policy, exact 원 command/request hash·receipt·감사, 목표/적용 세대 CAS, 정확 확정/최신 검토·양식, 7원장 부재, snapshot/ref/이전 적용 ref/사용자 reason을 **같은 transaction**에서 다시 결박해야 한다. 단순 operation 문자열만 허용하지 않는다.
3. 역방향 deferred COMMIT 검사로 APPLIED apply command에는 정확히 1개의 일치하는 새 적용 행이 있어야 한다. receipt만 남기거나 row만 삽입하는 경로를 막는다.
4. 부재 검사와 경합하는 직접 DML에는 동일 프로젝트 잠금 순서를 먼저 적용해야 한다. 후보 대상은 위 7원장의 INSERT 경로다. 기존 guard를 우회하지 않고 trigger 실행 순서·다른 정상 command·초기 생성·다른 프로젝트·deadlock 영향을 검토해야 한다. 추가 보호만으로 기존 execution/preparation 결박 누락을 해결했다고 주장하지 않는다.
5. app DML 권한 범위를 넓히거나 실제 사용자 정책을 자동 부여하지 않는다. 신규 DB 사용자/키·Secret·OS helper·정식 서비스 변경은 포함하지 않는다.

이 diff에는 **기존 DB 쓰기 허용 조건과 직접 DML의 동시성 보호 변경**이 포함된다. 논리 기능은 이미 승인됐지만 실제 forward 작성/채택·격리 실행·정식 적용의 실행 범위는 구분하여 PMO에 정확 근거를 전달한다. 0011을 즉석 완화하거나 source TDD의 PASS로 이 결정을 대신하지 않는다.

## 4. 후속 검수·완료 기준

- source: 정상 append, 7원장 각 단독 존재/불명, 다른 주체/세대·target, stale application/source head, 확정/최신검토/양식 부족, 같은 source 중복, 이유 보존, 동일 명령 replay·충돌, 저장 실패 원자 rollback.
- 격리 PG는 별도 정확 범위/자원 등록 후에만 수행한다. 모든 적용 SQL의 구문/COMMIT, 초기 createProject 불변, 직접 DML의 잘못된 receipt/정책/양식 거절, row-only/receipt-only COMMIT 거절, 동시 적용/직접 임무 INSERT·grant INSERT와의 경쟁을 실제 확인한다. 다른 프로젝트 기존 흐름의 영향도 확인한다.
- 서버 저장 보호가 확인되기 전 UI의 양성 완료나 실제 전환 성공을 표시하지 않는다. 이후 기존 UI03에서 별도 명시 적용·미확인 명령 보존·재조회까지 연결하고 실제 DB/served 상태를 따로 기록한다.
- rollback: 새 소비를 일반 revert로 닫고 과거 snapshot/receipt는 보존한다. forward 적용 이력을 down/DROP/force rewrite하지 않는다.

## 5. 현재 증거

- 신규3 첫 양성 RED/음성2 PASS 392.7712ms → source3 PASS 934.25ms. 음성의 초기 PASS는 기존 무조건412 경로이며 새 양성 구현의 증거가 아니다.
- implicit-any 보정 뒤 재검증 PowerShell 초기화 실패 `0x800705AF`, exit `-532462766`: 그 시도의 tests/type는 미실행이다. OS/pagefile/권한 변경0.
- 같은 설치 경로 Node v24.18.0을 직접 확인하고 cmd로 미실행 집중/직접11 PASS 4855.1594ms·type0. 물리 메모리 여유만으로 PowerShell 원인을 확정하지 않는다. cmd의 초기 인용부호 오류도 제품 실패가 아니다.
- 독립 검토 C0/I1/M0의 적용 이유 소실 → 반환/commands INSERT result_ref 검사 RED391.8935ms → receipt.data.reason 보존 뒤 집중4 PASS287.8512ms·type0·한정 재리뷰 C0/I0/M0. 원 I1 이력 유지.
- `row/read`를 대체한 합성 DB 시험은 실제 원문/검토 영수증·HTTP 인증/정책/replay·실제 PG/경합/COMMIT을 증명하지 않는다. 실제 기능은 여전히 **부분 구현**이다.

## 6. 미적용 SQL 후보의 정확 추가·검수 대상

- PMO는 이전 diff SHA256 `6ADB0929F10728535C86B4E43EFDDA5ACF50DF59F323CB6A68F224F53C419AAD`의 제한을 구현하는 미적용 파일 작성·정적/합성 검수를 기존 FN02 승인 범위로 확인했다. 실제 PG/정식 적용 허가는 아니다.
- 실제 목록의 마지막 적용 후보는 0028이다. 제외된 0029·미채택 r2의 제안 0030을 재사용하지 않고 새 `0031_empty_project_methodology_application.sql.pending`를 작성했다. runner 3파일은 변경하지 않는다.
- 행→명령의 불변 FK/UNIQUE를 위해 `project_methodologies.application_command_id` nullable 열을 제안한다. 과거/초기 생성 행은 NULL, 새 apply 행은 선행 trigger가 exact command로 결박하며 임의 제공 불일치는 거절한다. 기존 INSERT 권한만 소비하고 새 DML/사용자/정책 권한은 부여하지 않는다.
- 기존 초기 guard 함수는 그대로 호출하고 trigger의 apply 분기만 분리한다. 새 AFTER INSERT/양방향 deferred 및 해당 apply 명령 UPDATE/DELETE 거절을 제안한다. 옛 5함수·기존 특정 거절·0029는 변경하지 않는다.
- 동시성 후보는 7원장 INSERT와 적용 INSERT에서 `aa_` 선행 trigger로 같은 project 행을 잠그고, VOLATILE 함수의 별도 SQL로 잠금 뒤 부재를 조회한다. **READ COMMITTED 이외는 40001로 거절**한다. 과거 snapshot을 최신이라고 오판하지 않기 위한 제한이며 실제 DB default·직접 DML/기존 정상 흐름·양방향 race/deadlock 영향은 미검증이다.
- 그래프 소수 좌표가 가능한 기존 계약을 정수용 assignment canonical로 잘못 재해시하지 않도록 별도 `fn02_canonical/hash` 후보를 두었다. 현재 고정 ASCII 객체 키·safe integer/유한 소수를 대상으로 하지만 **PG/JS 경계 수치·문자열/escaping 동등성은 아직 검증되지 않았다**. 문자열 배선 PASS로 대체하지 않는다.
- 현재 SQL은 확정 결과와 최신 검토/검토 포함·양식 원문을 결박하는 후보이며, 실제 위조/구조 검사·영수증 불변성과 기존 경로 독립 검토를 진행 중이다. 지적은 고친 뒤에도 실제 PG 실행 검수와 구분한다.
- 후보 배선 시험 신규3은 파일 부재 RED119.7875ms → 3PASS125.0522ms다. 이는 후보 존재/보호 배선의 문자열 검사이며 SQL 구문·권한·COMMIT·race의 TDD GREEN이 아니다.

후속 검수 이력: 첫 C0/I2/M0의 구조·검토 claim 신뢰와 숫자 GUC 의존을 수용했다. apply 전용 구조/조건/closure·정확 ref·검토 5항목·기준 원문과 receipt를 추가하고 extra_float_digits=1을 함수에 고정했다. 배선 추가1 누락 RED119.6531ms → 총4PASS119.528ms이며 실제 SQL 반례의 GREEN은 아니다. 추가 정적 지적의 PL/pgSQL 변수/SQL 별칭 충돌과 `\\v` escape를 명시 별칭/chr(11)로 보완했다. 원 지적과 미실행은 지우지 않는다.

준비한 `tests/integration/FN02/empty-application-canonical-isolated.test.ts`는 새 전용 Linux UID1000/고정 cwd·DB명·비공개 내부 IP·짧은 기한·Git exact SHA·미적용 후보 checksum·비관리자 역할을 확인한 뒤에만 동작한다. 기존 정식 DB 설정/임의 경로 fallback이 없다. 공식 graph/form·PG/JS 수치/escaping·세션 설정0/3·구조 변조/검토 항목·VT/v 반례를 대조할 코드이며 현재 실행0/typecheck0이다. 정식 서비스·실제 DB 양성 workflow·경합을 확인한 시험으로 보고하지 않는다.
