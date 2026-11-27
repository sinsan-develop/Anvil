# IX02 QA 입력 자료 v1

승인된 `docs/work_packages/IX02_QA_ACCEPTANCE_PREPARATION.md`의 QA A/B에 사용할 source-only 입력이다. 프로젝트·등록·허가·실행 환경을 만들거나 Agent 결과를 기록하지 않는다. 파일별 바이트 수·SHA-256·import·목적·향후 읽기/쓰기 경계는 [v1/manifest.json](v1/manifest.json)에 고정한다.

| 입력 파일 | 향후 격리 QA 내 위치 | 목적 |
| --- | --- | --- |
| `v1/qa-a/ready-state.mjs.fixture` | `src/ready-state.mjs` | 기존 exact READY 함수. 공백 지원은 아직 구현하지 않은 RED 기준선 |
| `v1/qa-a/ready-state.test.mjs.fixture` | `test/ready-state.test.mjs` | Node 내장 test/assert만 사용하는 지정 시험 |
| `v1/qa-b/requirements.json` | QA B의 고정 읽기 입력 | 합성 도서 목록·고정 상세의 AF02/AF04 제안 요구와 검수 조건. 제안 결과물 아님 |

QA A의 새 지원 범위는 문자열 `READY` 양끝의 ASCII SP/HT/CR/LF뿐이다. 내부 공백·대소문자·다른 상태·비문자열·비ASCII 공백은 미지원으로 유지한다. 향후 변경 허용 후보는 위 두 목적 파일뿐이며 의존성 추가·파일/환경/네트워크 접근은 없다. 현재 두 `.fixture`는 repository 기본 시험 glob에 들어가지 않는다. 원본을 덮거나 완성 함수를 미리 제공하지 않는다.

디렉터리 전용 `.gitattributes`는 `*.mjs.fixture text eol=lf`를 적용한다. JSON·Markdown은 저장소의 기존 `-text` 바이트 보존을 따른다. 원시 SHA는 manifest의 세 입력에 적용하며 Windows/Linux checkout에서 개행을 변환한 다른 입력을 동일 자료로 취급하지 않는다.

지정 시험은 향후 격리 QA root에서 `node --test test/ready-state.test.mjs`다. 현 기준선은 3건 중 기존 READY와 미지원 보존 2건 통과, ASCII 양끝 공백 1건 실패가 기대값이다. 이는 의도한 작업 입력이며 실제 Agent의 수정·시험 통과 결과가 아니다. 현재 확인은 이 두 파일을 읽고 Node 메모리 모듈에서만 연결하며, 목적 경로로 파일을 복사하거나 외부 명령을 실행하지 않는다.

QA B는 QA A와 별개다. `expectedProposalScope`는 요구 누락을 검사할 목록이며 설계·계획 본문, Agent 답변, HUMAN 판단을 대신하지 않는다. 실제 제안을 받은 뒤 기존 보호 원문·고정 양식·별도 HUMAN 검토로 확인해야 한다. 코드·구현 명령·자동 확정/적용과 A의 결과·권위 재사용은 허용하지 않는다.

QA 프로젝트 ID, 별도 QA 저장소의 사전 commit, 고정 문서 전체 참조, 등록·세대·환경·도구/모델, 한도·실행 승인·증거 위치는 아직 미결박이다. 현재 Anvil commit과 자료 SHA는 입력 출처만 고정하며 실제 실행 권한을 발급하지 않는다. 실행 준비/실측과 source/RAM 확인을 구분한다.
