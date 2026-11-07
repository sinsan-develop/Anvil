# FN06 native physical factory 생성·검산·소비 source 작업지시서

- 날짜: 2026-11-02 / r1 / Main 어울 / 단일 구현자 fn16_primary_recovered
- 계획 연결: WORK_PLAN FN06·FN08 native 준비의 미완료 build/basis/physical factory 공급. 선행 code c66fa5653b3da80a37153a18eac5e29491dfff7e, 기록 checkpoint 6812b7b9fb45660d304e7136e4eed01f5174e057.
- 기준: FN06_NATIVE_PREPARATION_AUTHORITY_CURRENT_CONSUME_CANDIDATE_20261102.md SHA256 5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085, r2 A 승인 기록 SHA256 9B10475C96E993112B104F1813A86B1B2A2E401429CBED293100ACA036E17567.
- 이번은 기존 승인 source-only 내부 연결이다. 실제 compiler/OS/native/helper/Agent 실행·DB·권한·키·서비스·실자료 조사·P03R3는 제외한다. 출력 구조 시험은 실제 컴파일 성공이 아니다.

## 1. 구현 책임·정확 허용 신규8

1. contracts/runtime/native-physical-factory-v1.ts
2. apps/desktop/scripts/native-physical-factory-build.cjs
3. apps/desktop/scripts/verify-native-physical-factory.cjs
4. apps/server/modules/executions/native-physical-factory-source.ts
5. apps/connector/runtime/native-physical-factory-image-source.ts
6. tests/unit/FN06/native-physical-factory-build.test.ts
7. tests/unit/FN06/native-physical-factory-source.test.ts
8. tests/unit/FN06/native-physical-factory-image.test.ts

기존 파일은 읽기만 한다. 추가 변경이 꼭 필요하면 exact delta·기존 계약 대비 이유를 Main에게 반환하며 임의 확장하지 않는다. Main은 제품 쓰기를 하지 않고 문서·검수·Git 통합을 맡는다. 다른 담당의 작업/보호 untracked3/원 fixture·SQL·SDK·기존 실행안은 보존한다. 제품 writer는 Primary 한 명이다.

## 2. 생성·출력 검산

기존 FN18 verifyPackageHardening을 실제 소비한다. 부모 package의 검산 원 snapshot·exe/ASAR/header hash를 고정하며 관측 뒤 변경된 package를 새 기준으로 채택하지 않는다. 부모의 검산 전후 snapshot은 동일해야 한다. 검산 함수 자체를 성공 stub으로 바꾼 통합 시험은 인정하지 않는다.

기존 ParentBasis exact8/8KiB와 resource 이름 Anvil.Native.NativePreparationOwner.ParentBasis.v1을 재사용한다. physicalNamespace=ANVIL_NATIVE_OWNER_FACTORY_V1. helper hash를 부모 ASAR/basis에 넣지 않으므로 순환 생성이 없다.

실제 native 최소폐쇄14는 기존 OwnershipEvidence JobFactory/JobAssignment/ProcessStartup/ProcessOwner/WorkerInput/PreparedFacts/ImageOwner/ImageBinding/Root/Host 10, NativePreparationOwnerBridgeSource 및 ParentBasis/Peer/Host 4다. 실제 inventory로 정확 이름·bytes hash를 고정한다. QA OwnershipHost.Main·Worker.Main·PreparationInput을 혼입하지 않는다.

생성기는 compiler/reference/source hash·고정 출력·basis 바이트·정확 인자를 묶은 입력을 생산한다. /noconfig /nostdlib+ /target:exe /platform:x64 /optimize+ /debug- /main:NativePreparationOwnerHostSource 와 /resource:<basis>,Anvil.Native.NativePreparationOwner.ParentBasis.v1,private, 고정 Framework 참조4만 사용한다. response file·키/서명·분석기·일반 쉘 명령·암묵 실행0. 이번에는 compiler를 호출하지 않는다.

설치된 pe-library의 읽기 기능과 필요한 유한 CLI 판독으로 출력 bytes를 검산한다. PE writer/generate/patch/Assembly.Load/ReflectionOnlyLoad 금지다. x64 EXE·CLI managed entry·metadata streams/ranges/index 폭·정확 이름의 embedded resource 단1개/private flag/implementation0·basis exact bytes를 검사한다. 외부 File/AssemblyRef resource·중복·public·잘림·overflow·지원 밖 metadata는 닫는다. 표 해석은 ECMA-335 II.22.24/II.23.1.9/II.24를 따르고 추정 offset을 쓰지 않는다. parser 크기·행/stream 수·전체 bytes·시간 한도는 코드와 반례에서 유한하게 고정한다.

검산된 최종 helper 전체 SHA256을 새 physical namespace의 factoryRef.contentHash로만 쓴다. 기존 generic ref/hash 의미는 변경하지 않는다. 같은 id/version에 다른 hash, 같은 fullref에 다른 bytes/basis를 재결박하면 거절한다.

## 3. 실제 소비

서버는 기존 project-native-preparations.ts NativePreparationSource.options/current의 실제 등록·정책·원 source·현재성·인증 문맥을 보존하며 같은 physical fullref를 소비한다. 단순 manifest/raw JSON/bytes 모양으로 VERIFIED_PREPARATION_SUPPORTED를 만들지 않는다. 실제 보호 current·등록·peer 근거가 없으면 기본 미등록/거절이다.

부모 image supplier는 같은 ref에 대해 contentHash=executableHash를 강제한다. 기존 Client/private context→launcher의 원 ref·현재 guard·최초 전체 budget·실제 image bytes hash 대조를 재사용한다. helper startup의 자기 embedded basis/부모 peer 검산을 우회하지 않는다. runtime server/connector는 desktop/scripts를 import하지 않는다(현재 packaging에서 scripts 제외). build parser는 build 전용이다.

## 4. 검증·등록 QA

TDD: 모듈/실연결 부재 RED → 새 생산/검산/서버 current/Client→launcher 명시 fake child GREEN. 반례는 부모 검산 후 변경, source 누락/QA 혼입, 잘못된 entry/resource/public/linked/중복/변조, factory/version/hash/basis 불일치, supplier 교체·원 기한 만료·지원 근거 부재다. 기존 기준·기대값을 낮추지 않는다.

실제 FN18 파일 판독용 합성 자원은 시험 코드가 준비된 뒤 Main 등록/GO를 받아 한 번만 생성한다. 후보 root D:\tmp\anvil-v3-native-physical-factory-parent-20261102-01, 소유자 Primary/실행 사용자, 최초 생성부터30분·연장/재생성0. 동시 일반파일 최대12·전체16MiB, PE/ASAR 각4MiB·입력 각64KiB. 소유표식과 순차 case만, case의 input/package.json·input/src/main.cjs·Anvil-win32-x64/Anvil.exe·resources/app.asar는 합성 bytes뿐이다. 실제 사용자/백업 파일을 읽거나 실제 PE를 실행하지 않는다. 생성 직전 대상 부재·정확 절대경로·부모/대상 nonlink·owner와 기존 서비스 영향0을 확인한다. 각 case 종료 후 확인된 자기 자원만 정리하고 최종 Main 별도 부재 확인을 받는다. 불명 소유/진행 작업이면 삭제하지 않고 보고한다.

새 의존성 설치0. 기존 FN18 fixture/SDK/정리된 옛 QA root를 수정/재사용하지 않는다. 순수 메모리 합성 compiler 출력 판독과 실제 FN18 합성 파일 판독을 분리 보고한다. Node 직접/인접 시험·root/desktop 해당 typecheck·diff check·독립 source 검수 후 Main이 정확8을 commit/private 게시한다. C#/OS/DB/서비스 실제 검증은 NOT_RUN으로 남기며 전체 FN06/FN08·계획 완료가 아니다.

## 5. 결과·오류 관리

정확8 SHA/diff·실행 명령/exit/count·원 RED와 오류 계보·미실행·QA 최초시각/정리/잔여·실행 중 handle을 반환한다. 동일 근본 원인3회면 추가 변경을 멈추고 정식 FAILURE_REPORT로 Main에게 인계한다. time limit/관측 timeout을 작업 종료로 오인하거나 새 호출로 재시작하지 않는다. 검토 finding 보정 뒤 영향 코드가 불변인 검사는 반복하지 않는다.
