# A-13 Read-only Repository Scan

## 목적과 경계

`packages.repository_intelligence.scan_repository()`는 승인된 루트 아래의 Git 저장소를 읽어 구조·언어·manifest·Git 상태와 `E-GIT`/`E-DIFF` 증거를 JSON-safe 결과로 반환한다. Python 표준 라이브러리만 사용하며 프로젝트 명령, hook, manifest script, 패키지 설치 및 네트워크 요청을 실행하지 않는다. A-13 검증은 G-06 불변 fixture에 한정되며 실제 사용자 저장소·브라우저·API·DB·WSL·Production·DIR은 실행하지 않았다.

## 처리 순서

1. repository, allowed root, output, temp 경로를 canonical real path와 case-normalized identity로 검증한다.
2. repository 전체를 `follow_symlinks=false`로 먼저 순회한다. symlink·junction·reparse point·special file과 한도 초과를 fail-closed로 거부한다.
3. 첫 snapshot에서 전체 path의 `path/type/size/mtime_ns/SHA-256/mode`, HEAD, branch, porcelain-v2 status, remotes, index·refs·config·lock metadata를 기록한다.
4. 파일명만으로 manifest와 언어·package manager·프로젝트 규칙·hook 존재를 분류한다. 파일 내용에 선언된 명령은 실행하지 않는다.
5. 동일 알고리즘으로 두 번째 snapshot을 얻어 canonical hash와 모든 path/Git field를 비교한다.
6. delta가 하나라도 있으면 `SCAN_MUTATION_DETECTED`, 없으면 `SCANNED_READ_ONLY`를 반환한다. output이 지정되면 repository 밖의 기존에 없는 파일에만 기록한다.

## Git read-only 계약

- 명령은 고정된 argv allowlist 8개만 `shell=false`로 실행한다.
- 모든 호출은 `git --no-optional-locks`, `GIT_OPTIONAL_LOCKS=0`, `core.fsmonitor=false`, `core.untrackedCache=false`를 적용한다.
- terminal prompt와 pager, system/global Git config를 비활성화한다.
- Git dir/common dir도 allowed root 안의 canonical path인지 검증한다.
- remote credential과 query는 결과 직렬화 전에 마스킹한다.

## 실패 모델

경로 탈출, non-Git, reparse/special file, Git timeout/unavailable/read failure, snapshot 불안정, entry/total/file 한도, 내부 output/temp, 기존 output, pre/post delta는 구조화된 `ScanError`로 반환한다. 스캐너는 감지된 mutation을 자동 복구하지 않는다.

기계 판독 계약은 `A-13_REPOSITORY_SCAN_CONTRACT.json`, hostile 경계 목록은 `tests/fixtures/a13/hostile-cases.json`이 기준이다.
