# UI03 방법론 확정 사건 상세 연결 작업지시서 r2

목표: 현재 기존 GET에 있는 정확한 방법론 버전의 사용자 확정 사건을 공통/프로젝트 전용 화면에서 기본 접힘 상세로 조회한다. 제품의 내장 방법론/사용자 정의·원문·이력을 보존하며 실제 확정/적용/실행을 하지 않는다.
기준 HEAD caa9327f5aacd6557946e4a757f897753e0aef74, 기존 codex/av3-stage-b. Main 관리·검수·통합, 기존 Primary 단일 writer/Reviewer 읽기 검수. 신산님 현재 전체 WORK_PLAN 완료 지시 및 승인계획 내 구현·테스트·필수개발 재승인 불필요 지시, PMO AGENTS§6, 프로젝트 AGENTS 최신10/17·§5.1에 따른 내부 표시 누락 보완이다. 새로운 API·데이터/권한 계약을 만드는 작업이 아니다.

## 승인 계약·실제 누락

WORK_PLAN Stage B UI03/FN02, SCREEN_WORK UI03/기능카드 FN02의 방법론 버전·검토·확정·이력 조회, 설계§4.1/§11.4를 소비한다. MethodReviewPanel.tsx87은 확정 이력 있음/없음만 표시한다(Main df8403/54bdd1·독립대조). api.ts11/55~56은 confirmation.id/decision/decided_at/decidedBy/reviewRefs를 실제 대상ref와 ACCEPTED로 검증한다. 공통 MethodologyEditorPage94와 프로젝트 ProjectMethodologyPage76은 동일 패널을 소비한다. 기존 공통 양식(FormReviewPanel) 확정 상세와 다른 잔여이며 완료한 기능을 재개발하지 않는다.

제품 시작 SHA256 CD2069AED956519BBE2DECE3E1F89E05ABCA2AABDA5C96ED6E2202B68CA90766.

## 정확 허용 코드4경로

1. apps/web/src/features/methodology-editor/MethodReviewPanel.tsx — 기존 표시부만 보완.
2. tests/browser/UI03/method-confirmation-details.spec.ts — 신규 한정 실제 렌더·합성 API 시험.
3. tests/browser/method-confirmation-details.config.ts — 신규 격리 시험 설정.
4. apps/web/src/features/methodology-editor/ProjectMethodologyPage.tsx — 기존 MethodReviewPanel 렌더에 !loading && !error 조건만 추가. 기준 SHA256 CDB11FDB0B85782337001636529A60682290B137E98B1974FD0AE1C68043EF59.

위 전용 부모 한 조건 외 제품 API/reader·server/SQL·부모화면·기존시험·공통bundle·공통양식패널·의존성·다른작업 수정0. WI/결과/계획/현황은 Main 소유. 새 경로/확인되지 않은 파일을 추측해 조회하지 않는다. 필요한 추가 심볼은 Main에 요청한다.

## 화면·안전 조건

- 확정 사건이 있으면 기본 접힌 details에 확정 ID, 원 decision, 정확 원 decided_at(원 시간문자열 보존), 확정 사용자 ID, 확정 당시 reviewRefs의 검토 ID·대상 ID/버전/지문·기준 버전/판정을 읽을 수 있게 한다. 기존 검증된 구조를 사용하고 자료를 새로 계산하거나 현재 최신 검토로 대체하지 않는다. 실제 ContentReviewRef는 {id,criteriaVersion,targetRef:{id,version,contentHash},outcome}뿐이며 검토 자체 version/contentHash는 제공되지 않는다. 이를 대상 버전/지문과 혼동하거나 만들어내지 않는다.
- 이력은 해당 저장 버전의 과거 확정이며 현재 프로젝트 적용/현재 권한·실행 승인·내용 독립검수 합격이 아니라는 기존 문구를 유지한다. 미확정 null은 기존 없음 표시를 보존하고 임의 빈 확정 객체로 만들지 않는다.
- user/client·정확 source ref(id/version/hash)·confirmation.id가 바뀌면 열림 상태를 초기화한다. 기본 접힘이 실제 DOM source 전환 뒤 유지되도록 key 또는 동등 방식을 사용한다. 다른 source/오류/권한 상실 뒤 옛 사건을 남기지 않는다. 전용 부모는 일반500/응답오류에서 source가 남으므로 기존 loading/error 상태로 패널 렌더를 잠그는 위 조건을 추가한다. 미저장 검토 입력/미확인 명령은 기존 buffer에 보존하며 이 표시 장벽을 이유로 삭제하거나 명령을 재발행하지 않는다. 인증/권한 검사나 부모 상태 계산은 바꾸지 않는다.
- 열기/닫기는 추가 GET/POST·명령/승인·자동변경0. React 텍스트 escape/줄바꿈·긴지문 줄바꿈을 유지하고 HTML 실행0. 브라우저 요청은 existing same-origin만, 내부주소/Secret 출력0.

## 구현·검증 순서

- [ ] 기준HEAD/단일writer/제품hash·신규2파일부재·보호8/dirty소유를 확인한다.
- [ ] 기존 실제 페이지+기존 GET parser를 통과한 합성 응답에서 사건상세 누락 RED를 먼저 확보한다. 패널이나 validator를 fake함수로 대체해 통과시키지 않는다.
- [ ] 패널 최소 표시·문맥 초기화 및 전용 부모의 명시한 렌더 조건만 구현한다. 무관 리팩토링/새endpoint/권한/SQL0.
- [ ] 공통/전용 정상, 미확정, 과거 버전/최신검토와 다른 확정당시reviewRefs, source 전환 기본접힘·일반500/응답오류·403 뒤 과거 자료 제거·기존 미저장 입력/미확인 명령 보존, HTML 실행0·추가 요청/쓰기0을 한정 실제 합성 브라우저로 검증한다. 직접client prop교체를 현App harness로 증명할 수 없으면 미검증으로 분리하고 소스 장벽을 그 직접 증거로 보고하지 않는다.
- [ ] 기존 직접 인접 UI/reader 시험만 선택하여 회귀·타입·빌드·diff를 수행한다. 본체/환경불변이면 같은범위 반복0. 최종 명령·exit·분리실행·4hash·dist지문·미실행/오류·QA소유를 제출하고 writer해제한다.
- [ ] Main fresh 최소검증·독립C/I검수·QA회수/별도부재확인 후 정확코드4+문서4를 기존branch에 게시한다. 실제Stage gate 전PR/main병합0.

## QA 사전등록·금지

신규 root D:/tmp/anvil-v3-stage-b/ui03-confirmation-details-20261030-01(54bdd1 부재), Windows owner Main/단일Primary. 하위 temp/results·기존 msedge/Playwright, 생성 후 최대30분. 생성 직전 부재·owner/link/realpath·기존영향을 확인한다. 기존 apps/web/dist 정상 파생 build + ANVIL_UI04_QA_DIST=apps/web/dist의 기존 in-process route.fulfill, 제품서버/listener/포트/실DB0. 설치/다운로드0. 정확자기 QA process 종료·link/owner/해석절대경로가 등록root임을 확인한 뒤 자기자원만 회수·독립부재확인. 남의QA/원자료·보호8 삭제0, 실제키·DB·서비스·Agent·권한·인증서/Oracle 변경0. 정상 build 경고는 보존하고 자동수정하지 않는다.

자동심사가 계획내범위를 인정하지 않으면 정확거절/실행여부를즉시 Main에보고한다. 승인근거 없이반복/우회0. 같은근본오류3회연속이면해당단계중단·Main예외판단. 미채택158E·공유B issuer/ABA·P03 R2 소진/재시도금지·기존FN16범위는바꾸지않는다. rollback은본한정단위정상Git revert이며제품자료/키DB서비스불변. 실제DB/served·사용자인수/전체UI03/FN02/WORK_PLAN 완료를주장하지않는다.

## r2 사전검토 보완 근거
- 부모78F274B1 지문의사전독립I1: 전용부모는일반오류후source를남겨단일패널만으로오류상태를알수없다. Main172127 실제분기를대조해기존loading/error렌더조건1개만정확4번째코드로추가했다. 계약/권한/요구사항변경아닌원요구구현범위보완이며아직codeGO전이다.
- Main87eacf 실제ContentReviewRef16 정의로검토자체version/hash부재를확인하고표시필드를정확화했다. 필드발명/기준완화0.
