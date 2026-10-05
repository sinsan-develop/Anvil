# F-20/U-01 R45 Queue 격리 경고 표시 계획

## 목적과 승인 범위

설계서 §29.2의 Queue 카드에 이미 있는 동일 Dashboard snapshot의 실제 격리 작업을 연결한다. 기존 F-13 서버·공개 API·DB·인증 계약은 변경하지 않는다. 격리 작업을 0건 관측했다고 Queue 전체를 `HEALTHY`로 표시하지 않으며, 현재의 `UNKNOWN`을 유지한다. 이는 Queue의 **확인된 이상만** 보여 주는 절편이지 6종 Health source 완성이 아니다.

기준은 `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `Anvil_통합검증매트릭스_v1.md` AV-UI-003/007/010/013/014 및 AV-OPS-001~003, `Anvil_테스트계획서_v1.md` U-01이다. 기존 R44 Health 상세는 동일 snapshot의 유일한 저장 alert와 신호를 결합할 때만 링크를 만든다.

## 데이터·화면 계약

- `GET /api/dashboard/operations`의 같은 응답에 담긴 `quarantine`, `alerts`, `observed_at`, `source_gaps`만 사용한다. 격리 행은 `job_id`, `attempts`, `reason`, `quarantined_at`의 정확한 타입·형식·상한·고유성을 검증한다. 검증 실패·source gap·미래시각·권한 차단에는 경고 근거를 만들지 않는다.
- 유효한 격리 행이 1건 이상이면 Queue 카드에 `LATE`와 **현재 범위에서 관측된 격리 작업 수** 및 snapshot 시각을 표시한다. 기간 누적 오류 수, worker 가동 여부, 전체 Queue 정상 판정으로 해석하지 않는다. 격리 행이 0건이면 기존 `HealthSignal`의 명시적 신호가 없는 한 `UNKNOWN`을 유지한다.
- 상세 원인은 기존 저장 `QUEUE_JOB_QUARANTINED` alert가 해당 격리 행과 정확히 일치하고 유일할 때만 같은 페이지 fragment로 연결한다. 이때 code/source/cause/impact/observed_at/evidence를 같은 응답에서 가져오며 alert의 `deep_link`를 이동 URL로 쓰지 않는다. 중복·불일치·오래된/해결된 alert는 링크 없이 관측 수만 표시한다. 기존 R44 Health 상세 결합과 R43 Critical 우선 Next Actions를 보존한다.
- 새 경고 Event·중복 조치·서버 측 상태 변경을 만들지 않는다. 비밀·fencing token·내부 주소·SQL 오류를 표시하지 않는다.

## 실행 순서와 writer 경계

1. Main은 기존 `codex/f18-wsl-ops` clean HEAD와 R44 종료 seq2072·worker/write null·문서 hash·G-05를 검산한 뒤 이 계획과 WorkInstruction을 사설 브랜치에 checkpoint한다. 새 브랜치를 만들지 않는다.
2. Main은 제품 exact5의 canonical dual lease를 발행하고 단일 `developer-primary`에게 인계한다. Main은 제품 파일을 동시에 수정하지 않는다.
3. Developer는 유효한 격리 행 1건/여러 건, 0건, 중복·위조·미래시각·source gap, alert 유일/중복/해결, 인증 차단/철회의 console RED→GREEN 단언을 수행한다. 기존 R35/R43/R44 회귀를 보존하고 Web typecheck/lint/build를 실행한다.
4. Main은 독립 diff·권한·중복 경고 검토 뒤 정확 제품 SHA를 private push한다. WSL-server clean 동일 SHA의 일회성 PG15/OIDC/HTTPS/Chromium에서 실제 저장 격리 alert의 카드 클릭→API↔DOM·same-origin/secret을 검증하고 전용 임시 자원만 정확 신원 검사 후 제거한다. 실행 불가 항목은 PASS가 아닌 미검증이다.
5. 결과보고서·`docs/WORK_STATUS.md`에 실제 명령/exit, 오류 횟수, 미검증과 rollback을 기록하고 write→worker lease를 회수한 뒤 G-05/checkpoint/private push한다.

## 제외와 중단 조건

Queue 전체 정상 판정, Health 실제 6종 source, period/Project/Environment 필터, Critical acknowledge, 공개 API/DB/schema/auth 변경, Provider/PG18/Production/ysna 검증, U-01/F-20 인수는 포함하지 않는다. ReleaseDecision `DEFER`를 유지한다. `DIR` 도달 또는 승인된 요구사항/중요 위험 변경이 생기면 해당 경계를 보고하고 영향받지 않는 계획 작업을 계속한다.
