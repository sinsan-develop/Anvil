# FN12 보관 보완 이력 페이지 왕복 source 작업지시서

기준: b8c8cd73df0a860e217c6c5a317fc076a3cf045c / codex/av3-stage-b. 기존 Primary 구현, Main 검수·통합, 기존 Reviewer 읽기. 승인 FUNCTION_WORK FN12의 보완 원문 추적과 기존 protected /rework-pages·signed cursor GET을 재사용한다. 2026-10-20의 기존20+2/더오래된조회 검수는 완료이력으로 유지한다. 새 API/SQL/권한·실후속임무 생성 계약이 아니다.

## 단일 writer 허용2
- apps/web/src/features/session-detail/StoredResultReworkHistory.tsx — 시작 SHA256 53884AB199DF950FF5946E9F1EE2537AB033BD5DDC9EFF999B6DC9B4242F1E17
- tests/unit/UI05/stored-result-reworks-pagination.test.ts — 신규, 부재 확인
완료 UI11/UI05 root/관측HTTPS/FN14/FN18 및 기존 보호 untracked3을 보존한다. Main 제품write0. API/decoder·서버·SQL·기존시험·App·CSS/의존성 변경0.

## 목적·필수 동작
현재 widget은 단일 cursor와 pageNumber만 보관해 더 이전 이동·첫페이지 새로조회만 지원한다. 방금 보던 더 최근 페이지로 돌아가거나 실패한 동일 cursor를 재조회할 수 없는 행동 RED를 실제 React widget·기존 decoder로 먼저 확인한다. 준비오류를 제품 RED로 세지 않으며 반례가 없으면 제품을 수정하지 않는다.

성공한 요청 cursor 이력/위치와 아직 성공하지 않은 target을 분리한다. 첫→더 오래된→방금 본 더 최근 페이지 GET을 명시 버튼으로 왕복하고, 다음 또는 복귀 실패 후 같은 target cursor를 명시 재조회한다. 성공 전 위치를 확정하지 않으며 자동재시도0, 기존 첫페이지 새로조회는 명시 동작으로 유지한다. 기존 signed cursor/만료·오류/hash 기준을 완화하지 않는다.

페이지 이동/실패/문맥변경 시 선택 상세 원문은 즉시 숨기고 새 페이지에서 사용자가 명시 재선택해야만 기존 고정GET으로 연다. 현재 결과/임무 fullref·프로젝트·API 객체/실transport가 바뀌거나 unmount되면 옛 응답·오류/401/하위 조회 콜백을 새 화면에 반영하지 않는다. 실제 관측 ABA도 분리한다. 새 auth prop/부모 API를 추가하지 말고 현재 부모의 unmount 경계와 기존 props 안에서 처리한다. 현재401/403·정상 보호 원문 조회는 유지한다.

목록은 보관 이력이며 현재 예약/권한·후속 임무 생성·실제 배정/재개/실행 허가로 표시하지 않는다. POST0·부모버퍼 변경0. 최신항목/상세 자동선택0. 다른 화면의 인증 보완을 기계적으로 확대하지 않는다.

## 최소 검증·반환
신규 실제 React 메모리DOM 시험과 기존 protected decoder로 왕복/실패 동일cursor/성공전위치/원문숨김·명시재선택·문맥/transport·중복클릭/현재오류·POST0을 확인한다. 직접 인접은 I/O없는 기존 stored-result-reworks API 시험만 내용확인 뒤 선택한다. 신규시험은 기존 Vite write:false/envDir:false 양식을 사용한다. createServer/실설정 탐색/시험 이름필터에 기대는 광범위 파일실행0. 실브라우저·파일parser종단·실API/DB/권한·키·서비스·Agent·사용자/백업대상조사·프로젝트차단해제0.

고정 Node·정확 root typecheck(-p tsconfig.base.json)·diff check를 실행하고 실제 명령/exit·선정/미선정·RED→GREEN·오류·시작끝지문·QA/live0을 반환한다. 명령목록/결과수를전체Gate로확대하지않는다. Main fresh/독립최종C-I/정확소유경로통합뒤다음미완료로이어가며전체FN12/계획완료는아니다. commit/push/문서write는Main소유다.
