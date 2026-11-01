# FN06 writer 권위 B·저장 한도 A source 검수 결과

2026-11-02 / Main 어울 / 구현: 기존 Primary / 독립 검토: 기존 Reviewer

## 1. 판정과 정확 범위

코드·미적용 SQL·합성 검증 범위는 검수 합격이다. 실제 DB·권한·키·서비스·Agent 실행·실자료 조사·P03 R3는 수행하지 않았다. 전체 FN06/FN08/Stage B/작업계획서 완료나 사용자 인수가 아니다.

제품 checkpoint: `77352ea8bc90bbfe7f64fd65126b839c9c3a6da8`, 부모 `ecc861121c86138e69b8a7f68edb74d1e893ad69`, branch `codex/av3-stage-b`, 정확10경로·594추가/3삭제. 게시 SHA 및 local/private 대조는 WORK_STATUS의 후속 게시 기록을 따른다. main 병합·배포는 하지 않았다.

기준:
- 부모 B: `docs/contracts/FN06_ACTUAL_WRITER_AUTHORITY_DELTA_CANDIDATE.md` SHA256 BF19670DAF44B01D2EAA12CB4CB8661AB573A77CF6133A5B3EC4FBAD8885533D.
- 저장 A: `docs/contracts/FN06_WRITER_AUTHORITY_STORAGE_LIMIT_DECISION_20261102.md` SHA256 A74FF95EEFB4526D38F678DBAFA07344ECFB518DC3C86519AECE201133D72484.
- 직접 승인: `docs/04_test_reports/AV3/FN06_WRITER_AUTHORITY_SOURCE_APPROVAL_20261102.md` SHA256 63C7EECF3E6C479133E57B4DAB2225C2B474CE5DAD6D65F2771AFD898E397C98.
- WI: `docs/work_packages/FN06_WRITER_AUTHORITY_SOURCE_IMPLEMENTATION_20261102.md` SHA256 AEEF19024FF87327575EA751D48674AF613D34EC5A2D235677F048BD5D511F17. §8은 같은 승인 범위의 비순환 저장 결박 구체화이며 독립 사전 검토 C0/I0다.

## 2. 구현한 내용과 보호한 경계

- 새 event/head 원장 계약·닫힌 DTO/fullref/hash·서로 다른 네 서명 domain, 명시 null bootstrap 및 같은 lease의 생명주기 모델을 구현했다. 두 목적의 서로 다른 원 요청/nonce/관측을 대조하며 현재 head와 최신 append tip을 구분한다.
- 최초 boundary, 보호 current, revoke 및 connector 관측의 source-only 입구를 연결했다. 기본 buildApp은 미등록이며, 명시 검수 의존성에서도 실제 공급자가 없으면 닫힌 UNAVAILABLE다. 현재 로그인/OWNER/단독 제어/명시 정책·일회 승인·기한 검사는 유지한다.
- 메모리 모델에 그치지 않고 같은 authenticated transaction에서 기존 원명령·허가 영수증·감사·일회 소비와 새2표 append/head CAS·재조회를 연결하는 PG adapter source를 작성했다. 미래 event/head가 없는 불변 intent로 hash 순환을 피하고 실제 server command/receipt/audit fullref를 사건에 결박한다. 원 replay는 원 영수증을 보존하고 현재는 표에서 별도 읽는다. 중간 실패/commit 응답 불명에 성공 결과를 만들지 않는다.
- 내부 reserve는 기존 보호 D1 원 preparation command/receipt reader와 별도 reservation plan을 연결한다. 새 공개 prepare operation이나 실제 native factory/실행 소비를 열지 않는다. 이 연결의 실제 D1 정상 생산·예약 종단은 이번 검증에서 미확인이다.
- `0070_project_writer_authority.sql.pending`에 새2표·원 요청/관측 참조·불변/CAS·전이·deferred 최종 state/head/세대수/용량 검사를 정의했다. 기존 migration/manifest를 변경하지 않았고 실제 SQL을 실행하지 않았다. 기본 DML 거절·RLS false다.
- 전체 epoch/lease event10000, event+현재 head64MiB, payload2MiB/전체event4MiB/targets200을 검산한다. 기존 used/held와 합산10GiB는 모델 근거로 검산하며 실제 저장량 측정이나 기존 quota SQL 연결 완료를 주장하지 않는다. 교체 head의 이전 bytes를 중복 합산하지 않는다.
- 승인된 A에는 회수 전용 용량 예약이 없다. 포화 시 fresh revoke/reclaim/UNKNOWN 기록도 원자 거절할 수 있으며, 원행/조회/replay를 보존하고 다음 writer를 허용하지 않는다. 이 한계를 해결했다고 보고하지 않는다.
- 실제 권위·dispatch·회수 검증 표식은 false다. 기존 D1 정확5표/합성 준비/등록 proof exact8·기존 보호 자료를 actual로 승격하지 않았다.

## 3. 검수 증거

| 증거 | 실제 결과 | 증명 범위 |
|---|---|---|
| Main31ab3c: `node --test tests/unit/FN06/project-writer-authority-contract.test.ts tests/unit/FN06/registration-proof.test.ts` | 6PASS, exit0, 179.952ms, skip0 | 새 exact/null/hash/domain·기존 고정 등록 서명 벡터 |
| Main555657: state/routes 및 FN11 approval-input 선정 | 보정 전41PASS, exit0 | 당시 모델·API·승인 입력. 후속 결함을 숨기지 않고 보존한 과거 증거 |
| Mainc80c9a: `node --test tests/unit/FN06/project-writer-authority-state.test.ts tests/unit/FN06/project-writer-authority-routes.test.ts` | 보정 후40PASS, exit0, 6565.57ms, skip0 | 상태·한도·원 proof·동일 Tx 대역·API·자기 소비·관측 저장 후 현재성 |
| Main93ad05: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json` 및 `git diff --check` | exit0 | 최종 변경 source 타입·diff |
| Main173554: 실제 파일과 staged blob10경로 대조 | 일치10/불일치0 | commit 대상 파일과 검수 source의 내용 일치 |
| 기존 Reviewer | SQL 최종 scoped C0/I0, 모델/PG 최종 보정 scoped C0/I0 | 정적 독립 검토. 실제 PG/권위 성공 아님 |

중복 실행 수를 더하지 않는다. 최종 변경40건과 불변 계약/등록6건, 별도 승인 입력5건의 선정 증거를 구분한다. 승인 입력5건의 source는 이번 보정에서 바뀌지 않았다.

최초 buildApp의 누락 입구 404 반례(2aa8b8), 모델 결과 변조/기한 반례(de4b88), SQL 원행/완결·전이 반례(e5f7a8/159ea1), 실제 승인 소비 뒤 실패(829ea8), 두번째 관측 저장 후 등록회수 미폐기(1edc17)를 구분해 RED→GREEN으로 보정했다. module/loader 누락·시험의 잘못된 입력·정적 문자열 괄호·import/helper 위치·승인 대역 SQLprefix·시험 타입 준비 오류는 기능 RED로 세지 않았다. 오류·담당·지시는 WORK_STATUS의 일자별 기록에 보존했다. 동일 정식 원인3회로 Main이 코드를 인수한 일은 없다.

독립 검토에서 발견한 결과 변조, 최소 기한 덮어쓰기, SQL 원 보고 결박, 최종 event/head·용량 완결, ACTIVE에서 새 lease로 무회수 예약, 승인 자기 소비 재검사, 관측 저장 후 현재성 누락을 같은 Primary가 보정했다. 최종 미해결 Critical/Important finding0이다.

Git 개행 필터와 실제 source 차이를 없애기 위해 수정 기존3파일·신규 계약/시험2파일의 CRLF만 LF로 정규화했다. before.replace(CRLF,LF)===after를 확인했고 의미 변경0·기존 고정 fixture/SQL 원본/설정 변경0이다. 이 변경만으로 전체 검사를 반복하지 않았다. Main70f6d7의 일시 저장변수 누락은 지문 검사 준비 오류1이며 173554 명시10경로 검사로 해소했다.

## 4. 최종 파일과 SHA256

| 경로 | SHA256 |
|---|---|
| apps/server/app.ts | DC9F06EFB29CC1713BC1AFEED3C6640C95F0F56C5BBD42727FF2550AC9909EAD |
| apps/server/modules/access/project-command.ts | 5F279F60BF39EB842F3C844AA255B006F189C0608D746B3557F27EE6E43A8E16 |
| apps/server/modules/approvals/project-approvals.ts | 06258EC694A4B33F768948A989F94388E891BF8A9C99F42BE74B6F9D67B4929B |
| apps/server/modules/executions/project-writer-authority-routes.ts | 031E2E5C01FE831B788DA44ABA6FA22A5CE1B78ECD6CE0681CD70FB72EF45684 |
| apps/server/modules/executions/project-writer-authority.ts | D9E43BBD190556E4A038F4CFCFE04ED638EF7716641499F301CC372C2C9F7156 |
| contracts/runtime/project-writer-authority-v1.ts | 004581865A4D16A2BAEE92495A5391CF8FEC1CE0132B411DFF83155969BDC7EA |
| db/migrations/0070_project_writer_authority.sql.pending | 33609EB5923C08EB552A5032C4E2B787D65EA30AADECE971CE1BEED3A9567960 |
| tests/unit/FN06/project-writer-authority-contract.test.ts | 02BBF2AF7F0FE1ACEB7B8A8DE30FEE1CE41398BC8AF7B6462F92F09D170D69EF |
| tests/unit/FN06/project-writer-authority-state.test.ts | 4240A3FF1C40B915952A6611086CF85AD5DF2E9B2FDF11CC6FC7DCBD64A9CC96 |
| tests/unit/FN06/project-writer-authority-routes.test.ts | 0EB11A801C1722CA122720EFE5FD72E538FE733F5F2A7901918B78629D6A4423 |

허용11경로 중 실제 변경은10경로다. apps/server/modules/projects/routes.ts는 허용 범위지만 변경하지 않았다.

## 5. 미검증·후속 조치와 복구

- NOT_RUN: 실제 PG 문법/DDL/RLS/OID·잠금/경합/COMMIT 내구성, 실제 전역 저장량, 실제 D1 정상 생산·예약 종단, 실제 권위 공급자/credential/OS/source 강제 수단·Agent, browser/App 사용자 인수, 서비스·배포·P03 R3. SQL/메모리 대역 PASS로 대신하지 않는다.
- 기존 D1 intent/receipt 인접 시험은 중첩 fixture가 시험용 EC 키를 생성하므로 이번 고정 벡터 중심 검수에서는 실행하지 않았다. 실제 등록키가 아닌 시험키라는 구분을 유지한다. 기존 시험/기대값을 삭제·완화하지 않았다.
- 실제 권위 공급자·actual grant/schema 소비 전환·안전한 head 복구/재등록은 후속 미정/미구현이다. 기본 supplier가 없는 경로를 빈 성공 함수로 대체하지 않았다. 실제 실행 범위가 제외된 현재, 화면에서 실제 Agent 제어가 가능해졌다고 보고하지 않는다.
- 이번에는 QA DB/컨테이너/서비스/실자료를 생성하지 않았고 담당자가 live tool/handle0으로 writer를 반환했다. 보호 untracked3와0059/0065/0067 원본 지문은 유지했다.
- 복구는 기본 source 미등록 유지 및 필요 시 제품 checkpoint의 정확 diff에 대한 정상 revert 검토다. 실제 DB를 적용하지 않았으므로 DB down migration·데이터 삭제를 실행하지 않는다. reset/force/history rewrite·보호 자료 삭제0이다.
- 다음은 정본 계획의 남은 source 구현을 선행·승인 근거와 대조해 기존 담당자에게 위임한다. 전체 계획의 실제 환경/실행 검증은 별도 남아 있으며 이 결과서로 완료 처리하지 않는다.