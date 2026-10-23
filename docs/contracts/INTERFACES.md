# P02 공통 명령·관측 계약 초안

## FN06 D1 factory 원 unnamed Job 보유 SOURCE — 2026-10-23

`OwnershipEvidenceJobFactorySource.CreateEmptyJobSource`는 신규 미등록 native SOURCE다. 실제 호출 승인은 포함하지 않는다. 이름/빌린 rawhandle/외부 callback을 받지 않고 `CreateJobObjectW(NULL,NULL)`가 돌려준 private SafeHandle만 소유한다. Owner interface에는 빈 Job 조회/Dispose/local handle close 결과뿐이며 rawhandle 전달·Duplication·프로세스 생성/할당/종료·limit/ACL 변경은 없다. CloseHandle 성공만 local close 확인으로 두며 전역 Job 소멸/전임 writer 회수/새 실행 권한은 아니다. 다른 고권한 프로세스의 handle복제/변조까지 배제한 유일보유 증명으로 쓰지 않는다.

조회는 비상속/close보호 없음(flags0), 고정 accounting 구조와 반환길이·Total/Active/Terminated/CPU/fault 전부0을 검사한다. 같은 owner lock 아래 조회/Dispose를 직렬화하고 마지막 결과에도 최초 단조기한을 적용한다. 호출수용<=10초·생성시작후조회<=120초이며 동기kernel호출/lock의 강제종료나 자동자원회수는 제공하지 않는다. 향후 승인 factory가 finally Dispose해야 한다. 실패시 본인 원handle만 닫고 close불명확은 별도 UNKNOWN이다.

이 source만으로 `ProcessCreationAuthorized/PreparationAuthorized/ExecutionAuthorized/DispatchPerformed/ActualWriterAbsenceVerified`는 모두false다. current 인증준비·승인root/image·원process/thread 생성/Job귀속·actualwriter·실제Windows검증이 없으며 기존 Host/CLI/route에 등록하지 않는다. 새2 source는 기존 D2 재compile 요청4에 자동 포함하지 않는다. 미래시험SOURCE는 순수 accounting/budget 거절뿐으로 실제생성/조회/정리검증을 대신하지 않는다.

공식계약: [CreateJobObjectW](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-createjobobjectw), [Job accounting](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_accounting_information), [QueryInformationJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-queryinformationjobobject), [GetHandleInformation](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-gethandleinformation). 서명/구조 대조만 했으며 실제 OS 실행·컴파일은 미검증이다.

## FN06 D1 현재 조회 전체 async 수명·정리후 결과검사 — 2026-10-23

current resolver는 기존 caller timeout(최대10초)을 첫await 전부터 전체연결/원인증/DBquery/새관측/COMMIT에적용한다. 같은queryfacade가pending을추적하고close/abort·원함수변경/단조기한을전후검사한다. 늦은connect는BEGIN없이소유연결만폐기하고, pending query중실패는rollback을대기하지않고연결폐기모델로분리한다. rollback무응답에는별도min(caller timeout,1000ms)의유한cleanup을적용한다. 실제DB취소·강제중단/rollback완료를추정하지않는다.

current/준비 owner 둘다정리전결과확인만으로성공을반환하지않는다. release후에도caller단조기한·외부취소·원함수/설정참조와 COMMIT직전DBclock불변숫자+그측정직전단조mark로추정한최소원근거기한을다시검사한다. COMMIT시도후기한경과/현재입력불일치·release오류는UNKNOWN이며자동재시도/재발급·rollback으로미저장단정0이다. 이미반환한pool연결을다시폐기하지않고release는1회다.

이는동기callback/driver의강제종료·실제PG취소/clock동기화/COMMIT순간권위보장이아니다. eventloop/timer지연뒤늦은결과를거절하고async무응답을한정한source/합성검증이며, 정상값은여전히SYNTHETIC/BASIS_ONLY/실권한false다. 원SQL M1·미등록실제authority·native/키/Agent/운영미검증을유지한다. 테스트CURRENT fixture도실제caller read-window 내request기한을소비하며큰기한의가짜성공으로검사기준을완화하지않는다.

## FN06 D1 준비 transaction owner 의존성 고정 — 2026-10-23

SyntheticOwnershipPreparationStore.prepare는 호출 시작의 pool/connect 함수·access/authenticateInTransaction 함수·prerequisite/current 함수·options 객체/timeout값을 고정한다. 원 연결/인증 기능을 같은 결과의 함수로 바꾸더라도 대기 전후 참조가 달라지면 fail-closed이며 timer와 rollback cleanup은 캡처한 유한 timeout을 사용한다. helper는 캡처한 access와 같은 transaction facade만 소비한다. COMMIT 시도 후 교체/확인 불명확은 COMMIT_UNKNOWN·연결폐기/자동재발급0이며 rollback으로 미저장을 단정하지 않는다. 초기 공급자 부재는 connect0·권한false를 유지한다.

이 보완의 27합성/type/diff는 실제 PG COMMIT시각·SQLguard·실행권한/OS/Agent 활성화 증거가 아니다. 미적용0039 default deny/RLSfalse·SQLpendingM1은 유지한다. [PostgreSQL15 SET CONSTRAINTS](https://www.postgresql.org/docs/15/sql-set-constraints.html)는 deferred constraint trigger를 IMMEDIATE에서 조기 평가할 수 있음을 명시하므로, constraint clock 검사 하나를 실제 COMMIT 순간 보장으로 승격하지 않는다. 실제PG/시계경과·강제IMMEDIATE/경합 시험과 허용된 실제권위 활성화는 별도 미완료다.

## FN06 D1 retained root/image 직접자식 귀속 SOURCE — 2026-10-23

같은 RootSource의 `ReadRetainedImageLocationSource(root,image)`는 두 내부 보유 SafeFileHandle을 수명참조해 directory/file 구분·비reparse·전후metadata/정규 GUID path·같은 volume hint/서로다른 fileIDhint·image links1/1..20MiB·직접자식 경계를 검사하도록 작성했다. 디렉터리 case-sensitive 설정에서도 다른 경로를 같다고 수용하지 않도록 Ordinal 비교를 사용하고 sibling prefix·하위폴더·ADS를 거절한다. 공유 metadata 읽기에서 directory 기본값을 유지하고 path digest/identity hint 로직만 같은 파일 내부 재사용했다.

path/digest/전후일치는 실제 승인root/승인binary·바이트hash·원processimage/생성보유/배타적귀속 증명이 아니다. 결과는 RETAINED_ROOT_IMAGE_LOCATION_CANDIDATE_ONLY이며 승인root/binary/factory/준비/실행/전달false·해당누락/선조/로컬/쓰기삭제배제/처분/인증/actualwriter/OS강제종료 미확인을 유지한다. stream읽기/위치변경·새open·명시Close/Create/키/DB/API·등록0이며 실제PInvoke/컴파일/RunAll은 실행하지 않았다. C# 미래 반례에는 순수 직접자식 경계와 null/same/invalid/closed를 포함하지만 실제PASS로 계산하지 않는다.

## FN06 D1 retained directory root 조회 SOURCE — 2026-10-23

별도 `OwnershipEvidenceRootSource.ReadRetainedDirectorySource(SafeFileHandle)`는 향후 factory가 보유할 directory handle만 입력받고 새 경로/open/ACL/쓰기 없이 수명참조 안에서 GetFileType·GetFileInformationByHandle·GetFinalPathNameByHandleW(normalized/GUID flag1)를 전후 조회하도록 작성했다. directory/비reparse·양의시간/fileID hint·유효 GUID path·고정32768버퍼/반환길이·전후 metadata/path·참조회수 후10초 결과수용을 대조하며 rawpath/handle은 반환하지 않는다.

반환 `RETAINED_ROOT_DIRECTORY_CANDIDATE_ONLY`의 경로문자열digest/volume+64bitfileID hint는 **승인root/로컬성/선조nonlink/배타보유/이미지하위귀속/생성출처** 증명이 아니다. 승인root/factory/준비/실행/전달false와 누락목록을 보존한다. SafeHandle의 외부 Dispose와 경합한 마지막 Release가 close를 유발할 수 있고 synchronous OS 호출의 강제종료는 보장하지 않는다. 실제 factory 소유·처분/인증·actual writer는 별도 미구현 선행이다.

미래 null/invalid/closed C# 반례 SOURCE·한정정적 C0/I0/M0·diff0만 확인했으며 컴파일/RunAll/PInvoke·실제Windows상호운용/파일조회·근거진위·회수는 NOT_RUN/UNVERIFIED다. 새source2는 기존 재compile 후보4에 자동포함하지 않는다. 공식 계약 대조: [directory handle 허용 조회](https://learn.microsoft.com/en-us/windows/win32/fileio/obtaining-a-handle-to-a-directory), [GetFinalPathNameByHandleW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew), [BY_HANDLE_FILE_INFORMATION](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information), [GetFileInformationByHandle](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandle), [GetFileType](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfiletype).

## FN06 D1 native factory writer-basis SOURCE — 2026-10-23

readOwnershipNativeFactoryBasis는 같은 caller 인증 transaction의 기존 native profile을 전후 읽고 원 PREPARATION_GRANTED/fullref/hash에서 비순환 intent를 복원해 기존 writer_claims history를 전후 대조한다. 미회수 SYNTHETIC_CLAIM은 이미 만료돼도 차단한다. 원historyHash 변화·현재인증/범위/기한 불일치는 UNAVAILABLE다.

빈/회수 기록은 actual NONE·OS/WRITE 회수 증명이 아니다. 결과 OWNERSHIP_NATIVE_FACTORY_BASIS_ONLY/writerState UNKNOWN·actualWriterAbsenceVerified/factoryReady/생성·준비·실행·전달false·미확인권위를 보존한다. 원 claim 표/상태를 확장·재해석하거나 실제native 권위를 주입하지 않고 새endpoint/DB접속/DML·키/환경·Agent를 등록하지 않는다. 합성/타입·정적 검토는 실제PG경합/권위/사용가능factory PASS가 아니다.

## FN06 D1 retained image 바이트 조회 SOURCE — 2026-10-23

미등록 ReadRetainedImageBytesSource는 내부 exact FileStream만 수용하고 read-only/seekable·disk/비directory/비reparse/links1·양의20MiB이하 보수적cap·전후 metadata를 검사한 뒤8KiB 버퍼로 길이/EOF/SHA256 후보를 만든다. 원position을 복원하고 버퍼clear/참조회수후 결과기한을 재검사한다. [파일 metadata 조회](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandle), [구조/fileID 한계](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information), [FILE_TYPE_DISK 계약](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfiletype)을 SOURCE 대조에만 사용했다.

결과 RETAINED_IMAGE_BYTES_CANDIDATE_ONLY/allfalse이며 actual hash정확성/복원/경합은 미검증이다. FILE_TYPE_DISK·64bit ID hint·stream lock은 로컬 승인root/독점/변경차단·process image 연결 증명이 아니다. root/binary/보유provenance/배타성·write-delete exclusion/인증/disposal·hard상한은 누락이며 실제 준비/소유권으로 자동 채택하지 않는다. 새path/open/Write/StreamDispose·키/채널등록0, compile/시험실행/실제파일읽기/PInvoke는 NOT_RUN/UNVERIFIED다.

## FN06 D1 retained thread 조회 SOURCE — 2026-10-23

미등록 ReadRetainedThreadQuerySource는 내부 SafeHandle thread/process의 수명참조 아래 ownerPID=processPID·positive TID·process/thread 생성시각 순서·활성 및 전후 정체성 일치를 검사하는 읽기 SOURCE다. [ownerPID 조회](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocessidofthread), [TID 조회](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getthreadid), [thread FILETIME 계약](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getthreadtimes)을 선언 대조에만 사용했다. thread를 재open/생성하거나 Suspend/Resume/Terminate하지 않는다.

결과는 NATIVE_RETAINED_THREAD_QUERY_CANDIDATE_ONLY/ThreadOwnershipVerified·NeverResumedVerified·OsOwnershipVerified·준비·실행·전달 false다. active/CPU시간은 suspended/never-resumed 증거가 아니다. 원 factory 생성·미재개 이력/실제 SafeHandle disposal/Job·이미지/인증준비·서명/writer 누락을 유지하며 scalar나 fixture로 대신하지 않는다. cleanup후 검사하는 10초는 결과수용기준일 뿐 OS호출 강제종료상한이 아니다. compile/시험실행/PInvoke/상호운용은 NOT_RUN/UNVERIFIED이며 원 준비·관측/허가에 자동 채택하지 않는다.

## FN06 D1 native retained-handle 조회 SOURCE — 2026-10-23

미등록 ReadRetainedHandleQuerySource는 내부 후보 process/job SafeHandle의 수명참조 아래 PID·creation FILETIME·해당 Job membership/정확1member·Win32 이미지경로·활성을 전후 읽는 Windows API SOURCE다. 누락/실패·count/identity변경·기한초과는 고정 UNAVAILABLE로 정규화하고 raw경로/handle을 출력하지 않는다. [Job PID 구조](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_process_id_list), [Job 조회](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-queryinformationjobobject), [이미지 경로 문자수 계약](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew)을 SOURCE 선언/배치 대조에만 사용했다.

결과는 NATIVE_HANDLE_QUERY_CANDIDATE_ONLY/권한false다. 경로digest는 파일바이트hash가 아니며 factory handle·image/thread provenance/인증준비/서명/writer 및 SafeHandle disposal정책/실제close효과가 없으면 실제소유·PREPARED/회수로 승격하지 않는다. 참조해제 뒤 기한을 검사하지만 고정 호출 수/10초 결과수용 기준은 OS 호출 강제중단 상한이 아니다. handle 재open/Create/Resume/Terminate·파일/키·채널/API 등록은 없고 이 source의 compile/PInvoke/실행은 NOT_RUN/UNVERIFIED다.

## FN06 D1 retained 정체성 순수 비교 SOURCE — 2026-10-23

Host 내부 ComparePreparedSource는 원 생성 정체성 후보와 관측 후보의 run/gen/job/pid/startTicks/image·profile의 run/gen/image, 원 준비 이후/관측 이전 생성시각·현재기한·관측나이 최대10초, active/inJob/neverResumed·단일 Job member를 비교한다. 후보 identity는 불변 scalar이고 member 배열은 복제한다. 반환은 OWNERSHIP_PREPARED_SOURCE_MATCHED_ONLY/OsOwnershipVerified·PreparationAuthorized·ExecutionAuthorized·DispatchPerformed=false다.

이 scalar는 실제 retained handle이 아니다. 양쪽 값을 함께 위조하면 비교만으로 진위를 구별할 수 없고 RETAINED_HANDLE_PROVENANCE/ACTUAL_NATIVE_HANDLE_QUERY/인증채널/서명/writer/provenance는 누락이다. P/Invoke·실제 factory/조회/취소·서명·채널 등록을 추가하지 않는다. 미래 C# 시험 SOURCE·정적 검토만 있으며 compile/실행/OS/회수 PASS로 사용하지 않는다.

## FN06 D1 native 준비 입력의 원기록 투영 SOURCE — 2026-10-23

readOwnershipNativePreparationProfile은 현재 인증된 caller transaction에서 원 준비 receipt/HUMAN을 전후 검증하고, 사이에 원 PREPARATION_GRANTED 유일행의 fullref/hash·scope/subject/policy/등록/receipt를 대조해 Host 내부32필드로 투영한다. caller는 scope/ref만 지정하며 자유 hostHash/workerHash/profile을 수용하지 않는다. 원 issuedAt/expiresAt는 metadata에 그대로 보존하고 현재 재인증/등록/정책의 더 짧은 기한은 별도 expiresAt로 반환한다. AUTO/status-only/grants0는 기존 원 검증의 결과이며 등록권한 확장이 아니다.

결과는 OWNERSHIP_NATIVE_PREPARATION_PROFILE_BASIS_ONLY/모든권한false다. 인증된 native 채널·실제 writer/provenance·retained Job/process factory/관측서명은 누락이며 이 함수를 native port로 자동 등록하지 않는다. 새로운 endpoint/DB접속/키·OS·Agent 효과가 없고 합성/타입·정적 검토를 실제 채널/C# 상호운용 PASS로 승격하지 않는다.

## FN06 D1 신규 Host 사전검사 SOURCE — 2026-10-23

OwnershipEvidenceHost.PlanAsync는 외부 endpoint/CLI가 아닌 내부 미래 SOURCE다. 정확32개 metadata를 고정 복사하고 UUID·양의 안전 세대/초기ref version1·hash·UTC 및 최대120초 범위를 검사한다. 내부 current-basis reader는 default 미등록→UNAVAILABLE이며 AUTO/REGISTRATION_STATUS_ONLY/grants0·동일 선택/현재성 두 번 대조 후에도 반환은 OWNERSHIP_PREPARATION_SOURCE_PLAN_ONLY/ProcessCreationAuthorized·PreparationAuthorized·ExecutionAuthorized·DispatchPerformed=false다. caller echo는 실제 current 권위가 아니며 authenticated native binding/retained process·Job factory/관측서명/actual writer/provenance를 누락으로 명시한다.

port token은 private timeout/external signal과 분리하고 취소 callback은 소유 cleanup에서만 정규화한다. cleanup 후 UTC/Stopwatch/외부취소를 다시 검사한다. reader와 callback은 비차단 read-only 계약이며 실제 공급자 동작/종료 상한은 미검증이다. 미래 시험 SOURCE·정적 한정 검토는 compile/실행/Windows/실제 OS 권위 PASS가 아니다. REQUIRE는 계속 거절하며 실제 root/ACL/키·프로세스·서비스·DB·Agent 효과나 정식 build/route 등록은 추가하지 않는다.

## FN06 D1 신규 합성 worker SOURCE — 2026-10-23

OwnershipEvidenceWorker.cs는 신규 미래 Host용 합성 대상 SOURCE다. 정확 인자는 runId·generation·expiresAt뿐이며 runtime와 같은 UUID/안전정수/정규UTC를 검사한다. worker 진입시 UTC와 최대120초 고정 monotonic 예산을 함께 사용하고 외부명령/파일/키/통신/자식/Agent 기능을 제공하지 않는다. suspended 대상의 만료·취소/회수는 실행되지 않는 worker 루프로 보장하지 않으며 미래 retained-handle Host의 별도 책임이다.

worker/test source hash와 정적 검토만 동결했다. 컴파일/실행/실제 종료상한은 NOT_RUN/UNVERIFIED이고 기존 만료 QA helper·실제 OS 권위·writer/source sandbox/Agent profile이나 D2~D4 실제 실행 승인으로 재사용하지 않는다. 정식 build/migration/route/실행 목록에는 등록하지 않는다.

## FN06 D1 원 parent THREAD 이력 source — 2026-10-23

readOwnershipParentThreadHistory는 같은 caller 인증 transaction에서 원 SEND/준비 이력·실제 actor를 읽고 기존 BoundPgProviderClaimHistoryStore/SyntheticProviderClaimHistory 및 원 claim journal을 소비한다. 현재 HUMAN/OWNER·agent session 예약/명령과 원 THREAD receipt의 fullref를 대조하고 원 SEND의 session/role/assignment/연결/환경/등록·실행 scope 전체(원 grant fullref 포함)와 과거 시각을 확인한 뒤 준비를 재확인한다. 결과는 비밀 없는 역사 refs·false/UNKNOWN뿐이며 raw THREAD/protected handle/thread 식별자를 반환하지 않는다.

현재 parent/실제 원장·FSYNC/OS/실제writer·서명/credential/SEND 권위와 binding/headCAS 발급은 증명하지 않는다. 선행 missingEvidence를 전파하며 HISTORY를 caller 또는 다른 source가 실제권위로 자동 승격하지 않는다. 신규 endpoint/권한/handle/실제 Agent·DB 실행은 등록하지 않는다.

## FN06 D1 잠긴 attempt 이력/handle 생성 분리 — 2026-10-23

SyntheticProviderReaderFactory.readHistory는 기존 sender/stopper exclusive journal lock 안의 readLocked에서 원 SEND_ATTEMPTED→PERMIT_RECORDED(또는 STOP_ATTEMPTED) 구조/hash·선행·선택 binding을 읽어 복사한다. handle build를 호출하지 않는다. resolve는 동일 readHistory 검증 결과의 고정 selection으로 기존 build를 수행한다. 이력 조회는 원장 진위·fsync·현재 parent/OS/실행 권위가 아니며 반환의 해당 false/missingEvidence를 다른 source에서 실제 권위로 자동 채택하지 않는다. 실제 FS/OS 공급자나 신규 endpoint·실행을 등록하지 않는다.

## FN06 D1 원 SEND 역사 허가 graph 후속 — 2026-10-23

readOwnershipInstructionHistory는 단순 execution_commands 조회 대신 기존 SyntheticPgInstructionQueueStore.read의 고정 graph 검증을 재사용한다. 같은 caller tx에서 authenticateInTransaction actor를 다시 얻고 원 HUMAN command/receipt/audit·예약/outbox를 대조한다. current/claim port는 무조건 거절하며 historical read에서 발급/예약/실전달로 전환하지 않는다. 반환 sendAuthorizationGraphRead=true와 CURRENT_SEND_AUTHORITY 미확인은 서로 다르다. 아래 앞선 원 SEND graph 미연결 기록은 a51d5ac8 시점 이력이며 이번 source 연결로만 갱신한다. proof 서명/실행 credential 현재성·실제 attempt/parent/OS/writer/provenance·원 binding 발급은 여전히 증명되지 않았고 모든 권한 false·실DB/서비스/Agent 실행0이다.

## FN06 D1 원 SEND/permit/proof 이력 읽기 — 2026-10-23

readOwnershipInstructionHistory는 caller-owned 같은 인증 transaction에서 현재 AUTO 준비 원영수증/HUMAN·정책/등록을 전후 대조하고, 기존 permit journal의 exact fullref와 원 SEND command/envelope/예약 및 시도/OS 참조를 읽는다. 중간 readOwnershipInstructionProofHistory는 원 proof receipt/hash·challenge 원본/consumed2·정확 target와 기한을 대조한다. 저장된 CURRENT/CONSUMED나 caller selection은 실제 권위가 아니며 HUMAN 세대와 실행 credential 세대를 혼동하지 않는다.

반환은 HISTORY_ONLY/UNKNOWN이며 proofConsumptionVerified/signatureVerified/currentAuthorityVerified/bindingAuthorized/executionAuthorized/dispatchPerformed는 false다. 원 proof 소비 이력을 조회했다고 서명·현재 실행 credential·원 SEND HUMAN 허가 graph·실제 local attempt/parent/OS/writer/회수/provenance를 증명하지 않는다. 해당 missingEvidence를 유지하고 authority port/route/START/allowlist에 등록하지 않는다. REQUIRE는 소비 verifier 전 기존 거절을 유지한다. actual DB/SQL/native/키/Agent 실행은 별도 경계이며 본 source 합성 시험으로 승격하지 않는다.

## FN06 D1 미적용0039 행 모양 layer — 2026-10-23

0039_ownership_authority.sql.pending의 ownership_record_shape_guard는 정확5표 snapshot의 canonical hash·schema/행 scope와 일부 ref/시각/false 표식을 대조하는 SOURCE layer다. kind JSON null을 명시 거절하고 anchor/binding·관측 report 구조를 각 source 소비 필드와 대조한다. 기존 무조건 ownership_authority_unavailable·RLS false/REVOKE를 그대로 두며 새로운 역할/허가·escape flag를 추가하지 않는다. 실행 목록에도 등록하지 않는다.

이는 모든 kind payload·현재 HUMAN/정책/등록·서명 crypto·COMMIT 시점 권위를 완성한 guard가 아니다. 실제 PostgreSQL 구문/트리거/제약 및 과거 M1의 COMMIT 기한 문제는 미검증/미해결이다. raw 후보 hash와 source 한정 검토는 WORK_STATUS를 따르며 이 변경만으로 정식 DB 적용 가능/실행 허가/PASS를 주장하지 않는다.

## FN06 D1 기존 writer claim 이력 소비 — 2026-10-23

`readOwnershipWriterClaimHistory(db,access,token,csrf,intent)`는 같은 caller transaction의 현재 intent HUMAN/OWNER·정책/등록 아래 기존0017 writer_claims를 최대200개 읽고 전후 기한/주체를 검사한다. HISTORY_ONLY·claims/historyHash·hasUnreclaimedClaim·writerState=UNKNOWN·writerReleaseVerified=false·준비/실행/dispatch=false와 실제 권위/OS·source WRITE 회수/출처 미확인 항목을 반환한다. 원 grant/command의 전체 승인 체인을 검증한 객체가 아니며 행이 없거나 recordedReclaimedAt이 있어도 실제 NONE/안전 회수로 승격하지 않는다.

준비 staging의 신규 저장에서는 미회수 claim을 만료와 무관 차단하고 저장전후 이력 hash·기한을 대조한다. historyHash는 원 저장 필드만 포함하며 관측시각 파생 recordedExpired는 응답 표시로 분리한다. 이미 회수된 동일 이력의 시간 경과만으로 hash를 바꾸지 않지만 실제 행/회수 필드가 변경되면 계속 거절한다. 이 분리를 실제 NONE/안전 회수 권한으로 승격하지 않는다. DML/실회수·새 table/실행 정책·DB 적용은 하지 않는다.

## FN06 D1 최초 준비 원자 owner — 2026-10-23

`SyntheticOwnershipPreparationStore(pool,access,prerequisites=null,{timeoutMs:10000}).prepare(token,csrf,intent,{intentId,commandId,eventId},signal)`는 기본 연결0의 합성 전용 owner다. 기존 staging·같은 current intent basis와 원 receipt reader를 소비해 AUTO 최초 준비의 원 command/receipt/audit→PREPARATION_GRANTED·project slot을 한 transaction으로 묶는다. 기존 준비 이력이 있는 project나 같은 세대 head를 자동 재사용하지 않으며 REQUIRE·actual writer/회수/출처 근거 부재를 허가로 바꾸지 않는다. 과거 command replay는 HISTORY_ONLY·새 event0이며 신규 결과는 SYNTHETIC_OWNERSHIP_PREPARATION_COMMIT_ONLY·모든 권한false다.

helper/port에는 단일 SELECT/INSERT/UPDATE query만 노출하고 transaction 제어/연결 종료를 주지 않는다. 유한 timeout·외부 취소·late query 차단과 pending 연결 폐기, 별도 유한 ROLLBACK cleanup/불명확 폐기를 사용한다. COMMIT 시도 후 응답/기한/release 불명확은 COMMIT_UNKNOWN이며 자동 재발급하거나 rollback으로 미저장을 단정하지 않는다. 실제 PG COMMIT 기한 guard/M1 해결이나 native/실권한 활성화를 뜻하지 않는다. 실제 공급자·SQL 실행 manifest·route·정책/키·서비스/Agent는 미등록/미적용이다.

## FN06 D1 준비 원 intent 명령·receipt·audit staging — 2026-10-23

`stageSyntheticOwnershipPreparationIntent(db,access,token,csrf,intent,serverIds,prerequisites=null,signal)`는 caller 소유 transaction의 내부 합성 source다. 기본 공급자 부재는 query0이며 현재 intent basis·AUTO/명시 정책·원 주체·최초 project 준비slot 부재·synthetic writer/candidate 선언을 확인한다. 기존 projectReplay/persistProjectReceipt를 소비하지만 범용 operation/route를 추가하지 않는다. 신규 결과는 SYNTHETIC_OWNERSHIP_PREPARATION_INTENT_STAGED_ONLY와 원 intent/command/receipt/audit fullref·기한·missingEvidence이며 준비/실행/dispatch 권한false다. 과거 결과는 반환 전 현재 보호를 재대조한 REPLAY_HISTORY_ONLY로만 반환하고 새 사건/준비 근거로 재사용하지 않는다. REQUIRE는 승인 소비 미연결로 거절한다.

함수는 BEGIN/COMMIT/ROLLBACK/release·PREPARATION_GRANTED·프로세스/실제 writer/권한을 생성하지 않는다. caller는 실패 시 rollback/폐기와 preparation event/slot의 원자 저장·최종 현재성·COMMIT 확인을 별도로 소유해야 한다. 실제 prerequisites/DB·정책/SQLguard 활성화·키/native/Agent는 미구현/미검증이다.

## FN06 D1 준비 사건 이전 intent 현재근거 — 2026-10-23

`readOwnershipPreparationIntentBasis(db,access,token,csrf,intent)`는 caller 소유 transaction에서 exact intent parser와 현재 HUMAN/OWNER·제어·명시 정책/등록·최종 DB기한을 대조한다. 기존 event reader의 검증 본문을 공유하지만 미래 preparationRef를 생성하지 않고 INTENT_BASIS_ONLY·intent/hash·scope/subject/policyRef/registrationRef/공개키/checkedAt/expiresAt·approvalRequired를 반환한다. 준비/관측요청/실행/dispatch 권한은 false이며 원 명령·허가·감사/필요 승인소비·writer 부재/실회수·provenance는 여전히 별도 근거다. 기존 generic operation allowlist·route·SQL/실키·서비스 활성화는 변경하지 않는다.

## FN06 D1 준비 intent 순수 조립 — 2026-10-23

`planOwnershipPreparationIntent(intent,serverIds,nowMs)`는 `serverIds={intentId,commandId}`의 서로 다른 서버 내부 UUID와 exact intent 구조·scope/주체/fullref/기한/세 준비 행위·false 표식을 검사한다. 원 receipt reader의 비순환 intentRef와 AUTO commandSnapshot(approvalRef=null) 및 requestHash를 반환하며 목적은 OWNERSHIP_PREPARATION_INTENT_PLAN_ONLY다. 실제 인증/현재 정책/등록·writer NONE/회수·provenance·원 명령/receipt/audit 저장 근거를 제공하지 않고 준비/실행/dispatch 권한은 false다. 일반 operation allowlist·route 등록·DB 저장/실제 준비 실행은 변경하지 않는다. 사용자 입력 writerState=NONE은 구조적 선언일 뿐 실제 부재 증거가 아니다. 정확 키 외 미래 event/receipt/audit 참조·SEND/WRITE 및 120초 초과는 거절한다.

생성물은 원 receipt 소비 계약과 합성 대조했으며 실제 creator/인증/저장·승인소비/서비스 검증은 별도 미완료다.

## FN06 D1 별도 준비 승인 보관 소비 조회 — 2026-10-23

`ProjectApprovals.readOwnershipPreparationConsumption(db,actor,projectId,requestId)`는 새 HTTP route가 아닌 내부 HISTORY_ONLY 읽기다. 기존 request/decision/consumption 무결성 검사를 재사용하되 새 method에만 prepareOwnershipAnchor를 허용한다. 일반 read/request/authorize/consume의 원 allowlist는 유지되고 새 승인 발급/소비는 연결하지 않는다. OWNER·CONSUMED/version3·APPROVE·현재 policy/control ref·기한·원 소비 서버명령/요청 hash와 후보 ID·시각을 검사하고 반환 직전 DB clock으로 최종 기한을 재검사한다.

반환은 requestRef/decisionRef/consumptionId/commandRef(id=원 소비 serverCommandId,version1,hash=requestHash)/candidateCommandId/scopeDigest/payloadHash/policyRef/controlGeneration/consumedAt/observedAt/expiresAt와 `OWNERSHIP_PREPARATION_APPROVAL_HISTORY_ONLY`다. 준비/관측/실행 권한과 dispatch는 모두 false이며 현재 인증·정확 준비 정책/등록·원 receipt 결박·writer/실회수·후보 provenance를 대신하지 않는다. 원준비 reader의 REQUIRE_APPROVAL 미연결 차단은 유지하며 이 DTO를 허가로 자동 변환하지 않는다. 실제 PG·발급·원자 소비·서비스/Agent는 미검증이다.

## FN06 D1 원 준비 명령/영수증의 비순환 source 계약 — 2026-10-23

`readOwnershipPreparationReceiptBasis(db,access,token,csrf,scope,preparationRef)`는 DB 원 준비를 읽고 현재 HUMAN/정책/등록을 전후 검사하는 AUTO 읽기 source다. REQUIRE_APPROVAL은 소비 verifier 연결 전 UNAVAILABLE이며 기존 범용 승인/operation 등록부와 SQL은 변경하지 않는다. 결과는 RECEIPT_BASIS_ONLY/권한 false, writer NONE/실회수·후보 provenance와 실제 원자 발급/송신은 별도 미완료다.

해시 순환 방지: 명령의 targetRef는 미래 event가 아닌 불변 intentRef다. intent snapshot의 정확 키는 `schemaVersion=1,purpose=OWNERSHIP_PREPARATION_INTENT,scope,subject,registrationRef,details(원 준비 payload),at,expiresAt,executionAuthorized=false,dispatchPerformed=false`이며 미래 event/command/receipt/audit ref를 넣지 않는다. intentRef는 UUID/version1/canonical snapshot hash다. `commands.result_ref.data`에는 `ref,status=OWNERSHIP_PREPARATION_INTENT_RECORDED,intent,commandSnapshot`을 보존하는 후보 계약이다. commandSnapshot은 기존 ProjectCommand의 prepareOwnershipAnchor/targetId=null/expectedVersion0/baselineRefs=[]/payload={intent}다. 현재 AUTO 경로는 approvalRef=null만 허용한다.

준비 event의 commandRef는 commands.id/version1/request_hash, authorizationReceiptRef는 실제 receipt.id/version1/scope_digest다. scopeDigest는 기존 persistProjectReceipt의 project/actor/client/control/requestHash/policyRef/targetRef=intentRef 식을 그대로 따른다. auditRef는 원 row의 명시 snapshot `projectId,serverSequence,eventId,actorRef,clientRef,commandId,operationId,targetRef,policyRef,approvalRef,outcome,reasonCode,scopeDigest,recordedAt,sourceKind,correctionOf`의 canonical hash다. APPLIED/HUMAN_COMMAND/EXPLICIT_OWNERSHIP_PREPARATION_INTENT 및 원 명령·주체·intentRef·receipt digest를 대조한다. app에서 불변인 receipt/audit는 plain SELECT, 변경 가능한 commands c는 기존 권한 안에서만 잠근다. 이 source 계약의 실제 creator/SQL 검증·서비스 적용은 아직 없다.

## FN06 D1 현재 정책/등록의 한정 근거 — 2026-10-23

`readOwnershipHumanPolicyRegistrationBasis(db,access,token,csrf,preparation)`는 caller의 활성 transaction 안에서 현재 인증·OWNER/제어·원 준비 주체/정책 fullref와 prepareOwnershipAnchor 규칙·등록 원 scope/hash/ISSUED/TRUSTED·공개키 fingerprint·최소기한을 읽는다. 연결/transaction 종료/DML·키/credential 발급·정책 변경은 없다. 등록은 REGISTRATION_STATUS_ONLY/grants=[]를 유지한다.

반환 `OWNERSHIP_HUMAN_POLICY_REGISTRATION_BASIS_ONLY`는 approvalRequired와 missingEvidence=[ORIGINAL_PREPARATION_RECEIPT_AND_APPROVAL,VERIFIED_WRITER_NONE_OR_RECLAIM,CANDIDATE_PROVENANCE]를 분리한다. preparationAuthorized/observationRequestAuthorized/executionAuthorized/dispatchPerformed=false이며 원 준비 event 저장 귀속/필요 승인 소비를 증명하지 않는다. 이 객체를 archive의 실제 current authority나 발급 허가로 자동 변환하지 않는다. proposed operation/일반 정책·route는 아직 미등록이고 실제 DB 검증도 없다.

## FN06 D1 원 관측 요청의 내부 계획 — 2026-10-23

`planOwnershipObservationRequest({preparation,tail,anchor,head,authorityExpiresAt,nowMs})`는 인증된 project lock 아래 읽은 원 기록을 받아 조립할 내부 함수이며 nonce/phase/request ID를 caller가 지정하지 못한다. BOOTSTRAP_PREPARED는 head=null·tail=preparation, CURRENT는 ACTIVE head의 exact currentEvent/tail·anchor/preparation을 요구한다. 최대10초와 준비/tail/anchor/head/현재 권위 기한의 최솟값을 적용하고 사건 hash 후 requestRef를 붙인다.

반환은 `OWNERSHIP_REQUEST_EVENT_PLAN`·executionAuthorized/dispatchPerformed=false다. 이는 준비 권위·후보 provenance·actual writer NONE 검증이나 DB 발급 확정/송신이 아니며 이 함수만으로 밖에 유효 요청을 노출하지 않는다. 원자 저장·COMMIT 후 전달과 현재 policy/registration/slot 공급자는 아직 연결되지 않았다. 합성 fixture 저장/서명/수용 연결을 실제 원 발급으로 보고하지 않는다.

## FN06 D1 내부 동일 transaction 인증 소비 — 2026-10-23

`AccessRepository.authenticateInTransaction(db,token,csrf)`는 caller가 소유한 transaction에서 사용자/session/client 잠금 뒤 DB 시각·활성 xid·CSRF·회수·자격세대를 검사한다. 자체 연결/BEGIN/COMMIT/갱신은 없고 기존 authenticated/login 계약은 유지한다. 이 identity는 정책·단독제어·재인증·등록·writer/실행 권위가 아니다.

`SyntheticPgOwnershipArchive.acceptAuthenticated(access,token,csrf,scope,input,signal)`은 같은 connection에서 처음과 종료 직전 인증 결과를 원 preparation 주체/합성 current와 대조하고 세션/재인증 최소기한을 적용한다. 기존 accept는 합성 source 전용이며 실제 운영 인증 경로가 아니다. 나머지 current provider는 아직 합성·기본 null/route0이고 실제 policy/registration/writer 연결을 구현/검증하기 전 활성화하지 않는다. token/CSRF를 저장/로그/결과에 넣지 않는다. 가짜 Pg 단위 PASS는 실제 PG 잠금/xid/COMMIT 증거가 아니다.

## FN06 D1 관측 수용의 내부 source 경계 — 2026-10-23

`SyntheticPgOwnershipArchive.accept(scope,input,signal)`은 새 HTTP endpoint가 아닌 내부 source adapter다. 기본 current-authority가 없으면 DB 연결 전에 UNAVAILABLE이며 주입한 합성 공급자의 정확 scope/subject·등록/preparation/key와 원 DB 사건을 대조한다. 입력의 report/서명/facts는 원 REQUESTED에서 재구성한 request와 최초 고정 process에만 수용한다. caller가 보내는 새 anchor JSON을 신뢰하지 않는다. 원 명령·preparation receipt가 현재 허가라는 실제 공급자는 아직 미구현이며 이 adapter 자체를 권한자로 쓰지 않는다.

관측·수용 사건·초기 anchor/채택/head 또는 CURRENT CAS를 같은 connection/transaction에서 기록한 뒤 current/기한을 다시 확인한다. 성공 반환도 `OWNERSHIP_ARCHIVE_SYNTHETIC_COMMIT`, executionAuthorized/dispatchPerformed=false다. COMMIT 응답 실패는 `OWNERSHIP_ARCHIVE_COMMIT_UNKNOWN`으로 남기고 자동 재시도/미저장 단정하지 않는다. rollback 실패는 UNCONFIRMED와 연결 폐기, 나머지 source 읽기/쓰기/권한/기한/CAS 실패는 고정 오류를 반환한다. 실 PG/권한·OS/Agent 증거가 아니며 route/정책/서비스/실행 manifest·SQL 적용은 변경하지 않았다.

## 2026-10-22 FN12/UI08 보관 원장 문제 근거 — 채택된 읽기 전용 추가

- `GET /api/v1/projects/:projectId/results/:id/issue-basis`, query 없음, HUMAN 단일 유효 `__Host-anvil.sid`만. Bearer/중복 cookie/다른 host 거절. 같은 인증 tx에서 기존 원제출·원실행/전체 관측원장·ACK 검증 reader를 재사용하고 최종 회원 잠금·DB 시각의 세션 기한 및 COMMIT 후 기한을 검사한다. 성공/오류는 기존 no-store·비노출 DTO를 유지한다.
- 응답: `purpose=STORED_ISSUE_BASIS_ONLY`, `projectId/resultRef/assignmentRef/executionRef`, `ackRef`, 해시 재대조용 보관 `ack` 원문(null 가능), ACK 자체의 `observationGaps[{from,to,evidenceRef}]`, `journalObservedAt/asOf`, `sourceAssurance=SERVER_STORED_SYNTHETIC_CLAIMS_ONLY`, `classification`, `causeUnestablished=true`. `actualProviderObserved/currentAuthorizationVerified/completionAccepted/formalFailureCounted/writerReleaseVerified/executionAuthorized/dispatchPerformed`는 모두 false다.
- 내부 분류 입력은 `reports=[]`, `resultAssessment=null` 고정. 전체 ACK 검증을 마친 gaps만 소비하고 최근20개 표시 항목에서 다시 계산하지 않는다. 분류는 저장원장 `OBSERVATION_GAP` 또는 `UNVERIFIED_CAUSE`만 가능하다. ACK 없음/공백 없음도 정상 가동·관측 완전·미수행/원인 해소를 의미하지 않는다. asOf는 서버의 보관 범위 대조 시각이지 현재 OS/Agent·원인/실행권한 인증이 아니다.
- 기존 원장10000건/2MiB 응답 한도와 분류100gap 상한을 유지한다. 상한 초과는 자르거나 일부 정상으로 표시하지 않고 거절한다. 클라이언트는 선택 보고/실행·ACK 원문 hash/계수·전체 분류 DTO와 true/false 상수를 exact 대조한다. 명시조회/재조회·이탈 세대를 구분하고 401/403/404는 부모 보고/임무/검수까지 회수하며 fallback GET는 없다.
- 새 SQL·지속 issue 기록/정책·권한·Secret·실OS/Agent·서비스 변경/실행·재시도/kill·writer 회수는 없다. PMO의 해당 source delta 채택은 실제 PG/정식 served QA나 기능 전체 완료를 의미하지 않는다. rollback은 이 새 route/provider/reader/패널 소비만 일반 revert하고 기존 제출·관측/ACK·분류기·원 API는 유지한다.

## FN09 부모 연결 하위 초안 한정 A — 2026-10-21 직접 채택

PMO가 전달한 신산님의 HUMAN_DIRECT_REPLY '승인해'로 FN09_PARENT_DRAFT_LINK_PROPOSAL.md의 SHA256 283E8601C8951574740630D7EA4F6A1EE59260E925B20FC2C5B9579E9D326B87 한정 A를 채택한다. 제안 파일의 PROPOSED 표기는 승인 전 원문 이력으로 보존하며 현재 채택 범위는 이 절을 따른다. 과거 제한 A/§13.1의 parent=null 문구는 아래 초안 범위에서만 대체한다.

- 기존 prepareAssignment의 definition.parentAssignmentRef는 null 또는 같은 프로젝트의 정확한 현재 내용확정 부모 fullref다. 부모 자체의 parent는 null이며 현재 head/최신 ACCEPTED 검토·원문 해시/영수증/감사와 계획·적용 기준을 저장 transaction에서 대조한다.
- taskRef의 applicationRef/planRef/nodeId 및 environmentRef/budgetRef/recordingPolicyRef는 부모와 exact 동일, baselineRefs/requiredCapabilities와 FILE allowedScopes는 exact 부분집합이다. taskCode는 같은 현재 확정 계획 내 실제 업무다. 부모 fullref의 개정 중 제거·교체/child→root 전환은 이번 범위에 없고 거절한다. 자유 문장·실제 OS/내용·권한의 적합은 별도 미확인이다.
- child는 초안 저장·개정·조회만 허용하며 ready/executionAuthorized/dispatchPerformed=false다. child 검토·확정·책임 세션 배정·준비·START/SEND는 계속 거절한다. 기존 root/null 업무와 과거 버전·미확인 원명령을 보존한다.
- UI04에서 root 초안을 명시 선택해 현재 확정 원문을 조회한 뒤에만 하위 초안을 준비한다. 부모 정의를 복사해 구체화/축소하고, 별도 저장·정확 버전 재조회로 확인한다. 부모 확인 자체는 쓰기·Agent 호출이 아니다. 이미 조회한 부모도 저장 때 재검사한다.
- 기존 SQL은 수정하지 않고 새 0034_assignment_parent_drafts.sql 후보만 추가한다. 현재 실제 DB/SQL 적용·정식 서비스·실정책 부여·실제 위임/Agent/비용·Secret 변경은 승인에 없으며 실행하지 않는다. 합성 시험/정적 검토를 실제 PG 컴파일·직접 DML·COMMIT/MVCC·사용자 기능 완료로 승격하지 않는다.

## FN01 기능 분류 시작 기준선 후보 — 2026-10-18

신산님 직접 승인 A안의 상세 계약은 [FN01 카드](../work_packages/FN01_BASELINE_IMPLEMENTATION.md) Task1~4·상세 wire다. 기존 §9.2의 items/sourceSnapshotRef:Id 단일 confirmBaseline 개괄은 이 후보에서 초안→내용검토→별도채택으로 구체화한다. 실제 적용/서비스·정책/Agent 실행 승인이 아니다.

- 프로젝트 commands에 saveBaselineDraft(정확 baseRef/source/items/coverageReason/reason), reviewBaselineContent(정확 draftRef·항목별4상태/판정·HUMAN 내용 검토·CORE 실제 정상/저장조회/중요실패 근거), confirmBaseline(draftRef/reviewRefs/reason/acknowledged=true)을 추가한다. 현재 OWNER/client/control·명시 AUTO/DENY·기한/CAS/replay/감사를 기존 명령 계층에서 확인한다. REQUIRE_APPROVAL/approvalRef는 BASELINE_APPROVAL_NOT_CONNECTED로 닫으며 uploadArtifact 전용 일회 소비를 넓히지 않는다.
- protected same-origin GET: projects/:projectId의 /baseline-drafts, /baseline-drafts/:id/versions/:version, 해당 /decision, /baselines, /baselines/:id/versions/:version, /baseline-current. 목록은 limit20/최대50·서명 cursor와 metadataIntegrity=NOT_RECHECKED이며 raw 원문을 반환하지 않는다. exact GET은 고정 snapshot과 현재 source/증거 대조를 분리한다.
- 기록의 contentConfirmed=true는 기능 분류를 과거 채택한 사실이다. 뒤 REWORK/새 검토·격리/접근불가 등은 currentContentReviewValid=false와 currentCheck(CHANGED/UNAVAILABLE)로 표시하고 과거 기록을 덮지 않는다. NONE_SELECTED는 빈 소스 검증이 아니고 sourceAuthorizationVerified/coverageVerified/executionAuthorized/dispatchPerformed는 false다. SourceScope/Agent 실행 허가로 자동 소비하지 않는다.

## FN09 사람 내용 검토·별도 확정 후보 — 2026-10-18 결정 A

AV3-FN09-ASSIGNMENT-CONFIRMATION-PREP/01:29:50Z 결정은 [상세안](FN09_ASSIGNMENT_CONFIRMATION_PROPOSAL.md) SHA256 3369C4A2A0E595524DD06001FF3E7B57B9B5EA0B8B346B054BFDF1AF01B66701의 후보 구현·격리 검증에만 적용한다. reviewAssignmentContent/confirmAssignment는 기존 프로젝트 명령의 OWNER·현재client/제어·각 명시정책·기한/DENY·idempotency/CAS/감사를 소비한다. 정확 payload·6기준/수동판단·내용 필수검사·최신 감사순번·두 전용 GET은 상세안 그대로이며 초안 ref와 확정 ref를 id/version만으로 치환하지 않는다. 확정 snapshot은 ref/관측시각을 제외한 저장 전체(confirmedAt 포함)를 canonical SHA256하며 confirmationId는 불변 저장행/영수증에 별도로 결박한다. 검토 독립성은 NOT_CLAIMED이고 같은 작성자 여부를 조회한다. UI04 보관 입력은 기존 주체/client/project 버퍼에 포함하고, 원명령·불확실성/조회거절 원문숨김·실행false를 유지한다. 새0013은 assignment_content_reviews/assignment_versions만 추가하는 후보이며 기존0012·정식DB 적용 승인을 대체하지 않는다. 실제 구현/검증·미검증은 WORK_STATUS를 따른다.

## FN09 임무 초안 저장 후보 — 2026-10-18 제한 A

호환 보완: taskRef.taskCode는 기존 작업계획 업무 코드 문법을 사용하지만 nodeId는 기존 적용 그래프의 비어 있지 않은 well-formed 문자열을 원문 그대로 사용한다. 새 ASCII·영문 시작·64자 제한/정규화는 적용하지 않으며 전체 canonical 2MiB·실제 적용본의 정확 node 존재를 검사한다. 응답유실 등 이미 pending/uncertain인 명령은 후속 인증·제어·정책 거절만으로 미적용 확정하지 않고 원입력/원명령/불확실성을 유지한다.

AV3-FN09-ASSIGNMENT-DRAFT의 후보작성/격리검수만 허용하며 정식DB 적용·실제 배정은 별도다. 기존 project command operation=prepareAssignment, payload={baseRef,definition,reason}로 신규(target=null/expected0/baseRef=null)와 동일 초안 개정(target/baseRef.id·expected/baseRef.version·hash 정확일치)을 구분한다. definition은 §13.1의 명시 필드 전부를 사용하며 taskRef={planRef,taskCode,applicationRef,nodeId}, baselineRefs=VersionRef[], inputs/outputs/acceptanceCriteria/verificationRequirements/included/excluded/requiredCapabilities=문자열배열, allowedScopes=기존 SourceScopeV1 FILE 배열(빈 경우 부족), environmentRef/budgetRef/recordingPolicyRef=VersionRef|null, parentAssignmentRef=null(부모 실임무 미연결), purpose/goal/ownerRole/integrationResponsibility=문자열이다. 각 배열≤200·텍스트≤20000 UTF16(ownerRole≤200), 전체 canonical UTF8≤2MiB, getter/unknown필드/가짜완료·준비 플래그는거절한다. 불완전 의미내용은 readinessIssues로 보존하되 문법/의심비밀·없는/다른프로젝트/변조참조는차단한다. 원본정책·예산/환경/OS/필수맥락/이해·실행을 caller ref나 저장성공으로검증하지않고 ready=false/executionAuthorized=false/dispatchPerformed=false다.

기존HUMAN OWNER·같은client/현재단독제어세대·명시prepareAssignment정책/DENY우선·기한·동일명령/hash/감사·CAS를사용한다. taskRef의현재적용node와정확현재확정작업계획/설계·업무카드를서버에서대조한다. 기존확정본수정/자동재지시0. 신규표2개는 불변 version_json/content_hash·이전ref/작성actor-client/command와receipt·정확프로젝트FK·head CAS/불변이력보호를소유한다. 목록/정확버전GET은현재회원·project격리/no-store·유한cursor·무결성을검사하고원문은명시선택으로만연다. 실제contract/code/검증상태는WORK_STATUS를따른다.

FN09 내부 준비 비교(공개 계약/권한 변경 아님): inspectSourceScopeContainment(parent,child)는 기존 SourceScopeV1 FILE 유한 구조를 검사하고 root/mapping/observation/baseline ref 및 상대경로/READ·WRITE의 정확 일치 부분집합만 보고한다. WRITE의 READ 포함·경로 대소문자 동등성을 추정하지 않는다. scopeContained=true도 executionAuthorized=false이며 실제 위임·현재권한/project/세대·기한/예산/sibling writer/OS 경로검사를 대신하지 않는다. 부모/자식 입력오류와 ref/target 불일치는 고정 code만 반환해 원문/비밀을 반사하지 않는다. 실제 소스·실행·저장·API 연결은 없다.

## UI04 선택 단계 문서 목록 — 2026-10-18 직접 승인

신산님 직접 ‘승인’/PMO AV3-PMO-UI04-STAGE-DOCUMENT-READ A에 따라 기존 GET `/api/v1/projects/:projectId/documents`에 optional `applicationId`+`nodeId`를 반드시 쌍으로 허용한다. UUID/기존 StageNodeRef 규칙·limit/cursor를 검사하고 현재 로그인/회원·프로젝트 격리/no-store와 무필터 DocumentPage/동작을 유지한다. 회원·현재 적용본(snapshot/source/graph hash 포함)·문서 최신head의 저장 stageRef는 단일 SQL 읽기 snapshot에서 대조하며 다른 적용본 문서를 섞어 반환하지 않는다. cursor는 actor/project/application/node/limit에 결박하여 다른 단계/프로젝트/무필터 혼용을400으로 거절한다. 잘못된 입력400·비회원/없는node404·옛적용409 METHODOLOGY_APPLICATION_CHANGED·적용무결성503이고 기존거절은 약화하지 않는다. 목록은 관측시점 최신 문서의 연결metadata이지 원문 검수·확정·실제현재단계/실행준비 증거가 아니다. UI의 고정 원문은 기존 readDocument/bytehash를 거치고 선택단계와 다른 문서는 표시하지 않는다. 선택단계/적용전환·조회오류는 앞선 목록/원문을 제거하며 자동무필터 fallback·자동전체pagination0이다. 새schema/migration·지속domain쓰기·실사용자정책/Secret·서비스·Agent/비용·추가compiler는 승인에 없다.

## UI04 고정 적용 방법론 조회 — 2026-10-18 승인 계약

신산님 10분 위임을 PMO가 사용자 실제 게시20:59:26Z→21:11:46Z/12분20초·최신5turn 새답변/중지/거절없음으로 확인한 AV3-PMO-UI04-METHODOLOGY-APPLICATION-READ A다. 구현·적용 실제 상태는 WORK_STATUS를 따른다.

`GET /api/v1/projects/:projectId/methodology-application`은 query 없이 기존 Anvil HUMAN 로그인·현재 프로젝트 회원·프로젝트 격리를 검사하고 no-store로 읽는다. 기존 project_methodologies의 최신 application_version 한 행에 대해 applicationRef={id,version,contentHash:snapshot_hash}, snapshot={name,purpose,graph,sourceRef,draftConfirmationRef?}를 반환한다. row.project_id/source_definition_id/source_version/source_hash와 sourceRef·graph SHA256, snapshot 전체 canonical SHA256 및 고정 그래프 구조·연결을 대조한다. draftConfirmationRef는 {draftRef:VersionRef,confirmationId}이며 graph hash와 일치해야 한다. 응답은 {projectId,applicationRef,snapshot,observedAt,executionState:'NOT_CONNECTED'} 정확5필드다. 미적용은 applicationRef:null/snapshot:null을 함께 반환하며 편집 정의/공통본으로 대체하지 않는다.

형식/query400·없는 회원/교차 프로젝트404·무결성503·만료401·기존Host/credential거절을 유지한다. 현재 양식 원문 접근/확정·실제 실행 준비 검증이 아니라, 고정 그래프에 선언된 양식 참조를 사용한 구조 검수다. 새 schema/migration/도메인쓰기·적용 전환/정책/계정/권한/Secret·서비스·Agent 실행0이다.

UI04는 별도 project GET의 currentMethodologyRef와 새 응답의 적용 ID/세대/hash가 정확히 일치할 때만 정의를 표시한다. 두 조회 사이 적용·미적용 전환/불일치는 client METHODOLOGY_APPLICATION_CHANGED로 이전 내용을 제거하고 프로젝트 원본 재조회를 요구한다(서버가 실제409를 반환했다는 뜻은 아니다). 정의의 단계 선택·입출력 양식/완료·승인·기록조건·연결 조회와 실제 실행/세션·단계별 진행 상태를 구분한다. 지시·시작/중지·자동모드 권한을 만들지 않는다.

## A-3 최신 후보 연결 — 실제 저장·권한 검증 아님

새 source-read routes/ops와 별도 scope/token·HUMAN 조회를 제한 후보로 연결했다. connector 경로는 실제 암호화 socket 필수이며 trustProxy/forwarded만으로 대체하지 않는다. grant 상세/목록은 nullable snapshotRef를 반환하고 snapshot 버전1 GET의 OWNER 원문/VIEWER 집계로 연결한다. Web는 정확 refs/본문 hash/주장·수신시각/보고 집계·비실행 flags를 대조한다. credential raw는 브라우저/HUMAN 조회에 전달하지 않으며 기존 상태조회 token/grants=[]는 불변이다. SQL작성·합성검증은 실제 인증/COMMIT/SQL guard/TLS/OS 증명이 아니다. 최신 검증·한계는 WORK_STATUS, 아래 미연결 표기는 이전 단계 이력이다.

### 이전 후보 작성 이력

N2 HUMAN 서비스 후보는 명시 AUTO/DENY·REQUIRE_APPROVAL412, exact source/registration·원 session 기한에서 scope를 파생하고 기존 command/receipt 호출과 새 grant INSERT를 같은 authenticated callback 안에 둔다. 회수는 exact grant와 별도 revoke정책으로 고정scope를 보존하며 새 source_read credential만 막는다. 동일 command/hash는 현재 HUMAN 권한 확인 후 원 저장 receipt와 대조해 재발급/기한연장 없이 반환한다. source-read-records는 OWNER 원문과 VIEWER metadata를 분리한다. 아직 route·SQL/basis함수·보호 exchange/permit/report·UI가 연결되지 않아 실제 원자성/저장/권한/사용가능 완료는 아니다. 후속 제한 코드 작성 승인은 AV3-PMO-A3-LOCAL-IMPLEMENTATION이며 아래 최초 DESIGN_ONLY 문구를 actual 허가로 사용하지 않는다.

N1 순수 codec/서명 verifier만 후보 작성됐다. readSourceReadRequestV1/readSourceReadScopeV1/readSourceReadPermitV1·readSourceReadReportV1와 별도 purpose verify는 자료형/hash/서명 일치만 검사하며 서버 현재권한/실OS/Agent 허가가 아니다. 아직 HUMAN/connector routes·credential/SQL·UI11 소비는 미구현이다. r2 hash는 그대로 보존하고 AV3-PMO-A3-LOCAL-IMPLEMENTATION의 제한 작성 범위만 적용한다.

상세 r2는 sourceRootRef의 전체 snapshot hash를 서버가 확인하고 원 pathHint UTF-8 hash를 scope에 결박한다. 새 관측 token만 받는 별도 /permit이 정확 경로를 전달하며 기존 OWNER API/상태조회 권한은 넓히지 않는다. connector는 scope/path hash·현재 결박을 검증해 단일 root 입력으로만 소비한다. 보고 주장 시각의 순서·30초 오차/관측 창과 서버 receivedAt·기한 무관용을 분리한다. 이 추가 endpoint/시각 규칙도 문서 설계이며 구현/실행 승인 아님.

별도 SOURCE_OBSERVE_READ_ONLY의 HUMAN 요청/회수·host proof 교환·불변 report/조회는 [SOURCE_READ_OBSERVATION_A3.md](SOURCE_READ_OBSERVATION_A3.md)를 따른다. 2026-10-17 PMO 결정은 상세설계 기준만이며 새 endpoint/op/credential·SQL·native/실소스/Agent 실행 승인이 아니다. 기존 REGISTRATION_STATUS_ONLY·grants=[]·A-1 SourceScope/dispatch false와 A-2R USER_DECLARED/UNVERIFIED는 유지한다. 첫 관측은 별도 READ_ATTRIBUTES/nonrecursive FILE 계약으로 구분하고 보고 수신만으로 실OS/기준선을 승격하지 않는다.

## A-2R 소스 등록부 계약 — 위치 선언만
- 새 project command saveSourceRoot/reviseSourceRoot/revokeSourceRoot. 등록/개정 payload={declaration,baseRef,reason}, 철회={baseRef,reason}; 등록baseRef=null/target=null/expected0, 나머지는 정확 ref와target/expected 일치. declaration은 hostLabel/displayName/pathHint/reason/connectorId(null|UUID)이며 원문 경로의 실행/정규화0.
- 현재 로그인·OWNER/client/control세대·최근재인증·명시AUTO 정책·DENY우선·기한·동일명령/hash·CAS/감사를 검사한다. REQUIRE_APPROVAL은 소스op 소비 미연결412, 기존 승인을 몰래AUTO로 바꾸거나 승인참조를 수용하지 않는다. 실제사용자 정책 자동부여0.
- GET /api/v1/projects/:pid/source-roots?limit/cursor, /source-roots/:id/versions/:n. 현재멤버십을 매번 확인; OWNER만 snapshot/기록·보호참조, VIEWER는 ref/displayName/status/authority/readiness/headVersion/rawAllowed=false/executionAuthorized=false만. 조회기한/권한 실패는 원문으로 대체하지 않음.
- snapshot={declaration,status:DECLARED|REVOKED,authority:USER_DECLARED,readiness:UNVERIFIED,reason}, ref.contentHash는 canonical SHA256. 응답 receipt는 status=SOURCE_ROOT_VERSION_STORED·snapshot/previousRef/protectedRef=db-source-root-version:<id>:<version>을 결박. 철회는 새 버전으로 이전선언 보존, 철회 뒤 기존root 개정 거절.
- 등록/조회는 파일 grant·신뢰/관측·검증baseline·Agent 실행/전송·기존환경 자동확장 아님. 실제DB/served 검증 여부는 WORK_STATUS exact증거를 따른다.


## FN08-CONTRACT-A1 v1 — 2026-10-17 직접 승인 범위

신산님 직접 승인(11:20:10Z, PMO 전달)은 아래 계약·코드·격리 합성 검증만이다. 정식DB/실source/Agent·OShelper/서비스 변경은 제외한다. 구현은 contracts/runtime/*-v1.ts와 apps/connector/runtime/receipt-inbox.ts다. 기존 inspectDispatchPreconditions의 false 차단/기존 reason은 신규 v1과 아직 미연결인 구 소비자의 결과이며 해제하지 않는다.

- SourceScopeV1: {sourceRootRef,mappingRef,observationRef,baselineRef,targets}. ref는 기존 id/version/contentHash, mappingRef만 null 가능하다. roots 최대200개·전체 targets 합계 최대200개, 모두 FILE·recursive=false·access READ 또는 WRITE다. relativePath는 NFC 원문·UTF-8 1~1024bytes·segment 최대255 UTF-16, 상대 slash 구분만 허용한다. 빈/./../absolute/역slash·제어/ADS·glob/%·Windows 예약명·뒤 공백/점은 거절한다. 같은 root id/대소문자 접힘 경로 중복도 거절한다. 정규화해 조용히 고치지 않는다. 실제 case/alias/link/host·mapping/권한 관측은 이 문법 검사로 증명하지 않는다. DIRECTORY/recursive는 후속 미지원이며 전체 설계에서 삭제한 것이 아니다.
- DispatchEnvelopeV1: schemaVersion=1, commandId(UUID), issuedAt/expiresAt(정규 UTC ISO 밀리초), executorRegistrationRef, context(§12.3의 정확 필드), operation, payload, envelopeHash. TTL은 양수·최대2시간, nowMs는 유한 safe 정수이며 [issuedAt,expiresAt)에서만 신규 수신한다. unsigned 전체 canonical UTF-8 SHA256가 envelopeHash이며 unsigned bytes 최대2MiB다. 배열/필드/상한을 먼저 검사하지만 이미 생성된 JS 객체·Proxy/VM 메모리의 강제 보호는 아니다.
- 연산/참조 payload는 START_SESSION {contextBundleRef,optionsRef}, SEND_INSTRUCTION {sessionBindingRef,instructionRef,partsRef}, REQUEST_STOP {sessionBindingRef,stopScopeRef}만 허용한다. 원문/임의 shell·argv·Secret·unknown 필드는 금지한다. JSON 수신자가 parseWireJson의 중복 키 거절을 사용해야 하며 이미 parse한 객체로 원 wire 중복을 소급 탐지할 수 없다.
- DispatchReceiptV1: schemaVersion=1,key={projectId,executionId,executionGeneration,commandId},envelopeHash,state,reasonCode,duplicate,recordedAt,executionAuthorized=false,dispatchPerformed=false. state는 RECORDED/DELIVERY_REQUESTED/DELIVERY_CONFIRMED/UNKNOWN/REJECTED다. RECORDED는 UNVERIFIED_INBOX_ONLY, DELIVERY_*는 ADAPTER_REPORT_UNVERIFIED 이유만 허용하며 **구조화 주장이지 실제 전달 증거가 아니다**. A-1 수신함은 DELIVERY_*를 만들지 않는다. 다른 실행/key/hash·완료/허가 true를 거절한다.
- receiveUnverifiedEnvelope(root,limits,input,expected,nowMs)는 caller의 context/executor ref snapshot만 대조한다. 이것은 서버 현재 인증/제어·실행허가 확인이 아니다. limits는 필수 maxBytes(1~1GiB),maxEntries(1~1024); 기록1개는 최대4096bytes다. root는 caller가 별도 승인/소유확인한 기존 절대경로여야 하며 root/ACL/키를 자동 만들지 않는다. 입력 key/hash/수신시각만 저장하고 source 상대경로/본문/지시/Secret은 저장하지 않는다.
- 수신함 key의 SHA256 이름.json, exclusive receive.lock으로 직렬화·한도/중복 확인 후 wx 생성→write→file.sync→close한다. 같은 key/hash는 기존 RECORDED를 duplicate=true로 반환, 다른 hash는 REJECTED/RECORD_CONFLICT, 부분/변조는 UNKNOWN/RECORD_UNREADABLE로 원파일 보존한다. 미확인 기존 lock은 UNKNOWN/INBOX_BUSY이며 자동 stale 해제0이다. 기록/저장정체성 실패는 UNKNOWN/STORAGE_UNAVAILABLE·후속 side effect0, 상한은 REJECTED/LIMIT_REACHED다. 옛세대 expected 불일치는 REJECTED/CONTEXT_MISMATCH, 만료는 ENVELOPE_EXPIRED 거절이다.
- A-1은 read-only 파일정체성/realpath/link 검사와 파일 flush·일반 프로세스 재시작만 확인한다. OS 소유/ACL·악의적 같은 계정/경로경합·directory metadata 전원손실의 보호와 서버ACK/전체 exactly-once는 **미검증/미연결**이며 실제 dispatch를 막는다. UNKNOWN은 사람이/후속 검증이 상태를 대조하기 전 새 turn/재실행으로 바꾸지 않는다.


compile-only 새 사실: NONZERO/status1/signalnull/pid54156/118ms, stdout153/hashed153/SHA256d743ab047147d842d3f86285e194e9c42a9ff6f9032fea162913c45108562b84/잘림false·stderr0, 허용source CS진단0이다. 이는 이번 compiler 비0 종료만 증명하며 실제 diagnostic/root cause UNKNOWN, 원문 미보존이다. source629의 최초실패 원인을 소급확정하거나 compile/native/handshake PASS로 올리지 않는다. 추가실행0·생성2파일/3dir exact정리/독립잔여0, 보호범위 불변.

FN06 내부 QA 진단 준비(공개 API 변경 아님): receipt는 유한 own data status/signal/code/pid/elapsed·출력별 byte/prefix SHA256/hashedBytes/truncated, 허용source CS번호/severity/line/column 최대32만 보존한다. 누락/비정형·Proxy/접근자는 UNKNOWN, 원문/message/stack/개인경로0이다. 반환되지 않은 성공 stderr/pid/signal은 UNKNOWN이며 진단 위조/내용의 진정성이나 실행권한은 보장하지 않는다. 별도 ANVIL_COMPILE 7값·AV3-PMO-FN06-COMPILE-RECEIPT-01/exact SHA/고정host39111ada·compiler46809206/유한 새 창은 compile1만 허용하는 로컬 입력 대조이고 PMO 실행 권한 자체가 아니다. 기존 handshake6값/소진 run 혼용은 거절하며 compiler argv/timeout/buffer는 불변, 성공/실패 모두 helper/native/Job0으로 종료한다. 실제 시작은 별도 PMO 지시 전0이다.

A 최초실행의 관측 경계: QA_COMPILE_FAILED는 csc 호출 실패만 알려주고 원래 compiler 상태/timeout/정제진단 receipt는 현 소스에 없다. 이번 원인을 특정한 오류코드로 꾸미거나 compile/handshake/OS PASS로 올리지 않는다. helper/native/Job/stdio가 시작되지 않아 실행 뒤 종결/Job0 gate는 NOT_EXECUTED이고 등록 파일정리·보호범위 불변만 별도 확인했다. 추가 실제시도/진단계약 보완은 다음 PMO 지시 전 수행하지 않는다.

A 관측 실패 계약 보완: helper NDJSON은 pipe data 이벤트 경계와 무관하게 완성된 frame별8192바이트로 수집하고 전체512KiB/256개를 넘으면 sticky 실패한다. Job 조회 예외는 raw process cleanup 시도를 막지 않으며 rawCleanupAttempted/Failed·jobObservationFailed를 분리한다. strict 성공은 helper exit0/양쪽EOF·native exit0/실제Job0·raw cleanup 실패없음/관측실패없음·두메시지/기한 및 gate를 모두 만족해야 한다. 이 조건은 후보 소스에만 있고 compile/OS PASS가 아니며 마지막 Jobhandle 자동종료만으로 cleanup 확인을 대체하지 않는다.

A 실행 전 내부 계약 보완: root는 신규 D:\tmp\anvil-v3-fn06-handshake-0161-qa, 하위home/work/profile/AppData/{Roaming,Local}/temp/bin/diagnostics이며 보호 ACL은 새 root/current user+SYSTEM만 설정한다. 초기Job은 익명·비상속/상한1/이탈OFF·JOB_LIST 초기부착 실패fallback0, 자식상속은stdio3뿐이다. raw handle 보유는 조회 실패 정리와 분리하고 exact native TerminateProcess만 허용하며 일반 TerminateJobObject는 없다. native15초EOF/18초exact종료/20초관측은 monotonic감시 목표이고 지연·관측실패를 성공으로 바꾸지 않는다. 파일 단16MiB/합계64MiB/1024항목/depth8은 주기 관측·거절이며 disk quota가 아니다. Node가 결과를 입력받아도 native source/실제 pid·start·exit/Job0·helper exit와 gate를 모두 대조하기 전 제한 smoke도 성공이 아니다. OS 실패 시 강제삭제 대신 정확 소유/정리 미확인을 보존하며 API/DB/Agent지원 계약은 바꾸지 않는다.

FN06 handshake QA 내부 부분 준비(공개 API/실행 허가 아님): `CodexHandshakeQa`의 WRITE_STDIN/CLOSE_STDIN/STOP_EXACT_PROCESS는 메모리 요구만 반환하고 실제 IO/회수를 수행하지 않는다. 고정 initialize 결과 schema·정확 id/home/Windows 뒤 initialized를 한 번 준비하며 그 ACK는 요구/주장하지 않는다. stdout128KiB/stderr32KiB 내 accepted byte/digest만 보고하고 초과/잘못 프레임/시간 역행/15초 미완료는 UNKNOWN,18초 미종결/미수거도 UNKNOWN이며 실제 종료 요청은 unobserved exact process에만 한 번이다.20초 exit미관측은 별도 표식이다. 양쪽 EOF와 exit0가 있어도 PROTOCOL_COMPLETE는 입력된 관측의 합치만 뜻하고 OS/Agent/서버 허가 증거가 아니다. actualExecutionVerified=false·executionAuthorized=false·workAccepted=false·ownership UNVERIFIED는 고정이며 native 소비자는 미연결이다. 전용 Job 초기 결박/추가자식 제한·raw handle 선기록/정리와 자동kill 정책은 별도 준비/승인·실제 증거를 필요로 하고 TerminateJobObject/기존 합성helper 변경은 포함하지 않는다.

FN08 내부 준비 보고(공개 계약 아님): inspectDispatchPreconditions(value,expectedSnapshot)는 §12.3의 명시 필드·VersionRef와 확정된 SourceScopeV1 문법/정확 일치를 비교하고 INTERNAL_PRECONDITION_REPORT·executionAuthorized:false/dispatchPerformed:false를 고정한다. 빈/부적합 sourceScopes는 SOURCE_SCOPE_INVALID 또는 EXPECTED_SOURCE_SCOPE_INVALID, 두 유효 범위/ref/READ·WRITE 차이는 EXPECTED_SNAPSHOT_MISMATCH로 거절한다. caller의 expected snapshot·ref·성공 주장과 구조 일치는 인증/현재성·실경로/OS 권한의 근거가 아니다. A1의 구 소비자 호환 표식 SOURCE_SCOPE_CONTRACT_UNRESOLVED와 SERVER_VERIFIERS_NOT_CONNECTED·전체 미검증 검사 목록은 문법 검사만으로 해제하지 않는다. 이 표식은 공통 문법 자체가 미정이라는 뜻이 아니라 구 소비자의 실제 v1/서버·OS 범위 계약 소비 미연결을 나타낸다. 별도 DispatchEnvelopeV1의 수신/영속 중복 검사는 이 내부 보고가 대신하지 않는다. 미래 소비자는 structuralChecksPassed를 실행/승인 receipt로 사용할 수 없다. 원문/비밀/실경로는 결과 이유코드에 반사하지 않는다.

QA-02에서 실제 확인한 것은 고정 synthetic PREPARE/RESUME/OBSERVE/STOP/FORCE와 미resume CANCEL_PREPARED·정상EOF/idle·native UNKNOWN 뒤 RESUME/새세대거절의 한정 경로다(bbb239dd·actual1 PASS). 잘못된 reference 거절과 불응합성만 명시 FORCE, 정확취소/종료·원runtime/relay 보존을 확인했으며 실제 Agent grant·공개 API/DB 변경은 없다. 16KiB 초과/부분EOF native 실제 음성·Ref 이전 fault·실제 만료와 EOF 뒤 독립 Job0은 미검증이며 순수검사로 OS PASS를 대신하지 않는다. QA-01 C0/I3/M2 및40744 보존미확정은 소급 해소하지 않는다.

QA-02 준비 계약은 QA-01과 별개로 run8c10a7c8-bfa8-458c-a24b-1f0578119407·04:25~04:55Z·현재19960/26052·127.0.0.1:3830 소유19960을 고정한다. 공개 API·DB grant 변경이 아니라 고정 합성 helper IPC 준비다. UTF8 payload 최대16384바이트(구분자 LF/CRLF 별도), 누적 초과/잘못된 UTF8/중복 key·잘못된 응답 상태는 sticky UNKNOWN이다. 정상 빈 EOF는 미resume exact 취소/실제 종결로 이어질 수 있으며 부분프레임 EOF·소유 미확인은 완료가 아니다. Node decoder/serializer는 순수검사, native byte/키 검사 및 EOF/idle/UNKNOWN 실제 경로는 아직 미실행이다. Ref 이전 fault는 일반 명령 입력으로 열지 않는다. 원 QA-01 REWORK/기한종료/보존UNVERIFIED는 유지하며 새 창도 actual 승인 전 실행할 수 없다.

FN08 한시 QA 보완 계약: 최초 승인 run2897e501-cbe9-491c-bd72-28b996f0499b와 2026-10-17T03:31:53.000Z~04:01:53.000Z를 고정하고 최소120초 남지 않으면 새 준비를 거절한다. 원 Node40744/relay26052의 고정 시작시각·실제 존재와 3830 소유를 확인하지 못하면 생성/launch 불가다. `CANCEL_PREPARED(exactRef)`는 미resume retained handle·이미지/hash·생성시각·job/gen을 다시 확인한 본인 합성 준비에만 허용하며, 실제 종결·빈 job 전 PREPARATION_CANCELLED가 아니다. EOF/만료/Ref 이전 생성도 같은 안전 조건이다. UNKNOWN은 client/native에 sticky하며 새 PREPARE/세대·RESUME/일반 FORCE를 막고 정확 소유 준비취소만 별도 정리 경로로 남긴다. 이를 정상 관측·새 승인으로 자동 해제하지 않는다. 원 독립 C0/I3/M2 REWORK와 M2 Main Important 재분류, M1 line buffer 상한 잔여, 보완 후 native 컴파일/OS 실제 미실행을 구별한다. 제품 API·grant/DDL 변경은 없다.

FN08 승인A의 내부 QA 소유IPC 후보는 `PREPARE(spec)`→현재run/gen/hash/job/PID/시작시각의PREPARED→별도RESUME→OBSERVE/STOP와 명시불응합성전용FORCE다. 고정 `SYNTHETIC_WORKER`만 허용·임의shell/경로/Agent0, kill-on-closeOFF·Job은파일sandbox아님, 오류/관측공백은UNKNOWN이며 진단은별도타입·전체경로/commandline/환경0이다. 최초30분run만소비하며 public API/DDL·grant변경0이다. 실제3FAIL/conhost진단을보존하고 DETACHED 보정은콘솔I/O없는합성전용·actual미실행이므로 일반Agent/stdio 지원이나최종소유/회수PASS가아니다. 원Node보존UNVERIFIED로 추가실행gate는열지않았다.

## 2026-10-17 FN06 제한 신뢰 등록 — 승인된 구현 프로필

### Native HTTPS 제한 소비 — AV3-PMO-FN06-HTTPS-QA-01

단일 독립검수 C0/I2/M0 뒤 Main은 QA active 임대의 최초 전체deadline 상한·TLS stage전 타이머/신호와 메모리 소유 부분정리만 보완했다. 만료 후 정확 본인 정리는 유지하며 새로운 수명·실행 허가는 발급하지 않는다. 보완 뒤 순수집중7/unit190/typecheck PASS와 이전 e073 실제1PASS는 다른 증거다. 보완 후 actual·실제 OS 신호/부분쓰기 실패 재현·독립 재검수는 미실행이며 PMO 최종수용 전이다.

`TrustHttpsClient`는 기존 enroll/proof/exchange/status4개를 고정 HTTPS origin:3830/명시 공개 CA·hostname 검증으로만 소비한다. Cookie 없이 고정 Origin, status에만 Bearer, 자동 retry/redirect0, 요청/응답16KiB·전체10초, strict JSON·빈grants/실행권한false·유한 오류만 허용한다. 공개 API/저장 계약 변경이나 실제 Agent 연결이 아니다. QA launcher는 제품 loopback/config를 바꾸지 않고 승인 IP172.27.253.53:3830과 한시 TLS3복제/합성 UUID만 소비하며 stdin 제어는 HTTP route가 아니다. 최초전체deadline2026-10-17 12:29:30.227KST·정확root/소유/회수/정리 경계를 유지한다. e07312d3의 native/TLS/PG/동일 UI11 실제1PASS·본문유실 재발급0·정리0은 해당 부분만 증명하며 실제 AuthForm클릭/사용자 인수·영구PC·Agent 실행/비용/전체 FN06은 미검증·미완료다. 앞선2FAIL·cleanup 보완은 별도 이력이며 PMO 제한수용 전이다.

### HUMAN 현재 신뢰 조회 — AV3-PMO-UI11-TRUST-READ-01

UI11의 현재 부분 구현은 이 GET2와 기존 HUMAN3명령만 사용한다. 브라우저는 key/proof/exchange/credential 발급을 수행하지 않는다. 최초 pairing code는 등록 최초응답에서만 패널 local state로 표시하며 이동/닫기/인증상실/다른 상세 선택 시 폐기·저장소/URL/로그/실제code캡처0이다. 원command/정확 입력·별도승인 요청은 본인/client/project 메모리 버퍼에만 보존하고 유실 시 새명령/새등록 자동0, 확인/회수 직전에 현재 표시ref/지문과 fresh GET/기존 서버권한/CAS를 다시 검사한다. REQUIRE_APPROVAL은 UI11 요청→UI08 별도결정→서버 APPROVE 재조회·원명령 결박→별도전송으로만 소비한다. 실제 같은 Web 함수/API·PG와 합성 화면 근거를 구분하며 실제 사용자browser/Windows↔WSL/영구PC/Agent 연결 완료로 올리지 않는다.

승인된 GET은 `/api/v1/projects/:projectId/connector-registrations?limit&cursor`(기본50/최대200·그 외 query/배열 거절)와 같은 prefix `/:registrationId`(query 없음)이다. 현재 HUMAN session·프로젝트 OWNER/본인 requested_by/같은 client/현재 단독제어·유효 trust정책과 DENY우선을 검사한다. 현재 읽기가 확인/회수 쓰기 권한을 뜻하지 않으며 확인 가능은 별도 confirmConnectorRegistration 유효 규칙·최근 재인증/proof/current basis·기한을 모두 필요로 한다. GET은 원 명령 snapshot을 현재 상태로 대체하지 않고 기존43 등록/host·원 생성 receipt/scope/hash·SPKI 지문 무결성을 검수한다. no-store이며 도메인 명령/승인/감사/nonce/credential 쓰기0이다.

목록은 view `HOST_TRUST_REGISTRATIONS_ONLY`·items `{registrationRef,connectorRef,hostLabel,state,derivedExpired,expiresAt,proofedAt,revokedAt}`·hasMore/nextCursor/observedAt, 상세는 이 항목+projectId/connectorState/expectedHostFingerprint/observedHostFingerprint/scopeDigest/고정scope projection/현재 policyRef/createdAt/issuedAt/failedAttempts/credential `{issued,expiresAt,revokedAt,status}`/basis `{current,reasons}`/confirmation `{allowed,reasons}`/grants[]/executionAuthorized:false/observedAt만이다. 상세 ref/hash와 고정scope도 Web에서 대조한다. code/token/digest/credential ID·private/SPKI/nonce/서명/challenge/DSN은 응답에 없다. 현재 허가가 있으면 과거 정책·세대/기한/회수 사실을 불가사유로 표시하지만 권한을 복구하지 않는다. cursor는 기존 서명 codec·created_at/id keyset과 actor/client/project/정렬/limit/현재정책ref·기한/제어세대·최대30분 및 정책기한 상한에 결박한다. 새schema/SQL/기존write 계약 변경0. UI11 화면/일회 코드 메모리·명령 유실/이동/승인 연결의 실제 검수는 후속이며 GET 부분 검수와 구분한다.

후속 PMO 허용44로 DB protocolVersion 숫자1 방어층을 교정했다(공개 API 계약 확대0). dba582b6 exact 실제 app DB6종 거절/숫자1 정상과 HTTP 등록·서명/HUMAN 비교/새 nonce/일회 발급·상태조회/재발급409/회수1 PASS, 이전43 불변·QA45표0이다. 독립 원C0/I0/M1에 Main 수정/검증을 연결했으며 아래 미수정·후속44 없음은 이전 시점 기록이다. 실제 Windows→WSL HTTPS·Agent/영구 등록·UI11 신뢰 화면은 미확인/미완료이고 제한 수용은 PMO 판단이다.

마지막 독립 검수는C0/I0/M1이다. Minor1은 적용43의 DB protocolVersion NULL/문자열1 방어층이며 HTTP 계약은 정확8필드·숫자1을 유지한다. 공개 API 우회·추가 발급·권한 확대는 확인되지 않았고 SQL SELECT 비교만 검증했다. 미수정 사항은 WORK_STATUS에 공개했으며 적용 SQL 변경/후속44 작성·적용0, 이번 제한 기능의 최종 부분 수용은 PMO에 남긴다.

PMO `AV3-PMO-FN06-TRUST-QA-01`은 아래 §12.2의 완성형 등록을 열지 않고 별도 `kind:HOST_TRUST_REGISTRATION` 분기만 허용한다. 입력은 `kind,hostLabel,expectedHostFingerprint,policyRef,expiresAt,reason`이며 기존 7필드 parser는 불변이다. 등록은 최대10분, challenge 최대2분, 증명 실패 최대5회, credential 최대15분/현재 정책 기한 이내이고 자동 갱신0이다. credential 목적은 `REGISTRATION_STATUS_ONLY`, 프로젝트/환경/자료/파일/실행 grants0이다. fingerprint 문자열만으로 host 증명/Agent 준비 완료를 주장하지 않는다.

암호 계약은 P-256/SHA256·SPKI DER base64url·공개키 SHA256 지문·IEEE-P1363 64byte 서명이다. 서명 대상은 정확 `protocolVersion,installationId,registrationId,scopeDigest,publicKeyFingerprint,serverNonce,clientNonce,expiresAt` 8필드의 canonical UTF-8이며 두 nonce는 각각 CSPRNG32byte다. 다른 설치/범위/nonce·만료/재사용/형식 변조는 거절한다. Windows helper는 CurrentUser DPAPI만 쓰고 private/token은 stdin/프로세스 내부에서 처리하며 stdout/argv/로그/Git·평문 fallback0이다.

서버 후속 구현 범위는 기존 프로젝트 명령 `registerConnector/confirmConnectorRegistration/revokeConnector`의 현재 HUMAN 재인증/단독 제어/명시 정책/정확 버전·기한·감사/필요 일회 승인 소비, POST `/api/v1/connectors/enroll`(공개키 포함), POST `/api/v1/connectors/registrations/:id/proof`, POST 같은 prefix `/exchange`의 CHALLENGE/ISSUE, GET `/api/v1/connectors/:id/registration-status`뿐이다. 최초 key proof 뒤 HUMAN exact 지문/범위/버전 확인, 새 nonce proof 뒤 일회 발급한다. 발급 응답 유실은 `ALREADY_ISSUED_RECONCILE`; 두 번째 token/평문 조회/자동 새 키·등록0이며 정확 HUMAN 회수·새 등록 또는 만료로만 정리한다. 기존 자료/명령 API는 이 credential을 거절해야 한다. §12.2의 commands/receipts/observations/heartbeat와 실제 Agent/OS 소유 실행은 이번에 활성화하지 않는다.

현재 순수 입력/서명·Windows 보호저장 상호운용과8a7cb985/d8ec41e6/4ecb2e39/0282713e의 WSL HTTP 주입/정식 PG 신뢰 등록 부분을 확인했다(WORK_STATUS). 새43 적용·시도5회/등록 만료·HUMAN3연산 각각 별도 승인 소비, 현재 세션/정책·자격/제어 세대·만료·purpose·첫 발급 본문 미사용 재확인과 정리45표0은 실제 실행 범위다. Windows→WSL HTTPS/영구 설치·실제 Agent 및 클라우드 정밀 조건은 미검증이며 전체 연결/배정 준비로 승격하지 않는다.

후속 교환의 내부 상세: CHALLENGE 요청도 최초 HOST_PROOF serverNonce·같은 등록/설치/범위/지문에 새 clientNonce와 원 등록 expiresAt를 결박한 정확8필드 서명을 먼저 검사한다. 최초 clientNonce 재사용/서명 불일치는 새 challenge를 만들지 않는다. 동일 유효 preflight는 동일 미소비 challenge만 재조회하며 임의 clientNonce로 먼저 교환 상태를 잠그지 못한다. ISSUE는 별도로 새 serverNonce와 그 clientNonce에 결박한 최대2분 challenge만 소비한다. 이는 기존 승인된 fresh-nonce 절차의 위조/선점 방지 구현 상세이며 새 자료/실행 권한을 추가하지 않는다. 실제 구현/검증은 후속이다.

UI08 소비 검증36fa3e51: 요청/결정/후보 commandId는 서로 다르고 각 응답 유실의 재확인은 해당 원 command 그대로다. 현재 서버 APPROVE·basisCurrent·정확 scope/payload/hash/정책·대상/기기/제어·기한을 대조해 ref만 결박하며 별도 저장 전 소비하지 않는다. 이미 소비한 원 command 재확인은 정확 requestHash를 요구하고 다른 내용·명령에 재사용하지 않는다. UI08에서 실제 확인한 소비max1·outbox0과 아직 미구현 FN12/실제 Agent를 구별한다. 새 공개 API/지원 연산/정책 허가는 추가하지 않았다.

UI08은 기존 approvals 목록/상세 GET과 requestApproval/decideApproval 명령만 소비한다. 브라우저 요청 초안은 후보 commandId·payload hash/정확 targetRef·현재 policyRef/주체/client/세대·기한·위험5종/복구를 고정한다. 서버 조회의 APPROVE와 정확 요청이 일치한 때만 원 후보 command의 approvalRef를 결박하고, 별도 사용자 후보 저장 전 소비/실행하지 않는다. 요청/결정 응답 유실에는 원 명령을 그대로 재확인한다. 공개 계약·지원 연산·데이터 schema의 추가/완화는 없으며 UI08 전체 연결은 후속 실제 검증 전이다.

UI11 Web 소비는 승인된 후보 명령/GET만 사용한다. 작성 input과 pending commandId·현재 client/제어·정책·기한·이전 ref는 이동/프로젝트 전환·응답 유실 후에도 보존하고 같은 명령만 재확인한다. 현재 정책 조회·최근 재인증은 서버의 최종 판정을 대체하지 않으며 AUTO/REQUIRE_APPROVAL 혼합은 우회하지 않는다. 문서-only/표시 변경과 실제 client/API·PG 검증 SHA747c6f37을 구분한다. 목록의 무결성 미재확인·후보 기한/누락·6미확인·현재 NOT_READY를 표시하며 저장으로 실행 범위를 확대하지 않는다.

FN06 후보 필터 kind는 정확 문자열 enum만 허용한다(배열·객체 coercion 거절400). 후보/정책 exact ref와 달리 아직 연결되지 않은 완성형 host/environment/source/Secret ref는 제공하면412로 거절하며 비어 있음을 가짜 ID로 채우지 않는다. 코드350b2e30의 실제 내부/HTTP·만료/회수·응답 단절 동일 명령 재확인 증거는 WORK_STATUS에 기록한다. UI11/실제 Agent 등록·키 발급·사용자 browser 인수는 이 계약/검증에 포함하지 않는다.

FN06 후보 전용 상세(AV3-PMO-FN06-CANDIDATE-API-01): 기존 PROJECT command의 registerConnection/saveEnvironment는 이번 구현에서 `{kind:CONNECTION_CANDIDATE|ENVIRONMENT_CANDIDATE,candidate:{label,...제공한 필드만},candidateRef:null|이전 정확 VersionRef,policyRef:현재 정확 VersionRef,expiresAt,reason}` 분기만 지원한다. 입력 누락과 명시한 빈 문자열/[]는 input에 그대로 보존한다. data.status=CANDIDATE_STORED는 후보 영속만 의미하며 data.candidate의 readiness는 항상 NOT_READY/executionAuthorized=false, 6능력의 measurement/controlLevel은 UNVERIFIED다. 문서 출처는 USER_REPORTED로 구분하고 실제 Agent 미실행을 숨기지 않는다. 완성형 ConnectionDefinition/EnvironmentVersion으로 반환/소비하지 않는다. 아직 연결하지 않은 실제 host/환경/source/Secret 참조는412이며 candidateRef와 현재 policyRef만 실제 후보/정책 버전에 결박한다.

후보 GET `/api/v1/projects/:projectId/connection-candidates?kind&limit&cursor`는 현재 회원만 사용하며 기본50/최대200·kind/actor/project/정렬/기한 signed cursor로 제한한다. 목록은 CANDIDATES_ONLY/NOT_RECHECKED·exact ref/label/kind/기한을 제공한다. GET 같은 prefix `/:id/versions/:version`은 후보 hash/원 명령 snapshot/서버 파생 상태를 대조해 불변 구버전을 조회하며 현재 기한 경과를 별도 표시한다. 새 실행 허가가 아니고 완성형 목록과 구별한다. 새 저장은 최근 재인증·현재 단독 제어·명시 AUTO/REQUIRE_APPROVAL 정책과 후보 CAS를 검사한다. 일회 승인은 기존 업로드 분기를 유지하며 이 두 후보 저장 연산만 추가 소비한다. 실제 host 등록/enroll/credential/Agent/서비스는 제외다.

FN03 단계 조회: `GET /api/v1/projects/:projectId/documents/stage-options?formId&formVersion&formHash`는 현재 회원에게만 정확 양식의 고정 적용본·노드를 반환한다. 응답은 projectId/formRef/applicationRef?/methodologyName?/items(stageNodeRef,nodeName,nodeKind,uses)/status(READY,NO_APPLICATION,FORM_NOT_LINKED)/observedAt이다. 자동 선택·방법론 변경은 하지 않는다. saveDocumentDraft.stageNodeRef는 null 또는 `{applicationId,nodeId}`이며 새 저장은 최신 실제 적용본/정확 양식을 요구한다. 문서 버전 조회는 당시 stageBinding(applicationRef,methodologyName,nodeId,nodeName,uses)을 함께 표시한다. 현재 적용 변경409·다른 프로젝트404·부재 노드/양식 불일치422·snapshot 무결성 실패503을 성공으로 바꾸지 않는다. 수정 제안은 기준 단계 그대로 선택하며 단계 변경은 별도 초안 저장으로 명시한다. 기본 null 문서와 기존 원문/확정 이력은 보존한다.

FN11 목록 GET projects/:projectId/approvals?status&targetId&limit&cursor는 현재 회원에게만 제공한다. status는 현재 관측의 PENDING/APPROVED/REJECTED/CHANGE_REQUESTED/EXPIRED/REVOKED/CONSUMED이며 기한/현재 정책·제어·OWNER 부재를 PENDING/APPROVED에서만 파생한다. 원 storedStatus·현재 관측 상태를 분리하고 자동 status UPDATE는 하지 않는다. targetId는 scope.targetRef.id의 정확 값 필터다(현 업로드 신규 대상은 null). 기본50/최대200·생성 시각/ID 내림차순, cursor는 actor/project/status/targetId/limit/기한에 결박한다. items는 id/currentVersion/storedStatus/effectiveState/operation/targetRef/scopeDigest/expiresAt/createdAt/integrity=NOT_RECHECKED이며 본문·위험 설명은 상세 명시 조회에서만 연다. hasMore/nextCursor/observedAt을 제공하되 시각/정책 변경을 포함하는 고정 전체 snapshot이라 주장하지 않는다. 실행 허가/소비가 아닌 읽기다.

FN11 일회 소비 후속(동일 call_0a529c010d3e4c04be861bafa31071f9): 현재 uploadArtifact header의 approvalRef={requestId,decisionId,scopeDigest}만 연결한다. REQUIRE_APPROVAL 정책이면 현재 사람/기기/세대·정확 후보 commandId/대상/버전·canonical payload hash·같은 요청의 APPROVE 결정·현재 정책/기한을 검사한다. 자동 정책에 불필요한 승인 참조나 임의 승인=true는 허가가 아니다. 소비는 서버 commands.id와 묶고 command/authorization receipt/consumption/audit/파일 metadata/요청 version3-CONSUMED를 같은 DB transaction에 저장한다. 원문 바이트/hash 검사 실패는 소비0이다. 미소비 만료·거절/수정요청·현재 DENY/회수는 거절한다. 소비된 같은 명령은 승인 만료 뒤라도 현재 정책/제어 유효·정확 기존 requestHash인 경우에만 이전 결과/파일 무결성을 재확인하고 새 업로드/소비0이다. GET 승인 상세는 검증한 consumption(id,commandId,serverCommandId,requestHash,scopeDigest,policyRef,consumedAt)을 분리하며 executionAuthorized=false는 GET 자체가 새 실행 허가가 아니라는 뜻이다. 다른 operation/환경/Agent 실행·기준 적용은 미연결이며 실제 적용/검증은 WORK_STATUS를 따른다.

FN11 사람 결정 후속(동일 call_0a529c010d3e4c04be861bafa31071f9): decideApproval envelope targetId=requestId/expectedVersion=payload.expectedVersion,payload={requestId,expectedVersion,scopeDigest,decision:APPROVE/REJECT/REQUEST_CHANGE,reason}이다. 별도 AUTO 결정 정책·현재 OWNER/client/control·서버 지정 requiredDecider·요청 기한/현재 정책/정확 범위를 검사한다. pending/version1에서만 결정1개와 현재 status/version2를 같은 transaction에 저장하며 최초 request snapshot/version1은 덮지 않는다. data={ref,status:APPROVAL_DECIDED,decision}; 다른 명령으로 반대/추가 결정409, 동일 명령은 기존 영수증이다. GET은 decision.ref/원 판단과 expired/basisCurrent를 별도 제공하고 현재 상태를 실제 결정/hash/명령 이력과 대조한다. 요청 status만 위장된 값은503이다. 승인/거절/수정요청은 소비/실행과 다르며 현재 executionAuthorized=false·소비 미연결412를 유지한다. 실제 검증/적용은 WORK_STATUS를 따른다.

FN11 승인 요청 최초 연결(직접 승인 call_0a529c010d3e4c04be861bafa31071f9): requestApproval envelope targetId=null/expectedVersion0,payload={details:ApprovalDetails}이며 별도 AUTO 요청 정책과 후보 uploadArtifact의 REQUIRE_APPROVAL/현재 제어·OWNER를 검사한다. 현재 원문 업로드 후보만 지원하며 actionScope targetRef=null/expectedVersion0·기존 본문 metadata payloadHash·baselineRefs/sourceScopes=[]/environmentRef/limitsRef=null·requestedSubjectRef=인증 HUMAN/userId/clientId·현재 controlGeneration이다. 원문 bytes는 이 요청에 넣지 않는다. 만료는 서버 시간 이후·현재 후보 정책의 기한 이내다. 위험5종/복구·한계의 비어 있지 않은 설명을 보존하고 증거 refs는[]만 지원한다. requiredDecider는 서버 OWNER 값이며 외부 입력으로 받지 않는다. data={ref,status:APPROVAL_REQUESTED,request}, 같은 명령 재확인·같은 후보 새 요청409. GET projects/:projectId/approvals/:id는 불변 request/requestRef와 currentVersion/storedStatus/effectiveState/observedAt/executionAuthorized=false를 분리한다. 현재 정책/제어가 달라졌으면 REVOKED, 기한 경과 EXPIRED로 표시하지만 자동 DB 이력 덮기0. 아직 결정/소비·UI08/실제 사용자 인수 미연결이며 요청 저장이 실행 허가가 아니다.

FN04 요청 출처 후속(동일 승인 call_d824c2536d1d42d89cbfe3ed0f38b8e3): sourceRefs는 기존 SourceRef의 DOCUMENT_VERSION(kind,id,version,contentHash), ARTIFACT/CONVERSATION/USER_INSTRUCTION(kind,id,contentHash) 최대200개를 정확 키/중복 없이 받는다. 저장/상세 조회 때 같은 프로젝트 문서 버전·원문 파일·대화 snapshot/hash를 재검사하며 USER_INSTRUCTION은 실제 메시지 종류도 일치해야 한다. ARTIFACT는 현재 원문 검사 가능한 UTF8 텍스트≤2MiB만 지원하고 격리/미지원 형식412·없는/교차 출처404·다른 hash409·형식/종류 위장422다. 출처 보존은 옛 지시의 현재 적용이나 Agent 전달/실행이 아니다. 앞의 []만 지원 문구는 이전 구현 시점 이력이며 실제 적용/검증은 WORK_STATUS를 따른다.

FN04 사람 영향 검토 저장 보완(동일 직접 승인 call_d824c2536d1d42d89cbfe3ed0f38b8e3): reviewChangeImpact envelope는 targetId=baseImpactRef.id/expectedVersion=baseImpactRef.version, payload changeRef/baseImpactRef/items/coverageGaps/reason이다. 최신 영향 CAS·별도 명시 연산 정책·현재 사용자/client/control을 요구하며 sourceKind=HUMAN_REVIEW/reviewer=인증 사람으로 새 영향 v+1만 저장한다. 모든 기존 targetRef를 정확히 유지하고 공백을 삭제하지 않으며 UNAFFECTED는 동일 프로젝트 실제 문서 DOCUMENT_VERSION 참조/바이트/hash 근거가 필요하다. 실행/시험 근거 연결은 아직412·추가 의미 검증을 자동 수행한 것으로 보고하지 않는다. data status=DESIGN_IMPACT_REVIEWED/ref/impact/activatedAsBaseline=false, impact에는 baseImpactRef/사람 판단 이유·근거·기존 inputs/requiresReview=true가 보존된다. 실제 근거 원문 조회가 의미 판단의 정답 보증은 아니다. 동일 명령 replay·옛 base409·근거 없는 판단/공백 삭제422·프로젝트 내 없는 근거404다. 변경 상세 GET은 limit 기본10/최대20,beforeVersion 선택으로 영향 버전을 내림차순 조회하고 latestImpactRef/hasMoreImpacts/nextBeforeVersion을 반환한다. 기존 요청/초기 영향 값·현재 기준은 바꾸지 않는다. 기준 활성화·승인·업무 재개·UI07는 이 저장 구현과 구분한다.

FN04 설계 변경 요청 초기 저장 보완(직접 승인 call_d824c2536d1d42d89cbfe3ed0f38b8e3): proposeDesignChange는 targetId=null/expectedVersion=0·payload beforeRef(AF02),afterProposalRef(실제 PENDING 문서 수정 제안 ID),reason,sourceRefs=[]를 현재 명시 정책 아래 소비한다. 추가 출처 연결은 현재412로 거절한다. exact 현재 head/confirmed/hash/최신 적합 검토·제안 base/미선택을 확인하고 변경 요청과 초기 기계 영향 v1을 원자 저장한다. data는 status DESIGN_CHANGE_PROPOSED/ref/change/impact/activatedAsBaseline=false이며 같은 command replay·새 제안 중복409다. GET projects/:projectId/design-changes/:id는 change/impactVersions/activatedAsBaseline=false/observedAt을 멤버에게 반환하며 원문/제안 바이트와 snapshot hash를 다시 확인한다. 계산은 전체 설계 버전 변경 가능성에 대한 보수적 참조 추적이며 최대8개 현재 계획/2000대상, 잘림/미연결/모호함은 coverageGaps다. 초기 items는 AFFECTED 또는 UNKNOWN만 가능하고 sourceKind MECHANICAL_TRACE/requiresReview=true/evidenceRefs=[]로 사람 판단·실행·시험과 구분한다. 사람 영향 검토/추가 버전·기준 활성화·업무 재개는 아직 미구현이며 초기 저장이 이를 허가하지 않는다.

UI06 계획 결정 화면은 저장한 planRef·검사된 현재 decision view를 고정한다. REVIEW는 5항목/종합 판단과 이유를 사람이 입력하며 미실행 기본값을 자동 적합으로 바꾸지 않는다. CONFIRM은 최신 적합/현재 준비조건 충족/별도 checkbox 확인 뒤 기존 confirmWorkPlan payload만 전송한다. 단절·형식 오류 뒤 같은 명령만 재확인하며 뒤늦은403으로 이전 미확인을 지우지 않는다. 응답의 ref/명령/검토·확정 ID와 activatedAsBaseline=false를 대조한다. 작성/검토/별도 확정/실행은 각각 다른 사실이며 실제 UI DB 인수는 별도다.

FN04 승인 보완(call_16ea05f2ca814a53bd83dc2b9945b898): `recordContentReview` targetKind=WORK_PLAN·targetRef·criteriaVersion1·5개 items(PLAN_SCOPE/PLAN_TRACE/PLAN_DEPENDENCIES/PLAN_TESTS/PLAN_RECOVERY)·outcome/reason을 별도 저장한다. 항목별 reason/evidenceRefs=[]와 정확 target/expected를 요구하며 AF04 문서 검토와 구분한다. `confirmWorkPlan`의 기존 payload `{planRef,reviewRefs}`를 유지하고 별도 명시 연산 정책·현재 OWNER/client/control·exact 현재 head/hash·최신 적합 계획 검토·현재 확정 AF02/AF04·최신 화면 적합 선택·업무/선행/검수 누락0을 다시 확인한다. receipt는 status CONFIRMED/confirmationId/reviewRefs/validation/activatedAsBaseline=false다. GET `projects/:projectId/work-plans/:id/versions/:version/decision`은 planRef/headVersion/confirmedVersion/criteria/contentReviews/confirmation/현재 validation/currentConfirmationValid/activatedAsBaseline=false/observedAt을 반환한다. 기존 버전 GET의 불변 DRAFT snapshot과 hash는 유지한다. 확정 이력은 사후 재검토/새 head에도 보존하고 현재 유효성과 분리한다. 별도 확정은 업무 실행이나 기준 활성화를 하지 않는다. 실제 적용/검증과 화면 연결 완료 여부는 WORK_STATUS로 구분한다.

격리 receipt UI 후속: postDocumentCommand가 현재 업로드 명령/metadata·artifactRef·검사 형식 전체를 대조한 응답에만 terminal 격리 ID를 전달한다. 단순 HTTP412 오류에는 이 ID를 전달하지 않는다. 새 domain 저장은 실행하지 않으며 원문 ID/입력 보존 뒤 명시 닫기가 가능하다. 자동 해제·삭제·재저장·미검증을 성공 처리하는 동작은 추가하지 않는다.

원문 격리 보완 직접 승인(call_4b87f841c5d64bea971a63fdd129f632): 새 uploadArtifact는 바이트/허가 검증 후 보호 원문을 그대로 보존하고 data.status=ARTIFACT_READY 또는 ARTIFACT_QUARANTINED와 artifactRef/inspection을 반환한다. 외부 APPLIED는 보관 명령의 완료이며 사용 가능이라는 뜻이 아니다. inspection은 policyVersion1,method=KNOWN_PATTERNS_RAW_BYTES,complete=false,state=SUSPECTED/NO_KNOWN_MARKER,reasonCodes(정해진3종)뿐이다. 압축·암호화·OCR·표현 변형의 전체 비밀 탐지는 하지 않는다. 같은 명령 재확인은 같은 artifact/status를 반환하며 일반 GET/문서·지식 소비는 격리412, 비회원404다. 이전 미검사 READY도 소비할 때 알려진 표식을 확인하며 발견하면 값 없는412로 차단하되 원문/상태를 자동 변경하지 않는다. 자동 해제·삭제·Agent 전달0, 사용자 원문이 오류 본문/감사에 포함되지 않는다. 현재 Web는 정확 격리 receipt를412로 구별해 후속 쓰기를 중단하며 단절 후 최종 상태/원문 ID 표시 보완은 후속이다.

FN05 검토/확정 후속은 기존 recordContentReview(targetKind=KNOWLEDGE)·confirmKnowledge(versionRef,reviewRefs,reason)를 사용한다. 현재 head/hash·현재 별도 정책·최신 ACCEPTED 내용 검토가 필수이고 검토만으로 확정하지 않는다. 조회의 contentReviewCriteria/contentReviews/confirmation/currentConfirmationValid는 실제 기록과 명령 receipt를 대조한다. CONFIRMED는 헌법 적용/Agent 전달이 아니며, 이후 보완 검토가 생기면 확정 이력은 보존하고 현재 유효성만 false다. 검색 status는 ACTIVE(기본: 제외되지 않은 현재 head)/PROPOSED/CONFIRMED/EXCLUDED이며 ACTIVE는 실행 활성화를 뜻하지 않는다. 서명 cursor의 조건 변경은400이다. UI10 연결은 후속 검증 전 미완료다.

## 2026-10-16 현재 구현된 FN11/FN03·UI06 연결

후속 PROJECT `confirmDocument`를 §9.4 그대로 `versionRef,formRef,reviewRefs`로 연결했다. 현재 OWNER/client/제어·명시 정책 뒤 현재 head/hash·원문/첨부 무결성·고정 양식 준비·실제 필수 내용/반복 필드·같은 exact 문서 최신 ACCEPTED를 검사한다. 응답은 기존 APPLIED receipt의 `data:{ref,status:'CONFIRMED',confirmationId}`이며 명령 replay는 새 확정 row를 만들지 않는다. GET version/statusHistory는 별도 CONFIRMED를 반환하고 후속 초안은 기존 확정 버전/원문을 보존한다. UI는 명시 checkbox/확정 요청을 분리하고 결과를 추측하거나 자동 Agent/작업을 실행하지 않는다.

저장 충돌 비교는 기존 list/current project control/getDocumentVersion/file GET만 사용한다. 확실한 saveDocumentDraft VERSION_CONFLICT409·같은 사용자/이전 명령에서만 최대4×50건 최신 목록을 읽고 정확 원문/hash와 대조한다. 양식/첨부/원문 형식·연결 자료가 같을 때만 사용자 선택으로 내 입력의 새 기준 초안을 준비한다. 새 save는 별도 사용자 동작이고 서버가 최신 expectedVersion을 다시 검사한다. 응답 미확인·제어 세대 충돌을 새 명령으로 우회하지 않으며, 복합 변경 수동 합치기·검토/확정 요청 자체의 대상 갱신은 미연결이다. 같은 UI 클라이언트 actual FN03/FN11 2 PASS와 화면 fixture14는 구분한다. 아래 confirmDocument 미연결 문구는 이전 관측이며 실제 browser↔DB·가져오기/제안/추적은 여전히 미완료다.

UI06 내용검토 작성 후속: 고정 문서/version/hash·양식 criteria1의 항목별 outcome/evidenceRefs[]/reason와 종합 outcome/reason을 기존 recordContentReview에 전달한다. 서버 exact 응답의 command/project/target/version/reviewRef/판단을 대조하며 검토는 confirmed/실행 상태를 바꾸지 않는다. 미저장/미확인 상태는 탭 상위로 보존하고 다른 로그인 사용자에게 숨긴다. 단절/409는 동일 명령만 명시 확인하며 자동 재요청/새 명령·정책 설정0이다. 검토 작성기를 닫기 전 신규/개정 편집 진입도 분리한다. 같은 클라이언트 actual WSL1·unit48·UI06 fixture10 증거는 구분하며 아래의 검토 작성 미연결 문구는 이전 관측이다. 현재 confirmDocument·충돌 비교/조정·추적 및 실제 browser↔DB는 미완료다.

UI06 작성/개정 후속: 현재 form 목록/고정 버전과 project detail의 current control을 조회한 뒤 명시 uploadArtifact→saveDocumentDraft를 호출한다. 신규는 targetId=null/expected0·선택 양식 ref, 개정은 기존 exact 문서/버전·양식·첨부/목차를 보존한다. 본문은 UTF-8≤2MiB이며 기존 일반 텍스트/Markdown 형식을 유지하고 새 작성 기본은 Markdown이다. 업로드와 저장의 commandId/receipt·project/target/version/hash를 각각 대조, 요청은 same-origin/no-store/redirect error/CSRF다. 중단·인증 만료·충돌의 입력과 미확인 명령은 보존하며 자동 새 명령/후속 저장/정책 설정·Agent 시작은 없다. 새 기준 비교/충돌 조정·검토 작성/confirmDocument·추적과 실제 browser↔DB는 아직 미완료다.

후속 PROJECT commands의 `recordContentReview`는 §15.2 입력으로 DOCUMENT만 지원한다. 명시 정책·현재 제어/문서 head/hash·원문 무결성·고정 form의 실제 항목/기준1을 검사하고 HUMAN 검토·receipt/audit를 원자 저장한다. evidenceRefs는 연결 전[]만, 임의 actor/Agent/다른 target은 거절한다. document GET의 contentReviewCriteria `{criteriaVersion,formRef,items:{criterionId,title,reviewCriteria}[]}`와 contentReviews `{ref,items,reviewer,sourceKind,reason,reviewedAt,serverSequence}[]`/reviewRefs를 반환하며 confirmed는 변경하지 않는다. UI06은 이를 조회하되 검토 작성 화면·별도 confirmDocument는 아직 미구현이다. 아래의 이전 reviewRefs=[] 관측은 후속 연결 전 이력이며 현재는 실제 기록된 정확 버전의 review ref만 반환한다.

아래의 넓은 계획 endpoint/연산은 구현 목록이 아니다. 현재 추가 연결은 다음에 한정되며 전체 FN03/FN11·UI06 완료를 뜻하지 않는다.

- GET `projects/:projectId/permission-policy`는 자동 생성 없이 configured/policy를 반환한다. PROJECT commands의 savePermissionPolicy는 current OWNER/client/controlGeneration·최근 재인증·정확 head와 명시 규칙을 요구한다. 본인 HUMAN/동일 PROJECT 자료 연산만, 없거나 DENY면 거절·REQUIRE_APPROVAL은 아직 소비 연결 전412다.
- POST `projects/:projectId/files`: `application/octet-stream` 원문과 `x-anvil-command`의 엄격한 PROJECT envelope(operation uploadArtifact,targetId null,expectedVersion0,payload `{mediaType,bytes,contentHash}`)를 받는다. 현재 인증/제어/명시 정책은 body 수집 전과 실제 쓰기 전에 확인한다. 실제 bytes/hash 일치·보호 경로 저장 후 data.artifactRef, 동일 명령은 현재 권한/실파일을 다시 확인한다. GET files/:id는 attachment/octet-stream·CSP/no-sniff·정확 바이트/hash 검증, 다운로드를 문서 실행/추출로 해석하지 않는다.
- PROJECT commands saveDocumentDraft는 §9.4 계약의 title/formRef/content/reason과 정확 target/expectedVersion을 받되 현재 stageNodeRef/importCandidateRef는 null, sourceRefs는[]만 지원한다. content.body·attachments는 같은 프로젝트 READY 원본, sections는 `{itemId,anchor:'line:N'}`. body UTF-8 텍스트/Markdown≤2MiB, 불변 버전/검사 결과를 data.ref로 응답한다. 내용 검토/확정·제안/소스 연결 전 참조는412다.
- GET `projects/:projectId/documents?limit&cursor`: 기본50/최대200, updated_at/id 내림차순 keyset. items `{id,title,headVersion,confirmedVersion,updatedAt}`·nextCursor/hasMore/observedAt. cursor는 문서 도메인·현재 사용자/프로젝트/limit·30분에 서명 결박하고 페이지마다 인증/프로젝트 참여를 재검사한다. 종류·단계·상태 검색은 아직 미구현이며 알 수 없는 query는400이다. 동일시각 전체 snapshot은 주장하지 않는다.
- GET `projects/:projectId/documents/:id/versions/:version`: 불변 title/formRef/content/hash/author/validation/statusHistory·현재 버전의 confirmed 여부. 현재 reviewRefs/proposalRefs/sourceLinks는 실제 연결이 없으므로[]이다. UI06은 원문 재수신 시 bounded 크기/해시를 검증하고 escaped 텍스트로만 표시한다. 원문/구버전 조회와 편집/내용검토·확정/추적은 구별한다.

상태: **P02 상세 계약 종료 대조 중 / 제품 실행 미검증**. 2026-10-16 Main 어울. 설계 r8 §9~10·계획 r7와 승인 P01 동작을 상세화한다. Node/Fastify·TD-02 전용 로그인·TD-03 정책을 §8~15에 상세화했다. 초기 작성의 후속 항목은 아래 상세 절을 함께 대조한다. P03의 코드 schema/정확 버전·명령/환경 실측과 각 FN 구현/실제 검수는 남아 있으며 문서만으로 제품 실행을 증명하지 않는다.

## 1. 소유권과 신뢰 경계

- 사용자/프로젝트/역할/단계/임무/명령/실행/문서는 Anvil이 발급한 ID다. Agent의 계정·session/thread/turn ID는 별도 외부 핸들이다. 외부 핸들만으로 프로젝트 자료 접근 권한을 얻지 않는다.
- 브라우저의 작성자·역할·권한 값은 증거가 아니다. 서버가 인증된 사용자·클라이언트와 프로젝트 권한을 대조한다. 화면에서 버튼을 숨기는 것만으로 권한을 구현하지 않는다.
- 실행기는 등록된 자신의 실행에만 관측을 추가한다. 사용자 승인·문서 확정·최종 완료 판정 권한을 Agent 결과에 부여하지 않는다.
- 문서·외부 응답의 문자열은 자료이며 사용자 지시나 실행 허가로 승격하지 않는다. 비밀/비공개 추론은 수집 대상에서 제외한다.

## 2. 변경 명령 봉투

| 필드 | 의미·검사 |
|---|---|
| `schemaVersion` | 계약 버전. 지원하지 않는 major는 거부하고 임의 해석하지 않음 |
| `commandId` | 클라이언트가 한 사용자 행동에 부여하고 서버가 검증·영속하는 중복 방지 ID. 재전달할 때 유지 |
| `idempotencyKey` | 전송 헤더 표현은 commandId와 동일한 값. 별도 재시도 ID를 새로 만들지 않으며 프로젝트/행위자/연산 범위에서 요청 본문 hash와 결박 |
| `projectId`, `operation`, `targetId` | 대상과 행위. 경로/본문 ID 불일치 거부 |
| `expectedVersion` | FUNCTION_WORK CommandContext와 같은 대상 편집 기준 버전. 충돌이면 변경 전후를 반환하고 덮어쓰지 않음 |
| `clientId`, `controlGeneration` | 인증된 세션과 활성 제어권 대조. 이전 세대의 새 명령 거부 |
| `baselineRefs` | 해당 임무의 목적/헌법/설계/계획/양식 버전·hash. 필요한 기준 누락·변경이면 준비 실패 |
| `approvalRef` | 필요한 경우 정확한 요청/범위/기준 hash/만료와 결박. 단순 승인=true 금지 |
| `payload` | 연산별 제한된 구조. 임의 shell 문자열을 공통 명령으로 허용하지 않음 |

인증정보·authoritative actor는 봉투의 신뢰 필드가 아니라 서버 인증 결과다. 사용자 클릭 시각은 진단값이고 유효기간·정렬의 최종 근거가 아니다.

서버 처리 식별은 `operationId`로 반환하고 같은 commandId의 재조회/재전달은 같은 operationId를 사용한다. `commandId` 생성 능력이 권한은 아니며 actorId 입력은 인증된 행위자와 다르면 거부한다. 위 명칭은 FUNCTION_WORK의 기존 계약을 유지하기 위한 정합 보완이다.

### 원자성·재시도

1. 권한/제어권·기준 버전·유효 승인·한도를 확인하고 명령·변경·전달 대기를 같은 DB 경계에서 저장한다. 저장 성공 전 실행기로 보내지 않는다.
2. 동일 key+같은 본문이면 기존 commandId/결과를 반환한다. 동일 key+다른 본문이면 충돌이며 두 번째 부작용을 만들지 않는다.
3. 전달 재시도는 같은 commandId다. 실행기는 durable 수신 기록으로 중복을 차단한다. ACK 유실을 새 실행 생성 사유로 삼지 않는다.
4. 파일 변경·외부 명령이 수행됐는지 불명이면 자동 재실행하지 않고 실제 상태 대조 대상으로 둔다. `exactly once` 분산 실행을 약속하지 않는다.
5. 승인 결정과 소비 기록은 경쟁 요청 중 하나만 성립해야 한다. 이미 결정된 동일 요청은 기존 결과를 보여주며 범위/버전 변경은 새 요청이다.

## 3. 관측·원문 수집

관측 필드: `schemaVersion`, `projectId`, `executionId`, `connectorId`, `executionGeneration`, `sequence`, `eventId`, `kind`, `observedAt`, `payload`, `payloadHash`, `artifactRefs`. 서버는 수신 시각·서버 정렬값을 추가한다. `payload`는 kind별 허용 필드로 제한하며 비밀 제거 후 저장한다. 원문 증거는 공급자가 공개한 내용만 보존한다.

- `(executionId, executionGeneration, sequence)`가 같고 내용 hash도 같으면 중복 수신이다. 같은 순번의 내용이 다르면 무결성 충돌로 기록하고 조용히 덮지 않는다.
- 실행기는 서버 영속 수신 ACK 이전 관측을 spool에서 지우지 않는다. ACK는 빠짐없이 연속 저장된 순번까지만 전진한다. 중간 누락을 뒤 순번 성공으로 숨기지 않는다.
- 큰 원문/첨부는 별도 hash·크기·접근 권한을 가진 자료 참조로 연결한다. 임의 경로/URL을 서버 파일 읽기나 외부 다운로드 명령으로 해석하지 않는다.
- 오래된 세대 관측도 회수/감사 목적으로 식별해 보관할 수 있으나 현재 실행/제어 상태나 새 writer 권한을 바꾸지 못한다.

## 4. 구별할 상태와 오류

화면 요청 저장→전달 대기→실행기 수신→도구 수행→결과 제출→총괄 검수→수용/보완을 구분한다. 도구의 completed 이벤트는 Anvil 결과 제출 증거이며 사용자 업무 완료 판정이 아니다.

도구 명시 거부·실행 오류·권한 승인 대기·사용 한도·전송 단절·관측 공백·원인 미확인·취소를 별도로 보존한다. 중지 요청→도구 종결→소유 프로세스/쓰기 회수 확인은 다른 사건이다. 회수 확인 전 교체 writer를 배정하지 않는다.

오류 응답은 `code`, `message`, `requestId`, `targetId`, `retryDisposition`, `details`를 가진다. details는 비밀 제외 구조이며 `retryDisposition`은 `same-command` / `reconcile-first` / `user-decision` / `not-retryable`로 구분하는 제안이다. 정확한 HTTP 상태·연산별 오류는 §8~15의 표를 따른다. 오류를 성공 응답/빈 목록으로 치환하지 않는다.

## 5. 다음 상세화

TD-01 결정 뒤 UI00~UI14 각각의 행동→조회/변경 연산, FN01~FN18 endpoint/핸들러→입출력·권한·오류·원자성·이벤트·시험 파일을 작성한다. 인증/한도/보존 정책의 사용자 결정과 연동하고 DATA_MODEL/FILE_MAP과 명칭을 대조한 뒤에만 P02 완료를 검토한다.

## 6. UI/FN 소비 관계 — 기술 독립 대조표

다음은 기존 업무 카드의 실제 소비 관계를 모은 것이다. endpoint/함수 구현이나 schema 확정이 아니며, 입력/출력의 세부 필드는 DATA_MODEL과 후속 연산 명세에 연결한다. 공통 변경은 §2, 조회는 프로젝트 권한·cursor를 적용한다. `actor`는 인증 결과다.

| 업무 | 연산과 핵심 입력→결과 | 반드시 보존할 실패 경계 |
|---|---|---|
| FN01 | createProject(목적·소스·참여자)→Project; listProjects(filter,cursor)→Page; getProject(id)→Project; confirmBaseline(items,evidenceRefs)→BaselineVersion | 목적 누락·타 프로젝트 접근·동일 생성·근거 없는 확인 |
| FN02 | saveMethodologyDraft(graph)→DraftVersion; validateMethodology(version)→Issue[]; confirmMethodology(version)→ConfirmedVersion; applyMethodology(version)→ProjectMethodology | 내장 원본 덮어쓰기·오류 그래프·기존 적용본 변경 |
| FN03 | importDocument(fileRef)→ImportCandidate; saveDocumentDraft(baseVersion,content)→DraftVersion; proposeDocumentChange(diff,reason)→Proposal; confirmDocument(version,reviewRefs)→ConfirmedVersion; getDocumentVersion(id,version)→Document | 파서 실패·stale 편집·제안 자동 적용·문서 지시 실행 |
| FN04 | linkTrace(fromRef,toRef)→TraceEdge; getTrace(designId,version)→TraceView; proposeDesignChange(before,after,reason)→ChangeRequest; analyzeImpact(changeId)→ImpactSet; activateDesignChange(approvalRef,planVersion)→AppliedBaseline | 미확인 영향·계획 미개정·과거 증거 유실 |
| FN05 | appendConversation(event)→SourceRef; saveKnowledge(entry)→KnowledgeVersion; searchKnowledge(query,cursor)→Page; buildTaskContext(assignmentId,budget)→ContextBundle; compareUnderstanding(bundleRef,response)→UnderstandingReview | 원문 덮기·제외 지식 재선택·필수 맥락 누락 은폐 |
| FN06 | probeCapabilities(connection)→CapabilityReport; startSession(contextBundle,options)→SessionRef; sendInstruction(sessionRef,instructionId,payload)→DeliveryReceipt; observe(sessionRef,cursor)→AgentEvent[]; requestStop(sessionRef,scope)→StopReceipt; submitToolDecision(requestRef,decision)→DecisionReceipt | 미검증 능력·권한 승인 미지원·인증 실패·회수 미확인 |
| FN07 | FN06의 정규화 계약을 두 번째 실제 도구에 적용; 계정 참조 변경은 연결 개정 | 기존 세션 가져오기·계정 변경으로 원본 변경 금지 |
| FN08 | dispatch(commandEnvelope)→DispatchReceipt; appendObservation(executionId,sequence,event)→LocalReceipt; syncObservations(executionId,afterSequence)→ServerAck; getExecutionFacts(executionId)→ExecutionFacts | ACK 유실 재실행·관측 공백·링크 경로 이탈·저장 실패 |
| FN09 | prepareAssignment(stageId,goal,outputs)→AssignmentDraft; confirmAssignment(draftVersion)→Assignment; bindResponsibleSession(assignmentId,connectionId)→RoleBinding; delegateSubtask(parentId,scope)→SubAssignment; reviewUnderstanding(bundleRef,review)→StartReadiness | 목적 누락·권한 확대·writer 충돌·이해 미확인 |
| FN10 | evaluateNext(projectId,currentResult)→NextAction[]; startStage(stageId,mode,boundary)→RunRequest; getQueue(projectId)→QueueView; applyLimitPolicy(policy)→PolicyVersion | 승인 지점 초과·미설정 무제한·생략 분기를 완료로 합류 |
| FN11 | authorizeCommand(action,target)→Allow/Deny/ApprovalRequired; requestApproval(scope,risks,rollback)→ApprovalRequest; decideApproval(requestId,expectedVersion,decision)→ApprovalDecision; consumeApproval(commandId,scopeDigest)→AuthorizationReceipt | 중복 소비·범위 변경·만료·행위자 권한 회수 |
| FN12 | submitResult(assignmentId,manifest)→SubmittedResult; evaluateResult(resultId,criteria)→ReviewDecision; classifyExecutionIssue(facts)→IssueClassification; requestRework(resultId,missingItems)→ReworkAssignment | 증거 없는 완료·미실행 PASS·정상 장시간을 idle로 오인 |
| FN13 | saveCheckpoint(assignmentId,state)→Checkpoint; requestStop(scope)→StopRequest; observeStop(executionId,facts)→StopState; reconcile(checkpointRef)→StateDiff; resume(reconciliationRef)→ResumeRequest | 요청≠정지·구세대 쓰기·재기동 자동 실행·완료 반복 |
| FN14 | prepareTransfer(roleRef,targetRef)→TransferDraft; getTransferManifest(id)→TransferManifest; compareTransferUnderstanding(id,response)→TransferReview; confirmTransfer(id,reviewVersion)→NewRoleBinding | 미지원 대상·정지 불명·맥락 부족·총괄 교체 사람 확인 누락 |
| FN15 | requestControl(targetActor,targetClient,reason)→ControlRequest; prepareControlHandoff(id)→HandoffSummary; acceptControl(id,summaryVersion)→ControlGrant; checkControl()→ControlState | 이중 제어·옛 탭 승인·미수락 권한 이전 |
| FN16 | createBackup(policy)→BackupManifest; exportProject(includeSource)→ExportManifest; validateRestore(backupRef,target)→RestoreReport; compareRestoreImpact(reportRef)→Impact; confirmRestore(impactRef,approvalRef)→RestoreResult | 원문/참조 누락·변조·키 부재·원본 무승인 덮기·자동 실행 |
| FN17 | publishImportantEvent(event)→NotificationRef; listNotifications(cursor)→Page; getPushSupport(client)→SupportState; registerPushPreference(preference)→Preference | 일반 진행 push·클릭만으로 승인·비밀 payload·지원 허위 |
| FN18 | 동일 서버 조회/명령·제어권 사용; 실행기 상태/안전 종료·패키지/업데이트 검증은 제품 경계 연산으로 후속 고정 | 별도 원본 DB·renderer 비밀·창 닫힘=작업 취소·자료 제거 |

| 화면 | 소비할 기능·조회/변경 동작 |
|---|---|
| UI00 | FN01 현재 프로젝트/권한, FN15 제어 상태, 공통 인증·오류·오래된 자료·cursor |
| UI01 | FN01 list/get, 요청/중요 결정 요약. 행 열기는 dispatch 아님 |
| UI02 | FN01 생성/기준선, FN02 적용본, FN03 import, FN06 도구/환경 준비 여부 |
| UI03 | FN02 초안/검사/확정/적용, FN03 양식/문서 버전; 제안은 FN09의 실제 결과일 때만 |
| UI04 | FN08 전달/관측, FN09 역할/임무, FN10 시작/모드, FN11 승인, FN13 중지/대조/재개 |
| UI05 | FN09 임무/관계, FN12 결과/시험/문제, FN13 현황/checkpoint·증거 조회 |
| UI06 | FN03 본문/버전/제안/확정, FN04 양방향 추적·3상태축·누락 |
| UI07 | FN04 변경/영향/계획개정/적용, FN11 일회 결정. 승인만으로 재개하지 않음 |
| UI08 | FN11 요청/결정/소비 상태, FN12 문제 분류·누락·다음 선택 |
| UI09 | FN14 인계/대상/이해/확인, FN13 정지·실제 상태 대조, FN06/07 검증 능력 |
| UI10 | FN05 원문/헌법/지식/검색/정정/제외·맥락, 명시 대상의 공유 승인 |
| UI11 | FN06/07 연결/실측, FN11 정책/결정, 실행기/대상 환경 분리 조회 |
| UI12 | FN15 요청/안전요약/수락·단일 제어, FN13 관련 실제 실행 상태 |
| UI13 | UI04/UI08과 같은 ID·서버 연산, FN15 제어 인수, FN17 알림/지원 |
| UI14 | FN16 백업/반출/복원 영향, FN10 한도/대기열, FN17 중요 알림. 보조 요약은 같은 원본 조회 |

추가 대조 사항: UI02 중간 저장·재개, UI03 목록/복사·노드 좌표, UI06 양식 조회/검토 결과, UI10 정정/제외/공유, UI11 환경/정책 편집, UI14 백업 정책 편집은 위 대표 함수만으로 충분하지 않다. 해당 카드의 조회/편집 명세를 후속 endpoint 표에 각각 포함해야 한다. 대표 함수 수만 세고 누락0으로 판정하지 않는다.

## 7. 상태 축의 공식 표시와 증거

| 축 | 저장 코드 → 표시값 | 다른 축과의 구분 |
|---|---|---|
| 업무 진행 | NOT_STARTED→시작 전, IN_PROGRESS→작업 중, REVIEW→검토, TESTING→테스트, REWORK→보완 필요, COMPLETED→완료 | 수행자의 제출/도구 이벤트만으로 COMPLETED 전이 금지 |
| 기능 사용 가능성 | IMPLEMENTED_VERIFIED→구현 완료·핵심 동작 확인, IMPLEMENTED_UNVERIFIED→구현했지만 동작 미확인, PARTIAL→부분 구현, NOT_IMPLEMENTED→미구현 | 화면/API/DB 일부·fixture 성공은 PARTIAL과 실제 미확인 범위를 보존 |
| 검증 결과 | PASS→통과, FAIL→실패, NOT_EXECUTED→미실행, BLOCKED→차단, NOT_APPLICABLE→해당 없음 | 범위/환경/근거를 반드시 연결. 실행 중은 실행 상태로 표시 |
| 수행자 제출 | COMPLETED, FAILURE_REPORT, INCOMPLETE, BLOCKED, CANCELLED | Agent가 주장한 결과이며 검수 결과 아님 |
| 검수 | ACCEPTED, REWORK, BLOCKED, NOT_EXECUTED | 검수자·조건별 근거/미검증·정확 기준/환경을 보관 |

r5·기존 양식의 ‘구현·미확인/핵심동작확인/부분’은 해당 공식 기능값의 약칭이다. progress 숫자 [0]/[1]/[2]는 현재 개발 문서의 요약 표기이며 제품 상태 enum과 혼동하지 않는다. 명령 전달/Agent 수행/중지 요청·실제 회수 상태는 §4처럼 별도다. 각 축을 한 done 필드로 합치지 않는다. 이 표는 데이터/표시 계약 명세이며 구현 파일·migration은 아직 없다.

## 8. 승인 A안의 HTTP·처리 경계 상세

상태: **P02 명세 작성 중**. Fastify가 아래 endpoint를 명시 등록하고 각 operation을 FILE_MAP의 소유 service 함수로 전달하는 구성이다. 임의 함수명 호출·동적 plugin 로딩·브라우저 shell 실행을 제공하지 않는다. 사용자/실행기 인증 방식은 TD-02 및 등록 계약의 별도 결정과 결박하며 실제 listener/API는 아직 없다.

| HTTP·경로 | 입력/결과·책임 |
|---|---|
| GET `/api/v1/session` | 인증된 Anvil 사용자/client·세션 유효 상태. 프로젝트 제어권을 자동 부여하지 않음. FN01 |
| POST `/api/v1/connector-registrations` 및 `/:id/decisions` | 최근 재인증·실행기 등록 관리 권한의 사용자만 registerConnector/confirmConnectorRegistration. 프로젝트 명령과 다른 설치 신뢰 범위, 원문 비밀 수집0. FN06/11 |
| POST `/api/v1/connectors/:id/revocations` | 정확 실행기·현재 버전/영향과 관리 권한을 확인한 revokeConnector. 실제 도구 중지와 별개. FN06/13 |
| GET `/api/v1/methodologies` 및 `/:id/versions/:version` | 생성 전 SYSTEM/허가된 USER_COMMON 카탈로그·정확 버전 조회. 프로젝트 전용본은 기존 project 경로/권한으로만 조회. FN02 |
| GET `/api/v1/forms` 및 `/:id/versions/:version` | 생성 전 내장/허가된 사용자 공통 양식 조회. 다른 프로젝트의 양식/산출물은 노출하지 않음. FN03 |
| GET `/api/v1/projects` | 허가된 프로젝트만 검색/필터·cursor/limit→Page<ProjectSummary>. FN01 |
| POST `/api/v1/project-drafts` | commandId·이름/목적·4단계 입력/현재 단계→DraftId/version. FN01. 문서 가져오기용 자료도 소유자 초안 범위에 귀속 |
| GET `/api/v1/project-drafts/:draftId` | 작성자 권한·버전·작성 중 입력/자료 참조. FN01 |
| PATCH `/api/v1/project-drafts/:draftId` | commandId·expectedVersion·단계/입력→새 초안 버전, stale이면409. FN01 |
| POST `/api/v1/projects` | commandId·확정 draftId/version·필수 목적/방법론 참조→Project/version·준비 필요 상태. FN01. 자료 귀속·초기 제어 등록과 원자적으로 연결하되 Agent 실행 없음 |
| GET `/api/v1/projects/:projectId` | Project·현재 기준·역할/제어·미완료/미확인 요약. FN01 |
| POST `/api/v1/projects/:projectId/commands` | CommandRequest→OperationReceipt. 아래의 명시된 사용자 명령만. FN11 공통 집행 후 해당 service |
| GET `/api/v1/projects/:projectId/operations/:operationId` | 명령 전달/처리·결과/실패·실제 실행 참조. 수신 확인 유실 시 조회하며 새 commandId로 재실행하지 않음 |
| GET `/api/v1/projects/:projectId/events` | 프로젝트별 server cursor·Last-Event-ID를 사용하는 이벤트 스트림/재조회. 실행기 로컬 sequence와 별도. 만료/권한 회수 후 전송 중단 |
| POST `/api/v1/project-drafts/:draftId/files` | 작성 중 가져오기 자료 업로드. commandId 헤더·draft version·형식·내용 hash를 서버 검증, 소유 초안에만 귀속. FN03 |
| POST `/api/v1/projects/:projectId/files` | 허용 자료 업로드. commandId·target/version·제어 세대 검사, 임시 저장/검증 후 ArtifactRef. FN03 |
| GET `/api/v1/projects/:projectId/files/:artifactId` | 프로젝트/참조 권한을 확인한 본문·첨부 응답. raw 경로·전역 hash로 접근 금지. FN03 |

인증 endpoint의 구체 입력·초기 소유자 등록·로그아웃/회수는 TD-02 1안 승인에 따라 §11에 추가했다. 위 session 조회만 구현하고 로그인 기능을 끝냈다고 하지 않는다. 실행기 채널의 인증·등록·키·회수는 §12·TECH_DECISIONS §11에 명세했으며 실제 검증은 미실행이다.

### CommandRequest와 응답

브라우저 JSON은 `schemaVersion`, `commandId`, `operation`, `targetId`, `expectedVersion`, `clientId`, `controlGeneration`, `baselineRefs`, 필요 시 `approvalRef`, `payload`를 가진다. projectId는 경로와 일치해야 한다. actor는 서버 인증 결과로 Context에 채운다. project 생성/초안은 아직 projectId가 없으므로 작성자 초안 범위로만 처리하고 기존 프로젝트 제어 검사를 생략해 다른 자료에 접근하지 못하게 한다.

공통 receipt는 `operationId`, `commandId`, `projectId` 또는 `draftId`, `status`, `targetId`, `version`, `data`, `evidenceRefs`, `warnings`, `serverReceivedAt`다. 동기 적용은200·실제 생성은201, 영속 후 비동기 전달 대기는202이며 대기가 Agent 수신/수행/완료를 뜻하지 않는다. 재전송은 동일 operation을 반환하고 새 부작용이 없다. `status`는 명령 처리 상태이며 §7의 업무/검수 상태와 별개다.

### 공개 명령과 서버 내부 함수

| 소유 | 허용된 UI 명령 operation | 서버 내부로만 실행할 계약 |
|---|---|---|
| FN01 | confirmBaseline, saveProjectMembership | 인증·참여 권한·초기 제어 부여는 전용 허가 연산, project 생성은 위 별도 경로 |
| FN02 | saveMethodologyDraft, copyMethodology, confirmMethodology, applyMethodology | validation/적용 버전 검사·내장 원본 쓰기 차단 |
| FN03 | copyForm, saveFormDraft, confirmForm, importDocument, saveDocumentDraft, proposeDocumentChange, confirmDocument, linkDocumentSource, proposeDocumentSourceChange, detachDocumentSource | 파서·양식 검사·검토 상태/파일 참조 정합. 사용자 양식 상세는 §9.4 |
| FN04 | linkTrace, saveWorkPlanDraft, confirmWorkPlan, proposeDesignChange, reviewChangeImpact, activateDesignChange | analyzeImpact의 기계 추적과 총괄 제안, 실제 적용 조건 검사 |
| FN05 | appendConversation, saveKnowledge, confirmKnowledge, correctKnowledge, excludeKnowledge, requestKnowledgeShare | buildTaskContext·검색 선별·share 허가 검사. 이해 결과는 FN09/14 검토 명령 |
| FN06/07 | registerConnection, updateConnection, probeConnection, testConnection, detachConnection, saveEnvironment | startSession, sendInstruction, observe, submitToolDecision는 승인된 임무/도구 요청의 서버→실행기 경로만. testConnection도 영향/필요 승인을 먼저 검사 |
| FN08 | 없음(사용자는 FN09/10/13의 허가 행동) | dispatch, appendObservation, syncObservations, getExecutionFacts. Agent가 직접 명령 권한/회수 완료를 만들지 못함 |
| FN09 | prepareAssignment, confirmAssignment, bindResponsibleSession, delegateSubtask, reviewUnderstanding, sendUserInstruction | 묶음 생성/필수 기준·하위 권한·동일 writer/도구 능력 검사 |
| FN10 | startStage, applyLimitPolicy, cancelQueuedRequest | evaluateNext, 실제 dispatch/슬롯 전이·승인 지점 검사 |
| FN11 | savePermissionPolicy, requestApproval, decideApproval, recordContentReview | authorizeCommand, consumeApproval은 서버 내부 집행. 내용 검토는 target별 도메인 검사를 소비하며 실행 승인 아님. 사용자가 자기 명령을 consumeApproval로 우회할 수 없음 |
| FN12 | submitResult, evaluateResult, requestRework | classifyExecutionIssue·증거 대조. Agent 제출과 검수자 결정을 같은 권한으로 허용하지 않음 |
| FN13 | saveCheckpoint, requestStop, reconcile, resume, prepareChangePreservation, preserveChanges, restoreSourceScope | observeStop와 OS facts 대조·새 세대/쓰기 회수 판정. 분리 보관/범위 복원은 정확 별도 승인·보존 검증 필요 |
| FN14 | prepareTransfer, compareTransferUnderstanding, confirmTransfer | 대상 능력·정지·기록 공백·실제 상태·확인 주체 검사 |
| FN15 | requestControl, prepareControlHandoff, acceptControl | checkControl·기존 grant 회수와 새 세대 발급. 인수 요청은 아직 제어권 없는 허가 참여자도 가능하되 다른 변경은 불가 |
| FN16 | saveBackupPolicy, createBackup, exportProject, validateRestore, compareRestoreImpact, confirmRestore | manifest/키·포함/제외·참조 검사, 실제 복원은 해당 영향/승인과 별도 실행 경계 |
| FN17 | registerPushPreference, markNotificationRead | publishImportantEvent·수신자/인증 링크·중복 사건 검사 |
| FN18 | 서버 공개 명령 추가 없음 | 설치형은 동일 서버 명령 소비. 로컬 생명주기/비밀·OS IPC는 허가된 별도 내부 경계 |

위 operation은 enum이며 사용자 문자열을 파일/함수 경로로 해석하지 않는다. 수신 주체는 인증된 사용자/코디네이터/실행기의 타입을 구분하고 공개 표에 있다고 모든 주체가 호출할 수 있는 것이 아니다. 예를 들어 submitResult는 소유 임무의 결과 제출 권한, evaluateResult는 별도 검수 책임을 확인한다. 요청/제안과 실제 실행을 구별한다.

### 조회 계약

GET `/api/v1/projects/:projectId/<collection>`의 명시 collection은 `methodologies`, `forms`, `documents`, `imports`, `traces`, `work-plans`, `design-changes`, `knowledge`, `constitution`, `context`, `conversations`, `connections`, `environments`, `assignments`, `executions`, `queue`, `policies`, `approvals`, `audit`, `results`, `issues`, `checkpoints`, `transfers`, `control`, `backups`, `notifications`다. 항목은 `/:id`, 문서/방법론/양식/작업계획의 특정 버전은 `/:id/versions/:version`을 사용한다. 단일 상태인 queue/control/constitution은 목록/항목으로 꾸미지 않는다. audit는 별도 감사조회 권한과 비밀 없는 필터/cursor만 사용한다. collection별 결과형·필터·field/오류를 schema에 고정하기 전 동적 generic repository를 만들지 않는다.

Page는 `items`, `nextCursor`, `hasMore`, `observedAt`, `baselineVersion`을 갖는다. limit·본문/첨부 상한은 명시된 정책을 검사하고 미설정을 무한 조회/수집으로 처리하지 않는다. cursor는 조회/필터/사용자 범위를 검증하고 권한을 대신하지 않는다. 대화/원문/증거의 다음 페이지에서 현재 위치·최신 관측/수신 지점을 유지한다.

### 오류와 자동 재전송 금지 경계

400 INPUT_INVALID/계약 버전 오류, 401 인증 없음/만료, 403 허가 없는 행위, 404 없거나 조회 권한 없는 프로젝트/자료, 409 VERSION_CONFLICT/중복 key 본문 충돌·옛 제어 세대, 412 PRECONDITION_FAILED/준비·회수/필수 정책 부족, 413 크기 정책 초과, 415 미지원 형식, 422 그래프/내용 의미 조건 부족, 429 실제 설정 한도, 503 STORAGE_FAILED/서비스 불가를 구분한다. 세부코드와 현재 자료·승인/회수 상태를 함께 반환한다. 도구 미지원/미확인은 `CAPABILITY_UNVERIFIED` 등 준비 부족이며 Agent 내부 원인을 꾸미지 않는다.

전달/응답 유실로 실행 여부가 불명이면 retryDisposition은 reconcile-first다. 인증/권한 오류를 빈 목록/200성공으로 바꾸지 않는다. 설정 한도/조회 상한·연산별 payload 세부 필수 필드, 인증·등록·OS 계약은 아직 작성/결정 중이며 이 절만으로 P02 완료는 아니다.

## 9. P02 계속 — 프로젝트·방법론·공식 문서의 상세 계약

2026-10-16 Main 어울. 계획 순서상 다음 미완료인 연산별 schema·저장 계약을 작성한다. P01 재작업·제품 구현이 아니다. 아래는 FN01~03/UI01~03·UI06의 배정 명세 초안이다. 이후 TD-02 1안 승인에 따른 인증 상세는 §11, FN11 집행은 §10으로 이어졌다. 정책 수치·P03 등 잔여가 있어 이 절만으로 구현 배정을 허가하지 않는다.

### 9.1 공통 자료형·검사 순서

방법론 카탈로그의 페이지 상세: GET `/api/v1/methodologies`는 선택 query `scope:SYSTEM/USER_COMMON,name,status:DRAFT/CONFIRMED,limit:1~200(기본50),cursor`를 사용한다. 서버는 현재 인증/owner를 매 페이지 검사하고 이름/scope/status를 LIMIT 전에 적용한다. 정렬은 SYSTEM 코드(미지정 공통본은 뒤)·고유 ID의 고정 keyset이며 cursor는 사용자/정확 필터·limit/30분 기한·전용 HMAC namespace에 결박한다. 변조/다른 사용자·필터/기한 오류400, 세션 만료401이고 끝은 hasMore=false/nextCursor=null이다. observedAt은 각 페이지 관측 시점이며 전체 카탈로그의 동결 snapshot을 의미하지 않는다. UI03은 검색/다음/이전/처음 갱신을 명시 실행하고 UI02는 더 보기로 허가된 선택을 누적한다. 목록 조회가 확정/실행 권한을 만들지 않는다.
`Id`는 서버가 발급한 UUID의 문자열, `Version`은 1부터 증가하는 정수, `Hash`는 SHA256 64자리 소문자 16진수, `Instant`는 UTC 시각 문자열이다. 문서의 원문 바이트는 재인코딩/줄바꿈 변환하지 않고 hash한다. 구조화 요청은 계약 버전의 고정 JSON 정규화(객체 키 정렬·배열 순서 유지·지원 숫자/문자 검증)로 requestHash를 계산한다. 클라이언트 계산값만 믿지 않으며 이 codec의 정확 규칙·상호 운용 테스트는 P03에서 고정한다. ArtifactRef의 contentHash는 원문 바이트, VersionRef의 contentHash는 종류별 불변 버전 내용(본문/첨부의 검증된 hash·제목/양식/출처 등 기준 필드 포함)의 정규화 hash다. 변경 가능한 상태/현재 pointer·조회 시각은 버전 내용 hash에 넣지 않는다. 요청 requestHash는 또 다른 값이며 셋을 교환하지 않는다.

| 모델 | 필수 필드·규칙 |
|---|---|
| `VersionRef` | `id:Id, version:Version, contentHash:Hash`. 참조 종류·소유 범위도 서버에서 확인. 문서/양식/방법론 참조를 교환해 사용 금지 |
| `ArtifactRef` | `artifactId:Id, contentHash:Hash, bytes:정수>=0, mediaType:문자열`. 서버가 검증한 READY 자료만 소비. projectId/초안 소유자 권한은 매번 재확인 |
| `SourceRef` | `kind:USER_INSTRUCTION/DOCUMENT_VERSION/CONVERSATION/ARTIFACT`, `id:Id`, 버전형 자료는 `version:Version`, `contentHash:Hash`. 임의 URL·파일 경로는 SourceRef가 아님 |
| `ValidationIssue` | `code, location, severity:ERROR/WARNING, message, relatedRefs:배열`. location은 필드 경로/노드ID/양식 항목ID. ERROR가 있으면 확정 불가, WARNING은 검토 결과에 보존 |
| `ReviewRef` | `id:Id, criteriaVersion:Version, targetRef:VersionRef, outcome:ACCEPTED/REWORK/BLOCKED/NOT_EXECUTED`. 검토 주체·실제 근거는 서버 저장본에서 대조하며 브라우저가 ACCEPTED를 만들어 보낼 수 없음 |
| `DocumentContent` | `body:ArtifactRef, attachments:ArtifactRef[], sections:배열<{itemId, anchor}>, sourceRefs:SourceRef[]`. 렌더 HTML/스크립트 실행 허가 아님. sections의 anchor는 실제 본문 위치와 대조 |

추가 필드·누락·잘못된 enum/형식은400이다. 문자열/배열/본문/첨부/page 크기는 해당 버전의 유한 정책을 검사하며 상한 미설정은412 `POLICY_UNCONFIGURED`다. 수치 미설정을 임의 무제한이나 빈 값으로 대체하지 않는다. 정책 수치는 TD-03 승인 TECH_DECISIONS §12를 따른다.

검사 순서: 인증→대상/초안의 조회 권한→행위 권한·활성 client/세대→동일 command 재조회→버전/참조·업무 조건→원자 저장이다. 존재 조회 권한이 없으면404로 은폐하고, 허가된 대상의 금지 행위는403이다. 재전송도 현재 권한으로 응답을 제한한다. 현재 권한이 없는 옛 command의 결과를 반환하지 않는다. 같은 commandId의 같은 요청이면 이전 결과만 반환하고 현재 버전 증가를 재실행하지 않는다.

새 개체를 만드는 명령은 `targetId:null, expectedVersion:0`을 명시하고 서버가 ID를 할당한다. 개정은 정확한 targetId/expectedVersion 필수이며 null/0을 허용하지 않는다. operation별 생성/개정 규칙을 아래에서 고정한다. 프로젝트 생성 전 명령은 작성자 초안 범위이며 아직 없는 projectId/controlGeneration을 가짜로 만들지 않는다. 기존 프로젝트 명령은 FN11 집행을 우회할 수 없다.

### 9.2 FN01 — UI01/02의 생성·중간 저장·기준선

| 연산·전송 | payload 필수 입력·선택 입력 | 결과·원자성·중요 오류 |
|---|---|---|
| `createProjectDraft` · POST project-drafts | `name, purpose, desiredOutcome:문자열`, `sourceMode:EMPTY/EXISTING`. EXISTING은 §15.4의 `sourceDeclaration` 필수, 이미 허가된 실제 root는 `sourceRootRef`로 구별 | `draftId, version, step, input`. 작성자/client와 결박. 실제 소스 읽기나 Agent 시작은 하지 않음 |
| `saveProjectDraft` · PATCH project-drafts/:draftId | `expectedVersion`, `step:1/2/3/4`, `input:{name,purpose,desiredOutcome,sourceMode,sourceDeclaration?,sourceRootRef?,methodologySelection:§15.1,artifactRefs:배열}` | 새 version·그대로 재조회할 전체 input. 미완성 입력 저장은 가능하되 빈 목적의 최종 생성은422. 다른 작성자/옛 버전 거부 |
| `createProject` · POST projects | `draftId, draftVersion`, `commandId, clientId`. 이름/목적/결과·선택한 methodologySelection과 정확한 확정 사건은 §15.1에 따라 초안 저장본에서 읽음 | `ProjectDetail`. draft소비/프로젝트/소유 참여/초기 제어/방법론 적용 snapshot/자료 귀속/receipt를 함께 저장. 한 초안의 중복 생성409 또는 같은 command 재조회. 도구·환경 미준비는 준비 필요로 표시, 실행0 |
| `listProjects` · GET projects | 선택 `query, archived:불리언, cursor, limit` | `Page<ProjectSummary>`. 허가 자료만 포함, 정렬 `(updatedAt DESC,id DESC)`. 검색 결과 없는 것과 조회 권한 없는 자료를 섞어 존재/총건수 노출 금지 |
| `getProject` · GET projects/:projectId | 경로 projectId | `ProjectDetail`. `id,name,purpose,desiredOutcome,version,createdAt,updatedAt,currentMethodologyRef,baselineRef?,readinessIssues,viewerPermissions,controlState`를 포함. 역할/제어는 서버값 |
| `confirmBaseline` · commands | `items:배열<{itemId,designRef?,featureState,evidenceRefs:ArtifactRef[],unverifiedReason?}>, sourceSnapshotRef:Id, reviewRefs:ReviewRef[]` | 불변 `BaselineVersion`. 기존 소스/dirty·미추적 관측은 FN01이 읽기 진단한 snapshot과 결박, 문서 입력만으로 실제 확인을 증명하지 않음. 미검증 기능을 VERIFIED로 바꾸는 근거 부재422 |

`ProjectSummary`는 id/name/purpose/version/updatedAt·현재 단계/중요 요청의 접근 가능한 요약만 반환한다. sourceRoot의 host 절대경로·원격 계정·Secret은 기본 목록에 포함하지 않는다. 소유자/참여자 등록·변경/로그인·만료·초기 제어 발급의 상세 인증 명세는 TD-02와 FN11 계약 뒤에 완성하며 현재 표가 이를 구현했다고 표시하지 않는다.

### 9.3 FN02 — UI02/03의 방법론·그래프

`MethodologyGraph` 필수 필드: `nodes:Node[], edges:Edge[], entryNodeId:문자열, terminalNodeIds:문자열[]`.

2026-10-17 FN02 PROJECT 구현: 같은 프로젝트 `commands` envelope에서 별도 명시 정책을 요구하는 copyMethodology/saveMethodologyDraft/recordContentReview(targetKind=METHODOLOGY)/confirmMethodology를 연결했다. 저장 결과는 data.status=DRAFT/ref/validation/snapshot, 검토는 REVIEW_RECORDED/ref/reviewRef/review, 확정은 CONFIRMED/ref/confirmationId/reviewRefs/validation이다. exact ref/현재 head·기기/세대·최신 적합 검토와 양식 준비를 검사하고 replay도 현재 정책/제어를 재검사한다. GET `/api/v1/projects/:projectId/methodologies?limit=20&afterId=<UUID>`는 최대50·ID순 keyset 목록이며 items/hasMore/nextAfterId/observedAt/projectId를 반환한다. 상세 `/:id/versions/:version`은 보호된 원문·METHOD5 검토·별도 확정 이력과 headVersion을, `/validation`은 동일 버전의 구조 검사를 반환한다. 비회원/다른 프로젝트404·현재 본문/receipt 불일치503이다. 응답 applicationTransition=EXECUTION_STATE_UNVERIFIED, applyMethodology는 현재 정책 확인 뒤412이며 확정/새 개정이 기존 적용을 바꾸지 않는다. 이 경계는 FN08/FN09 실행 상태/FN04 영향 연결 전 미완료이고 PASS로 승격하지 않는다.

UI03의 고정 적용본 표시는 기존 GET projects/:projectId의 currentMethodologyRef를 별도 읽는다. 이 ref의 id/version/hash는 적용 snapshot 식별자/적용 세대/hash이며 방법론 원본의 definitionId/개정 버전과 혼용하지 않는다. 필드 누락/다른 project 응답은 RESPONSE_INVALID이며 null만 적용본 없음이다. 화면의 이전/다음 원본 버전 조회와 현재 고정 적용본 표시는 읽기 전용이며 적용 쓰기를 수행하지 않는다.

- Node: `nodeId,name,purpose,kind:HUMAN/AGENT/DECISION/JOIN,position:{x,y},role:USER/COORDINATOR/STAGE_OWNER,inputs:배열,outputs:배열,taskScope:{included,excluded},completionCriteria:배열,approvalBoundary:배열,mode:AUTO/CASE_BY_CASE,limitPolicyRef:VersionRef|null,recordRequirements:배열`. Agent 노드는 역할/능력과 환경 요구를, JOIN은 `joinRule:{mode:ALL/DECLARED_CONDITION,condition?}`를 갖는다. 실제 계정/비밀/실행 권한을 그래프에 넣지 않는다.
- Edge: `edgeId,fromNodeId,toNodeId,kind:SEQUENCE/BRANCH/JOIN/REWORK,condition:null|구조화 조건,reason`. 조건은 허용된 결과 필드·연산자·값 또는 명시적인 사람/총괄 판단 참조다. 실행 코드나 eval 문자열 금지. 최종 허용 조건 연산자·입력 필드 사전은 FN10 상세 계약과 결박 전 실행 불가다.
- 입력/산출 문서 항목: `itemId,formRef:VersionRef,required:불리언,sourceNodeId?,reviewCriteria:배열`. 노드ID/좌표·문서 연결을 저장/재조회하며 복사 때 내부 참조는 원자적으로 새 ID에 매핑한다.
- 그래프 검사는 ID중복/잘못된 참조·entry/terminal 부재·도달 불가·분기/합류 조건·빈 완료조건·내장 원본 수정·재작업 외 순환을 구별한다. REWORK는 이유/재개 조건·재시도 정책을 요구하고 명시한 재작업까지 무조건 순환 오류로 거절하지 않는다. 저장 가능한 미완성 초안과 확정 가능한 그래프를 구별한다.

| 연산 | payload→응답·조건 |
|---|---|
| `copyMethodology` | `sourceRef:VersionRef, name, scope:USER_COMMON/PROJECT, reason`→새 methodologyId/version1의 DRAFT. 허가된 시스템/자기 공통/프로젝트 원본만 복사, 출처/부모 hash 보존. 실제 계정/실행 binding 복제0 |
| `saveMethodologyDraft` | 신규는 `name,purpose,scope,graph:MethodologyGraph`, 개정은 위 필드+기준 expectedVersion→새 DRAFT version·contentHash. 노드 위치 포함, 진행 중 적용본 불변 |
| `validateMethodology` · 조회성 검증 | 저장 versionRef→`{targetRef,issues:ValidationIssue[],validForConfirmation:불리언}`. 정확 hash의 결과이며 자동 확정/실행0 |
| `confirmMethodology` | `versionRef,reviewRefs:ReviewRef[]`→CONFIRMED 상태 이력. 서버가 현재 hash의 그래프를 재검증하고 저장된 내용 검토와 대조, ERROR/양식 미확정/필수 입력 누락422. 사용자 확정 책임 검사 |
| `applyMethodology` | `methodologyRef:VersionRef, expectedApplicationVersion:정수>=0, reason`→project 적용본 ID/version·pinned snapshot/hash. 확정본만 허용. 진행 중이면 FN04 변경/영향 절차 없이는 적용 거절. 원본 개정/제품 업데이트로 자동 적용0 |

카탈로그 GET methodologies는 `scope:SYSTEM/USER_COMMON/PROJECT`·이름·상태 필터와 cursor를 받는다. SYSTEM은 SYS-M01~03의 배포한 불변 버전, USER_COMMON은 현재 사용자에게 허가된 버전만 반환한다. 서로 다른 프로젝트 자료를 공통이라는 이유만으로 노출하지 않는다. 상세 `/:id/versions/:version`은 graph/양식/출처/변경이유/검토 이력을 반환한다. GET `/api/v1/projects/:projectId/methodologies/:id/versions/:version/validation`은 정확한 버전의 구조 검사 결과를 반환하는 읽기 전용 `validateMethodology`다. 조회가 확정/승인 상태를 바꾸지 않는다. 확정 명령은 서버에서 재검증하고 그 결과를 같은 저장 경계의 methodology_reviews에 남긴다. 조회 응답을 조작해 확정 근거로 보낼 수 없다.

2026-10-16 직접 승인(`call_07a966ef8b6d4eefac5fa279876ff3c0`)의 본인 공통 자료 보완: POST `/api/v1/user-common/commands`는 `schemaVersion:1,commandId,operation,targetId:null 또는 Id,expectedVersion,clientId,payload`만 받는다. owner는 인증 세션에서 결정하며 projectId/draftId/controlGeneration/임의 owner를 받지 않는다. 현재 구현 연산은 copyMethodology/saveMethodologyDraft/copyForm/saveFormDraft/recordContentReview/confirmForm/confirmMethodology이며, 나머지는 연결 전 거절한다. 신규 targetId=null/expectedVersion=0, 개정은 본인 USER_COMMON target/current head만 허용한다. copy payload는 위 표, saveFormDraft payload는 `definition:FormDefinition,reason`이며 범위는 definition.scope=USER_COMMON으로 검사한다. saveMethodologyDraft payload는 `name,purpose,scope:USER_COMMON,graph,reason`이다. 형식상 유효한 미완성 그래프는 DRAFT로 저장하고 구조 문제를 반환한다. 작성 연산의 receipt는 `scopeKind:USER_COMMON,ownerUserId,operationId,commandId,status:APPLIED,targetId,version,data:{ref,validation,status:DRAFT},evidenceRefs,warnings,serverReceivedAt`이다. 같은 사용자·commandId는 연산에 관계없이 한 번만 실행하며 현재 client/본문이 다르면409/403, 현재 세션·CSRF·소유권은 replay 전에도 확인한다. 도메인 변경·명령·허가·감사가 모두 저장돼야 성공한다. 프로젝트 제어권/실행 승인으로 사용하지 않는다.

### 9.4 FN03 — UI03/06의 양식·본문·원본·제안

2026-10-16 충돌/대상 교체 UI 후속: 명확한 저장 VERSION_CONFLICT에서 기존 KEEP_INPUT 호환 검사는 유지한다. 별도 LATEST_METADATA 선택은 최신 양식/첨부/형식을 유지하고 내 제목/본문·이유와 원 거절 snapshot을 보존한 미저장 조정 초안만 만든다. 항목 anchor는 다시 지정하며 stage/source 미연결 경계는 유지한다. 검토/확정은 명확한 JSON4xx 첫 거절만 명시 보관 가능하고, 단절/손상/5xx/불명확4xx의 uncertain은 뒤 거절로 해소하지 않는다. 새 대상은 새 판단·정확 최신 검토·별도 확인/명령을 요구하며 기존 API·서버 권한/버전 검사를 느슨하게 하지 않는다.

2026-10-16 보관 목록/재개 연결: `GET projects/:projectId/imports`는 limit(기본50/최대200), status(READY/FAILED/UNSUPPORTED), formId, cursor를, `/proposals`는 status(PENDING/SELECTED), documentId와 같은 페이지 계약을 받는다. 응답은 items/hasMore/nextCursor/observedAt이고 summary integrity=NOT_RECHECKED다. cursor는 actor/project/kind/filter/limit·30분 기한에 결박하며 혼용/위조400·비회원404다. 상세 GET이 원본/hash·선택 이력을 재검사한다. Web 조회는 제어권 없이 가능하고 명시 준비/반영 때 현재 control을 검사한다. 후보 재개는 원본을 첨부한 새 초안만, 저장 제안 재개는 snapshot=null의 읽기 binding과 새 saveDocumentDraft(proposalRef)만 만들며 과거 import/upload/propose를 합성하지 않는다. 아래 이전 목록 미연결 문구는 후속 전 이력이다.

2026-10-16 PROJECT 제안 연결: `proposeDocumentChange` envelope targetId/expectedVersion은 payload.baseRef의 id/version과 같아야 한다. 현재 head/hash·프로젝트 소유 READY body/attachments·UTF-8/목차를 확인한 뒤 `data.status:PROPOSAL_RECORDED,ref:baseRef,proposal:{id,baseRef,proposedContentRef:본문ArtifactRef,diffRef:서버ArtifactRef,status:PENDING}`를 반환한다. 문서 head/확정본은 변경하지 않는다. diff는 `ANVIL_TEXT_DIFF_1,startLine,before/after:원문 줄 배열,unchangedBefore/After,baseRef,baseBodyRef,proposedBodyRef,beforeContent,afterContent` JSON 원본이며 patch 실행 입력이 아니다. 무변경 content422, stale/hash409, diff 상한20MiB413·기존 quota/원문 보호를 유지한다.

`GET projects/:projectId/proposals/:id`는 같은 프로젝트 권한/파일 무결성을 확인하고 proposal+proposedContent/reason/생성 주체/시각·selections를 반환한다. `saveDocumentDraft`의 optional proposalRef는 실제 제안의 base/current hash·제목/양식·전체 content가 정확히 일치해야 하고 stale/재선택/다른 내용409다. 새 초안과 선택 사건을 같은 transaction에 기록하며 별도 확정은 기존 contract대로다. GET document version의 proposalRefs는 실제 관련 proposal ID 배열이다. 현재 sourceRefs는[]만 연결했으며 제안/가져오기 목록·DRAFT/소스 연계는 후속이다.

2026-10-16 최초 PROJECT 가져오기 연결은 기존 command envelope의 `importDocument`(targetId=null/expectedVersion0)→`data.status:IMPORT_CANDIDATE,candidate`이며 receipt의 artifactRef/targetId는 보존한 실제 원본을 가리킨다. candidate는 표의 필드와 nullable intendedFormRef를 가진다. UTF8_IDENTITY_1은 유효 .txt/.md≤2MiB를 바이트 무변환 READY로 추출하고 extractedContentRef=originalRef다. 원본≤20MiB는 보존하지만 파서 실패 FAILED/기타 형식 UNSUPPORTED는 본문 추출 성공이 아니다. sourceRefs는 실제 연결 전 []만 허용하고 nonempty는412다. `GET projects/:projectId/imports/:id`는 현재 회원의 원본/candidate hash를 재검증하고 선택 문서/version/사용자/시각 이력을 돌려준다(교차 소유404). 후보 목록·DRAFT import·제안/diff는 아직 미연결이다.

`saveDocumentDraft(importCandidateRef)`는 실제 READY candidate·같은 고정 양식(지정한 경우)과 원본을 body/attachments 중 하나로 반드시 보존해야 한다. 저장은 별도 명시 명령이며 선택 이력/문서 version/receipt/감사를 한 DB transaction에 기록하고 GET version의 `importCandidateRefs:Id[]`로 재조회한다. Web에서는 원본 첨부와 편집 본문을 분리해 저장하며 단순 업로드/후보 생성만으로 확정하지 않는다. 미확인 upload/import/save는 캡처한 같은 ID/입력으로만 명시 재확인, 자동 재전송0이다. 현재 읽기/검토/확정의 기존 계약과 실패 기준은 유지한다.

파일 읽기/해시 준비부터 공유 버퍼의 준비 예약으로 편집 저장·교체와 상호 배제하며 같은 예약/주체/프로젝트·pending 유무를 재검사한다. 서버의 최초 명확한 JSON4xx 거절은 사용자가 가져오기만 닫아 기존 입력으로 돌아갈 수 있지만, 단절/invalid/5xx의 미확인 이력은 이후4xx만으로 미적용으로 바뀌지 않는다. 같은 단계의 정확 정상 receipt에서만 미확인을 해소하고, 재시도 시작은 과거 거절 표시의 효력을 지우되 uncertain은 유지한다. 후보/원본을 자동 삭제하거나 새 명령으로 바꾸지 않는다.

`FormDefinition` 필수: `formCode:AF01~AF08 또는 사용자 정의 코드, name,purpose,scope,authorRole,reviewerRole,confirmerRole,requiredInputs:배열,items:배열<{itemId,title,required,valueType,repeated,fields,authoringRules,reviewCriteria}>,authoringStandardRef:VersionRef`. itemId는 개정 후 추적 가능한 안정 ID다. 사용자 입력 양식은 제한된 데이터이며 JSON Schema/스크립트 실행 원본이 아니다. 공식 AF01~08의 코드/이름 매핑은 승인 양식 정의 그대로 고정한다.

| 연산 | payload→응답·조건 |
|---|---|
| `copyForm` / `saveFormDraft` / `confirmForm` | copy는 `sourceRef,name,scope,reason`, save는 `definition:FormDefinition`, confirm은 `versionRef,reviewRefs`→양식 ID/version·상태/검토. 공통 생성/개정 규칙 적용. 내장 양식 직접 수정 금지·사용 중 버전 자동 변경0. 이는 기존 사용자 양식 요구의 명세 누락 보완이며 새 기능이 아님 |
| `importDocument` | `fileRef:ArtifactRef, intendedFormRef:VersionRef 또는 null, sourceRefs:SourceRef[]`→`ImportCandidate{id,originalRef,extractedContentRef?,parserVersion?,losses:배열,issues:배열,status}`. 원본과 추출본 별개, 지원불가도 원본 보존/명시. 단순 파일 업로드가 추출/확정 아님 |
| `saveDocumentDraft` | `title,formRef:VersionRef,stageNodeRef:{applicationId,nodeId} 또는 null,content:DocumentContent,importCandidateRef:Id 또는 null,reason`→`DocumentVersion`. 신규/개정 envelope 규칙 적용, sourceRefs와 본문을 보존. 필수 항목 미완성 초안 저장 가능, 확정은 불가 |
| `proposeDocumentChange` | `baseRef:VersionRef,proposedContent:DocumentContent,reason,sourceRefs:SourceRef[]`→`Proposal{id,baseRef,proposedContentRef,diffRef,status:PENDING}`. 서버 diff 생성, Agent 임의 diff만으로 본문 patch 실행 금지. 제안은 자동 반영/확정하지 않음 |
| `saveDocumentDraft` · 제안 반영 | 위 입력+`proposalRef:Id`→사용자가 확인한 제안으로 새 DRAFT version. proposal의 base/current hash 일치 재검사, stale409. 이전 확정본/제안/검토 이력 유지 |
| `confirmDocument` | `versionRef,formRef,reviewRefs:ReviewRef[]`→확정 상태 이력·현재 confirmedRef. 형식 검사와 내용 검수/사용자 확정 분리. 설계·화면 검토 없이 작업계획을 개발 기준으로 사용하는 것은 FN04/FN09 준비 실패 |
| `getDocumentVersion` | GET documents/:id/versions/:version→`id,version,title,formRef,stageNodeRef,content:DocumentContent,contentHash,sourceRefs,authorRef,createdAt,statusHistory,reviewRefs,proposalRefs,sourceLinks` |

`authorRef`는 서버가 인증/소유 실행과 대조한 작성자·Agent/세션 참조다. Agent가 사용자 명의를 payload로 보낼 수 없다. forms/documents/imports 목록·상세·버전/제안 조회도 프로젝트 권한을 검사하며 양식 종류·단계·상태·cursor 필터를 지원한다. 초안 업로드 자료는 소유 초안에서만 읽고 프로젝트 생성 전 교차 초안 참조를 허용하지 않는다.

본문/첨부 응답은 원본 다운로드와 안전 미리보기를 구별한다. Markdown/텍스트·화면시안은 승인된 렌더 경로로만 표시하고 사용자 HTML/SVG의 스크립트·외부 리소스·이벤트 handler를 실행하지 않는다. 지원 파서/형식별 한계·상한은 TECH_DECISIONS §12를 따른다. 최초 Markdown/UTF-8 텍스트를 지원 범위로 정하며 DOCX/PDF/HTML은 원본 보존과 추출/렌더 미지원을 분리하고 구현 확인 없이 지원 목록에 넣지 않는다.

sourceLinks는 `{sourceRootId,relativePath,sourceSnapshotRef,blobHash,documentRef,linkedAt}`의 배열이다. sourceSnapshotRef는 실제 호스트·Git/dirty 관측을 참조하고 commit이 없는 변경도 구별한다. 클라이언트가 임의 절대경로/commit을 증거로 선언할 수 없다. 드리프트는 확인됨/불일치/미확인과 관측 시각을 반환하고 자동 덮어쓰지 않는다. 연결 생성/관측·선택은 §15.4, 실제 경로/읽기는 FN06/08, 범위 복원은 FN13의 정확 허가를 소비한다.

### 9.5 단위·통합 검수 인계와 남은 경계

| 소비 업무 | 구현 시 필요한 정상/중요 실패 검수 |
|---|---|
| FN01/UI01/02 | 초안 저장/재개→동일 command 두 번 생성1회→재시작/재조회. 타 초안/프로젝트 참조·옛 client/권한회수·상태 미확인 기준선 거절 |
| FN02/UI02/03 | 내장 선택/복사/직접정의 저장·재조회→개정→한 프로젝트만 적용. 노드/좌표·양식 고정, REWORK 허용/의도하지 않은 cycle 거절·공통 개정 자동 적용0 |
| FN03/UI03/06 | 공식8종+헌법 목록→원본/본문·시안 조회→제안 비교·선택→새 버전/확정/구버전 재조회. 파서 실패·XSS/문서지시·stale 충돌·타 프로젝트 artifact·형식합격만으로 확정 거절 |
| FN11/IX01 | 공통 집행 후 저장·중복/동시 갱신·만료·옛 세대·교차 프로젝트 거절. 거절 후 버전/본문/참조 부작용0. 실제 서버/DB/화면 증거 필요 |

이 표는 시험 계획이지 실행 결과가 아니다. 후속 명세는 FN04/05/11→FN06/08의 인증된 연결·등록/OS·임무 전달→나머지 FN/조회/정책 순으로 보완한다. 작성 시 미답변이던 TD-02는 이후 1안 승인을 받아 §11로 이어졌고 실제 정책/형식·스키마 생성/DB 실행 전제는 유지한다. 기본 UI가 있다고 전체 기능 완료로 표시하지 않는다.

## 10. P02 계속 — 허가·추적/계획·원문/맥락

이 절은 기존 FN11/FN04/FN05를 배정 가능한 입력/출력으로 상세화한다. 실행 중인 API/권한 설정을 바꾸는 작업이 아니며 전체 P02 완료도 아니다. 공통 형식/에러/원자성은 §9.1을 상속한다. 변경 주체는 `HUMAN`(인증 사용자), `COORDINATOR`(허가된 총괄 임무), `WORKER`(허가된 수행 임무), `CONNECTOR`(소유 관측)로 구분하고, 각 binding·대상·행위 권한과 사람의 현재 client/controlGeneration을 서버가 대조한다. enum을 보내는 것만으로 주체가 되지 않는다.

### 10.1 FN11 — 허가·일회 승인·감사

`ActionScope` 필수는 `operation,targetRef,expectedVersion,payloadHash,baselineRefs,environmentRef,sourceScopes:배열,limitsRef,requestedSubjectRef,controlGeneration`이다. 자료만 다루는 행위에서 환경/소스가 해당 없으면 그 사유를 명시한 null을 허용하되 실행 행위에서 생략하지 않는다. sourceScope는 등록 sourceRootId·상대 경로/권한·정규화/정체성 검사 참조이며 임의 절대경로·glob를 허가로 사용하지 않는다. `scopeDigest`는 이 불변 구조의 서버 계산 hash다. 자유문장 ‘모두 승인’은 구조화 scope를 대신하지 못한다.

`ApprovalDetails`는 `reason,risks:{data,security,cost,interruption,unverified},rollback:{method,limitations,evidenceRefs},expiresAt,actionScope,candidateCommandId`를 갖는다. 미확인 비용/복구 가능성을 0/가능으로 바꾸지 않는다. 서버가 표시할 확정 범위와 후보 commandId·본문 hash를 저장하며 승인 후 다른 payload로 바꾸지 않는다. 여러 행동이면 각각 범위가 고정된 별도 요청으로 작성하고 하나의 일회 요청을 무제한 token으로 사용하지 않는다.

| 연산·호출 주체 | 필수 payload→결과 | 집행·중요 실패 |
|---|---|---|
| `savePermissionPolicy` · 권한 있는 HUMAN | `rules:배열<{ruleId,subjectRef,operations,targetScopes,disposition:AUTO/REQUIRE_APPROVAL/DENY,limitPolicyRef,expiresAt}>,reason,reviewRefs`→새 `PolicyVersion` | 정책관리 권한/현재 client·기준 버전/중요 권한 변경 승인을 검사. DENY·상위 금지·제품 보안 제약을 일회 승인으로 해제하지 않음. 기존 실행/임무 scope 자동 확대0 |
| `requestApproval` · 허가된 HUMAN/COORDINATOR/WORKER | `details:ApprovalDetails`→`ApprovalRequest{id,version,status:PENDING,details,scopeDigest,requiredDecider,createdAt}` | 요청자가 대상/범위를 제안할 수는 있으나 requiredDecider/승인권한은 서버 정책값. 요청 저장이 실행/허가 아님 |
| `decideApproval` · 지정 HUMAN | `requestId,expectedVersion,scopeDigest,decision:APPROVE/REJECT/REQUEST_CHANGE,reason`→`ApprovalDecision{id,requestId,decision,decidedAt,scopeDigest}` | 로그인/결정 권한·단독 제어/세대·scope·만료 재대조. 동일 최종 결정 재조회와 반대/변경 결정409 구분. REQUEST_CHANGE는 이전 범위의 실행 허가가 아니며 수정은 새 요청 |
| `authorizeCommand` · 서버 내부 | 인증 Context+명령/목표/현재 policy/기준/허가·소유 상태→`ALLOW/DENY/APPROVAL_REQUIRED`와 `policyRef,reasonCodes,approvalRef?` | UI나 Agent가 ALLOW를 업로드할 수 없음. 기본은 명시 허가 없으면 DENY, 제어권이 있다고 모든 행위 허가 아님 |
| `consumeApproval` · 서버 내부 | `requestId,decisionId,candidateCommandId,scopeDigest`+현재 Context→`AuthorizationReceipt{id,commandId,policyRef,approvalDecisionRef,scopeDigest}` | 유효 APPROVE·현재 허가/세대/기준·정확 후보 command를 같은 DB 경계에서 검사/소비. 같은 command는 같은 receipt, 다른 command/범위·만료·회수는 거절. 소비·command·도메인 변경/전달대기·감사 원자 저장 |

권한 조회 GET policies는 현재 적용 버전/허용 행위·미충족 조건을 반환하고 비밀 경로/권한 없는 주체 목록은 숨긴다. GET approvals는 `status,targetId,cursor`를 지원하며 요청/결정/소비·실제 실행은 별도 필드다. 승인 만료는 서버 시계로 판정하고 클라이언트 시계·알림 클릭을 근거로 쓰지 않는다. 거절은 해당 행동 거절이며 프로젝트 원본 삭제/무관한 작업 중단으로 확대하지 않는다.

감사 `AuditFact` 필수는 `eventId,projectId,serverSequence,actorRef,clientRef?,commandId?,operationId?,targetRef,policyRef?,approvalRef?,outcome,reasonCode,scopeDigest?,recordedAt,sourceKind,correctionOf?`다. 비밀값/전체 인증 header·무제한 원문 payload는 저장하지 않고 보호된 증거 ref를 사용한다. 허용/거절·결정/소비·실제 수행 관측을 구분한다. 감사 쓰기 실패 시 새 변경은 성공 처리하지 않는다. 거절 감사는 거절된 도메인 트랜잭션과 분리해 보존하되 감사 장애 자체를 기록/통지하고 변경 부작용0을 유지한다. hash/순번은 불변성 대조 자료일 뿐 동일 관리자에 의한 자료·기준 동시 변조 검출을 보장하지 않는다.

### 10.2 FN04 — 추적·업무계획·설계 변경

추적 저장 구현 상세: linkTrace 신규 envelope는 targetId=null/expectedVersion=0이며 별도 명시 operation 정책을 소비한다. 현재 resolver는 DESIGN_ITEM/SCREEN_REGION의 등록 ID와 실제 원문 버전·코드/줄, PLAN_TASK의 id=plan id/versionRef=계획 버전/필수 localCode, DOCUMENT_VERSION의 id=문서 id/versionRef를 대조한다. localCode/anchor를 주면 실제 metadata와 같아야 한다. PLAN_TASK/DOCUMENT_VERSION의 임의 line anchor는 허용하지 않는다. 미구현 REQUIREMENT/ARTIFACT/EXECUTION/TEST_EVIDENCE는412이며 가짜 실제 출처로 저장하지 않는다. 초기 지원 관계/제한은 WORK_STATUS Ruling으로 기록했다. 중복 의미 edge409·자기 참조/관계 형식422·없는/교차 ID404·위조 hash409다. receipt.data는 `{ref,status:TRACE_LINKED,edge:{id,from,to,relation,reason,designRefs,edgeHash,createdAt}}`다. edgeHash는 id/createdAt/edgeHash를 제외한 payload의 canonical SHA256이다.

GET traces는 기존 designId/version/direction과 유한 limit/cursor를 소비한다. 실제 저장 edge는 양방향 조회에서 동일하며 traversal만 반전한다. nodes는 `{ref,title,designRefs}`, missingLinks는 실제 설계 항목의 계획 IMPLEMENTS 누락, unknownEvidence는 아직 없는 실행/시험 출처, baselineRef는 미활성 null이다. head를 자동 기준으로 활성화하지 않는다. source/관계 hash를 열 때 재대조하고 다른 방향/filter/actor의 cursor는400이다.

보관 계획 GET `projects/:projectId/work-plans?limit=1..200&documentId?&cursor?`는 head의 `{ref,status:DRAFT,title,documentRef,designRef,issueCount,updatedAt,integrity:NOT_RECHECKED}` 목록과 hasMore/nextCursor/observedAt을 반환한다. Web 기본 limit50, cursor는 사용자·project·문서 필터·limit·기한에 결박한다. 상세를 열 때 실제 원문/관계/hash를 재확인한다. 보관 계획에서 개정 준비는 사용자 별도 확인과 현재 OWNER/client/control을 소비해 planRef를 고정하고 새 pending 명령을 준비하며 과거 receipt를 실행 명령으로 합성하지 않는다. 구버전/동시 개정 충돌은 현재 head CAS409로 보존하며 자동 기준 교체하지 않는다.

2026-10-16 FN04 초안 저장 구현 상세: `saveWorkPlanDraft` 신규 envelope는 targetId=null/expectedVersion=0, 개정은 기존 plan id/현재 head version을 사용한다. 정확 AF04 원문·AF02 설계·실제 등록한 D/S 참조를 검사하고 별도 명시 연산 정책을 요구한다. `TaskCard.designRefs/screenRefs`는 `{kind:DESIGN_ITEM/SCREEN_REGION,id,versionRef,localCode,anchor}`이며 kind·프로젝트·원문 버전/hash·등록 코드/줄이 일치해야 한다. inputs/outputs/included/excluded/allowedFileRefs/steps/acceptanceCriteria/evidenceRequirements와 두 선행은 문자열 배열이며, allowedFileRefs는 저장소 상대 경로의 계획 선언일 뿐 실제 파일 접근 허가가 아니다. testCases는 `{id,kind:NORMAL/IMPORTANT_FAILURE/DIRECT_IMPACT,steps:문자열배열,expected,environment}`다. 최대200업무/각 배열200·기존 요청2MiB 상한을 유지한다. 누락/순환/중복/원문 업무 미확인·설계/계획 미확정·화면 검토 미충족은 issues로 보존한다. 중복/순환 등 관계 모호성이 있으면 원 카드 전체는 불변 version_json에 보관하고 relationalProjection=ISSUES_ONLY로 구분해 모호한 task/dependency를 실제 유효 연결로 투영하지 않는다. 정상 구조도 DRAFT이며 확정/배정/실행/완료로 승격하지 않는다.

저장 receipt의 data는 `{ref,status:WORK_PLAN_DRAFT_SAVED,workPlan:{ref,status:DRAFT,documentRef,designRef,screenReviewRefs,tasks,dependencies,reason,issues,relationalProjection}}`다. workPlan ref의 contentHash는 ref/status를 제외한 이 snapshot의 canonical SHA256이다. GET `projects/:projectId/work-plans/:id/versions/:version`은 동일 불변 값·executionEvidence=NOT_CONNECTED·observedAt을 반환하며 원문/참조·관계 hash를 다시 확인한다. 현재 초안 저장만 구현하며 confirmWorkPlan·목록/화면 편집·trace edge·실제 실행 상태는 후속 미완료다.

2026-10-16 승인된 FN04 저장 계약 보완: additive `indexDesignDocument`의 envelope target/expected는 `documentRef:VersionRef(AF02)`와 같다. payload는 `documentRef,items:[{localCode,title,anchor:line:n}],screens:[{designLocalCode,screenCode,documentRef:VersionRef(AF03),anchor:line:n}],reason`이다. 각 배열 최대200·현재 head/hash·실제 원문 코드/제목/줄·같은 프로젝트를 검증하고 별도 명시 연산 정책을 요구한다. 원문 변경 없이 `{status:DESIGN_INDEXED,ref:documentRef,designItems,screenRegions}`를 반환한다. 동일 command replay·새 중복409·잘못된 위치/종류422·비회원404이며 기존 API 호환성을 변경하지 않는다. GET `projects/:projectId/design-index?documentId&version`은 `{documentRef,items,screenRegions,status:INDEXED/NOT_INDEXED,observedAt}`이며 정확 원문과 metadata hash를 다시 검사한다. item은 `{id,documentRef,localCode,title,anchor,itemHash}`, region은 `{id,designItemId,screenCode,documentRef,artifactRef,anchor,regionHash}`다. 이미지 내부 좌표/등록 UI·실제 task/시험 증거 연결은 아직 미구현이다.

`TraceRef`는 `kind:REQUIREMENT/DESIGN_ITEM/SCREEN_REGION/PLAN_TASK/DOCUMENT_VERSION/EXECUTION/ARTIFACT/TEST_EVIDENCE, id, versionRef, localCode?,anchor?`를 갖는다. kind별 실제 서버 자료와 프로젝트/버전이 존재해야 한다. 파일명/Agent 주장만으로 TEST_EVIDENCE/EXECUTION을 만들지 않는다. 양방향 조회는 같은 edge의 반대 탐색이며 복제 edge로 별도 진실을 만들지 않는다.

`TaskCard` 필수는 `taskCode,type:SCREEN/FUNCTION/INTEGRATION/PREPARATION,title,purpose,designRefs,screenRefs,ownerRole,inputs,outputs,included,excluded,allowedFileRefs,startPrerequisites,acceptancePrerequisites,steps,testCases,acceptanceCriteria,evidenceRequirements,rollback,recoveryNotes`다. testCases는 정상/중요 실패·직접 영향·기대 결과·검증 환경을 포함한다. 두 선행 필드는 독립이며 기존 완료 조건을 뷰 착수 조건으로 축소하지 않는다. 상태/실제 담당·코드/시험 결과는 후속 실행 기록으로 연결하고 계획 작성자가 `COMPLETED/PASS`를 직접 부여하지 않는다.

| 연산 | payload→응답·준비 조건 |
|---|---|
| `linkTrace` | `from:TraceRef,to:TraceRef,relation:REFINES/IMPLEMENTS/VERIFIES/DEPENDS_ON,reason`→`TraceEdge{id,from,to,relation,createdAt}`. 같은 의미 edge 중복 방지·자기 참조/관계 형식 오류422·타 프로젝트404 |
| `getTrace` | GET traces?`designId,version,direction:FORWARD/REVERSE,cursor`→`TraceView{nodes,edges,missingLinks,unknownEvidence,nextCursor,baselineRef}`. 없는 실제 결과는 미확인, 완료로 유추하지 않음 |
| `saveWorkPlanDraft` | `documentRef:VersionRef(AF04),designRef:VersionRef(AF02),screenReviewRefs:ReviewRef[],tasks:TaskCard[],reason`→`WorkPlanVersion{id,version,contentHash,issues}`. 설계/화면 검토가 미충족이면 초안 보관만 허용하고 확정/배정은 금지. 참조 없는 업무/순환·중복 코드·모호한 범위는 issues로 노출 |
| `confirmWorkPlan` | `planRef:VersionRef,reviewRefs`→확정 상태 이력. 정확한 사용자 확정 설계/화면 검토·AF04 버전·필수 card/선행·범위/검수 누락0 검사. 실제 작업 시작과 별개 |
| `proposeDesignChange` | `beforeRef:VersionRef,afterProposalRef:Id,reason,sourceRefs`→`ChangeRequest{id,version,beforeRef,afterProposalRef,status:PROPOSED}`. 현재 확정본/과거 결과 불변 |
| `analyzeImpact` · 내부 계산/총괄 검토 | changeRef+추적·실제 상태→`ImpactVersion{id,version,changeRef,items:배열<{targetRef,state:AFFECTED/UNAFFECTED/UNKNOWN,reason,evidenceRefs}>,coverageGaps,reviewRef?}`. 연결 누락/모순을 UNKNOWN으로 보존, 총괄 판단 출처와 기계 추적 구분 |
| `reviewChangeImpact` | `changeRef,baseImpactRef,items의 판단/근거,coverageGaps,reason`→새 ImpactVersion. 확인 근거 없는 UNKNOWN 제거 금지. 검토 자체가 변경 승인 아님 |
| `activateDesignChange` | `changeRef,impactRef,approvedDesignRef,confirmedPlanRef,approvalRef,reason`→`AppliedBaseline{id,designRef,planRef,affectedTasks,recheckRequired,activatedAt}`. 현재 기준/영향 version·정확 승인·새 설계/계획·필수 영향 미확인 해소를 원자 대조. 진행 중 영향 writer의 안전 상태 미확인412 |

2026-10-21 비의미 위치 명료화: 위 `activateDesignChange` 행의 `approvalRef`는 §2·§9.1 CommandRequest·§10.1에서 상속하는 **공통 명령 봉투/context의 논리 인자**다. 연산별 payload에는 `changeRef,impactRef,approvedDesignRef,confirmedPlanRef,reason`을 두며 같은 ApprovalRef/scopeDigest를 payload에 중복 삽입하지 않는다. 기존 ActionScope.payloadHash와 scopeDigest 계산·ApprovalRef 형식은 불변이다. 이 명료화는 실제 지원 operation·승인 후보 원문 조회·권한/정책·SQL 소비 범위를 추가 채택하거나 실행을 승인하지 않는다. 현재 코드의 FN11 지원 연산과 실제 적용 여부는 WORK_STATUS의 증거를 별도로 따른다.

적용은 design/plan pointer와 영향 업무의 재확인 표시·이력/감사를 함께 갱신하고 과거 증거는 삭제하지 않는다. 무관한 임무를 재실행하지 않는다. 영향 있음/미확인 업무만 준비 재검토하며 실제 재개는 FN13/09의 별도 준비/제어를 소비한다. 작업계획/추적 결과는 UI06, 변경/영향/결정/적용은 UI07, 승인 상세는 UI08에 같은 ID로 연결한다. GET design-changes/:id는 전후/영향 버전·결정·계획 개정·적용 이력을 함께 반환한다.

### 10.3 FN05 — 원문·헌법·지식·검색

2026-10-16 헌법 적용 직접 승인 후속: `applyConstitution`은 targetId=projectId/expectedVersion=현재 적용 세대(없으면0), payload={versionRef,confirmationId,reason,acknowledged:true}이다. 별도 명시 정책·현재 로그인/단독 제어·정확한 현재 CONSTITUTION/확정 사건·그 확정에 포함된 최신 ACCEPTED 검토·보호 원문/hash를 저장 직전 대조한다. 새 적용 ref의 id는 projectId, version은 적용 세대이며 지식 버전과 혼동하지 않는다. 기존 적용과 같은 지식 버전의 새 중복은409, 같은 명령은 기존 receipt만 반환한다. GET constitution?limit(기본10/최대20)&beforeVersion은 단일 current와 불변 history, 유한 페이지를 반환한다. 정정/제외/재검토 뒤 과거 적용/원문은 남고 eligibility만 false다. 적용은 Agent 전달/준수나 업무 실행을 뜻하지 않는다. knowledge 조회의 appliedAsConstitution=true는 별도 constitutionApplication ref/snapshot/hash 증거와 함께만 반환한다. 실제 적용/검증 여부는 WORK_STATUS를 따른다.

2026-10-16 첫 구현 경로: `saveKnowledge`는 targetId=null/expectedVersion=0으로 새 PROPOSED만 저장한다. `GET knowledge/:id/versions/:version`은 `ref,entry,body,state,history,appliedAsConstitution:false,redactionState:NOT_REDACTED,sensitiveInspection:KNOWN_PATTERNS_ONLY,agentDelivery:NOT_CONNECTED`를 반환한다. SourceRef는 실제 동일 프로젝트 DOCUMENT_VERSION(id/version/contentHash)·ARTIFACT(id/contentHash)의 UTF-8 원문/물리 hash를 대조하며, 아직 미연결 USER_INSTRUCTION/CONVERSATION·단계/업무 scope·relatedRefs는412다. 헌법 kind의 저장은 적용이 아니다.

초기 검색은 제목/이유의 리터럴 부분 일치(`searchScope:TITLE_REASON`), kind/PROPOSED 필터와 유한 서명 cursor만 지원하며 본문을 snippet으로 반환하지 않는다. 모든 검색/본문 조회 앞 회원·실제 원문/hash를 검사한다. 알려진 private-key/Bearer/비밀 대입 표식은 값 없는412 `KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED`로 지식 저장/조회·검색 노출을 차단하며 원문을 자동 삭제하지 않는다. 완전한 탐지·기존 FN03 원문 격리나 공유/확정/정정/제외·Agent 이해 기능 완료를 뜻하지 않는다. 의심 자료의 전체 보관/격리는 후속 보안 경계로 남긴다.

`KnowledgeEntry` 필수는 `kind:PURPOSE/CONSTITUTION/DECISION/FACT/HYPOTHESIS/FAILURE_SOLUTION/CAUTION,title,contentRef:ArtifactRef,sourceRefs:SourceRef[],reason,scope:{projectId,stageRefs,taskRefs},relatedRefs:TraceRef[]`다. 가설/제안/사용자 확정의 출처를 따로 보관하고 총괄이 임의로 사람 확정 사건을 만들지 않는다. 원문은 비밀 제거 여부·누락/추출 손실을 표시하며 별도 ID로 보존한다.

| 연산 | payload→응답·보호 조건 |
|---|---|
| `appendConversation` | `conversationId?,targetRoleRef,message:{kind:USER_INSTRUCTION/USER_MESSAGE/AGENT_OUTPUT/TOOL_FACT,bodyRef,attachmentRefs,replyTo?,supersedesInstructionRef?,effectiveScope},sourceRefs`→`SourceRef,serverSequence,deliveryState:STORED`. 작성 주체는 인증/binding/실행 소유로 검증. AGENT_OUTPUT을 USER_INSTRUCTION으로 위장 금지. 저장≠전달/수행. 정정은 새 발언 |
| `saveKnowledge` | `entry:KnowledgeEntry`→새 KnowledgeVersion/상태 제안. 헌법/중요 결정 확정·공유는 별도 권한/사람 결정 필요 |
| `confirmKnowledge` | `versionRef,reviewRefs,reason`→확정 사건. 사용자 목적/헌법 변경·공통 공유를 단순 요약 편집에 숨기지 않음. 현재 임무 자동 기준 교체0 |
| `correctKnowledge` | `baseRef,entry,reason,sourceRefs`→새 version·supersedes 연결. 원문/이전 버전 보존, stale409 |
| `excludeKnowledge` | `versionRef,reason`→사용 제외 사건. 삭제 아님, 이후 새 맥락 자동 선택에서 제외. 기존 전달본은 당시 기준으로 보존/표시 |
| `requestKnowledgeShare` | `versionRefs,explicitTargets:배열<{projectId 또는 commonScopeId}>,purpose,approvalRef?`→공유 제안/상태. 범위/민감자료 확인·정확한 사람 공유 승인 전 복사/전송0 |
| `searchKnowledge` | GET knowledge?`query,kind,status,cursor,limit`→`Page<{versionRef,title,kind,sourceRefs,reasonSnippet,state}>`. 프로젝트 접근 조건을 검색 전에 적용. 제외/과거는 명시 필터에서 조회 가능하되 새 임무 기본 선택에서 제외. 다른 프로젝트 이름/건수·원문 존재 유출0 |

헌법은 kind CONSTITUTION의 지식 버전으로 저장하고 별도 원문 복제를 만들지 않는다. GET constitution은 현재 프로젝트에 적용된 versionRef·본문/원문·대체 이력·임무별 적용/이해 상태를 반환한다. 그 표시는 ‘Agent가 준수했다’는 무조건 보증이 아니다. 원문/지식 본문은 UI10에서, 작성된 공식 산출물은 UI06에서 열며 서로의 저장소/종류를 혼동하지 않는다.

초기 사용자 대화 경로는 targetRoleRef=null인 프로젝트 공통 대화다. 신규 conversationId=null/targetId=null/expectedVersion=0, 기존은 conversationId=targetId와 expectedVersion=head serverSequence를 요구한다. message의 kind는 현재 인증 HUMAN의 USER_MESSAGE/USER_INSTRUCTION만 수용하고, attachmentRefs/sourceRefs/stageRefs/taskRefs는 아직 빈 배열만 허용한다. replyTo/supersedesInstructionRef는 동일 대화의 실제 CONVERSATION SourceRef(kind/id/contentHash)이고 지시 정정은 앞 USER_INSTRUCTION을 보존한 새 순번이다. `GET conversations/:conversationId/messages/:messageId`는 정확 SourceRef/서버 순번·사람 출처·body·STORED/원문 검사 범위를 반환한다. Agent/도구 발언·역할 연결·실제 전달·자동 실행은 미연결412, 원문 덮기/삭제0이다.

대화 저장 후속: KnowledgeEntry.sourceRefs의 CONVERSATION/USER_INSTRUCTION(kind/id/contentHash)은 이제 같은 프로젝트 conversation_messages의 실제 불변 snapshot·원문/hash를 대조한다. USER_INSTRUCTION은 실제 저장 kind도 그 값이어야 하며 USER_MESSAGE/Agent를 지시로 승격하지 않는다. 원문 보존용 출처이지 정정된 옛 지시의 현재 임무 적용 승인이나 전달이 아니다. 위 앞선 미연결412 문구는 해당 이전 구현 시점의 이력이다.

대화 조회 후속: GET conversations?limit/cursor는 `id,headSequence,targetRoleRef,updatedAt,integrity:NOT_RECHECKED`의 유한 목록이다. GET conversations/:id/messages?limit/cursor는 서버 순번 내림차순으로 `sourceRef,serverSequence,authorRef,kind,replyTo,supersedesInstructionRef,recordedAt,deliveryState:STORED`를 반환하고 본문은 별도 명시 GET에서만 연다. 현재 회원 검사가 먼저이며 cursor는 actor/project/종류/대화/limit에 결박한다. 메시지 목록은 읽은 원문의 무결성을 재검사하되 저장/전달/수행을 합치지 않는다. 관측 시점 head를 반환하며 동시 신규 발언을 포함하는 고정 전체 snapshot이라고 주장하지 않는다.

지식 변경 경로: correctKnowledge는 exact baseRef=targetId/expectedVersion·현재 head/hash·같은 kind와 원문/변경 출처를 검사하고 새 PROPOSED 버전/CORRECTED 사건만 만든다. 앞 버전은 SUPERSEDED, 새 버전은 supersedesRef와 headVersion을 반환한다. excludeKnowledge는 exact versionRef=targetId/expectedVersion의 별도 EXCLUDED 사건이며 기본 제목/이유 검색에서 제외한다. `status=EXCLUDED`는 현 head의 제외본을 명시 조회한다. 과거 특정 버전 GET은 보존하되 과거 버전 목록/자동 복원은 아직 미연결이다. 제외된 head를 정정으로 몰래 되살리지 않고412로 거절한다. 확정·헌법 적용·공유/전달을 만들지 않는다.

### 10.4 맥락 준비·전달·6항목 이해 대조

`ContextItem`은 `itemId,category,required,sourceRef,sourceHash,reason,includedState:INCLUDED/MISSING/REDACTED/EXCLUDED,deliveryParts:배열`이다. `ContextBundle`은 `id,version,assignmentRef,baselineRefs,purposeRef,constitutionRef,latestInstructionRefs,currentPositionRef,items,missingRequired,excluded,deliveryPlan,budgetRef,contentHash`다. 필수 목적/헌법/최신 관련 지시/현재 위치·완료/미완료/원문 이유를 1-hop/예산 때문에 조용히 생략하지 않는다.

1. `buildTaskContext(assignmentRef,budgetRef)`는 서버 내부에서 허가된 원본을 조회하고 범위/민감·대체/제외를 검사해 불변 묶음을 만든다. 예산 초과는 분할/후속 수신 계획과 누락을 반환하고 READY로 만들지 않는다. 토큰 추정치와 실제 수신 용량은 구별한다.
2. 도구가 서버 링크를 못 열면 Anvil이 조회한 내용을 허가된 연결에 분할/후속 전달한다. `ContextDelivery{id,bundleRef,connectionRef,externalSessionRef,instructionId,partIds,receiptRefs,state}`로 실제 수신/실패/미확인을 남긴다. 임의 URL을 Agent의 서버/DB 접근 권한으로 바꾸지 않는다.
3. 로컬 참조 사본은 도구 능력·정확 허가 root/실경로·읽기 통제·자료별 hash·수명/정리 정책이 갖춰진 경우만 대안이다. 미지원/통제 불가면 분할 전달을 쓰거나 해당 전달을 차단한다. 실제 사본 생성은 FN06/08/11의 허가 후다.
4. `compareUnderstanding(bundleRef,responseRef)`는 새 도구 응답과 6항목 기준을 대조한 제안을 만든다. 항목 코드는 PURPOSE_REASON / RULES_SCOPE / DECISIONS_REASON / CURRENT_POSITION / ACTUAL_GAPS / NEXT_ACTION이다. 각 항목은 `{code,sourceRefs,responseLocation,result:MATCH/MISMATCH/MISSING,evidenceRefs,reviewerRef}`를 갖는다. 응답 hash/수신은 의미 합격이 아니다.
5. 검토 확정은 FN09의 `reviewUnderstanding` 또는 FN14의 `compareTransferUnderstanding/confirmTransfer`가 담당한다. 총괄 교체는 HUMAN, 단계책임자 교체는 현재 총괄이 확인하며 대상 Agent의 자기 합격 금지. 필수 미수신/불일치·실제 상태 모순이면 StartReadiness 실패다.
6. 묶음 생성 후 지시/헌법/기준·권한이 바뀌면 당시 묶음은 이력으로 유지하고 새 기준 묶음/이해 검토를 만든다. 전부 다시 전달하지 않고 영향 자료와 결정 변경을 명시한다. 과거 완료 업무를 다음 임무로 자동 재발행하지 않는다.

GET context/:id는 묶음 manifest·빠진 자료/전달/검토 상태를 같은 프로젝트 권한 안에서 조회한다. 전달·내용·이해가 각각 확인됐는지 보여주고, 외부 연결 미확인은 서버 검색/원문 조회를 막는 이유가 아니다. 내용·도구 대상·수신 사실이 없는 `read=true` 하나로 준비를 통과시키지 않는다.

### 10.4.1 FN05 준비 저장 후보 계약 — 2026-10-18

- 기존 프로젝트 commands의 `buildTaskContext`는 `targetId=null,expectedVersion=0,baselineRefs=[],approvalRef=null`과 context-input의 정확 `{assignmentRef,budgetRef,slots,limits,reason}`를 받는다. 확정 임무의 실제 기준과 payload의 원문 선택을 같은 transaction에서 재검사하고 새 불변 version1만 만든다. 명시 AUTO 정책/현재 OWNER·client·제어/세션·정책 만료/replay/감사를 소비하며 정책 자동 부여0이다. REQUIRE_APPROVAL 또는 approvalRef는 `CONTEXT_APPROVAL_NOT_CONNECTED`로 거절한다. 기존 uploadArtifact 전용 일회 승인 소비를 이 operation에 확장하지 않았다.
- ContextBundle의 저장 manifest는 기존 필드와 `projectId,preparationInput,sourceBindings,unverified`·항상 false인 검증/실행 플래그를 보존한다. contentHash는 자기 자신을 제외한 manifest canonical JSON의 SHA256이며 외부 `ref`로 결박한다. deliveryPlan의 각 부분은 `{partId,itemId,sourceRef,bodyRef,order,byteOffset,utf8Bytes,contentHash}`다. offset은 원문별 UTF8 바이트 기준, order는 전체 순서다. 본문/부분 text는 저장하지 않으며 byte/hash 계산·전달 계획은 실제 Agent 수신/이해가 아니다.
- `GET /api/v1/projects/:projectId/context/:id/versions/1`은 현재 회원 검사→영수증/manifest/items 정합성→기존 보호 원문 resolver 재조회를 수행한다. 응답은 `{projectId,ref,manifest,currentCheck,ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt}`다. currentCheck는 `MATCHED_METADATA/CHANGED/UNAVAILABLE`이며 의미 합격·최신 지시의 전체성/준비 완료가 아니다. 현재 원문/basis의 409·412만 UNAVAILABLE로 구분하고 403·404·서버 무결성 실패는 성공 응답으로 숨기지 않는다. 과거 manifest의 INCLUDED는 현재 허가로 쓰지 않는다.
- `GET /api/v1/projects/:projectId/context?assignmentId=...&assignmentVersion=...&assignmentHash=...&limit=...`은 정확 확정 임무를 먼저 확인하고 최근 후보만 기본20/최대50개 반환한다. 각 항목의 현재 원문을 재검사하고 `{ref,missingRequired,excluded,currentCheck}`를 제공한다. `hasMore`는 한도 밖 후보가 있음을 뜻하며 전체 이력/페이지 순회 구현 완료 주장이 아니다. 미등록 query는 거절한다.
- 복수 CURRENT_POSITION 선택은 모두 items/sourceBindings에 남기고 단일 currentPositionRef는 null·CURRENT_POSITION_AMBIGUOUS로 표시한다. 준비 생성만으로 원문 선정/최신 관련 지시 효력·현재 위치의 의미·예산·전달·이해·실행을 통과시키지 않는다.
- 새 forward0014 SQL/route는 후보이며 실제 DB 적용·권한/DML·동시성·served UI/Agent는 WORK_STATUS의 실제 증거 전 미검증이다. 기존 SQL/정식 서비스·실사용자 정책·자료 자동 삭제는 변경하지 않는다.

- 원 요청의 정확 payload는 별도 request_payload metadata로 보존한다. manifest.preparationInput은 계산용 슬롯 정규화본이며 원 명령의 request_hash/replay 의미를 바꾸지 않는다. 두 입력은 슬롯 순서를 제외한 내용·모든 선택/이유가 같아야 한다. SQL/GET은 원 payload로 요청 hash를 재구성하고 정규화 결과를 manifest와 대조한다.

### 10.5 초기 저장 흐름과의 교차 검수

FN01~03의 생성/저장은 FN11 공통 집행을 소비하며 실제 권한/초기 제어 검증을 IX05로 미루지 않는다. IX01은 두 프로젝트의 직접 ID·본문/첨부·검색 격리와 만료·옛 세대 변경 거절, 방법론→설계/화면 검토→작업계획→원문/지식 재조회를 확인한다. IX02/04는 전달/이해와 실제 Agent/회수를 별도로 검수한다. 이 절은 그 검수 입력/출력을 정의한 것이며 시험 결과가 아니다.

## 11. TD-02 승인 — Anvil 전용 로그인 상세

직접 응답 ‘Anvil 전용 로그인으로 설계’를 소비한다. 브라우저/Windows 설치형은 같은 서버 로그인/자료를 사용하고 외부 Agent 계정과 분리한다. 실제 계정·키·인증서·DB는 생성/변경하지 않았다. 아래 보안 방식은 승인한 1안의 상세이며 유한 수치 profile은 후속 TD-03 직접 응답 ‘P02 기본 정책안으로 설계 확정’과 TECH_DECISIONS §12에 결박한다.

### 11.1 초기 소유자·참여자·자격증명

공개 자가가입은 제공하지 않는다. 설치 준비 시 운영자가 허가된 경로에서 한 번만 초기화 비밀을 준비하고 화면의 소유자 등록에 사용한다. 실행 허가 없이 지금 비밀을 생성하지 않는다. 서버는 claim 가능한 미초기화 상태·비밀 hash/기한·미사용을 원자 확인해 첫 소유자/자격증명과 사용 완료 사건을 함께 저장한다. 단순 ‘첫 접속자’를 소유자로 만들지 않는다. 소비된 초기화 비밀·과거 서버 파일 복원으로 두 번째 소유자 claim 금지다.

소유자는 재인증 뒤 초대 대상의 이름/참여 범위와 일회 초대를 만든다. 초대 사용은 초대의 정확 사용자/범위·기한·미사용을 검사하고 본인이 새 비밀번호를 설정한다. 기존 사용자에게 프로젝트 참여를 허가하는 것과 서버 사용자 추가는 별도 연산이다. 초기화/초대/복구 비밀은 URL query·브라우저 로그/서버 로그·문서/Git에 담지 않는다. 전달은 사용자에게 보안상 영향·대상/기한을 보인 보호 경로로 하며 평문 비밀을 프로젝트 지식으로 수집하지 않는다.

로그인 이름은 `loginName` 원문/정규화값을 분리하고 동일 정규화 이름 UNIQUE다. 정규화는 ASCII 로그인 식별자 소문자화로 제한하며 표시 이름은 한국어 등 Unicode를 허용한다. 비밀번호는 임의 trim/대소문자 변환/잘라내기를 하지 않는다. Argon2id의 개별 salt/파라미터를 보관하고 직접 만든 암호 hash를 쓰지 않는다. 패키지/버전은 P03 공급망 검토·lockfile로 고정한다. 평문 fallback과 Agent 로그인 토큰 재사용 금지. 저장 방식 근거는 [OWASP 비밀번호 보관](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)이며 실제 성능/Windows 호환성은 미검증이다.

### 11.2 endpoint·입출력

| HTTP·연산 | 필수 입력→결과·중요 실패 |
|---|---|
| GET `/api/v1/auth/setup` | 비밀/프로젝트 없는 준비 화면용 `{setupRequired,policyVersion}`. 초기화 완료 후 claim 불가. 비공개 프로젝트/사용자 목록 노출0 |
| POST `/api/v1/auth/setup/claim` | `bootstrapSecret,loginName,displayName,password,commandId`→소유자 생성 결과. 비밀/기한/미사용·정책·미초기화 검사, 동시 claim1건만 성공. 자동 Agent 실행/공유 권한 부여0 |
| POST `/api/v1/auth/login` | `loginName,password,clientLabel`→서버 세션 cookie·`{user,clientId,csrfToken,expiresAt,absoluteExpiresAt}`. 잘못된 비밀번호/없는 이름/회수 계정은 같은 비밀 없는 실패 응답. 로그인/rehash·시도 제한은 별도 인증 gate |
| GET `/api/v1/session` | 유효 cookie→`{user,clientId,csrfToken,expiresAt,absoluteExpiresAt,reauthUntil}`. 인증 없음/만료401, cache 금지. 프로젝트 제어 grant 자동 발급0 |
| POST `/api/v1/auth/logout` | 현재 cookie·CSRF→204·서버 session revoke/cookie 만료. 반복은 안전한 종료, 권한 없음으로 현재 writer가 실제 멈췄다고 표시하지 않음 |
| POST `/api/v1/auth/reauthenticate` | 현재 cookie·CSRF·password→새 session 식별자/CSRF·`reauthUntil`. 구 session 회수, 기존 clientId 유지. 실패 시 민감 행위 허가0 |
| POST `/api/v1/auth/password` | cookie·CSRF·`currentPassword,newPassword,commandId`→변경/자격증명 세대 증가·모든 기존 session revoke. 새 로그인 요구. 관측 회수는 계속하되 사용자 권한으로 새 배정 금지 |
| POST `/api/v1/auth/invitations` | 소유자의 최근 재인증·CSRF·`loginName,displayName,projectGrants,expiresAt,commandId`→초대ID/한 번 전달할 비밀. 허가 범위 검사·새 비용/외부 발송 자동 생성0 |
| POST `/api/v1/auth/invitations/accept` | `invitationId,invitationSecret,password,commandId`→사용자·참여 저장 결과. 재사용/만료·위조 거절, 자동 로그인/제어 전환은 하지 않음 |
| POST `/api/v1/auth/recovery` | `loginName,recoverySecret,newPassword,commandId`→자격증명 교체·전체 session revoke. 없는 계정/잘못된 비밀은 같은 실패 형태, 비밀 일회 소비·회수 이력 유지 |
| POST `/api/v1/auth/recovery/rotate` | 최근 재인증·CSRF·commandId→새 일회 복구 비밀/이전 비밀 회수. 사용자 보호 보관 확인, 프로젝트 export/Agent 맥락에 포함하지 않음 |

초기 소유자 복구 비밀은 최초 claim 결과에서 한 번 보호 전달하고 서버에는 검증 hash만 보관한다. 잃었을 때 우회 master password/보안 질문/임의 DB 수정 절차를 만들지 않는다. 남은 세션의 재인증 또는 별도 승인된 서버 소유권 확인·복구 계획이 필요하다. 복구 수행은 프로젝트 원문 삭제/제어권 강탈 허가가 아니다. 초대·복구의 취소/기한과 실패 관측은 auth 감사로 남긴다.

이 인증 endpoint는 비밀번호/일회 비밀을 포함하므로 일반 CommandRequest의 payload·requestHash·감사/outbox 저장 경로로 보내지 않는다. 비밀 필드는 검증하는 동안만 다루고 로그/trace/실패 응답/증거 수집에서 제외한다. 인증 commandId 재전송은 현재 허가·완료 상태와 보호된 요청 fingerprint를 대조하며, 비밀번호의 단순 SHA256를 영속해 오프라인 추측 통로를 만들지 않는다. fingerprint는 분리된 서버 보호 키를 사용하는 HMAC과 비밀 아닌 연산/대상/command 문맥에 결박하는 설계이며 실제 키 생성/보호/회수는 P03 자원 승인 뒤다. 원 응답의 일회 비밀을 재전송 보관하려고 평문 저장하지 않는다. 응답 유실 시 완료 상태만 조회하고 허가된 새 발급/복구 절차로 처리한다.

### 11.3 세션·CSRF·회수 gate

세션 ID는 CSPRNG로 생성한 opaque 비밀이며 서버에는 digest만 저장한다. cookie는 `__Host-anvil.sid`, `Secure, HttpOnly, SameSite=Lax, Path=/`, Domain 없음으로 설계한다. 브라우저 localStorage/URL에 보관하지 않는다. 인증/자료 응답은 `Cache-Control: no-store`다. TLS 인증서를 무시하거나 HTTP에서 Secure를 꺼서 실제 인증을 통과시키지 않는다. 로컬 브라우저 시험의 HTTPS 제공은 P03 승인 자원 계약에 둔다. 세션 경계 근거: [OWASP 세션](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

세션 인증 변경 요청은 서버 세션에 결박한 `X-Anvil-CSRF`와 정확 허용 Origin/대상 서버를 확인한다. GET은 읽기만 한다. 로그인/claim/초대 수락/복구처럼 사전 세션이 없는 요청도 same-origin·허용 Content-Type·Origin 검사를 적용하고 열린 CORS를 두지 않는다. 브라우저가 보내는 임의 Host/프록시 헤더를 믿지 않으며 정식 외부 base origin/신뢰 proxy 설정은 P03에서 결박한다. 근거: [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

사용자 credentialGeneration·회수/만료와 session/client를 각 변경 transaction의 gate에서 다시 대조한다. role/control 검사는 그 다음이며 로그인 성공≠프로젝트 제어다. 비밀번호 변경/사용자 회수·session revoke가 같은 사용자 gate에 참여해 진행 중 새 변경과 경쟁을 직렬화한다. Web event 구독도 만료/회수 뒤 중단하고 캐시를 현재 권한으로 다시 조회한다. 이미 외부 도구에 전달된 작업의 실제 중지는 FN08/13로 관측하며 로그아웃만으로 안전 회수 완료를 주장하지 않는다.

민감 행위는 비밀번호/복구/초대·사용자/권한 변경·실행기 신뢰 등록/회수·원본 복원처럼 서버가 분류하고 최근 재인증 증거와 정확 행위 승인을 별도 대조한다. `reauthUntil`이 있다고 새 scope/운영 변경을 포괄 허가하지 않는다. 실패 응답은 이름 존재·hash·비밀·스택을 노출하지 않고 서버 requestId·허용된 조치만 제공한다. [OWASP 인증](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) 원칙을 상세화한 것이며 보안 검증 PASS가 아니다.

### 11.4 유한 기본 profile — TD-03 설계 기준

| 항목 | P02 검토용 값·조건 |
|---|---|
| 비밀번호 | MFA 없는 초기 범위에서 길이15~128자, 붙여넣기/관리자 허용·조용한 절단/상시 주기 변경 강제 없음. 유출 비밀번호 검사 자료/오프라인 제공 방식은 공급망/실제 자료 확인 전 미확정 |
| Argon2id | 최소 memory19MiB·iterations2·parallelism1 기준, 실제 HW에서 시간/메모리 측정 후 더 낮추지 않는 범위로 profile 고정. 구현 라이브러리/lock·동시 hash 작업 상한은 P03 확인 |
| 로그인/복구 제한 | 계정 정규화 식별자와 신뢰 관측 source별 각각 15분5회 실패 시 15분 지연 차단을 제안. 영구 계정 잠금/새 IP마다 무제한 우회 금지. 집계·시간 경과/재시작 보존·hash 실행 전 보호·오류 형태를 검수 |
| 세션 | idle30분·절대12시간·최근 재인증5분. 토큰 교체 시 구 토큰 무효, 갱신으로 absolute 기한 초기화 금지. 연결 끊김을 자동 logout/작업 완료로 대체하지 않음 |
| 초기화/초대/복구 | 초기화30분·초대24시간·복구 비밀은1회. 복구 비밀 재발급은 최근 재인증/명시 선택 필요. 만료/교체·원본 보관과 비밀 전달을 구분 |

이 수치는 최초 제안 뒤 TD-03으로 설계 기준 승인을 받았으며 실제 적용/측정 PASS 승인이 아니다. 실제 보안 테스트는 FN01/FN11/IX01의 정상 로그인·동시 claim·이름 비노출·CSRF·세션 고정/회수/만료·옛 제어·권한 경합·Secret 미기록을 포함한다. 정책 미설정/검증 실패를 느슨한 값으로 열지 않는다.

## 12. P02 계속 — 기존 Agent 연결·실행기 전달/관측/회수

FN06/07/08/13의 공통 어댑터와 서버↔Windows 실행기 계약이다. CAPABILITIES의 설치/공식 조사 결과를 그대로 소비하고 실제 연결 PASS로 바꾸지 않는다. 현재 첫/둘째 후보는 Codex App Server stdio·Claude 기존 CLI/SDK이며 제품/계정 사용 허용과 정확 버전 검증 뒤에만 actual 역할에 배정한다. Hermes/OpenCode는 설치 정보 외 미확인이다. 새 코딩 엔진이나 브라우저가 임의 명령을 실행하는 기능을 만들지 않는다.

### 12.1 연결·환경·능력 자료형

`ConnectionDefinition`: `id,version,label,toolProduct,toolVersion,adapterKind,connectorId,accountRef,modelOptions,environmentRef,policyRef,capabilityReportRef,status`. accountRef는 실행기 보호 저장 참조만 보관하며 토큰/비밀번호 원문이 아니다. 설정 저장/도구 창 열기를 READY/실제 연동으로 판정하지 않는다. 해제는 binding/허가를 회수하되 원문/실행/지식과 외부 계정을 삭제하지 않는다.

`EnvironmentVersion`: `id,version,sourceRoots:배열<{sourceRootId,hostId,displayLabel,registeredPathRef,identityRef,permissionScope}>,executionHostRef,targetHostRefs,commandProfileRefs,secretRefs,policyRef,contentHash`. 소스·도구 실행 host·WSL 등 시험/배포 대상을 구별한다. 실행기 PC 경로를 WSL 경로로 임의 치환하지 않고 승인된 매핑/실경로 관측이 없으면 실행 준비 실패다. 실제 경로/서비스/네트워크 생성은 환경 승인 뒤다.

`CapabilityReport` 항목은 `code,documentation:{source,observedAt,versionCompatibility:CONFIRMED/UNVERIFIED/UNSUPPORTED},measurement:{state:VERIFIED/UNVERIFIED/UNSUPPORTED,toolVersion,environmentRef,executionRef?,evidenceRefs},controlLevel:DIRECT/ISOLATED/OBSERVED_ONLY/UNVERIFIED,limitations`를 갖는다. 필수6능력의 원문/실측을 분리하며 명시하지 않은 능력은 미확인이다. 어떤 임무에서 해당 없으면 사유/검토자를 기록하고 요구 능력 부족을 `N/A`로 숨기지 않는다.

설정 명령은 §8의 registerConnection/updateConnection/saveEnvironment/detachConnection으로 받는다. 신규 등록은 `definition`/`environment`의 필수 입력과 보호 참조 유효성만 확인하며 LLM 호출0이다. update는 expectedVersion 필수·실행 중 scope 자동 확대0이다. probeConnection은 승인한 읽기/버전/schema 확인만, testConnection은 `testScope,expectedEvidence,budgetRef,approvalRef`를 가진 별도 실제 시험 임무다. 실제 쓰기/외부 전송/비용·도구 승인/OS 회수가 필요한 시험을 단순 연결 확인으로 우회하지 않는다.

### 12.2 실행기 등록·통신 경계

Windows 실행기가 정식 HTTPS 서버에 outbound 연결을 시작한다. 브라우저→PC listener나 외부 공개 로컬 제어 포트를 만들지 않는다. 사용자 로그인 cookie와 실행기 credential은 별개다. 실행기 등록은 소유자/허가 HUMAN의 최근 재인증·정확 host/범위·정책을 가진 일회 등록 요청→Windows에서 코드 제시→서버의 예상 host/지문 비교·사용자 확인→등록 완료 순의 설계 제안이다. 코드만 훔친 다른 host가 자동 신뢰되지 않게 확인하며 실제 code/credential 생성은 아직 하지 않는다.

- 사용자 `registerConnector` 명령 입력: `hostLabel,expectedHostFingerprint,allowedProjectRefs,environmentRefs,policyRef,expiresAt,reason`. 결과: 등록 요청ID/일회 코드·범위/기한. `confirmConnectorRegistration`은 `registrationId,observedHostFingerprint,scopeDigest,decision,reason`을 받아 정확 후보만 승인/거절한다. 실제 pairing token은 Agent 프롬프트·프로젝트 원본에 담지 않는다.
- POST `/api/v1/connectors/enroll`: `registrationId,oneTimeCode,observedHostFingerprint,clientNonce,connectorVersion`→확인 대기 receipt. 사용자 확인 전 명령/자료 접근0. 결정 후 등록된 host의 증명/nonce에 결박한 후속 교환으로 scoped credential을 발급하고 사용한 코드는 회수한다. 정확 host 증명/키 보호 방식은 OS binding·등록 보안 검토에서 확정하며 문자열 fingerprint만으로 암호학적 host 인증을 주장하지 않는다.
- 실행기 전용 GET `/api/v1/connectors/:connectorId/commands?afterCursor&waitMs`: credential/현재 허가/유한 대기 상한을 검사해 해당 실행기 명령만 반환한다. 전역 프로젝트 목록/자유명령 조회가 아니다. 새 command를 저장한 서버 outbox가 원본이며 전달 유실은 같은 commandId 재전달이다.
- POST 같은 prefix `/receipts`: `commandId,executionId,executionGeneration,state:RECEIVED/PREPARED/STARTED/REJECTED/UNKNOWN,localReceiptHash,observedAt,evidenceRefs`→서버 저장 receipt. durable 수신과 실제 도구 시작은 별도 관측이다. 중복/이미 처리된 command는 기존 receipt를 반환한다.
- POST 같은 prefix `/observations`: `executionId,executionGeneration,events:AgentEvent[],batchHash`→`ServerAck{executionId,generation,contiguousSequence,missingRanges,conflicts,receivedAt}`. 자신의 허가된 실행의 비밀 제거 관측만 허용한다. 누락/충돌을 성공 ACK로 덮지 않는다.
- POST 같은 prefix `/heartbeat`: `connectorGeneration,ownedExecutions,spoolStatus,processFactsRef,lastServerAck,policyVersion`→유효 상태/회수 통지. heartbeat 부재는 단절/미확인이지 자동 프로세스 종료/회수 완료가 아니다.
- `revokeConnector`는 허가 HUMAN의 최근 재인증·정확 ID/version/영향·reason을 검사해 새 전달/신뢰를 회수한다. 외부 도구 실제 중지는 별도다. credential 회수 뒤 로컬 미전송 spool은 보존하고 재등록/정확 회수 허가로 관측을 수집한다. 회수 credential에 일반 명령 권한을 다시 열지 않는다.

위 등록 방식은 P02 보안 상세 제안이며 host 증명/Secret 보호·갱신/기한·유실 복구와 유한 정책이 확정되기 전 배정 준비 완료가 아니다. TLS 검증 실패/신뢰 host 불일치·만료 credential은 전송/새 dispatch 차단이다. 서버 주소/인증서·Secret을 임의 생성·재사용·교체하지 않는다.

### 12.3 정규화 어댑터 함수와 결과

**FN06-CODEX-CODEC-01 내부 구현 범위:** primary/schemas.ts·codec.ts는 위 함수의 실제 세션/전달 구현이 아니라 고정0.161 JSON을 소비하는 순수 wire/사실 codec이다. 필수 인스턴스 예산 maxFrameBytes(1~2097152)/maxPending(1~1024), chunk당 maxFrameBytes+2로 프레임과 저장 식별 개수를 제한하고 LF/CRLF·분할 UTF8을 검사한다. 큰 송신은 전체 JSON/복제/Buffer 생성 전 escape/UTF8 바이트 예산에서 중단한다. 이미 주어진 입력·reflection·VM/OS 메모리의 강제 quota는 아니다. pending/최근 맥락은 메모리 상관일 뿐 서버 허가·내구 receipt/중복방지·통신 준비 증명이 아니다. initialize 응답과 initialized 바이트 준비를 구별하며 실제 전송은 없다. 잘못된 프레임/응답/맥락은 UNKNOWN·후속 wire 차단, 정상 빈 EOF는 CLOSED다. 외부 사실은 고정 enum/코드/digest만, tool completed/interrupt 응답은 업무합격/소유회수가 아니다. 승인 결정 소비는 미연결로 응답 wire0/UNVERIFIED이며 새 공개/권한 계약을 정의하지 않는다.

응답 순서를 실제로 확인했다고 가정하지 않는다. pending start/resume으로 설명 가능한 선도착 맥락은 maxPending 이하의 최소 식별만 CONTEXT_PENDING으로 보류하고 새 요청을 막는다. 정확 응답으로 대조한 뒤 보류만 해제하며 과거 payload/승인/완료를 재생하거나 소급 확정하지 않는다. 설명할 응답이 없어지거나 불일치/소진이면 UNKNOWN이다. 확정 thread/turn도 각각 유한 캐시에만 유지한다. 성공한 요청 id의 canonical digest는 initialize 포함 인스턴스 수명1024개로 제한하고 완료 뒤에도 재사용/축출하지 않으며 소진 시 닫는다. 재시작·다중 인스턴스의 durable replay 방지는 별도 미구현이다.

모든 함수는 `AdapterContext{projectId,assignmentId,executionId,executionGeneration,connectionRef,environmentRef,authorizationReceiptRef,capabilityRef,budgetRef,sourceScopes}`를 받으며 외부 session/thread/turn은 별도 외부 핸들이다.

1. `probeCapabilities(context)`→CapabilityReport. 정적/읽기 조사와 실제 임무 증거를 분리한다. 도구가 없는 경우 설치를 자동 수행하지 않는다.
2. `startSession(context,contextBundleRef,options)`→`SessionRef{anvilSessionId,externalHandle,toolVersion,startedAt,readiness}`. 필수 기준/능력·권한·소유 OS 준비·기한·budget 실패는 생성/LLM 요청 전에 거절한다. 새 프로젝트를 외부 Agent 계정 저장소에만 생성하지 않는다.
3. `sendInstruction(context,sessionRef,instructionId,parts)`→`DeliveryReceipt{instructionId,partReceipts,externalTurnRef,state,observedAt}`. 저장/전송/수신/수행과 구체 오류 분리. 같은 지시의 응답 유실은 원문/실제 상태 조회 후 처리하고 새 turn 자동 발행0이다.
4. `observe(context,sessionRef,afterCursor)`→정규화 AgentEvent와 공급자가 공개한 원문 artifactRefs. 비공개 내부 추론을 수집/추정하지 않는다. 알 수 없는 이벤트는 원문/해석 불가 사실로 남기고 임의 completed로 매핑하지 않는다.
5. `submitToolDecision(context,requestRef,decisionReceiptRef)`→`ToolDecisionReceipt`. 요청의 실제 tool/session/item·명령/파일 범위와 서버 일회 결정을 결박한다. 미지원이면 UNSUPPORTED와 근거, 무응답은 UNKNOWN이다. Anvil 승인과 도구 자체 안전심사를 같은 것으로 합치거나 skip-permissions로 우회하지 않는다.
6. `requestStop(context,sessionRef,scope)`→`StopReceipt{requestId,externalRequestRef,state:REQUESTED/UNSUPPORTED/UNKNOWN,observedAt}`. graceful/공식 interrupt부터 사용한다. 실제 종결/OS 쓰기 회수는 다음 절의 관측이며 요청 수락≠중지 확인이다.

Codex의 CAPABILITIES §3 method 후보·Claude §4 CLI/SDK 후보는 위 함수에 매핑하되 실제 설치 schema/계정·지원/비용을 검증하기 전 정규화 성공 fixture를 actual로 표시하지 않는다. 하나의 도구가 내부 승인 응답/안전 회수를 제공하지 않으면 그 변경 임무는 배정 불가다. UI11은 미확인 이유·가능 역할만 보여준다.

### 12.4 AgentEvent·spool·실제 상태

AgentEvent 기본 봉투는 §3을 사용한다. kind는 `DELIVERY_FACT,TOOL_OUTPUT,COMMAND_FACT,FILE_CHANGE_FACT,TOOL_APPROVAL_REQUEST,TOOL_DECISION_FACT,USAGE_FACT,RESULT_SUBMITTED,ERROR_FACT,REFUSAL_FACT,STOP_FACT,PROCESS_FACT,GAP_FACT`다. payload는 kind별 신뢰 schema로 제한하고 toolProduct/version·externalHandle·직접 관측/수행자 주장 출처를 함께 둔다.

- COMMAND_FACT: commandProfileRef·정확 허가 인자 참조·실제 cwd/host/sourceRoot·시작/종료·exitCode(미종결은 null)·stdout/stderr artifact·소유 processRef. timeout/도구 중단을 exit0으로 기록하지 않는다.
- FILE_CHANGE_FACT: 허가 root/상대 경로·실제 정체성 참조·전후 hash/존재/파일유형·diff/바이너리/미추적·관측 시각·허가 범위 대조. source 파일 내용 전체/Secret을 기본 수집하지 않는다. 단일 경로 문자열만으로 링크/교체·범위 통제를 증명하지 않는다.
- RESULT_SUBMITTED: 실제 임무/실행·수행자 제출 상태·manifest/증거 참조. 사용자 업무 완료/검수 합격으로 바로 전이하지 않는다.
- USAGE_FACT: 공급자가 관측한 사용량/요금·원시 단위·통화/관측 상태·누적/추정 여부·증거. 미관측 비용을0으로 두지 않는다. 재시작/세션 교체로 프로젝트 누적 한도를 초기화하지 않는다.
- GAP_FACT: 마지막 로컬/서버 연속 순번·알려진 누락 범위·원인 확정/미확인·보존 상태. 뒤 이벤트가 왔다고 앞 원문 공백을 숨기지 않는다.

실행기는 비밀 제거→정규화/원문 참조 hash→durable 로컬 sequence 저장→전송 순으로 처리한다. 같은 `(executionId,generation,sequence)`의 hash 불일치는 격리/무결성 문제이며 덮지 않는다. ACK는 서버 영속 수신한 연속 sequence까지만 전진한다. ACK 이전 자료 제거0, ACK 이후도 보존/민감 사본 정책과 참조 대조 없이 즉시 파기하지 않는다. 저장 불가/디스크 부족·상한 도달은 새 dispatch 차단·기존 사실의 공백 표시와 안전 중지 요청으로 연결한다.

### 12.5 Windows 소유·회수·소스 통제의 필수 계약

OS 소유 제공자는 `prepareOwnedProcess,launchOwnedProcess,observeOwnership,requestGracefulStop,verifyReclaimed`를 제공해야 한다. 정확 구현/빌드/패키지 파일은 검증 경로 선정 뒤 FILE_MAP에 바인딩한다. Node의 단순 PID kill/자식 목록만으로 모든 쓰기 회수를 보장하지 않는다. Windows Job Object 등 후보는 TECH_DECISIONS §4의 공식 근거와 실제 helper/이탈·잔류 검증을 함께 소비한다.

`ProcessIdentity`는 host/bootRef·PID·생성 시각·실행 파일 identity/hash·소유 실행/세대·job/소유 handle 참조를 결박한다. PID 재사용을 같은 process로 보지 않는다. `OwnershipFacts`는 관측 시각/출처·알려진 자식/이탈/잔류·도구 종결·등록 root 쓰기 상태·확인 불가 항목·기록 공백을 가진다. 경로/파일 통제는 OS 프로세스 소유와 별도이며 실제 도구 sandbox/실행 격리/직접 검사로 보장한 수준만 표시한다.

지원 중지→도구 종결→정확 소유 process/자식·쓰기 회수 확인 전 새 writer 배정0이다. 시간 경과/connection revoke/창 닫힘/Agent completed만으로 RECLAIMED를 만들지 않는다. 강제 종료는 정확 실행/현재 process identity·손실/공백·소유 확인·사용자 별도 지시가 있을 때만 허용하고 공유 서비스/서버/WSL/인증·ACL 변경으로 확대하지 않는다. 자동 kill-on-close 정책을 조용히 켜지 않는다.

교체/재기동 뒤 소유·파일/Git·마지막 서버/로컬 지점을 대조해 불명 부작용을 재실행하지 않는다. 변경의 staged/미추적/바이너리·삭제 상태·필요 ignored 자료를 보존한 뒤 명시 선택/정확 승인으로만 범위 복원한다. 실제 복원/보관/정리는 FN13/14/16 상세 연산과 기록을 소비한다.

## 13. P02 계속 — 임무·진행·판정·복구·이전

이 절은 FN09~15의 기존 요구를 공통 명령/저장/권한에 연결한다. TaskCard·VersionRef·ReviewRef·ActionScope는 앞 절을 상속하고 연산마다 서버 Context를 검사한다. 수행자가 제출한 자료·완료 문구는 실제 관측/검수 권한을 대신하지 않는다. UI04/05/07~10/12/13은 아래 같은 ID를 사용한다.

### 13.1 FN09 역할·임무·기준/세션 binding

`AssignmentDefinition` 필수: `taskRef,purpose,goal,baselineRefs,inputs,outputs,acceptanceCriteria,verificationRequirements,included,excluded,allowedScopes,environmentRef,requiredCapabilities,budgetRef,ownerRole,parentAssignmentRef?,recordingPolicyRef,integrationResponsibility`. 단순 단계 이름을 Agent에게 던지지 않고 왜/기준/할 일/하지 말 일/산출·검수·안전 재개까지 포함한다. 임무는 특정 공급자 계정이 아니라 Anvil ID다.

- `prepareAssignment`: 위 definition→`AssignmentDraft{id,version,definition,readinessIssues,contextBundleRef?}`. 미충족 기준/현재 위치·완료된 task를 실행 대상으로 삼은 사유 부재를 표시. 실제 dispatch0.
- `confirmAssignment`: `draftRef,reviewRefs`→불변 AssignmentVersion. 사용자 시작 범위/방법론의 허용된 자동 구체화인지 대조하고 새 요구/범위를 추가하지 않는다. 확정만으로 세션/실행 시작0.
- `bindResponsibleSession`: `assignmentRef,roleRef,connectionRef,existingSessionRef?`→`RoleBinding{id,generation,roleRef,assignmentRef,connectionRef,sessionRef?,readiness}`. 같은 책임 단계는 재작업도 기존 세션 유지가 기본. 교체는 FN14 절차를 소비하고 소유 불명 기존 writer를 밀어내지 않는다.
- `delegateSubtask`: `parentAssignmentRef,childDefinition,integrationResponsibility`→ChildAssignment. 부모의 기준/허용 범위·기한·한도의 부분집합, sibling writer 범위 겹침0. 위임 권한이 없다면 자식 생성 거절. subagent가 없거나 미지원이면 책임자가 직접 수행하고 지원을 꾸미지 않는다.
- `reviewUnderstanding`: `bundleRef,responseRef,subjectBindingRef,items:6항목,reason`→`StartReadiness{ready,issues,reviewRef,baselineRefs}`. 실제 검토 주체/필수 일치·수신/원본 hash·현재 상태를 확인. 총괄 교체 HUMAN/단계책임자 총괄 확인, 자기 합격0.
- `sendUserInstruction`: `targetRoleRef,bodyRef,attachmentRefs,mode:APPEND/AFTER_STOP,supersedesRef?,effectiveScope`→원문 SourceRef·저장/전달 상태. 사용자가 아닌 Agent 메시지를 사람 지시로 승격하지 않는다. AFTER_STOP은 정지/회수와 준비 확인 전 새 변경 turn을 시작하지 않는다.

GET assignments/:id는 불변 임무/부모·자식·책임 역할/세션 binding 이력·현재 실행/진행·전달/증거·원문·현재 기록 파일 ref를 반환한다. ‘현재 진행 없음’은 원인을 분류하고 정상 장시간/실제 승인 대기·명시 종료를 구별한다. 책임자의 기록 파일 미갱신은 누락이며 실행기 직접 관측으로 보완하되 존재만으로 최신이라고 하지 않는다.

### 13.2 FN10 자동/건별·분기·한도·queue

#### 2026-10-22 선택 검수 다음 행동의 서버 근거 조회 — 최신 부분 구현 계약

PMO 위임 결정으로 readonly `GET /api/v1/projects/:projectId/result-reviews/:id/next-action-basis` 1개를 추가한다. 입력은 두 UUID이며 query/body 확장은 없다. HUMAN 세션 쿠키·정확 host만 허용하고 Bearer/익명/중복 쿠키·추가 query는 거절한다. 같은 인증 transaction에서 기존 검수·원제출/확정임무·현재 적용 방법론 reader를 재사용한다. 현재 project/member를 전후 잠그고 선택 review의 정확 ref/hash→원 result→확정 assignment/task.application/node를 대조한다. 현재 방법론을 마지막에 다시 읽어 불일치면 거절하며 세션 기한은 DB에서 전후 확인하고 인증 COMMIT 이후에도 확인한다. 응답은 no-store다.

응답 필드: projectId/resultRef/reviewRef/assignmentRef/applicationRef/nodeId/nodeName/action/reviewOutcome/sourceAssurance/resultTransport/reviewObservedAt/applicationObservedAt/reasonCodes/completionAccepted/runtimeStateVerified/automaticTransitionPerformed/executionAuthorized/dispatchPerformed.

REWORK→REVIEW_REWORK_FOR_SELECTED_STAGE, BLOCKED→WAIT_HUMAN_UNBLOCK_DECISION 두 관계만 허용한다. sourceAssurance는 SERVER_STORED_REVIEW_WITH_CURRENT_METHODOLOGY이며 저장 검수와 현재 방법론 관계의 서버 대조만 뜻한다. reasonCodes는 COMPLETION_NOT_ACCEPTED/RUNTIME_STATE_NOT_VERIFIED/CURRENT_AUTHORITY_BUDGET_NOT_REVALIDATED, 마지막 5개 boolean은 모두 false다. 원 resultTransport를 유지하고 actual Provider/OS/완료 판정으로 승격하지 않는다.

UI05 기존 다음행동 버튼은 이 GET 하나만 소비한다. 고정 원검수·제출·임무·적용본 ref/hash·node·판정/행동·관측시각·정확 필드·false flags를 검사하며 오류/이탈/선택변경 때 이전 결과나 옛 두 GET 조합으로 우회하지 않는다. 기존 원검수 GET/현재 방법론 GET의 개별 기능은 유지한다. 아래의 'UI05 한정 소비' 문단은 이전 client 조합 방식의 이력이고 현재 연결은 이 계약을 따른다.

새 DB schema·쓰기/승인소비·권한 부여·완료수락·queue 저장·scheduler/dispatch·Agent 실행/비용·정식 서비스 변경은 없다. 전체 evaluateNext/현재 완료판정 제공자·실 scheduler는 계속 미완료다. 통제 DB ports HTTP→실Webreader와 실제 PG/served 화면을 구분한다.

- 2026-10-22 UI05 한정 소비: `readNextActionBasis`는 이미 명시선택한 결과·검수·확정임무의 hash/귀속을대조하고 기존 result-reviews GET 원문과 methodology-application GET의 현재 exact application/node를 재확인한다. 선택 REWORK는 해당단계의 보완검토, BLOCKED는 사람의 차단해제판단만 안내한다. 원결과 SYNTHETIC_ONLY는보존하며 실제 실행상태·총괄/사람의완료판정·AUTO/CASE/분기/합류provider가아니다. 현재적용변경/권한거절·이탈은이전값대체없이거절/폐기한다. sourceAssurance는보관검수+조회시점현재방법론에만한정하고 completionAccepted/runtimeStateVerified/automaticTransitionPerformed/executionAuthorized/dispatchPerformed=false다. 새서버API·DB·승인/명령·자동보완준비/dispatch는없으며 전체evaluateNext는후속미완료다.

#### FN10 WAITING 요청의 첫 서버 소비 — 미적용 SQL/소스 부분 구현

- 기존 project POST commands에 startStage/cancelQueuedRequest를 연결하고 GET `/api/v1/projects/:projectId/queue`는 HUMAN·same-host·query 없음으로 제공하는 소스다. DB 적용·화면/served·scheduler/Agent는 미검증이다. 신규 연산을 기존 사용자 정책에 자동 추가하지 않는다. 별도 명시 AUTO 정책만 허용하고 REQUIRE_APPROVAL/approvalRef는 STAGE_QUEUE_APPROVAL_NOT_CONNECTED로 거절한다.
- startStage payload exact: `{stageRef,methodologyApplicationRef,mode,startNodeRef,endBoundaryRef,baselineRefs,budgetRef,reason}`. 세 node ref는 `{applicationRef:VersionRef,nodeId}`, applicationRef는 공통 methodologyApplicationRef와 exact, stageRef=startNodeRef다. CASE_BY_CASE는 시작=끝, AUTO는 시작 노드가 AUTO이며 끝이 graph에서 도달 가능해야 한다. 외피 targetId=null/expectedVersion=0/baselineRefs=[]/approvalRef=null. baselineRefs는 이 payload 안에서 보존하되 현재 기준 검증으로 승격하지 않는다.
- 현재 제어·정책/세션·정확 적용 graph 및 현재 프로젝트 한도 정책 원문을 서버 reader로 대조한다. FN09의 실제 확정임무/책임 연결·기준/실행 verifier는 아직 이 요청에 연결하지 않았으므로 assignmentRef=null과 ASSIGNMENT_BINDING_UNVERIFIED/BASELINE_STATE_UNVERIFIED/EXECUTION_STATE_UNVERIFIED/DISPATCH_NOT_CONNECTED를 반드시 남긴다. 이는 WAITING ‘요청 보관’만 허용하는 부분 구현이지 실행 선행조건 통과가 아니다. 예약/새 writer·grant/outbox/한도 소비0이다.
- 미적용 `db/migrations/0036_stage_queue.sql`의 stage_runs는 project/id/단조 sequence/input/작성자/client/command/시각, queue_requests는 project/request/version/sequence/hash/snapshot/command의 불변 이력이다. v1 WAITING·v2 CANCELLED만 구현한다. 동일 project 잠금 아래 순번/CAS, 공통 command/receipt/audit와 역방향 COMMIT guard를 묶으며 실제 SQL 동작은 아직 검증하지 않았다.
- POST 결과는 기존 APPLIED 영수증 data의 `{ref,queueState,snapshot}`이며 snapshot의 slotReserved/writerReservationPerformed/executionAuthorized/dispatchPerformed는 false다. 명령 재확인은 기존 공통 계층의 현재 권한 검사 뒤 exact requestHash에만 과거 영수증을 반환하고 새 요청/실제 실행을 만들지 않는다.
- 취소 payload는 `{requestRef,reason}`, 외피 targetId=requestRef.id/expectedVersion=requestRef.version. 현재 허가 아래 정확 v1 WAITING만 v2 CANCELLED로 append한다. 예산 만료는 미시작 취소를 막지 않는다. 실제 stop·예약 해제·재개를 수행하지 않는다.
- GET은 단일 `{projectId,items,selection:"WAITING_ONLY",cancelledHistoryOmitted:true,observedAt,writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false}`. items는 `{requestRef,state:"WAITING",sequence,reasonCodes,blockedBy:[],reservedBudgetRef:null}`이며 cancelled 이력은 원 취소 영수증/불변 저장에 남긴다. blockedBy 빈 배열은 확인한 block 참조가 없다는 뜻이지 선행 통과가 아니다. 목록 200개를 넘으면 413 QUEUE_VIEW_LIMIT_EXCEEDED로 거절하고 일부를 전체인 것처럼 반환하지 않는다. 아직 RESERVED/DISPATCHED/UNKNOWN의 전체 lifecycle 구현·평가/실행 공급자는 없다.


- GET `projects/:projectId/limit-policies/:id/versions/:version/usage?contentHash=<정확hash>`는 현재 HUMAN 멤버·동일 host 아래 선택 정책 원문과 `usage_reservations` 프로젝트 전체 보관 원장을 읽는다. 필수 hash 외 query는 거절하고 읽기후 멤버를 다시 대조한다. 응답은 used/reserved·liveExecutions/unknownReservations·정책만료/회수 표식을 분리하며 `SERVER_STORED_LEDGER_ONLY/PROJECT_ALL_POLICIES`와 `currentPolicyVerified/providerChargesVerified/executionAuthorized/dispatchPerformed=false`다. 선택 임무의 전용 합계/현재정책·공급자 청구 검증이나 새 호출 허가가 아니며 queue/write/dispatch하지 않는다. UI05는 임무 budgetRef exact로 명시조회하고 재조회중 앞값숨김·권한거절시 부모원문회수를 수행한다.

- 내부 준비 구현 `evaluateSyntheticNext(raw)`는 고정 application/graph·선택 currentResult·typed 노드기록·AUTO/CASE·종료경계·fingerprint 누적입력에서 후보/대기 이유만 계산한다. hash는 입력 결박일 뿐 서버 사실 인증이 아니며 `SYNTHETIC_ONLY/UNAUTHENTICATED_INPUT_SNAPSHOTS`와 `serverFactsVerified/queueStored/writerReservationPerformed/executionAuthorized/dispatchPerformed=false`를 고정한다. HTTP/DB/Agent에는 등록하지 않고 실제 `evaluateNext` 제공자·허가/예산·queue/dispatch는 후속 미구현이다. ACCEPTED는 COMPLETED+completionRef 정합성을 요구하고 생략 단계의 잔존 값은 합류 완료 근거로 쓰지 않는다.

`startStage` 입력은 `stageRef,methodologyApplicationRef,mode:AUTO/CASE_BY_CASE,startNodeRef,endBoundaryRef,baselineRefs,budgetRef,approvalRef?`다. 결과는 `RunRequest{id,queueState,readinessIssues}`이고 서버 영속/대기→실행기 수신→실제 수행을 구별한다. CASE_BY_CASE는 선택한 단계의 내부 임무만, AUTO는 명시한 경계/승인 지점 전까지만 허가한다. 모드 변경이 진행 중 scope를 확대하지 않는다.

서버 내부 `evaluateNext(projectRef,resultRef)`는 정확 graph 버전·선행/분기/합류 조건·현재 typed 결과로 NextAction을 만든다. 자유문장 판단은 명시된 사람/총괄 판단 노드의 근거를 요구하고 임의 eval/도구 호출로 추정하지 않는다. 생략·취소/실패 분기를 완료로 세지 않는다. 재작업 edge도 설정한 시도·시간·비용 한도와 fingerprint를 누적하며 새 세션/재시작으로 초기화하지 않는다.

`applyLimitPolicy` 입력은 `limits:{maxAttempts,maxElapsedMs,maxCalls,maxConcurrentAssignments,maxCost?,currency?,maxSpoolBytes,maxOfflineMs},scope,reason,policyBaseVersion`다. 유한 값·현재 누적/예약·미관측 비용/통제 한계와 실제 외부 비용 승인을 대조한다. 정책 자체가 유료 호출 승인이나 특정 Agent의 내부 안전 해제는 아니다. 사용량 미관측/기한·예산 부족은 새 해당 호출 차단, 이미 발생한 비용 취소를 보장하지 않는다.

queue 항목은 `requestRef,state:WAITING/RESERVED/DISPATCHED/CANCELLED/UNKNOWN,reasonCodes,blockedBy,sequence,reservedBudgetRef?`다. `cancelQueuedRequest(requestRef,expectedVersion,reason)`는 아직 시작 안 한 요청을 취소하고 예약만 해제한다. 시작 여부 불명은 cancel=실제 중지로 바꾸지 않는다. 단일 writer 범위/OS 회수·현재 정책·기준·제어는 dispatch 직전 다시 검사한다. GET queue는 단일 QueueView이며 backlog를 가짜 진행률로 완료 처리하지 않는다.

### 13.3 FN12 결과 제출·검수·문제 분류

- GET `projects/:projectId/assignments/:id/versions/:version/result-pages?cursor=<선택>`는 기존 no-query results 목록과 별도다. 같은 ProjectListCodec의 사용자·프로젝트·정확 임무ref/hash·limit20·30분서명과 submitted_at/id keyset을 대조하며 20번째 표시행으로 nextCursor를 만든다. 매 행의 원결과/hash·원실행 결박과 조회 멤버를 재확인하고 `selectionState=NOT_SELECTED`/WORKER_CLAIM·출처/완료 미검증을 유지한다. UI05는 더 이전 페이지/원문을 명시선택하고 페이지전환·재조회중 앞원문/메타데이터를 숨긴다. 조회는 검수·보완실행·실패집계나 Agent가동을 만들지 않는다.

- UI05 완료 주장 점검은 기존 검증된 reported-coverage의 필수 조건별 미보고/미실행/불일치/출처미검증을 표시한다. COMPLETED 선언도 완료 근거 미확인이며 다른 제출 상태를 정상/완료로 바꾸지 않는다. 현재 중단원인은 공급자/OS 관측 미조회 상태로 남기고 오류/거부/대기/쿼터를 추정하지 않는다. 이 표시는 canonical Issue·검수/완료·실패집계·재실행·writer 회수·허가를 생성하지 않으며 새API/서버제공자·DB/정책은 없다.

- UI05 조건별 보고 대조는 선택 원제출/고정 기준에서 사용자가 고른 report/evidence만 소비한다. test ID·기준·환경·evidence ref/선언hash·명시 artifactRefs가 다르면 파일 GET 없이 이유를 표시하며, 일치하면 기존 산출물 text GET의 bytes/hash만 확인한다. `MATCHED_REGISTERED_BYTES`와 수행자 PASS/sourceKind 표기를 분리하고 실제 시험종류/수행·명령/exit·정확 commit·출처·합격/완료/정식실패집계는 검증하지 않는다. 선택/기준전환·재조회 중 앞원문 숨김과 권한거절 회수를 유지하며 새 API/서버제공자·증거출처 등록·schema/정책·Agent 호출은 없다.

- 제출 산출물 내부 GET `projects/:projectId/results/:id/artifacts/:artifactId/text`는 HUMAN·host/no-query·현재멤버 아래 exact 원제출 manifest.artifactRefs의 단일ID/v1/hash와 프로젝트 등록파일을 대조한다. 기존 보호 ArtifactStore의 소유/실경로·bytes/hash·격리/민감검사와 전후 파일metadata/멤버를 확인하고 UTF-8 plain/markdown만 fatal decode/BOM보존으로 반환한다. bytes 최대2MiB 외에 metadata·JSON escaping을 포함한 전체응답2MiB도 적용되므로 실제 허용 원문은 더 작을 수 있다. Web은 선택 result/artifact fullref와 UTF-8 bytes/hash·false flags를 대조해 명시조회/escaped텍스트로 표시하고 재조회대기·권한거절 시 앞원문을 재사용하지 않는다. `REGISTERED_BYTES_ONLY`는 저장바이트 일치일 뿐 실제Agent/명령·환경/시험출처/합격 검증이 아니며 자동다운로드·HTML/PDF/image실행·임의path/새schema/권한은 없다.

- 원실행 고정 결박 GET `projects/:projectId/results/:id/execution-source`는 HUMAN·host/no-query·현재 멤버를 검사하고 선택 결과 원문과 기존 역사 START/grant·봉투/권한영수증·감사의 정확 결박을 읽는다. 정규화된 `SYNTHETIC_RESULT_EXECUTION_REFERENCE`/`SYNTHETIC_ONLY` snapshot만 제공하며 raw credential/봉투 본문은 제공하지 않는다. `sourceState:HISTORICAL_REFERENCE_ONLY`, `observationState:NOT_QUERIED`이며 현재권한·실Provider관측·writer회수·완료·실패집계·실행은 false다. Web은 선택 결과/실행 ref/hash를 재대조하고 명시 조회·재조회대기 앞원문숨김·권한회수 처리를 제공한다. 이력 참조는 현재 실행 진위/원인 분류나 허가가 아니며 새 schema/정책·실Agent 호출은 없다.

- 원제출별 검수 이력 GET `projects/:projectId/results/:id/reviews`는 HUMAN멤버에게 정확 원제출의 최근20개 검수 metadata(ref/criteriaRef·판정/작성자/동일제출자/시각과 false승격 flags), hasMore/observedAt·NOT_SELECTED만 제공한다. 각 항목의 고정 원문·명령/영수증/감사를 다시 대조하고 원문은 기존 result-reviews/:id로 명시 선택한다. 자동 최신선택/합격판정·query/fallback·새권한/변경연산은 없다.

- `evaluateResult`의 최초 영속 연결은 실제 증거 제공자 미연결로 REWORK/BLOCKED만 지원한다. 기존 프로젝트 명령의 별도 명시 AUTO 정책·현재 HUMAN/단독 제어·세션·원제출/등록기준 exact ref/hash와 영수증/감사를 같은 tx에서 대조한다. 모든 기준을 항목별 이유/evidenceRefs=[]로 포함하고 ACCEPTED/NOT_APPLICABLE·임의 증거refs는 명확 거절한다. 새 result_reviews는 불변 원문·검수자와 제출자 동일성·시각을 보관하며 과거 판정을 덮지 않는다. GET `projects/:projectId/result-reviews/:id`는 HUMAN멤버 전용 고정 조회/query없음이며 저장만 reviewStored=true, completionAccepted/formalFailureCounted/evidenceProvenanceVerified/executionAuthorized/dispatchPerformed=false다. 합격 검수·실제 증거 bytes·보완 실행/자동기준 적용·정식DB 반영은 미연결이며 후속 구현 대상으로 남긴다.

- 보고 coverage의 내부 GET `projects/:projectId/results/:resultId/criteria/:criteriaId/versions/:version/reported-coverage`는 HUMAN멤버 read tx에서 별도 저장 원제출/등록기준과 정확 임무·hash를 대조한다. `purpose:REPORTED_COVERAGE_ONLY`로 미보고/보고미실행·중복·다른시험ID·기준/환경차이·미등록조건을 원주장과 함께 반환한다. PASS/출처표시는 수행자 선언이며 검수 저장/완료·실패집계/증거진위·실행false다. 등록증거/산출물 bytes를 읽거나 기존 거절을 우회하지 않고 최신기준 자동선택·권한부여·query/fallback·변경연산은 없다.

- 보관 기준 탐색 GET `projects/:projectId/assignments/:id/versions/:version/result-criteria`는 HUMAN 멤버 전용이며 exact 확정 임무의 최근20 불변 버전 metadata(ref/작성자/등록시각/조건수·저장/검수false flags), hasMore/observedAt와 `selectionState:NOT_SELECTED`를 반환한다. 각 원문의 해시/영수증/감사를 재대조하며 최신 자동 선택/활성·임의 query/fallback·새 권한 부여는 없다. 선택 원문은 기존 고정 버전 GET로 별도 확인한다.

`ResultManifest`: `assignmentRef,executionRef,baselineRefs,submissionState:COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED/CANCELLED,changes:배열,commandResults:배열,testResults:배열,artifactRefs,unexecuted,risks,rollback,checkpointRef`. 각 증거는 `sourceKind:WORKER_CLAIM/CONNECTOR_OBSERVED/TEST_ARTIFACT/REVIEWER_CONFIRMED,ref,contentHash,environmentRef,recordedAt`를 가진다. commandResult는 profile/정확 인자·cwd/host·실행ID·시각·exit/원문 참조를, testResult는 criterion/testID·기준/기대/실제·PASS/FAIL/NOT_EXECUTED/BLOCKED/NOT_APPLICABLE·근거를 가진다.

- `submitResult(assignmentRef,manifest)`→SubmittedResult. 완료 조건별 실제 근거와 누락을 수집하며 제출 상태를 검수 ACCEPTED로 변환하지 않는다.
- UI05 조회의 내부 HTTP 구체화: HUMAN 인증·프로젝트 멤버 확인 아래 GET `projects/:projectId/assignments/:id/versions/:version/results`는 정확 내용 확정 assignmentRef의 최근20 제출 metadata와 hasMore/observedAt를 반환한다. GET `projects/:projectId/results/:id`는 원문 ref/snapshot이다. 추가 query/fallback을 허용하지 않으며 서버는 원문·원 실행·해시와 멤버를 다시 대조한다. Web은 선택 임무/실행·목록 ref/manifest hash와 원문 hash·false flags를 확인하고 escaped 텍스트로 표시한다. 재선택/새로고침·접근실패 때 이전 원문을 현재 자료로 재사용하지 않는다. source·합성 연결 부분이며 오래된 이력/실제 증거 bytes·검수/보완 처리는 미완료다. 새 schema/실제 정책·Agent 실행을 허용하지 않는다.
- `evaluateResult(resultRef,criteriaRef,items,reason)`→`ReviewDecision{id,outcome:ACCEPTED/REWORK/BLOCKED,items,unverified,reviewerRef,reviewedAt}`. 별도 검수 권한·정확 기준/환경·실제 파일/원문/시험을 대조. 실행하지 않은 테스트를 PASS로 쓴 근거는 거절한다. 작성자와 검수자의 동일성/독립 검수 제한은 숨기지 않는다.
- 검수 원문 준비의 내부 GET `projects/:projectId/results/:id/review-sources`는 기존 HUMAN 인증·멤버 조회 아래 원제출과 exact 내용확정 임무 원문/hash를 같은 tx에서 대조한다. `criteriaState:TEXT_ONLY_NOT_MAPPED`와 기준 불일치/미정 환경/누락 조건을 표시하며 문구를 시험 ID/종류로 추론하지 않는다. typed 기준·등록 증거의 실제 결박과 검수 저장은 아직 미연결이고 `reviewStored/completionAccepted/executionAuthorized/dispatchPerformed=false`다. 추가 query/fallback 금지·합계2MiB·최종 membership 재검사, 새 schema/정책 부여·Agent 실행 없음.
- `requestRework(resultRef,missingItems,scope,reason)`→ReworkAssignment. 같은 단계/세션이 기본, 변경 영향/미달만 대상이며 완료 항목 전부 재실행0. 정식 실패는 fingerprint/lineage·원인·증거·남은 작업/판단 요구를 갖춘 제출만 집계한다.
- 이전 보완 페이지의 내부 GET `projects/:projectId/results/:id/rework-pages`는 optional cursor만 받으며 기존 `/reworks`의 no-query 계약은 그대로다. 기존 ProjectListCodec 서명·30분만료/사용자·project/정확 resultRef/hash·limit20을 결박하고 `(created_at,id)` 이전 keyset으로 최대20개/hasMore/nextCursor를 반환한다. nextCursor는 추가페이지일 때만 있으며 첫/이전 페이지와 선택원문은 각각 사용자가 명시조회한다. 페이지 변경·현재 요청 거절/재조회 중 이전 목록/원문은 숨기고 자동 원문선택/후속조회·실행은 하지 않는다. 이 읽기에 새 정책/키발급·schema는 없다.
- 보관 보완 발견의 내부 GET `projects/:projectId/results/:id/reworks`는 HUMAN·host·no-query·현재 멤버 아래 실제 원제출과 각 보완의 고정 원문/명령·영수증·감사를 대조해 최근20개와 hasMore/NOT_SELECTED를 반환한다. metadata는 ref·reviewRef·responsibleBindingRef·stageSessionRef·선택/잔여조건·HUMAN요청자/시간과 저장=true/현재예약·권한·완료·실패집계·실행=false다. 목록/원문은 각각 명시조회하며 원문 GET은 선택 ref/hash·원제출/확정임무·허용source subset·metadata 일치를 다시 확인한다. 현재 예약 변경 뒤에도 과거원문은 보존하고 자동선택·새배정/실행은 하지 않는다. 실제PG/served/종료복원 여부는 WORK_STATUS의 실행 증거와 구분한다.
- 불변 초안 저장은 기존 project command의 `requestRework`로 같은 여섯 입력을 저장하고 GET `projects/:projectId/result-reworks/:id`로 고정 원문을 조회한다. 현재 HUMAN/단독제어·별도 명시 AUTO정책/세션·최신 같은단계 예약·현재 확정임무/방법론·현재 계획 확정과 SQL 직접기록/COMMIT까지 대조한다. 별도 승인이 필요한 정책은 연결하지 않고 새 정책을 자동 부여하지 않는다. `reworkStored=true`만 저장 사실이며 `currentBindingVerified/currentAuthorityVerified/completionAccepted/formalFailureCounted/executionAuthorized/dispatchPerformed=false`로 보존한다. 저장은 새 실제 임무/worker 배정·Agent 호출이 아니며, 과거 이력 조회는 현재 권한/예약을 승인하지 않는다. UI05는 준비와 고정명령/명시저장·exactGET를 분리해 연결했고 주체/원문별 App메모리의 미확인 같은명령을 화면왕복 뒤 보존한다. APPLIED뒤GET거절은 확정실패/새명령으로 바꾸지 않는다. 페이지 새로고침/종료의 미확인명령 복원과 정식DB/served 반영은 미연결이며 합성클릭·실제격리PG 증거는 분리한다.
- 내부 준비 구체화 POST `projects/:projectId/result-reworks/prepare`는 HUMAN/CSRF·동일 origin·멤버 조회 아래 `resultRef,reviewRef,responsibleBindingRef,missingItems,sourceScopes,reason`를 소비한다. 서버의 고정 확정임무/등록기준·보완/차단 검수·같은단계 역할/예약 reader 원문으로 대조하며 선택 부족조건·잔여조건/같은 Anvil 예약세션·임무 허용범위 subset을 반환한다. `reworkStored/currentBindingVerified/currentAuthorityVerified/completionAccepted/formalFailureCounted/executionAuthorized/dispatchPerformed=false`, scopeVerification은 `ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED`다. 준비는 현재 예약/OS영향·권한 검증이나 저장/새 임무·writer/실Agent 호출이 아니며 자동 조건선택·범위확대·합격재실행을 하지 않는다. 실제 보완 저장/배정은 후속 별도 현재성·권한/영수증·감사 경계다.
- 고정 검수 기준의 내부 입력 준비는 확정 임무 ref/hash와 `baseRef,items:[criterionId,testId,kind,environmentRef,sources:[field:acceptanceCriteria/verificationRequirements,index,contentHash]],reason`를 대조한다. 모든 원조건·문구hash와 동일 환경ref를 명시 매핑하고, 선택사항 구분이 없는 현재 조건은 required=true로 보존한다. 기존 `assignmentRef,baselineRefs,items` criteria snapshot과 source binding을 준비할 뿐 `registryStored=false`이며 실제 저장/권한·환경 관측/등록 증거·검수·완료/실행을 대신하지 않는다. 문구 기반 자동 종류/환경 추정은 하지 않는다.
- 내부 `classifyExecutionIssue(facts)`→`IssueClassification{kind,evidenceRefs,knownFacts,unknowns,impact,nextChoices,requiresHumanDecision}`. kind는 TOOL_ERROR/EXPLICIT_REFUSAL/APPROVAL_WAIT/INPUT_WAIT/QUOTA/TRANSPORT_LOSS/OBSERVATION_GAP/UNVERIFIED_CAUSE/INSUFFICIENT_COMPLETION_EVIDENCE다. 정상 장시간을 idle로 단정하거나 내부 거부 사유를 추측하지 않는다.
- 고정 기준 보관의 내부 구체화 `saveResultCriteria`는 기존 project command의 현재 HUMAN/제어 세대·별도 명시 PROJECT 정책 아래 위 입력을 불변 새 버전에 보관한다. 최초 targetId=null/expectedVersion=0/baseRef=null, 개정은 exact 직전 ref와 버전이며 이전 이력을 덮지 않는다. GET `projects/:projectId/result-criteria/:id/versions/:version`은 멤버 확인·정확 원문/input/영수증/감사 대응을 대조한다. `registryStored=true`는 저장만 뜻하고 `reviewStored/completionAccepted/executionAuthorized/dispatchPerformed=false`다. 실제 사용자 정책 자동 부여·기준 자동 적용·환경 가동/증거 검증/Agent·정식DB 반영은 하지 않으며 일회 승인 소비는 이 저장에 연결하지 않고 명시 AUTO 정책만 허용한다.

사용자는 UI05에서 실제 변경/명령·기준별 판정·미실행과 현재 위치를 열고 UI08에서 정확 문제/선택을 본다. 수행자 제출·업무 진행/기능4상태·검수/실행/회수는 각각 표시한다. 전체 완료는 해당 TaskCard 조건과 실제 연결 검수가 충족됐을 때만 판정하며 fixture/빌드를 DB/Agent/배포 합격으로 승격하지 않는다.

2026-10-21 UI08 보고 원문 소비: UI05에서 선택한 정확 assignmentRef/ResultSummary만 같은 사용자·client·project의 메모리에 보존한다. 이동만으로 원문을 다시 읽거나 명령을 보내지 않고, UI08 명시 확인에서 기존 `GET projects/:projectId/results/:id`와 `readAssignmentResult`의 원문/hash·임무/실행·metadata 대조를 재사용한다. 보고 상태·미실행·위험/복구는 수행자 주장으로 표시하며 실제 원인/현재 실행·정식 실패집계/완료 판정을 만들지 않는다. 이탈/재조회/접근 거절·내용 불일치에서는 이전 원문을 숨긴다. 새로고침 뒤 선택은 복원되지 않으며 UI05에서 다시 선택한다. 새 endpoint/권한/저장·승인/재작업/교체/Agent 실행은 없고 실제 DB/served 검증은 별개다.

### 13.4 FN13 checkpoint·중지·재개·부분 변경 보존

`CheckpointState`: `assignmentRef,executionRefs,baselineRefs,currentPosition,completedItems,inProgress,remaining,sourceSnapshotRefs,changedFiles,verificationRefs,errorFingerprints,attemptCounts,lastLocalSequence,lastServerAck,untransmittedRefs,pendingDecisions,nextAction,forbiddenActions,recordFileRef`. `saveCheckpoint`는 서버 snapshot ID/hash·기준 시각/순번과 책임자가 읽을 파일을 연결한다. 둘이 다르면 차이를 보존하며 조용히 한쪽을 덮지 않는다. 기록 시점은 착수·주요 변경·검증·오류·중단/인계 전이다.

`requestStop(scope,reason)`의 scope는 실행/단계+하위/프로젝트 중 명시 대상이다. 접수 transaction에서 해당 새 배정 차단→공식 도구 중지 요청→실제 process/write facts 수집을 잇는다. 결과는 StopRequestRef이며 실제 회수 완료가 아니다. `observeStop`은 실행기/OS의 현재 facts만 소비하고 UNKNOWN/UNSUPPORTED/RESIDUAL/RECLAIMED를 근거와 함께 판정한다.

`reconcile(checkpointRef,observedSnapshotRefs)`→`Reconciliation{id,baselineDiff,sourceDiff,processDiff,receiptDiff,gaps,ownershipState,readyForResume,blockingReasons}`. 재기동·세션 소실 후 명령 결과/실제 파일이 불명이면 자동 replay하지 않는다. `resume(reconciliationRef,reason)`는 현재 사용자 지시/제어·기준·능력/예산·writer 회수·맥락/이해를 재검사한 뒤 미완료 지점의 RunRequest만 만든다. 읽기 조회는 안전 재개 불가여도 계속 가능하다.

부분 변경의 첫 선택은 보존한 채 계속 보완이다. 분리 보관/복원을 고르면 다음 별도 허가 연산을 사용한다.

1. `prepareChangePreservation(reconciliationRef,sourceScope,checkpointRef)`→변경 소유/기준·tracked/staged/미추적/바이너리·삭제/필요 ignored manifest, 보관 위치/수명·보호·손실 위험/재구성 검사 계획. writer 회수·경로/소유 혼재·Secret을 먼저 검사한다.
2. `preserveChanges(preservationPlanRef,approvalRef)`→검증된 PreservationReceipt. patch만으로 복구할 수 없는 자료도 포함하고 실제 목록/바이트/hash·재구성 결과를 확인한다. 실패하면 원본을 변경하지 않는다.
3. `restoreSourceScope(preservationReceiptRef,checkpointRef,exactScope,expectedCurrentHashes,approvalRef)`→`SourceRestoreReceipt{beforeRefs,afterRefs,verificationRefs,gaps}`. 정확 사용자 승인·보존/회수·현재 hash 재검증 후 허가 파일만 복원한다. 그 사이 변경/혼재·경로 교체/불명 원본이면 차단. 자동 reset/일괄 stash/clean·공유 서비스 재시작 금지다.

보존본 삭제는 위 복원 명령에 포함하지 않는다. 실제 복원과 무관한 사용자 변경을 유지하며 새 writer는 복원·필요 검사·맥락 준비 뒤에만 시작한다. 이 절은 기존 비상/인계 요구의 연산 명세이고 실제 파일 보존/복원은 실행하지 않았다.

### 13.5 FN14 최소 손실 교체/이전

`prepareTransfer(roleRef,targetConnectionRef,reason)`→TransferDraft. 원 도구의 마지막 요약에 의존하지 않고 서버/로컬 회수·checkpoint/원문/결정 이유/실제 소스·기록 공백을 모은다. 원 binding 동결·중지/회수와 후보 능력/계정/정책을 대조하며 임의 강제 종료0이다. 동일 도구 새 세션/다른 도구/총괄 교체를 같은 절차의 서로 다른 사례로 기록한다.

GET transfers/:id/manifest→`TransferManifest{roleRef,oldBindingRef,targetRef,baselineRefs,completed,unfinished,currentPosition,decisionsWithReasons,sourceRefs,sourceDiffs,recoveryState,gaps,capabilities,requiredContext,contentHash}`. ID/현재 버전만 아닌 원문/자료가 실제 열려야 한다. 최소 손실은 필수 기준 유지·완료 반복/결정 번복/누락·추가 설명/실제 재개 결과를 항목별로 기록하고 0손실을 보장하지 않는다.

`compareTransferUnderstanding(transferRef,responseRef,items)`→6항목 검토 제안/보완. `confirmTransfer(transferRef,reviewRef,observedStateRefs,reason)`→새 RoleBinding generation. 총괄은 HUMAN·단계는 현재 총괄 확인, 실제 회수/필수 맥락/이해·현재 상태 모순 해소를 검사하고 이전 binding 회수/새 binding·원문 이력을 원자 저장한다. 이것만으로 writer를 실행하지 않고 별도 재개 조건을 검사한다. 새 도구 미지원/필수 손실 미수용이면 해당 이전은 차단하되 Anvil 원문 조회/대안 검토를 막지 않는다.

### 13.6 FN15 사람·클라이언트 단독 제어

`requestControl(targetActorRef,targetClientRef,reason)`→ControlRequest. 허가된 참여자는 제어가 없어도 요청할 수 있지만 요청만으로 편집/승인을 허용하지 않는다. `prepareControlHandoff(requestRef)`→`HandoffSummary{version,currentController,activeExecutions,pendingCommands,pendingApprovals,source/checkpointRefs,gaps,safetyState}`. 실행기 실제 상태·미전송/소유 불명을 공개하고 안전 전환 조건이 없으면 인수 대기다.

`acceptControl(requestRef,summaryVersion,reason)`는 정확 대상 사용자/기기가 현재 요약을 수락하고 서버가 권한·상태·세대를 다시 대조해 project_control 행의 이전 grant 회수·generation 증가·새 grant/이력을 한 transaction에서 저장한다. 두 동시 수락 중 한 건만 성공한다. 이전 client의 변경/승인·대기 명령은 새 세대에서 재허가 없이 수행0, 구 tab은 조회로 전환한다. 같은 사용자 기기 전환도 세대를 바꾸며 미확인 실행을 새로 dispatch하지 않는다.

GET control은 현재 제어/조회 권한·요청/상태·세대를 반환한다. client 접속 단절·세션 만료가 제어권 자동 강탈/새 writer 근거는 아니다. 안전 확인/수락 전 기존 상태와 막힌 사유를 표시하고 모바일 전용 승인 위임이나 두 사람 동시 writer를 추가하지 않는다.

## 14. P02 계속 — 백업/복원·알림·Windows 설치형

### 14.1 FN16 사용자 원본의 반출·백업·검증 복원

`BackupPolicyVersion`은 `targetProtectedRef,include:{documents,conversations,knowledge,decisions,plans,results,artifacts,sourceSelection},schedule,maxBytes,retentionPolicyRef,encryptionKeyRef,verificationPolicyRef`다. 임의 외부 저장·기존 Backup 폴더를 자동 대상 지정0, 비밀/Agent 계정·세션/실행 권한/키를 원본 bundle에 넣지 않는다. 설정 저장과 자동 스케줄 활성화·실제 삭제는 각각 다른 허가다.

- `saveBackupPolicy(policy,reason)`→새 불변 policy/version·영향 preview. 유한 수치/위치/키·보존/참조 검사가 없으면 자동 활성화 불가.
- `createBackup(policyRef,sourceSelection,reason)`→BackupJob receipt·최종 BackupManifest. 명령 접수와 실제 완료를 구분한다. 현재 DB와 파일의 일관 기준·영속 상태를 고정하고 포함/제외/읽기 실패·hash/bytes/관계·원문 버전·정리 결과를 기록한다.
- `exportProject(includeSource,selection,reason)`→동일한 공개 형식의 ExportManifest. source 선택은 tracked/미추적/바이너리·삭제/필요 ignored를 명시 확인하고 누락을 숨기지 않는다. 자동 원격 업로드/공유는 포함하지 않는다.
- `validateRestore(backupRef,targetRef)`→RestoreReport. 별도 검증 위치에서 manifest/hash·자료/참조·원문/본문·예상 키 가용성·현재 schema 호환을 검사하고 Agent 로그인 없이 조회 확인, 실행0. 대상이 live이면 실제 쓰기 전에 거절하고 영향 준비로 전환한다.
- `compareRestoreImpact(reportRef,currentSnapshotRef)`→`RestoreImpact{version,target,overwrites,unaffected,missing,risks,authRecoveryRequired,rollback,scopeDigest}`. 같은 이름/폴더를 근거로 원본을 덮지 않는다.
- `confirmRestore(impactRef,approvalRef,expectedCurrentHashes)`→RestoreReceipt. 정확 사용자 승인·보존/복구/호환·실행/제어 회수·현재 상태 재검증 뒤만 적용한다. 인증 token/초대·승인/기존 writer 권한 자동 복원/재개0, 복구 세대/새 인증·연결 재확인 필요. 과거 실행/승인은 조회 이력으로만 보존한다.

발견된 민감 사본은 전송/일반 조회/복원 제한→정확 사본 ID/hash/의존 참조 파악→격리 표식/통지→승인된 대체/보존 검증/정리 순이다. 이미 생성된 bundle의 hash를 조용히 덮거나 server ACK만으로 spool/백업을 즉시 삭제하지 않는다. 생성/복원 실패는 manifest/원문을 보존하고 자동 원본 초기화0이다.

### 14.2 FN17 중요한 사건·모바일 전달

내부 `publishImportantEvent(eventRef)`는 서버가 분류한 승인/입력 요구·중요 오류·안전/기록 공백·한도·완료 후보 등 사용자 조치가 있는 사건만 선택한다. 일반 진도/성공/반복 대기는 push하지 않는다. `Notification`은 `id,eventRef,recipientRef,projectRef,severity,reason,authenticatedTarget,deliveryState,readAt?`를 가지며 같은 사건/수신자/channel UNIQUE다. payload에는 비밀/민감 본문/승인 token을 넣지 않는다.

`listNotifications(cursor)`→허가된 Page<Notification>. `getPushSupport(clientRef)`→`SUPPORTED/PERMISSION_REQUIRED/DENIED/UNSUPPORTED/UNVERIFIED`·근거. `registerPushPreference(channel,enabled,subscriptionProtectedRef,reason)`와 `markNotificationRead(notificationRef)`는 사용자/기기/현재 프로젝트를 대조한다. 실제 OS/브라우저 허가를 사용자 대신 자동 클릭하지 않는다. 클릭은 인증/요청 상세로 이동할 뿐 승인/제어 인수 명령이 아니다. 미지원은 in-app 목록·보호된 재조회 경로로 대체하고 실제 전달 PASS를 만들지 않는다.

### 14.3 FN18 Windows 앱·생명주기·업데이트 경계

Windows shell은 승인 서버/정확 origin만 표시하고 renderer의 Node 비활성·격리·sandbox/IPC allowlist·발신자/입력 schema를 적용한다. UI가 임의 파일/명령/계정 비밀을 요청할 수 없다. 설치형도 같은 로그인/session·project_control·원본을 쓰고 별도 프로젝트 DB를 만들지 않는다.

로컬 IPC는 `getClientStatus`, `setServerReference`, `prepareAppExit`, `confirmAppExit`, `getPackageStatus`처럼 등록된 목적별 연산만 허용한다. 서버 참조 변경은 URL/인증서/자료 전송 대상·현재 실행 영향과 사용자 선택을 검사하고 자동 권한 이전0이다. 보호 저장 접근은 실행기/메인 프로세스의 목적별 검증을 거치고 renderer에 원문 Secret을 돌려주지 않는다.

창 닫힘은 작업 취소가 아니다. prepareAppExit는 현재 실행/미전송 spool·회수/저장 상태를 반환하고 사용자는 창만 닫기/안전 종료 요청을 구별한다. 안전 종료는 기록·지원 중지 요청·실제 회수/미전송 보호를 확인하며 UNKNOWN이면 그 이유/현재 실행을 보존한다. 공유 process 자동 kill/OS 재시작0, 백그라운드 실행을 계속하는 방식은 실제 실행기 생명주기 검증·명시 설정 전 지원이라고 표시하지 않는다.

설치/update 입력은 source/버전·artifact hash·구성된 신뢰/서명 기준·호환성·실행/자료 보존·rollback을 검사한다. 설정 미정/출처/서명 검증 불가는 적용 차단·기존 정상본 유지다. package build만으로 Windows 설치/첫 실행/로그인·업데이트/복구·제거 PASS를 선언하지 않는다. 실제 사용자 PC 설치·서명 키/인증서·외부 배포·운영 전환은 별도 계획/허가를 소비한다.

## 15. 종료 전 누락 대조 — 생성 전 작성·검토·조건식

### 15.1 프로젝트 생성 전 직접 방법론 정의

초안 저장의 참조 선택은 `{kind:CONFIRMED_REFERENCE,versionRef}`로 고정한다. 저장 시 허가된 정확 SYSTEM 배포 원본 또는 본인 공통 확정/최신 ACCEPTED·그래프를 확인한다. 기본본 출처 승인과 Anvil 사용자 확정 사건은 다르며 이것은 선택 저장일 뿐 최종 생성/Agent 실행 승인이 아니다. NEW_PROJECT_DRAFT는 아래 name/purpose/graph/sourceRefs/reviewRefs를 보존하되 현재 reviewRefs=[]만 허용하고 DRAFT 검토/확정 연결 전 임의 refs는412로 거절한다. 초안의 서버 step·선택은 재조회로 유지하며 미저장 탭 버퍼의 owner가 현재 로그인과 다르면 표시/전송하지 않는다.
UI02의 생성 중간본은 `methodologySelection`을 가진다. kind는 CONFIRMED_REFERENCE 또는 NEW_PROJECT_DRAFT다. 전자는 허가된 SYSTEM/USER_COMMON VersionRef, 후자는 `name,purpose,graph:MethodologyGraph,sourceRefs,reviewRefs`의 현재 초안 내용을 project_drafts.input_json에 보관한다. 아직 없는 projectId/제어 세대를 만들거나 다른 프로젝트 전용본을 권한 없이 선택하지 않는다.

GET draft는 소유자에게 저장한 graph/좌표·원문·현재 단계/validation issues를 그대로 돌려준다. POST `/api/v1/project-drafts/:draftId/commands`의 명시 연산은 `importDocument`, `recordContentReview`, `confirmDraftMethodology`이며 DRAFT scope의 작성자/client·해당 자료/버전·초안 명령 중복만 허용한다. 이 경로로 프로젝트 실행/권한/임의 FN 명령을 dispatch할 수 없다. 파일 업로드의 원본/추출은 draft scope 참조로 보호한다.

`confirmDraftMethodology` 입력은 `draftVersion,graphHash,reviewRefs`다. 서버가 exact graph/양식·내용 검토·작성자 확인을 검사하고 DRAFT scope의 확정 사건을 저장한다. project 생성은 confirmed reference 또는 이 정확 초안 확정 사건을 필수로 대조한다. 신규 프로젝트/초안 소비·자료 귀속·전용 방법론 원본/version·프로젝트 적용 snapshot·초기 소유/제어·receipt를 하나의 DB transaction에서 만든다. stale draft/hash/잘못된 소유 자료·검토 누락이면 전체 rollback, 원래 초안/원문은 유지한다. 선택/생성이 Agent 시작을 유발하지 않는다.

최초 연결의 strict envelope는 `schemaVersion:1,commandId,clientId,targetId:draftId,expectedVersion,operation,payload`다. DRAFT 경로에서는 recordContentReview/confirmDraftMethodology 두 연산만 현재 지원하며 importDocument/실행은 연결 전 거절한다. 검토 payload의 targetKind는 DRAFT_METHODOLOGY, targetRef는 `{id:draftId,version:현재 초안 version,contentHash:graphHash}`다. 같은 METHOD5기준·빈 evidenceRefs·현재 HUMAN 주체와 작성자 동일 여부를 사용하고 독립 검수로 주장하지 않는다. 검토/확정은 본문 version을 늘리지 않고 별도 metadata `methodologyState:{ref,validation,contentReviewCriteria,contentReviews,confirmation}`로 GET/create/save draft에서 조회한다. input의 reviewRefs는 현재 []이고 확정이 이를 자동 편집하지 않는다. 새 draft version이나 최신 REWORK는 옛 확정으로 생성할 수 없다. 최초 POST projects의 실제 strict body는 `schemaVersion:1,commandId,clientId,draftId,draftVersion`이며 입력 원문·method selection은 저장본에서만 읽는다. 첫 생성 결과의 currentMethodologyRef는 project_methodologies의 `{id,version:application_version,contentHash:snapshot_hash}`로 출처 definition ref와 구별한다. 정책 미설정은 PERMISSION_POLICY_UNCONFIGURED, baselineRef는 실제 근거 전 null이며 실행/도구 준비 완료를 뜻하지 않는다.

### 15.2 내용 검토 기록·참여 권한

`recordContentReview`는 `targetKind:METHODOLOGY/FORM/DOCUMENT/WORK_PLAN/KNOWLEDGE/IMPACT/DRAFT_METHODOLOGY,targetRef,criteriaVersion,items:배열<{criterionId,outcome,evidenceRefs,reason}>,outcome,reason`을 받아 ReviewRef를 발급한다. 서버는 현재 주체의 검토 역할/소유·exact version/hash/양식 기준을 대조한다. 사람 직접 검토 또는 허가된 검토 임무의 근거를 기록하며 Agent가 자기 출력을 HUMAN_REVIEW로 위장할 수 없다. 이 기록은 내용 검토자의 판단이고 별도 사용자 확정/일회 실행 승인/실제 시험 PASS가 아니다. 각 도메인 모듈이 target별 조건을 검사하고 FN11 audit가 공통 주체/범위·이력을 기록한다.

본인 공통 자료 승인 범위의 최초 연결은 FORM이다. 동일 POST `/api/v1/user-common/commands`의 recordContentReview/confirmForm은 targetId=versionRef.id·expectedVersion=현재 head를 요구하며, 각각 `data.status:REVIEW_RECORDED + reviewRef` / `CONFIRMED + confirmationId`를 반환한다. 새 본문 version을 만들지 않는다. criteriaVersion1은 FORM_PURPOSE/FORM_ROLES/FORM_STRUCTURE/FORM_AUTHORING/FORM_REVIEW 5개이며 기준 원문·작성/검토 책임과 의미 적합성을 사람이 직접 읽고 항목별 판단·이유를 기록한다. server sourceKind/주체는 현재 인증에서만 결정하고 같은 사용자가 대상 기록자이면 이를 공개한다(독립 검수로 주장하지 않음). 자료 저장 연결 전 evidenceRefs는 []만 허용하고 임의 파일/시험 근거는412로 거절한다. 전체 ACCEPTED는5개 모두 ACCEPTED여야 하고 서버가 만든 현재 exact ReviewRef와 저장본을 다시 검사한 뒤만 확정한다. 최신 검토는 audit server_sequence 기준이며 최신이 REWORK/BLOCKED이면 앞선 ACCEPTED를 골라 확정할 수 없다. 확정 이력은 유지하되 새 버전은 다시 검토/확정해야 한다. 다른 도메인/프로젝트/DRAFT·할당 Agent 검토는 연결 전412이며 확정이 실행 승인을 만들지 않는다.

`saveProjectMembership`는 project 소유자의 최근 재인증·현재 제어/정확 정책 아래 `targetUserRef,participation:OWNER/VIEWER/HANDOFF_ELIGIBLE,reason,approvalRef?`를 받아 member 새 버전/감사를 만든다. VIEWER는 조회만, HANDOFF_ELIGIBLE은 조회/인수요청 후 실제 수락/단독 제어가 있어야 변경 가능하다. 마지막 유효 OWNER를 제거하는 변경·자기 임의 승격은 거절한다. 기존 Anvil 사용자 참여 허가와 새 사용자 초대를 구별하며 서버 사용자 목록은 별도 허가된 설치 관리 범위만 조회한다.

### 15.3 조건식·정규화·migration 경계

방법론 조건식은 `fieldRef,operator,value` 또는 `all/any/not` 조합의 제한된 데이터다. operator는 EQ/NE/IN/IS_PRESENT, fieldRef는 해당 node의 선언된 typed input/output·검수 outcome·판정/사용자 결정 참조 중 whitelist만 허용한다. 비교형이 다르면 오류이고 문자열 JS/정규식·prototype/property 경로·shell/eval을 실행하지 않는다. 실제 테스트/검수 결과 없는 필드를 truthy로 평가하지 않으며 미확인 분기는 판단 대기다. 사람/총괄 판단도 기준/이유·주체/typed decision을 저장한 뒤만 평가한다.

wire 정수는 JavaScript 안전 정수 범위 안의 유한 정수, 자료 크기/기한/비용은 단위가 명시된 정수값으로 제한한다. 비용은 currency+minorUnits이며 서로 다른 통화의 수치를 조용히 합산하지 않는다. graph 좌표처럼 실수 입력은 유한 IEEE 값의 고정 Node 정규화 codec으로 직렬화하고 -0 처리·중복 JSON key/비유한 수/잘못된 Unicode·동일내용 key순서/배열순서 사례를 벡터로 고정한다. 저장 BIGINT를 무제한 JSON number로 내보내지 않는다. 실제 codec은 P03 공통 파일에서 구현/검증한다.

초기 migration 적용 DAG는 모듈 개발 순서와 구별한다. 방법론이 공식 양식 version을 검증할 수 있도록 FN03의 양식 카탈로그 저장 schema/승인 기본8종을 포함하는 0003 storage를 0002 방법론 저장보다 먼저 준비할 수 있다. 0003의 단계/적용본 참조는 당시 미존재이면 resolver 검사/미연결로 보존하고 빈 임무/성공 증거를 만들지 않는다. 해당 최종 FK/seed·내용/체크섬과 실제 적용 순서는 P03 계약에 고정해 순환/선행 누락을 검수한다. 이는 FN02/FN03 최종 기능 검수를 생략하는 변경이 아니다.

### 15.4 기존 소스의 최초 선언·문서 연결과 드리프트 선택

2026-10-21 한정 확장: `detachDocumentSource`의 REQUIRE_APPROVAL은 기존 `requestApproval/decideApproval`과 `ApprovalRef`로 연결한다. `ActionScope.targetRef`는 ACTIVE sourceLink v1 전체 참조, expectedVersion1·원 candidateCommandId·payloadHash({sourceLinkRef,reason})·project/user/client/controlGeneration·현재 policyRef·유한 기한을 결박한다. 요청은 현재 OWNER/제어·별도 requestApproval 허가·detach REQUIRE_APPROVAL/DENY 우선·정확 원문 귀속과 잠긴 링크를 검사한다. 요청/결정만으로 소비·분리하지 않는다. UI06의 미전송 원명령에만 approvalRef를 붙이고 UI08 결정 후 UI06에서 별도 전송한다. 전송된/결과 미확인 명령의 ID에 다른 승인 내용을 덧붙이지 않는다. 소비·receipt/감사·불변 event/head는 같은 transaction, 같은 최종 명령 replay만 기존 영수증을 반환한다. 다른 연산/대상/내용/세대·거절·만료·소비 재사용은 차단한다. AUTO/null 동작과 다른 연산 금지는 보존한다. 새 forward `db/migrations/0033_document_source_detach_approval.sql`은 미적용이며 실제 PG 컴파일/COMMIT/경합·현재 서비스 양성은 미검증이다. 과거 미연결412 기록은 당시 증거로 보존하고 현재 코드 계약과 구별한다. 상세 범위는 `docs/work_packages/FN03_SOURCE_DETACH_APPROVAL_IMPLEMENTATION.md`다.

2026-10-16 직접 승인 후속 후보: sourceDeclaration은 정확4필드(hostLabel/displayName 각1~200자·pathHint 1~4096자·reason 1~20000자)의 비어 있지 않은 유효 Unicode이며 표시/경로 설명의 제어 문자·위장 권한/관측 필드·알려진 비밀 표식은 거절한다. 경로는 입력 그대로 보존하고 해석·파일 접근하지 않는다. create/save/getDraft의 top-level sourceDeclaration={ref,authority:USER_DECLARED,readiness:UNVERIFIED,declaration}은 정확한 초안 ID/버전의 별도 선언 ref다. EMPTY에는 선언이 없어야 하며 EXISTING에는 필수다. 기존 sourceRootRef 선택·실제 관측은 미연결이다. 생성은 해당 초안 선언만 귀속하고 프로젝트 상세의 OWNER에게 같은 선언을 반환한다. VIEWER에게 경로 원문을 노출하지 않는다. sourceMode=EXISTING과 SOURCE_DECLARATION_UNVERIFIED·baselineRef=null을 유지하며 Agent 실행/실제 경로 허가가 아니다. 실제 적용과 검증은 WORK_STATUS로 구분한다.

EXISTING 초안의 `sourceDeclaration`은 `hostLabel,displayName,pathHint,reason`이며 pathHint는 사용자 입력 선언이지 서버 파일 읽기 경로가 아니다. FN01은 create/saveProjectDraft에서 작성자/초안 소유의 source declaration ID·버전과 `authority:USER_DECLARED,readiness:UNVERIFIED`를 발급/재조회한다. sourceRootRef를 고르면 현재 주체가 허가된 실제 root인지 검사하고 참조 선언만 복사하며 다른 프로젝트 root의 권한/관측을 복제하지 않는다. 프로젝트 생성 transaction에서 정확 draft version의 선언을 해당 프로젝트로 귀속한다. 실제 root/host/realpath·링크/쓰기 범위 검증 전에는 실행·VERIFIED 기준선·관측 snapshot을 만들 수 없다. FN06/08 등록 뒤 실제 관측과 사용자 확인을 결박하되 프로젝트/문서 원본 저장 자체는 미확인으로 계속 가능하다.

| FN03 연산 | 필수 입력·결과/실패 경계 |
|---|---|
| `linkDocumentSource` | `documentRef,sourceRootId,relativePath,sourceSnapshotRef,blobHash,reason` → version 있는 SourceLink. 현재 제어·같은 project/root 권한, 정확 관측 snapshot·상대 경로 정규화/realpath·링크 이탈·대상 원문 hash 대조. FN08의 검증된 읽기 결과 없는 선언은412, 타 프로젝트404, stale409. 서버 본문/소스 변경0 |
| `proposeDocumentSourceChange` | `sourceLinkRef,observedSnapshotRef,choice:KEEP_SERVER/COLLECT_PROPOSAL,reason` → SourceLinkEvent·drift와 선택/관측 근거. KEEP_SERVER는 현재 확정본/소스 모두 불변, 같은 관측을 자동 재수입하지 않음. COLLECT_PROPOSAL은 관측된 정확 원본 ArtifactRef를 importDocument로 수집·지원형식 파싱 뒤 기존 proposeDocumentChange의 Proposal을 생성. 사용자 saveDocumentDraft(proposalRef)·확정 전 현재 본문 불변. unsupported/손실은 명시·실패 시 원본/기존 링크 유지 |
| `detachDocumentSource` | `sourceLinkRef,reason` → DETACHED 이력·current pointer. 파일/원문/과거 링크 삭제0·서버 문서 불변. 다른 파일로 연결하려면 새 linkDocumentSource·현재 관측을 요구 |

조회 `GET projects/:projectId/documents/:id/source-links`는 링크/버전·최근 관측 snapshot·상태 MATCH/DRIFT/UNVERIFIED/DETACHED·선택/제안 ID/이력을 반환한다. 관측 부재를 MATCH로 계산하지 않는다. 연결·반출입/착수/제출/재개 시 영향을 받는 링크만 FN08 읽기로 비교하고 sourceLinkEvent를 남긴다. 관측 hash가 현재 링크 version과 바뀌면 옛 선택의 재사용을409로 거절한다. 이 흐름은 소스 파일 쓰기/자동 되돌리기 기능이 아니다. 소스 복원은 FN13의 별도 exact 승인·보존 검증을 따른다.

본인 공통 방법론 후속 연결은 METHODOLOGY 내용 검토와 confirmMethodology다. 같은 owner/current client·exact head/version/hash·서버 감사 순서·ReviewRef·미확인 명령 보존 규칙을 적용한다. 기준1은 METHOD_PURPOSE_SCOPE/METHOD_FLOW_CONTROL/METHOD_INPUT_OUTPUT/METHOD_COMPLETION_APPROVAL/METHOD_RECORD_LIMITS다. 구조 ERROR 또는 최신 검토가 ACCEPTED가 아니면 확정422. 연결 양식은 exact 내용을 대조하고 SYSTEM의 P01 승인된 불변 원본과 USER_COMMON의 실제 확정+최신 ACCEPTED를 구분해 확인한다. 기본 양식 출처 승인을 Anvil 사용자 확정/제품 인수로 만들지 않는다. 새 개정은 이전 확정을 이월하지 않으며 프로젝트 적용·Agent 실행은 별도다.
