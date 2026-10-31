# UI10 관련 고정 원문 보기 경계 — 메모리 행동검수

2026-10-31 / Main 어울 / 승인된 범위의 검수 보완 완료, 전체 UI10·계획 미완료

## 기준과 변경

- branch `codex/av3-stage-b`, control `5dd7198041525e26b6cb283b168e42f3ba12908e`.
- WI `docs/work_packages/UI10_SCOPE_ORIGINAL_BOUNDARY_TEST_20261031.md`, SHA256 `A02C5AA3F625309903B1FDC6DA521B549664DFB6EEB292F0E863A4584AF4FC39`.
- 기존 Primary 단일 writer가 신규 `tests/unit/UI10/knowledge-scope-original-boundary.test.ts` 한 파일만 작성했다. 19,274 bytes, LF/CR0, SHA256 `A48FE630F998D6971F1D9A6091F2D92B02D33747F17CA1FF013B784BB8A21496`.
- 제품·기존 시험·설정·SQL은 변경하지 않았다. 기존 동작에서 신규 시험이 통과했으므로 제품 RED→GREEN 수정이 아니다.

## 실제 검증

Main `0d2c2d`:

`C:/Program Files/nodejs/node.exe --test tests/unit/UI10/knowledge-scope-original-boundary.test.ts tests/unit/FN05/knowledge-scope-original.test.ts`

신규 4개+직접 인접 5개, 9 PASS / FAIL0 / SKIP0 / CANCEL0 / TODO0, exit0, 649.6982ms.
수행자의 최종 9 PASS/704.2558ms는 별도 실행이며 합산하지 않는다.
Main `b07ef1`: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json`, `git diff --check`, 신규 파일 공백·지문 검사 exit0. 제품 불변이므로 전체 build와 다른 완료검사는 반복하지 않았다.

- 실제 KnowledgePage 목록 버튼·inspect·fullref key/unmount를 거쳐 A 조회 중 B로 바꾼 뒤 늦은 A 성공을 폐기한다. **B에서 폐기한 후 A에 재진입하는 순서**이며 같은 view 객체로 먼저 A에 복귀한 뒤 응답을 푸는 ABA 시험은 아니다.
- 부모 교체 후 늦은 401이 B의 오류나 인증상실 callback으로 전파되지 않는다.
- STAGE 마지막 method 응답의 실제 JSON parse 후 반환 대기 중 실제 닫기를 누른다. JSON/hash 완료 후에도 원문·오류·진행 표시가 되살아나지 않고 명시 조회로 회복한다.
- snapshot의 실제 native digest 완료 후 원결과 반환만 보류하고 닫는다. 가짜 hash 성공 대역 없이 원결과를 반환한 뒤 비노출과 명시 회복을 확인한다.
- GET만 허용하며 예상 밖 호출·POST·자동 추가 GET·부모 변경 callback0, 편집 buffer 불변을 확인한다.

독립 Reviewer는 동일 지문의 한 파일을 읽기 검수해 C0/I0/M0를 반환했다. 수행자의 주장과 독립 실행을 구분했다.

## 발견 사항과 한계

- 실제 부모의 ScopePicker와 DocumentPicker가 같은 tuple key를 쓰는 기존 React 경고가 노출됐다. 수행자 최종 실행에서 26회였으며 Main 실행에서도 관측했다. 숨기지 않았고 이번 제품 변경으로 보정하지 않았다. 실제 화면 누락·중복이나 데이터 손상은 이번 검증으로 입증하지 않았다. 별도 원인 보완 대상으로 남긴다.
- 준비 오류: 추정 conversation 경로 조회1, Vite virtual entry resolve1, PowerShell quoting parser1. 제품 동작 실패와 구분했고 기존 기대값을 낮추지 않았다.
- gate finally 해제·root unmount·native/global 복구·소유 MessageChannel 양 port close를 구현하고 Node 정상 종료를 확인했다. 새 브라우저·listener·파일 산출물·지속 QA 자원은 없다.
- 실제 브라우저 레이아웃/보안·원서버/DB·실권한·사용자 인수는 미검증이다. 사용자 자료/백업 대상 조사, DB·권한·키·서비스·Agent 실행 및 기존 프로젝트 차단 해제는 수행하지 않았다.
- 통합 소유 경로는 신규 시험·본 결과·WORK_PLAN·WORK_STATUS 네 개뿐이다. 보호 untracked3와 기존 복구 자료는 보존한다. rollback은 소유 commit 정상 revert이며 실제 DB rollback은 없다.
