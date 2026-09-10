# C-21 A13 historical module isolation invocation

`WI-C-21-A13-HISTORICAL-MODULE-ISOLATION-20260908-001`을 실행한다. historical checker import를 context-managed test isolation으로 제한하고, 성공·예외 경로 모두에서 `packages`, `packages.repository_intelligence*`, checker module과 `sys.path`를 원상 복원한다. seq1~596과 historical evidence 및 제품 코드는 수정하지 않는다. exact13/cumulative201 seq597~602 successor를 생성하고 지정 검증 후 단일 commit한다. 외부 호출·배포·push는 수행하지 않는다.
