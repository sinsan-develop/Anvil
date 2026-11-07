# UI01 저장 임무 초안 목록의 이전 페이지 복귀 — WI

## 근거·범위
승인 WORK_PLAN의 UI01 저장 임무 초안 조회·상세 이동과 SCREEN_WORK UI01 cursor/뒤로·재조회 범위다. 현재 다음 cursor만 보관하여 3→2 복귀가 없다. 기존 listAssignmentDrafts 보호 GET을 유지하고 성공한 페이지 cursor 이력을 보존한다. 기준 codex/av3-stage-b / 469d206d4f616dfc35bbb619311909bc19341139.

- 기존 Primary 단일 writer, Main 관리·검수·통합, 기존 Reviewer 읽기 검토. 새 agent/chat/branch/자동화0.
- 실제 DB·권한·키·사용자 파일 조사·서비스·Agent 실행·기존 프로젝트 차단 해제0. 새 API/helper/SQL/권한·parent 계약 변경0.

## 허용2경로
1. apps/web/src/features/projects/ProjectAssignmentDrafts.tsx — 시작 SHA256 D4BD33D2E8B6BD29AA073CF5B2FAE17C46F170974FA2E4A12E2AB56D2FBBCF86.
2. tests/unit/UI01/project-assignment-drafts-pagination.test.ts — 신규 부재 확인 후 작성.
추가 경로 필요 시 Main에 정확한 근거를 먼저 전달한다. 기존 완료시험 공통화·프레임워크·의존성·전역CSS·부모 변경0.

## 구현·검수 기준
- 명시 조회 뒤 1→2→3→2→1 이동. 이전 버튼은 현재 성공 페이지의 이전 cursor가 있을 때만 표시한다. 기존 상세 fullref 링크·DRAFT/실행상태 아님·서버 관측·limit50·유한응답 검산을 보존한다.
- 요청 대상과 확정된 이력을 구분한다. 성공한 탐색만 페이지 이력을 확정한다. 실패/손상/만료 cursor를 빈목록/완료로 처리하거나 첫페이지로 자동 대체하지 않는다. 오류 후 명시 재시도는 같은 대상 cursor이며 성공 후 번호/이력 정확. 재조회/닫기 초기화. 중복 클릭 요청 차단.
- disabled·project/client 객체·공개 mutable transport 전환과 닫기 후 늦은 JSON/오류 폐기. 렌더로 관측한 transport ABA도 이전 결과를 되살리지 않는다. 현재 활성 요청401만 인증 만료 전달한다. 같은 client 내 사용자 식별자는 현재 props에 없으므로 임의 public prop 신설하지 않고 실제 client/transport·부모 key 경계를 검수한다.
- 실제 component+ApiClient/원 decoder의 의미 있는 RED→GREEN. 3→2→1/오류후동일재시도/닫기·재조회/문맥교체·늦은JSON/401/중복/GET-only/상세링크/부모동작 핵심을 소형 기존 메모리 DOM 패턴으로 검증. 실제 브라우저/HTTP/DB 검증과 구분한다.
- 직접 인접시험은 읽고 영향 있는 것만 선택한다. type·메모리 Web build·diff. 완료 quota/UI06/UI03 검사 불변이면 반복0.
- 기존 Operate/12px·원 패널 유지. UI 쓰기 직전 impeccable craft-floor를 읽고 target1 detect 수행. Main context49c4db 실행 완료, 도구 init/새 PRODUCT/DESIGN·리디자인0.
- Primary는 diff·지문·정확 명령/exit·RED→GREEN·오류·미검증 제출 후 writer 반환. Main fresh 및 독립 C/I0 후 소유 파일만 기존 branch 통합. 전체 UI01/계획 완료로 확대하지 않는다.
