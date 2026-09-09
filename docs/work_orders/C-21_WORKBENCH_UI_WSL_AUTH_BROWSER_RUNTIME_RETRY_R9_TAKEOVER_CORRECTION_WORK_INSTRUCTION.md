# WI-C-21-WORKBENCH-UI-WSL-AUTH-BROWSER-RUNTIME-RETRY-R9-TAKEOVER-CORRECTION-20260909-001

## 권위와 범위

- HUMAN_OVERRIDE approval `APPROVAL-20260909-C21-R9-TAKEOVER-CORRECTION-001`
- parent `5162d3581ac4c856a6a454ca4284b5191a1238b5`; private remote record `eadba5bad0df3ea4f52e28b847ab20957217b6c5`
- exact13 Windows/ordinal `0CF50BDA1B2C5E7D89C4C92DF6821EDFD4FD5488870A145733ABC9E3245CB159` / `66B0CB35CDBB0E7630E79E2330F63A073A39DD6199F8D67588C78A8BB8D6AA9D`
- cumulative280 Windows/ordinal `B40528446712F4211D3329093724E387E654BCEDE328395F3D0BF212995AEDFC` / `C8EAF5D682D267502B04ABDDF17672C9F6331396DE97C0C87F66036B9633F136`

## correction

- 기존 seq674 checker/predicate/test와 historical seq1~674/R9 unique artifact를 byte-preserve한다.
- current projection만 R7/R8/R9 exact root 각1, broad diagnostic grouping superseded로 정정한다.
- 기존 R9 nested takeover packet은 historical strict-equal 보존하지만 current top-level takeover는 없다.
- seq675~680 lease/start/revoke/completion을 append하고 revoke reason은 `CORRECTION_RESULT_HANDOFF`다.
- status `READY_R9_TAKEOVER_CORRECTION_FOR_INDEPENDENT_REVIEW`, next `INDEPENDENT_REVIEW_R9_TAKEOVER_CORRECTION_BEFORE_R10`이다.

## 금지선

- runtime/WSL/product/external 실행·변경, amend/reset/checkout/clean/stash/force push 금지
- main_direct=false, developer_runtime_resume=false, R10은 독립 검토 전 금지
