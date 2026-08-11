# Provider Health · Alert Center

Health는 `HEALTHY|LATE|EXPIRED|UNKNOWN`과 stale 기준을 구분한다. stale signal을 healthy로 표시하지 않는다. Alert의 `open|acknowledged|resolved`는 dedupe key로 묶이며 acknowledge는 resolve가 아니다. resolve에는 검증 evidence가 필요하다. provider drift는 보이고 unsafe route는 차단한다.
