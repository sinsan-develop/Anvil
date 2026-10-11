# U-01 Task4 R6 PAIR-only body 진단 결과

## 판정

`INCOMPLETE` — C9 하네스 오류로 A의 제품/pair 경로가 실행되지 않았고 B는 `NOT_EXECUTED`다. PAIR-only 본문 소비의 인과는 `UNDETERMINED`다. 전체 기본 R6는 `FAIL`, U-01은 `NOT_ACCEPTED`, Release는 `DEFER`, Production은 `NOT_EXECUTED`다. 이 결과는 `DC-U01-019`를 닫지 않는다.

## 기준과 실제 증거

- Work Package `U-01` Task4 R6. 부모 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001` SHA-256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`, WI `U-01_TASK4_R6_PAIR_ONLY_BODY_CAUSAL_PROBE_WORK_INSTRUCTION.md` SHA-256 `C49C567A930620B3FCD7600AD9A7B2600D4ABAA76CC787ED644026DAD515B95E`.
- 기존 단일 브랜치 `codex/u01-dashboard-r2`, A9 `25bc45c218223179ea3d6b6bc8d520d0d86ec434` → 코드 C9 `367222b5f11fc1643b823d326f568dc321cfe9e9` → 실측 B9 `6e2ca7d6eec51e204c4531bd9f1d0e37022dba2a` → 임대 회수 H9 `495bafe5f36f6696fb984a99364730279c7c270a` 직접 부모 계보다. 각 게시 SHA의 실제 G-05는 seq2382/2382/2384 PASS였으며 이는 통제 무결성만 증명한다. H9 local/private SHA 동일·tracked clean을 확인했다.
- C9 local Node 구문/self-test exit0, 통합 집중12 PASS, 통제 집중6 PASS, 독립 재검토 Critical0/Important0/Minor0, diff check0이었다. WSL-server A Git exact C9 SHA G-05 seq2382 PASS, venv `pip check` exit0, Node24 Web build20 exit0이었다. 이 증거를 브라우저 R6 PASS로 승격하지 않는다.
- 등록된 WSL-server A의 일회성 PG15·비관리자 DB/role·migration0019·합성 Secret·HTTPS/Chromium에서 실제 `test_opt_in_r6_oidc_browser_pg15`를 실행했으나 exit1, `1 failed/1 warning`, `R6_BROWSER_FAILED stage=PAGE_CREATE class=Error`였다. 제품/pair 요청 전 실패다. Playwright 1.62.1 최소 재현은 C9 browser harness의 `page.addInitScript(pairOnlyBodyBootstrap, mode, 2000)`가 함수 뒤 두 인자를 주어 단일 인자 계약을 위반함을 확인했다. B 격리 실행은 생성·실행하지 않았다.
- A setup의 첫 OpenSSL 옵션 순서 오류 exit1은 빈 전용 파일 확인 후 보정했다. 첫 `alembic upgrade head`는 전용 빈 DB를 0020으로 올렸으나 신규 4표 0행을 확인하고 0019로 downgrade해 R6 guard 전에 `0019_oidc_sessions`를 확인했다. Browser image의 Playwright Node package 부재는 일회성 Node container로 checkout 내부에 `playwright@1.62.1`을 설치해 해소했다. 초기 checkout 정리 exit1은 Node container의 root 소유 `node_modules`/`dist` 때문으로 분리했다. exact 경로·소유자·realpath·비link를 재확인해 그 일회성 checkout만 `sudo -n`으로 제거했다. 비밀값·DSN 원문은 기록하지 않았다.
- A 전용 PG ID `82c6c072e4af9416c7d22138875c1f7e9459a39402cdafe219373f6aef8f0143`는 exact image/scope/SHA label/tmpfs/mount0/loopback5545 확인 후 중지·AutoRemove했다. 최소 재현에서 남은 전용 browser ID `0e20eeab9b431998bd3e2aee6dc75a1453713f5f2990ce349b57e717761ca6fe`도 신원 확인 후 중지·AutoRemove했다. 등록된 A checkout/venv/secret/pytest 네 경로·컨테이너·port5545의 독립 잔여0을 확인했다. 삭제한 것은 사설 Git C9에서 재생성 가능한 일회성 QA 산출물·합성 Secret·tmpfs DB이며 공유 서비스·제품·ysna/Production 변경은 없다.
- H9 Event seq2383 write → seq2384 worker 순서로 epoch119를 회수했고 active dual lease/agent는 null, 제품 write scope는 0이다. H9 게시본 `python -B scripts/check_project_progress.py`는 exit0 `G-05 project progress contract: PASS sequence=2384 reporting=AUTO_CONTINUE`다.

## 미검증·영향·다음 조치

A/B 동등성 및 pair-only 인과는 미검증이다. 과거 C8 broad drain OFF `FAIL`/ON 계획 `SKIP`은 C9 결과를 대신하지 않으며 제품 결함 또는 R6 PASS를 증명하지 않는다. E-NET/E-API/E-AUD/E-SHOT와 AV-SAFE-034/AV-OPS-027/AV-UI-017도 미충족이다. 기존 커밋을 수정·force push하지 않고 별도 최소 비제품 WI/새 dual lease에서 Playwright `addInitScript` 함수+단일 객체 인자 계약을 RED→GREEN TDD로 보정한다. 독립 리뷰·local/private exact SHA G-05 후에만 새 빈 WSL-server A/B 격리 QA를 재실행하고 각각 정확 정리한다. 404 허용, timeout 연장, body/Secret/off-origin 감사 생략, F-19A 임의 활성화, 제품 fetch 변경은 하지 않는다. 롤백은 이번 신규 비제품 커밋의 정상 `git revert`와 사설 원격 복구 ref 보존으로 한다.
