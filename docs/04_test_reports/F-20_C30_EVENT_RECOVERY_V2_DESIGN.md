# F-20 C30 Event 원장 비파괴 복구 설계

## 결정과 범위

신산님은 기존 정상 원문과 오염된 작업 branch 원문을 모두 보존하면서, 같은 branch에서 검증된 새 원장 세대를 시작하고 후속 Event·승인 binding을 재검증하는 방안을 승인했다. 이 승인은 과거 Event의 재작성, force push, `main` 선병합, F-20 수락, Release 전환, 운영·`ysna-server` 작업 승인이 아니다. 작업은 현재 `codex/f18-wsl-ops` branch, 로컬 개발, 필요할 때 Git push 후 WSL-server의 동일 SHA 검증에 한정한다.

## 사고 경계와 신뢰 근거

- 원격 `development/main`의 Event 1~1680과 사고 직전 부모 `97adc5cf7070c71b61a5d6902d31cf195329b38f`의 공통 Event 의미는 같다. 원격 main의 Event 1~1334 원시 객체 prefix는 3,994,695B, SHA256 `bdb3aa36358097923a9dd100e9dee80b9905b09f590d49cc0f97dc557fbd119b`다.
- 사고 commit `14c8c5743890c4a8a58686b9430144a55b1317e7`은 기존 seq1689~1712의 의미 24건을 바꿨고 seq1713~1714를 추가했다. 현재 branch의 Event 1~1334 원시 객체 prefix는 4,022,935B, SHA256 `50195e96fcd9eea4357dead1554ac20adf3aff81e916376a10dca9ea2958ddbc`다. 기존 11건의 `accepted=true`와 대응하는 상태 변경은 유효한 과거 수락이 아니다.
- 현행 seq1715~2040은 사고 후 재작업·통제의 감사 자료다. 변경된 선행 hash chain 때문에 이 기록을 새 세대의 독립적인 수락 권위로 취급하지 않는다. seq1714의 F-20 수락, 그에 기대는 manifest와 승인 binding은 무효로 유지한다.
- 정상 anchor는 사고 직전 commit `97adc5cf7070c71b61a5d6902d31cf195329b38f`의 Event Git blob `b59ac57228f9b5684b939dc30fc7d7bce5dbbb54`(1,712개, 4,349,558B, 전체 SHA256 `2755283a52c6aa384129e516a3ea52d23647dd5e7bf1d68ec63c248a0b0ee36f`)다. 컷오버는 현재 `9485465ddb046a48e61ee14c7cdd0e62df0a6e70`의 Event Git blob `0f86d09446b40905e9d33e9e6cbe4c1380a63218`(2,040개, 4,787,039B, 전체 SHA256 `5167a3ac73e8c914144340f0b1506ce144470657ae75caafef0dafbb4e5d1dbf`)다.

## 복구 표현

1. 현행 `docs/progress/progress-events.json`의 Event 객체 1~2040 원시 bytes를 그대로 둔다. 이 전체 컷오버 blob의 Git object ID와 SHA256을 복구 manifest에 고정한다. JSON 외부 header는 새 Event 수에 따라 바뀔 수 있으므로 원시 보존 판정은 각 기존 Event 객체의 연속 prefix bytes와 컷오버 Git blob을 함께 사용한다.
2. 먼저 현행 차단 세대에 C30 복구 WorkInstruction 및 dual lease 발행·회수 Event만 append한다. 이 통제 Event는 새 세대의 독립 수락 권위를 만들지 않는다. 검증기와 독립 증거가 준비된 뒤 이어지는 새 `EVENT_LEDGER_GENERATION_STARTED`는 `generation=2`, 검증된 사고 전 anchor의 Git commit·blob·원시 prefix hash, 오염된 컷오버 blob·원시 prefix hash, 격리한 Event 범위와 의미, 독립 검증 manifest, 그리고 현재의 비수락 상태를 명시한다. `previous_event_sha256`은 물리적 append 연속성만 증명하며 새 세대의 권위 근거가 아니다. 새 세대 권위는 정상 anchor와 독립 검증에만 결박한다.
3. seq1689~1714의 변경·추가 Event는 역사적 사고 증거로 보존하고 권위 투영에서 제외한다. seq1715~2040은 원문 감사 자료로 보존하되, 각 WorkInstruction 파일 hash, lease 발행·회수, fencing token, 후속 상태를 독립 검증해 검증 가능한 사실만 새 세대에 명시적으로 채택한다. 과거 수락·Gate PASS·Release GO를 암묵 이월하지 않는다.
4. 검증 성공 뒤 독립 Tester의 read-only 확인을 근거로 새 `EVENT_LEDGER_RECOVERY_VERIFIED`를 append할 수 있다. 그 전에는 C30 `OPEN_BLOCKING`을 유지한다. 확인 후에도 원문 사고는 `RECOVERED_WITH_QUARANTINED_HISTORY`처럼 감사 가능한 상태로 남기고, F-20/U-01은 미수락·Release `DEFER`를 유지한다. 확인 실패 시 새 세대를 활성 권위로 사용하지 않고 C30 차단을 유지한다.

## 필수 검증과 거부 조건

- 정상 anchor는 지정 commit의 실제 Git blob에서 읽고 지정 hash·이벤트 수·연속 sequence를 재계산한다. 현재 오염 blob도 지정 Git object와 현재 파일의 2040 객체 prefix를 byte-for-byte 비교한다. Git history 재작성 또는 원본 부재는 실패다.
- 기존 24개 의미 차이와 2개 추가 Event, 11개 거짓 수락의 정확한 ID·범위를 재검산한다. 숫자만 일치하거나 단순 재직렬화로 의미가 달라진 경우는 실패다.
- 후속 325개 Event의 기존 chain·sequence·ID 유일성, WorkInstruction path/hash, worker/write lease pairing·epoch·fencing 및 회수 상태를 독립 검증한다. 확인할 수 없는 historical file hash는 PASS로 표시하지 않고 새 세대 활성화를 차단한다.
- 모든 approval binding은 정본 WorkInstruction·문서 hash와 실제 승인 기록에 다시 결박한다. 사고로 만들어진 승인/수락은 대체하지 않는다. 신규 승인 사실을 만들어내지 않는다.
- `check_project_progress.py`의 현행 G-05는 새 세대의 anchor·컷오버·상태를 검사해야 하며, 기존 C30 음성 검사를 제거하거나 단순 허용값 변경으로 통과시키면 안 된다. 정상·변조·원본 부재·거짓 수락·lease 불일치·잘못된 승인 binding에 대한 테스트가 필요하다.
- 결과에는 실행 명령/exit code, local 및 WSL-server 동일 SHA, 미검증 항목, 임시 자원 정리, rollback을 기록한다. rollback은 원본 Git blob과 컷오버 commit을 보존한 상태에서 새 세대 활성화를 멈추는 것이며, 기존 기록을 삭제하지 않는다.

## 경계

이 설계는 C30 Event 권위 복구에 국한한다. U-01의 Project/Environment 권한 조합, 공개 API, DB schema, Critical ACK mutation 등 별도 중요 위험·계약 변경을 승인하지 않는다. 해당 기능은 기존 승인 범위와 별도로 판정한다.
