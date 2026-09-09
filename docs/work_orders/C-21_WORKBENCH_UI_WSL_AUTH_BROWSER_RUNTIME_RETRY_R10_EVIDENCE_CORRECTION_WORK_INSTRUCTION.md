# WI-C-21-WORKBENCH-UI-WSL-AUTH-BROWSER-RUNTIME-RETRY-R10-EVIDENCE-CORRECTION-20260909-001

## 범위

- parent `c8c35cf92e72ea405b1a9171983c26407175c382`; private remote record `27406570cbfbb89f19ee3a5d746687125d043d7e`.
- exact12 Windows/ordinal `57AB57A282545B4BAC8FE729A04FE315DDDC6E58C69B30086093AFC5B60AC0EB` / `384AFFDE81E005F3882CB839D0E0A0DE4AD44EB64EE21B8DAF18264B132BC8A5`.
- cumulative292 Windows/ordinal `8F4C7FE3DE09BE70264AB38C01969B8B9B58E1D8C7A8EF572205FB6547FCC9B6` / `D814CFED8C979B0D89F90DA39497675578477C2FC5062585EB21F3480BE3913E`.
- seq1~686/R10 unique artifacts/current parent bytes를 보존하고 amend/rewrite하지 않는다.

## 교정 계약

- historical R10 safe receipt와 exact false predicates는 strict-equal로 보존한다.
- historical unsupported assertions `provider_row_count=0`, `groq_detail_clicked=false`는 current effective projection에서만 각각 `UNAVAILABLE_NOT_PERSISTED`로 교정한다.
- reviewer verdict C0/I1/M0, fingerprint `R10_SAFE_RECEIPT_UNSUPPORTED_FIELD_ASSERTION_R1`, resolution `RESOLVED_CURRENT_PROJECTION`을 결박한다.
- product/runtime/policy/scope change는 false, runtime/WSL/product/external action은0이다.
- seq687~692 standard lease/start/revoke/complete, revoke reason `CORRECTION_RESULT_HANDOFF`, status `READY_R10_EVIDENCE_CORRECTION_FOR_INDEPENDENT_REVIEW`, next `INDEPENDENT_REVIEW_R10_EVIDENCE_CORRECTION_BEFORE_R11`로 종결한다.
- 기존 seq686 checker/test region은 byte-preserve하고 exact12 single direct-child commit을 만든다. push는 Main이 수행한다.
