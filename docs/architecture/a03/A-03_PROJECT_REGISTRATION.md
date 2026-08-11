# A-03 Project Registration 정적 계약

contract_screen_id: `PROJECT_REGISTER`

이 문서는 `STATIC_ONLY / STATIC_CONTRACT_PASS` 계약이다. canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 증거는 `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`다.

## 입력과 조건

- 공통: `project_name`, `project_slug`, description, `repository_source_type`, default_branch, `environment`, `backend_policy_profile`, `operational_environment_connection_state`
- source `local`: `local_path`만 필수
- source `git`: `remote_url`만 필수
- credential·secret은 reference 또는 masked 상태만 표시하고 literal이나 무권한 local full path는 노출하지 않는다.

`environment`는 등록 대상 환경, `backend_policy_profile`은 실행 backend와 정책 profile의 선택값, `operational_environment_connection_state`는 운영환경 연결 상태의 화면 표시값이다. 연결 credential·secret·내부 주소는 표시하지 않는다.

Submit은 Project/Repository record를 만들고 read-only scan을 queue할 뿐 등록 완료가 아니다. 상태는 IDLE → VALIDATING → SUBMITTING이며 scan은 QUEUED로 시작한다.

오류는 병합하지 않는다: `409 PROJECT_SLUG_EXISTS`는 field:project_slug와 choose_unique_slug, `403 REPOSITORY_PATH_DENIED`는 field:local_path와 select_allowed_root_or_request_access, `422 REPOSITORY_NOT_FOUND`는 global과 correct_repository_source를 표시한다.

권한은 `PROJECT_VIEW`, `PROJECT_MANAGE`, `REPOSITORY_MANAGE`를 분리한다. view-only 사용자의 edit·confirm은 disabled이며 reason과 next_action을 표시한다.

설명은 `i-icon`의 `tooltip` 또는 `popover`로 열고 `reason`과 `next_action`을 포함한다. 상태는 icon + status_label + short_description으로 표시한다.
