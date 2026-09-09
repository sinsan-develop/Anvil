# C-21 Workbench UI WSL authenticated browser runtime retry R8 validation

- seq663~668 append-only; seq1~662 byte-preserved
- separated stdout/stderr/exit, strict browser JSON, secret scan0, safe receipt/canonical/raw hashes/false predicates only
- TDD RED는 신규 R8 metadata/observation validator 부재로 `3 failed, 265 deselected`, exit1; GREEN은 `3 passed, 265 deselected`, exit0이다.
- builder 추가 후 focused는 `4 passed, 265 deselected`, exit0이다.
- actual: deploy1 exit0, verify1 exit0, PG15 controller entry1/observation unavailable, PG18RC0, cleanup1 exit0, retry0.
- PG15의 native exit·parsed receipt·false predicate는 controller exception 때문에 미보존이다. 이를 PASS나 제품 실패로 승격하지 않고 evidence-insufficient failure로 fail closed한다.
- post-cleanup app/env/control clean, exact runtime residue0. current receipt4와 image metadata2는 hash로만 결박한다.
- generated5 materialize5, 두 번 생성 byte equality/materialized equality PASS, seq662+668 focused `8 passed, 261 deselected`, live checker `PASS sequence=668 reporting=AUTO_CONTINUE`, exact12/cumulative267와 `git diff --check` PASS다.
- commit 전·후 parent/direct-child/clean 및 동일 focused/checker를 다시 확인한다. push는 미실행이다.
