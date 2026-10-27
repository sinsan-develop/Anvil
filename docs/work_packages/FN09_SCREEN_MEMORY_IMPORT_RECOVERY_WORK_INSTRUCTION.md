# FN09 기존 화면시험 메모리 import 수집 복구

2026-10-27 · Main 어울 · 기준 codex/av3-stage-b / 4f5701c5a7251ceb9354fd15504ec2035658419e.

## 목적·권한

승인된 FN09/UI04와 FN11의 직접 영향 회귀 검증이다. 기존 tests/unit/FN09/responsible-session-screen.test.ts는 단일 TSX만 메모리 변환하고 하위 TSX를 file: URL로 가져와 Node에서 수집 실패한다. ClaimUnderstandingHistory.tsx import는 앞선 기준선에도 있었으며 제품 결함으로 소급하지 않는다. Main409add의 실제 node --test는 ERR_UNKNOWN_FILE_EXTENSION/exit1/수집FAIL353.264ms다. FN09 본기능 checkpoint의 코드·실제 App 증거는 반복하지 않는다.

## 단일 담당 허용 경로

- tests/unit/FN09/responsible-session-screen.test.ts 한 파일만 수정한다.
- 기존 화면4건의 이름·assertion·데이터·부작용0·명령/권한 의미는 변경하지 않는다. 시험을 삭제/skip하거나 예외를 삼켜 수집 성공처럼 만들지 않는다.
- 기존 Vite/React 의존성만 이용해 필요한 하위 TSX를 메모리에서 변환·import한다. 새 공통 loader/전역 hook/의존성/실파일 산출물/환경설정 추가0이다. transformWithOxc의 국소 재귀 메모리 변환 또는 이미 있는 write:false 메모리 소비 중 더 작고 실제 모듈 관계를 보존하는 방법을 선택한다. type-only import를 실제 값으로 바꾸거나 React 복수 인스턴스를 만들지 않는다.
- 제품 source/SQL/API/Auth/DB/정책/권한/Secret/서비스/Agent/외부 비용·보호 untracked8·기존 결과서/WI·Main 현황은 수정0. Git commit/push는 Main만 수행한다.

## 순서·검수

1. PMO AGENTS→project AGENTS→WORK_STATUS/WORK_PLAN의 FN09/UI04·이 지시서를 읽고 실제 branch/HEAD/변경 소유권을 확인한다. 새 branch/별도 사용자 채팅/자동화/자식 생성0·동시 writer1이다.
2. 실제 수집 실패와 기존 import 관계를 읽고 시험 한 파일의 변환 부분만 최소 수정한다. Main이 실패409add를 이미 확인했으므로 같은 불변 실패를 반복하지 않는다.
3. node --test tests/unit/FN09/responsible-session-screen.test.ts로 기존4건이 실제 수집·실행되는지 확인한다. 기존 core/신규 승인 웹 helper의 직접 인접 영향이 있으면 필요한 파일만 검사하고 전체 회귀/브라우저/DB는 반복하지 않는다. type/diff 확인.
4. 단일 담당이 diff·시험 명령/exit/실제 결과·hash·미검증을 제출하고 동결한다. Main fresh 4건/독립 변경 검수 후 이 소유 시험과 최소 결과/현황만 기존 branch에 checkpoint/private 게시한다. 변경 전·후 증거를 보존한다.

## 자원·완료 의미

Node 프로세스의 메모리 변환/SSR만 사용한다. 실브라우저/파일·listener/PG/컨테이너·외부 Agent·QA 디렉터리 생성0이다. 이 시험 수집 복구가 전체 기능·정식 서비스·DB/사용자 인수 완료를 의미하지 않는다. rollback은 소유 시험의 후속 revert이며 기존 자료/서비스 복원은 수행하지 않는다.
