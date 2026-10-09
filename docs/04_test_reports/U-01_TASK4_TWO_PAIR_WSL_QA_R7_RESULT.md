# U-01 Task4 두 조합 R7 WSL-server QA 결과

## 판정

`FOUR_PHASE_API_URL_VERTICAL_QA_PASS; FULL_E_NET_AND_U01_NOT_ACCEPTED`. 기존 단일 branch `codex/u01-dashboard-r2`의 로컬·사설 `development`·WSL-server clean exact SHA `c1d145c6fb52ab53ab9daa7ff584276b8ac1402b`에서 새 빈 격리 PostgreSQL 15, 합성 OIDC/HTTPS/API/Web/Chromium으로 `granted→revoked→restored→other`를 같은 DB 수명에 순서대로 실행했다. 각 phase는 `2 passed, 60 deselected`, exit 0이며 각각 18.96·15.38·13.91·6.53초였다. 이는 해당 수직 절편의 PASS이다. U-01 전체, 기존 Foundation R6, G-05 successor 및 Release 인수는 아니다.

## 근거와 독립 검토

- 새 QA checkout과 세 이미지 revision은 위 SHA에 일치했다. 전용 PostgreSQL은 `server_version_num=150019`, migration `0020_f19a_pair_grants`, 시작 다섯 원장 `0|0|0|0|0`; 종료 프로젝트/환경/grant/등록감사/운영감사는 `2|2|2|8|5`였다. HTTPS ready 200, 브라우저 `America/Los_Angeles` 실제 timezone, Web 전용 IP `172.24.0.10`, loopback PG 5546·Web 8444를 확인했다. 비 opt-in 하네스는 전용 venv에서 `60 passed, 1 skipped, 2 deselected`였다. SKIP은 브라우저 PASS로 간주하지 않는다.
- 네 phase API 응답은 `29|23|28|15`, request origin은 `44|35|44|25`, Network↔DB/API/AUD 결박은 `6|3|6|0`이다. 저장된 API 응답 전체 URL·origin 95개가 모두 `https://anvil-f18-qa.local:8444`이고 userinfo/fragment/비허용 query 위반 0, 정적/OIDC를 포함한 저장 request origin은 모두 같은 허용 origin이다. 각 phase의 pair·서울 1/7/30 달력일 UTC 경계·observedAt·Critical count와 Network SHA 및 두 감사 원장 digest가 결박된다. 다른 사용자 신원은 같은 issuer/key/URL에서 교체했고 화면은 선택 가능한 조합 없음·차단 상태였다.
- 로컬 `docs/evidence/u01-task4-two-pair-r7/`의 PNG4·Network JSON4·DB/API/AUD JSON4, 총 12개 SHA-256을 WSL 원본과 모두 일치시켜 보존했다. 4개 화면을 육안 확인했다. granted/revoked/restored의 조합 카드와 other의 권한 차단은 보여주지만, `UNAVAILABLE` 운영 카드가 실제 운영 값을 증명하지는 않는다. 증거 JSON의 민감 표식은 0이었다.
- 읽기 전용 독립 Tester는 exact SHA·12개 자료의 Network/API URL·origin·query·digest·timezone·화면 폭을 재검사했다. 새 Critical 코드 결함은 0으로 보고했다. R6 Important였던 **API 응답 full URL/origin 부재는 이 네 phase 절편에서 해소**됐다. 다만 정적·OIDC 요청은 민감 query 보존을 피하려고 origin만 저장하므로, 사후 증거 12개만으로 Network 전체 URL을 전수 재감사할 수 없다. 런타임의 fail-closed URL 검사 통과와 전체 E-NET ID 수락은 구별한다. 원시 HTTP body/감사 row, 날짜 특수 경계도 별도 미검증이다.

## 자원 정리·잔여 조건

증거 복사·해시 확인 후 전용 root `/home/daon/anvil-u01-two-pair-qa-r7-{checkout,material,browser}` 각각 owner `daon`·0700·realpath 일치, Git checkout clean SHA, 다섯 컨테이너의 정확 ID/name/`com.anvil.qa-run=anvil-u01-two-pair-qa-r7` label, network ID/label/연결5, 세 이미지 revision SHA를 확인했다. browser venv의 외부 Python 링크는 정확 `/usr/bin/python3.12`를 가리키는 `venv/bin/python*`이고 나머지 링크는 전용 root 내부임을 확인했다. browser→Web/API/issuer→PG 다섯 container, 전용 network, 이번 SHA의 image tag 세 개, 위 세 root만 제거했다. 전용 label container/network·image tag·root·loopback 5546/8444 잔여0, 공유 `anvil-web`은 healthy running이다. 임시 DB/Secret/profile은 전용 root·tmpfs와 함께 폐기했고 cache 이미지는 보존했다.

정리 전 Docker ID: browser `c1d54e11efc7ffc850730a5c4573bb0a2e89ef452aecf6091381f8d7a05df147`, Web `46f06c5e1ef5a0f43a2d941d0542b5f596267280476ac61e360828b3b288e0e1`, API `2cde989efbf31d9dede97ee520e62071170832835767b6732a8ba29abc15aa87`, issuer `53401a14052beae87953462b09529d9bf1adcd3ce000a133af2736552bf8fa90`, PG `bcb2cb907fb9107e4910baab63b718459d38ef1a12d3a99f531420acc1b9e82c`, network `23aedfd0a63098d1144f96937fc23c92e84e99cd66e8359247f6e15f604d6635`. 정리 명령 exit0, `R7_CLEANUP_RESIDUE_0`.

## 남은 작업

기존 Foundation R6 `STORED_ROW` 회귀와 epoch106 G-05 successor는 별개로 OPEN/RED이고, 전체 E-NET/E-API/E-AUD 및 U-01의 다른 필수 ID도 미수락이다. 이 자료만으로 PR/main 병합·branch 삭제·새 branch/U-02를 진행하지 않는다. 현재 허용된 두 하네스 파일 lease를 정상 종료하고, 별도 비제품 통제 lease에서 G-05 fail-closed route를 RED→GREEN으로 고친 뒤 Foundation R6를 정확한 별도 lease로 재현한다. Rollback은 이번 R7 하네스 변경과 보고·증거의 정확 commit을 정상 revert하는 방법이며 공유 서비스·운영 데이터 변경은 없었다.
