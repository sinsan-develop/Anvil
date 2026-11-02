// 실제 C# 로직을 사용하는 명시 fake 관측/메모리 시험 source다. compile/RunAll/OS/CNG/DPAPI 실행 NOT_RUN.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
internal static class DesktopTrustKeyHostSourceTests {
 const string Id="be140001-0000-4000-8000-000000000011";
 static DateTime Now(){return DateTime.SpecifyKind(new DateTime(2030,1,1),DateTimeKind.Utc);}
 static void Require(bool value){if(!value)throw new InvalidOperationException("DESKTOP_TRUST_TEST_EXPECTATION");}
 static void RejectStoreUnknown(Action work){bool rejected=false;try{work();}catch(DesktopTrustKeyStoreUnknownException){rejected=true;}Require(rejected);}
 static void Reject(Action work){bool rejected=false;try{work();}catch(InvalidOperationException e){if(e.Message!="DESKTOP_TRUST_UNAVAILABLE")throw;rejected=true;}Require(rejected);}
 sealed class Resources:IDesktopTrustKeyResources {
  internal bool Missing;public string[] Names(){return Missing?new string[0]:new[]{DesktopTrustKeyParentBasisSource.ResourceName};}public bool IsLocalEmbedded(string name){return true;}public Stream Open(string name){return new MemoryStream(Encoding.UTF8.GetBytes(Basis()),false);}
 }
 static string Basis(){return "{\"namespace\":\"ANVIL_DESKTOP_TRUST_SIGNER_V1\",\"parentAsarHash\":\""+new string('b',64)+"\",\"parentExeHash\":\""+new string('a',64)+"\",\"parentHeaderHash\":\""+new string('c',64)+"\",\"purpose\":\"DESKTOP_TRUST_SIGNER_PARENT_BASIS\",\"schemaVersion\":1,\"signerId\":\""+Id+"\",\"signerVersion\":1}";}
 internal sealed class Kernel:DesktopTrustKeyKernel {
  internal uint Type=3,Flags,OtherServer;internal bool Alive=true,WrongAsar,ChangedFile,ChangeDuringHash;internal long Created=1;internal int Opens,Closes,StreamOpens;
  internal Stream Reader=new MemoryStream(),Writer=new MemoryStream();readonly Dictionary<IntPtr,DesktopTrustKeyFileObservation> files=new Dictionary<IntPtr,DesktopTrustKeyFileObservation>();readonly HashSet<IntPtr> closed=new HashSet<IntPtr>();int next=100;
  internal override IntPtr Standard(int n){return new IntPtr(n==-10?1:2);}internal override uint FileType(IntPtr h){return Type;}internal override uint PipeFlags(IntPtr h){return Flags;}
  internal override uint ServerPid(IntPtr h){return h==new IntPtr(2)&&OtherServer!=0?OtherServer:77;}internal override uint SelfPid(){return 88;}
  internal override IntPtr OpenProcess(uint pid){Opens++;return new IntPtr(pid==77?3:4);}
  internal override DesktopTrustKeyProcessObservation Process(IntPtr h){return h==new IntPtr(3)?new DesktopTrustKeyProcessObservation(77,Created,@"C:\Anvil\Anvil.exe",Alive):new DesktopTrustKeyProcessObservation(88,2,@"C:\Anvil\DesktopTrustKey.exe",true);}
  internal override IntPtr OpenFile(string path,bool directory){var h=new IntPtr(next++);files[h]=new DesktopTrustKeyFileObservation("file:"+h,path,directory?0:100,directory?16u:0u);return h;}
  internal override DesktopTrustKeyFileObservation File(IntPtr h){var f=files[h];return ChangedFile?new DesktopTrustKeyFileObservation(f.Identity+"changed",f.Path,f.Length,f.Attributes):f;}
  internal override DesktopTrustKeyFileHashes HashFile(IntPtr h,bool asar,Action check){check();if(ChangeDuringHash){Created++;check();}var f=files[h];return new DesktopTrustKeyFileHashes(new string(asar?(WrongAsar?'f':'b'):f.Path.EndsWith("Anvil.exe")?'a':'d',64),asar?new string('c',64):null);}
  internal override Stream Input(IntPtr h){StreamOpens++;return Reader;}internal override Stream Output(IntPtr h){StreamOpens++;return Writer;}
  internal override bool Close(IntPtr h){if(!closed.Add(h))throw new InvalidOperationException("DUPLICATE_OWNED_CLOSE");Closes++;return true;}
 }

 sealed class Roots:DesktopTrustKeyRootKernel {
  readonly Dictionary<string,DesktopTrustKeyDirectoryFact> facts=new Dictionary<string,DesktopTrustKeyDirectoryFact>();readonly Dictionary<IntPtr,DesktopTrustKeyDirectoryFact> handles=new Dictionary<IntPtr,DesktopTrustKeyDirectoryFact>();int next=500;internal int Created,Closed;internal bool WrongOwner,Link;
  internal Roots(){string cursor=KnownFolder();while(cursor!=null){facts[cursor]=new DesktopTrustKeyDirectoryFact(cursor,"root:"+cursor,"S-1-5-21-TEST",true,false,false);string parent=Path.GetDirectoryName(cursor);if(parent==cursor)break;cursor=parent;}}
  internal void MakeExistingPrivateRoot(){string cursor=KnownFolder();foreach(string name in new[]{"Anvil","Trust","v1"}){cursor=Path.Combine(cursor,name);facts[cursor]=new DesktopTrustKeyDirectoryFact(cursor,"root:"+cursor,CurrentSid(),true,false,true);}}
  internal override string CurrentSid(){return "S-1-5-21-TEST";}internal override string KnownFolder(){return @"C:\Users\Test\AppData\Local";}
  internal override DesktopTrustKeyDirectoryFact Inspect(string p){DesktopTrustKeyDirectoryFact f;return facts.TryGetValue(p,out f)?f:new DesktopTrustKeyDirectoryFact(p,"","",false,false,false);}
  internal override void CreatePrivate(string p,string sid){Created++;facts[p]=new DesktopTrustKeyDirectoryFact(p,"root:"+p,sid,true,false,true);}
  internal override IntPtr Retain(string p){IntPtr h=new IntPtr(next++);handles[h]=facts[p];return h;}
  internal override DesktopTrustKeyDirectoryFact Observe(IntPtr h){var f=handles[h];return new DesktopTrustKeyDirectoryFact(f.Path,f.Identity,WrongOwner?"OTHER":f.Owner,true,Link,f.Private);}
  internal override bool Close(IntPtr h){Require(handles.Remove(h));Closed++;return true;}
 }
 sealed class MemoryStore:DesktopTrustKeyBindingKernel {
  internal readonly Dictionary<string,byte[]> Files=new Dictionary<string,byte[]>();internal int Writes,Replaces;internal bool FailSync,Locked;internal Action<string> ReadObserved;
  sealed class Held:IDisposable{readonly Action release;internal Held(Action action){release=action;}public void Dispose(){release();}}
  internal override IDisposable Lock(){if(Locked)throw new InvalidOperationException("DESKTOP_TRUST_UNAVAILABLE");Locked=true;return new Held(()=>Locked=false);}
  internal override byte[] Read(string name,int maximum){if(ReadObserved!=null)ReadObserved(name);byte[] b;return Files.TryGetValue(name,out b)?(byte[])b.Clone():null;}
  internal override void WriteNext(byte[] b){Writes++;if(Files.ContainsKey("bindings.v1.next"))throw new InvalidOperationException("DESKTOP_TRUST_UNAVAILABLE");Files["bindings.v1.next"]=(byte[])b.Clone();if(FailSync)throw new InvalidOperationException("DESKTOP_TRUST_UNAVAILABLE");}
  internal override void Replace(string expected,bool initial){Replaces++;if(!initial)Files["bindings.v1.previous"]=Files["bindings.v1"];Files["bindings.v1"]=Files["bindings.v1.next"];Files.Remove("bindings.v1.next");}
  internal override byte[] Protect(byte[] b){return (byte[])b.Clone();}internal override byte[] Unprotect(byte[] b){return (byte[])b.Clone();}
 }
 static Dictionary<string,object> Pending(){return new Dictionary<string,object>{{"schemaVersion",1},{"purpose","DESKTOP_TRUST_KEY_BINDING"},{"bindingId",Id},{"revision",1},{"previousHash",null},{"attemptId",Id},{"origin","https://anvil.invalid"},{"label","한글 <>&\"\\ 😀"},{"pendingKeyId",Id},{"projectIdHint",null},{"projectId",null},{"key",null},{"registration",null},{"credential",null},{"profile",null},{"state","KEY_PENDING"},{"uncertainStep",null},{"createdAt","2030-01-01T00:00:00.000Z"},{"updatedAt","2030-01-01T00:00:00.000Z"}};}
 static Dictionary<string,object> High(){return new Dictionary<string,object>{{"profileId",Id},{"sequence",1},{"releaseRef",new Dictionary<string,object>{{"id",Id},{"version",1},{"contentHash",new string('a',64)}}}};}
 static Dictionary<string,object> Public(){return new Dictionary<string,object>{{"keyId",Id},{"publicKeySpki","MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEYP7UuiVanTHJYet0xjVtaMBJuJI7Yfps5mliLmDyn7Z5A_4QCLi8maQa6elWKLxk8vGyDC1-n1F3o8KU1EYimQ"},{"fingerprint","5a7a78cca4a0f420d9bc62bb669c3c2759e39f723d3ae10dcbe0f0815a07ecd4"}};}
 static byte[] Frame(int sequence,string operation,Dictionary<string,object> payload){return Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(new Dictionary<string,object>{{"schemaVersion",1},{"purpose","DESKTOP_TRUST_KEY_OPERATION_V1"},{"requestId","be140001-0000-4000-8000-"+sequence.ToString("D12")},{"sequence",sequence},{"callExpiresAt","2030-01-01T00:00:01.000Z"},{"remainingMs",1000},{"signerRef",new Dictionary<string,object>{{"id",Id},{"version",1},{"contentHash",new string('d',64)}}},{"operation",operation},{"payload",payload}},0)+"\n");}
 sealed class Frames:MemoryStream {
  readonly Queue<byte[]> frames;byte[] current;int position;
  internal Frames(params byte[][] values){frames=new Queue<byte[]>(values);}
  public override Task<int> ReadAsync(byte[] b,int offset,int count,CancellationToken token){token.ThrowIfCancellationRequested();if(current==null||position==current.Length){if(frames.Count==0)return Task.FromResult(0);current=frames.Dequeue();position=0;}int n=Math.Min(count,current.Length-position);Buffer.BlockCopy(current,position,b,offset,n);position+=n;return Task.FromResult(n);}
 }
 // 파일 존재 조합은 메모리 fault만 사용한다. 실제 파일·키·컴파일 실행은 없다.
 static Dictionary<string,byte[]> Snapshot(MemoryStore io){return io.Files.ToDictionary(x=>x.Key,x=>(byte[])x.Value.Clone());}
 static void Preserved(MemoryStore io,Dictionary<string,byte[]> before,int writes,int replaces){Require(io.Files.Count==before.Count&&io.Writes==writes&&io.Replaces==replaces&&!io.Locked);foreach(var item in before)Require(io.Files.ContainsKey(item.Key)&&io.Files[item.Key].SequenceEqual(item.Value));}
 static void FilePresenceMatrix(){
  var seed=new MemoryStore();var writer=new DesktopTrustKeyBindingStoreSource(seed,()=>{});var first=writer.Append(null,0,Pending(),High());byte[] v1=(byte[])seed.Files["bindings.v1"].Clone();
  var second=Pending();second["revision"]=2;second["previousHash"]=DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(Pending(),0)));second["state"]="UNKNOWN";second["uncertainStep"]="KEY_CREATE";
  writer.Append(DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(first,0))),1,second,High());byte[] v2=(byte[])seed.Files["bindings.v1"].Clone();
  for(int mask=0;mask<16;mask++){
   bool hasCurrent=(mask&1)!=0,hasPrevious=(mask&2)!=0,hasNext=(mask&4)!=0,hasLock=(mask&8)!=0;var io=new MemoryStore();
   if(hasCurrent)io.Files["bindings.v1"]=(byte[])(hasPrevious?v2:v1).Clone();if(hasPrevious)io.Files["bindings.v1.previous"]=(byte[])v1.Clone();if(hasNext)io.Files["bindings.v1.next"]=new byte[]{3};if(hasLock)io.Files["bindings.v1.lock"]=new byte[]{4};
   var before=Snapshot(io);var store=new DesktopTrustKeyBindingStoreSource(io,()=>{});bool unsettled=hasNext||hasLock||!hasCurrent&&hasPrevious;
   if(unsettled){RejectStoreUnknown(()=>store.Read());RejectStoreUnknown(()=>store.Read());RejectStoreUnknown(()=>store.Append(null,0,Pending(),High()));var restart=new DesktopTrustKeyBindingStoreSource(io,()=>{});RejectStoreUnknown(()=>restart.Read());RejectStoreUnknown(()=>restart.Append(null,0,Pending(),High()));}
   else{var current=store.Read();if(hasCurrent)Require(current!=null&&DesktopTrustKeyHostSource.Positive(current["sequence"])==(hasPrevious?2:1));else Require(current==null);}
   Preserved(io,before,0,0);
  }
  // 같은 instance에서 한 번 관측한 seq1 current가 사라져도 새 store로 되돌리지 않는다.
  var lost=new MemoryStore();lost.Files["bindings.v1"]=(byte[])v1.Clone();var observed=new DesktopTrustKeyBindingStoreSource(lost,()=>{});Require(observed.Read()!=null);lost.Files.Remove("bindings.v1");var empty=Snapshot(lost);RejectStoreUnknown(()=>observed.Read());RejectStoreUnknown(()=>observed.Append(null,0,Pending(),High()));Preserved(lost,empty,0,0);
 }
 static async Task ExistingRootAdmission(){
  foreach(string operation in new[]{"READ_STATE","APPEND_RECORD"})foreach(string evidence in new[]{"previous","orphan-key","empty"}){
   var roots=new Roots();roots.MakeExistingPrivateRoot();var io=new MemoryStore();if(evidence=="previous")io.Files["bindings.v1.previous"]=new byte[]{1};if(evidence=="orphan-key")io.Files[Id+".key"]=new byte[]{2};var before=Snapshot(io);
   var payload=operation=="READ_STATE"?new Dictionary<string,object>{{"attemptId",Id}}:new Dictionary<string,object>{{"expectedHash",null},{"expectedSequence",0},{"record",Pending()},{"catalogueHighWater",High()}};
   var kernel=new Kernel{Reader=new Frames(Frame(1,operation,payload))};int calls=0;var host=new DesktopTrustKeyHostSource(new Resources(),kernel,roots,Now,()=>0,null,r=>io,(r,q)=>{calls++;return Public();});
   Require(await host.RunAsync()==1&&calls==0&&roots.Created==0);string reply=Encoding.UTF8.GetString(((MemoryStream)kernel.Writer).ToArray());Require(reply.Contains("\"state\":\"UNKNOWN\"")&&reply.Contains("\"problem\":\"MAPPING_STORE\""));Preserved(io,before,0,0);
  }
 }
 internal static async Task RunAll(){
  FilePresenceMatrix();await ExistingRootAdmission();
  string[] labels={"한글 <>&\"\\","눈사람☃와😀","quote'","line\n\t\0"};string[] hashes={"fa3749817d3a7ab12b9c0a2c0d2aa4355e37bb5d2f28e2dfacd25731693cd39a","4d0f2dd6754b80b3c611aea64a175d02fc4cef7f66d42ac486e8797e79a01fa0","c91b6f827998bdb7c2c8d327af5d94b2e6a500a6b75dcf39b1a7275ea1124e4d","8384aeb70130e8623589927d7b7ec4a43341a35047cd5226a1050674bbab191a"};
  for(int i=0;i<labels.Length;i++){var value=new Dictionary<string,object>{{"label",labels[i]}};string encoded=DesktopTrustKeyHostSource.Canonical(value,0);Require(DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(encoded))==hashes[i]);Require(DesktopTrustKeyHostSource.Text(DesktopTrustKeyHostSource.Parse(Encoding.UTF8.GetBytes(encoded),false),"label")==labels[i]);}
  Reject(()=>DesktopTrustKeyHostSource.Canonical(new string((char)0xd800,1),0));Reject(()=>DesktopTrustKeyHostSource.Canonical(new string((char)0xdc00,1),0));Reject(()=>DesktopTrustKeyHostSource.Parse(Encoding.UTF8.GetBytes("{\"label\":\"a\",\"label\":\"b\"}"),false));
  var io=new MemoryStore();var store=new DesktopTrustKeyBindingStoreSource(io,()=>{});var row=Pending();var c=store.Append(null,0,row,High());Require(io.Writes==1&&io.Replaces==1&&!io.Locked&&DesktopTrustKeyHostSource.Text(row,"state")=="KEY_PENDING");Reject(()=>store.Append(null,0,row,High()));
  io=new MemoryStore{FailSync=true};store=new DesktopTrustKeyBindingStoreSource(io,()=>{});RejectStoreUnknown(()=>store.Append(null,0,Pending(),High()));Require(!io.Files.ContainsKey("bindings.v1")&&io.Files.ContainsKey("bindings.v1.next")&&io.Replaces==0);RejectStoreUnknown(()=>store.Append(null,0,Pending(),High()));

  // 정상 current가 있는 두 번째 write/sync 불명은 이전 current를 정상 상태로 재채택하지 않는다.
  io=new MemoryStore();store=new DesktopTrustKeyBindingStoreSource(io,()=>{});var first=store.Append(null,0,Pending(),High());byte[] original=(byte[])io.Files["bindings.v1"].Clone();string firstHash=DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(first,0)));var failed=Pending();failed["revision"]=2;failed["previousHash"]=DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(Pending(),0)));failed["state"]="UNKNOWN";failed["uncertainStep"]="MAPPING_STORE";io.FailSync=true;RejectStoreUnknown(()=>store.Append(firstHash,1,failed,High()));Require(io.Files["bindings.v1"].SequenceEqual(original)&&io.Files.ContainsKey("bindings.v1.next"));RejectStoreUnknown(()=>store.Read());var restarted=new DesktopTrustKeyBindingStoreSource(io,()=>{});RejectStoreUnknown(()=>restarted.Read());Require(io.Files["bindings.v1"].SequenceEqual(original));
  var unknownKernel=new Kernel{Reader=new Frames(Frame(1,"READ_STATE",new Dictionary<string,object>{{"attemptId",Id}}))};var preserved=io;int unknownKeys=0;var unknownHost=new DesktopTrustKeyHostSource(new Resources(),unknownKernel,new Roots(),Now,()=>0,null,r=>preserved,(r,q)=>{unknownKeys++;return Public();});Require(await unknownHost.RunAsync()==1&&unknownKeys==0&&Encoding.UTF8.GetString(((MemoryStream)unknownKernel.Writer).ToArray()).Contains("\"state\":\"UNKNOWN\"")&&preserved.Files["bindings.v1"].SequenceEqual(original)&&preserved.Files.ContainsKey("bindings.v1.next"));


  // 시작 검사 뒤 current 읽는 중 다른 writer의 미정착 sidecar가 생기는 경계도 반환 전에 닫는다.
  foreach(string sidecar in new[]{"bindings.v1.next","bindings.v1.lock"}){var during=new MemoryStore();var reader=new DesktopTrustKeyBindingStoreSource(during,()=>{});reader.Append(null,0,Pending(),High());byte[] currentBytes=(byte[])during.Files["bindings.v1"].Clone();bool inserted=false;during.ReadObserved=name=>{if(name=="bindings.v1"&&!inserted){inserted=true;during.Files[sidecar]=new byte[]{1};}};RejectStoreUnknown(()=>reader.Read());Require(inserted&&during.Files["bindings.v1"].SequenceEqual(currentBytes)&&during.Files.ContainsKey(sidecar));RejectStoreUnknown(()=>reader.Read());var afterRestart=new DesktopTrustKeyBindingStoreSource(during,()=>{});RejectStoreUnknown(()=>afterRestart.Read());Require(during.Files.ContainsKey(sidecar)&&during.Files["bindings.v1"].SequenceEqual(currentBytes));}

  var roots=new Roots();var budget=new DesktopTrustKeyBudget(Now,()=>0);var root=DesktopTrustKeyRootSource.Open(roots,budget);root.Check();roots.Link=true;Reject(()=>root.Check());root.Dispose();Require(roots.Closed>0&&root.CleanupSettled);
  var kernel=new Kernel();int creates=0;var host=new DesktopTrustKeyHostSource(new Resources{Missing=true},kernel,new Roots(),Now,()=>0,null,r=>new MemoryStore(),(r,q)=>{creates++;return Public();});Require(await host.RunAsync()==1&&creates==0&&kernel.Opens==0);
  io=new MemoryStore();kernel=new Kernel{Reader=new Frames(Frame(1,"APPEND_RECORD",new Dictionary<string,object>{{"expectedHash",null},{"expectedSequence",0},{"record",Pending()},{"catalogueHighWater",High()}}),Frame(2,"CREATE_KEY",new Dictionary<string,object>{{"keyId",Id}}))};creates=0;host=new DesktopTrustKeyHostSource(new Resources(),kernel,new Roots(),Now,()=>0,null,r=>io,(r,q)=>{Require(io.Replaces==1);creates++;return Public();});Require(await host.RunAsync()==0&&creates==1&&io.Replaces==1&&kernel.Closes>0);
  // 재시작의 기존 pending을 CREATE 권위로 되돌리지 않는다.
  kernel=new Kernel{Reader=new Frames(Frame(1,"CREATE_KEY",new Dictionary<string,object>{{"keyId",Id}}))};creates=0;host=new DesktopTrustKeyHostSource(new Resources(),kernel,new Roots(),Now,()=>0,null,r=>io,(r,q)=>{creates++;return Public();});Require(await host.RunAsync()==1&&creates==0);
 }
}
