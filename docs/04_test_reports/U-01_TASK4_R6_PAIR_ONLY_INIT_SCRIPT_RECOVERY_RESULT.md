# U-01 Task4 R6 PAIR-only init-script 보정 결과

## 판정

비제품 Playwright 하네스 보정과 epoch120 통제 종료만 완료했다. 기본 R6 실측은 FAIL, U-01은 `NOT_ACCEPTED`, Release는 `DEFER`다. 뒤따르는 `PAIR_LIST_API` 404 응답 본문 대기의 직접 원인은 미확정이며 `DC-U01-019`를 유지한다.

## 기준과 변경

- 부모 승인: `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`. WI SHA-256 `C37ADD4AA32CC180740E409C4E4048CFBF63FEDB2E18E6AD799E94FEC30428DD`, Invocation SHA-256 `CE02F1E79F3209AF44618366562AA141621B1DF1954F8EF8B4C17DCA9800A7EF`.
- 기존 branch `codex/u01-dashboard-r2`의 W11 `68a6c809` → A10 `8bd07892` → C10 `aef01973` → B10 `a0ea4a93` → H10 `63fcbadf69b7ce7ad7b2eb7a3cf5c0931eca8f7a` 직계 계보. 새 branch·PR·main 병합·ysna/Production 작업은 없다.
- C10은 `page.addInitScript`의 잘못된 다중 인자를 함수+단일 `{mode, timeoutMs}` 객체로 고친 비제품 변경이다. 제품 fetch·공개 API·DB schema/migration·인증/권한/Secret 계약은 불변이다. 변경 전 A는 `PAGE_CREATE` exit1, B 미실행이었다.
- H10에서 Event seq2388 `WRITE_LEASE_REVOKED` → seq2389 `WORKER_LEASE_REVOKED`를 원문 append-only로 기록했다. epoch120 두 lease `REVOKED`, active worker/write/agent null, 제품 write scope0이다.

## 검증과 한계

- C10 로컬 집중·인접 Python 및 Node 구문/self-test, 독립 코드 리뷰 Critical0/Important0/Minor0, 사설 원격 exact-SHA clean G-05 seq2387 PASS. H10 정확5 통제문서 독립 리뷰 Critical0/Important0/Minor0, `git diff --check` exit0, 사설 원격과 동일 clean SHA에서 `python -B scripts/check_project_progress.py` → `G-05 project progress contract: PASS sequence=2389 reporting=AUTO_CONTINUE` exit0이다. 기존 `.pytest_cache` ACL 경고는 보존했다.
- WSL-server의 새 빈 격리 PG15/OIDC/HTTPS/Chromium A/B는 같은 사설 Git exact C10 SHA `aef01973504ac050ba1660f804095f9d67f7570a`, migration `0019_oidc_sessions`, 비관리자 role/DB, PG·Node·browser image, harness·seed/권한 hash, Chromium151.0.7922.34, timeout10000으로 pair-only mode만 비교했다. A 완전 정리·잔여0 뒤 B를 만들었다.
- A 기본 모드 opt-in exit1(1 failed/2 warnings): 첫 `PAIR_LIST_API` 404 BODY/requestfinished/response.finished PENDING, lifecycle BEFORE_BODY, index4/round4. 임시 clone 원격 별칭의 첫 G-05 exit1과 role SQL 인용 오류2는 사전환경 오류로 분리·수정했고 A G-05 seq2387 PASS와 migration0019을 확인했다.
- B pair-only 모드 opt-in exit1(1 failed/2 warnings): 첫 pair clone 소비와 원 요청 BODY/requestfinished/response.finished DONE, lifecycle AFTER_BODY. 뒤 index21 `PAIR_LIST_API` 404는 다시 BODY/requestfinished/response.finished PENDING·`NETWORK_RESPONSE_FACTS` TIMEOUT이다. 첫 요청 본문 소비와 완료 경계의 연관만 관찰됐으며 전체 R6 PASS나 모든 pair 대기의 원인·제품 결함 확정이 아니다.
- A/B 각각 등록 경로 owner/realpath/nonlink 및 PG exact ID/label/image/mount/AutoRemove/loopback port를 확인해 전용 자원만 정리했다. A/B 등록 경로8·컨테이너 이름5·loopback5545 잔여0을 독립 확인했다. 격리 QA를 정식 통합·사용자 인수 PASS로 승격하지 않는다.

## 미충족·다음 행동·롤백

기본 R6, E-NET/E-API/E-AUD/E-SHOT 전량, AV-SAFE-034/AV-OPS-027/AV-UI-017 및 U-01 독립 인수는 미충족이다. 기존 branch의 별도 최소 비제품 WI에서 뒤 pair 404 BODY 대기 인과를 좁힌다. 404 허용·timeout 연장·body/Secret/off-origin 감사 생략·F-19A 임의 활성화·제품 fetch 변경은 하지 않는다. 롤백은 신규 비제품 커밋을 정상 `git revert`하되 역사 Event·승인·사설 원격 복구 ref를 보존한다.
