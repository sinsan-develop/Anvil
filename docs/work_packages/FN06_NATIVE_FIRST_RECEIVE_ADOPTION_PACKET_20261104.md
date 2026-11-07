# FN06 같은-client 최초 수신 계약·source 구현 채택 패킷

2026-11-04 · Main 어울 · 상태: DECISION_PENDING / SOURCE_GO0 / EXECUTION_GO0

## 1. 이번에 결정할 한 단위

같은 Anvil 설치형 앱의 원 로그인·client·제어 세대와 등록키에서 다음 native 준비 명령 한 개를 받는 연결을 구현한다. 로컬 신뢰 화면이 명시 수신을 준비하고, 동일 main 소유 persist:anvil-web Session의 hosted Web이 원 명령을 작성·승인·전송한다. Chrome·다른 기기·교차client/모바일·장시간 수신은 후속 미완료 요구로 남긴다. 이 한 단위의 source 검수를 FN06 전체나 작업계획서 완료로 보고하지 않는다.

기존 계획 FN06의 연결 기능이 목적이다. 다만 기존 신뢰 등록과 authority 이후 SIGN만으로 최초 수신을 시작할 수 없어 새 OPEN 서명목적/수신 전용 자격과 보호 profile 권위를 구체화했다. 다음 변경은 기존 코드의 내부 배치만 바꾸는 수정이 아니라 신규 공개·인증·저장·감사 계약이므로 이 패킷에서 명시 채택한다.

## 2. 기존 승인과 달라지는 계약

1. 최초 OPEN 전용 typed 등록키 proof와 RegistrationCurrent/PreAuthoritySigningFrame, receive-only credential, 목적별 HTTP/IPC를 추가한다. 아직 없는 native authority를 첫 인증에 요구하지 않는다. 기존 SIGN·원 OWNER/등록/정책/current/만료/회수 검사는 유지한다.
2. 보호 package의 독립 anchor와 project별 불변 PROFILE/HEAD·current CAS 원장을 추가한다. 기존 migrator만 publisher 목적 EXECUTE, app/HUMAN/Agent 직접 쓰기0이다. 기대 sourceSHA/manifestHash/anchorHash는 유지관리자의 별도 승인된 보호 실행계획에서 받고 실제 artifact와 비교한다. 기대 공급자 미구성은 효과 전 거절이다. 실행계획·키·CA를 이번에 실제 생성하거나 적용하지 않는다.
3. HUMAN 준비3연산과 보호 조회, Offer/ARM, 동일 원 native Tx의 실제 binding, 단발 Delivery와 ACK 후보/원 operation 후행 확정, 보호 역사 조회를 연결한다. 원 native11키·최종 approvalRef·commandHash·총10초·ATTEMPTED 선COMMIT·한 번 전달·UNKNOWN 재발급/재전달0은 유지한다.
4. 수신 head/불변 records/ticket/reservation/고정 등록별 보안집계와 profile 공유 actual/held·회수 한 행 선예약을 새 미적용 SQL로 정의한다. 입장한 적격 거절은 고정 개별 감사와 재조회로, 범위 밖/포화 거절은 닫힌 유한 집계와 포화 사실로 구분한다. 무한 개별 감사 보존을 약속하지 않으며 기존 자료 삭제·효과 시작·UNKNOWN hold 선해제0이다. 기존 경로의 감사 기준을 몰래 낮추지 않는다.
5. 실제 auth session ID는 일반 Web/IPC/OPEN metadata에 추가하지 않는다. 동일 원 main의 보호 Delivery 안 기존 NativeAuthority.subject.humanSessionId는 기존 hash/parser를 보존하기 위해 명시 예외로 유지한다. cookie/인증 token은 노출하지 않는다.

## 3. 고정 문서와 검토

| 문서 | bytes | SHA256 |
|---|---:|---|
| docs/contracts/FN06_NATIVE_FIRST_RECEIVE_WIRE_PROPOSAL_20261104.md | 45220 | 6d1a727fb60298c4adcc37ce5066b4032f144e6f42b8a0b74f023d8af56e83f4 |
| docs/contracts/FN06_NATIVE_FIRST_RECEIVE_ACCOUNTING_PROPOSAL_20261104.md | 68807 | f8667e17830b60791d769a288ec77c82e34649a952bff9faf4ae688bb32c1597 |
| docs/work_packages/FN06_NATIVE_FIRST_RECEIVE_SOURCE_IMPLEMENTATION_CANDIDATE_20261104.md | 40549 | c66b3381829513a5a1cb69a0d606fbcd4904e62a4561e8b979bdfad940df43bc |

wire 부모 bfb77f2f의 I3는 fec6d891에서 한정 재검수로 해소됐다. 계상2a6a325b와의 교차 C0/I0, profile103e6a17 §14의 C0/I0 및 기존 SQL PK/UNIQUE/FK 대조 C0/I0를 수거했다. WI87fb8590의 receive profile_hash I1과 보호 publisher 기대값/실제 constructor 경계는2714a640에서 한정 재검수 C0/I0다. 이는 문서·source 정의 검토이며 실제 DDL/RLS/COMMIT/컴파일/TLS/브라우저/Agent PASS가 아니다.

## 4. 채택 시 허용하는 실행

WI §2의 정확 허용목록 안에서 기존 Primary 한 명이 S0~S7 순서로 코드·화면·미적용 SQL·합성 검증을 수행한다. Main은 검수·통합을 맡고 같은 코드에 동시 writer를 두지 않는다. 기존 source·시험 읽기와 해당 변경의 단위/인접 검사·타입·파일 출력 없는 제품 빌드는 허용한다. 실제 공급자 미구성을 fake 성공으로 바꾸지 않고, 정상 합성 흐름도 실제 소비 함수/원 issuer/slot/ACK의 연결을 증명해야 한다. 공개 인터페이스나 저장·권한 의미를 추가로 넓혀야 하면 정확 delta를 먼저 반환한다.

실제 DB 접속/적용·GRANT/사용자 정책/권한 부여·실제 키/인증서/anchor/사용자 자료 조사·서비스·Agent 실행·C# 컴파일/helper 실행·HTTPS 서비스 기동·J3 QA·P03 R3·Oracle/운영·기존 프로젝트 차단 해제는 제외한다. 합성 결과를 실제 사용 가능·배포·전체 인수로 승격하지 않는다.

## 5. 인계·Git·재개 조건

기존 codex/av3-stage-b에서만 진행한다. UI02 source checkpoint85480d5a와 문서 checkpoint를 보존하며 main/새 branch/강제push/이력개작0이다. private push는 서버 오류와 후속 publickey 거절로 원격 최신SHA가 미확인이다. 이 패킷 채택을 Git 연결 복구·키 변경·배포 승인으로 해석하지 않는다. 안전한 로컬 commit·WORK_STATUS를 유지하고 기존 private 연결 지원은 PMO에 요청한 상태다.

채택 답변 전에는 세 문서와 이 패킷이 모두 미채택이며 새 source writer를 dispatch하지 않는다. 채택 시 정확 패킷/문서 hash와 사용자 또는 위임 결정 근거를 adoption binding에 기록하고 단독 Primary에게 배정한다. 실제 실행은 별도 정확 승인 전까지 계속0이다.

## 6. 문서 줄바꿈의 비의미 파생 고정

부모 패킷 SHA256 9ff658a010cbd13dc85c64ef5fecd62de762e95679602bd2877952442f6e4d84의 커밋 준비에서 mixed CRLF5곳이 whitespace 검사에 걸렸다. 검사 기준/설정은 유지하고 세 문서의 CRLF만 LF로 바꿨다. 허용목록·원형·숫자·권한·실행 제외와 C0/I0 의미 내용은 동일하다. 아래 변경은 새 기능 채택이나 실제 실행 GO가 아니며, 위 표는 현재 파생 원문 지문이다.

- docs/contracts/FN06_NATIVE_FIRST_RECEIVE_WIRE_PROPOSAL_20261104.md: fec6d8917af33125ccec1170766695b832dd90af26a905074790e03b376416c7 → 6d1a727fb60298c4adcc37ce5066b4032f144e6f42b8a0b74f023d8af56e83f4, 45221 → 45220B, CR 1개만 제거.
- docs/contracts/FN06_NATIVE_FIRST_RECEIVE_ACCOUNTING_PROPOSAL_20261104.md: 103e6a173afd121280cb5be4d245452196cebb54d691e8d0d39d028ead80f4ba → f8667e17830b60791d769a288ec77c82e34649a952bff9faf4ae688bb32c1597, 68810 → 68807B, CR 3개만 제거.
- docs/work_packages/FN06_NATIVE_FIRST_RECEIVE_SOURCE_IMPLEMENTATION_CANDIDATE_20261104.md: 2714a640d2ac3843989d7a53d39cd6099892b41bce08d5bf01bfde6da45cccd4 → c66b3381829513a5a1cb69a0d606fbcd4904e62a4561e8b979bdfad940df43bc, 40550 → 40549B, CR 1개만 제거.
