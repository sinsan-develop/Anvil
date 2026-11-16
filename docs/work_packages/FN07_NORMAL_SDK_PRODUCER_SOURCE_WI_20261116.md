# FN07 실제 normal SDK 생산자 소스 구현 단위

기준 main19e0430705f667593972524ed7c1c1c4e3cf1b66(PR159). 목표는 승인된 WORK_PLAN FN07/FN08의 기존 코딩 Agent 연결에서 외부 fixed.create 주입으로 남은 생산자를 고정 SDK package 검산·격리된 원 worker·목적한정 원 child bridge·실제 query factory로 닫는 것이다. 실제 설치/새 권한 적용/키·DB·서비스/SDK·CLI·Agent/C# 실행은 승인하지 않는다. 기존 정상 소비자·START/SEND/STOP·spool과 등록주체/서버 endpoint/권한DB행은 유지한다.

## 단계 1 — 현재 허용 쓰기

기존 Primary 한 명은 docs/work_packages/FN07_NORMAL_SDK_PRODUCER_IMPLEMENTATION_SPEC_20261116.md 한 파일만 먼저 작성한다. 기존 사실 조사와 다섯 native 호출선을 재사용하고 Main의 검수 전에 제품/시험 파일은 쓰지 않는다. Main은 WORK_STATUS/WORK_CHECK를 ledger로 유지하고 현황/Git·독립 검수를 맡는다. 새 agent/자동화/별도 작업공간/소스 조사 범위를 만들지 않는다. 다른 담당자의 변경을 되돌리지 않는다.

문서는 한국어로 목표·구성·기술기준·설계근거(기존 승인계획/계약의 정확 절)·공통제약·검수초점5개를 먼저 적고, 정확 닫힌 파일맵과 입력/출력 함수 서명/타입 및 순서별 시험→구현→검증 체크박스를 작성한다. 기존 docs/work_packages의 위치와 WORK_STATUS ledger가 스킬 기본 경로를 대신한다. 기존 사용자 지정인 동일 Primary 구현/Main 검수·통합 방식을 유지하며 같은 구현의 인적 재승인 절차를 추가하지 않는다. Main이 설계대조·서명일관성·검수사례·과도한범위 여부를 자기검토하고 독립 검수 뒤 단계2의 정확 제품경로/작업을 배정한다.

## 지켜야 할 실제 경계

- 기존 NativePreparationWorkerProvenanceSource의 OwnershipEvidenceWorker.exe 목적과 기존 CodexHandshakeHost 고정 handshake 권한·NORMAL_SPOOL/SIGN_NATIVE_PREPARATION_PROOF 프레임을 넓히거나 spawn으로 재해석하지 않는다. CodexHandshakeHost의 실제 suspended 생성·HANDLE_LIST/JOB_LIST·이미지/원 handle·원 thread Resume·정확 회수 선례를 사용하되 SDK 전용 목적/코드를 분리한다.
- 새 SDK 실행의 등록 owner/READY/첫 SEND/원 Query/iterator/collector를 처음부터 같은 격리 worker에서 발급한다. 이미 발급된 owner/WeakMap/Query·permit을 복제·전송하거나 façade를 원 Query로 등록하지 않는다. 같은 등록주체 아래 새 SDK worker의 실제 OS peer/고정 bootstrap/package 검산과 최초 발급을 구현한다. 실제 미확인 권한을 true로 선언하지 않는다.
- 검산된 SDK0.3.224 package/mjs 및 전이 load closure·runtime·CLI 선택, 원 sourceRoot/cwd·명시 env proof가 있어야 한다. 고정 tar/mjs 지문은 기존 결과를 재사용하며 SDK 추가조회/설치0. 기본CLI 파일명/배포 closure는 미확인이다. PATH claude.exe를 SDK 필수 대상으로 가정하거나 IMAGE_SIZE 한도를 늘리지 않는다. script 선택이면 원 runtime+script bytes/argv, image 선택이면 원 image/argv를 검산한다. 누락·위조·가변경로 verify→재열기는 효과 전 거절한다.
- 원 normal grant/slot/시도·세대·기한 및 승인된 정확 package/CLI/작업root/env에 묶인 자식1만 허용한다. 새 서버API/로그인주체/범용spawn opcode/권한DB행은 만들지 않는다. 기존 normal grant가 허용하지 않는 실제 효과/새 신뢰주체가 필요하면 정확 delta를 Main에 반환한다. 단순히 현재 구현이 준비용이라는 사실과 계획 밖의 새 요구를 구분한다. 실제 CLI/SDK 호출·외부 비용·설치·권한 적용 승인은 만들지 않는다.
- query({prompt,options})는 FIRST3행 정착·원 current 이후만 원 worker에서 1회 호출, 원 Query/iterator를 그대로 유지한다. 후속 같은 Query 입력·보호 출력·STOP/ACK와 실제 child 종료를 구분한다. process.env는 controller와 공유하지 않는다. resume/continue/sessionStore 자동복구0.
- 동기 spawn hook에 Promise를 반환하지 않는다. 원 기한의 잔여만 기다리는 worker와 별도 제어루프가 취소/peer상실·늦은 응답을 수거한다. 메시지/SAB/callback 자체를 권위로 삼지 않는다. private 입력/응답·queue/전체전송·backpressure·stdout/stderr/EOF/error/exit 및 취소/정리 상태를 유한값과 원 한도에 연결해 명시한다. 기존10초/64frame 및 normal horizon·본문2MiB·공동spool256MiB를 임의 확대하거나 handshake15초를 SDK 전체에 이월하지 않는다. native 양성/재개는 원 handle·job·이미지·grant/기한 재검산 뒤만, 늦은 생성/종료불명은 원 소유 보존·재시도/새 Query0이다.
- 실제 C#/OS/SDK 실행은 하지 않는다. RAM/정적 검수는 합성 근거로 명시하고 실제 Native identity·Win32/pipe·SDK import/모델 호출·사용자 인수로 승격하지 않는다. caller 자기선언/가짜 current/native callback을 실제 권위 생산자 대신 내지 않는다. 긍정 fixture는 합성인 범위와 실제 source의 검산 경로를 분리한다.

## 단계 2 — 다음 배정에 필요한 내용

2026-11-17 Main 배정 보완: 검수된 명세의 제품12/시험3에 `apps/connector/native/NormalExecutionSpoolProfileSource.cs` 한 제품 경로를 추가한다. 기존 관리행과 배정의 실제 FIRST3 정착·record/slot·현재 원 scope를 목적 한정 internal 함수로 재판독하는 범위다. 일반 Control opcode·외부 파일 경로·기존 저장 형상·권한을 넓히지 않는다. 원 행을 검산할 수 없으면 lease/생성은 0이다. 기존 Primary 단일 writer가 제품13/시험3을 소유하고 Main이 검수·통합한다. 이는 기존 보호 자료의 내부 검산 보완이며 새 공개·저장·실행 승인을 뜻하지 않는다.

하나의 실제 생산자 흐름을 A(고정package/최초owner)→B(native 원child/pipe/lifetime)→C(격리SDK loader/동기hook/같은Query)→D(기존bootstrap/SEND/collector/STOP 통합) 순서로 작성한다. 의미 있는 검수 가능한 단위로 나누고 단순 scaffold/helper만으로 종료하지 않는다. 각 단계의 정확 경로·함수서명·기존 타입 재사용/정당한 내부확장·구체적 RED/PASS 명령과 다음 단계 인터페이스를 적는다. 신뢰근거 누락/교차등록·오래된slot/부정package/argv/env/cwd는 load/spawn0, suspended 후/Resume 직전 만료는 Resume0·자기handle만회수, Query/iterator각1과후속/보호저장/STOP·late/backpressure/서로다른owner정리0을 소유 시험에 매핑한다. 미확인 값에 임의 필수 파일명/서명/키/검증성공을 채우지 않는다. Main은 이 문서와 경계 판정을 확인해 실제 구현을 계속 배정한다.
