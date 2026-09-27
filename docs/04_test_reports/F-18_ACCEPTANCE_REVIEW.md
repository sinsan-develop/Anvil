# F-18 독립 acceptance review / 2026-09-27

## 판정

`ACCEPTED_F18_WSL_SCOPED_QA`.

## 기준별 근거

1. F-17 동일 commit/digest·clean checkout: R45A/R45B 공개 QA manifest와 WSL 재수신·image/source 대조가 PASS다.
2. 분리 PG18 DB/role·migration: R45A/R45B target은 head0019, R45C 보완 old/restore는 head0016이며 DB/role을 분리했다.
3. OIDC/object/network capability: R45A/R45B의 HTTPS readiness, OIDC code→session/replay 거부, object put/read/dedupe/collision/corruption 거부, internal network와 Web-only ingress가 PASS다.
4. rollback/restore: R45C 보완에서 old `WSL_ACCEPTANCE` API/Worker readiness와 별도 restore DB의 old image readiness가 HTTP 200/head0016으로 PASS다.
5. secret·권한·정리: 합성 credential만 사용했고 전용 자원 residue 0, 공유 Web/PG ID 불변이다.

## 제한

Production/ysna-server, 사용자 운영 인수, 전체 pytest, 브라우저 사용자 로그인과 human ReleaseDecision은 F-18 범위 밖 또는 후속 검증으로 `UNVERIFIED/NOT_EXECUTED`다. 이 acceptance는 F-18 WSL scoped QA에만 적용하며 F-19를 자동 합격시키지 않는다.
