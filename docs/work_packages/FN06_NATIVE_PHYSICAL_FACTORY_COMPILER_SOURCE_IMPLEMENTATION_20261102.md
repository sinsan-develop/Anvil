# FN06 물리 helper compiler 소비선 — source 구현 지시서

- 2026-11-02 / r1 / Main 어울 / 단독 구현 담당 기존 Primary.
- WORK_PLAN FN06/FN18 native 준비의 고정 helper 산출물 생산 후속이다. 기존 native 준비 r2 A source 승인과 physical factory 생산·검산 계약을 재사용한다. 실제 compiler/native 실행 허가가 아니다.
- 선행: physical factory source3eba28f9와 결과004f3b65, 현재 current-source r3 검수·통합 이후에만 제품 writer를 배정한다. 현재 문서 작성은 구현 GO가 아니다.

## 1. 정확 허용3
1. 신규 apps/desktop/scripts/native-physical-factory-compiler.cjs
2. 신규 tests/desktop/native-physical-factory-compiler.test.cjs
3. 기존 apps/desktop/scripts/native-physical-factory-build.cjs

기존 compile 입력·PE/private resource/부모 package verifier의 합격 기준과 기존 시험을 낮추지 않는다. 다른 제품·SQL·공개 DTO/route·권한·key store·기본 main 등록·의존성·문서/Git은 수정하지 않는다. 다른 담당자 변경과 보호 untracked3를 보존한다.

## 2. 완성할 연결
- 고정 import의 produceCompileInput이 실제 FN18 부모 package snapshot/source14/compiler/reference4를 확인해 만든 내부 closure만 소비한다. 외부 JSON의 compiler 경로/argv/inputHash 또는 verified 표식으로 이 closure를 대신하지 않는다. createCompileInput 단독 결과는 compiler 호출 권위가 아니다.
- 기존 producer의 원120초 한도와 입력 재검산을 공유하는 내부 단발 진입 접점을 둔다. compiler 호출 직전에 원 source/tool/parent를 다시 확인하고, 그 뒤 정확 compiler.path/arguments/workingDirectory만 명시 driver에 최대1회 전달한다. 새 window·shell·response file·추가 argv·환경변수에 의한 compiler 대체·재시도는 없다.
- 실행 함수만 export한다. import/constructor/기본 앱에서 실행하지 않고 실제 spawn fallback을 넣지 않는다. 명시 driver가 없으면 거절한다. caller 환경 전체를 복사하지 않으며 허용 환경을 새 객체로 고정한다.
- basis/output은 명시 소유 작업 디렉터리의 고정 파일명으로 제한한다. 기존 파일/link/동반 파일·소유권 불명이면 거절한다. basis의 exclusive 생성·flush·readback을 명시 IO로 확인하고 원 bytes와 같아야 한다. 테스트는 합성 IO만 사용하며 실제 파일을 조사하지 않는다.
- stdout/stderr 각각64KiB, helper bytes64MiB, 원120초 수명과 caller의 더 짧은 기한을 넘지 않는다. 도구/stream event 포트는 descriptor 기반으로 고정하고 await 뒤 교체/getter를 거절한다. 기한마다 같은 원 단조 anchor를 사용하며 최소기한은 늘리지 않는다.
- exit0만으로 성공하지 않는다. 원 child의 종료 정착을 확인한 다음 출력 비링크/크기·원 입력 재검산→기존 closure.verifyOutput까지 연결해 기존 artifact 원형을 반환한다. 새 public manifest/저장표/권한 목적을 만들지 않는다.

## 3. 실패·불명 처리
- 준비 거절/명확 실패/UNKNOWN을 구분한다. timeout·출력 초과·연결 유실·종료 불명은 UNKNOWN이며 성공이나 자동 재호출로 바꾸지 않는다. timer 만료/kill 요청을 child 종료 증거로 사용하지 않는다.
- 실제 신호/프로세스 kill·파일 삭제는 이 구현/검증에서 실행하지 않는다. 미정착 child·부분 출력·소유 불명 작업은 보존하고 재사용/자동 정리/재컴파일하지 않는다. 정상·명확 실패 정리도 소유 증거가 있는 정확 합성 자원만 시험한다.

## 4. TDD와 인수
- 명시 fake driver/process/IO로 정상 단발·원입력/argv/cwd/compiler/basis 변조·기존 출력/동반파일/link·출력 초과·exit/error·timeout/늦은 close·부분 출력·검산 실패·결과 불명 재시도0·원기한 공유를 반증한다. getter/함수교체는 실행/추가 IO 전에 닫는다.
- 실제 produceCompileInput의 FN18 검산을 fake 성공 verifier로 바꾸지 않는다. 실제 부모 package→producer 전체 연결 시험에 실제 합성 filesystem이 필요하면 이름/owner/수명/정리를 Main에게 먼저 제시하고 GO 전에는 만들지 않는다. 이 WI 기본 검증은 메모리 합성에 한정하며 미실행 연결을 PASS로 합산하지 않는다.
- 실행: node --test tests/desktop/native-physical-factory-compiler.test.cjs 및 기존 직접 영향 build 시험, node node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json, git diff --check. Main은 제출 코드 동결 뒤 필요한 직접 검증과 독립 리뷰를 수행한다.
- 제출: 실제 시작 HEAD/정확3 SHA·변경 이유/diff·RED→GREEN 명령/종료/count·오류 계보·미검증·자원/rollback. 기능은 고정 producer→제한 driver→출력 검산의 source 연결까지만 인수한다. 실제 compiler/C#실행·Windows peer/admission·보호 mapping/서명 전달/제품 조립·DB/키/권한/서비스/Agent/실자료/P03R3와 전체 계획은 미완료다.