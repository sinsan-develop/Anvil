# FN07 원 SEND 첫 입력 bootstrap 소스 검수 결과

- 판정: 지정 내부 소스·합성 단위 인수. 실제 SDK·Agent 기능·FN07 전체·계획 완료는 아님.
- 기준 WI: docs/work_packages/FN07_INSTRUCTION_BOOTSTRAP_SOURCE_IMPLEMENTATION_20261106.md
- WI SHA256: 27E3A41B92FE9CE498FFCB12877BB88BB96F3E386608C9B4687CA182B5C4E8E2
- 시작 HEAD: 361a56f20f046db79c6a1479224aeb32b254b2f9, codex/av3-stage-b.
- 기존 Primary 구현, 기존 읽기 담당자 독립 검수, Main 직접 검증·통합.

## 목적과 변경

원 START의 두 자료 ref와 별도 명시 SEND를 같은 생성 시도에 연결한다. 원 instruction receiver·client authority·execution client·공통 instruction permit의 실제 구현을 소비하고, 첫 입력 iterable의 실제 단발 yield에서만 private 근거를 만든다. 새 문장·자동 context prompt·실제 실행 권위를 만들지 않는다.

| 경로 | bytes | 최종 SHA256 |
|---|---:|---|
| apps/connector/adapters/secondary/instruction-bootstrap.ts | 20227 | DD80254A73AA7F5A5BBD25789AF2C2A7B7BD595B01EDD339F41339FB3179AAEC |
| tests/unit/FN07/claude-instruction-bootstrap.test.ts | 31581 | 448082D8774D4BDC1F31B04B0BADE2A431F7F1E7A1F9C51FEBFBBC3875135907 |
| apps/connector/adapters/secondary/sdk-query-factory.ts | 19996 | 6FFB705C09C2B658ACBD0C9C7C6638FFAB5702135444E970872A490FA2C9F3B4 |
| tests/unit/FN07/claude-sdk-query-factory.test.ts | 21803 | 6BD60C69477F734FEACC6451B50A3873C60BE2DB064E59CD04A443A80782573F |
| apps/connector/adapters/secondary/sdk-session-owner.ts | 16231 | FAD0E2BF957903746C5CBF5808E821A56321B469807558CE838AD9659139C828 |
| tests/unit/FN07/claude-sdk-session-owner.test.ts | 17435 | FBF051163AB79D3E91DEB461E1803A048212862DA9BEA54E6CFF9E31BDDD7B19 |
| apps/connector/adapters/secondary/session-coordinator.ts | 13635 | 0CF3401949522247EA620E9FEC4A0B02AE25657F06D3B5A4F8B6AA0EE1578D20 |
| tests/unit/FN07/claude-session-coordinator.test.ts | 16247 | 17C9C0D971EB6F91D998BC4E25D1D6716DE5E155D971454371DD115EEC521FFA |

기존 세 모듈의 변경 사유는 실제 원 첫 입력을 factory 생성과 결박하고, 같은 Query/owner의 입력 장부에 소비 근거를 인계하기 위해서다. bootstrap 없는 경로의 기존 검사를 유지하며 bridge/codec/receiver/client/공통 permit·서버/SQL·공개 계약은 수정하지 않았다. bridge 11992B/760336AC는 불변이다.

## 검산과 결과 의미

원 receiver 자료의 refs/길이/hash/UTF-8을 검사하고 선행 시도 snapshot을 먼저 보존한다. current의 정확 fact·원 command/자료/세션/grant·source/OS 근거를 대조해 고정 bindingHash로 실제 client.consume을 호출한다. 실제 공통 permit은 원 queue/reservation/fact/proof를 검사한다. 이 proof/current/저장 공급자는 명시 합성 모델이므로 실제 권위를 증명하지 않는다.

permit 소비·실제 yield·Query 반환·init 관측·owner 인계는 별개다. 동일 create의 실제 factory private 상태·START·문맥/SID/선언 세션·입력·원 Query/facade/owner를 검산한다. owner는 private 소비 근거를 한 번 받아 같은 command/user digest를 장부에 보존한다. 직접 owner/bridge를 통한 같은 명령 재공급은 차단한다.

상태 BOOTSTRAP_INPUT_YIELDED_ONLY는 SDK 수락·입력 처리 완료·모델 응답·업무 인수·실행 권위가 아니다. 모든 실행/수락 flags는 false, ownership은 UNVERIFIED다. init이 먼저 오더라도 원 Query/prefix를 보존해 기존 기한 내 원 입력 yield를 기다리며 미yield 만료는 UNKNOWN·재생성0이다.

## 발견·보완 이력

| 실제 반례 | 원 결과/위험 | 보완 |
|---|---|---|
| 75a815 교차 START | START A 자료가 factory B 생성에 채택됨 | 자료/시도/consume/yield 전에 전체 START 대조 |
| 520391 별개 Query | 임의 identity/target으로 다른 owner에 yield 근거 인계 | 실제 factory private brand·생성 상태·input/Query/facade/owner 대조 |
| d611a7 기대 SID | 다른 기대 SID의 입력이 먼저 공급된 뒤 거절 | 원 factory private sessionDigest를 공급 전에 대조 |
| 6d1467 선언 세션 | coordinator 선언 ref와 bootstrap SEND가 달라도 READY | bootstrap 경로의 명시 sessionBindingRef 기대값을 private 검산 |
| 0aa360 입력 상한 | 인스턴스64KiB 초과 user가 yield 후 거절 | 전체 user canonical UTF-8 크기를 실제 factory 상한으로 시도 저장/consume/yield 전에 검산 |

최종 시험은 정확65536B 정상과65537B 사전 거절·consume/create/yield0을 확인한다. 문장 자르기·상한 확대는 없다. 원 import 경로 두 곳의 TDZ 회귀 b8003e(78PASS/2FAIL)는 교차 클래스 초기 캡처를 호출 시점의 원 인계 함수로 옮겨 해소했고 최종 직접 회귀에 포함했다.

구조적 export 부재 d1a1bf와 시험 타입 준비 오류·local helper 삭제/복원은 제품 행동 RED와 분리한다. 정식 같은 FAILURE_REPORT 3회 또는 Main 제품 인수는 없다. Main의 결과서 첫 메모리 초안은 한국어 외 문자 검사로 실행 전 차단됐고 한국어로 다시 작성했다. 도구/파일 쓰기 영향은 없으며 제품 오류로 세지 않는다.

최종 독립 검수는 이전 네 결박 문제 해소와 입력 상한 보완을 확인해 C0/I0/M0다. 마지막 변경3과 불변5의 시작·종료 지문을 대조했으며 독립 담당자는 시험을 실행하지 않았다.

## Main 직접 검증

정확한 시험 명령:

node --test tests/unit/FN07/claude-instruction-bootstrap.test.ts tests/unit/FN07/claude-sdk-query-factory.test.ts tests/unit/FN07/claude-sdk-session-owner.test.ts tests/unit/FN07/claude-session-coordinator.test.ts tests/unit/FN07/claude-instruction-bridge.test.ts tests/unit/FN07/claude-start-options.test.ts tests/unit/FN08/execution-material-receiver.test.ts tests/unit/FN08/execution-instruction-client.test.ts

- d490fb 검사 전 최종8·원 bridge·HEAD/index 검산.
- 2457f9: 110 PASS / fail0 / cancelled0 / skip0 / todo0 / 2471.7159ms / exit0.
- 23db1f: npm run typecheck exit0, git diff --check exit0. CRLF 정규화 안내 별도.
- 5dc08c: 검사 후 최종8 지문 동일, 관련 없는 보호3 불변. 신규 bootstrap test 선언19개 확인.

110은 선택한 최종8시험파일의 고유 합계다. 개발자 선택 시험·이전108·이전 단위84/73/36을 더하지 않는다. 이전108 지문의 PASS는 당시 범위 증거로만 남기며 상한 보완 후 새 지문을 인수한다.

## 미검증·다음 작업·복구

실제 SDK import/query·공식 process 입출력/종결 소유·도구 결정 공급·실제 SID/SESSION claim·계정/비용·서버/화면·사용자 인수는 미완료다. OS/source/current/proof 공급자의 실제 진위·권한과 내구 재시작은 검증하지 않았다. 원 SDK 기본 spawn/빈 tools/permissionMode·준비 authority로 대체하지 않는다.

실제 DB/권한/키/서비스/Agent·실사용자 원문·실자료·J3/P03 R3·Oracle/운영 실행0이다. Primary live/pending0과 Main 직접 명령의 정상 정착을 확인했다. 로컬 checkpoint만 만들며 private push/PR/main 통합/배포는 하지 않았다. 보호3은 보존한다.

후속은 검산된 실행 구성·process 소유 포트·실제 Query driver와 도구 결정의 남은 공급 계약을 닫아 실제 사용자 기능에 연결하는 것이다. 이 단위를 전체 FN07/Stage/계획 완료로 표시하지 않는다. rollback은 이번 정확8 변경분과 단위 기록의 정상 revert이며 실제 환경 변경은 없다.
