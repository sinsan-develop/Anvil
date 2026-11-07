// 미래 C# 시험 SOURCE. compiler/parser/RunAll/native/OS 실행은 하지 않았다.
// 기존 순수 검사와 미래 Windows close 경로 시험을 포함한다. 실제 실행 증거가 아니며 peer/종료 검증을 대체하지 않는다.
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
internal static class StandaloneReportTransportSourceTests
{
    const string Run="r1-source",Commit="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",Report="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    static readonly DateTime Issued=new DateTime(638000000000000000L,DateTimeKind.Utc),Until=Issued.AddMinutes(2);
    static void Require(bool value){if(!value)throw new InvalidOperationException("REPORT_TEST_EXPECTATION_FAILED");}
    static void Reject(Action action){bool failed=false;try{action();}catch(InvalidOperationException error){if(error.Message!="DEVELOPMENT_RECOVERY_NATIVE_UNVERIFIED"||error.InnerException!=null)throw;failed=true;}Require(failed);}
    static byte[] Hash(byte[] value){using(var hash=SHA256.Create())return hash.ComputeHash(value);}
    static byte[] Binding(){return DevelopmentRecoveryPathGuard.QaReportProtocol.Binding(Run,Commit,Issued,Until,Report,32,Issued.ToFileTimeUtc());}
    // 제품 frame encoder를 호출하지 않는 독립 고정 wire 작성.
    static byte[] Frame(byte role,byte op,uint seq,byte[] data){using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){writer.Write(new byte[]{65,86,51,81,1,role,1,op});writer.Write(seq);writer.Write((uint)data.Length);writer.Write(Binding());writer.Write(data);writer.Flush();return stream.ToArray();}}
    static byte[] Ready(){using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){writer.Write((ulong)64);writer.Write((uint)123);writer.Write(Issued.ToFileTimeUtc());writer.Write((ulong)32);writer.Write(Issued.Ticks);writer.Write(Issued.AddSeconds(60).Ticks);writer.Write((uint)59000);writer.Flush();return stream.ToArray();}}
    static byte[] End(byte[] data,uint count){using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){writer.Write((uint)data.Length);writer.Write(count);writer.Write(Hash(data));writer.Flush();return stream.ToArray();}}
    static void BindingIsCanonicalAndNamespaced(){
        string text="ANVIL.QA.C_REPORT.CHANNEL.V1|"+Run+"|"+Commit+"|"+Issued.ToString("o",System.Globalization.CultureInfo.InvariantCulture)+"|"+Until.ToString("o",System.Globalization.CultureInfo.InvariantCulture)+"|"+Report+"|0000000000000020|"+Issued.ToFileTimeUtc().ToString(System.Globalization.CultureInfo.InvariantCulture);
        Require(Convert.ToBase64String(Binding())==Convert.ToBase64String(Hash(Encoding.ASCII.GetBytes(text))));
        foreach(ulong slot in new[]{0UL,0x8000000000000000UL,UInt64.MaxValue,UInt64.MaxValue-1})Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.Binding(Run,Commit,Issued,Until,Report,slot,Issued.ToFileTimeUtc()));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.Binding(Run,Commit,Issued,Until,Report,32,DateTime.MaxValue.Ticks));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.Binding(Run+"|x",Commit,Issued,Until,Report,32,Issued.ToFileTimeUtc()));
    }
    static void ReadyHasExactLayoutAndUnits(){
        byte[] ready=Ready();Require(ready.Length==48);
        DevelopmentRecoveryPathGuard.QaReportProtocol.ValidateReady(ready,32,Issued.ToFileTimeUtc(),Issued,Until);
        for(int length=0;length<48;length++){byte[] shortValue=new byte[length];Array.Copy(ready,shortValue,length);Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.ValidateReady(shortValue,32,Issued.ToFileTimeUtc(),Issued,Until));}
        foreach(int offset in new[]{0,8,12,20,28,36,44}){byte[] bad=(byte[])ready.Clone();int count=(offset==8||offset==44)?4:8;Array.Clear(bad,offset,count);Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.ValidateReady(bad,32,Issued.ToFileTimeUtc(),Issued,Until));}
        byte[] wrongTime=(byte[])ready.Clone();Array.Copy(BitConverter.GetBytes(Issued.Ticks),0,wrongTime,12,8);Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.ValidateReady(wrongTime,32,Issued.ToFileTimeUtc(),Issued,Until));
    }
    static DevelopmentRecoveryPathGuard.QaReportCollectorState Started(){var state=new DevelopmentRecoveryPathGuard.QaReportCollectorState(Binding(),Ready());state.Hello(Frame(4,1,1,new byte[0]));state.Bootstrap(Frame(4,6,2,Hash(Ready())));return state;}
    static void OrderedChunksAndEndAreExact(){
        byte[] data=new byte[16384];for(int i=0;i<data.Length;i++)data[i]=(byte)i;
        var state=Started();int offset=0;uint seq=3;
        while(offset<data.Length){int length=Math.Min(4048,data.Length-offset);byte[] chunk=new byte[length];Array.Copy(data,offset,chunk,0,length);state.Data(Frame(4,3,seq++,chunk));offset+=length;}
        byte[] collected=state.End(Frame(4,4,8,End(data,5)));Require(Convert.ToBase64String(collected)==Convert.ToBase64String(data));
        Reject(()=>state.End(Frame(4,4,8,End(data,5))));Reject(()=>state.Data(Frame(4,3,8,new byte[]{1})));
        var shortChunk=Started();shortChunk.Data(Frame(4,3,3,new byte[]{1}));Reject(()=>shortChunk.Data(Frame(4,3,4,new byte[]{2})));
        var empty=Started();Reject(()=>empty.End(Frame(4,4,3,End(new byte[0],0))));
        var wrongHash=Started();wrongHash.Data(Frame(4,3,3,new byte[]{1}));Reject(()=>wrongHash.End(Frame(4,4,4,End(new byte[]{2},1))));
    }
    static void WrongFramesAndIncompleteReportsAreRejected(){
        foreach(byte role in new byte[]{1,2,3,5}){var state=Started();Reject(()=>state.Data(Frame(role,3,3,new byte[]{1})));}
        foreach(uint seq in new uint[]{0,1,2,4,8,9}){var state=Started();Reject(()=>state.Data(Frame(4,3,seq,new byte[]{1})));}
        var badBinding=Started();byte[] frame=Frame(4,3,3,new byte[]{1});frame[16]^=1;Reject(()=>badBinding.Data(frame));
        var wrongOp=Started();Reject(()=>wrongOp.Data(Frame(4,4,3,new byte[]{1})));
        var noBootstrap=new DevelopmentRecoveryPathGuard.QaReportCollectorState(Binding(),Ready());Reject(()=>noBootstrap.Data(Frame(4,3,3,new byte[]{1})));
        var wrongBootstrap=new DevelopmentRecoveryPathGuard.QaReportCollectorState(Binding(),Ready());wrongBootstrap.Hello(Frame(4,1,1,new byte[0]));Reject(()=>wrongBootstrap.Bootstrap(Frame(4,6,2,new byte[32])));
        var premature=Started();Reject(()=>premature.End(new byte[0]));
        var oversize=Started();Reject(()=>oversize.Data(Frame(4,3,3,new byte[4049])));
    }
    static void BudgetOnlyShortens(){
        long left=DevelopmentRecoveryPathGuard.QaReportProtocol.Remaining(Issued,Issued.AddSeconds(60),Issued,Issued.AddSeconds(1),0,1000,60000);
        Require(left==59000);
        Require(DevelopmentRecoveryPathGuard.QaReportProtocol.Remaining(Issued,Issued.AddSeconds(60),Issued.AddSeconds(1),Issued.AddSeconds(2),1000,2000,59000)==58000);
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.Remaining(Issued,Issued.AddSeconds(60),Issued.AddSeconds(2),Issued.AddSeconds(1),1000,2000,59000));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.Remaining(Issued,Issued.AddSeconds(60),Issued,Issued,1000,999,59000));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.Remaining(Issued,Issued.AddSeconds(60),Issued,Issued.AddSeconds(60),0,60000,60000));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.Remaining(Issued,Issued.AddSeconds(61),Issued,Issued,0,0,60000));
    }

    static void InheritedBudgetKeepsTheFirstChildClock(){
        DateTime child=Issued.AddSeconds(10),sample=Issued.AddSeconds(12),end=Issued.AddSeconds(60);
        long available=DevelopmentRecoveryPathGuard.QaReportProtocol.AdoptRemaining(child,sample,sample,Issued,end,58000,2000,49000);
        Require(available==47000);
        // 최초 elapsed=2000을 유지한다. 채택 후 1초에는 46000이며 clock 재시작으로 늘리지 않는다.
        long totalLimit=2000+available,nextElapsed=3000;
        Require(DevelopmentRecoveryPathGuard.QaReportProtocol.Remaining(Issued,end,sample,Issued.AddSeconds(13),2000,nextElapsed,Math.Min(available,totalLimit-nextElapsed))==46000);
        Require(DevelopmentRecoveryPathGuard.QaReportProtocol.AdoptRemaining(child,sample,sample,Issued,end,1000,2000,49000)==1000);
        Require(DevelopmentRecoveryPathGuard.QaReportProtocol.AdoptRemaining(child,sample,sample,Issued,Issued.AddSeconds(13),58000,2000,3000)==1000);
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.AdoptRemaining(child,sample,sample,child.AddTicks(1),end,58000,2000,49000));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.AdoptRemaining(child,sample,sample.AddTicks(-1),Issued,end,58000,2000,49000));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.AdoptRemaining(child,sample,sample,Issued,end,58000,2000,2000));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.AdoptRemaining(child,sample,end,Issued,end,58000,2000,49000));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.AdoptRemaining(child,sample,sample,Issued,Issued.AddSeconds(61),58000,2000,49000));
        Reject(()=>DevelopmentRecoveryPathGuard.QaReportProtocol.AdoptRemaining(child,sample,sample,Issued,end,58000,-1,49000));
    }
    static byte[] StrictRowsPayload(){
        using(var memory=new MemoryStream())using(var writer=new BinaryWriter(memory)){
            Action<string> text=value=>{writer.Write((uint)value.Length);foreach(char unit in value)writer.Write((ushort)unit);};
            text("ANVIL.QA.C_REPORT.V1");writer.Write((uint)1);text(Run);text(Commit);writer.Write(Issued.Ticks);writer.Write(Until.Ticks);text(Report);writer.Write((uint)9);
            writer.Write((uint)1);text("\uD800\0\uDC00");for(int i=1;i<9;i++)writer.Write((uint)0);writer.Flush();return memory.ToArray();
        }
    }
    static void StrictEndDoesNotRequirePipeEof(){
        byte[] payload=StrictRowsPayload();var state=Started();state.Data(Frame(4,3,3,payload));
        byte[] collected=state.End(Frame(4,4,4,End(payload,1)));
        string[][] rows=DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.Decode(collected,Run,Commit,Issued,Until,Report);
        Require(rows.Length==9&&rows[0][0]=="\uD800\0\uDC00"&&rows[8].Length==0);
        // 원문 정확 소진은 payload 끝이다. 전송 pipe EOF는 FINAL_ACK 뒤의 별도 OS 검증이다.
        byte[] trailing=new byte[payload.Length+1];Array.Copy(payload,trailing,payload.Length);
        var extra=Started();extra.Data(Frame(4,3,3,trailing));byte[] bytes=extra.End(Frame(4,4,4,End(trailing,1)));
        Reject(()=>DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.Decode(bytes,Run,Commit,Issued,Until,Report));
        for(int length=0;length<payload.Length;length++){byte[] prefix=new byte[length];Array.Copy(payload,prefix,length);Reject(()=>DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.Decode(prefix,Run,Commit,Issued,Until,Report));}
        rows[0][0]="changed";Require(DevelopmentRecoveryPathGuard.QaStandaloneReportPayload.Decode(collected,Run,Commit,Issued,Until,Report)[0][0]=="\uD800\0\uDC00");
    }
    static void BadFramePoisonsTheOriginalCollector(){
        byte[] valid=Frame(4,3,3,new byte[]{1});
        for(int length=0;length<valid.Length;length++){var state=Started();byte[] shortFrame=new byte[length];Array.Copy(valid,shortFrame,length);Reject(()=>state.Data(shortFrame));Reject(()=>state.Data(valid));}
        var trailing=Started();byte[] extra=new byte[valid.Length+1];Array.Copy(valid,extra,valid.Length);Reject(()=>trailing.Data(extra));Reject(()=>trailing.Data(valid));
        foreach(int size in new[]{4048,8096,12144,16192,16384}){
            byte[] bytes=new byte[size];var state=Started();int offset=0,count=0;
            while(offset<size){int length=Math.Min(4048,size-offset);byte[] chunk=new byte[length];state.Data(Frame(4,3,(uint)(3+count),chunk));offset+=length;count++;}
            Require(state.End(Frame(4,4,(uint)(3+count),End(bytes,(uint)count))).Length==size);
        }
    }


    static void FailedCreateRawOutputIsRetainedWithoutOwnership(){
        var failure=new DevelopmentRecoveryPathGuard.QaFailedCreateOutput(new IntPtr(123),new IntPtr(456),789,987);
        Require(failure.NativeCallFailed&&failure.HasUnconfirmedOutput&&failure.Process==new IntPtr(123)&&failure.Thread==new IntPtr(456)&&failure.Pid==789&&failure.Tid==987);
        int cleanupEffects=0;Reject(()=>{failure.RequireNoUnconfirmedOutput();cleanupEffects++;});Require(cleanupEffects==0);
        var invalid=new DevelopmentRecoveryPathGuard.QaFailedCreateOutput(new IntPtr(-1),new IntPtr(-2),1,2);
        Reject(()=>invalid.RequireNoUnconfirmedOutput());Require(invalid.Process==new IntPtr(-1)&&invalid.Thread==new IntPtr(-2));
        var empty=new DevelopmentRecoveryPathGuard.QaFailedCreateOutput(IntPtr.Zero,IntPtr.Zero,0,0);Require(empty.NativeCallFailed&&!empty.HasUnconfirmedOutput);empty.RequireNoUnconfirmedOutput();
    }
    static DevelopmentRecoveryPathGuard.QaStandaloneBudget NewBudget(){
        DateTime now=DateTime.UtcNow;return new DevelopmentRecoveryPathGuard.QaStandaloneBudget(now,now.AddMinutes(2),false);
    }
    static void SameBudgetStaysFailedAfterClockRecovery(){
        foreach(bool expired in new[]{false,true}){
            var budget=NewBudget();DateTime start=budget.Started;
            Require(budget.ObserveSample(start.AddSeconds(1),1000)>0);
            Reject(()=>budget.ObserveSample(expired?budget.Deadline:start.AddMilliseconds(500),2000));
            int stop=0,fallback=0,close=0;
            Reject(()=>{budget.ObserveSample(start.AddSeconds(2),2000);stop++;});
            Reject(()=>{budget.ObserveSample(start.AddSeconds(3),3000);fallback++;});
            Reject(()=>{budget.ObserveSample(start.AddSeconds(4),4000);close++;});
            Reject(()=>budget.Adopt(Ready()));Require(stop==0&&fallback==0&&close==0);
        }
    }
    static void FirstOrMiddleCloseFailurePreservesReferences(){
        foreach(bool middle in new[]{false,true})foreach(bool exception in new[]{false,true}){
            var budget=NewBudget();
            var first=new DevelopmentRecoveryPathGuard.KernelHandle(new IntPtr(101),false);
            var failed=new DevelopmentRecoveryPathGuard.KernelHandle(new IntPtr(202),false);
            var later=new DevelopmentRecoveryPathGuard.KernelHandle(new IntPtr(303),false);
            if(middle){var success=budget.BeginCloseObservation(first);budget.CompleteCloseObservation(success,true,true,false);}
            var receipt=budget.BeginCloseObservation(failed);
            Reject(()=>budget.CompleteCloseObservation(receipt,true,false,exception));
            Require(Object.ReferenceEquals(receipt.Original,failed)&&receipt.Raw==new IntPtr(202)&&receipt.Completed&&receipt.Attempted&&!receipt.Succeeded&&receipt.ExceptionObserved==exception);
            int laterClose=0;Reject(()=>{budget.BeginCloseObservation(later);laterClose++;});Require(laterClose==0);
            Reject(()=>budget.Remaining());
            var field=typeof(DevelopmentRecoveryPathGuard.QaStandaloneBudget).GetField("closeObservations",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic);
            var observations=(System.Collections.IList)field.GetValue(budget);Require(observations.Count==(middle?2:1)&&Object.ReferenceEquals(observations[observations.Count-1],receipt));
            // wrapper는 비소유다. 실제 CloseHandle/event/pipe를 실행하는 시험이 아니다.
        }
    }

    // 미래 Windows 전용 시험 본문이다. 아래 P/Invoke와 reflection 호출은 작성만 했으며 실행하지 않았다.
    // 실제 소유 event/pipe의 성공과 비소유 view의 Dispose 관측을 다룬다.
    // CloseHandle=false/내부 예외를 합성하거나 이미 닫은 raw handle을 다시 닫지 않는다.
    [System.Runtime.InteropServices.DllImport("kernel32.dll",EntryPoint="CreateEventW",CharSet=System.Runtime.InteropServices.CharSet.Unicode,SetLastError=true)]
    static extern DevelopmentRecoveryPathGuard.KernelHandle CreateTestEvent(IntPtr security,bool manual,bool initial,string name);
    [System.Runtime.InteropServices.DllImport("kernel32.dll",EntryPoint="CreatePipe",SetLastError=true)]
    static extern bool CreateTestPipe(out DevelopmentRecoveryPathGuard.KernelHandle read,out DevelopmentRecoveryPathGuard.KernelHandle write,IntPtr security,uint size);
    static readonly System.Reflection.BindingFlags PrivateInstance=System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic;
    static System.Collections.IList CloseReceipts(DevelopmentRecoveryPathGuard.QaStandaloneBudget budget){return (System.Collections.IList)budget.GetType().GetField("closeObservations",PrivateInstance).GetValue(budget);}
    static object Field(object source,string name){return source.GetType().GetField(name,PrivateInstance|System.Reflection.BindingFlags.Public).GetValue(source);}
    static void SetField(object source,string name,object value){source.GetType().GetField(name,PrivateInstance|System.Reflection.BindingFlags.Public).SetValue(source,value);}
    static object Call(object source,string name){
        try{return source.GetType().GetMethod(name,PrivateInstance|System.Reflection.BindingFlags.Public).Invoke(source,null);}
        catch(System.Reflection.TargetInvocationException error){if(error.InnerException==null)throw;throw error.InnerException;}
    }
    static void ActualDisposeUsesOwnershipAndRetainsFailedView(){
        var owner=CreateTestEvent(IntPtr.Zero,true,false,null);DevelopmentRecoveryPathGuard.KernelHandle view=null,later=null;
        try{
            Require(owner!=null&&!owner.IsInvalid);later=CreateTestEvent(IntPtr.Zero,true,false,null);Require(later!=null&&!later.IsInvalid);
            IntPtr raw=owner.DangerousGetHandle();view=new DevelopmentRecoveryPathGuard.KernelHandle(raw,false);
            var failedBudget=NewBudget();Reject(()=>failedBudget.CloseOriginal(view));
            // 실제 SafeHandle.Dispose를 통과한다. owns=false이므로 ReleaseHandle을 부르지 않은 실패다.
            Require(view.IsClosed&&!view.CloseAttempted&&!view.CloseSucceeded&&!owner.IsClosed);
            var failed=(DevelopmentRecoveryPathGuard.QaStandaloneBudget.CloseObservation)CloseReceipts(failedBudget)[0];
            Require(Object.ReferenceEquals(failed.Original,view)&&failed.Raw==raw&&failed.Completed&&!failed.Attempted&&!failed.Succeeded&&!failed.ExceptionObserved);
            Reject(()=>failedBudget.CloseOriginal(later));Require(!later.IsClosed&&!later.CloseAttempted&&CloseReceipts(failedBudget).Count==1);
            Reject(()=>failedBudget.Remaining());
            // 별도 정상 owner의 실제 ReleaseHandle/CloseHandle 결과를 주입 없이 확인한다.
            var ownedBudget=NewBudget();ownedBudget.CloseOriginal(owner);
            var success=(DevelopmentRecoveryPathGuard.QaStandaloneBudget.CloseObservation)CloseReceipts(ownedBudget)[0];
            Require(owner.IsClosed&&owner.CloseAttempted&&owner.CloseSucceeded&&!owner.CloseExceptionObserved);
            Require(Object.ReferenceEquals(success.Original,owner)&&success.Raw==raw&&success.Completed&&success.Attempted&&success.Succeeded&&!success.ExceptionObserved);
            ownedBudget.CloseOriginal(owner);Require(CloseReceipts(ownedBudget).Count==1);
        }finally{if(view!=null)view.Dispose();if(owner!=null)owner.Dispose();if(later!=null)later.Dispose();}
    }
    static object ReportIo(DevelopmentRecoveryPathGuard.QaStandaloneBudget budget){
        var type=typeof(DevelopmentRecoveryPathGuard).GetNestedType("QaReportIo",System.Reflection.BindingFlags.NonPublic);
        Require(type!=null);return type.GetConstructor(PrivateInstance,null,new[]{typeof(DevelopmentRecoveryPathGuard.QaStandaloneBudget)},null).Invoke(new object[]{budget});
    }
    static void ForgetTestIo(object io){
        // 미래 격리 시험이 보존 목록에 넣은 정확한 자기 객체만 제거한다. 실제 I/O를 시작하지 않았다.
        var retained=(System.Collections.IList)io.GetType().GetField("retained",System.Reflection.BindingFlags.Static|System.Reflection.BindingFlags.NonPublic).GetValue(null);
        lock(retained)retained.Remove(io);
    }
    static void ReleaseTestAllocation(object io,string field,IntPtr local,bool transferred){
        // SetField 성공 전에는 local 소유, 성공 직후부터는 io의 현재 field만 소유 자료다.
        // 제품이 free+zero한 경우 과거 local snapshot을 다시 해제하지 않는다.
        IntPtr owned=transferred?(IntPtr)Field(io,field):local;
        if(transferred)SetField(io,field,IntPtr.Zero);
        if(owned!=IntPtr.Zero)System.Runtime.InteropServices.Marshal.FreeHGlobal(owned);
    }
    static void ActualChannelCloseKeepsEventBeforePipeOnUnconfirmedDispose(){
        foreach(bool middle in new[]{false,true}){
            DevelopmentRecoveryPathGuard.KernelHandle read=null,write=null,signalOwner=null,signalView=null,first=null;object io=null;
            IntPtr data=IntPtr.Zero,overlapped=IntPtr.Zero;bool dataTransferred=false,overlappedTransferred=false;
            try{
                Require(CreateTestPipe(out read,out write,IntPtr.Zero,0)&&read!=null&&!read.IsInvalid&&write!=null&&!write.IsInvalid);
                signalOwner=CreateTestEvent(IntPtr.Zero,true,false,null);Require(signalOwner!=null&&!signalOwner.IsInvalid);
                signalView=new DevelopmentRecoveryPathGuard.KernelHandle(signalOwner.DangerousGetHandle(),false);
                var budget=NewBudget();
                if(middle){first=CreateTestEvent(IntPtr.Zero,true,false,null);Require(first!=null&&!first.IsInvalid);budget.CloseOriginal(first);Require(first.CloseAttempted&&first.CloseSucceeded);}
                io=ReportIo(budget);SetField(io,"Pipe",read);SetField(io,"signal",signalView);
                data=System.Runtime.InteropServices.Marshal.AllocHGlobal(16);SetField(io,"data",data);dataTransferred=true;
                overlapped=System.Runtime.InteropServices.Marshal.AllocHGlobal(16);SetField(io,"overlapped",overlapped);overlappedTransferred=true;
                // pending=false는 미시작 시험 상태다. 실제 OVERLAPPED terminal 관측을 증명하지 않는다.
                Require(!(bool)Call(io,"Close"));
                Require((bool)Field(io,"unknown")&&(bool)Field(io,"kept")&&!(bool)Field(io,"closed"));
                Require(Object.ReferenceEquals(Field(io,"signal"),signalView)&&Object.ReferenceEquals(Field(io,"Pipe"),read));
                Require((IntPtr)Field(io,"data")==data&&(IntPtr)Field(io,"overlapped")==overlapped);
                Require(!read.IsClosed&&!read.CloseAttempted&&!signalOwner.IsClosed&&!signalOwner.CloseAttempted);
                var receipts=CloseReceipts(budget);Require(receipts.Count==(middle?2:1));
                var receipt=(DevelopmentRecoveryPathGuard.QaStandaloneBudget.CloseObservation)receipts[receipts.Count-1];
                Require(Object.ReferenceEquals(receipt.Original,signalView)&&receipt.Raw==signalOwner.DangerousGetHandle()&&receipt.Completed&&!receipt.Attempted&&!receipt.Succeeded);
                Require(!(bool)Call(io,"Close")&&!read.CloseAttempted&&receipts.Count==(middle?2:1));Reject(()=>budget.Remaining());
            }finally{
                // 시험은 Io/Connect/Send/Receive를 시작하지 않았다. 미완료 I/O 없이 시험 소유 메모리/handle만 회수한다.
                ReleaseTestAllocation(io,"data",data,dataTransferred);
                ReleaseTestAllocation(io,"overlapped",overlapped,overlappedTransferred);
                if(io!=null)ForgetTestIo(io);
                if(signalView!=null)signalView.Dispose();if(signalOwner!=null)signalOwner.Dispose();if(read!=null)read.Dispose();if(write!=null)write.Dispose();if(first!=null)first.Dispose();
            }
        }
    }
    static void ActualTerminalReleaseRejectsPendingAndThenClosesOwnedEventBeforePipe(){
        DevelopmentRecoveryPathGuard.KernelHandle read=null,write=null,signal=null;object io=null;IntPtr data=IntPtr.Zero,overlapped=IntPtr.Zero;bool dataTransferred=false,overlappedTransferred=false;
        try{
            Require(CreateTestPipe(out read,out write,IntPtr.Zero,0)&&read!=null&&!read.IsInvalid&&write!=null&&!write.IsInvalid);
            signal=CreateTestEvent(IntPtr.Zero,true,false,null);Require(signal!=null&&!signal.IsInvalid);
            var budget=NewBudget();io=ReportIo(budget);SetField(io,"Pipe",read);SetField(io,"signal",signal);
            data=System.Runtime.InteropServices.Marshal.AllocHGlobal(16);SetField(io,"data",data);dataTransferred=true;
            overlapped=System.Runtime.InteropServices.Marshal.AllocHGlobal(16);SetField(io,"overlapped",overlapped);overlappedTransferred=true;
            SetField(io,"pending",true);
            // flag에 의한 진입 거절만 확인한다. CancelIoEx/GetOverlappedResult 완료 결과를 모사하지 않는다.
            Reject(()=>Call(io,"ReleaseTerminal"));Require(!signal.CloseAttempted&&!read.CloseAttempted&&CloseReceipts(budget).Count==0);
            Require(Object.ReferenceEquals(Field(io,"signal"),signal)&&(IntPtr)Field(io,"data")==data&&(IntPtr)Field(io,"overlapped")==overlapped);
            SetField(io,"pending",false);Require((bool)Call(io,"Close"));
            Require((IntPtr)Field(io,"data")==IntPtr.Zero&&(IntPtr)Field(io,"overlapped")==IntPtr.Zero);
            Require(Field(io,"signal")==null&&(bool)Field(io,"closed")&&!(bool)Field(io,"unknown"));
            Require(signal.CloseAttempted&&signal.CloseSucceeded&&signal.IsClosed&&read.CloseAttempted&&read.CloseSucceeded&&read.IsClosed);
            var receipts=CloseReceipts(budget);Require(receipts.Count==2);
            Require(Object.ReferenceEquals(((DevelopmentRecoveryPathGuard.QaStandaloneBudget.CloseObservation)receipts[0]).Original,signal));
            Require(Object.ReferenceEquals(((DevelopmentRecoveryPathGuard.QaStandaloneBudget.CloseObservation)receipts[1]).Original,read));
            Require((bool)Call(io,"Close")&&receipts.Count==2);
        }finally{
            ReleaseTestAllocation(io,"data",data,dataTransferred);
            ReleaseTestAllocation(io,"overlapped",overlapped,overlappedTransferred);
            if(io!=null)ForgetTestIo(io);
            if(signal!=null)signal.Dispose();if(read!=null)read.Dispose();if(write!=null)write.Dispose();
        }
    }
    internal static void RunAll(){BindingIsCanonicalAndNamespaced();ReadyHasExactLayoutAndUnits();OrderedChunksAndEndAreExact();WrongFramesAndIncompleteReportsAreRejected();BudgetOnlyShortens();InheritedBudgetKeepsTheFirstChildClock();StrictEndDoesNotRequirePipeEof();BadFramePoisonsTheOriginalCollector();FailedCreateRawOutputIsRetainedWithoutOwnership();SameBudgetStaysFailedAfterClockRecovery();FirstOrMiddleCloseFailurePreservesReferences();ActualDisposeUsesOwnershipAndRetainsFailedView();ActualChannelCloseKeepsEventBeforePipeOnUnconfirmedDispose();ActualTerminalReleaseRejectsPendingAndThenClosesOwnedEventBeforePipe();}
}
