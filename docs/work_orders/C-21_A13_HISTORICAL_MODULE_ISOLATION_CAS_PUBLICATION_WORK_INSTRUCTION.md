# WI-C-21-A13-HISTORICAL-MODULE-ISOLATION-CAS-PUBLICATION-20260908-001

## 목적

Main Agent가 직접 수행한 private control CAS publication 결과를 seq603~608 successor에 append-only로 결박한다.

## 범위

exact12 경로만 변경한다. seq1~602, historical evidence, 제품 코드와 `tests/tooling/test_a13_repository_scan.py`는 변경하지 않는다.

## 완료 조건

실제 preflight/CAS/postflight receipt, candidate 불변, exact12/cumulative207, 결정적 projection, 전체 tooling, live checker, 독립 review를 통과한다. 전체 C-21 acceptance로 승격하지 않는다.
