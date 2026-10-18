# FN08 A3 native host 최소 연결 후보와 필요한 결정

담당 Main 어울, 2026-10-18. **코드 작성 범위 결정 요청이며 실제 실행 승인이 아니다.**

## 1. 실제 공백과 이미 한 일

- C9c6891 기준 C# metadata 라이브러리 컴파일만 성공했다. 결과 DLL은 시험 뒤 제거했고 소비 metadata 2개는 보존한다. compile 성공을 native 실행/OS 검증으로 승격하지 않는다.
- 기존 SourceReadObserver는 strict HTTPS proof→permit→별도 NativeAdapter→strict report 서명/수신 경계다. 이번 SourceReadSnapshotAdapter는 같은 허용 observer/test 파일 안에서 원 permit을 C# Observe 인자(rootPath/source ref/targets/잔여 정수 budget/signal)에 연결하는 코드·합성 후보다. 실호출자/host/IPC/키 공급은 없고 기본 native도 없다.
- 기존 windows-host의 ownership 경로는 만료된 SYNTHETIC_WORKER QA 전용이다. 다른 protected-store 호출도 16KiB/10초의 다른 계약이다. 이들을 live source host로 재사용하거나 과거 승인·경로·세대를 바꾸지 않는다.
- C#에는 Main/CLI/IPC/키/launcher가 없다. Observe는 permission entry가 아니며 current callback도 실제 프로세스 소유/강제 종료 증명이 아니다. 현재 snapshot localEvidence는 image/process null이며 서버 OS_UNVERIFIED·baseline/dispatch false를 유지한다.

## 2. 권장 A — 새 전용 host 경계의 코드·합성 준비만

필요한 결정: 아래 **신규 파일군과 내부 pipe 계약 작성·가짜 transport 시험까지만** 허용한다. 기존 공개 HTTP/wire/DB/인증 계약은 바꾸지 않는다. actual compile/DLLload/native/OS source/새 QA는 포함하지 않는다.

- 신규 `apps/connector/native/SourceReadHost.cs`: 기존 SourceReadObserver와 같은 assembly에 합칠 수 있는 단발 metadata 전용 entry 후보. 일반 shell/임의 executable/다른 작업 연산을 제공하지 않는다. 기존 C# 관측 알고리즘·ProtectedStore/OwnershipHost/CodexHandshakeHost는 수정하지 않는다.
- 신규 `apps/connector/runtime/source-read-host.ts`: SourceReadSnapshotAdapter의 별도 공급 invoke 경계. 외부 경로/허가 boolean을 신뢰하지 않고 추후 실제 승인된 executable/hash/owner·소유 process 결박 제공자와 분리한다. 기본 자동 연결/서버 실행/서비스 상주0이다.
- 직접 `tests/unit/FN08/source-read-host.test.ts` 신규, 기존 source-read-observer.test.ts 연결 음성만 필요 시 보완한다. 계약/FILE_MAP/WORK_STATUS에는 실제 변경 연결만 기록한다.
- 입출력은 argv/환경/평문 spool/로그가 아닌 전용 stdin/stdout 메모리 pipe의 유한 내부 frame 후보로 한정한다. header/길이/버전/열거형/UTF-8/최대200 FILE·전체1MiB를 명시하고 추가 byte·중복/누락·불완전 EOF·잘못된 길이·시간/취소는 fail-closed한다. BCL 기반 명시 필드 순서의 binary frame으로 제한해 새 JSON 패키지/임의 reflection serializer를 추가하지 않는다. 이 frame은 HTTP 보고/실행 허가/공개 API가 아니다.
- 인자는 원 root/sourceRef/targets/잔여 budget만이며 raw credential·private key·permit 전체·새 권한은 host로 전달하지 않는다. source 경로/결과 bytes는 허가된 프로세스 메모리만 소비하고 고정 오류만 공개한다. `SOURCE_READ_OBSERVATION_A3`의 원 root 단일 입력/metadata 범위와 기존 strict report 검사를 보존한다.
- code-level timeout/abort는 실제 프로세스 종료 증거가 아니다. host 수명·OS 실행파일 정체성/손잡이·소유/종료 및 DLL load는 후속 exact source/helper hash·새 빈 합성 NTFS root·finite window·단1회 실행 결정/사전·사후 보호/정리와 독립 실측이 갖춰지기 전 미검증이다.

## 3. 대안·영향·가역성

- A(권장): 별도 최소 host code+합성 준비. 실제 native 선행 연결을 좁히고 기존 서비스/키/자료를 보존한다. 단 실제 OS 안전/성능/종료나 사용자 기능 완료는 증명하지 못한다. 미사용 신규 source/test 제거 또는 정상 후속 commit으로 되돌릴 수 있다.
- B: 새 native addon/일반 CLR bridge 도입. 상주 runtime·새 dependency/ABI·키/소유 경계와 배포 영향이 커 현재 최소 연결에는 권장하지 않는다. 이번 범위에 포함하지 않는다.
- C: host를 보류하고 독립적인 UI04/FN09 등 기존 화면·문서 연결을 계속한다. 새 OS 위험0이나 실제 지정 소스 관측과 Agent 실행 선행은 계속 남는다. 만료 ownership QA/소진 compile를 재사용하는 우회는 대안으로 제안하지 않는다.

## 4. Main 자율 진행과 보존 경계

Main은 A의 결정/지원만 PMO에 요청하며 다음 작업 배정을 기다리지 않는다. 그동안 승인된 UI04 선택 단계의 기존 정의/자료 표시 공백을 직접 대조·보완한다. 정식0012 거절/적용0·원 질문 상태와 기존 native 미검증을 보존한다. 새 decision 미수신 중에는 위 신규 host 파일 작성/실행0이며 현재 adapter 후보만 검수/안전 checkpoint한다. 이번 제안은 기존 파일군 밖 security-sensitive host 경계라 임의 확대하지 않는다.
