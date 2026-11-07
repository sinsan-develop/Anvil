# FN15 파일 업로드 기존 승인 연결 — source 작업지시
작성 2026-11-03 · 상태 SOURCE_ONLY_GO · Main 어울 / 기존 Primary 단일 writer
부모: FN15_CONTROL_ACCEPTANCE_SOURCE_IMPLEMENTATION_20261103.md r7 SHA256 15700DB2F63FFB6DE3F248B22142F76FBFF1B58AE30BC090EB08FAB610BDBE3F §8/U4.
기준: codex/av3-stage-b HEAD 0e5ae3327699bd93572af66a9b0cc0fba99d5ec1.
기존 일반문서9와 기지원 승인 엔진의 누락 내부 연결이며 공개 입력/응답/정책/대상 권한 확장은 없다.

## 허용 코드·시험 정확6
| 경로 | 시작 SHA256 |
|---|---|
| apps/server/modules/access/project-command.ts | F20F7835EA7CDEFBFC0CF18D3ACA785749C6B796156AA055C46FF3F5BF7720D1 |
| apps/server/modules/documents/project-files.ts | 9C35E1E22FB5D6DB2745E411A85F1A9A65FA31CCC83CC55BD1411FFF4619154F |
| db/migrations/0073_control_handoff_acceptance.sql.pending | 5FDDA30C3AB3987064C3C5778F4A58FF7166B33074A455E1341A3900D6A001A1 |
| apps/server/modules/control-handoff/control-acceptance.ts | 800D66F8488E9556CF7080BEF36369D8235BEDF0FF92727A9C1684C3481A6634 |
| tests/unit/FN15/control-source-integration.test.ts | F0932B1D9F05BA37F756B47CA816E1F679017538D911E9411E5F2C97E8795C80 |
| tests/unit/FN15/control-acceptance-schema.test.ts | 010FBBA26570B437492CE9EACF586F44161B59F7507BD89D1A65E31A648FA708 |

## 구현
1. ProjectPolicyRepository의 upload 전용 고수준 인증 wrapper는 token/CSRF/원 command만 받아 실제 authenticated callback 안에서 private context를 생산한다. caller가 db/actor/session/verified를 공급하는 setter를 만들지 않는다. operation upload만 허용하며 callback 내 동일 DB/actor/authSession/credential·원11키 명령 고정복사/hash·단발/finally를 보존한다.
2. project-files 최종 저장 authenticated callback만 위 wrapper로 연결한다. 본문 전 guard와 bytes/hash·20MiB·quota prepare/reserve/start→기존 replay 물리 원본/검사→publish→receipt/승인소비→artifact INSERT→settle 순서 및 START 후 UNKNOWN을 보존한다. 일반 command()의 조기 replay로 옮기지 않는다.
3. requestApproval/decideApproval은 이미 실제 Repo.command 인증을 소비한다. private context 고정집합에 연결하되 SQL 목적 helper에서 저장 요청/원 command를 실제 검산한 upload 분기만 허용한다. raw actionScope·requiredDecider·requestedBy/client/controlGeneration·정확 정책/기한·단발을 유지한다. 새 candidatePayload/승인 입력·응답·snapshot/테이블0.
4. 0073 내부 forward는 현재0050 request guard·0011 decision helper·0033 본문을 보존한0035 before_plan alias를 정확 확인한 뒤 upload 목적 HE만 추가한다. 0074 membership outer와0072 및 특수 위임을 그대로 유지하며 다른 operation의 Owner 검사/등록/source 권위를 열지 않는다. SD는 기존 목적 helper 범위만, trigger invoker→definer 전환/새role·테이블·공개 helper0. 실제 current grant/session/정책·original/ref/receipt·원 request를 재검산한다.
5. 기존0072 artifact 일반 분기의 READY 제한과 QUARANTINED 생산의 불일치는 이번 승인 연결에 몰래 섞지 않는다. 거절/UNKNOWN·보호 자료/예약을 보존하고 미해결로 보고한다. 격리 성공/실PG 성공으로 표시하지 않는다.

## 검수
- 실제 Repo/route와 기존 quota/approval engine을 메모리 대역으로 소비해 request→decision→원 upload→단발 소비→원본/정산→명시 replay를 검사한다. 별도 실제 FS/DB/네트워크/Agent 실행0.
- 실제 소비선의 누락 RED→GREEN. context 없음/다른DB·actor/session/변조/단발·종료후 재사용, 구세대·만료/DENY/회수grant·다른 승인/후보/bytes/hash/mediaType는 게시/허가0.
- START 이후 publish/verify/receipt/승인소비/settle 불명은 원명령/held 보존·자동재전송0. replay storagekey/원bytes/inspection 변조는 성공0.
- 다른 approval의 기존 Owner/특수분기와 기존 문서5op는 보존. 새 SQL delta 역치환 시 현재 부모 함수/alias의 정확 원문 복원. 실제0072/0074 파일 불변, 0073 LF/raw checksum→service 상수 동기화.
- 집중/직접인접 시험·root noEmit·diff check. 코드 불변인 완료 시험 전체 반복0. fixture/정적 SQL은 실제 PG/RLS/경합/사용자 인수가 아님.

## 반환
정확 변경6 이내·기준/최종 hash·RED/GREEN 원명령/exit·실제 검증·실패/미실행·SQL 역차분/잔여를 한국어로 반환. 제품 writer 반환 후 Main 독립 검수·문서/checkpoint. Main 소유 WORK_STATUS/보호 untracked3와 타작업을 되돌리지 않는다.
실제 DB/권한/정책/회원·키/서비스·Agent·OS·제품네트워크·사용자/백업 자료 조사0. 새 branch/agent/자동화/PR/merge/배포0. 전체 FN15/Stage/계획 완료 아님.


## Main 상세 보완 r2 — 기승인 범위의 알림 필수 소비선
2026-11-03 Main 독립검수 f2501e/db0b23으로0052 fn17_notification_current가 승인요청 capacity/지연완결에도 사용됨을 확인했다. 새 기능/공개 계약/권한 대상의 확대가 아닌 동일 upload 승인 저장의 누락 소비선이다. 정확6/실효과 제외는 불변이다.
- 0073에0052 원함수의 현재 정의를 보존한 forward를 추가한다. 기존 wanted_operation=requestApproval이고 실제 저장 요청 원scope가uploadArtifact이며 동일원명령/목적context·실제현재HE grant를 검산하는 경우만 기존Owner 조건의 대안으로 연결한다.
- markNotificationRead와다른operation/특수후보Owner·실제 row잠금/정책·기한·현재세대·알림10000상한·요청/알림원자성·원함수SD/owner/ACL은 보존한다. 현재 SQL UPDATE/지연trigger 시각에 따른 목적context 수명과검산을 확인한다.
- capacity/알림INSERT를 단순대역 성공으로만두고SQL종단완료로표시하지않는다. 새정적누락RED→forward/역치환원문동일→GREEN을기록하고실PG는미검증이다.
부모 WI SHA88CB4B79E07A8C0FEBC256108DA724E955C23CCAFE69854EB70823AD96124C19. MAIN_RECONFIRMED_NON_SEMANTIC: 동일부모r7 U4·동일6경로·동일기능/공개계약/검수기준·실행제외를보존하는필수소비선상세보완이다.
