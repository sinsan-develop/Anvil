# UI05 책임자·실행 상세 조회 문맥 보호 — source 작업지시서

기준: a683755ae1e806d1edd25ad8127ea19a692cf512 / codex/av3-stage-b. 담당은 기존 Primary, Main 검수·통합, Reviewer 읽기 전용. 목적은 승인 UI05의 현재 로그인 문맥과 보호 GET 원문을 결박하는 기존 동작의 직접 보완이다. 새 공개/권한/저장 계약이나 Agent 실행이 아니다.

## 허용2·시작 상태
- apps/web/src/features/session-detail/SessionDetailPage.tsx — SHA256 D426835C5DB994A3E942B23033FCD1F2A12A8AACDF0D34F91077DE961FA9618A
- tests/unit/UI05/session-detail-read-context.test.ts — 신규, 부재 확인
기존 보호 untracked3 및 완료 UI11/관측 HTTPS/FN14/FN18 source는 보존한다. 이 두 경로 외 제품/시험/서버/SQL/App/CSS/도구 수정0. Main은 같은 제품을 쓰지 않는다.

## RED 우선·최소 구현
현재 Page loaded/effect key는 assignment/project/revision에 묶이며 auth 문맥/transport를 포함하지 않는다. 실제 행동 RED 전에는 확정 결함으로 보고하지 않는다. 실제 React Page·기존 readSessionDetail/decoder·현재 App의 같은 mount 경계를 사용하여 정상 보호 원문 조회부터 도달한다. 그 뒤 주체/client/CSRF·API 객체/동일객체 transport 변경·A→B→A·지연401/JSON과 첫 commit을 관측한다. 정상 fixture 부재/해석 오류는 제품 RED가 아니다. 실제 반례가 없으면 제품을 수정하지 않고 증거만 반환한다.

확인된 경우 현재 조회 scope를 render부터 결박하고 지연 응답·오류·콜백은 출발 scope와 현 API/transport가 맞을 때만 채택한다. 새 문맥 첫 commit부터 이전 상세·파일검사 원문을 숨기며 기존 화면의 재조회로 현재 원문을 얻는다. 관측 ABA를 시간상 같은 세대로 합치지 않는다. old401은 새 인증 해제를 호출하지 않지만 current401은 기존 동작대로 전달한다. unmount/문맥 변경 후 늦은 완료는 새 loading/원문을 복원하지 않는다.

기존 정상 상세·새로고침·관련 child 표시를 보존하고 checkpoint/criteria/PENDING/UNKNOWN 원명령·부모 버퍼를 조회 보완 때문에 초기화/자동 전송하지 않는다. 읽기 흐름 POST0. 기존 decoder/정확 hash/권한/보안 기대값을 바꾸지 않는다. 상관없는 child 기능 전체 재작성/리팩토링/전수 보안감사0.

## 검증·보고
신규 실제React 메모리DOM 정상/주요음성과 직접 인접 session-detail API 시험, 정확 root typecheck(-p tsconfig.base.json), diff check를 선택 실행한다. Vite는 기존 write:false/envDir:false 양식만 사용하며 새 의존성/실HTTP·실브라우저·QA디렉터리·사용자자료조사0. 실제 DB·권한·키·서비스·Agent/기존 프로젝트 차단해제0. native 브라우저/레이아웃·실DB·사용자인수는 미검증으로 남긴다.

최종 시작/끝 hash·diff·정확명령/exit·실제 RED→GREEN·오류 횟수·미검증·자원/handle0·허용2만 수정/소유 반환을 보고한다. Main fresh 검증·독립 C/I 검토·증거/계획현황 기록·지정 private branch 게시 후 다음 계획으로 이어간다. 전체 UI05/계획 완료로 승격하지 않으며 main 병합은 미충족 실제 gate 때문에 하지 않는다.
