# E-07 실행

`WI-E-07-R1-20260917-001`의 baseline, dual lease, product exact4와 control exact9를 확인하고 순차 TDD로 수행한다. canonical start PASS 및 lease 발효 뒤 제품을 수정한다. 기존 E-04 immutable TaskGraph와 execution RunStatus를 재사용해 failure policy resolver와 append-only exception inbox를 구현하고, hard-stop 우선·transitive dependency block·독립 Step 계속·전체 성공 오표시 금지를 증명한다. focused/관련 회귀/구문/diff/checker와 구조화 완료보고까지 수행하며 acceptance/Git publication/E-08/추가 agent/외부 runtime을 실행하지 않는다.
