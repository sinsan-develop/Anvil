# F-18 R45C 롤백 산출물 읽기 전용 감사 / 2026-09-27

## 판정

`R21_HISTORICAL_QA_ARTIFACT_NOT_APPROVED_ROLLBACK_BASELINE`.
R21의 정확한 Git tag·checkout·세 Docker image는 WSL-server에 남아 있다. 그러나 R21은 보존된 QA 산출물이지 승인된 직전 릴리스가 아니다. R26의 일회성 서명 manifest 원본도 보존되지 않았다. R45B의 공개 서명 manifest는 Git에 있지만 그 서명이 결박한 세 Docker image ID는 WSL image store에서 제거됐다. 따라서 지금 어느 쪽도 R45B 계획의 “이전 승인 artifact와 정확한 image ID” 조건을 충족하지 않으며 실제 code/container rollback은 `NOT_EXECUTED`다.

## 실제 확인

- 시작: `codex/f18-wsl-ops@da187871091219e8aee1dd62be85399c75284905`, 지정 `development/codex/f18-wsl-ops` 동일, clean; canonical seq1678, worker/write lease=null, G-05 PASS. 승인 설계·작업계획·매트릭스·테스트계획 hash는 각각 `1DD7D91D...`, `943B4123...`, `1AFDDC9A...`, `902A6E64...`이다.
- `ssh WSL-server` 읽기 전용 검사: `/home/daon/anvil-f18-r21-artifact/repo`는 owner `daon`, detached/clean, HEAD와 annotated tag `f18-wsl-qa-4eadfcd` peeled commit이 모두 `4eadfcd441b55445237545146ae5ba4051739904`. Git remote는 지정 개발 SSH alias다. R21 전용 container는 0이다.
- R21 이미지 ID: Web `sha256:61f13f7ffa9d20713c6cc4234b4529bce2d4b0c8f1d11b73832a28c3213910bf`, API `sha256:ad6a2b73ea8c57c5eb9635c988a18ffa4870474a82471a933377d880ed8ec06b`, Worker `sha256:6a8a0e1de3346c2a348487295504c9070557650a50459805798cb6f41262d43f`; OCI revision은 각각 위 Git SHA와 일치한다.
- R21 checkout에는 현행 `deploy/wsl/compose.f18.yml`과 OIDC 파일이 없다. R22 기록의 R21 DB head는 `0016_operations_recovery`이고 R45B target의 실제 head는 `0019_oidc_sessions`이다. 현재 R45B DB를 R21 container로 바로 되돌리는 시험은 호환성/데이터 안전성 증거가 아니다.
- R26 `docs/WORK_STATUS.md`의 synthetic QA envelope hash/공개키 fingerprint는 기록이지만, 원본 파일은 당시 임시 QA 경로와 함께 제거됐다. 재서명 없이 R21 ReleaseManifest를 보유한다고 주장할 수 없다.
- R45B의 공개 signed manifest·key는 `docs/evidence/f18_r45b/`에 보존됐지만 결박된 Web/API/Worker image ID `aac0c07c...`/`1c1e5aec...`/`ba9394dd...`는 이전 정리에서 제거됐다. 동일 Git source의 재빌드도 image ID 동일성을 보장하지 않는다.
- 공유 `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738`와 `local-postgres` ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c`는 검사 시 running. 이번 감사의 신규 WSL/Windows resource 0, mutation 0, 제품 수정 0, 오류 0이다.

## 다음 내부 시험 경계

1. R21은 오직 **역사적 QA artifact**로 구분한다. 제품 code/container rollback의 승인된 이전 릴리스라고 표시하지 않는다.
2. 다음 별도 격리 QA에서는 이전/현재 각각의 exact source·image ID·서명 원본을 시험 종료까지 보존해야 한다. 생성 전 경로, Compose project, image tag, DB/role, port, 수명, 정리 방법과 공유 자원 ID를 `WORK_STATUS`에 고정한다. 로컬 기록을 Git에 push한 뒤 WSL-server가 exact commit/tag를 Git으로 받아야 한다.
3. R21→현행의 schema 차이를 다룰 경우 disposable PG18과 합성 데이터만 사용한다. 사전 `0016` snapshot을 별도 복구 DB에서 검증하고 새 artifact의 `0019` migration을 적용한 뒤, code/container 되돌림과 DB snapshot 복구를 **분리해** 관측한다. 데이터 손실 가능 migration downgrade를 자동 실행하지 않는다. OIDC 기능을 제공하지 않는 R21로 회귀했을 때의 기능 손실도 명시한다.
4. 이 시험이 통과해도 QA-only rollback rehearsal이며 실제 승인 릴리스 rollback이나 Production 신뢰 증거로 승격하지 않는다. F-18의 정확한 수용 조건과 남은 브라우저 UI 로그인·전체 suite·공급망 증거를 별도로 평가한다. F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED를 유지한다.

Rollback: 이 보고서/작업현황 기록만 정상 Git revert 가능하다. 보존 R21 image/checkout과 공유 서비스는 수정하지 않았다.

## R45C seq1680 준비·이미지 checkpoint

- 기존 단일 branch의 control 준비 `28417a864313a1bff771c9cafaf4096436cfbb24`와 canonical 투영 `ebc10eb9ce213dcc8e3ab4a909ce1ea476f4d765`를 지정 원격에 push했다. seq1679 WorkInstruction/seq1680 Main worker-only epoch36, write lease=null, 제품 write scope=[]; clean G-05 PASS, control 직접 2 PASS였다. 로컬 pytest는 `No module named pytest`로 미실행이다.
- WSL-server 생성 직전 세 전용 경로, 두 Compose project container/network/volume, R45C tag, loopback8444가 모두 부재였다. 지정 Git alias에서 old `f18-wsl-qa-4eadfcd`→`4eadfcd441b55445237545146ae5ba4051739904`, new `f18-wsl-r45a-qa`→`d36de847842804ca93e405abe9bff687c1162a69`를 각각 daon mode700 전용 경로의 clean detached checkout으로 받았다. 두 경로의 F-16 `verify_exact_checkout`이 `OLD_F16_EXACT_CHECKOUT_PASS`/`NEW_F16_EXACT_CHECKOUT_PASS`, exit0이다.
- 보존 R21 세 image를 **재빌드 없이** R45C-old tag로 alias했다. Web `sha256:61f13f7ffa9d20713c6cc4234b4529bce2d4b0c8f1d11b73832a28c3213910bf`, API `sha256:ad6a2b73ea8c57c5eb9635c988a18ffa4870474a82471a933377d880ed8ec06b`, Worker `sha256:6a8a0e1de3346c2a348487295504c9070557650a50459805798cb6f41262d43f`. 기존 R21 tag와 ID는 불변이다.
- new exact `d36de847...`의 전체 **Git 추적** archive를 각 Docker build의 stdin에 사용해 `--pull=false`, 2GiB/2CPU 제한으로 Web/API/Worker/QA issuer를 한 번씩 빌드했다(각 exit0; legacy builder deprecation warning). 새 image ID는 Web `sha256:3e2c003b1996b299af2729d48bc1fc67f8422b2bb4b5f3fa86cb30108f357e5e`, API `sha256:9b4ea2f4b1259644cf22e7c3a0388e3cde1698b6ebe5946c48bdce9a179a3bb6`, Worker `sha256:43bf8e695ebc9a606587f75e130c8954531a61241ae73257bbeede4b730e26b6`, QA issuer `sha256:e1a281161471d100475fbee6d572b68154f46e3710475ccfead5479fc2334019`. 전부 OCI revision=d36, 제품 Web UID101/API·Worker UID10001, issuer UID10001이다. 이 세 제품 ID는 R45B signed manifest가 결박한 제거된 ID와 다르므로 그 manifest를 재사용하지 않는다.
- 현재 R45C 두 checkout은 owner daon/mode700/clean exact HEAD, 전용 old3/new4 tag만 있다. 두 Compose project container0, material 경로/DB/Secret/backup/port 생성0, 공유 Web·PG ID/running 불변이다. QA-only signed manifest·실제 PG18/네트워크·롤백은 아직 `NOT_EXECUTED`. R45C 자원은 계획된 한 차례 QA 수명으로 Main `ACTIVE` 보존 중이며, 실패·중단·완료 시 exact owner/ID/label/연결자를 확인해 R45C 경로·tag만 정리한다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED.

## R45C 배포 전 manifest 불일치 음성 시험

- WSL-server의 new clean detached checkout은 `d36de847842804ca93e405abe9bff687c1162a69`이고, 지정 SSH Git 원격에서 현재 공개 branch `7921320e1cad47155988cfc5a9838e4c58f530a5`를 `FETCH_HEAD` 객체로 수신했다. 제품 checkout 파일은 바꾸지 않았다.
- Git에서 받은 R45B 공개 manifest/공개키로 Ed25519 서명·subject hash를 검증했다: `R45B_SIGNATURE_VALID_HISTORICAL_ONLY`. 이것은 R45B 당시의 서명 진위만 확인하며 지금 해당 세 image ID가 존재한다는 뜻은 아니다.
- 실제 R45C new Web/API/Worker Docker image ID를 관측해 R45B manifest의 기대 ID와 대조한 결과, verifier가 `MANIFEST_OBSERVATION_MISMATCH`로 거부했다: `R45C_NEW_IMAGE_ID_MISMATCH_REJECTED`. source commit을 의도적으로 다른 40자리 값으로 바꾼 기대값도 같은 오류로 거부했다: `WRONG_SOURCE_COMMIT_REJECTED`. 세 assertion 모두 원격 Python exit0. 이는 배포 전 불일치 거부만 증명하며 새 QA manifest/서명이나 실제 롤백 PASS가 아니다.
- 로컬 venv에는 `cryptography`와 `pytest`가 없어서 해당 라이브러리 검증을 WSL-server 설치본에서 실행했다. 새 material/DB/container/network/Secret/backup은 여전히 만들지 않았고 기존 R45C checkout 2개·image tag 7개만 `ACTIVE`다. G-05는 이 원본 갱신을 seq1680 frozen raw checksum에 재결박하기 전까지 non-green이다.

## R45C QA-only manifest 결박

- 실측 old/new image ID, source tag·commit, lockfile/requirements·Compose 설정 SHA를 각각 `old-qa-*`/`new-qa-*` 공개 원본으로 고정했다. source·Docker ID·OCI revision·공개 원본 hash를 WSL-server에서 다시 대조해 `OLD_QA_FACTS_MATCH_SOURCE_AND_DOCKER`와 `NEW_QA_FACTS_MATCH_SOURCE_AND_DOCKER`를 확인했다.
- WSL-server 메모리에서만 생성한 Ed25519 private key로 두 QA-only manifest를 서명하고 즉시 verifier로 검증했다. public fingerprint는 `sha256:8cddccfc708c2119c7c786f56855aad6b1f5a9d85450757077cfa5a113c3e2b8`; private key 저장·출력·Git 기록은 0건이다. 잘못된 image ID를 주입한 expected 값은 `MANIFEST_OBSERVATION_MISMATCH`로 거부됐다.
- 이 manifest는 `R45C_QA_ONLY` 증거다. old는 `0016_operations_recovery` 역사 QA, new는 `0019_oidc_sessions` 새 QA image에 해당하며 PG18 기동·backup/restore·code/container rollback·browser login은 아직 `NOT_EXECUTED`다. F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED를 유지한다.
