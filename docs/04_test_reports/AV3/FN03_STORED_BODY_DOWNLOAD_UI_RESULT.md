# FN03 저장 문서 본문 원본 다운로드 연결

판정: **구현했지만 실제 다운로드 동작 미확인**. 고정 링크/조회 보호 5건은 합성 App에서 확인했고, 브라우저 파일 바이트 검수는 canceled로 실패했다. 전체 FN03/FN16·계획 완료가 아니다.

- 기준 codex/av3-stage-b b9672277f25dd215562735039abb94144cd5fda2, WI E1AE71CCFADE3F7E2B0E6E25BF7D34886620C939E1B8D13B615C98441F2DA1C6. 구현 fn03_body_download_ui / Main 어울 관리·검수·통합·제품수정0.
- 기존 확인된 content.body의 고정 ArtifactRef 보호GET 링크를 추가하고, 읽기/목록대기·오류·선택/주체·API/transport·세대·화면수명/ABA와 결박했다. 클릭 때 현재성을 다시 검사한다. 기존첨부·본문view/원문bytes/API·권한·DB/Secret·서비스변경0. 직접 actor/client/transport 교체·캡처handler 동적시험은 NOT_RUN이고 source검수만 했다.
- 제품변경전 Main072d03 RED1FAIL/7080.698ms: 원문일치 뒤 링크부재. spec65490FDA43E09249DCD01E57206C16FFA6DA7296F1695D8EA9EE5FC287713353.
- 담당자 tsc exit0(da53ab), 직접인접 document-attachments 단위5 PASS241.5494ms(65c032), diff0(b46d49), impeccable detect[]/exit0(36e9a3). 독립2경로 C0/I0/M0.
- Main1c0a4a 최종제품 Vite442 modules620ms/write:false. c2bc3f 새6건 **5 PASS/1 FAIL/0 SKIP**,6688.72ms. 고정v1/v2별서로다른artifact/href·추가자동GET/POST0·입력/읽기대기/hash오류·목록대기/실패·프로젝트이탈late/복귀·단계변경의5건을확인했다. 다운로드는첫v2 event후failure=canceled이므로saveAs/바이트/SHA/BOM/CRLF/PNG에미도달했다.
- systematic-debugging 적용: 제품 없는 최소UTF8 anchor에서 page.route(b95523)와 context.route(43c715) 모두download이벤트/canceled·root응답만관측, fileGET이interceptor에도달하지않았다. 제품click취소로단정하지않고합성전달경계미충족으로분리한다. Main최초진단7b9ff0/d2801d는charset선행누락에따른click미도달timeout이라판정근거에서제외했다. 실패/기대값을바꾸거나TLS우회/다른포트서버로바꾸어통과시키지않았다.
- 실제보호서버·TLS/인증/격리·다운로드파일bytes는미검증이다. 기존유효TLS/서비스복구뒤동일본문경로를재검수한다. 실패를PASS로소급하지않고, 실제UI버튼만으로사용가능완료라고하지않는다.
- RED와GREEN 각등록30분자원은exact owner/nonlink/process0확인후eacd27/9fb201회수, 별도부재/process0확인했다. resource JSON에원결과·asset/context/최소진단지문·수명·정리를보존했다. PNG는미생성, 실제DB/서비스/인증서/브라우저사용자profile/Agent변경0.

변경2경로 working SHA256:

- apps/web/src/features/design-trace/DocumentsPage.tsx — 4418525451859B712F0E34C24FA236B201D27A76272625BE31576C7E44F2A56E
- tests/browser/UI06/document-read.spec.ts — 81D4E4AD85BD79622F36D58FA95566801AFBC4F6FA1BBD68AB542E5DC02764C7

Rollback은소유source checkpoint의정상revert이며원본/DB변경없음. 다음승인된FN16의선택파일 실제포함/제외manifest생성·재검증엔진을진행한다. 공적반출형식/새저장API는확정되지않았으므로내부엔진과분리한다.

커밋 인덱스 확인:

- apps/web/src/features/design-trace/DocumentsPage.tsx — 4418525451859B712F0E34C24FA236B201D27A76272625BE31576C7E44F2A56E / RAW_IDENTICAL
- tests/browser/UI06/document-read.spec.ts — 81D4E4AD85BD79622F36D58FA95566801AFBC4F6FA1BBD68AB542E5DC02764C7 / RAW_IDENTICAL
