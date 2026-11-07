# FN03 native 내용 해시 관측 소스 구현 지시서

- 상태 MAIN_SOURCE_ONLY_GO. 채택 B source 계약 §5·§11의 미구현 핵심 코드 작성이며 실제 컴파일·실행 승인이 아니다.
- 기준 HEAD1867bdcd950ee69be162b4a29a39714e99e41a6c. 기존 A3 metadata 관측기·proof-input·등록/호스트/서버/SQL은 불변이다.
- 단일 code writer 기존 Primary. Main은 현황·검수·통합, 기존 독립 담당자는 read-only다. 다른 작업자와 보호3를 보존한다.
- 정확 신규2: apps/connector/native/SourceContentObserver.cs, tests/native/FN03/SourceContentObserverSourceTests.cs. 부재를 확인하고 작성한다. 기존 source2 서명 검산과 SourceReadObserver.cs는 수정하지 않는다.

## 기능

CONTENT 전용 private factory가 원 root·중간 directory·leaf를 상대 handle로 확보한다. root/dir에는 데이터 읽기를 주지 않고 leaf에만 FILE_READ_DATA를 추가한다. ShareRead·reparse/volume·한 하드링크·로컬지원/경로·실제 파일종류·identity를 원 B대로 검사한다. 기존 metadata 코드의 private 보호 경계는 참고하고 이름만 바꿔 권위를 전용하지 않는다. 외부 caller handle/hash/signer·일반 path 재오픈·외부 process·host 등록/entry를 만들지 않는다.

최초 크기로 개별2MiB·누적20MiB를 검사하고 같은 leaf handle에서 최대65536B씩 raw SHA256한다. 부분 읽기는 계속 읽고, 조기 0/오류·최초길이 초과·마지막 별도 1byte EOF probe를 구분한다. BOM/CRLF/빈 파일도 원 bytes 그대로다. 최초길이 소진과 EOF 뒤 같은 file 및 보유 root/중간dir의 identity·size/time·links/reparse·volume/귀속을 재대조하고 마지막 시각/현재성 검사 뒤에만 HASHED와 blobHash/정확 byte 수를 내놓는다. canonical identity hash 원형은 기존 계약과 일치시킨다. 첫 실패 뒤 suffix는 미시도이며 다음 파일 open0, root 실패는 전체 root unavailable, 자동 관측 재시도0이다. 한 target 실패면 전체 보고는 부분결과·LINK0으로 표현한다.

고정 단조30초와 최초 permit 잔여기한 최소를 한 번 고정하며 UTC 역행/취소/만료는 새 파일·read 시작과 결과 채택을 막는다. 서명·키·등록·observer 승인/실제 관측 verification receipt·LINK 허가를 생산하지 않는다. 이 소스는 기본 호스트/route/IPC에 등록하지 않는다.

## I/O 소유·취소 — 사전 검토 I1의 필수 보완

30초는 데이터 관측/새 작업과 채택의 상한이며, OS 종료나 함수가 반드시30초 내 반환한다는 보장이 아니다. 취소/만료 뒤 정확 자기 pending I/O에만 취소를 요청하고 실제 최종 completion 정착까지 같은 owner가 buffer·OVERLAPPED/IOSB·event·file 및 ancestor pins를 보유한다. late bytes/hash는 폐기하고 다음 파일을 열지 않는다. CancelIoEx 성공/ERROR_NOT_FOUND를 completion으로 취급하지 않는다. 실제 정착 전에 해제/재사용·cleanup 성공·관측완료를 표시하지 않는다. 함수가 정착을 기다리면 그동안 native가 미종료일 수 있음을 명시하고 성공 예외로 숨기지 않는다.

native async leaf/open을 선택하면 요청 뒤에도 유효한 unmanaged pointer 크기의 OVERLAPPED/IO_STATUS_BLOCK, buffer와 arg 수명을 확보하고 명시 offset·완료 byte 수를 검산한다. 일시 marshalling/stack 배열을 pending kernel 작업에 남기지 않는다. NtCreateFile의 STATUS_PENDING 가능 경계에서도 handle/IOSB·이름/OBJECT_ATTRIBUTES를 실제 정착까지 보유한다. 알려지지 않은 완료 상태는 해제/성공으로 진행하지 않는다. 필요한 경우 안전 소유 방법을 먼저 Main에 제시하며 새 저장/권위나 host를 추가하지 않는다. ReOpenFile을 기존 NtCreateFile handle에 문서 근거 없이 적용하지 않는다.

공식 검토 근거(실행 증거가 아님):
- https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-cancelioex
- https://learn.microsoft.com/windows/win32/api/winternl/nf-winternl-ntcreatefile

## 검수·증거

컴파일/하네스/PInvoke/실제 파일은 실행하지 않는다. 테스트 코드를 먼저 작성해 실제 source 알고리즘의 internal memory byte/metadata/clock seam을 소비하게 하되 아직 NOT_RUN으로 남긴다. 합성 seam과 concrete private factory는 구분하며 성공 callback을 실제 관측 권위로 쓰지 않는다. empty/BOM/CRLF/2MiB 및 누적경계·short read/조기EOF/추가byte·identity/time/reparse/link/volume 변이·첫실패 후 open0·UTC역행/취소/만료·HOLD/late정착·자기 자원회수 시나리오를 작성한다. 수명/포인터/ABI·metadata 인접·fixed error/원자료/완전성은 독립 소스 검수한다.

실행하지 않은 C# 시험의 RED/GREEN·PASS를 만들지 않는다. 소스 정적/형상 확인은 런타임 동작/Windows 지원 증거가 아니다. 신규2 원문·정확 diff/hash·구현/시험 작성·미컴파일·미실행/남은 I1·오류횟수·live0를 Main에 반환하고 동결한다. 실제 바이너리/ABI/OS cancel/회수·writable mapping/악성 ABA·서명/보호 채널·현재 등록·LINK/사용자 인수는 별도 미검증이다.

실제 파일/키/권한/DB/서비스·C# compiler/하네스·PInvoke·프로세스/Agent/SDK·외부/원격/PR/병합0이다. 새 승인 없이 원 source2를 실행 포트에 연결하지 않는다.


## Main I/O 상세 결정 — pending open과 read 취소 구분

부모 지문4EA0D7B2AB11135B0319276B593EF0565B64E630C116B32293079ABE48F33D71의 정확2/실행금지 범위는 유지한다. NtCancelIoFileEx의 NT IOSB 3인자 ABI를 현재 근거로 확증하지 못했으므로 import/호출을 작성하지 않는다. Microsoft devnotes는 Win32식2인자 형식으로 기술되어 이 NT ABI의 근거로 전용하지 않는다.

async NtCreateFile의 pending open에서 취소/기한이 관측되면 결과 채택과 후속 동작을 막고, 같은 owner가 unmanaged IOSB·handle out 저장·UNICODE_STRING/OBJECT_ATTRIBUTES/문자열과 ancestor pins를 실제 완료까지 보유한다. 해당 open의 OS 취소나 유한 시간 반환은 보장하지 않는다. open이 늦게 정착해도 그 자료는 즉시 폐기하고 안전 정리하며 데이터 read·다음 file open0이다. pending open을 실패로 간주해 인자/handle을 조기 해제하지 않는다. 이 제약은 native source/합성 미실행 시험에 직접 표현한다.

후속 ReadFile pending은 검증된 CancelIoEx(handle,정확 OVERLAPPED)에 취소를 요청하고 GetOverlappedResult의 실제 completion까지 동일 자원을 보유한다. 성공/ERROR_NOT_FOUND는 완료 증거가 아니다. pending open과 read 모두30초/permit은 새 관측과 채택 상한이며 OS정착/함수 반환 상한을 주장하지 않는다. signer/권위/기본등록·실제 실행은 여전히0이다.
