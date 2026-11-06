# FN07 원 SEND 자료·secondary owner 연결 소스 검수 결과

- 판정: 지정 내부 소스·합성 단위 인수. 실제 사용자 지시 전송·Claude Agent 연결 전체 완료는 아님.
- 기준: WORK_PLAN FN07, Main SOURCE_GO §303, 기존 원 SEND/receiver/owner 계약.
- WI: docs/work_packages/FN07_SECONDARY_INSTRUCTION_BRIDGE_SOURCE_IMPLEMENTATION_20261106.md
- WI SHA256: 50493D2135C1E95D04020D5B39000BAC65664ACDA162A1B48294F077A2EDB5AD
- 시작 HEAD: 9ac6838547b26aa67b608b23cf0298c7b744b88f, branch codex/av3-stage-b.
- 기존 Primary 구현, 기존 읽기 담당자 독립 검수, Main 직접 검증·통합.

## 변경 사유와 동작

원 SEND 자료를 기존 Claude owner에 공급하는 caller가 없었다. 원 receiver와 codec을 재작성하지 않고 신규 bridge/시험을 추가했다. owner에는 private context/SID·고정 예정 기한과 선택적 미사용 command를 boolean으로 확인하는 내부 메서드 하나만 추가했다. 기존 입력·관측·중지·정리 알고리즘과 결과 의미는 유지했다.

| 경로 | bytes | 최종 SHA256 |
|---|---:|---|
| apps/connector/adapters/secondary/instruction-bridge.ts | 11992 | 760336ACB4D71B0855DEBF930463E914C996ACC234AEAE63BB391E7416052029 |
| tests/unit/FN07/claude-instruction-bridge.test.ts | 16952 | EA83439D67E560B5AD26E9837B34C2EAA3AB8BDADDB223C1D7347BB581A92A58 |
| apps/connector/adapters/secondary/sdk-session-owner.ts | 14130 | 1F032A5B653FAE5FB53344A614D389F0C42715335B8712CEDEF48444B072ACF9 |
| tests/unit/FN07/claude-sdk-session-owner.test.ts | 16861 | EDC71C885F2ECFF09EFFCF2E7FCEB11843AE6B4493B89C3ABC5FBD85F77AF9BE |

변경 전 owner는 13515B/DBE89D575671910F9FFFBDFFE9D94CED656619B189D5EA17F85ABF675450A2FF다. Main 82e2af diff는 메서드 4줄 추가만 보여 주며, 독립 검수에서도 추가 메서드를 메모리에서 제외하면 원 bytes와 같음을 확인했다. owner 시험은 기존 기대값을 낮추지 않고 직접 검사 6줄을 추가했다.

원 START factory는 16133B/ACACF14DD16378F1EFD95DD241D190432E47D54C9F724D46BDF97F603E2B4F19로 유지했다. 일반 admission의 Primary 인스턴스 guard, Codex claim/journal, 공개 API·서버·SQL·패키지는 수정하지 않았다.

bridge는 실제 SyntheticMaterialReceiver.instruction의 정확 9키와 원 key/envelopeHash/refs/영수증/길이/SHA/UTF-8을 재검산한다. 문장에 새 지시·요약·context를 붙이지 않고 공식 user 객체에 그대로 담으며 commandId를 기존 owner.sendInstruction의 instructionId로 사용한다. 같은 실제 owner의 여러 bridge가 유한 장부를 공유해 원 결박 충돌·pending·결과 불명을 보존한다. 소유 bytes는 성공·실패·늦은 수신 뒤 지우고 receiver의 보관 부분은 보존한다.

## 발견·보완

- WI의 exact10 계수는 실제 원형 9키로 정정했다. 제품 반환형을 바꾸지 않았으며 최종 사전검토 C0/I0/M0를 받았다.
- 행동 RED 4a760b: 수신 원문이 허용 상한 이내여도 공식 user 외피를 합하면 codec 상한을 넘고 입력0인 예외가 UNKNOWN으로 처리됐다. 공급 전 원 상한 검산을 추가해 REJECTED·입력0 GREEN 71d9ef를 확인했다. 상한을 늘리거나 문장을 자르지 않았다.
- Main 반례와 독립 I1: bridge 이전 직접 owner 입력의 과거 INPUT_METHOD_SETTLED가 새 envelope/refs/영수증에 귀속될 수 있었다. 실제 RED 5d04cf 후 원 command의 private 점유를 공급 직전에 검산해 GREEN e24e64로 거절했다. 검사 뒤 원 호출 사이에 await는 없다.
- receiver HOLD 중 직접 owner 점유·current HOLD·boolean 검사도 같은 실제 모듈로 확인했다. 기존 입력 장부 알고리즘은 변경하지 않았다.
- 최종 독립 읽기 검토 C0/I0/M0. 최종 네 지문은 시작·종료 동일했고 시험은 별도로 실행하지 않았다.
- export 부재 RED와 private 기한 시험의 초기 산식 오류는 준비 증거로 분리했다. 기존 owner.observe의 실제 current 축소로 시험을 정합했고 guard를 완화하지 않았다. 정식 동일 실패 3회 인수는 없었다.

## Main 직접 검증

검사 전 82e2af와 검사 후 8de013에서 최종 네 파일 및 불변 factory 지문이 같았다.

정확한 시험 명령:

node --test tests/unit/FN07/claude-instruction-bridge.test.ts tests/unit/FN07/claude-sdk-session-owner.test.ts tests/unit/FN07/claude-sdk-query-factory.test.ts tests/unit/FN07/claude-start-options.test.ts tests/unit/FN08/execution-material-receiver.test.ts

| 증거 | 실제 결과 |
|---|---|
| 2aa9e4 | 위 5파일 73 PASS / fail0 / cancelled0 / skip0 / todo0 / 1889.7263ms / exit0 |
| b57a78 | npm run typecheck exit0 |
| b57a78 | git diff --check exit0, CRLF 정규화 안내 별도 |

시험 출력은 종료 코드를 보존한 PowerShell 메모리 수집 후 마지막 16줄을 표시했다. 별도 결과 파일·실자료 IO는 없었다. Primary 중간7·최종73·보강1과 이전 factory36을 중복 합산하지 않는다. 최종 보강 분기까지 포함한 Main fresh73을 인수 근거로 사용한다. 불변 codec 전수·브라우저·부하 시험은 반복하지 않았다.

## 미검증·다음 작업·복구

명시 합성 current/Query/선택과 원 sessionBindingRef↔SID 보호 생산자는 여전히 외부 선행이다. 실제 SDK·OS/process·모델/비용/도구 권한·서버 허가·영속 중복 방지·실제 사용자 원문 조회/전송·DB·권한·키·서비스·Agent·브라우저·사용자 인수는 실행하지 않았다. INPUT_METHOD_SETTLED는 메서드 정착일 뿐 모델 응답·업무 수락·완료·서버 기록이 아니다. 모든 실행/수락/소유 표시는 false/UNVERIFIED다.

현재 장부는 module-private 메모리이며 재시작 이후 내구 보장을 주장하지 않는다. 보호 중인 관련 없는 3파일을 변경·stage하지 않는다. Primary live/pending0, Main 직접 명령도 exit0으로 정착했다. 로컬 checkpoint만 작성하며 private push·PR·main 통합·배포 증거는 없다.

후속은 Claude SESSION 관측·원 생성/permit·Anvil 책임 세션의 보호 결박에 필요한 미채택 의미를 좁힌다. 기존 Codex 원형을 이름만 바꾸거나 실제 permit 공백을 nullable 성공으로 메우지 않는다. 이 소스 인수는 전체 FN07/Stage/작업계획 완료가 아니다.

복구는 신규2와 기존2의 추가분 및 이번 기록의 정상 revert다. 실제 환경 변경은 없다.
