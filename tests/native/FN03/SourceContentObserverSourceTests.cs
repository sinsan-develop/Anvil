// 미래 합성 시험 소스. 컴파일·RunAll·OS/PInvoke·실제 파일 읽기는 NOT_RUN이다.
using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Threading;

internal static class SourceContentObserverSourceTests
{
    static void Need(bool value){if(!value)throw new InvalidOperationException("CONTENT_SOURCE_TEST_FAILED");}
    static string Hash(byte[] bytes){
        using(var hash=SHA256.Create())return BitConverter.ToString(hash.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();
    }
    sealed class Clock:SourceContentObserver.IClock {
        internal DateTime Wall=new DateTime(2026,11,7,0,0,0,DateTimeKind.Utc);
        internal long Mono;
        public DateTime UtcNow{get{return Wall;}}
        public long MonotonicMilliseconds{get{return Mono;}}
    }
    sealed class Pending:SourceContentObserver.IPendingRead {
        internal readonly File Owner;internal readonly int Count;internal readonly long Offset;
        internal bool Settled,Cancelled,Disposed;internal int Polls,HoldPolls;internal Action DuringPoll;
        internal Pending(File owner,long offset,int count){Owner=owner;Offset=offset;Count=count;}
        public bool TryComplete(out SourceContentObserver.ReadCompletion result){
            Polls++;
            if(DuringPoll!=null){var action=DuringPoll;DuringPoll=null;action();}
            if(Polls<=HoldPolls){result=null;return false;}
            if(Owner.ProbeErrors!=null){
                int index=Math.Min(Polls-1,Owner.ProbeErrors.Length-1);
                var disposition=SourceContentObserver.ClassifyReadCompletion(false,Owner.ProbeErrors[index],
                    Owner.ProbeStatuses[index],Owner.ProbeEvents[index],0,Count);
                if(disposition==SourceContentObserver.ReadDisposition.Pending||disposition==SourceContentObserver.ReadDisposition.Unknown){
                    Need(!Disposed&&!Owner.Disposed);result=null;return false;
                }
                Settled=true;result=SourceContentObserver.CompletedReadFailure(disposition);return true;
            }
            Settled=true;int remaining=(int)Math.Max(0,Owner.Bytes.LongLength-Offset);
            int size=Math.Min(Count,Math.Min(remaining,Owner.ShortRead));
            if(Owner.EarlyEof&&Offset>0)size=0;
            if(Owner.ExtraByte&&remaining==0)size=1;
            byte[] bytes=new byte[size];if(remaining>0&&size>0)Array.Copy(Owner.Bytes,Offset,bytes,0,size);
            result=new SourceContentObserver.ReadCompletion(bytes,Owner.ReadError);return true;
        }
        public void RequestCancel(){Need(!Settled);Cancelled=true;Owner.Log.Add("CANCEL");}
        public void WaitForProgress(){Owner.Log.Add("WAIT");}
        public void Dispose(){Need(Settled);Disposed=true;Owner.Log.Add("READ_DISPOSE");}
    }
    sealed class File:SourceContentObserver.IContentFile {
        internal byte[] Bytes=new byte[]{13,10};internal SourceContentObserver.FileFacts Facts,After;
        internal readonly List<string> Log;internal readonly List<Pending> Reads=new List<Pending>();
        internal int ShortRead=65536,HoldPolls,MetadataReads;internal bool EarlyEof,ExtraByte,Disposed;
        internal string ReadError;internal Action DuringPoll;
        internal int[] ProbeErrors,ProbeStatuses;internal bool[] ProbeEvents;
        internal File(List<string> log,string path){Log=log;Facts=new SourceContentObserver.FileFacts(1,new string('1',32),path,2,100,false,false,1);}
        public SourceContentObserver.FileFacts ReadFacts(){MetadataReads++;return MetadataReads>1&&After!=null?After:Facts;}
        public SourceContentObserver.IPendingRead BeginRead(long offset,int count,SourceContentObserver.Budget budget){
            budget.Check();Need(!Disposed&&count>0&&count<=65536);var read=new Pending(this,offset,count){HoldPolls=HoldPolls,DuringPoll=DuringPoll};
            DuringPoll=null;Reads.Add(read);Log.Add("READ");return read;
        }
        public void Dispose(){foreach(var read in Reads)Need(read.Settled&&read.Disposed);Disposed=true;Log.Add("FILE_DISPOSE");}
    }
    sealed class Root:SourceContentObserver.IContentRoot {
        internal readonly List<string> Log=new List<string>();internal readonly List<File> Files=new List<File>();
        internal int Opened,Checks;internal bool Disposed,RootChanged;
        internal Root(){Files.Add(new File(Log,@"D:\Synthetic\a.bin"));}
        public SourceContentObserver.FileFacts ReadFacts(){return new SourceContentObserver.FileFacts(1,new string('2',32),@"D:\Synthetic",0,100,true,false,1);}
        public void CheckPins(){Checks++;if(RootChanged)throw new SourceContentObserver.ObservationFailure("CHANGED","IDENTITY_CHANGED");}
        public SourceContentObserver.IContentFile OpenFile(string path,SourceContentObserver.Budget budget){budget.Check();Opened++;return Files[Opened-1];}
        public void Dispose(){for(int i=0;i<Opened;i++)Need(Files[i].Disposed);Disposed=true;Log.Add("ROOT_DISPOSE");}
    }
    sealed class Factory:SourceContentObserver.IContentFactory {
        internal readonly Root Root=new Root();internal int Opened;
        internal int PendingOpenPolls;internal Action DuringOpen;internal bool OpenSettled,OpenArgsDisposed;
        public SourceContentObserver.IContentRoot OpenRoot(SourceContentObserver.Request request,SourceContentObserver.Budget budget){
            budget.Check();Opened++;
            // pending open의 취소는 지원하지 않는다. 실제 완료까지 args/pins를 보유하는 계약을 합성한다.
            try{SourceContentObserver.SettleOpen(new Open(this),budget);budget.Check();return Root;}
            catch{Root.Dispose();throw;}
            finally{Need(OpenSettled);OpenArgsDisposed=true;}
        }
        sealed class Open:SourceContentObserver.IPendingOpen {
            readonly Factory owner;int polls;
            internal Open(Factory value){owner=value;}
            public bool TryComplete(){
                if(polls++==0&&owner.DuringOpen!=null)owner.DuringOpen();
                Need(!owner.OpenArgsDisposed&&!owner.Root.Disposed);
                if(polls<=owner.PendingOpenPolls)return false;owner.OpenSettled=true;return true;
            }
            public void WaitForProgress(){Need(!owner.OpenArgsDisposed&&!owner.Root.Disposed);}
        }
    }
    sealed class Fixture {
        internal readonly Factory Factory=new Factory();internal readonly Clock Clock=new Clock();
        internal readonly CancellationTokenSource Cancel=new CancellationTokenSource();
        internal SourceContentObserver.Request Request;
        internal Fixture(){Request=MakeRequest(new[]{Target("a.bin",2)},Clock.Wall.AddSeconds(30));}
        internal SourceContentObserver.Snapshot Run(){return SourceContentObserver.ObserveSynthetic(Request,Factory,Clock,Cancel.Token);}
    }
    static SourceContentObserver.Target Target(string name,int n){
        return new SourceContentObserver.Target(name,new SourceContentObserver.Reference("20000000-0000-4000-8000-"+n.ToString("D12"),1,new string('b',64)));
    }
    static SourceContentObserver.Request MakeRequest(SourceContentObserver.Target[] targets,DateTime until,int fileLimit=2097152,long totalLimit=20971520){
        return new SourceContentObserver.Request(@"D:\Synthetic",new SourceContentObserver.Reference("20000000-0000-4000-8000-000000000001",1,new string('a',64)),targets,until,30000,fileLimit,totalLimit);
    }
    static string State(SourceContentObserver.Snapshot value,int i){return(string)value.Files[i]["state"];}
    static Dictionary<string,object> Facts(SourceContentObserver.Snapshot value,int i){return(Dictionary<string,object>)value.Files[i]["facts"];}
    static void Bytes(byte[] bytes){
        var f=new Fixture();var file=f.Factory.Root.Files[0];file.Bytes=bytes;
        file.Facts=new SourceContentObserver.FileFacts(1,new string('1',32),@"D:\Synthetic\a.bin",bytes.LongLength,100,false,false,1);
        var result=f.Run();Need(result.Completed&&State(result,0)=="HASHED"&&!result.LinkAuthorized&&!result.ExecutionAuthorized);
        Need((string)Facts(result,0)["blobHash"]==Hash(bytes)&&(string)Facts(result,0)["bytesReadDecimal"]==bytes.LongLength.ToString());
        Need((string)Facts(result,0)["identityBeforeHash"]==(string)Facts(result,0)["identityAfterHash"]);
        Need(f.Factory.Root.Disposed&&file.Disposed);
        Need(file.Reads[file.Reads.Count-1].Count==1&&file.Reads[file.Reads.Count-1].Offset==bytes.LongLength);
    }
    internal static void RunAll(){
        Bytes(new byte[0]);Bytes(new byte[]{0xef,0xbb,0xbf,13,10});Bytes(new byte[]{13,10});Bytes(new byte[2097152]);
        var shortRead=new Fixture();shortRead.Factory.Root.Files[0].ShortRead=1;
        Need(shortRead.Run().Completed&&shortRead.Factory.Root.Files[0].Reads.Count==3);
        foreach(string kind in new[]{"early","extra","error"}){
            var f=new Fixture();var file=f.Factory.Root.Files[0];file.ShortRead=1;
            file.EarlyEof=kind=="early";file.ExtraByte=kind=="extra";file.ReadError=kind=="error"?"ACCESS_DENIED":null;
            Need(!f.Run().Completed&&f.Factory.Root.Opened==1);
        }
        foreach(var after in new[]{
            new SourceContentObserver.FileFacts(1,new string('3',32),@"D:\Synthetic\a.bin",2,100,false,false,1),
            new SourceContentObserver.FileFacts(1,new string('1',32),@"D:\Synthetic\a.bin",1,100,false,false,1),
            new SourceContentObserver.FileFacts(1,new string('1',32),@"D:\Synthetic\a.bin",2,101,false,false,1),
            new SourceContentObserver.FileFacts(2,new string('1',32),@"D:\Synthetic\a.bin",2,100,false,false,1),
            new SourceContentObserver.FileFacts(1,new string('1',32),@"D:\Synthetic\a.bin",2,100,false,true,1),
            new SourceContentObserver.FileFacts(1,new string('1',32),@"D:\Synthetic\a.bin",2,100,false,false,2)}){
            var f=new Fixture();f.Factory.Root.Files[0].After=after;Need(!f.Run().Completed);
            var before=new Fixture();before.Factory.Root.Files[0].Facts=after;
            if(after.Reparse||after.Links!=1||after.Volume!=1){
                Need(!before.Run().Completed&&before.Factory.Root.Files[0].Reads.Count==0);
            }
        }
        foreach(bool fileLimit in new[]{true,false}){
            var f=new Fixture();f.Request=MakeRequest(new[]{Target("a.bin",2),Target("b.bin",3)},f.Clock.Wall.AddSeconds(30),fileLimit?1:2097152,1);
            var result=f.Run();Need(State(result,0)=="TOO_LARGE"&&State(result,1)=="UNVERIFIED");
            Need((string)result.Files[1]["reasonCode"]=="NOT_ATTEMPTED"&&f.Factory.Root.Opened==1&&f.Factory.Root.Files[0].Reads.Count==0);
            Need((string)result.Files[0]["reasonCode"]==(fileLimit?"FILE_LIMIT_REACHED":"TOTAL_LIMIT_REACHED"));
        }
        CumulativeBoundary(false);CumulativeBoundary(true);
        NativeCompletionFailures();
        foreach(string kind in new[]{"cancel","mono","wall","backwards","monoBackwards"}){
            var f=new Fixture();var file=f.Factory.Root.Files[0];file.HoldPolls=3;
            file.DuringPoll=()=>{
                if(kind=="cancel")f.Cancel.Cancel();
                if(kind=="mono")f.Clock.Mono=30000;
                if(kind=="wall")f.Clock.Wall=f.Clock.Wall.AddSeconds(31);
                if(kind=="backwards")f.Clock.Wall=f.Clock.Wall.AddMilliseconds(-1);
                if(kind=="monoBackwards")f.Clock.Mono=-1;
            };
            var result=f.Run();Need(!result.Completed&&file.Reads.Count==1&&file.Reads[0].Cancelled);
            Need(file.Reads[0].Settled&&file.Reads[0].Disposed&&file.Disposed&&f.Factory.Root.Disposed&&result.Files[0]["facts"]==null);
            Need(f.Factory.Root.Log.IndexOf("CANCEL")<f.Factory.Root.Log.IndexOf("READ_DISPOSE"));
        }
        var rootChange=new Fixture();rootChange.Factory.Root.Files[0].DuringPoll=()=>rootChange.Factory.Root.RootChanged=true;
        var changed=rootChange.Run();Need(!changed.Completed&&changed.Root["facts"]==null);
        var cancelled=new Fixture();cancelled.Cancel.Cancel();cancelled.Run();Need(cancelled.Factory.Opened==0);
        var expired=new Fixture();expired.Request=MakeRequest(expired.Request.Targets,expired.Clock.Wall);expired.Run();Need(expired.Factory.Opened==0);
        var shortPermit=new Fixture();shortPermit.Request=MakeRequest(shortPermit.Request.Targets,shortPermit.Clock.Wall.AddMilliseconds(2));
        shortPermit.Factory.Root.Files[0].DuringPoll=()=>shortPermit.Clock.Mono=2;Need(!shortPermit.Run().Completed);
        // 같은 poll에서 원 I/O가 정착해도 만료/취소 뒤 bytes/hash는 채택하지 않는다.
        var late=new Fixture();late.Factory.Root.Files[0].DuringPoll=()=>late.Cancel.Cancel();
        var lateResult=late.Run();Need(!lateResult.Completed&&lateResult.Files[0]["facts"]==null);
        Need(late.Factory.Root.Files[0].Reads.Count==1&&late.Factory.Root.Files[0].Reads[0].Settled);
        foreach(bool expire in new[]{true,false}){
            var f=new Fixture();f.Factory.PendingOpenPolls=3;
            f.Factory.DuringOpen=()=>{if(expire)f.Clock.Mono=30000;else f.Cancel.Cancel();};
            var result=f.Run();Need(!result.Completed&&f.Factory.OpenSettled&&f.Factory.OpenArgsDisposed);
            Need(f.Factory.Root.Opened==0&&f.Factory.Root.Disposed);
        }
        foreach(string name in new[]{"../a.bin","a.bin:stream","a.bin/../b.bin","CON","a.bin/"}){
            var f=new Fixture();f.Request=MakeRequest(new[]{Target(name,2)},f.Clock.Wall.AddSeconds(30));
            bool rejected=false;try{f.Run();}catch(InvalidOperationException error){rejected=error.Message=="SOURCE_CONTENT_NATIVE_INPUT_INVALID";}
            Need(rejected&&f.Factory.Opened==0);
        }
        var duplicate=new Fixture();duplicate.Request=MakeRequest(new[]{Target("a.bin",2),Target("A.bin",3)},duplicate.Clock.Wall.AddSeconds(30));
        bool duplicateRejected=false;try{duplicate.Run();}catch(InvalidOperationException error){duplicateRejected=error.Message=="SOURCE_CONTENT_NATIVE_INPUT_INVALID";}
        Need(duplicateRejected&&duplicate.Factory.Opened==0);
    }
    static void CumulativeBoundary(bool over){
        var f=new Fixture();f.Factory.Root.Files.Clear();int count=over?11:10;var targets=new SourceContentObserver.Target[count];
        for(int i=0;i<count;i++){
            string name="f"+i+".bin";targets[i]=Target(name,i+10);
            var file=new File(f.Factory.Root.Log,@"D:\Synthetic\"+name){Bytes=new byte[2097152]};
            file.Facts=new SourceContentObserver.FileFacts(1,new string('1',32),@"D:\Synthetic\"+name,2097152,100,false,false,1);
            f.Factory.Root.Files.Add(file);
        }
        f.Request=MakeRequest(targets,f.Clock.Wall.AddSeconds(30));var result=f.Run();Need(result.Completed==!over);
        if(over)Need(State(result,10)=="TOO_LARGE"&&f.Factory.Root.Files[10].Reads.Count==0);
    }
    static void NativeCompletionFailures(){
        const int crc=unchecked((int)0xc000003f),ioError=unchecked((int)0xc0000185);
        var classify=new Func<bool,int,int,bool,uint,int,SourceContentObserver.ReadDisposition>(SourceContentObserver.ClassifyReadCompletion);
        Need(classify(false,23,crc,true,0,64)==SourceContentObserver.ReadDisposition.Failed);
        Need(classify(false,30,ioError,true,0,64)==SourceContentObserver.ReadDisposition.Failed);
        Need(classify(false,996,crc,true,0,64)==SourceContentObserver.ReadDisposition.Pending);
        Need(classify(false,23,0x103,true,0,64)==SourceContentObserver.ReadDisposition.Pending);
        Need(classify(false,6,crc,true,0,64)==SourceContentObserver.ReadDisposition.Unknown);
        Need(classify(false,23,crc,false,0,64)==SourceContentObserver.ReadDisposition.Unknown);
        Need(classify(true,0,0,true,4,4)==SourceContentObserver.ReadDisposition.Success);
        Need(classify(true,0,0,true,5,4)==SourceContentObserver.ReadDisposition.Failed);
        Need(classify(false,38,unchecked((int)0xc0000011),true,0,1)==SourceContentObserver.ReadDisposition.Eof);
        foreach(int error in new[]{23,30,5,995}){
            var f=new Fixture();var file=f.Factory.Root.Files[0];
            f.Request=MakeRequest(new[]{Target("a.bin",2),Target("b.bin",3)},f.Clock.Wall.AddSeconds(30));
            // 불명 handle/query와 원 pending은 해제하지 않고 같은 owner의 terminal CRC/실패까지 기다린다.
            file.ProbeErrors=new[]{6,996,error};
            file.ProbeStatuses=new[]{crc,0x103,error==995?unchecked((int)0xc0000120):error==5?unchecked((int)0xc0000022):crc};
            file.ProbeEvents=new[]{true,false,true};
            var result=f.Run();Need(!result.Completed&&result.Files[0]["facts"]==null);
            Need(file.Reads.Count==1&&file.Reads[0].Polls==3&&file.Reads[0].Settled&&file.Reads[0].Disposed);
            Need(file.Disposed&&f.Factory.Root.Disposed&&f.Factory.Root.Opened==1);
            Need(f.Factory.Root.Log.IndexOf("WAIT")<f.Factory.Root.Log.IndexOf("READ_DISPOSE"));
            Need(f.Factory.Root.Log.IndexOf("READ_DISPOSE")<f.Factory.Root.Log.IndexOf("FILE_DISPOSE"));
            Need(f.Factory.Root.Log.IndexOf("FILE_DISPOSE")<f.Factory.Root.Log.IndexOf("ROOT_DISPOSE"));
            Need(State(result,0)==(error==5?"DENIED":error==995?"CANCELLED":"UNVERIFIED"));
            Need((string)result.Files[0]["reasonCode"]==(error==5?"ACCESS_DENIED":error==995?"CANCEL_REQUESTED":"OBSERVER_UNAVAILABLE"));
            Need(State(result,1)=="UNVERIFIED"&&(string)result.Files[1]["reasonCode"]=="NOT_ATTEMPTED");
        }
    }
}
