# FN08 A3 보호 관측 실행기 연결 — 필요한 구현 범위 결정

담당 Main 어울, 2026-10-18. **권장A 한정 준비 허용 전달 완료.** PMO가 요청turn01a14b48-9970-74c2-aaa4-e2c1af47ece5 완료 UTC19:15:13Z→실clock19:25:48Z/10분35초·최신5turn의 답변/중지/거절/수정 부재를 대조해 신산님 직접 위임의 권장A만 전달했다. ‘뭐하니?’는 상태 질문이며 승인/거절/중지로 해석하지 않았다. 아래 제안 당시 상태/대안은 이력이다. Main이 선정한 업무의 필요한 구현 범위 결정이며 PMO 새 업무 배정/실제 native 실행 허용이 아니다.

## 허용 후 최소 시작 패킷·현재 증거

후속 검수: 독립 C0/I2/M0는 credential 잔여기한의 native timer/budget 누락과 임의 접두사/close 오류 비노출 경계 보완을 요구했다. Main이 신규3 RED→단1회 보정, 직접17/인접18 총35 PASS305.2509ms/type/diff0를 확인했다. 새 독립 재검토를 하지 않았으며 원 C0/I2·Main 보정·native compile/actual 미검증을 A3_CONNECTOR_OBSERVER_PREP_RESULT.md에 구분했다. 이 상태를 전체 Agent/관측 완료로 표시하지 않는다.

- 기준 기존 branch codex/av3-stage-b / local-private1b22219347623f242c8e7fe5f4b50f1fb5d0afdc clean / mainf976 불변. 실제 개발 runtime·WSL6781703a/N4 성공은 별도이며 이번 변경을 자동 재시작·반영하지 않는다. writer Main1, 독립 검수는 읽기 전용이다.
- 정확 제품/직접시험5파일은 아래 예상 파일군과 동일하게 고정했다. runtime/source-read-https는 기존 strict codec·scope/별도 endpoint를 소비하고, observers/source-read-observer는 고정 scope→proof→permit→별도 adapter→strict report의 한 번 흐름을 소유한다. native/SourceReadObserver.cs는 entry/CLI/IPC/키/프로세스 실행 없는 metadata 라이브러리 소스 후보다. 실제 보호 host/native adapter 공급·컴파일·hash/소유 process 결박은 다음 actual 준비 경계로 남기며 기본 native는 없다.
- 선행/산출 연결: 서버 current grant/DB46·N1 codec/N2 signature/strict response를 재사용. 정확 permit root 원문만 adapter로 전달하고 canonicalPath 재입력0·UNC/WSL 변환0이다. 기본 미지원은 OBSERVER_UNAVAILABLE/UNVERIFIED만 보고한다. nonce·sign은 opaque provider이고 이번 시험은 합성 메모리 입력/가짜 transport뿐이다. 실제 개인키/서버 토큰·OS 관측·Agent 호출 증거가 아니다.
- TDD: 신규 두 모듈 부재 RED12→최소 구현, 별도 pending close가 request를 취소하지 않는 결함 RED1→수정. 직접14 + 기존 codec13/proof5 =32 PASS277.2317ms/typecheck/diff0. 초기 타입검사 nullable/배열 narrowing6·기존 fixture literal widening1은 검사 오류로 고치고 동일 기대값을 유지했다. 실제 ISSUE transport 실패와 단순 close를 서로 다른 시험으로 분리해 잘못된 시험명으로 유실 검증을 주장하지 않는다.
- 허용된 새 observers 디렉터리의 최초 apply_patch는 부모 생성 권한 때문에 쓰기 전 실패1, 정확 부모 nonlink·부재를 읽고 해당 디렉터리1개만 승인된 경로로 생성했다. 신규 native 파일은 작성만 했으며 compile/문법실행/실OS 시험0이다. 알려진 codec·타입·fake 경계를 OS PASS로 승격하지 않는다.
- API 근거는 Microsoft 공식 NtCreateFile·FILE_ID_INFO·GetFinalPathNameByHandleW·GetFileInformationByHandleEx·FILE_BASIC_INFO/FILE_STANDARD_INFO·GetVolumeInformationByHandleW·GetDriveTypeW를 직접 대조했다. 최초 GetFileInformationByHandleEx의 fileapi 주소404는 winbase 공식 경로로 정정했으며 API 지원 actual 성공이 아니다. 경합/alias·소유 host/프로세스/강제중지·키/TLS/서버저장·실제 UI는 미검증이다.
- 판정/다음: 독립 읽기 검토 중, 코드5파일 동결·계약/현황만 기록한다. Critical/Important가 있으면 Main이 원 r2 안에서 한 번 좁은 RED→GREEN 보정하고, safe checkpoint/private·미검증/정확 actual 필요만 PMO 전달한다. 전체 FN08/Agent 연결 완료·새 actual 승인·서비스 재전환 권한으로 해석하지 않는다.

## 선정·근거

- 승인 계획 FN06/FN08·UI11과 SOURCE_READ_OBSERVATION_A3.md r2 §4~9를 소비한다. 서버 protocol/DB46·UI 후보와 N4 새 API/Web 연결은 이미 구현/한정 확인했으므로 다시 작성·전수 검증하지 않는다.
- 실제 코딩 Agent가 지정 소스에서 작업하려면 선언 문자열과 실제 OS 객체를 구분해야 한다. 현재는 서명 보고를 CONNECTOR_REPORTED/OS UNVERIFIED로만 취급하며 실제 metadata observer·보호 교환 소비가 빠져 있다. 이 공백을 Agent 실행 완료나 VERIFIED baseline으로 숨기지 않는다.
- 현재 구현 승인 A3-LOCAL-IMPLEMENTATION은 공통 계약/서버/SQL 작성/UI와 합성 시험 범위였고 r2 §7의 새 Windows native는 별도다. N4 단1회 서비스 승인은 소진됐다. 따라서 새 native 코드/컴파일/합성 root 실행을 이전 승인에 포함시키지 않는다.

## 권장 A — 연결 코드·합성 검증 준비만 먼저

- 기존 r2의 목적·자료형·상한을 그대로 소비하는 별도 connector HTTPS 소비자, FILE metadata observer/native adapter와 직접 시험을 작성한다. 기존 상태전용 TrustHttpsClient·OwnershipHost·ProtectedStore·동결 helper·서비스 launcher를 재작성하거나 권한을 확대하지 않는다.
- 예상 허용 파일군: apps/connector/runtime/source-read-https.ts, apps/connector/observers/source-read-observer.ts, apps/connector/native/SourceReadObserver.cs, 직접 tests/unit/FN08/source-read-https.test.ts·source-read-observer.test.ts, 계약/현황/FILE_MAP의 실제 변경 연결. 정확 인터페이스/목록은 기존 코드 대조 뒤 최소 시작 패킷으로 고정하며 이 파일군 밖의 공개 계약/보호 저장 변경은 다시 결정한다.
- 기존 strict codec·P-256 proof 형식·현재 scope/permit/ref/hash/기한을 소비한다. endpoint는 이미 구현한 exchange/permit/report만, redirect/fallback·등록 상태 token 재사용0·raw credential/경로의 argv/환경/평문로그/파일0이다. 순수 시험의 가짜 transport/opaque signer를 실제 네트워크·보호 키 사용 증거로 승격하지 않는다.
- native는 기존 r2대로 Windows-local NTFS·지정 FILE≤200·메타데이터만, root/중간 handle 유지·segment 상대 열기·reparse/volume/identity/이탈 거절·READ_ATTRIBUTES와 필요한 traverse/control만이다. 내용/해시/Git/디렉터리 열거·재귀/쓰기/삭제/Agent 실행·UNC/WSL 매핑은 제외한다.
- 이번 결정은 코드 작성·로컬 순수/가짜 transport TDD·문법/타입 검증과 독립 읽기 검토까지만이다. 실제 새 native compile/helper 실행/OS 경로 관측·보호 키 생성/사용·DPAPI/ACL·실 token·등록/계정/정책·DB/서비스·Agent/유료호출/Oracle/main 변경은 하지 않는다.
- 코드 검토 뒤 실제 compiler/helper/source hash·새 빈 합성 NTFS QA root·파일/링크 음성·프로세스/handle·수명/정리/보호자료·유한 창·단1회 gate를 정확히 제시하여 별도 actual 결정을 받는다. 문서/순수 PASS는 OS 지원 PASS가 아니다.

## 대안·판단

- A(권장): 준비 코드부터 연결하여 실제 Agent의 안전한 지정 소스 관측 선행을 좁힌다. 현재 서비스·자료에 영향 없지만 actual 전까지 OS/Agent 지원은 미확인이다.
- B: native 연결을 보류하고 기존 서버/화면만 유지한다. 새 OS 위험은 없으나 실제 Agent 연결 선행이 남는다. 그동안 독립적인 승인 계획 기능은 Main이 선정하여 진행한다.
- 현재 실행/코드 작성은0. 필요한 정확 결정은 A의 한정 코드/순수 검증 범위를 승인할지이며, PMO가 후속 업무를 배정하는 것이 아니다. 새 scope/권한·계약 변경이 없으면 완료된 서버/SQL/후보 browser·N4 전환을 반복하지 않는다.
