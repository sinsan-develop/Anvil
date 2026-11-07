using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

// standalone entry source. build/등록/compile/실행은 이 소스의 존재로 허가되지 않는다.
internal sealed class NativePreparationOwnerHostSource {
 readonly INativeOwnerResources resources;readonly NativeOwnerKernel kernel;readonly Func<DateTime> wall;readonly Func<double> mono;
 readonly Func<int,Anvil.Native.OwnershipEvidence.OwnershipEvidenceJobFactorySource.IEmptyJobCandidate> create;
 bool used;volatile bool active=true,unknown;readonly Func<int,CancellationToken,Task> delay;NativePreparationOwnerPeerSource peer;NativeOwnerBudget budget;
 internal NativePreparationOwnerHostSource(INativeOwnerResources input=null,NativeOwnerKernel os=null,Func<DateTime> utcNow=null,Func<double> monotonic=null,
  Func<int,Anvil.Native.OwnershipEvidence.OwnershipEvidenceJobFactorySource.IEmptyJobCandidate> createOwner=null,Func<int,CancellationToken,Task> delayPort=null){
  resources=input??new NativePreparationOwnerParentBasisSource.OwnAssemblyResources();kernel=os??new WindowsNativeOwnerKernel();wall=utcNow??(()=>DateTime.UtcNow);var watch=Stopwatch.StartNew();mono=monotonic??(()=>watch.Elapsed.TotalMilliseconds);create=createOwner;delay=delayPort??((ms,token)=>Task.Delay(ms,token));
 }
 // 인자/환경/stdin은 trust 기준을 고르는 입구가 아니다. 원문 오류/stack/stdout 진단을 내보내지 않는다.
 static int Main(string[] args){if(args==null||args.Length!=0)return 1;try{return new NativePreparationOwnerHostSource().RunAsync().GetAwaiter().GetResult();}catch{return 1;}}
 void Check(){if(!active)throw NativePreparationOwnerParentBasisSource.Invalid();budget.Check();peer.Check();}
 async Task<T> IO<T>(byte[] owned,Func<CancellationToken,Task<T>> work,Func<T,T> consume=null){
  Check();peer.BeginIO();var cancel=new CancellationTokenSource();var timer=new CancellationTokenSource();Task<T> operation=null;
  try{
   operation=work(cancel.Token);if(operation==null)throw NativePreparationOwnerParentBasisSource.Invalid();
   Task timeout=delay(budget.Remaining(),timer.Token);if(timeout==null)throw NativePreparationOwnerParentBasisSource.Invalid();Task first=await Task.WhenAny(operation,timeout);
   if(first!=operation){active=false;unknown=true;throw NativePreparationOwnerParentBasisSource.Invalid();}
   var value=await operation;Check();return consume==null?value:consume(value);
  }finally{
   // work 반환 뒤의 모든 오류(remaining/delay factory 포함)는 여기서 실제 Task 정착 여부로 분류한다.
   try{timer.Cancel();}catch{active=false;unknown=true;}
   try{timer.Dispose();}catch{active=false;unknown=true;}
   if(operation!=null&&!operation.IsCompleted){
    active=false;unknown=true;Task late=ObserveLate(operation,owned,cancel);
    try{cancel.Cancel();}catch{unknown=true;}
   }else{
    try{Array.Clear(owned,0,owned.Length);}finally{try{cancel.Dispose();}finally{peer.EndIO();}}
   }
  }
 }
 async Task ObserveLate<T>(Task<T> operation,byte[] owned,CancellationTokenSource cancel){
  try{await operation;}catch{/* 원 IO의 실제 task 정착만 관측한다. 재Dispatch/새 IO를 만들지 않는다. */}
  finally{Array.Clear(owned,0,owned.Length);cancel.Dispose();peer.EndIO();}
 }
 async Task<byte[]> Frame(){
  using(var frame=new MemoryStream()){
   try{while(true){Check();byte[] chunk=new byte[4096],observed=null;
    try{int count=await IO(chunk,token=>peer.ReadStream.ReadAsync(chunk,0,chunk.Length,token),n=>{if(n<0||n>chunk.Length)throw NativePreparationOwnerParentBasisSource.Invalid();observed=new byte[n];Buffer.BlockCopy(chunk,0,observed,0,n);return n;});Check();
     if(count==0){if(frame.Length!=0)throw NativePreparationOwnerParentBasisSource.Invalid();return null;}
     if(frame.Length+count>65536)throw NativePreparationOwnerParentBasisSource.Invalid();int newline=Array.IndexOf(observed,(byte)10);if(newline>=0&&newline!=count-1)throw NativePreparationOwnerParentBasisSource.Invalid();frame.Write(observed,0,count);if(newline>=0)return frame.ToArray();
    }finally{if(observed!=null)Array.Clear(observed,0,observed.Length);}
   }}finally{if(frame.Length>0)Array.Clear(frame.GetBuffer(),0,(int)frame.Length);}
  }
 }
 async Task Reply(byte[] bytes){if(bytes==null||bytes.Length<1||bytes.Length>65536)throw NativePreparationOwnerParentBasisSource.Invalid();byte[] copy=(byte[])bytes.Clone();await IO(copy,async token=>{await peer.WriteStream.WriteAsync(copy,0,copy.Length,token);return 0;});await IO(new byte[0],async token=>{await peer.WriteStream.FlushAsync(token);return 0;});Check();}
 internal async Task<int> RunAsync(){
  if(used)throw NativePreparationOwnerParentBasisSource.Invalid();used=true;NativePreparationOwnerBridgeSource dispatcher=null;int exit=1;
  try{
   budget=new NativeOwnerBudget(wall,mono);var basis=NativePreparationOwnerParentBasisSource.Read(resources);budget.Check();peer=NativePreparationOwnerPeerSource.Open(basis,kernel,budget);peer.OpenStreams();Check();
   while(true){byte[] frame=await Frame();Check();if(frame==null){if(dispatcher!=null&&dispatcher.State=="CLOSED_CONFIRMED"&&!unknown)exit=0;break;}
    byte[] reply=null;try{
     if(dispatcher==null){var f=NativePreparationOwnerBridgeSource.Parse(frame,true);NativePreparationOwnerBridgeSource.Exact(f,"schemaVersion,purpose,bridgeRunId,sequence,requestId,bindingHash,callExpiresAt,remainingMs,operation,payload");
      if(NativePreparationOwnerBridgeSource.Text(f,"operation")!="OPEN_EMPTY"||NativePreparationOwnerBridgeSource.Positive(f["sequence"])!=1)throw NativePreparationOwnerParentBasisSource.Invalid();
      var payload=NativePreparationOwnerBridgeSource.Map(f["payload"]);NativePreparationOwnerBridgeSource.Exact(payload,"context");var context=NativePreparationOwnerBridgeSource.Map(payload["context"]);var authority=NativePreparationOwnerBridgeSource.Map(NativePreparationOwnerBridgeSource.Map(context["authority"])["snapshot"]);var scope=NativePreparationOwnerBridgeSource.Map(authority["scope"]);var factory=NativePreparationOwnerBridgeSource.Ref(scope["nativeFactoryRef"],false);
      if(NativePreparationOwnerBridgeSource.Text(factory,"id")!=basis.FactoryId||NativePreparationOwnerBridgeSource.Positive(factory["version"])!=basis.FactoryVersion||NativePreparationOwnerBridgeSource.Text(factory,"contentHash")!=peer.HelperHash)throw NativePreparationOwnerParentBasisSource.Invalid();
      long remaining=NativePreparationOwnerBridgeSource.Positive(f["remainingMs"]);if(remaining>10000)throw NativePreparationOwnerParentBasisSource.Invalid();budget.Tighten(NativePreparationOwnerBridgeSource.Time(f,"callExpiresAt"),(int)remaining);Check();
      dispatcher=new NativePreparationOwnerBridgeSource(Encoding.UTF8.GetBytes(NativePreparationOwnerBridgeSource.Canonical(context,0)),budget.ExpiresAt,budget.Remaining(),wall,mono,create);
     }
     Check();reply=dispatcher.Dispatch(frame);Check();await Reply(reply);Check();
    }finally{Array.Clear(frame,0,frame.Length);if(reply!=null)Array.Clear(reply,0,reply.Length);}
   }
  }catch{unknown=true;exit=1;}
  finally{
   active=false;
   if(dispatcher!=null){try{if(!dispatcher.CleanupAttempted)dispatcher.Dispose();if(dispatcher.State=="UNKNOWN")exit=1;}catch{unknown=true;exit=1;}}
   if(peer!=null)peer.Dispose();
  }
  // 취소 요청이 실제 IO 정착은 아니다. 미정착 중 원 stream/buffer/handle을 재사용하거나 닫지 않는다.
  // 이 대기는 OS 강제취소/10초 process 종료 보장이 아니다. 부모는 UNKNOWN으로 보존해야 한다.
  if(peer!=null){await peer.WhenDrained;if(!peer.CleanupSettled)exit=1;}
  return unknown?1:exit;
 }
}
