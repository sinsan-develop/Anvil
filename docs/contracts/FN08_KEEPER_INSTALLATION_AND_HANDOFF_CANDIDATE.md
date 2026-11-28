# IX02 전용 keeper 설치 근거와 동일 START 객체 인계 설계안

기준 커밋 `5c4fc053f660e759b0f6ab99b6bdf55acafab05a`. READ/CONTEXT_REVIEW, writer NONE의 정상 START 준비에서 확정 큐 결과를 원 객체에 한 번 인계하는 범위다. 11/28에 채택된 전용 Windows 주체와 기존 등록 signer의 분리를 구체화한 후보다. 설치 발행·등록·담당자·위치는 현재 확인되지 않았다. 격리 시험은 조건부 승인으로 기록돼 있으며 이번 설계의 작성만으로 실행 조건이 충족되지는 않는다. [작업현황](../WORK_STATUS.md), [작업 검수](../WORK_CHECK.md), [IX02 QA 인수 준비](../work_packages/IX02_QA_ACCEPTANCE_PREPARATION.md)

## 1. 발행과 등록

| 원천과 담당 | 공급할 자료와 현재 경계 |
| --- | --- |
| 기존 보호 배포 빌더 | 고정 빌드 계약으로 만든 keeper 산출물의 역할, 소스/빌드·패키지 명세 전체 참조, 바이너리 SHA-256과 상대 엔트리를 제공한다. 현재 `native-worker-deployment-publisher.cjs`의 publication은 준비 대상 worker 이미지 결박이다. 해당 publication을 유지하면서 별도 keeper의 기대 산출물과 목적을 식별해야 한다. 빌드는 로컬 설치 상태나 OS 주체를 관측할 수 없다. |
| 격리 시험의 설치 담당자 | 신산님이 지정한 담당자가 동일 패키지에서 실제 설치한 keeper 바이트와 파일·뿌리 신원, 양쪽 토큰의 서로 다른 정규 SID, 양쪽 주체만 사용하도록 보호된 endpoint 정책을 검산한다. 해당 한 등록·보호 뿌리·epoch에 결박해 보호 영역에 설치 근거를 정착하고 정확히 다시 읽는다. 실제 설치 권한·담당자와 신뢰된 발행·정착 경로는 확인 대기다. |
| 기존 등록 실행기와 전용 keeper | 각자 로컬 토큰과 보유한 원 endpoint를 사용해 설치 근거와 현재 상대를 독립 대조한다. signer는 기존 등록 키로 목적에 맞는 결과만 서명한다. keeper는 원 이미지와 process/thread/Job 수명을 소유한다. 서버에 등록 키 원문, OS 핸들, 로컬 비밀 또는 절대 경로를 전달할 필요가 없다. |
| 서버 | 기존 등록·credential·제어·정책과 원 admission/claim을 검산하고 서명 및 독립 보호 증거를 대조한다. 로컬 설치 근거의 발행자로 동작하는 경로는 설계하지 않는다. |

**권장 위치**는 Windows `FOLDERID_ProgramData`에서 확인한 고정 경로 `Anvil/KeeperInstall/v1/{installationId}/{registrationId}/{epoch}/installation.json`이다. per-user signer trust root는 기존 본 SID와 SYSTEM의 exact ACL을 적용하며 keeper SID에 개방하지 않는다. 후보 machine 슬롯은 승인된 설치 보호 주체인 SYSTEM 소유로 고정한다. 쓰기·교체·삭제·권한 수정은 이 주체의 승인된 설치 경로에 한정한다. 두 별도 SID에는 각각 자기 등록의 부모 경로 통과와 정확 파일 읽기만 부여한다. 경로 열람, 상속 등이 해당 범위를 넘기지 않는지 설치 preflight에서 확인한다. 비인가 일반 사용자, 다른 등록의 reader와 기존 signer/keeper에게 쓰기·삭제·소유권/권한 수정 경로를 열지 않는다. 이 소유자/ACL은 후보이며 실제 설치안에서 승인·관측해야 한다.

양쪽 reader는 최초 OS Known Folder와 신뢰한 설치 provenance로부터 정규화된 설치/등록 ID·epoch만으로 고정 경로를 구성한다. 승인된 machine 하위 뿌리부터 각 구성 요소를 보유 핸들로 열어 재분석·링크·다른 volume/파일 ID·변경 가능한 부모·예상과 다른 소유자/ACL을 거절한다. 읽은 동일 파일 핸들의 원 바이트와 identity를 재대조하고, 현재 등록/epoch와 보호 설치 원천이 지정한 레코드 전체 참조를 비교한다. 기대 파일/부모 identity 및 현재 epoch는 같은 파일의 자기 선언만으로 얻지 않는다. 유실·부분 저장·권한 검사 불명·구형 pin 재제출로는 설치를 인정할 수 없다. per-user 키 저장소와 spool에는 복제하지 않는다.

**설치 레코드의 후보 형상**은 목적/버전, 설치·등록/connector의 전체 참조와 epoch, 보호 뿌리·설치 대상 파일 신원, keeper 패키지/빌드 전체 참조와 artifact SHA-256, 서로 다른 signer/keeper SID의 기대 결박, 보호 출처와 endpoint 정책 참조다. 기존 canonical JSON과 전체 참조 규칙을 따른다. 승인된 설치 발행자의 목적별 서명은 이 정확 canonical 본문에 결박한다. 검증 pin은 기존 보호 릴리스 계약을 통해 독립 고정한 발행자 공개 검증 자료와 허용 목적/릴리스에서 가져온다. 패키지 서명은 artifact의 출처를 직접 증명하며, 로컬 설치 사실에 대한 서명까지 포괄하는지 별도 확인해야 한다. 현재 이 목적으로 확인된 issuer·pin은 없다. 기존 발행자에 해당 서명 목적을 부여할 수 없다면 결정할 차이는 승인된 발행자/검증 pin·유효/철회 출처를 보호 릴리스 설정에 고정하는 한 단위와 위 machine 슬롯의 설치 권한이다. 레코드가 제공한 자기 해시나 임의 사용자 설정, OS 전체 신뢰 목록으로 이를 대체할 수 없다. 재시작 내구성도 설치 원천에서 검증한다. 빌드는 독립적으로 확보한 package/artifact 해시를 기록하며, 완성 signer 자기 파일 해시는 런타임의 별도 원 관측으로 검산해 자기 참조를 피한다.

**실행마다 대조하는 값**은 양쪽의 실제 SID·보유 실행 이미지 해시·생성 시각과 인증된 원 채널 인스턴스, 원 local session/window·등록 epoch·request/claim·nonce, 원 객체 ID/세대 및 최초/후속 관측이다. PID와 session UUID는 식별 보조값이다. 보호 채널의 실제 원 endpoint와 retained handle에서 나온 신원 결박이 있어야 한다. `NormalStartPreparationCustodySource.InstalledPeer`가 요구하는 현재 `Peer` 값은 이 과정에서 조립한다. 재시작 전의 birth·채널 UUID·객체 관측을 정적 pin으로 이월하지 않는다.

## 2. EOF 이후에 이어지는 원 객체

1. 처음부터 동일 정책·등록·credential이 유효한 격리 READ 프로젝트에서 원 HUMAN/제어·예산·정책·WAITING 및 준비 전체 참조를 대조한다. 원 명령 ID·canonical 요청 해시, 실행 ID/세대와 등록을 결박한다. `0105`의 admission 확정 COMMIT과 원 연결 반환 후 기존 exact FRAME/dispatch의 claim을 별도 거래에서 단회 정착한다. 확정 FIRST만 원 등록 receiver에 한 번 전달한다.
2. keeper가 보호 설치 provenance와 원 이미지 출처를 먼저 대조한다. 같은 claim으로 한 번 `CREATE_SUSPENDED` 하고 원 process/thread/Job handles를 유지한다. 객체 token은 해당 keeper와 동일 원 채널 안의 불투명한 원 소유 표식이다. 서버 비교용 전체 참조는 token 자체나 OS 핸들이 아니다. 같은 request/attempt/claim·등록/epoch·실행/세대와 결박된 현재 관측만 사용한다. 보호된 최초/후속 관측 및 저장 뒤 원 대조를 통해 발행 근거를 얻는다.
3. HTTP FRAME의 EOF는 서버 송신 종료다. 기존 STREAM token은 `finish/end`에서 폐기되므로 재사용하지 않는다. 사설 keeper 채널은 독립 수명이며 같은 FRAME 터미널과 결박된 원 보유자 호출선으로 남아 있어야 한다. 그 채널 자체가 EOF·취소·만료되면 기존 `RunInstalled`의 `finally → FinishOwner → CloseOriginal`과 signer 측 `Caller.Dispose`가 미인계 원 객체를 회수하는 경계를 보존한다. HTTP EOF를 사설 채널 종료로 전달하거나 사설 채널 종료의 회수를 늦추면 이 방식은 성립하지 않는다. `waitNormalStartPreparationResult`의 request/claim/peerReceipt/resultRecord 참조만으로 원 보유자 호출선을 만들 수 없다. 한 번 수거한 확정 결과를 같은 keeper에 결박해 재관측·정확 인계·원 회수를 구별하는 목적 한정 내부 호출을 사용한다. 이 연결 없이는 현재 `unavailable()`을 유지한다. 기존 non-FRAME port의 `create`로 같은 객체를 다시 생성하는 흐름은 부적격이다.
4. 새 큐 거래에서 이전 admission/claim 거래와 다른 xid를 확인하고 같은 request/claim/result·등록/credential·제어·정책·원 준비 입력과 아직 유효한 보유자를 재검산한다. 보호 DB 재검산은 그 거래의 연결과 기존 잠금 순서 안에서 수행한다. 큐 잠금을 보유한 상태에서 keeper 호출이 별도 DB 거래로 current 검산·소진·등록 잠금을 다시 얻는 흐름은 순환 대기를 일으킬 수 있어 제외한다. 로컬 관측은 그 거래의 exact 범위를 전달해 최초, 저장 직전, INSERT 뒤에 각각 받는다. 응답 시각은 각 호출 직전 샘플한 DB 시각보다 앞설 수 없으며 같은 ms는 허용한다. 각 관측 최대 2초, 전체 원 10초와 더 짧은 모든 기존 기한을 적용한다. 늦은 응답은 무효이고 기존 시도에 새 시간창을 만들지 않는다. 기한 내 확정되기 전에는 과거 관측이나 저장된 PREPARED를 현재 큐 권한으로 사용할 수 없다.
5. exact 큐 COMMIT과 연결 반환이 확인된 뒤에만 아래의 두 단계 인계를 한 번 시작한다. 사설 인계 확인 후보는 같은 등록/원 양쪽 peer, request·claim·result·object 전체 참조, 저장 commandRef·grantRef·envelopeHash, 원 시도·nonce와 원 기한에 결박된 단회 서명 ACK다. 기존 PREPARED POST의 저장 ACK, 사설 인계 확인, 별도 실행 permit은 세 개의 독립 증거다. 이번 성공 경계는 인계까지다.

### 두 단계 단회 인계와 회수

1. **취득 준비.** keeper가 기존 원 process/thread/Job을 유지한 채 단회 인계 slot을 연다. 받은 쪽은 같은 원 객체에 대한 사설 보유분과 자기 peer/원 생존을 대조하고 해당 시도에 봉인된 취득 확인을 보낸다. 이 단계에서 수신 측은 resume·terminate·실행·재인계 권한을 얻지 않는다. 후보 핸들이 그 효과를 직접 허용한다면 이 단계에 전달할 수 없다. 취득 확인과 실제 권한의 전환은 별도로 검증해야 한다.
2. **이전 확정.** keeper의 원 보호 경로에서 같은 원 slot과 취득 확인을 유일하게 검산해 단일 CAS로 `STAGED → TRANSFERRED`를 정착한다. 선형화 지점은 이 보호 상태의 **확정 기록**이다. 동일 claim 및 동일 grant의 두 번째 전이는 허용되지 않는다. 호출이 불명이면 수신 측도 현재 확정 전이를 독립 검산할 때까지 소유 효과를 수행할 수 없다. 확정 후 기존 등록 signer가 목적에 한정해 동일 슬롯의 ACK를 한 번 발행한다. ACK 응답의 성공·유실은 CAS의 결과를 바꾸지 않는다.

| 원 보호 상태 | 소유와 정상 처리 | 취소·EOF·만료·재시작이나 응답/저장 불명 |
| --- | --- | --- |
| `HELD` | keeper만 원 객체와 회수를 소유한다. 큐 COMMIT 또는 연결 반환 미확정에서는 수신 측에 준비·전이 효과가 없다. | keeper가 같은 원을 아직 보유하고 인계가 시작되지 않았음을 확정한 경우 기존 finally/자기 만료가 한 번 회수한다. 재시작으로 채널/핸들을 잃으면 이후 객체 종료 관측은 불명으로 보존한다. |
| `STAGED` | keeper가 소유자다. 수신자는 봉인된 대기 원 보유분만 갖는다. CAS가 수행되지 않았음이 보호 기록과 같은 live slot에서 확인되면 keeper만 취소·원 회수를 할 수 있고 수신자는 자기 대기 보유분만 무효화·닫는다. | 취소·채널 EOF·원 만료 시에도 CAS 미수행이 확정된 경우에만 위 회수를 한다. CAS 요청, 정착, 응답 중 하나라도 불명이면 즉시 아래 불명 규칙으로 전환한다. 원 기한을 새로 열지 않는다. |
| `TRANSFERRED` | 수신 측이 자기 exact 전이를 재검산한 뒤 원 객체 회수 책임을 가진다. keeper는 객체를 종료하지 않고 이전 보유분만 닫는다. keeper의 마지막 핸들 close가 원 Job을 종료하거나 수신 측 보유를 무효화하지 않음까지 증명돼야 한다. ACK 자체로 resume/실행을 시작하지 않는다. | ACK 유실·늦은 ACK·중복 요청은 과거 exact 정착 기록 확인까지만 가능하다. 수신 측의 후속 회수는 그 보유자만 수행한다. 재시작 뒤의 원 핸들/종료 확인이 빠지면 경과는 불명이며 이전 사실을 새 live 소유로 복원하지 않는다. |
| `UNKNOWN` | 관측 상태다. 확정 원 기록을 덮거나 다른 쪽에 소유를 부여하지 않는다. 같은 slot의 독립 판독과 살아 있는 원 peer/handles가 일치할 때만 기존 확정 상태에 맞는 조치를 한다. | 두 번째 인계·발급, 양쪽 경쟁 종료/close, 추정 cleanup, PID로 원 객체 재열기 모두 금지한다. 이 때문에 기존 사설 채널의 finally를 단순히 비활성화할 수 없다. 상태 판정 없이 실행되는 원 cleanup과 부분 전이가 겹치지 않도록 구현·검증해야 하며, 이 보증이 없으면 인계 준비를 열지 않는다. |

현재 자기 만료는 로컬 owner가 살아 있고 원 회수 권위를 판정할 수 있는 경계에서만 근거가 된다. abrupt 종료나 마지막 Job handle 소실에서 OS가 어떤 효과를 냈는지는 별도 관측으로 남긴다. 양쪽 프로세스 손실 후 재현 가능한 보호 CAS 판독과 전이 동안 안전한 process/thread/Job handle 전달·보유·회수 조합은 아직 공급되지 않았다. 기존 원장에서 이 재시작·불명 조건을 증명하지 못하면 새 내구성 primitive 또는 특권 handle 전달을 임의로 채택하지 않는다. 최소 결정 차이는 **어떤 보호 주체가 단회 소유권 기록과 final close 경계를 보장할지**, 이를 위해 기존 허용 권한을 벗어나는 내부 primitive나 핸들 효과가 무엇인지다. 이 조건이 닫히기 전에는 기존 회수 동작과 양성 인계 차단을 유지한다.

[PRESPAWN 채택 원문 §8.3–8.6](FN08_NORMAL_START_PRESPAWN_CURRENT_CANDIDATE.md)

## 3. 양성 결과와 불명 보존

- **서명 및 정착 전**에 `objectRef`는 원 keeper의 보유 및 원 관측, `sourceRef`는 같은 요청·현재 정책/등록 아래 독립 보호 읽기 근거, `writerNoneRef`는 현재 writer 없음의 독립 검산, `osFenceRef`는 해당 원 process/thread/Job의 미재개·원 OS 소유권 보호 근거에서 각각 확인한다. 정적 설치 pin의 효력은 설치 provenance까지다. `VERIFIED_CURRENT`, writer NONE, 실행 시점 OS 관측은 각 독립 원천에서 검산한다. signer는 같은 nonce와 원 시도/기한에서 이를 검산한다. 서버의 기존 인증 결과 수신과 같은 보호 저장 거래에서 각 참조의 원천·해시·현재성·서명을 대조한다. 저장/원 대조, COMMIT 및 반환을 확인한 첫 결과만 내부 수거에 통지한다. 독립 공급 부재, 거부·회수, 교차 세대, 부분 저장, 불명 또는 관측이 만료된 경우에는 양성을 발급하지 않는다.
- **큐에서** 위 근거의 현재성을 다시 검증한다. `0105`의 현재 큐 판독은 보호 admission/claim과 live STREAM provenance까지이며, FRAME 뒤 실제 보유자 또는 exact 양성 정착에 대한 새 거래 검산은 공급하지 않는다. `0106`은 wire 형상에서 양성을 읽되 보관 RPC가 `REJECTED`만 허용한다. 승인된 형상과 기존 수신 경계를 재사용하면서 독립 확인과 양성 불변 저장을 실제 보호 측에서 완성해야 한다. 과거 자료 읽기는 그 자료의 귀속을 확인하는 동작으로 유지한다.
- **실패 시** 확정 큐 본문 실패와 불명 COMMIT/반환을 나눈다. 인계 전 exact 원 소유가 확인된 경우 원 keeper의 기존 회수/자기 만료를 따른다. 종료 불명은 같은 claim/원 증거에 보존한다. 정착·소유권 이전이 불명인 경우에는 새 claim, 재생성, 재서명/재전송, 재인계 또는 자동 삭제를 하지 않는다. 재시작 뒤에는 기존 보호 원장의 exact 기록을 확인할 수 있다. 원 채널과 보유 핸들을 잃었으면 PID 재개방으로 객체를 복구할 수 없다. 확정 인계 뒤 지연·중복 확인은 기존 증거만 표시한다.

## 4. 두 방법과 권장안

| 방법 | 실제 차이 |
| --- | --- |
| **A. 기존 등록 signer를 이어 쓰는 전용 로컬 keeper** | 격리 설치 담당자가 제공한 전용 주체/이미지/엔드포인트를 기존 실행기가 대조한다. 설치 측이 고정한 로컬 채널에서 keeper가 원 객체를 보유하고, 기존 등록 signer와 서버가 목적별 발급·정착을 맡는다. 보호 설치 근거의 독립 발행과 EOF 뒤 사설 caller가 필요하다. 기존 등록 credential, 공개 FRAME/POST 및 서버 역할 경계를 이용할 수 있다. **권장한다.** |
| **B. 전용 keeper가 자체적으로 서버의 보호 진입점에 접속** | keeper가 결과 및 인계 증거를 직접 전달한다. 이 방식은 새 서버 인증 주체와 자격 수명·철회, 원 등록 signer와의 위임·인계 결박 및 별도 외부 접점을 정의해야 한다. 현재 승인된 등록/서명 단일 경계보다 영향이 크며 제품 구현 후보로 채택된 근거가 없다. |

새로 정할 것은 A의 **실제 설치 근거 발행자와 설치 방식**, 승인된 로컬 채널의 보호와 재시작 판독에 필요한 정확한 책임 및 효과, 그리고 사설 인계 ACK의 발행자·정확 서명 대상·소유 종료 확인이다. 폐쇄형 ACK에 기존 등록 서명 경계를 재사용할 수 있는지는 현재 서명 목적과 허용 caller를 먼저 대조한다. 다른 목적의 기존 ACK나 신규 키를 임의로 끌어오지 않는다. 현재 정책/등록에서 독립 source/writer/OS 검산 경로가 도달 가능한지 실제 공급으로 확인해야 하며, 과거 정책 자동 승계나 ACL 완화는 이 안에 없다.

## 5. 구현과 1회 시험 경계

| 순서 | 계약과 제품 접점 | 구분에 필요한 검증 |
| --- | --- | --- |
| 1. 보호 설치와 진입 | `apps/desktop/scripts/{desktop-trust-key-host-build,verify-desktop-trust-key-host,native-worker-deployment-publisher}.cjs`, `apps/connector/native/{DesktopTrustKeyParentBasisSource,DesktopTrustKeyHostSource,NormalStartPreparationCustodySource,NativeWorkerInstallationStoreSource}.cs`. 전용 endpoint와 독립 설치 reader/issuer는 구체 공급이 추가로 필요하다. | 정착 없는 pin, 동일 SID, 다른 이미지·등록/epoch, endpoint 교체, 자기 해시 순환, 부분 기록은 효과 전 거절한다. 기존 worker 설치와 legacy 동작은 회귀 검증한다. |
| 2. 양성 결과 | `contracts/runtime/normal-start-preparation-v1.ts`의 채택 형상, `normal-start-preparation-result-store.ts`, `native-first-receive-service.ts`, 원 0106을 보존한 후속 보호 저장 구현 후보. source/writer/OS 원천의 실제 소비를 먼저 닫는다. | 부정 결과의 기존 ACK 유지, 동일 EOF/거래 반환을 거친 확정 첫 결과에만 수거, 재조회/유실/교차/만료의 양성 승격 0. 기존 ACL이나 역할을 확대해야 할 경우 그 차이만 별도 판단한다. |
| 3. 큐와 인계 | `normal-start-preparation-admission.ts`, `normal-start-preparation.ts`, `normal-initial-execution.ts`, `modules/projects/routes.ts`/서버 기본 조립, keeper 원 owner의 사설 재관측·인계 caller. `0105`는 원 admission/claim 검산에 남긴다. | 같은 객체·세 번의 독립 관측·다른 xid, EOF 폐기된 token/두 번째 CREATE 금지, COMMIT/반환 이후 인계 한 번, 유실·취소·재시작·시간 경계에서 단회/회수/UNKNOWN 검증. 합성 증거는 Windows 소유권 실효와 구별한다. |

실제 1회 시험은 담당자와 보호 설치 근거를 확정하고, 해당 구현의 전체 Git SHA·패키지/의존성·적용 SQL 지문, 원 QA 등록·계정·격리 자원·기한, 정확 UI 동작/실행 명령과 인자 및 수거 위치까지 고정한 뒤 기존 조건부 승인에 같은 실행안을 연결한다. 초기 상태는 동일 head/등록의 READ·writer NONE과 이전 시도 부재다. 설치 provenance, 원 객체/peer·요청/claim/result 전체 참조, 다른 거래 ID, 세 번의 관측 시각, 정확 COMMIT/연결 회수·인계/원 소유 종료 증거만 결박해 수거한다. 기존 QA A 함수 시험 argv는 이 시험의 실행 명령으로 사용하지 않는다.

시험 실패·응답 유실·소유 불명은 원 증거를 보존한다. 종료와 소유·정리 허용 여부를 확인한 새 격리 자원만 고정안에 따라 정리하고 전후를 대조한다. 기존 DB·권한·키·서비스나 Agent 실행으로 시험 범위를 확대하지 않는다. 현재 기록은 시험 0회·승인 미소진이다.
