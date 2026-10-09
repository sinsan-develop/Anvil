# U-01 Task4 두 조합 WSL-server R2 실측 결과

## 판정

`PARTIAL_BROWSER_PASS; FOUR_PHASE_NOT_ACCEPTED`. 기존 단일 브랜치의 최종 하네스 C `2373e91a0e4934a293c876467916894d3b2343c1`은 전용 WSL-server Docker network 안에서 두 허용 조합의 실제 OIDC/HTTPS/PG15/API/Chromium 화면을 단일 `granted` 상태로 통과했다. 그러나 이 마지막 실행은 이미 seed된 전용 DB에 대한 **직접 브라우저 재실행**이며, 새 정확 SHA의 빈 DB에서 `granted→revoked→restored→other`를 순서대로 수행한 정식 opt-in 네 phase가 아니다. E-SHOT/E-NET/E-API/E-AUD 묶음과 독립 Tester 인수는 아직 없다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`다.

## 실제 수행·실패 분리

- 사전 R2 계획의 전용 network `anvil-u01-two-pair-qa-3346252c-net`, tmpfs PG15 `150018`/migration0020/loopback5546, 합성 issuer·API·HTTPS Web/loopback8444·Playwright browser를 사용했다. 브라우저 내부 `anvil-f18-qa.local`은 전용 Web `172.26.0.10`으로 해석됐으며 WSL 호스트의 외부 동명 IP로 브라우저 요청을 보내지 않았다. API·Web·issuer 이미지와 첫 자원 SHA는 `3b0eb6ff930e0e3c49d752b33b2b4a7798a009b3`였다.
- 정식 `granted` opt-in 첫 실행은 `1 PASS, 1 FAIL, 26 deselected`, exit1이었다. 빈 원장 확인, 세 합성 신원 단일 트랜잭션 seed, 두 등록 조합·grant·Operations 행 검증까지 진행했고 브라우저가 고정 코드 `U01_QA_BROWSER_FAILED`를 반환했다. 이 실패 DB를 빈 상태로 가장해 같은 phase를 재실행하지 않았다.
- Developer는 기존 epoch106 정확 두 하네스 파일에서 실패 단계 고정 진단 C `e8ffca890b40a22a5917955217af1f03307db4ad`, 오래된 응답 경합 대기 보완 C `003c43ee9da45aae929b4500cb64e40ea6198828`, 합성 503·복구 대기 보완 C `2373e91a0e4934a293c876467916894d3b2343c1`을 순차 동결했다. Main 독립 최종 로컬 집중 `31 PASS/1 opt-in SKIP`, JS 자체 검사·구문 검사, Ruff·diff check exit0. 기존 Windows `.pytest_cache` ACL 경고는 보존했고 전용 pytest 임시 폴더만 검사 후 제거했다. Developer 정식 FAILURE_REPORT 0건.
- 같은 전용 런타임의 읽기 전용 진단에서 OIDC callback/session과 두 조합의 1/7/30일 scoped GET 여섯 건 모두 HTTP200·기간별 DB count 일치였다. 진단 하네스에서 첫 재실행은 `STALE TimeoutError`, 두 번째는 `FAULT TimeoutError`로 분리됐다. 마지막 C의 직접 Chromium 실행은 `U01_TWO_PAIR_GRANTED_PASS`, `pairs=2, reads=6, apiRequests=28`, exit0이었다. 이 실행은 화면의 1920×1080, pair/period 전환, stale 방지, 합성 503 경고·재시도, same-origin network 검사를 수행했으나 증거 디렉터리 환경변수가 없어 screenshot/network JSON을 생성하지 않았다. 정식 네 phase PASS로 승격하지 않는다.

## 정리·잔여

정확 ID·run label·network ID·이미지 revision·세 임시 root의 realpath/owner 및 Git clean을 확인한 뒤 전용 browser/Web/API/issuer/PG 다섯 컨테이너, 전용 network, 세 전용 이미지 tag, checkout/material/browser 세 root를 제거했다. `U01_QA_RESIDUE_ZERO`: 전용 label의 container/network와 세 경로, loopback5546/8444 listener가 모두 0이다. 캐시 원본 이미지는 유지했고 공유 `anvil-web` ID `f0107aada3b2`, `local-postgres` ID `99f3bf939d40`는 running 불변이다. `ysna-server`·Production 변경은 없다.

남은 조치는 기존 단일 브랜치에서 최종 하네스의 정확 SHA로 새 빈 전용 DB·issuer/API/Web/브라우저를 구성하여 네 phase를 순차 실측하고 E-SHOT/E-NET/E-API/E-AUD를 보존하는 것이다. 기존 R6 `STORED_ROW` 실패를 별도로 분리·재검증하고 최신 G-05 successor 및 독립 Tester 판정도 필요하다. 그 전에는 PR/main 병합, branch 삭제·신규 branch/U-02, 운영 검증을 진행하지 않는다.
