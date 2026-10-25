# N4 R1 원 C pending 보고 producer — source 작업 범위

- 기준: 승인② native source 준비와 N4 A안의 C standalone/GW winexe 분리. 실제 실행 승인 문서가 아니다.
- 담당: 구현 r1_bounded_report_implementation, Main 어울의 검수·통합. 변경 허용은 scripts/development-recovery-path-guard.cs 한 파일이다.
- 시작 기준 source의 전체 raw SHA256은 아래와 같다.

```text
133F4DDACF6876690EE33EE82A48DCEF4D45065BF9DFCD75C4F31168CB74E199
```

## 이번 source 단위

원 C의 CHILD_PIN_LIFETIME 고정8argv(기존5개 + reportId32hex/observerSlot16hex/launcherTicks)에서 private 원 run의 pending producer를 만든다. slot/ticks는 상관 metadata이며 원 OS view가 없는 상태에서 SafeHandle로 채택/close하지 않는다. 같은 case의 old5argv 우회는 거절하고 다른 legacy5/worker6/guardian7은 유지한다.

원 host의 Execute/실제 Cleanup/Snapshot9 → 원 pending Capture를 연결한다. 현재 원 launcher/observer 신뢰와 전송 channel이 미연결이므로 fixture 획득 전에 fail-closed한다. partial source를 실제 상세 수집·전송 완료로 표시하지 않는다.

## 선택한 유한 직렬화 계약

- 현재 원 Snapshot의 9행과 빈 행, 필드별 문자열을 그대로 보유한다. 행당 최대8필드, 필드 최대256 UTF-16 code unit, 전체 payload 최대16KiB다.
- 구분자/JSON 재해석 없이 length-prefix binary로 보유한다. invalid surrogate도 .NET Encoding의 대체 문자로 바꾸지 않고 원 code unit을 직접 복사한다.
- 원 thread/run/retainedHost·Capture1회·원 run/commit/UTC 상관을 보존한다. 중복·잘못된 shape·null·크기 초과·직렬화 실패는 미확인이다. 절단해 정상으로 만들거나 exit-code로 상세9행을 대체하지 않는다.
- rows/payload는 private 원 소유로 유지하며 getter/ACK/완료·OS PASS 권위를 발급하지 않는다. 이후 pipe frame/END/ACK·원 peer/외부 exact trust·수집 검수는 별도 미완료다.

## 보존과 검수 한계

기존 Snapshot 본문·GUARDIAN/worker 동작·4false gate·기존 시간/프로세스 cap·R0 d71/F81·host/QA ps1과 보호자료는 변경하지 않는다. 원 C의 새 분기 no-console은 전체 C/다른 legacy 경로의 no-console 완료와 다르다.

실제 compiler/parser/C# TDD·Assembly load·pipe/process/fixture/ACL·OS·DB/TLS/service/Agent는 NOT_RUN이다. 다른 언어의 모사 시험이나 소스 문자열 assert로 native 동작 PASS를 만들지 않는다. 독립 정적 검수·실제 Git diff 확인과 미검증을 구분한다.

미래 report pipe1·event/buffer·최소 observer copy1은 아직 자원 생성·실행 허가가 아니다. 실제 C/G/W 총수3, breakaway총4의 cap delta도 기존 QAmax2에 채택하지 않았다. 75초 연장안은 사용하지 않으며 이후 전송 구현도 기존60000ms/UTC 남은 예산 안에서만 처리한다.
