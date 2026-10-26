# FN17 승인 알림 조회·명시 읽음 화면 검수 결과

판정: UI source와 합성 API/Edge 핵심 경로를 연결했다. 실제 DB·알림 생산·정식 서비스 연결은 미완료이며 FN17 전체 완료가 아니다.

- 담당: 구현 fn17_notification_ui, 독립 검수 fn17_notification_ui_review, Main 어울 검수·통합. Main 제품 코드 수정 0.
- 기준: codex/av3-stage-b / 1e61743a1fed1ffb8e3c083568499610812e9410; WI 4FD02BF50E30A3B3CB8A428CC72A7B42161BECA75F187EF91E47BE923EA3D45A. 정확 변경 8경로/지문은 FN17_APPROVAL_NOTIFICATION_UI_SOURCE_MANIFEST.json.
- 변경 이유: 서버 본인 목록/고정 조회와 표준 markNotificationRead를 기존 설정 화면에 연결한다. App은 주체·프로젝트별 원명령을 보존하고 AccountSecurity는 optional slot만 추가한다. BrowserPushSupportPanel의 오래된 미구현 문구 1곳을 정정한다. 기존 메뉴·테마·인증 입력·서버 생산자는 보존한다.

## 동작과 검수

명시 목록/상세 조회·기존 승인 요청 링크는 쓰기를 발생시키지 않는다. 읽음 클릭만 현재 제어와 서버 정책을 확인해 고정 명령을 전송한다. DTO 9필드/원참조/hash·본인/프로젝트를 검사하고 동일 명령 재확인, 접근 상실 시 상세 숨김, 늦은 응답과 ABA 차단을 적용했다. 503은 빈목록으로 숨기지 않는다.

초기 독립 C0/I2/M0: (I1) 접근 회복 조회에서 readAt이 있으면 미확인 원명령 재확인이 막힘, (I2) 즉시 후속 거절이 확정 receipt를 과거 pending으로 덮음. 동일 writer가 readAt/미확인 구분과 App 실제 소비 mergeNotificationPending의 단조 receipt 보존으로 보정했다. 재검수 두 건 ADDRESSED, scoped C0/I0/M0.

- 담당자 단위/인접 31 PASS(359.1495ms), typecheck/diff exit0. Main 5843c7 API 단위 15 PASS/FAIL0/SKIP0(220.7699ms), 정확 제품 지문 대조. Node 시험은 실제 parser/transport를 소비하는 합성 검수이고 실제 DB가 아니다.
- Main 최초 미구현 RED 1b7c61: App에 새 패널 부재, 기존 보안 입력 존재. 검수 반례 0e2d34/334dd8의 I2와 73bdc7의 I1 RED를 보존했다. 최초 I1 count 선행 오류는 실제 결함 판정과 분리했다.
- 최종 제품 bundle 625b42(write:false, 442 modules/433ms). Main 772da6 등록 9개 중 8 PASS/1 기반 fixture FAIL(8740.251ms). I2 403 assertions 통과 후 404 query 문서가 fixture에 연결되지 않아 connection refused.
- 제품/API/unit 불변 상태에서 spec의 정확 404 root-query 연결과 검증 후 PNG 1장만 보완. Main bf465d I2 집중 1 PASS/FAIL0/SKIP0(3185.008ms), 403·404 모두 확인. **동일 제품에 대한 8+1 범위 충족이며 9개 단일 실행 PASS가 아니다.** 등록 수는 원7+회귀2=9; 이전 8+2=10 집계는 정정했다.
- 독립 리뷰 당시 spec E03109287F74D4F81311F5C7EA31A9D5B62D305A1493A2C40A47A95730C4F080 → 최종 D78D9BAD0298F446AD6EDD10DB3560E766E141C82A67DC2BA913F110A1C86227. 뒤 변경은 위 fixture/PNG만이고 Main diff 대조·집중 실행으로 확인했다. 제품5/단위 지문은 불변이다.
- 1920/390 키보드 조회·패널 overflow 검사, 같은 origin 요청과 POST 부작용 검사. Main은 1920 PNG를 직접 확인했다. 실제 모바일·전체 접근성·모든 화면 검수로 확대하지 않는다. impeccable 기계 검사 fa762e 5경로 결과[]/exit0.

## 미완료·정리·복구

전체 앱 재시작 이후 영속 복구는 미지원이다. CSRF/API/transport 교체 시 원명령을 보존하고 전송/재확인을 차단하며 자동 재결박하지 않는다. 실제 사용 가능한 정식 알림 생성/저장·정책·설정 저장·다른 사건/채널·푸시와 served 검수는 미완료다. 미채택 생산 원자성/10000행 상한을 이번 구현으로 채택하지 않았다.

QA 3회는 각 새 30분 수명으로 사전 등록하고 RED/REVIEW_RED/GREEN 증거를 분리했다. 각 exact 경로/소유자/link/process 확인 후 회수하고 별도 잔류0 확인. 마지막 d8a0a8 정리와 2026-10-26T18:52:21.5489356Z 독립 부재 확인은 resource JSON에 있다. 비밀/실제 사용자 browser/DB/서비스/OS 알림 허가/Agent 호출 변경0. PNG는 합성 QA 폐기와 함께 삭제했고 SHA256 1195B74929F2DF719B52A5144B0A0D01F7B90D887AD98CA3E2AF8CBE3649081A 및 관측을 보존했다.

Rollback은 소유 source checkpoint의 정상 revert이며 DB·실자료 삭제는 없다. 전체 Stage/계획 완료나 사용자 인수를 선언하지 않는다. 다음 미완료 기능의 독립 구현을 계속한다.
