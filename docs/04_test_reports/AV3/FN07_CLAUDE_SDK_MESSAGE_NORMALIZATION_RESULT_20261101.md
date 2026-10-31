# FN07 — Claude SDK 메시지 정규화 source 부분 검수

## 판정·사용 가능 범위
부분 구현. 고정 공개 SDK 객체에 대한 미전송 입력 준비·관측 정규화의 내부 코드가 구현됐다. 실제 SDK transport·서버/화면 연결·6함수·계정 교체는 미구현 또는 미검증으로 전체 FN07·작업계획 완료가 아니다. 현재 사용자가 확인할 제품 화면은 추가하지 않았다.

## 기준·변경
- WI `docs/work_packages/FN07_CLAUDE_SDK_MESSAGE_NORMALIZATION_IMPLEMENTATION_20261101.md`, SHA256 `C69DF128D2A66F3AB5C8373DE2482D7A22E5B3153714FA571B00644E654FB8AE`.
- 시작 `codex/av3-stage-b` / `cc41f1f756667464802c154dd34936b3c49a6caf`, tracked clean·보호 untracked3 보존. 기존 Primary가 source3 단일 writer, Main은 관리·검수·통합, 기존 Reviewer 읽기 전용.
- 고정 근거는 공식 SDK0.3.224 tarball과 sdk.d.ts. package가 claudeCodeVersion2.1.224를 명시하나 설치된 CLI의 실제 호환·계정/비용·지원 실측은 아니다. SDK 객체 API를 CLI JSONL/control wire로 부르지 않는다.

| 소유 파일 | SHA256 |
|---|---|
| apps/connector/adapters/secondary/schemas.ts | CD501E069D03BE0D089D7F08CD3F02129063E2C39BA98F0917B07C301B4F1AAF |
| apps/connector/adapters/secondary/codec.ts | BD3F367BD3724D66BB8690CE019B5770692DA3049337D8B6ABFD9C424CD921F7 |
| tests/unit/FN07/claude-sdk-message-codec.test.ts | 67F69401F8D938E195EA1732DE90AD704138F8D4B42E09CA83C65332F50DD628 |

사용자 텍스트 입력의 검증된 깊은 불변 사본은 명시 내부 보호 포트에만 전달한다. 일반 반환에는 원문 없이 digest·고정 공급자 주장만 제공한다. 기대 session/Anvil context·명령/SDK 식별을 구분하며, 결과 불명은 같은 객체 재호출로 성공이 되거나 capture가 재실행되지 않는다. 식별·직렬화 전 바이트 예산과 미지원 분기를 검사하고, 모든 결과의 실제 실행·권한·업무 합격은 false/소유 UNVERIFIED다. 포트의 선택 함수와 원 receiver를 고정한다.

## 실행 증거
- Main `6a089c`: 최종 위3지문 전후 불변, 신규 **17PASS**, 실패·skip·cancel·todo0, 225.6213ms. 실제 자체 schema/codec 함수와 메모리 보호 포트·합성 SDK 객체를 검사했다. 실제 SDK 라이브러리는 import하지 않았다.
- Main `387c3f`: root typecheck·tracked diff·신규3 공백검사 exit0.
- 독립 최종 C0/I0: 고정 SDK/비밀 없는 사실·상한·중복·불명 보존 검토 후 Promise/불변 준비물·포트 함수 고정·receiver 보완을 scoped 재검토했고 최종3지문 일치. 실행 결과와 독립 읽기 판정을 구분한다.
- 수행자 최초38PASS는 신규12+Codex 인접26의 이전 구현 증거이며 최종17과 합산하지 않는다. 보완은 신규3 내부뿐이라 불변 Codex26을 반복하지 않았다. 수행자 최종17PASS(171.2593ms)와 Main17도 합산하지 않는다.

정확한 최종 검증 명령:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN07/claude-sdk-message-codec.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

## 오류·보완 이력
- 최초 신규 module import 부재는 준비 RED: Main bb8242 exit1/0PASS1loaderFAIL(168.2219ms). 핵심10은 이때 미실행이며 실제 SDK/Agent 실패가 아니다.
- 시험의 success.is_error=false 가정은 SDK boolean 선언과 달라 수정했다. 실제 surrogate·정상 입력의 텍스트1필드 충돌 반례·합성 두 인스턴스와 실제 계정 교체 증거의 구분을 보완했다. 기존 합격 기준을 낮춰 통과시킨 것이 아니다.
- 실제 행동 RED caa2ca: capture 불명 뒤 재호출이 OBSERVED로 승격 → recorded 상태 분리 후 UNKNOWN 유지/추가 capture0.
- facdac: 입력 준비물 누락 및 즉시/지연 Promise 미관측 2FAIL/1PASS → 불변 준비사본·native Promise 거절 관측 후 보정. 잘못된 비동기 포트는 성공이 아니라 UNKNOWN이다.
- Main31965f 및 ec72f3: 원 port receiver 소실로 정상 상태형 메서드가 UNKNOWN/calls0 → receiver1곳 보정 후 정상 준비·관측 및 중복 capture0.
- 준비 오류는 부모 디렉터리 누락1, 공개 선언 출력 cp949 인코딩1이다. 작성 중 erasable 문법1·반환 metadata 타입1묶음도 기록했으며 서로 다른 원인을 동일 실패3회로 집계하지 않았다. Main의 제어문자 정규식 의심은 직접 대조로 기각·불필요 수정0이다.
- Main이 종료된 담당자에게 send_message만 보내 후속 읽기가 시작되지 않았던 운영 오류는 같은 담당자 followup_task로 교정했다. 대기시간을 개발 진도로 집계하지 않았다.

## 미검증·복구·다음 작업
실 SDK/CLI import·설치·Agent 호출·계정/인증/비용·DB/권한/키/서비스·사용자 자료/백업 조사0. 디스크 QA·live handle0. 포트는 명시 메모리 모델이며 보호 저장·OS 격리·내구 전송 at-most-once 증거가 아니다. SDK 중첩 BetaMessage/usage/tool 구조 전체 validator도 아니다. 표준 native Promise의 즉시/지연 거절만 확인했으며 악성 하위 클래스·builtin 변조의 동일 JS 프로세스 격리는 보증하지 않는다.

다음은 고정 객체 입력/결과를 기존 허가·보호 session/실행 사실과 연결할 수 있는 실제 source 소비선이다. provider 실행·인증/비용의 미결정은 별도로 유지하고 독립 source 구현은 계속한다. rollback은 소유 source commit 정상 revert이며 기존 primary·프로젝트 원문/지식·계정·사용자 설치는 변경하지 않는다.