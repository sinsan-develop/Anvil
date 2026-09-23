# 요청 tag 방식 PR Broker 설치·사용 설명서

## 1. 목적

이 Broker는 작업 branch를 수시로 push하는 개발 흐름과 PR 생성 시점을 분리한다. 작업자는 승인된 Stage의 구현과 필수 검증을 끝낸 뒤에만 요청 tag를 push한다. 요청 tag는 해당 Stage 완료 선언이며 프로젝트 전체 완료 선언이 아니다.

## 2. 구성 파일

- `.github/workflows/auto-pr-merge.yml`: GitHub Actions에서 요청을 검증하고 PR 생성·병합·확인을 수행한다.
- `.github/pr-broker-gate.sh`: 저장소별 필수 검증 명령을 정의한다. Broker는 작업 branch의 파일이 아니라 `main`의 trusted Broker revision에 있는 파일을 실행한다.

### Anvil 적용 Gate

Anvil은 요청 tag의 exact branch/SHA, 현재 `main` 기준 base와 ancestry를 공용 Broker에서 검증한 뒤 다음 저장소 Gate를 실행한다.

```bash
python -B scripts/check_project_progress.py .
git diff --check refs/remotes/origin/main...HEAD
```

이 Gate는 canonical progress checker와 변경 diff의 whitespace 오류를 검사한다. 기존 로컬·WSL·브라우저·Provider 검증 결과를 GitHub Actions에서 다시 실행하지 않으며, 요청 tag 생성자가 해당 Stage의 계획상 필수 검증을 이미 완료했다는 선언을 전제로 한다. 따라서 요청 tag는 필수 검증이 끝난 exact commit에만 생성한다.

Actions checkout은 기본적으로 `origin`만 만들기 때문에 Gate는 checker 실행 전에 exact 작업 branch를 유지하고, 로컬 runner 안에서만 canonical `development` URL·`development/main`·작업 branch 추적 ref를 구성한다. 이는 원격 fetch/push나 인증 변경이 아니라 checker가 로컬 Git 문맥을 검증할 수 있게 하는 일회 실행 준비다.

## 3. 저장소 최초 설치

1. GitHub 저장소의 `Settings → Actions → General → Workflow permissions`에서 `Read and write permissions`와 `Allow GitHub Actions to create and approve pull requests`를 켠다.
2. 최신 `main`에서 정확히 `codex/pr-broker-bootstrap` branch를 만든다.
3. 이 저장소의 `.github/workflows/auto-pr-merge.yml`을 대상 저장소의 같은 경로에 복사한다.
4. 대상 저장소용 `.github/pr-broker-gate.sh`를 작성한다.
5. 두 파일과 설명서를 bootstrap branch에 commit하고 SSH alias로 push한다.
6. exact bootstrap trigger가 설치 PR 생성·squash 병합·원격 branch 삭제·merged-main 확인을 수행한다.
7. GitHub Actions run, merged PR, `main`의 두 설치 파일을 확인한다.

bootstrap branch trigger는 정확한 branch 이름 한 개에만 반응한다. 설치가 끝나고 branch가 삭제되면 일반 작업 branch push에는 반응하지 않는다.

## 4. 일상 사용

작업 branch에서 로컬 및 WSL 필수 검증을 완료하고 안전한 commit을 원격과 일치시킨다. 그다음 아래 형식의 lightweight tag를 최신 `main` commit에 생성한다.

```text
pr-request/<작업-branch의-40자리-HEAD-SHA>/<작업-branch>
```

PowerShell 예시:

```powershell
git fetch development main
$headSha = git rev-parse HEAD
$mainSha = git rev-parse development/main
$branch = git branch --show-current
$requestTag = "pr-request/$headSha/$branch"
git tag $requestTag $mainSha
git push development "refs/tags/$requestTag"
```

Anvil의 개발용 원격은 SSH alias를 사용하는 `development`다.

```text
git@github-sinsan-develop:sinsan-develop/Anvil.git
```

GitHub Actions의 원격 통신은 checkout이 만든 `origin`을 사용한다. canonical checker용 `development` 참조는 runner 로컬에서만 구성한다. 개발자가 `gh auth`, PAT 또는 웹 계정 전환을 수행할 필요는 없다.

Broker는 다음 순서로 fail-closed 검증한다.

1. 요청 SHA가 소문자 40자리 Git SHA인지 확인
2. branch가 유효한 `codex/*` ref인지 확인
3. 요청 tag가 현재 원격 `main`의 trusted Broker commit을 가리키는지 확인
4. 요청 SHA가 원격 작업 branch의 현재 HEAD와 같은지 확인
5. 작업 SHA가 현재 `main`을 포함하는지 확인
6. exact 작업 branch 이름으로 요청 SHA를 checkout하고 `main`의 저장소별 Gate를 실행
7. Gate 이후 `main`과 작업 branch가 변하지 않았는지 재검증
8. PR 생성 또는 기존 열린 PR 재사용
9. squash 병합 및 원격 작업 branch 삭제
10. merge commit이 원격 `main`에 포함됐는지 확인
11. 성공한 요청 tag 삭제

## 5. 실패 처리

- 어느 검증이든 실패하면 PR을 생성하거나 병합하지 않는다.
- PR 생성 또는 병합 이후 검증이 실패하면 Actions 로그와 실제 PR/main 상태를 먼저 확인한다.
- 실패한 작업 branch와 요청 tag는 원인 확인 전 삭제하지 않는다.
- `gh auth`, PAT, 웹 계정 전환, SSH key 변경은 일상 실행에 필요하지 않다. Actions의 repository-scoped `github.token`만 사용한다.
- base drift가 발생하면 최신 `main`을 작업 branch에 반영하고 검증을 다시 수행한 뒤 새 SHA로 요청한다.

## 6. 제거

Broker 제거는 별도 승인된 PR로 다음 파일을 삭제하는 작업이다.

```text
.github/workflows/auto-pr-merge.yml
.github/pr-broker-gate.sh
```

제거 전에 진행 중인 PR, `pr-request/*` tag, 자동화 실행이 없는지 확인한다.
