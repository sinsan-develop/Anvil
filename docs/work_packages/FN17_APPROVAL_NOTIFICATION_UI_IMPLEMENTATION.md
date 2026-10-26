# FN17 본인 승인 알림 목록·명시 읽음 화면 구현 계획

> 단일 subagent 구현·TDD 후 Main 독립 검수/통합. superpowers:subagent-driven-development 적용.

## 목표·권위

기존 UI14 설정의 브라우저 지원 관측 가까이에 현재 프로젝트 본인 앱 내 승인 알림의 명시 목록/고정조회·요청 상세 이동·명시 읽음을 연결한다. 기존 FN17/INTERFACES9필드·표준 markNotificationRead, backend source checkpoint1e61743a1fed1ffb8e3c083568499610812e9410와 FN17_APPROVAL_NOTIFICATION_READ_SOURCE_IMPLEMENTATION.md/6323849260870EA5FAC48DE22A20E3E5FA5830F2C7DB64F30CDFD018B5675150를 소비한다. 실제 알림생성/SQL/정책·서비스·발송은 제외한다.

기존 설계/P01 시안의 Operate 화면과 현재 status-card·폼·버튼 스타일/12px·설명i 원칙을 유지한다. 새 메뉴/대시보드/알림설정/테마·아이콘·도구를 추가하지 않는다. impeccable context는 Main644040에서1회실행했고 PRODUCT/DESIGN 별도파일은 없다. 기존정본설계/실제CSS/패널을 권위로 사용하며 초기 인터뷰/PRODUCT새작성으로 기능을 지연시키지 않는다. UI 편집 직전 craft-floor를 읽는다.

## 허용 경로

1. 신규 apps/web/src/notifications/project-notifications-api.ts: 같은origin reader/DTO/ref·고정command/reconcile·owner scope.
2. 신규 apps/web/src/notifications/ProjectNotificationsPanel.tsx: 본인 목록/상세/읽음/오류·미확인 UX.
3. 기존 apps/web/src/App.tsx: user/client/project별 미확인 command buffer 소유·로그아웃회수·settings slot 최소연결.
4. 기존 apps/web/src/shell/AccountSecurity.tsx: optional ReactNode slot만 BrowserPushSupportPanel 곁에 소비. 기존 재인증/비밀번호/복구입력 remount·초기화/기능변경0.
5. 기존 apps/web/src/notifications/BrowserPushSupportPanel.tsx: 앱내목록 미구현이라는 오래된 한 문구만 현재별도조회/저장소상태로 정정. 브라우저권한/지원분기불변.
6. 신규 tests/unit/UI14/project-notifications-api.test.ts
7. 신규 tests/browser/UI14/project-notifications.spec.ts
8. 신규 tests/browser/UI14/project-notifications-harness.tsx (필요최소; 기존 실제 App bundle fixture 재사용 우선)

실제경로는 rg목록·Test-Path로 확인하고 같은이름충돌시 Main에보고한다. SQL/backend/기존시험/CSS/새의존설치·Git/DB·서비스/정책부여/Agent/Secret/OS알림허가/구독/외부전송 변경0. App 전체재작성·공통화/권한편집확장0.

## 동작·위험 경계

- 프로젝트가 없으면 API를 호출하지 않고 기존 프로젝트 선택 동선만 안내. 조회는 버튼으로 명시, 서버의 READ/UNREAD/ALL·page기본50·다음/처음재조회만. 빈목록은 실제200빈목록에서만; 401로그인상실,404회원/대상상실,503저장소미연결/무결성/실패를 구분한다. 일반진도/합성행·임의ID입력0.
- 목록/상세의9필드·원ref/corehash(readAt제외)·현재project/recipient·날짜/literal/수신자/링크대상을strict검증한다. Node서버모듈을 브라우저 런타임 import하지 않는다. 타입은type-only·기존browser hash/표준VersionRef/제한body/ApiClient를 재사용한다. 잘못된응답/타인/오프오리진대상은표시/POST0.
- 요청상세 링크는 같은project/request ID로 기존 approvalRequestHref/mobile helper만 사용한다. 클릭·상세조회·목록조회는 읽음/승인/제어권 변경0, 원 reason/risks/token/임의URL을표시하지않는다.
- 명시 읽음 클릭에서만 현재제어client/generation을 기존 documentControl류 reader로 확인하고 원알림ref/actor/client/project/commandId/expectedVersion1을 고정해 표준 POST한다. 실제정책은서버가재검사하며 UI가자동부여/허가주장하지않는다. REQUIRE_APPROVAL미연결/현재제어·정책거절은설명하고새일회승인을만들지않는다.
- 정상receipt의정확원command/target/ref/status/readAt을검증한다. 실제읽음은확정응답/같은ref조회로확인하고낙관업데이트0. 확인실패와처리반영은분리한다. 응답유실/503 NOTIFICATION_READ_RESULT_UNCERTAIN은같은고정command만명시재확인, 새command자동발급/이중전송0. 불확실은설정화면왕복에도App소유메모리buffer에보존한다. 전체앱reload/장애후영속복구는이번범위미지원으로보고.
- actor/client/project·CSRF/APIclient/제어세대·선택ref·component수명과비동기결과를결박한다. 주체/기기/프로젝트교체·로그아웃/403·404후늦은응답이과거내용을재표시하지않는다. 진행/미확인중다른명령/닫기/대상변경이원command를잃게하지않는다. 같은프로젝트로왔다갔다하는ABA·동일객체복제·오래된이벤트도세대/소유경계로차단한다. 기존인증입력과다른작업buffer는보존한다.

## 수행·검수

- [ ] 기존 route/App/settings/동일command buffer 및 실제 API reader를 좁게대조·source4/5 before/after이유고정.
- [ ] API 단위 RED: DTO/hash/actor/ref/receipt·unknown·동일command 재확인, 실제 parser/transport 부작용을검사. 파일존재만으로GREEN0.
- [ ] 최소UI 구현·단위/직접인접/typecheck·메모리bundle build. 새브라우저QA 자원은 Main이등록/부재/owner/nonlink/시간확인한뒤에만실행한다. 기존앱/server/실DB는기동하지않는다.
- [ ] 실제Edge 합성DOM: 정상명시목록/상세링크·읽음/한명령, 503≠빈목록, 유실/reconcile+화면왕복, 권한거절·주체/target/CSRF/API교체·늦은응답폐기, 기존보안입력보존. 최소1920/좁은화면레이아웃과키보드접근을같은브라우저에서확인한다. 전체브라우저/전수0.
- [ ] 요청URL·offorigin0·자동승인/읽음0·pageerror0·dataScope·freshsource hash/검증raw/미실행·자원정리·writer해제를보고한다. Main실행은개별등록QA에서독립수행한다.

지원관측/설정/핵심문구/운영동선을재설계하지않는다. 소스동작·합성DOM을 실제서버/DB/알림생성·모바일기기/푸시/사용자인수로올리지않는다. rollback은소유source checkpoint 일반revert, 실제DB/정책/자료삭제0. 다음미완료publisher/실제DB/나머지사건·설정·채널은별도유지한다.