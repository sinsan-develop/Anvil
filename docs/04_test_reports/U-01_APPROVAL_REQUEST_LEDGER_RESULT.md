# U-01 승인 요청 원장 — WSL 반영 결과

## 판정

신산님이 명시 승인한 **DB 0021 적용과 새 API·화면 반영은 완료·핵심 동작 확인**이다. 전체 U-01 인수나 정식 환경의 비영 요청 생성 완료는 아니다. `U-01 NOT_ACCEPTED / Release DEFER`를 유지한다.

## 기준과 계보

- Package: U-01 / APPROVAL-REQUEST-LEDGER, branch `codex/u01-dashboard-r2`.
- 설계 SHA256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 계획 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`.
- 원 WI `935DD7F83D1153F7645ABAACCE1CC8810D84ADE5EEBDB1F8CC930E9219D57258`, R2 WI `CB62616F2055B295EF4F1BE499A7A5F1491B24C490402F0F2E4599DB2B54E172`, R2 Invocation `DB16830F8E5A31EB8CAA6C87B2A54C816C42629090FE1BEE0AD663161E8A07EC`.
- 사람 승인: `APPROVAL-20261014-U01-APPROVAL-REQUEST-LEDGER-001`, `APPROVAL-20261014-U01-TASK-PLANNING-AUTHORITY-001`. 이번 정식 적용 직전 직접 지시 `남은 작업은 **DB 0021 적용과 새 API·화면 반영**하자. 승인해`를 STATUS에 기록했다.
- 코드 C20 `f03348ac680e624ee0ca41e2b97ca07b38aff677` → manifest M20 `8586eaa8052cfb46ffbafead8084b424a0365b27` → B20 `714ff88fc6bf3bb03c1cbd2e23083af1831faa84` → H20 `6d3196260056924167e3203cb479eb4cf8058eac`. 시작 HEAD는 M20, 당시 Main 소유 STATUS 기록만 dirty였다. 제품 코드 재수정·재빌드하지 않았다.

## 실제 반영·검증

- 정식 Git M20 exact/clean과 manifest의 C20 source16·실제 image·백업/복원 proof를 대조했다. `/opt/venv/bin/alembic upgrade 0021_approval_requests`를 등록된 일회성 migration 컨테이너에서 실행해 exit0. 기존65 schema/data 지문은 적용 직전/직후 exact이며 신규4테이블 행0, 자동 권위·사람 승인·Run 실행0이다.
- API `a773c348b7c7111cff7a8a9165c09fa122b09b4685337a34126da067112723aa` / image `sha256:9938508bcdff673ed1dcb47f2f7ccedb7c170e0f5cf73ada6ee1086130e7b9c5`.
- Web `ccaf91d5dc99729be1b0aa1709866a4af01d119dbb84d97f710b1afd96bb6e77` / image `sha256:103252ad406f03e52ae2ad1799c9929e7e1ed2f5c96d50fe45ee4054c1069838`.
- 기존env/Entrypoint/Cmd/bind/UID/security/논리DNS/IP를 보존한 exact-ID 교체, issuer 기존ID/image·reader권한·보호파일hash·망정의 불변을 대조했다. 정식 operator exit0와 별도 독립 조회 exit0, 인증서 검증 `/api/health/ready`는 `ready / 0021_approval_requests`다.
- Chromium151.0.7922.34 /1920×1080의 실제 재인증 → 선택 조합의 원장 `AVAILABLE / count0 / items[]`와 화면 `전체 0건` → 기간7d/1d → 다른 조합403 → 실제 UI 로그아웃/카드 제거/세션false/조회401: attempt02 exit0. same-origin과 Secure/HttpOnly/Strict cookie·DOM credential 비노출, 선택 인증/성공 기능 본문7의 서버 비밀 비노출을 확인했다. 전체 background 응답 감사나 전체 R6 증거는 아니다.
- 선택 조합 Run0/Queue0과 전역 DB Task1/Run1은 다른 모집단이다. 정식 DB에 가짜 요청/계획/권위/Task/Run을 넣지 않았다.
- 이전 로컬41P/UI3P·격리 PG15 producer10P·타입/lint/build·암호화백업/격리복원 증거는 각 당시 실행 범위로 재사용했다. 이번 반영에서 그 완료 작업은 반복하지 않았다. 격리 PG의 실제 producer/경합/만료/감사 rollback/권위 회수·인가 GET 증거를 정식 비영 요청 생성으로 승격하지 않는다.

## 오류와 정리

이전 플랫폼 거부와 ACL helper 오류는 보존했다. 이후 읽기 성공을 이유로 권한/ACL을 바꾸지 않았다. 기존 서비스 정지는 exit0/OOMfalse였으며 direct 원인·정지 주체는 미확정이다. 기존3 start 뒤 strictCA ready0020을 회복했고, 시작 helper의 정지시 빈IP 비교 실패·후속 template escaping 오류는 제품 오류와 구분했다.

배포 preflight의 옛 f010 rollback 빈 proxy-network 설정 오독은 exact ID·미연결 상태만 인정하고 전체 network 객체 보존을 비교하도록 보완했다. 첫 브라우저는 전체 DB Run1을 선택조합 Run1로 오인한 Main helper assertion으로 exit1이었다. 실제 scoped loader/summary의0건을 읽어 helper 가정만 교정했고 제품·시험 기준은 바꾸지 않았다. 중간 진단 속성 오독과 생성 stdout 인코딩 오류도 실제 제품 실패와 분리했다. 독립 보완 검토는 C0/I0/M0, 첫 실패를 소급 PASS로 바꾸지 않았다.

일회 migration/env·두 브라우저명 및 격리 PG는 정리 뒤 독립 부재를 확인했다. 종료된 전용 QA Git/venv 두 경로는 exact C20/무변경/owner/nonlink/관련process0 확인 후 제거했으며 source는 private Git에서 복구 가능하다. 정식 repo·서비스·DB·image·암호화 backup/proof는 유지한다. 보호 proof는 root0600이고 비밀 원문을 Git·보고서에 넣지 않았다.

- migration proof SHA256 `124DEB2A2192A7896863BDC0B7EE38C0F67FC890DF9255FFD7671D1EDA06D50B`.
- deployment proof `94242A07F1DB47D99DD1B2F8BDF5E5E4CC471C85C2C3ECF8126292FC6F1021D0`.
- browser proof `22287E8380CCB228B3DCEEAB160C944B02655EEDA873D515D6702BE4D6F6325E`.
- B20/H20 각각 독립 C0/I0/M0·local/private clean actual G05 seq2437/2439 PASS. H20은2438 write→2439 worker REVOKED/active0·기존Event2437 원문과 전체 completed lease를 보존했다. 본 보고 게시본 G05는 별도 확인한다.

## 남은 범위·복구·사용 방법

정식 환경에서 비어 있지 않은 요청을 실제 계획 확정으로 생성해 화면까지 확인하는 경로는 **미검증**이다. 만료 이력의 공개 목록은 **미제공**이다. 사람 승인·반려 UI/결정 쓰기, 자동 Run 실행/재개는 이번 승인 범위에서 제외했으며 구현·허용했다고 보고하지 않는다. 역사 R6 실패/DC-U01-019와 전체 미구현·미진은 유지한다.

직전 API3c52b542/Web1497bbf9는 명시된 approval-request rollback 이름으로 정지·망분리 보존했고 이전5개도 보존했다. 요청/감사 보존이 우선이며 DB downgrade·snapshot 이후 원본 dump 자동 덮어쓰기는 하지 않는다. old API 복귀 시0021 readiness 불일치 가능성이 있으므로 완전 복구로 단정하지 않고 roll-forward를 판단한다. 원본/복원본의 raw schema hash 차이와 제한된25개 표현 재해석 증거·교차서버 의미/권한복원 미검증은 M20/STATUS의 구분을 유지한다.

신산님 확인: `https://172.27.253.53:3770/` → 재인증 → `Anvil WSL 개발 / WSL 개발 환경` → **승인 요청 대기**. 실제 현재 요청0건 안내를 확인하고 기간 변경·로그아웃을 사용할 수 있다. Oracle/Production·외부공개·PR/main·새브랜치·예약 생성은 하지 않았다.
