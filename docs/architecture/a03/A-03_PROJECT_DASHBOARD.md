# A-03 Project Dashboard 정적 계약

contract_screen_id: `PROJECT_DASHBOARD`

이 문서는 `STATIC_ONLY / STATIC_CONTRACT_PASS` 계약이다. canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 증거는 `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`다.

## 운영 흐름

운영자는 `project_filter`, `environment_filter`, `period_filter`, `last_refreshed_at`으로 범위를 고른다. Health card는 `DATABASE`, `QUEUE`, `WORKER`, `LLM_PROVIDERS`, `EXECUTION_BACKENDS`, `ARTIFACT_STORE` 여섯 종이며 각각 icon, status_label, short_description, last_checked_at, error_count, detail_link를 제공한다.

운영 card는 `RUNNING`, `APPROVAL_PENDING`, `BLOCKED`, `REQUIRED_GATE_MISSING`, `COST_OVERRUN`, `BASELINE_CONFLICT` 여섯 종이다. 성공률은 `period`, `sample_count`, `pass_count`, `skipped_count`를 같이 표시하고 SKIPPED는 성공에 포함하지 않는다.

Next Action은 priority, target, reason, elapsed, `deep_link`로 Project Detail의 원인 tab에 이동한다. Critical Alert는 code, source, occurred_at, owner, acknowledge_action을 가진다. 모든 상태는 icon + status_label + short_description으로 표시한다.

설명은 `i-icon`의 `tooltip` 또는 `popover`로 열고 반드시 `reason`과 `next_action`을 포함한다. 상시 설명 박스와 색상 단독 상태는 금지한다.

이 산출물은 브라우저, API, DB, Network, Docker 또는 운영 증거가 아니다.
