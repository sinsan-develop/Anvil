using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;

using Row = System.Collections.Generic.Dictionary<string,object>;

// 원 r5 root에 보유한 namespace와 관리 원장. 자료 본문/경로/잔액을 IPC 입력으로 받지 않는다.
internal sealed class NormalExecutionSpoolProfileSource {
 const long MiB=1048576, AdminCap=64*MiB, AdminHold=8192, NormalCap=256*MiB, ReceiptCap=512*MiB, PreparationCap=64*MiB;
 internal sealed class SpoolCapacityException:InvalidOperationException {}
 const string Purpose="ANVIL_OWNED_SPOOL_PROFILE_V1", Normal="NORMAL_EXECUTION", Receipt="UNVERIFIED_RECEIPT_INBOX", Preparation="NATIVE_PREPARATION";
 const int MaxEntry=32768;
 FileStream activeAnchor;
 static readonly byte[] Entropy=Encoding.UTF8.GetBytes(Purpose);
 readonly DesktopTrustKeyRootSource root;
 readonly Action current;
 DesktopTrustKeyDirectoryFact directory;
 string profileId;
 bool blocked;
 readonly HashSet<string> opened=new HashSet<string>();
 readonly Dictionary<string,Dictionary<string,string>> receiptPrefixes=new Dictionary<string,Dictionary<string,string>>();
 readonly Dictionary<string,string> owned=new Dictionary<string,string>();
 [StructLayout(LayoutKind.Sequential)]struct FT{internal uint Low,High;}
 [StructLayout(LayoutKind.Sequential)]struct FI{internal uint Attributes;internal FT Created,Accessed,Written;internal uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandle(IntPtr handle,out FI info);
 static object[] Caps(){return new object[]{Normal,NormalCap,Receipt,ReceiptCap,Preparation,PreparationCap,"MANAGEMENT",AdminCap};}
 NormalExecutionSpoolProfileSource(DesktopTrustKeyRootSource r,Action c){root=r;current=c;}
 static Row R(params object[] pairs){var value=new Row();for(int i=0;i<pairs.Length;i+=2)value.Add((string)pairs[i],pairs[i+1]);return value;}
 static string S(Row r,string k){return DesktopTrustKeyHostSource.Text(r,k);}
 static long N(object v){return DesktopTrustKeyHostSource.Nonnegative(v);}
 static string J(object v){return DesktopTrustKeyHostSource.Canonical(v,0);}
 static string H(object v){return DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(J(v)));}
 static string Id(){return Guid.NewGuid().ToString("D");}
 static Exception Invalid(){return new InvalidOperationException("NORMAL_SPOOL_UNKNOWN");}
 static long Cap(string writer){if(writer==Normal)return NormalCap;if(writer==Receipt)return ReceiptCap;if(writer==Preparation)return PreparationCap;throw Invalid();}
 void Check(){current();root.Check();if(blocked||directory==null||directory.Identity!=root.RetainSpoolNamespace(null,false).Identity)throw Invalid();}
 static bool Exists(string path){try{File.GetAttributes(path);return true;}catch(FileNotFoundException){return false;}catch(DirectoryNotFoundException){return false;}}
 internal static NormalExecutionSpoolProfileSource Open(DesktopTrustKeyRootSource root,Action current){
  var p=new NormalExecutionSpoolProfileSource(root,current);object permit=root.TakeSpoolCreationPermit();
  try{
   if(permit==null&&!Exists(Path.Combine(root.PathValue,"owned-spool-profile.v1"))&&!Exists(p.AnchorPath()))return null;
   if(permit!=null)root.ConsumeSpoolCreationPermit(permit);
   p.directory=root.RetainSpoolNamespace(null,permit!=null);
   p.Log(permit!=null,(log,rows)=>{
    if(permit!=null)p.Append(log,rows,R("kind","PROFILE","schemaVersion",1,"caps",Caps(),"profileId",Id()));
    if(rows.Count==0||S(rows[0],"kind")!="PROFILE"||N(rows[0]["schemaVersion"])!=1||J(rows[0]["caps"])!=J(Caps()))throw Invalid();
    p.profileId=DesktopTrustKeyHostSource.Id(rows[0],"profileId");return true;
   });
  }catch{p.blocked=true;}return p;
 }
 string AnchorPath(){return Path.Combine(root.PathValue,"owned-spool-profile.v1.head");}
 string FileIdentity(FileStream f,string path){
  FI info;if(!GetFileInformationByHandle(f.SafeFileHandle.DangerousGetHandle(),out info)||info.Links!=1||(info.Attributes&0x410)!=0)throw Invalid();
  var acl=f.GetAccessControl();
  if(acl.GetOwner(typeof(SecurityIdentifier)).Value!=root.UserSid)throw Invalid();
  var rules=acl.GetAccessRules(true,true,typeof(SecurityIdentifier));var principals=new HashSet<string>();
  foreach(FileSystemAccessRule rule in rules)if(rule.AccessControlType!=AccessControlType.Allow||rule.FileSystemRights!=FileSystemRights.FullControl||!principals.Add(rule.IdentityReference.Value))throw Invalid();
  if(!principals.SetEquals(new[]{root.UserSid,"S-1-5-18"}))throw Invalid();
  return String.Join(":",info.Volume,info.IndexHigh,info.IndexLow);
 }
 // 모든 writer가 동일 FileShare.None 원장을 짧게 잡는다. callback은 native의 동기 metadata 연산에만 사용한다.
 T Log<T>(bool create,Func<FileStream,List<Row>,T> act){
  Check();string path=Path.Combine(directory.Path,"management.v1");
  string anchorPath=AnchorPath();
  using(var log=new FileStream(path,create?FileMode.CreateNew:FileMode.Open,FileAccess.ReadWrite,FileShare.None))
  using(var anchor=new FileStream(anchorPath,create?FileMode.CreateNew:FileMode.Open,FileAccess.ReadWrite,FileShare.None)){
   string file=FileIdentity(log,path),head=FileIdentity(anchor,anchorPath);
   if(activeAnchor!=null||checked(log.Length+anchor.Length)>AdminCap||anchor.Length%32!=0)throw Invalid();
   var rows=new List<Row>();string previous=null;using(var reader=new BinaryReader(log,Encoding.UTF8,true)){
    while(log.Position<log.Length){Check();int n=reader.ReadInt32();if(n<1||n>MaxEntry||n>log.Length-log.Position)throw Invalid();var encrypted=reader.ReadBytes(n);
     byte[] plain=ProtectedData.Unprotect(encrypted,Entropy,DataProtectionScope.CurrentUser);
     try{var wrap=DesktopTrustKeyHostSource.Parse(plain,false);DesktopTrustKeyHostSource.Exact(wrap,"purpose,sid,root,namespaceId,fileId,headId,sequence,previous,event");
      if(S(wrap,"purpose")!=Purpose||S(wrap,"sid")!=root.UserSid||S(wrap,"root")!=root.Identity||S(wrap,"namespaceId")!=directory.Identity||S(wrap,"fileId")!=file||S(wrap,"headId")!=head||N(wrap["sequence"])!=rows.Count+1||!Object.Equals(wrap["previous"],previous))throw Invalid();
      var row=DesktopTrustKeyHostSource.Map(wrap["event"]);rows.Add(row);previous=H(row);
      var attested=new byte[32];using(var sha=SHA256.Create()){if(anchor.Read(attested,0,32)!=32||!sha.ComputeHash(encrypted).SequenceEqual(attested))throw Invalid();}
     }finally{Array.Clear(plain,0,plain.Length);}
    }
   }
   if(!create&&(rows.Count==0||S(rows[0],"kind")!="PROFILE"||(profileId!=null&&S(rows[0],"profileId")!=profileId)))throw Invalid();
   if(anchor.Position!=anchor.Length)throw Invalid();activeAnchor=anchor;
   try{var result=act(log,rows);Check();return result;}finally{activeAnchor=null;}
  }
 }
 static long ManagementHold(List<Row> rows){var holds=new HashSet<string>();long dirs=4096;
  foreach(var r in rows){string k=S(r,"kind");if(k=="RESERVED")holds.Add(S(r,"id"));if(k=="SETTLED"&&!holds.Remove(S(r,"id")))throw Invalid();if(k=="ALLOCATING")dirs=checked(dirs+4096);}
  return checked(dirs+holds.Count*AdminHold);
 }
 void Append(FileStream log,List<Row> rows,Row row){
  Check();string path=Path.Combine(directory.Path,"management.v1");var wrap=R("purpose",Purpose,"sid",root.UserSid,"root",root.Identity,"namespaceId",directory.Identity,
   "fileId",FileIdentity(log,path),"headId",FileIdentity(activeAnchor,AnchorPath()),"sequence",rows.Count+1,"previous",rows.Count==0?null:H(rows[rows.Count-1]),"event",row);
  var plain=Encoding.UTF8.GetBytes(J(wrap));byte[] cipher=null;
  try{cipher=ProtectedData.Protect(plain,Entropy,DataProtectionScope.CurrentUser);if(cipher.Length>MaxEntry)throw Invalid();
   rows.Add(row);if(checked(log.Length+4+cipher.Length+activeAnchor.Length+32+ManagementHold(rows))>AdminCap)throw new SpoolCapacityException();
   long before=log.Length;log.Position=before;using(var writer=new BinaryWriter(log,Encoding.UTF8,true)){writer.Write(cipher.Length);writer.Write(cipher);}
   log.Flush(true);Check();log.Position=before;using(var reader=new BinaryReader(log,Encoding.UTF8,true)){if(reader.ReadInt32()!=cipher.Length||!reader.ReadBytes(cipher.Length).SequenceEqual(cipher)||log.Position!=log.Length)throw Invalid();}
   using(var sha=SHA256.Create()){
    var digest=sha.ComputeHash(cipher);long position=activeAnchor.Length;activeAnchor.Position=position;activeAnchor.Write(digest,0,digest.Length);activeAnchor.Flush(true);Check();
    activeAnchor.Position=position;var copy=new byte[32];if(activeAnchor.Read(copy,0,32)!=32||!copy.SequenceEqual(digest)||activeAnchor.Position!=activeAnchor.Length)throw Invalid();
   }
  }finally{Array.Clear(plain,0,plain.Length);if(cipher!=null)Array.Clear(cipher,0,cipher.Length);}
 }
 static bool Has(List<Row> rows,string kind,string key){return rows.Any(r=>S(r,"kind")==kind&&S(r,"key")==key);}
 internal void BindRegistration(Row record){
  try{DesktopTrustKeyBindingStoreSource.Record(record);if(S(record,"state")!="REGISTERED")throw Invalid();string key=H(record);
   Log(false,(log,rows)=>{if(!Has(rows,"REGISTERED",key))Append(log,rows,R("kind","REGISTERED","key",key));return true;});
  }catch{blocked=true;} // 등록의 기존 결과와 새 profile 가용성은 별도다.
 }
 internal void BindSlot(Row record,Row slot){
  try{string key=H(record);Log(false,(log,rows)=>{if(!Has(rows,"REGISTERED",key)||S(slot,"recordHash")!=key)throw Invalid();
   string previous=slot["previousSlotRef"]==null?null:DesktopTrustKeyHostSource.Id(DesktopTrustKeyHostSource.Map(slot["previousSlotRef"]),"slotId");
   if(previous!=null&&!Has(rows,"SLOT_ID",previous))throw Invalid();
   string id=DesktopTrustKeyHostSource.Id(slot,"slotId");if(Has(rows,"SLOT_ID",id))throw Invalid();
   Append(log,rows,R("kind","SLOT_ID","key",id,"registration",key,"slotHash",H(slot)));return true;});
  }catch{blocked=true;}
 }
 Row Allocate(List<Row> rows,FileStream log,string writer,string tuple,bool resume){
  var match=rows.LastOrDefault(r=>S(r,"kind")=="ALLOCATING"&&S(r,"key")==tuple);
  if(match!=null){string existing=S(match,"id");var settled=rows.SingleOrDefault(r=>S(r,"kind")=="ALLOCATED"&&S(r,"id")==existing);
   if(!resume||settled==null)throw Invalid();return settled;}
  if(resume)throw Invalid();string id=Id();Append(log,rows,R("kind","ALLOCATING","key",tuple,"id",id,"writer",writer));
  var dir=root.RetainSpoolNamespace(id,true);var allocation=R("kind","ALLOCATED","key",tuple,"id",id,"writer",writer,"directoryIdentity",dir.Identity);
  Append(log,rows,allocation);return allocation;
 }
 static string Tuple(string writer,Row record,Row slot){
  if(S(record,"state")!="REGISTERED")throw Invalid();var reg=DesktopTrustKeyHostSource.Map(record["registration"]);
  if(writer==Receipt)return H(new object[]{Receipt,H(record),record["projectId"],reg["connectorRef"]});
  var scope=DesktopTrustKeyHostSource.Map(slot["scope"]);if(!Object.Equals(record["projectId"],scope["projectId"])||!Object.Equals(DesktopTrustKeyHostSource.Ref(reg["connectorRef"])["id"],scope["connectorId"])||S(slot,"recordHash")!=H(record))throw Invalid();
  return H(new object[]{Normal,H(record),reg["installationId"],reg["registrationRef"],scope["projectId"],scope["connectorId"],scope["executionId"],scope["executionGeneration"]});
 }
 static Row Empty(){return R("count",0,"bytes",0,"tail",null);}
 static string Channel(Row value,string writer){
  string c=S(value,"channel");if(writer==Receipt?c!="inbox":!Regex.IsMatch(c,@"\A(?:observations|acks|(?:intake|attempt)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\z"))throw Invalid();return c;
 }
 Dictionary<string,Row> Unsettled(List<Row> rows){
  var pending=new Dictionary<string,Row>();foreach(var row in rows){string k=S(row,"kind");if(k=="RESERVED")pending.Add(S(row,"id"),row);if(k=="SETTLED"&&!pending.Remove(S(row,"id")))throw Invalid();}return pending;
 }
 Row Reserve(List<Row> rows,FileStream log,string writer,string allocation,string channel,long worst,Row summary){
  long used=0;var pending=Unsettled(rows);foreach(var row in pending.Values){if(S(row,"writer")==writer)used=checked(used+N(row["worst"]));if(S(row,"allocation")==allocation&&S(row,"channel")==channel)throw Invalid();}
  var latest=new Dictionary<string,Row>();foreach(var row in rows)if(S(row,"kind")=="SETTLED"&&S(row,"writer")==writer)latest[S(row,"allocation")+"/"+S(row,"channel")]=row;
  foreach(var row in latest.Values)used=checked(used+N(DesktopTrustKeyHostSource.Map(row["summary"])["bytes"]));
  if(checked(used+worst)>Cap(writer))throw new SpoolCapacityException();
  string id=Id();var reserved=R("kind","RESERVED","writer",writer,"allocation",allocation,"channel",channel,"id",id,"worst",worst,"before",summary);
  Append(log,rows,reserved);owned.Add(id,allocation);return reserved;
 }
 // 정상 channel은 순번 파일의 크기와 마지막 원 bytes를 확인한다. receipt는 이름·크기·내용 digest 전체를 고정한다.
 Row Inspect(List<Row> rows,string writer,string allocation,DesktopTrustKeyDirectoryFact dir,string channel,Row prefix,Dictionary<string,string> receiptFiles=null){
  Check();var names=new List<string>();var known=new HashSet<string>(),busy=new HashSet<string>();known.Add(channel);
  foreach(var row in rows){string kind=S(row,"kind");if((kind=="RESERVED"||kind=="SETTLED")&&S(row,"allocation")==allocation){string c=S(row,"channel");known.Add(c);if(kind=="RESERVED")busy.Add(c);else busy.Remove(c);}}
  foreach(string path in Directory.EnumerateFileSystemEntries(dir.Path)){
   Check();string name=Path.GetFileName(path);var attr=File.GetAttributes(path);if((attr&(FileAttributes.Directory|FileAttributes.ReparsePoint))!=0)throw Invalid();
   if(writer==Normal){int dot=name.IndexOf('.');if(dot<1||!known.Contains(name.Substring(0,dot)))throw Invalid();string c=name.Substring(0,dot);string suffix=name.Substring(dot+1);
    if(suffix=="lock"){if(c==channel||!busy.Contains(c))throw Invalid();continue;}if(!Regex.IsMatch(suffix,@"\A[0-9]{6}\.json\z"))throw Invalid();if(c!=channel)continue;
   }
   if(names.Count>=(writer==Receipt?1024:10000))throw Invalid();names.Add(name);
  }
  names.Sort(StringComparer.Ordinal);long bytes=0;string tail=null;
  for(int i=0;i<names.Count;i++){Check();string name=names[i],path=Path.Combine(dir.Path,name);
   if(writer==Receipt?!Regex.IsMatch(name,@"\A[0-9a-f]{64}\.json\z"):name!=channel+"."+(i+1).ToString("D6")+".json")throw Invalid();
   using(var f=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)){
    string identity=FileIdentity(f,path);long length=f.Length;if(length<1||length>(writer==Receipt?4096:3*MiB))throw Invalid();bytes=checked(bytes+length);
    if(writer==Receipt||i==names.Count-1||(prefix!=null&&i+1==N(prefix["count"]))){using(var sha=SHA256.Create()){string hash=BitConverter.ToString(sha.ComputeHash(f)).Replace("-","").ToLowerInvariant();if(receiptFiles!=null)receiptFiles.Add(name,identity+":"+hash);tail=writer==Receipt?H(new object[]{tail,name,length,hash}):hash;}}
    if(writer==Normal&&prefix!=null&&i+1==N(prefix["count"])&&(bytes!=N(prefix["bytes"])||!Object.Equals(tail,prefix["tail"])))throw Invalid();
    if(FileIdentity(f,path)!=identity||f.Length!=length)throw Invalid();
   }
  }
  if(writer==Normal&&bytes>64*MiB)throw Invalid();Check();return R("count",names.Count,"bytes",bytes,"tail",tail);
 }
 internal string ReservePreparation(bool issuing,Func<long> observe){
  return Log(false,(log,rows)=>{
   var last=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"writer")==Preparation);
   if((last==null)!=issuing)throw Invalid();
   Row before=last==null?Empty():DesktopTrustKeyHostSource.Map(last["summary"]);
   long used=observe();if(used!=N(before["bytes"])||used<0||used>Cap(Preparation))throw Invalid();
   var hold=Reserve(rows,log,Preparation,profileId,"journal",Cap(Preparation)-used,before);return S(hold,"id");
  });
 }
 internal void SettlePreparation(string reservation,Func<long> observe){
  Log(false,(log,rows)=>{if(!owned.ContainsKey(reservation))throw Invalid();Row r;if(!Unsettled(rows).TryGetValue(reservation,out r)||S(r,"writer")!=Preparation)throw Invalid();
   var before=DesktopTrustKeyHostSource.Map(r["before"]);long used=observe();if(used<N(before["bytes"])||used-N(before["bytes"])>N(r["worst"]))throw Invalid();
   Append(log,rows,R("kind","SETTLED","writer",Preparation,"allocation",profileId,"channel","journal","id",reservation,"summary",R("bytes",used,"count",N(before["count"])+1,"tail",reservation)));owned.Remove(reservation);return true;
  });
 }
 internal Row Control(string operation,Row value,Row record,Row slot){
  string writer=S(value,"writer");if(writer!=Normal&&writer!=Receipt)throw Invalid();var auth=writer==Normal?"attemptId,writer,slotId":"attemptId,writer";
  if(operation=="NORMAL_SPOOL_PROFILE_STATE"||operation=="NORMAL_SPOOL_ALLOCATE"||operation=="NORMAL_SPOOL_RESUME")DesktopTrustKeyHostSource.Exact(value,auth);
  else if(operation=="NORMAL_SPOOL_RESERVE")DesktopTrustKeyHostSource.Exact(value,auth+",allocation,channel,nodeStamp");
  else if(operation=="NORMAL_SPOOL_SETTLE")DesktopTrustKeyHostSource.Exact(value,auth+",allocation,channel,reservation");
  else if(operation=="NORMAL_SPOOL_CLOSE")DesktopTrustKeyHostSource.Exact(value,auth+",allocation");else throw Invalid();
  string tuple=Tuple(writer,record,slot);
  return Log(false,(log,rows)=>{
   if(!Has(rows,"REGISTERED",H(record)))throw Invalid();
   if(writer==Normal&&!rows.Any(r=>S(r,"kind")=="SLOT_ID"&&S(r,"key")==S(slot,"slotId")&&S(r,"slotHash")==H(slot)))throw Invalid();
   var started=rows.LastOrDefault(r=>S(r,"kind")=="ALLOCATING"&&S(r,"key")==tuple);
   if(operation=="NORMAL_SPOOL_PROFILE_STATE")return R("profileId",profileId,"allocated",started!=null);
   bool creating=operation=="NORMAL_SPOOL_ALLOCATE",resuming=operation=="NORMAL_SPOOL_RESUME";
   var allocation=Allocate(rows,log,writer,tuple,!creating);string id=S(allocation,"id");var dir=root.RetainSpoolNamespace(id,false);
   if(dir.Identity!=S(allocation,"directoryIdentity"))throw Invalid();
   if(creating||resuming){if(Unsettled(rows).Values.Any(r=>S(r,"allocation")==id))throw Invalid();
    if(writer==Normal){var sr=DesktopTrustKeyHostSource.Map(slot["scope"]);string grant=H(sr["grantRef"]);if(creating)Append(log,rows,R("kind","GRANT","key",id,"grant",grant));
     else if(!rows.Any(r=>S(r,"kind")=="GRANT"&&S(r,"key")==id&&S(r,"grant")==grant))throw Invalid();}
    if(!opened.Add(id))throw Invalid();return R("state",creating?"ALLOCATED":"RESUMED","profileId",profileId,"allocation",id,"root",dir.Path,"directoryIdentity",dir.Identity);}
   if(!opened.Contains(id)||!ownedAllocation(id,value))throw Invalid();
   if(operation=="NORMAL_SPOOL_CLOSE"){if(owned.Values.Contains(id))throw Invalid();opened.Remove(id);return R("state","CLOSED_CONFIRMED");}
   string channel=Channel(value,writer);var prior=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"allocation")==id&&S(r,"channel")==channel);
   var before=prior==null?Empty():DesktopTrustKeyHostSource.Map(prior["summary"]);
   if(operation=="NORMAL_SPOOL_RESERVE"){string stamp=S(value,"nodeStamp");if(!Regex.IsMatch(stamp,@"\A[0-9]{1,20}:[0-9]{1,20}\z"))throw Invalid();var bound=rows.SingleOrDefault(r=>S(r,"kind")=="NODE_STAMP"&&S(r,"key")==id);if(bound==null)Append(log,rows,R("kind","NODE_STAMP","key",id,"stamp",stamp));else if(S(bound,"stamp")!=stamp)throw Invalid();var files=writer==Receipt?new Dictionary<string,string>():null;var observed=Inspect(rows,writer,id,dir,channel,null,files);if(J(observed)!=J(before))throw Invalid();
    long worst=writer==Normal?64*MiB-N(before["bytes"]):4096;
    var hold=Reserve(rows,log,writer,id,channel,worst,before);if(files!=null)receiptPrefixes.Add(S(hold,"id"),files);return R("reservation",hold["id"],"before",before);}
   string reservation=DesktopTrustKeyHostSource.Id(value,"reservation");string held;if(!owned.TryGetValue(reservation,out held)||held!=id)throw Invalid();
   var active=Unsettled(rows);Row saved;if(!active.TryGetValue(reservation,out saved)||S(saved,"channel")!=channel)throw Invalid();
   var checkedFiles=writer==Receipt?new Dictionary<string,string>():null;var after=Inspect(rows,writer,id,dir,channel,before,checkedFiles);
   if(checkedFiles!=null){var original=receiptPrefixes[reservation];if(checkedFiles.Count>original.Count+1||original.Any(p=>!checkedFiles.ContainsKey(p.Key)||checkedFiles[p.Key]!=p.Value))throw Invalid();}if(N(after["count"])<N(before["count"])||N(after["bytes"])<N(before["bytes"])||N(after["bytes"])-N(before["bytes"])>N(saved["worst"]))throw Invalid();
   Append(log,rows,R("kind","SETTLED","writer",writer,"allocation",id,"channel",channel,"id",reservation,"summary",after));owned.Remove(reservation);receiptPrefixes.Remove(reservation);return R("state","SETTLED","summary",after);
  });
 }
 static bool ownedAllocation(string id,Row payload){return id==DesktopTrustKeyHostSource.Id(payload,"allocation");}
}
