# FN09 등록 정의 실행 준비·Options 보관 r2 구현 지시서

2026-11-06 / Main 어울 / r4 / 단일 기존 Primary / source-only.

## 1. 승인과 기준

직접 승인: docs/work_packages/FN08_FN09_START_PREPARATION_SOURCE_DIRECT_APPROVAL_20261106.md SHA256 C82C16EB3AAE2035B8273392549130702167396ACD34095A4617E2D21B6A228B.
채택 계약: docs/contracts/FN09_REGISTERED_PREPARATION_OPTIONS_CANDIDATE_20261106.md r2 SHA256 BA7FD5B34BDFF9CFF26D2CA23C74AAFF685E8850054A27CE711827FCDC66DAD3.
시작 소스 checkpoint 6f1b00364ca502efb67fa0f049aaba8329546345, 승인 문서 자식 8daff43d7f1365336d7b2de8559cd065733a1177. 제품/시험 지문27은 Main 1e9f35에서 일치, 신규2 부재를 확인했다.
후속 문서 commit으로 HEAD가 이동해도 아래 지문이 같고 Main이 시작을 확인해야 한다.

현재 단계는 로컬·WSL 기능 구현의 source-only 부분이다. 목표는 실제 선택한 등록 도구/환경에서 준비·승인왕복·저장·고정조회가 연결되는 코드이며 단순 성공 wrapper나 기존 기능 재구현이 아니다. 실제 DB·권한·키·서비스·SDK/Agent 실행·실자료 조사·C# 컴파일·J3/P03 R3·기존 프로젝트 차단 해제는 제외한다.

## 2. 역할과 허용32

기존 Primary만 코드/시험/미적용 SQL을 작성한다. Main은 문서·검수·fresh 검증·Git 통합, 기존 독립 담당자는 read-only 검수다. 다른 담당자의 변경을 되돌리거나 관련 없는 dirty/untracked를 건드리지 않는다. 새 agent/chat/branch/자동화0, Main 동시 코드 write0.

제품16:
| 경로 | 시작 SHA256 |
|---|---|
| contracts/runtime/execution-intent-v1.ts | 323F846F50B34B39689FF3736B72F238ACFE71B1750EBF4DAC1F3222C06F3265 |
| apps/server/modules/executions/preparation-input.ts | C0827187F012A5919E28858B6208F278889A51CF4AB018FA562CF0DD97C20177 |
| apps/server/modules/executions/project-execution-preparations.ts | 5DB49D39CCE97C8F20B71E48942B90DE27955CAE5F407AD36193F7514AA1E340 |
| apps/server/modules/approvals/execution-preparation-approval-candidate.ts | 2F45FA52B6C5E9EEB64CD48A6C236177D91572D372D4B9B7E0015A7EB4829589 |
| apps/server/modules/approvals/project-approvals.ts | 36269E15021A1E72A681DE8A8192E03F180753A4E8ACC3369BD9725B5A70A695 |
| apps/server/modules/projects/routes.ts | 4FC3C57A39F28C9BC3D082379D20005EAC6CDF47321583FF2B0065C2D752ADB9 |
| apps/server/modules/projects/project-storage-quota.ts | E8CA4A86D68EC8209F179280CACC27D946B4D458BDAF8330C174FFB1A53459AC |
| apps/server/modules/access/project-command.ts | 2EC5C975DFF7158413598E32F0BE7EBFE25B6E43B14688DF733BD22B164D9CD1 |
| apps/web/src/features/workspace/execution-preparation-api.ts | 50092898098C6E23900A7ADFC8296FA548D781149FA3409F96D78EF703F58FE7 |
| apps/web/src/features/workspace/execution-preparation-approval.ts | 7C9BDAB4DC61B61F56DA9EC9AC8A474EA7955CD6426DD15CB2FC1ADB424FE98C |
| apps/web/src/features/workspace/ExecutionPreparationEditor.tsx | 6B1EC78F07A500E56BB3EC28D0090D410CE3E0DA74C10169FB0D0161BEA56B76 |
| apps/web/src/features/decisions/execution-preparation-approval-api.ts | FE48B10F7189FEFF6515319D3CCF2DA26C1929D6655C8354D4E5EA3BC0A017F0 |
| apps/web/src/features/session-detail/preparation-history-api.ts | 84500935B3E1672E9BB14F428F67F9D8AC055A655085F8BCD26E69ACFFF43A10 |
| apps/web/src/features/session-detail/PreparationHistory.tsx | DE479DFE31884986B2C774EBF55CBB52A7E9B782EE7CF6B60CCBA3B93991BFEA |
| apps/web/src/features/workspace/responsible-session-api.ts | 0DBFF8CC4E29E4B4B5E9C5808E7816112B267F8416237F263F0C4CC55FE41E9A |

기존 시험14:
| 경로 | 시작 SHA256 |
|---|---|
| tests/unit/FN08/execution-preparation.test.ts | 13B438A0AF589981960FCC96AB63F9F8FF699FCFDFC6D728DF0006F384AE0115 |
| tests/unit/FN08/execution-preparation-qa.test.ts | 2A5C867703CDFEB2A62246E2777F0C7AEEAE3AB3E5A9820C2C8974C203A32E8A |
| tests/unit/FN08/execution-preparation-pages.test.ts | B50804C8B7BB2277731C94E31088EF4218F64D6684C602F1C92927C60D9A1D6F |
| tests/unit/FN09/execution-preparation-approval.test.ts | 16F024449E5DA0AD1D1FD9994407D1410C43C0A68227341911D4380798B31950 |
| tests/unit/FN13/project-storage-quota.test.ts | 372312EA524D646D15AA0528A79694C49CA9F5230E9A827B08AD18AC29D9C67E |
| tests/unit/FN13/project-storage-quota-writers.test.ts | 022CA5000E09649D8AB9CACECB7B46BA76BDF577C07D98FABF2F21F90F0DB6D7 |
| tests/unit/FN13/project-storage-quota-schema.test.ts | 5C452593A0CD57C8A91BC85C2C43CC0033CBECE8CBCFD36890F1A59931CF938E |
| tests/unit/UI04/execution-preparation-api.test.ts | C398C9FBAB0748561AFAC1CF74336B4AEECBA6A699DAEF4108ED426925F728B4 |
| tests/unit/UI04/execution-preparation-approval.test.ts | 849B57B4370AE7929BEBD6177E45B79C41FF818D032E338ADBAA508E8A1BC66D |
| tests/unit/UI04/responsible-session-approval-api.test.ts | E8F74FAB782200D271099268E31D7EA373648A2EFA2F89019C801F6D1FB69132 |
| tests/unit/UI08/execution-preparation-approval-api.test.ts | C6E11E598A6BC697C1DAF73CBD7F2EF55BC345FFC0BE63D89CB05F4DE9FEE185 |
| tests/unit/UI05/preparation-history-api.test.ts | 02B13C107C0F91BAAAE66CC4AB9A03C6E08AECABE3A4B45E8335CEDFC7469766 |

추가 필수 호환 제품1/시험2 시작 지문:
| 경로 | 시작 SHA256 |
|---|---|
| apps/server/modules/backups/context-preparation-inventory.ts | 2DA3E8F146084A3EE768A0E519BF05EB249F392BC2EB881493675A1400B90B88 |
| tests/unit/FN16/context-preparation-inventory.test.ts | F082B39B311F5E7370508721CB2318393EE0CBF6F8F81F9B1E66D2ACAB765588 |
| tests/unit/FN16/context-preparation-approval-inventory.test.ts | 938FA64AD56CC8921AEEF1F2C06F8947843FA44CB2269FEFD669DD4C18DD2EC7 |

이3경로는 Main1cf35a에서 지문을 확인했다. 기존15제품/12시험의 시작 지문은 위 표 그대로이며 과거 TEST_ONLY/PRODUCT_GO 이력은 그때의 허용29에 해당한다.

신규2:
- db/migrations/0077_registered_execution_preparation_options.sql.pending
- tests/unit/UI04/registered-preparation-options-flow.test.ts

신규 SQL0078은 후행 FN08에 예약돼 있다. 허용목록 외 경로가 필요하면 정확 원인·최소 diff를 Main에게 반환하며 기술 파일 배치 보완은 Main이 판단한다. 이를 사용자 재승인 대기로 만들지 않는다. package/lock·기존 SQL·AGENTS·SEND/0062·완료 parser/SDK owner·원 정의/환경 보호 reader·보호 비추적3은 불변이다.

## 3. 구현 계약

r2 전문을 그대로 구현한다. 등록 준비만 exact13 intent와 exact10 snapshot이다. 기존 후보 exact11/9는 보존한다. capability/budget 참조는 입력 원문으로 보존하고 미검증 조건·NOT_AUTHORIZED/실행 false를 유지한다. 새 능력/예산 공급자나 실제 실행 허가를 추가하지 않는다.

기존 readExecutionIntentV1의 exact11 실행 소비자를 일괄 넓히지 않는다. 같은 파일에서 준비 목적 전용 닫힌 reader/type를 추가하는 등 목적을 분리한다. 등록 분기는 명시 connectionKind/optionsFormat과 같은 binding·definition/environment fullref/current를 검산해야 한다. Claude Code/CLAUDE_AGENT_SDK/CLAUDE_QUERY_DATA_V1 exact 대응은 이번 채택된 데이터 의미이며 alias/대소문자 정규화·기존 자료 변환0이다.

닫힌 modelOptions만 canonical body로 도출한다. options의 body/utf8Bytes/bytes SHA와 전체 snapshot hash는 다르다. 실제 preparationRef가 후행 목적 참조이며 별도 가짜 id/version/source 행을 만들지 않는다. 전체 canonical 2MiB·기존 불변성/원 command·receipt/audit·정확 일회 소비를 유지한다.

저장 반환·replay·단일 GET·state/page 전체 snapshot의 원문 노출 전 원 definition/environment 보호 읽기를 같은 db/actor로 검산한다. 원 reader의 authorize/OWNER/read 정책·승인미연결 오류를 생략하지 않는다. 실패 시 전체 응답 거절·body0이며 UI 숨김으로 대체하지 않는다. 역사 접근과 최초 current 검사도 구분한다.

project-command의 material callback 전 replay 경로는 목적 한정 verifier로 검산한다. verifier가 결과를 대체하거나 변조하는 포트가 되면 안 된다. 다른 operation/기존 후보의 응답·정책·실행 의미는 불변이다. 새 Pool/authenticated 중첩0이다.

## 4. 계상·승인 producer·원자성

채택 r2 §7의 FN75형 canonical-pair P/C/A/U/K/R, 예약/정산 자기비용 최소 고정점, 기존 SETTLED 합의 단일 귀속과 실제 원 projection 검산을 구현한다. 숫자 폭·canonical 원문·상계가 입증되지 않으면 거절한다. 새 임의 배수/상한/무료 저장·coverage 승격0이다.

원 PoolClient/db/actor의 내부 접점으로 reserve→저장/승인 소비→실제 비용/역완결→settle을 수행한다. 기존 공개 reserve(token,csrf) parser를 넓혀 일반 caller가 준비 내부 목적을 직접 선택하게 만들지 않는다. 내부 plan도 실제 원 command·prepare 분기·예약 part와 고정 목적을 검산한다.

승인 요청/결정/후보의 최초 비용 proof producer도 이번 등록 준비 분기에 필요한 범위만 연결한다. prepareExecution exact13을 대상으로 하는 승인 요청/결정과 기존 승인 원형을 구분한다. 승인 최초 비용·새 소비/공유행 차분의 귀속을 두 번 더하지 않는다. proof 미연결이면 REQUIRE_APPROVAL 미완료/거절을 유지하며 가짜 proof를 만드는 test seam으로 완성했다고 보고하지 않는다.

이 접점의 순수 내부 함수/분기·원장 식별자 명명은 채택 의미를 바꾸지 않는 Main 기술 판단 범위다. 새 public 입력·권한 의미가 실제 필요하면 정확 차이만 반환하고 해당 부분만 멈춘다. generic 승인 producer 전체 리팩토링0이다.

명확 rollback은 원 Tx 전체다. COMMIT/응답 불명은 UNKNOWN으로 원 명령/원문/결과·예약을 보존하며 자동 새ID·재승인·재전송·hold 해제0이다. 동일 원 명령 replay는 새 원문 도출·비용·승인 소비0이다.

0077.pending에 새 forward 정의만 작성한다. 기존0076까지와 SEND0062를 수정하지 않는다. SQL NULL/JSON null·exact 형상·원 command/receipt/audit/승인소비·원 준비/body/ref·quota/역완결을 양방향 검산한다. 전체 trigger/constraint를 disable하거나 광범위 drop하지 않는다. 실제 SQL 실행0이다.

## 5. 화면과 실제 소비

등록 binding/정의/환경의 기존 보호조회에서 선택한 원 fullref를 준비한다. 임의 UUID나 수동 JSON 파일을 만들게 하지 않는다. 등록 분기에서는 기존 UI의 HUMAN 보고 공급을 실제 능력 증명으로 요구하거나 승격하지 않고 입력 ref·미검증 표시로 구분한다. 기존 후보 선택 흐름은 그대로 유지한다.

Editor→고정 명령→승인 요청/결정→명시 복귀→저장→receipt→고정 조회를 실제 제품 모듈로 연결한다. raw body/approvalRef/원 refs를 정확히 보존하고 선택/주체/client/프로젝트/세대/CSRF 전환·늦은 응답·UNKNOWN에서 재전송을 막는다. 저장 후 GET 실패는 receipt 보존·새POST0이다.

새 원문은 보호 read 성공 시만 표출한다. 준비가 실제 실행이 아님을 짧게 표시하고 내부 프로토콜 설명을 상시 화면에 나열하지 않는다. 새 화면 디자인/메뉴·범용 업로드·다른 기능 확장0이다.

## 6. TDD와 검수

첫 단계는 허용 시험15만 작성한다. 실제 기존 parser/클래스/route/UI를 소비해 등록 분기 미지원과 원문 보호/replay·계상 미연결의 행동 RED를 입증한다. module 부재/추정 fixture/환경 실패를 제품 RED로 꾸미지 않는다. 새 fixture는 원 관계/정책/receipt·승인 근거를 적합하게 구성하며 기존 기대값·기준·보안 음성을 낮추지 않는다.

Main이 제품16/SQL 부재 지문과 실제 RED·독립 WI 검토를 확인한 후 PRODUCT_GO를 발행한다. 이후 같은 허용32만 구현한다. 완료한 기존 검사를 전수 재실행하지 않고 신규/직접 인접과 필요한 type/build를 선택한다.

필수 사례:
1. 기존 후보 정상/거절 보존, 등록 exact13 discriminator/format·닫힌 옵션·전체2MiB·bytes/hash 구분.
2. 실제 원 definition/environment/binding의 fullref·head·주체/프로젝트/정책·역사 접근과 current 차이, 다른 도구/환경 거절.
3. AUTO 및 REQUIRE_APPROVAL의 원 command/candidate/payload/ref·현재 세대·기한·한 번 소비, 승인 최초 비용 proof/중복 귀속.
4. 동일 PoolClient/잠금·coverage·부족 quota·정확 상계/고정점·실비·부분 실패 rollback·COMMIT UNKNOWN·replay 추가0.
5. 저장/replay/GET/state/page의 보호 read 거절 시 body0·부분 응답0, 공개 reserve/기존 runtime reader로 새 목적 진입 거절.
6. 실제 Editor/승인/상세 모듈을 메모리 DOM/fake fetch로 연결한 정상·늦은 응답·주체/선택 전환·GET 실패·UNKNOWN.
7. SQL의 원/역완결·null·exact 형상·목적별 quota closure. 정적 검산은 실제 PG 증거가 아니다.

합성 시험은 메모리와 기존 설치 도구만 사용한다. 실제 listener/DB/계정/키/SDK/Agent/원자료/WSL QA·네트워크0, dependency 설치0이다. DOM 빌드에 일회 파일이 불가피하면 생성 전에 정확 신규 대상·이유·수명·정리안을 Main에게 반환한다. 임의 임시 폴더/사용자 자료 조사0이다.

## 7. 결과 계약

변경 파일별 지문/diff·정확 명령/exit/실제 결과·RED와 fixture 오류 구분·미실행/잔여·live/pending·rollback을 반환한다. 동일 근본원인의 정식 실패3회는 Main에게 증거로 인계하고 임의 우회/기준 완화0이다. 도구/경로 오류는 별도 기록한다.

신산님과 PMO에 코드 완료를 직접 주장하거나 merge하지 않는다. Main 독립 검수·fresh 검증·필요 보완 후 통합한다. FN09 단위 인수 후 후행 FN08 START WI로 즉시 이어가며 전체 계획 완료로 승격하지 않는다.

## 8. r2 필수 소비자 호환·승인 알림 비용 보완

부모 직접 승인 C82C16EB/채택 계약 BA7FD5B3의 의미·공개 API·권한·한도는 그대로다. 독립 영향 검수에서 새 원형 때문에 기존 준비 inventory 전체가 실패함을 확인해 최소 내부 호환3만 추가했다. 새 백업 기능·실제 자료 조사·반출·복구를 추가하지 않는다.

context-preparation-inventory.ts의 기존 후보 snapshot9/사유 검산은 보존하고 등록 snapshot10/intent13/options·등록 사유·원 bytes/hash/canonical/원 command·receipt/audit·승인 관계를 별도 검산한다. 현재 collector는 OWNER를 검사하지만 snapshot도 반환하므로 등록 분기에 원 definition/environment 보호 읽기가 필수다. 다만 기존 관측은 RR/READ ONLY이고 보호 reader의 currentPolicy FOR SHARE를 그 안에서 호출하면 충돌한다. RR을 RW로 바꾸거나 authorize=false/잠금 제거/가짜 성공 proof로 우회하지 않는다.

기존 START_AND_END_READ_COMMITTED 인증 경계를 그대로 활용한다.
1. 시작 boundary의 기존 인증 RC callback 안에서 한도 내 등록 준비 fullref·원 definition/environment fullrefs를 수거하고 형태/해시 관계를 검사한다. 그 같은 RC db와 실제 actor로 기본 보호 reader를 호출해 OWNER/정책·승인미연결 검사를 보존한다. 시작 검산 집합은 immutable in-memory 자료이며 새 권위/서명 ticket이 아니다.
2. 원 RR/READ ONLY에서는 기존 역사 closure/hash를 검산한다. 반환할 등록 준비와 원 refs/hash가 시작 RC 검산 집합에 정확히 포함되는지 확인한다. 중간 추가/다른 ref를 조용히 포함하거나 누락시키지 않고 전체 거절한다.
3. RR rollback·release 뒤 기존 종료 boundary의 인증 RC callback에서 실제 반환 대상의 동일 fullrefs를 기본 보호 reader로 다시 검산한다. 원 불변 정의에서 도출한 Options body/bytes/hash도 RR snapshot과 대조한다. 최신 head로 역사 원문을 다시 만들지 않는다.
4. 마지막 RC 성공·동일 identity·기한/취소 검사 후에만 전체 결과/body를 반환한다. 어느 경계든 실패하면 전체 거절/body0이다. 종료 검사만으로 시작 검사까지 했다고 주장하지 않는다.

각 보호 read는 해당 기존 인증 RC의 원 db/actor를 사용하며 새 Pool/별도 임의 인증 트랜잭션을 만들지 않는다. RR의 snapshot을 현재 권한 snapshot이라고 부르지 않고 기존 currentPermissionVerification 및 현재성/실행 효력의 미검증·false를 보존한다. exact 키만 늘려 body를 노출하지 않는다.

추가 시험2에는 실제 collector의 등록 정상·원문/ref/hash/원 승인 관계 변조·시작/종료 RC 각각 보호 읽기 거절·RR 집합 불일치·동일 identity/기한/취소·RR에서 잠금 SQL 금지·후보 기존원형 보존을 추가한다. composition은 현재 호출 구조를 재사용하는 방향이며 제품 수정 없이 직접 인접 영향 검수만 한다. 실제 wiring 때문에 추가 경로가 필수면 정확 근거를 Main에 반환한다. 타입/원 hash를 무시하거나 새 snapshot을 누락해 성공시키지 않는다.

이 추가3은 시험2 TEST_ONLY부터 시작해 실제 기존 collector의 정상 등록10 거절 RED를 Main에게 제출한다. 기존 허용29의 PRODUCT_GO 구현은 계속하고 이3 때문에 전체를 멈추지 않는다. Main이 RED를 확인하면 추가 제품1 GO를 발행한다.

승인 최초비용 proof에서는 기존 recordApprovalRequestNotification의 실제 notifications 1행도 원 요청 생성 명령에 귀속한다. source_command_id는 원 승인 요청 receipt.id이며 외부 commandId나 후행 prepare/결정 명령이 아니다. 현재 fn15/fn75/fn76 actual·SETTLED에 이 행을 포함하는 producer가 없고 0052의 프로젝트10000행 cap은 bytes 계상이 아니다.

등록 준비 requestApproval 최초비용 상계/actual에 notification 전체 실제14열을 한 번 포함한다. 같은 승인 생성 Tx에서 project_id+source_command_id+approval_request_id+recipient의 원 행·origin/FK/유일/current를 검산하고 누락/불일치/비용 proof 부재면 원 요청 전체를 거절한다. 기존0052 파일/cap/권한은 변경하지 않고0077 forward와 허용 ProjectApprovals/quota에만 연결한다. 준비 P/C/A/U/K/R에 알림을 추가/재계상하지 않는다. notification_reads는 후속 별도 읽음 명령이므로 이번 생성 비용과 혼합하지 않는다.

이 항목은 이미 채택한 승인 최초비용의 실제 저장 귀속을 정확히 하는 내부 구현 보완이며 새 알림 채널·전송·권한·비용 한도를 만들지 않는다.

## 9. 원 준비 승인 알림 origin 복원 회귀 보완

ProjectApprovals.request와 기존0055 fn09_prepare_candidate_valid는 prepareExecution의 후보11에도 exact {details,candidatePayload}를 원 request payload로 사용한다. 0052 fn17_notification_origin_valid는 해당 분기가 없어 details만 복원하므로 적합 후보11도 원 hash와 맞지 않는다. 이는 현재 승인된 입력의 구현 누락이며 새 공개/권한 계약이 아니다. 등록13만 고치고 후보11을 기존 함수로 위임해 이 누락을 남기지 않는다.

0077 forward의 prepareExecution 전용 분기는 후보11/등록13을 모두 다룬다. 원 execution_preparation_approval_candidates의 project/request/server command·candidate command·payloadHash·actor/client/controlGeneration/policy 관계와 기존/등록 fn09_prepare_payload_valid를 검산한다. 원 request는 {details:r.details_json,candidatePayload:b.payload_json}로 복원한다. 등록 discriminator를 필수로 요구하는 조건만 제거하고 candidate 누락·불량·원 관계/hash 불일치는 false다. details-only fallback은 하지 않는다.

다른 approval operation은 기존 origin 함수에 위임한다. 원0052/0055 파일·알림 cap/권한·원 명령/receipt/audit·준비 실행 미허가는 유지한다. 후보11 알림 origin 복원은 비용 정책 확대가 아니며 등록 목적 최초비용 proof/후행 준비 계상과 구분한다. 기존 후보의 새 실비/한도 정책을 추가하지 않는다.

허용0077과 기존 schema 시험에서 양쪽 원형의 적합 복원·누락/변조 거절·다른 operation 보존을 검수한다. source 형상 검사를 실제 PG 행동 재현으로 주장하지 않는다. 별도 사용자 재승인·기존 승인 전체 대기는 필요하지 않다.
