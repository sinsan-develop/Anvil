// 미래 C# 시험 SOURCE. compiler/parser/RunAll/native/OS 실행은 하지 않았다.
// 순수 검사만 호출한다. 실제 peer/handle/pipe/종료/close 검증을 대체하지 않는다.
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

    internal static void RunAll(){BindingIsCanonicalAndNamespaced();ReadyHasExactLayoutAndUnits();OrderedChunksAndEndAreExact();WrongFramesAndIncompleteReportsAreRejected();BudgetOnlyShortens();InheritedBudgetKeepsTheFirstChildClock();StrictEndDoesNotRequirePipeEof();BadFramePoisonsTheOriginalCollector();}
}
