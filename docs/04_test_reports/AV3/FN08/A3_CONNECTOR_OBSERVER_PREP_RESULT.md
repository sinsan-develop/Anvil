# A3 connector observer 한정 준비 결과

판정: **한정 준비 구현·순수/가짜 transport 검증. 실제 연결·OS 지원·Agent 완료가 아니다.** Main 어울, 2026-10-18.

## 승인·파일

- PMO AV3-PMO-A3-CONNECTOR-OBSERVER-PREP는 요청turn01a14b48-9970-74c2-aaa4-e2c1af47ece5 완료19:15:13Z→실clock19:25:48Z/10분35초·답변/중지/거절 부재를 대조한 직접 위임 권장A다. 코드/순수·가짜 transport TDD·타입/문법·독립 읽기만 허용하며 실제 native compile/helper/OS·보호 키/등록·계정정책·DB/서비스·Agent/Oracle/main 변경은 제외했다.
- 기존 codex/av3-stage-b의 기준1b22219347623f242c8e7fe5f4b50f1fb5d0afdc에서 Main 단일 writer, 신규 제품3·직접시험2만 작성했다. runtime/source-read-https.ts, observers/source-read-observer.ts, native/SourceReadObserver.cs, tests/unit/FN08/source-read-https.test.ts·source-read-observer.test.ts다.
- 기존 서버/SQL/Web·공통 codec·TrustHttpsClient/ProtectedStore/OwnershipHost/동결 helper·launcher는 변경하지 않았다. 개발 서비스와 WSL은 N4 actual6781703a이며 이 준비를 반영·재시작하지 않았다.

## 연결과 실제 확인 범위

1. HTTPS 소비자는 별도 source-read exchange/issue/permit/report만 소비한다. strict TLS/고정3830 origin·no-store·10초/본문한도·중복 wire키·redirect 차단·scope/ref/hash·권한 false를 검사한다. 토큰은 private 메모리에만 두고 공개 getter/일반 결과·로그/파일/argv로 반환하지 않는다. 오류 뒤 UNKNOWN·자동 재발급/재전송0, close는 pending 요청도 취소한다.
2. 관측 흐름은 exact scope→서명 preflight/challenge→검증 permit 원 root→별도 adapter→strict report를 한 번 구성한다. permit의 credential 잔여기한과 전체 단조30초 중 짧은 deadline을 timer/대기/adapter에 동일 적용한다. 기본 adapter가 없으면 OBSERVER_UNAVAILABLE/OS UNVERIFIED만 보고한다. path 변환/Agent/실행 권한을 만들지 않는다.
3. native는 entry/CLI/IPC/키·프로세스 실행이 없는 C# 라이브러리 **소스 후보**다. NTFS·held drive/root/중간 handle, segment 상대 FILE_OPEN, 최소 READ_ATTRIBUTES/디렉터리 traverse·synchronize, reparse/alias/volume/identity·hardlink/변경 거절과 finally close를 작성했다. **컴파일/ABI/flag·실OS·실handle/강제 종료·보호 host/native adapter 연결은 미실행/미검증**이다. 이 소스가 있는 사실이나 가짜 adapter의 결과는 실OS 안전을 증명하지 않는다.

## 검증·오류·독립 검수

- 신규 모듈 부재 RED12→최소 구현, HTTPS pending close의 미취소 RED1→보정. 직접14+기존 codec13/proof5=32 PASS277.2317ms/type/diff0.
- 독립 읽기 **C0/I2/M0**: I1 credential 잔여기한이 native budget/timer에 미반영, I2 접두사 정규식만으로 임의 provider 오류가 공개되고 finally close가 원 실패를 덮을 수 있음. reviewer는 실제 실행/컴파일·OS/TLS/키/DB/Agent를 판단하지 않았다.
- Main의 단1회 보정: pending credential10ms·접두사 임의 signer/native 오류·close 원 실패 보존/성공뒤 정리 실패의 신규3시험을 먼저 실행해 **RED3**를 확인했다. deadline 고정/짧은 timer·동일 adapter budget, 정확 오류 allowlist·generic 차단, 원 primary 보존과 별도 고정 cleanupFailure를 최소 보완했다.
- 보완 후 정확 명령 `node --test tests/unit/FN08/source-read-https.test.ts tests/unit/FN08/source-read-observer.test.ts tests/unit/FN08/source-read-contracts.test.ts tests/unit/FN08/source-read-proof.test.ts`: **35 PASS / FAIL0 / SKIP0 / 305.2509ms / exit0**. `npm run typecheck`·`git diff --check` exit0. 보정 후 새 독립 재검토 C0/I0로 위조하지 않는다. 원 C0/I2와 Main 보정/증거를 구별한다.
- 네트워크/원문/기존 DB·서비스/OS 소스 관측·native compile/helper/보호 개인키·실제 token·Agent 호출은0이다. 기존 인접 서명 시험의 메모리 합성 P-256을 실제 키 사용으로 확대하지 않는다.
- 초기 TS nullable/배열 narrowing6 및 fixture literal widening1은 같은 기대값으로 보완했다. observers 부모 생성 권한 실패1은 정확 경로/부모nonlink·부재 후 새 폴더1개만 생성하여 해결했다. 문서/fixture 추정 경로의 읽기 실패는 파일 검색/실제 import로 정정, ACL 변경0.
- 새 QA root/프로세스/DB·서비스 자원은 생성0이므로 이번 정리 대상0이다. 신규 소스 폴더는 제품 자료로 보존한다. N4 성공 runtime/old backup·원 실패자료는 그대로다.

## 근거·미검증·다음

- API 근거: [NtCreateFile](https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntcreatefile), [FILE_ID_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info), [GetFinalPathNameByHandleW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew), [GetFileInformationByHandleEx](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getfileinformationbyhandleex), [GetVolumeInformationByHandleW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getvolumeinformationbyhandlew). 문서 API와 소스 검토는 실제 Windows 빌드/파일시스템/경합 PASS가 아니다.
- C# 직접 시험은 compile 허용이 없어 수행하지 않았다. 현재 상태는 라이브러리 소스 미검증이며 실제 native provider/entry/보호 permit 결박/부모 소유 프로세스·강제 중지·hash·잔류0/기존키 서명·실 HTTPS/서버 저장·UI/Agent 여정은 남아 있다.
- 다음 Main 선정의 가장 작은 실제 경계는 고정 compiler/source의 **새 일회성 library compile-only**다. 명시 허용 전에는 compiler를 실행하지 않는다. 이후 합성 NTFS root/링크·rename/alias 음성/handle·단조기한/정리 actual은 별도 정확 helper/fixture·프로세스·창으로 결정한다. compile PASS만으로 관측 지원이나 사용 가능으로 바꾸지 않는다.
- rollback은 이 미연결 신규5파일을 후속 정상 commit에서 되돌리는 방식이며 기존 DB/서비스/키를 되돌릴 필요가 없다. reset/clean/과거 실패 PASS 승격·Main 다음 업무 배정 대기0이다.
