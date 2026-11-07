# FN06 physical factory source 구현·검수 결과

## 판정

WI202FC106의 정확 신규8 source 단위는 구현·독립 검증·독립 정적 검수·QA 회수를 마쳤다. 실제 컴파일·native 실행·보호 권위 공급·FN06/FN08 전체·Stage B·전체 작업계획 완료는 아니다.

- 코드: 3eba28f989b757d0cee25cf1671c5ef5e937c08d, codex/av3-stage-b. local/private exact SHA 확인 c94c7f. 원격 main은 f976ed5e29e14b13e12729d5b1ccf98f050f2210으로 별도 보존한다.
- WI: docs/work_packages/FN06_NATIVE_PHYSICAL_FACTORY_SOURCE_IMPLEMENTATION_20261102.md SHA256 202FC1062F2A4984D0C79BABF8045860ED53514490F05140438F13912C9E764D.
- 담당: 구현 fn16_primary_recovered, 독립 정적 검수 fn16_review_recovered, 관리·독립 실행·통합 Main 어울. 동시 제품 writer1, 제출 후 동결/반환.

## 변경과 기존 보호

부모의 실제 FN18 검산 원 snapshot·exe/ASAR/header hash를 고정하고 14개 실제 C# source·compiler/참조 지문·workingDirectory/절대 source argv를 inputHash로 결박했다. compiler는 호출하지 않는다. 출력 PE/CLI의 유한 metadata/index/stream·managed Main 소유 타입/서명·private embedded basis를 데이터로 판독한다. 겹친 directory·외부/중복/public resource·지원 밖 표·잘림을 거절한다.

생산 후 출력 검산 전후 부모/source/tool 지문을 다시 확인한다. 동일 producer에서 최초 helper 전체 hash를 고정하여 같은 id/version의 다른 bytes 재발행을 막는다. physical 전용 namespace에서만 factoryRef.contentHash=helper 전체 SHA256을 사용하고 기존 generic ref는 바꾸지 않는다. helper hash를 부모 ASAR/basis에 넣지 않아 생성 순환이 없다.

서버는 기존 NativePreparationSource의 원 등록·로그인·정책·current 검산을 위임하며 UNVERIFIED를 승격하지 않는다. 같은 artifact/ref를 image supplier와 실제 Client/private ticket/bridge/launcher가 소비한다. runtime은 desktop/scripts를 import하지 않는다. 실제 보호 upstream·mapping/peer 근거가 없으면 기본 미등록/거절이다. manifest·합성 출력 자체는 권위가 아니다.

기존 제품/14 C#·SQL·SDK·fixture·일반 API·권한은 수정하지 않았다. 새 공개 HTTP/DB/키/root 등록을 실행하지 않았다. 동결 후 8SHA는 Main19afd1/c78712 및 Reviewer 시작·끝에서 동일하다.

## 정확 변경8

| 경로 | SHA256 |
|---|---|
| contracts/runtime/native-physical-factory-v1.ts | 21AE5B730768FD8D9724507103C0A8915F0B1E5FC3349FA6E389D7E96FD8E8BA |
| apps/desktop/scripts/native-physical-factory-build.cjs | 24E0E62FC3663D5E4B15B476EA32AAEF99C9A4A3A210EF23189676F3D96F466E |
| apps/desktop/scripts/verify-native-physical-factory.cjs | 7A51C32A24F872DFD36A5054CC25202F4CE6F16CD30A2FABA64EAB0F15107975 |
| apps/server/modules/executions/native-physical-factory-source.ts | ABA1A193A08C4466C722C4EFA4A238B57B9580E7D3175033006EB23A3A4AA1EB |
| apps/connector/runtime/native-physical-factory-image-source.ts | 9E5A070C705D2038BA7A77B164BE6827B2E693A83BAB1040AAA831DEA0170186 |
| tests/unit/FN06/native-physical-factory-build.test.ts | 04229EB121038FADA55D26E894FC5A5F9B93FB47457E2122BE602C663AAA68A1 |
| tests/unit/FN06/native-physical-factory-source.test.ts | 4C686FE15A676C88F3DBB9DAAC65A8992E7965D37C3049232FC5985F54E1269D |
| tests/unit/FN06/native-physical-factory-image.test.ts | 6E07AF48884869DC1F443B085A9A2DA1E1FB13469EF42A1E51484152EBA3F4DC |

코드 diff는 신규8/361추가/기존 제품 삭제0이다. commit 전 raw/index blob 동일·staged diff check0을 확인했다. Git의 향후 LF→CRLF 경고는 보존하며 설정/기준 bytes를 변경하지 않았다.

## 실행 검증

Main 독립 1dc2db는 다음 명령을 등록 QA의 원 수명 안에서 실행했다. 실행 프로세스 환경에만 ANVIL_NATIVE_PHYSICAL_QA=REGISTERED를 설정하고 종료 후 제거했다.

~~~text
node --test --test-reporter=spec
 tests/unit/FN06/native-physical-factory-build.test.ts
 tests/unit/FN06/native-physical-factory-source.test.ts
 tests/unit/FN06/native-physical-factory-image.test.ts
 tests/unit/FN06/native-preparation-client.test.ts
 tests/unit/FN06/native-factory-call-context.test.ts
 tests/unit/FN06/native-preparation-owner-launcher.test.ts
~~~

결과 57PASS/fail0/cancelled0/skip0/todo0·1554.5313ms·exit0이다. 신규18(순수17+실제 합성 파일 QA1)과 직접 인접39를 한 실행에서 확인했다. 수행자의 별도 재검사 수를 더해 고유 시험 수를 부풀리지 않는다. QA의 실제 FN18 getCurrentFuseWire/getRawHeader 파일 판독→producer→동일 artifact server current→Client/launcher 명시 fake child를 확인했다. helper/native 프로세스 실행은 0이다.

Main29b586: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json 및 -p apps/desktop/tsconfig.json 모두 exit0. Mainc78712/2d8552 diff check0. 독립 Reviewer 최종 C0/I0·8SHA 시작끝동일이다. 정적 검수는 별도 실행0이며 실제 보호/OS 검증으로 승격하지 않는다.

수행자 원 증거: 신규 순수17 ffcf1c, 마지막 변경 영향 build9+QA1 eeb1cb 10PASS/907.1276ms, 기존 직접 인접 선정3 648c6c, root f65ac5/desktop58b444 type0·53118e diff0. 변경 없는 범위를 반복하지 않고 Main 최종 묶음으로 보완했다.

## RED·오류 계보

- 7fafbc: 신규 모듈 부재 준비 실패1. 기능 거절 RED와 구분한다.
- 8126a3: metadata/resource 구간 alias를 수락한 실제 행동 RED. 067b26 정상/음성2PASS로 보정하고 최종57에서 다시 포함했다.
- Python UTF-8 미지정 준비 오류1은 patch0이며 원 RED 재관측과 구분했다. 타입 준비 진단 indexed byte/JSDoc null 추론/fingerprint scope 위치는 각각1회, 최종 해소. 동일 원인3회 미도달이다.
- Main 조기 검토의 정상 Windows 경로·cwd/source 결박·최초 output hash 불변은 WI 안에서 최소 보완했다. 새 API/권한/실행 범위 확대가 아니다.
- cleanup 2f6a26은 ConvertFrom-Json의 날짜 자동변환으로 exact 문자열 검사에서 중단/삭제0. 49ba1d 원 문자열 검산 뒤 -DateKind String을 사용해 bcdd99에서 회수했다. 기존 FN18 유사 준비 원인의 재발을 숨기지 않으며 앞으로 보호 표식은 문자열 시각으로 판독한다. 제품 실패나 원 표식 변경이 아니다.

## 등록 QA·회수

정확 root D:\tmp\anvil-v3-native-physical-factory-parent-20261102-01, owner SINSAN\cyhuh/담당 fn16_primary_recovered, 최대12파일/16MiB·PE/ASAR각4MiB·input각64KiB. Main4760c9 부재/부모 nonlink/owner 확인·c6da4a 사전등록 뒤 생성했다. 최초 createdAt2026-11-02T05:13:59.778Z·expiresAt05:43:59.778Z, 연장/재생성0.

원 marker158B SHA51FD554752A7D7895FDE68876A924106E521D9264197D8DDA71BDFA829452970. case는 매 실행 확인된 자기 파일만 finally 정리하고 원 marker/root를 유지했다. Main fresh 후 c78712에서 owner.json만 잔여·marker 불변을 확인했다. 실제 사용자/백업 파일·SDK/옛 fixture·기존 서비스는 건드리지 않았다.

Primary bcdd99 exit0은 05:23:29.4957370Z에 marker1+빈 root만 비재귀 회수했다. Main2d8552 05:23:50.9144140Z 독립 읽기에서 rootExists=false/markerExists=false를 확인했다. 원 만료 전·관련 live0이며 미정착 자원을 강제 종료·삭제하지 않았다.

## 미검증·다음 조치·rollback

실제 compiler/C# 실행·실 helper image·Windows pipe/Job/peer·loaded ASAR/실 admission·현재 보호 factory 등록·DB/RLS/권한·키·서비스·Agent·실자료·P03R3·브라우저/사용자 인수는 NOT_RUN이다. source와 합성 검증을 기능 전체 완료로 보고하지 않는다. FN03 §13.4 새 원문 계약은 별도 미승인 상태다.

19입력 compile+managed fake RunAll 후보는 별도 문서28C5E8로만 보존되어 있고 supervisor 구체 구현/검수·실행 결정 전이다. 기존 r2 actual compiler 제외를 이 코드로 완화하지 않는다. 다음 계획상 미완료 실제 caller/보호 공급 구현을 기존 담당이 읽기 대조하며, 채택되지 않은 계약/실행을 임의로 열지 않는다.

rollback은 이 소스 commit의 신규8을 일반 후속 revert로 되돌리는 방식이며 force/history rewrite/원격 main 변경은 하지 않는다. 실제 서비스/DB에 반영하지 않아 서비스 rollback은 수행하지 않았다.
