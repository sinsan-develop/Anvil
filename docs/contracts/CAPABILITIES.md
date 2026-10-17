# P02 기존 코딩 Agent 지원 대조

FN06 실제 handshake 후보 소스 준비: CodexHandshakeHost.cs 및 codex-handshake-0161.test.ts를 추가했으나 compile/Job/native/stdio는 미실행이다. 단1회 실측 전 exact private SHA/host sourcehash·run/시간창·원runtime 보존을 PMO가 확인한다. 순수9건/타입과 C# 리터럴 정적대조는 Windows 소유/프로토콜/6능력 실측 등급을 올리지 않는다. 새 전용 Job 마지막handle 자동종료 정책은 별도 AV3-PMO-FN06-HANDSHAKE-OWNERSHIP-01 범위만이며 공유Job/범용회수/파일·계정·network 격리는 제공하지 않는다.

FN06-HANDSHAKE-0161-01 부분 준비: 신규 순수 gate/unit만 기존 codec으로 고정 initialize→정확 결과→initialized 2메시지·상한·시각/EOF 입력을 비교한다. 직접8건은 모의 입력에 대한 메모리 동작이며 실제 native/stdio/Job·계정·모델/6능력 증거가 아니다. actualExecutionVerified=false/ownership UNVERIFIED/workAccepted=false를 유지한다. native host/integration은 아직 미작성, root/컴파일/실제 실행0이다. 자동 Job 종료는 별도 PMO 승인 경계이며 공개 지원표의 실제 연결 등급을 올리지 않는다.

상태: **조사 중 / 실제 연동 미검증**. 2026-10-16 Main 어울. 상위: 설계 r8 §9·12·13, 계획 r7 P02·FN06/FN07·IX02/04. 기존 조사 증거는 유지하고 상위 개정 참조만 맞췄다. 이 문서는 기술 선택이나 외부 API 비용/인증 변경 승인서가 아니다.

## 1. 확인 등급

- `설치 관측`: 로컬 명령의 버전/도움말만 실행. Anvil 연결 성공이 아니다.
- `공식 문서 지원`: 공급자가 설명한 인터페이스. 설치 버전·계정·환경에서의 실제 동작과 구별.
- `실제 연동 확인`: Anvil에서 제한된 임무·수신·파일/결과·승인·중지·재개를 같은 실행 ID로 검증. **현재 해당 증거 없음**.
- `미확인`: 기능 부족으로 확정한 것이 아니다. 지원 판정을 만들거나 우회하지 않는다.

## 2. 로컬 설치 관측

| 도구 | 확인값 | 근거 | 미검증 |
|---|---|---|---|
| Codex CLI | 0.161.0 | `codex --version`, `codex app-server --help` exit0 | 실제 프로토콜 handshake·요청/결과·중지·계정/한도 |
| Claude Code | 2.1.224 | `claude --version`, `claude --help` exit0 | 실제 stream-json·승인·중지·세션·계정 사용 범위 |
| Hermes | ysna-server 설치라는 사용자 제공 사실 | DEVELOPMENT_ENVIRONMENT | 버전/공식 제품 식별/인터페이스·원격 실행 허용 범위 전부 |
| OpenCode | WSL 설치라는 사용자 제공 사실 | DEVELOPMENT_ENVIRONMENT | 정확 배포판/호스트·버전/인터페이스 전부 |

Codex 명령은 `C:\Users\cyhuh\AppData\Roaming\npm\codex.ps1`, Claude는 `C:\Users\cyhuh\.local\bin\claude.exe`로 관측했다. 도움말만 실행했으며 prompt, 세션 생성, 로그인·인증정보 읽기/교체·SSH·설치·도구 설정 변경을 하지 않았다.

Codex는 버전/도움말 조회 중 자신의 임시 arg0/PATH alias 정리·생성에 접근 거부 경고를 내고 버전/도움말은 반환했다. CLI 실행 환경 경고로 분리한다. ACL·임시파일·PATH를 고치거나 성공한 읽기 명령을 반복하지 않는다. 실제 연동 시험 전에 영향이 있는지 확인하되 제품 장애로 소급하지 않는다.

## 3. Codex 후보 — App Server

FN06-CODEX-CODEC-01의 오프라인 codec은 위 고정 정의를 기존 Ajv strict로 검증해 메모리 wire·응답 상관·digest 관측을 제공한다. 한정 검토 C0/I2/M1 후 Main 보정·최종 순수 합성23건/typecheck 결과는 WORK_STATUS에 분리했다(재리뷰 없음). 선도착 식별의 유한 미결박/정확 응답 대조·신규 요청 보류, 수명 id 재사용 금지/소진 차단과 송신 복제 전 예산을 확인했다. 이것은 실제 도구 연결/handshake·6능력·OS 메모리 quota의 실측이 아니며 승인 응답은 서버 결정 소비 미연결로 항상 차단한다.

2026-10-17 AV3-PMO-FN06-SCHEMA-0161-01에서 설치된 정확0.161.0 native exporter 단1회(566ms/exit0)로 stable JSON315개를 고정했다. [공개 schema 지문](../../contracts/vendor/codex/0.161.0/schema-manifest.json)에 버전·exe SHA256·upstream tag/commit·파일별 hash·license와 한계를 기록했다. JSON 파싱/로컬 ref 대조·지정 민감표식 검사만 수행했으며 실제 handshake·세션/turn·파일 변경·승인·중지/회수·6능력, 네트워크 관측과 binary 재현 일치는 여전히 미검증이다. 정의의 존재를 실제 연동 확인으로 올리지 않는다.

근거: [공식 App Server 문서](https://learn.chatgpt.com/docs/app-server). 로컬 도움말에서도 `codex app-server`와 기본 `stdio://` transport를 확인했다.

| 필요한 경계 | 공식 인터페이스 후보 | Anvil의 처리 원칙 |
|---|---|---|
| 초기화·임무 | `initialize`/`initialized`, `thread/start`, `turn/start` | 원문·목적·헌법·범위·양식·검수 조건은 Anvil 소유 |
| 기존 세션 | `thread/resume`, `turn/steer` | 도구의 thread ID는 연결 핸들. 프로젝트 원본/역할 ID와 분리 |
| 진행·결과 | item/delta, `turn/completed`, diff/command events | 수신/수행/제출/검수 구분, 알 수 없는 상태는 실패/미확인 |
| 명령 승인 | `item/commandExecution/requestApproval` | 정확 대상/영향·버전·유효 범위의 사용자 결정을 연결 |
| 중지 | `turn/interrupt` | 요청 응답만으로 파일 writer·하위 프로세스 회수를 확정하지 않음 |

실제 설치 버전의 schema와 이벤트를 FN06에서 고정·대조한다. 문서가 최신이라는 이유로 0.161.0의 모든 필드가 동작한다고 가정하지 않는다. 이 조사에서 app-server daemon·WebSocket listener·새 thread를 시작하지 않았다. 기본 후보는 Windows 실행기의 자식 프로세스 stdio이며 브라우저가 내부 도구 주소를 직접 호출하는 방식이 아니다.

## 4. Claude Code 후보 — 기존 CLI와 Agent SDK를 구분

근거: [공식 CLI reference](https://code.claude.com/docs/en/cli-reference), [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview), [sessions](https://code.claude.com/docs/en/agent-sdk/sessions), [permissions](https://code.claude.com/docs/en/agent-sdk/permissions).

| 경로 | 공식/설치 관측 | 아직 결정·검증할 점 |
|---|---|---|
| 기존 CLI subprocess | 로컬 도움말에 `-p`, `--input-format stream-json`, `--output-format stream-json`, `--replay-user-messages`, `--resume`, `--session-id` | 장기 상호작용·제어 응답/실행 종료·Windows 자식 프로세스 회수 |
| Agent SDK | 공식적으로 Claude Code 바이너리를 애플리케이션 프로세스에서 구동하고 세션/권한 기능 제공 | 사용할 언어/패키지 버전·API 인증/비용·개인 사용과 제품 제공의 허용 범위 |
| 별도 호스팅 Agent | 기존 코딩 Agent를 붙이는 요구와 별개인 공급자 호스팅 제품 | 현재 채택하지 않음. 새 서비스·계정/비용을 암묵적으로 추가하지 않음 |

**인증·비용의 미결정 경계:** 공식 SDK overview는 사전 승인 없이 제3자 제품에 claude.ai 로그인/사용 한도를 제공하는 것을 허용하지 않는다고 명시한다. 따라서 설치된 구독 계정이 있다는 이유만으로 Anvil의 SDK/제품 연동에서도 그대로 사용할 수 있다고 확정하지 않는다. 개인 로컬 CLI 제어와 제3자 제품 제공은 같은 상황이라고 단정하지 않으며, 공식 허용 범위를 추가 대조해야 한다. 구독 토큰 추출·전달·인증 우회나 API 과금 전환을 수행하지 않았다.

이 문서의 SDK 후보는 자체 코딩 엔진 구현 제안이 아니다. 기존 Agent를 호출하는 연동 방식의 비교다. `bypassPermissions`/`--dangerously-skip-permissions`를 연결 방법으로 채택하지 않는다. 앱의 허용 목록만으로 Agent 내부 안전/승인 절차를 대신하지 않는다.

## 5. 공급자 공통 구현 계약 후보

1. `capabilities`에는 문서상 지원과 실제 검증 버전/시각/증거를 별도 기록한다. 미확인 기능을 지원으로 표시하지 않는다.
2. 역할/프로젝트/단계는 Anvil ID, 연결/계정/세션/turn은 외부 핸들이다. 계정 변경·세션 상실 시에도 Anvil 원문·결정 이유·확정 문서·현황·실제 증거가 남아야 한다.
3. 도구의 완료/오류/거부/권한 대기/한도/전송 단절/관측 공백을 구분한다. 내부 원인을 알려주지 않으면 원인 미확인으로 남긴다.
4. 중지 요청·도구 종결·파일 쓰기/하위 프로세스 회수 확인을 구별한다. 안전 미확인일 때 새 writer를 열지 않는다.
5. 모델·토큰 한도·계정 원문은 Anvil 원본과 분리한다. 실제 비밀은 OS 보호 참조로 다루고 문서·로그·브라우저에 원문을 담지 않는다.
6. 원문 이벤트와 정규화 상태를 함께 보관하되 공급자의 비공개 추론을 요구하거나 꾸며 저장하지 않는다. 재연결의 sequence/idempotency·중복/누락과 버전 충돌은 P02 INTERFACES에서 확정한다.

## 6. 다음 증거·미완료

- P02 TECH_DECISIONS에서 웹/서버/Windows 실행기·설치형·DB/파일·인증/보호 저장소를 비교·결정한다. 실제 source/API/schema/명령 계약은 그 결정에 맞춰 작성한다.
- 첫 후보 Codex와 두 번째 후보 Claude의 순서는 제안이며 아직 사용자 확정/실제 통합 증거가 아니다. 다른 도구의 공식 지원 조사로 대체 가능하되 기능/이전 검수를 생략하지 않는다.
- 기존 Agent 계정으로 가능한 공식 경로와 새 API 비용이 생기는 경로를 구분해 사용자가 판단할 수 있게 한다. 비용/인증 결정 전 실제 LLM 호출을 하지 않는다.
- 외부 문서 조회의 SDK TypeScript reference 링크1건은 검색 도구 Internal Error로 본문 확인 불가였다. 설치/권한 문제로 오인하지 않으며 해당 API 세부는 미확인으로 남기고 공식 대체 문서를 찾는다.

## 7. P02 완료 산출물 — 필수 6능력 × 후보 도구

아래는 §2~4의 기존 공식/설치 조사에 근거한 후보 적합성 표다. 이번 보완에서 버전/도움말·실제 Agent 호출을 재실행하지 않았다. `공식 경로 후보`는 공식 문서상 연결 가능성이지 정확 설치 버전/계정/환경의 지원 확정이나 실제 실행 합격이 아니다. `미확인`과 `미지원`을 구별하며 현재 공식/실측 근거 없이 미지원으로 판정한 칸은 없다.

| 필수 능력 | Codex CLI 0.161.0 · §3 공식 후보 | Claude Code 2.1.224 · §4 공식 후보 | Hermes · 버전/제품 미확인 | OpenCode · 버전/호스트 미확인 | 실제 검증 상태 |
|---|---|---|---|---|---|
| 1 지시/세션 식별 | thread/start·turn/start 경로 후보, 설치 버전 schema 미확인 | CLI stream-json/session-id·SDK sessions 경로 후보, 최종 경로/버전 적합성 미확인 | 미확인 · 사용자 설치 정보만 있음 | 미확인 · 사용자 설치 정보만 있음 | 4후보 모두 미확인·실행 근거 없음 |
| 2 상태/원문 수집 | item/delta·turn 완료 이벤트 후보, 설치 버전 관측 미확인 | stream-json 출력 후보, 상호작용/버전 적합성 미확인 | 미확인 · 제품/인터페이스 식별 필요 | 미확인 · 제품/인터페이스 식별 필요 | 4후보 모두 미확인·실행 근거 없음 |
| 3 결과/파일·시험 증거 | diff/command 이벤트 후보, 실제 파일/exit 결박 미확인 | CLI/SDK 결과와 실행기 파일 관측 결박 필요·미확인 | 미확인 · 원문/파일 회수 계약 필요 | 미확인 · 원문/파일 회수 계약 필요 | 4후보 모두 미확인·실행 근거 없음 |
| 4 도구 자체 승인 응답 | commandExecution/requestApproval 경로 후보, 실제 응답 미확인 | SDK permissions 경로 후보, 기존 CLI 선택 시 제어 응답 지원 미확인 | 미확인 · 공식 승인 계약 필요 | 미확인 · 공식 승인 계약 필요 | 4후보 모두 미확인·실행 근거 없음 |
| 5 중지/실제 회수 | turn/interrupt 경로 후보, 프로세스/자식 쓰기 회수 미확인 | Windows 중지/자식 소유 회수 미확인 | 미확인 · 중지/소유 관측 필요 | 미확인 · 중지/소유 관측 필요 | 4후보 모두 미확인·실행 근거 없음 |
| 6 허가 경로/쓰기 통제 | 실행기/공식 sandbox·승인 경계 결합 필요, 이탈 통제 미확인 | 공식 권한/실행기 결합 필요, 선택 경로·이탈 통제 미확인 | 미확인 · 소스/실행 환경 허가 필요 | 미확인 · 소스/실행 환경 허가 필요 | 4후보 모두 미확인·실행 근거 없음 |

각 후보의 제품/버전·공식 출처·관측 시점은 §2~4에 연결하고, 실제 근거가 생기면 해당 칸에 실행 ID·환경·검증 버전/시각·정상/중요 실패·회수 증거를 붙인다. 후보/계정 경로별 비용·공식 사용 허용 미결정은 §4·TECH_DECISIONS를 유지한다. 필수 통제 미지원이면 그 후보/역할 제외 또는 공식 대안 검토, 미확인이면 실제 변경 역할 준비 완료로 표시하지 않는다. 임무별 해당 없음은 이유와 검토 주체를 따로 기록한다. 문서 근거를 더 확보해 P02를 마무리하더라도 실제 go/no-go는 FN06/07의 안전 기반 뒤 실측으로만 판정한다.
