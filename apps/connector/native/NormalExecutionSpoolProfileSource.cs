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
 const string Output="sdk-session-output";
 const long OutputManagementWorst=4*(MaxEntry+36L)+AdminHold;
 readonly Dictionary<string,long> outputCosts=new Dictionary<string,long>();
 readonly HashSet<string> outputWrite=new HashSet<string>();
 static bool IsOutput(Row r){return r.ContainsKey("channel")&&Object.Equals(r["channel"],Output);}
 void Account(Row row,int cipherLength){
  if(!IsOutput(row))return;string id=S(row,"id");long used;outputCosts.TryGetValue(id,out used);
  outputCosts[id]=checked(used+4+cipherLength+32);if(outputCosts[id]>OutputManagementWorst)throw Invalid();
 }
 FileStream activeAnchor;
 static readonly byte[] Entropy=Encoding.UTF8.GetBytes(Purpose);
 readonly DesktopTrustKeyRootSource root;
 readonly Action current;
 DesktopTrustKeyDirectoryFact directory;
 string profileId;
 bool blocked,understandingReadOnly;
 NormalUnderstandingReadSupervisorSource understandingSupervisor;
 sealed class UnderstandingResultCapability {internal readonly Row Request;internal readonly string CloseHash;internal UnderstandingResultCapability(Row request,string hash){Request=request;CloseHash=hash;}}
 UnderstandingResultCapability understandingResultCapability;Row understandingPreparedAdmission;
 UnderstandingResultCapability understandingRangeResultCapability;Row understandingRangePreparedAdmission;
 internal void BindUnderstandingSupervisor(NormalUnderstandingReadSupervisorSource supervisor){if(supervisor==null||understandingSupervisor!=null||understandingReadOnly)throw Invalid();understandingSupervisor=supervisor;}
 readonly HashSet<string> opened=new HashSet<string>();
 readonly Dictionary<string,Dictionary<string,string>> receiptPrefixes=new Dictionary<string,Dictionary<string,string>>();
 readonly Dictionary<string,string> owned=new Dictionary<string,string>();
 [StructLayout(LayoutKind.Sequential)]struct FT{internal uint Low,High;}
 [StructLayout(LayoutKind.Sequential)]struct FI{internal uint Attributes;internal FT Created,Accessed,Written;internal uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandleW(IntPtr handle,StringBuilder path,uint length,uint flags);
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
 // reader는 발급·쓰기 permit 없이 기존 DPAPI/anchor의 같은 검산만 수행한다.
 internal static NormalExecutionSpoolProfileSource OpenExistingForUnderstanding(DesktopTrustKeyRootSource root,Action current){
  if(root==null||current==null)throw Invalid();var p=new NormalExecutionSpoolProfileSource(root,current);p.understandingReadOnly=true;
  p.directory=root.RetainSpoolNamespace(null,false);
  p.Log(false,(log,rows)=>{if(rows.Count==0||S(rows[0],"kind")!="PROFILE"||N(rows[0]["schemaVersion"])!=1||J(rows[0]["caps"])!=J(Caps()))throw Invalid();p.profileId=DesktopTrustKeyHostSource.Id(rows[0],"profileId");return true;});return p;
 }
 string AnchorPath(){return Path.Combine(root.PathValue,"owned-spool-profile.v1.head");}
 string FileIdentity(FileStream f,string path){
  FI info;if(!GetFileInformationByHandle(f.SafeFileHandle.DangerousGetHandle(),out info)||info.Links!=1||(info.Attributes&0x410)!=0)throw Invalid();
  if(understandingReadOnly){
   var final=new StringBuilder(1100);uint n=GetFinalPathNameByHandleW(f.SafeFileHandle.DangerousGetHandle(),final,(uint)final.Capacity,0);if(n==0||n>=final.Capacity)throw Invalid();string observed=final.ToString();if(observed.StartsWith(@"\\?\",StringComparison.Ordinal))observed=observed.Substring(4);
   string expected=Path.GetFullPath(path);if(!expected.StartsWith(root.PathValue+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)||!String.Equals(observed,expected,StringComparison.OrdinalIgnoreCase))throw Invalid();
  }
  var acl=f.GetAccessControl();
  if(acl.GetOwner(typeof(SecurityIdentifier)).Value!=root.UserSid)throw Invalid();
  var rules=acl.GetAccessRules(true,true,typeof(SecurityIdentifier));var principals=new HashSet<string>();
  foreach(FileSystemAccessRule rule in rules)if(rule.AccessControlType!=AccessControlType.Allow||rule.FileSystemRights!=FileSystemRights.FullControl||!principals.Add(rule.IdentityReference.Value))throw Invalid();
  if(!principals.SetEquals(new[]{root.UserSid,"S-1-5-18"}))throw Invalid();
  return String.Join(":",info.Volume,info.IndexHigh,info.IndexLow);
 }
 // 모든 writer가 동일 FileShare.None 원장을 짧게 잡는다. callback은 native의 동기 metadata 연산에만 사용한다.
 T Log<T>(bool create,Func<FileStream,List<Row>,T> act){
  Check();if(create&&understandingReadOnly)throw Invalid();string path=Path.Combine(directory.Path,"management.v1");
  string anchorPath=AnchorPath();
  using(var log=new FileStream(path,create?FileMode.CreateNew:FileMode.Open,understandingReadOnly?FileAccess.Read:FileAccess.ReadWrite,FileShare.None))
  using(var anchor=new FileStream(anchorPath,create?FileMode.CreateNew:FileMode.Open,understandingReadOnly?FileAccess.Read:FileAccess.ReadWrite,FileShare.None)){
   string file=FileIdentity(log,path),head=FileIdentity(anchor,anchorPath);
   if(activeAnchor!=null||checked(log.Length+anchor.Length)>AdminCap||anchor.Length%32!=0)throw Invalid();
   outputCosts.Clear();var rows=new List<Row>();string previous=null;using(var reader=new BinaryReader(log,Encoding.UTF8,true)){
    while(log.Position<log.Length){Check();int n=reader.ReadInt32();if(n<1||n>MaxEntry||n>log.Length-log.Position)throw Invalid();var encrypted=reader.ReadBytes(n);
     byte[] plain=ProtectedData.Unprotect(encrypted,Entropy,DataProtectionScope.CurrentUser);
     try{var wrap=DesktopTrustKeyHostSource.Parse(plain,false);DesktopTrustKeyHostSource.Exact(wrap,"purpose,sid,root,namespaceId,fileId,headId,sequence,previous,event");
      if(S(wrap,"purpose")!=Purpose||S(wrap,"sid")!=root.UserSid||S(wrap,"root")!=root.Identity||S(wrap,"namespaceId")!=directory.Identity||S(wrap,"fileId")!=file||S(wrap,"headId")!=head||N(wrap["sequence"])!=rows.Count+1||!Object.Equals(wrap["previous"],previous))throw Invalid();
      var row=DesktopTrustKeyHostSource.Map(wrap["event"]);rows.Add(row);Account(row,n);previous=H(row);
      var attested=new byte[32];using(var sha=SHA256.Create()){if(anchor.Read(attested,0,32)!=32||!sha.ComputeHash(encrypted).SequenceEqual(attested))throw Invalid();}
     }finally{Array.Clear(plain,0,plain.Length);}
    }
   }
   if(!create&&(rows.Count==0||S(rows[0],"kind")!="PROFILE"||(profileId!=null&&S(rows[0],"profileId")!=profileId)))throw Invalid();
   if(anchor.Position!=anchor.Length)throw Invalid();activeAnchor=anchor;
   try{var result=act(log,rows);Check();return result;}finally{activeAnchor=null;}
  }
 }
 long ManagementHold(List<Row> rows){var holds=new HashSet<string>();long dirs=4096;
  foreach(var r in rows){string k=S(r,"kind");if(k=="RESERVED")holds.Add(S(r,"id"));if(k=="SETTLED"&&!holds.Remove(S(r,"id")))throw Invalid();if(k=="ALLOCATING")dirs=checked(dirs+4096);}
  foreach(string id in holds){long spent;dirs=checked(dirs+(outputCosts.TryGetValue(id,out spent)?OutputManagementWorst-spent:AdminHold));}return dirs;
 }
 void Append(FileStream log,List<Row> rows,Row row){
  if(understandingReadOnly)throw Invalid();Check();string path=Path.Combine(directory.Path,"management.v1");var wrap=R("purpose",Purpose,"sid",root.UserSid,"root",root.Identity,"namespaceId",directory.Identity,
   "fileId",FileIdentity(log,path),"headId",FileIdentity(activeAnchor,AnchorPath()),"sequence",rows.Count+1,"previous",rows.Count==0?null:H(rows[rows.Count-1]),"event",row);
  var plain=Encoding.UTF8.GetBytes(J(wrap));byte[] cipher=null;
  try{cipher=ProtectedData.Protect(plain,Entropy,DataProtectionScope.CurrentUser);if(cipher.Length>MaxEntry)throw Invalid();
   rows.Add(row);Account(row,cipher.Length);if(checked(log.Length+4+cipher.Length+activeAnchor.Length+32+ManagementHold(rows))>AdminCap)throw new SpoolCapacityException();
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
  string c=S(value,"channel");if(writer==Receipt?c!="inbox":c!=Output&&!Regex.IsMatch(c,@"\A(?:observations|acks|(?:intake|attempt)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\z"))throw Invalid();return c;
 }
 Dictionary<string,Row> Unsettled(List<Row> rows){
  var pending=new Dictionary<string,Row>();foreach(var row in rows){string k=S(row,"kind");if(k=="RESERVED")pending.Add(S(row,"id"),row);if(k=="SETTLED"&&!pending.Remove(S(row,"id")))throw Invalid();}return pending;
 }
 Row Reserve(List<Row> rows,FileStream log,string writer,string allocation,string channel,long worst,Row summary,Row output=null){
  long used=0;var pending=Unsettled(rows);foreach(var row in pending.Values){if(S(row,"writer")==writer)used=checked(used+N(row["worst"]));if(S(row,"allocation")==allocation&&S(row,"channel")==channel)throw Invalid();}
  long heldBefore=used;used=0;if(writer==Normal)foreach(var cost in outputCosts)if(!pending.ContainsKey(cost.Key))used=checked(used+cost.Value);
  var latest=new Dictionary<string,Row>();foreach(var row in rows)if(S(row,"kind")=="SETTLED"&&S(row,"writer")==writer)latest[S(row,"allocation")+"/"+S(row,"channel")]=row;
  foreach(var row in latest.Values)used=checked(used+N(DesktopTrustKeyHostSource.Map(row["summary"])["bytes"]));
  long occupied=used;used=checked(used+heldBefore);if(checked(used+worst)>Cap(writer))throw new SpoolCapacityException();
  string id=Id();var reserved=R("kind","RESERVED","writer",writer,"allocation",allocation,"channel",channel,"id",id,"worst",worst,"before",summary);
  if(output!=null){reserved.Add("output",output);reserved.Add("normalUsed",occupied);reserved.Add("normalHeldBefore",heldBefore);}
  Append(log,rows,reserved);owned.Add(id,allocation);return reserved;
 }
 // 정상 channel은 순번 파일의 크기와 마지막 원 bytes를 확인한다. receipt는 이름·크기·내용 digest 전체를 고정한다.
 Row Inspect(List<Row> rows,string writer,string allocation,DesktopTrustKeyDirectoryFact dir,string channel,Row prefix,Dictionary<string,string> receiptFiles=null){
  Check();var names=new List<string>();var known=new HashSet<string>();var busy=new HashSet<string>();known.Add(channel);
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
 static Row EvidenceRef(string id,Row fact){return R("id",id,"version",1,"contentHash",H(fact));}
 static Row OutputScope(Row raw,List<Row> rows,Row alloc,Row record,Row slot){
  DesktopTrustKeyHostSource.Exact(raw,"projectId,executionId,generation,registrationRef,profileRef,assignmentRef,slotRef,grantRef,startReadyRef,dispatchAttemptRef,sessionBindingRef,plannedSidDigest");
  var scope=DesktopTrustKeyHostSource.Map(slot["scope"]);var reg=DesktopTrustKeyHostSource.Map(record["registration"]);
  if(J(raw["registrationRef"])!=J(reg["registrationRef"])||J(raw["profileRef"])!=J(EvidenceRef(S(rows[0],"profileId"),rows[0]))||
   J(raw["assignmentRef"])!=J(EvidenceRef(S(alloc,"id"),alloc))||J(raw["slotRef"])!=J(slot["receiptRef"])||J(raw["grantRef"])!=J(scope["grantRef"])||
   J(raw["generation"])!=J(scope["executionGeneration"])||S(raw,"projectId")!=S(scope,"projectId")||S(raw,"executionId")!=S(scope,"executionId")||
   !DesktopTrustKeyHostSource.IsHash(raw["plannedSidDigest"]))throw Invalid();
  foreach(string k in new[]{"startReadyRef","dispatchAttemptRef","sessionBindingRef"})DesktopTrustKeyHostSource.Ref(raw[k]);
  return raw;
 }
 // 별도 목적의 획득/읽기 근거. output RESERVED/SDK_READ_CLOSED의 쓰기 권위를 재사용하지 않는다.
 readonly string understandingHost=Id();
 static bool SameUnderstandingPickup(Row pickup,Row record,Row slot,Row requestRef,Row acquisitionRef,Row context,DateTime observed,DateTime expires){
  return S(pickup,"recordHash")==H(record)&&S(pickup,"slotHash")==H(slot)&&S(pickup,"attemptId")==S(record,"attemptId")&&
   J(pickup["requestRef"])==J(requestRef)&&J(pickup["acquisitionRef"])==J(acquisitionRef)&&J(pickup["context"])==J(context)&&
   DesktopTrustKeyHostSource.Time(pickup,"observedAt")==observed&&DesktopTrustKeyHostSource.Time(pickup,"expiresAt")==expires;
 }
 static bool SameUnderstandingGeneration(Row a,Row b){return S(a,"projectId")==S(b,"projectId")&&S(a,"executionId")==S(b,"executionId")&&N(a["executionGeneration"])==N(b["executionGeneration"]);}
 static bool UnfinishedUnderstandingGeneration(List<Row> rows,Row context){
  foreach(var began in rows.Where(r=>S(r,"kind")=="UNDERSTANDING_READ_STARTED"||S(r,"kind")=="UNDERSTANDING_RANGE_READ_STARTED")){
   bool range=S(began,"kind")=="UNDERSTANDING_RANGE_READ_STARTED";string key=S(began,"key");var pickup=rows.SingleOrDefault(r=>S(r,"kind")== (range?"UNDERSTANDING_RANGE_PICKUP":"UNDERSTANDING_PICKUP")&&S(r,"key")==key);if(pickup==null)throw Invalid();
   if(!SameUnderstandingGeneration(DesktopTrustKeyHostSource.Map(pickup["context"]),context))continue;
   var ended=rows.Where(r=>S(r,"kind")== (range?"UNDERSTANDING_RANGE_READ_CLOSED":"UNDERSTANDING_READ_CLOSED")&&S(r,"key")==key).ToList();
   if(ended.Count!=1||S(began,"pickupHash")!=H(pickup)||S(ended[0],"pickupHash")!=H(pickup)||S(began,"host")!=S(ended[0],"host")||J(pickup["expiresAt"])!=J(ended[0]["expiresAt"]))return true;
  }return false;
 }
 internal void BindUnderstandingPickup(Row record,Row slot,Row requestRef,Row acquisitionRef,Row context,DateTime observed,DateTime expires,DateTime started){
  string key=S(requestRef,"id");
  Log(false,(log,rows)=>{
   if(!Has(rows,"REGISTERED",H(record))||!rows.Any(r=>S(r,"kind")=="SLOT_ID"&&S(r,"key")==S(slot,"slotId")&&S(r,"slotHash")==H(slot))||
    expires<=DateTime.UtcNow||expires>DesktopTrustKeyHostSource.Time(slot,"expiresAt"))throw Invalid();
   var pickup=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_PICKUP"&&S(r,"key")==key);
   if(pickup!=null){
    DesktopTrustKeyHostSource.Exact(pickup,"kind,key,recordHash,slotHash,attemptId,pickupHost,requestRef,acquisitionRef,context,observedAt,expiresAt");
    DesktopTrustKeyHostSource.Id(pickup,"pickupHost");
    if(!SameUnderstandingPickup(pickup,record,slot,requestRef,acquisitionRef,context,observed,expires))throw Invalid();
    var begun=rows.Where(r=>S(r,"kind")=="UNDERSTANDING_READ_STARTED"&&S(r,"key")==key).ToList();
    var closed=rows.Where(r=>S(r,"kind")=="UNDERSTANDING_READ_CLOSED"&&S(r,"key")==key).ToList();
    if(begun.Count!=0||closed.Count!=0){
     if(begun.Count!=1||closed.Count!=1||S(begun[0],"pickupHash")!=H(pickup)||S(closed[0],"pickupHash")!=H(pickup)||
      S(begun[0],"host")!=S(closed[0],"host")||DesktopTrustKeyHostSource.Time(closed[0],"expiresAt")!=expires)throw Invalid();
    }
    // 정상 검산된 원 영수증만 재관측한다. 새 host/시각/권위나 START/CLOSE를 발급하지 않는다.
    return true;
   }
   if(UnfinishedUnderstandingGeneration(rows,context))throw Invalid();
   if(observed<started)throw Invalid();
   if(rows.Any(r=>S(r,"kind")=="UNDERSTANDING_PICKUP"&&S(r,"slotHash")==H(slot)&&DesktopTrustKeyHostSource.Time(r,"expiresAt")>DateTime.UtcNow&&!Has(rows,"UNDERSTANDING_READ_CLOSED",S(r,"key"))))throw Invalid();
   Append(log,rows,R("kind","UNDERSTANDING_PICKUP","key",key,"recordHash",H(record),"slotHash",H(slot),"attemptId",record["attemptId"],
    "pickupHost",understandingHost,"requestRef",requestRef,"acquisitionRef",acquisitionRef,"context",context,
    "observedAt",observed.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",System.Globalization.CultureInfo.InvariantCulture),
    "expiresAt",expires.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",System.Globalization.CultureInfo.InvariantCulture)));
   return true;
  });
 }
 // 실제 원 HTTPS RANGE 영수증만 호출한다. 전체 선택의 hash와 원 경계를 원장에 결박한다.
 internal void BindUnderstandingRangePickup(Row record,Row slot,Row requestRef,Row acquisitionRef,Row context,Row selection,DateTime observed,DateTime expires){
  if(understandingReadOnly)throw Invalid();string key=S(requestRef,"id");
  Log(false,(log,rows)=>{
   if(!Has(rows,"REGISTERED",H(record))||!rows.Any(r=>S(r,"kind")=="SLOT_ID"&&S(r,"key")==S(slot,"slotId")&&S(r,"slotHash")==H(slot))||expires<=DateTime.UtcNow||expires>DesktopTrustKeyHostSource.Time(slot,"expiresAt"))throw Invalid();
   var prior=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_PICKUP"&&S(r,"key")==key);
   if(prior!=null){if(!SameUnderstandingPickup(prior,record,slot,requestRef,acquisitionRef,context,observed,expires)||S(prior,"selectionHash")!=H(selection))throw Invalid();return true;}
   if(UnfinishedUnderstandingGeneration(rows,context))throw Invalid();
   Append(log,rows,R("kind","UNDERSTANDING_RANGE_PICKUP","key",key,"recordHash",H(record),"slotHash",H(slot),"attemptId",record["attemptId"],"pickupHost",understandingHost,
    "requestRef",requestRef,"acquisitionRef",acquisitionRef,"context",context,"selectionHash",H(selection),"sourceRequestRef",selection["requestRef"],"sourceResultRef",selection["resultRef"],
    "initConfirmationRef",selection["initConfirmationRef"],"tailRef",selection["tailRef"],"firstSequence",selection["firstSequence"],"lastSequence",selection["lastSequence"],
    "observedAt",observed.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",System.Globalization.CultureInfo.InvariantCulture),"expiresAt",expires.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",System.Globalization.CultureInfo.InvariantCulture)));
   return true;
  });
 }
 Row ReadUnderstandingRow(DesktopTrustKeyDirectoryFact dir,string channel,int sequence,out string hash){
  Check();string path=Path.Combine(dir.Path,channel+"."+sequence.ToString("D6")+".json");
  using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)){
   string identity=FileIdentity(file,path);long length=file.Length;if(length<1||length>3*MiB)throw Invalid();byte[] bytes=new byte[checked((int)length)];
   try{int offset=0;while(offset<bytes.Length){Check();int n=file.Read(bytes,offset,Math.Min(65536,bytes.Length-offset));if(n<1)throw Invalid();offset+=n;}
    if(file.ReadByte()!=-1||file.Length!=length||FileIdentity(file,path)!=identity)throw Invalid();hash=DesktopTrustKeyHostSource.Hash(bytes);
    Row row=DesktopTrustKeyHostSource.Parse(bytes,true);DesktopTrustKeyHostSource.Exact(row,"ref,snapshot");Check();return row;
   }finally{Array.Clear(bytes,0,bytes.Length);}
  }
 }
 static void SdkKeys(Row value,string required,string optional=""){
  var must=required.Split(',');var allowed=new HashSet<string>(must.Concat(optional==""?new string[0]:optional.Split(',')),StringComparer.Ordinal);
  if(must.Any(k=>!value.ContainsKey(k))||value.Keys.Any(k=>!allowed.Contains(k)))throw Invalid();
 }
 static bool SdkOpaque(object value){var text=value as string;return text!=null&&text.Length>0&&text.Length<=512&&!text.Any(c=>c<32||c==127);}
 static bool SdkStrings(object value){var list=value as object[];return list!=null&&list.All(x=>x is string);}
 static bool SdkParent(object value){return value==null||SdkOpaque(value);}
 static bool SdkNumber(object value){return value is int||value is long||value is double||value is decimal;}
 static string UnderstandingFamily(Row m){
  if(!m.ContainsKey("type")||!m.ContainsKey("session_id")||!m.ContainsKey("uuid")||!SdkOpaque(m["session_id"])||!SdkOpaque(m["uuid"]))throw Invalid();string type=S(m,"type");
  if(type=="system"){
   SdkKeys(m,"type,subtype,apiKeySource,claude_code_version,cwd,tools,mcp_servers,model,permissionMode,slash_commands,output_style,skills,plugins,uuid,session_id","agents,betas,fast_mode_state,fast_mode_disabled_reason,capabilities");
   if(S(m,"subtype")!="init"||S(m,"claude_code_version")!="2.1.224")throw Invalid();
   foreach(string k in new[]{"apiKeySource","cwd","model","permissionMode","output_style"})if(!(m[k] is string))throw Invalid();
   foreach(string k in new[]{"tools","slash_commands","skills"})if(!SdkStrings(m[k]))throw Invalid();
   var servers=m["mcp_servers"] as object[];var plugins=m["plugins"] as object[];if(servers==null||plugins==null)throw Invalid();
   foreach(object raw in servers){var v=DesktopTrustKeyHostSource.Map(raw);SdkKeys(v,"name,status");if(!(v["name"] is string)||!(v["status"] is string))throw Invalid();}
   foreach(object raw in plugins){var v=DesktopTrustKeyHostSource.Map(raw);SdkKeys(v,"name,path","version");if(!(v["name"] is string)||!(v["path"] is string)||v.ContainsKey("version")&&!(v["version"] is string))throw Invalid();}return "SYSTEM_INIT";
  }
  if(type=="assistant"){
   SdkKeys(m,"type,message,parent_tool_use_id,uuid,session_id","error,request_id,resumed_from_incomplete_thinking,supersedes,aborted,subagent_type,task_description,timestamp");
   if(!(m["message"] is Row)||!SdkParent(m["parent_tool_use_id"])||m.ContainsKey("error")&&!new[]{"authentication_failed","oauth_org_not_allowed","billing_error","rate_limit","overloaded","invalid_request","model_not_found","server_error","unknown","max_output_tokens"}.Contains(S(m,"error")))throw Invalid();return "ASSISTANT";
  }
  if(type=="stream_event"){
   SdkKeys(m,"type,event,parent_tool_use_id,uuid,session_id","ttft_ms");if(!(m["event"] is Row)||!SdkParent(m["parent_tool_use_id"]))throw Invalid();return "STREAM_EVENT";
  }
  if(type!="result"||!m.ContainsKey("subtype"))throw Invalid();bool success=S(m,"subtype")=="success";
  if(!success&&!new[]{"error_during_execution","error_max_turns","error_max_budget_usd","error_max_structured_output_retries"}.Contains(S(m,"subtype")))throw Invalid();
  SdkKeys(m,"type,subtype,duration_ms,duration_api_ms,is_error,num_turns,stop_reason,total_cost_usd,usage,modelUsage,permission_denials,uuid,session_id,"+(success?"result":"errors"),
   "terminal_reason,fast_mode_state,fast_mode_disabled_reason,origin"+(success?",ttft_ms,ttft_stream_ms,time_to_request_ms,user_message_uuid,request_sent_wall_ms,time_to_request_from_spawn_ms,warm_spare_claimed,time_origin_ms,api_error_status,structured_output,deferred_tool_use":""));
  foreach(string k in new[]{"duration_ms","duration_api_ms","num_turns","total_cost_usd"})if(!SdkNumber(m[k]))throw Invalid();
  if(!(m["is_error"] is bool)||!(m["stop_reason"]==null||m["stop_reason"] is string)||!(m["usage"] is Row)||!(m["modelUsage"] is Row)||!(m["permission_denials"] is object[])||success&&!(m["result"] is string)||!success&&!SdkStrings(m["errors"]))throw Invalid();return success?"RESULT_SUCCESS":"RESULT_ERROR";
 }
 Row ReadUnderstandingOutput(List<Row> rows,Row allocation,DesktopTrustKeyDirectoryFact dir,Row basis,Row pickup,Row summary){
  var record=R("registration",R("registrationRef",basis["registrationRef"]));
  var slot=R("receiptRef",basis["slotReceiptRef"],"scope",R("projectId",basis["projectId"],"executionId",basis["executionId"],"executionGeneration",basis["executionGeneration"],"grantRef",basis["grantRef"]));
  string id=S(allocation,"id");long count=N(summary["count"]);if(count<1||count>10000)throw Invalid();
  Row context=DesktopTrustKeyHostSource.Map(pickup["context"]),scope=null;object previous=null,init=null;string prefix=H(new object[0]),lastFamily=null;bool initSeen=false;long blocks=0;DateTime last=DateTime.MinValue;
  var ids=new HashSet<string>();var identities=new HashSet<string>();var ranges=new List<object>();
  for(int n=1;n<=count;n++){
   Check();if(DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(pickup,"expiresAt"))throw Invalid();string rawHash;Row row=ReadUnderstandingRow(dir,Output,n,out rawHash),v=DesktopTrustKeyHostSource.Map(row["snapshot"]),reference=DesktopTrustKeyHostSource.Ref(row["ref"]);
   if(scope==null){scope=OutputScope(DesktopTrustKeyHostSource.Map(v["scope"]),rows,allocation,record,slot);
    if(J(scope["sessionBindingRef"])!=J(context["sessionBindingRef"])||!rows.Any(r=>S(r,"kind")=="GRANT"&&S(r,"key")==id&&S(r,"grant")==H(scope["grantRef"])))throw Invalid();
    var reservations=rows.Where(r=>S(r,"kind")=="RESERVED"&&S(r,"allocation")==id&&IsOutput(r)).ToArray();
    if(reservations.Length==0||reservations.Any(r=>!r.ContainsKey("output")||S(DesktopTrustKeyHostSource.Map(r["output"]),"scopeDigest")!=H(scope)||S(DesktopTrustKeyHostSource.Map(r["output"]),"recordHash")!=S(basis,"recordHash")||S(DesktopTrustKeyHostSource.Map(r["output"]),"slotHash")!=S(basis,"slotHash")||S(DesktopTrustKeyHostSource.Map(r["output"]),"attemptId")!=S(basis,"attemptId")))throw Invalid();
    object received;ReadSdkAttemptChain(rows,id,dir,scope,S(context,"startCommandId"),true,null,out received);
    string ignored;var start=ReadUnderstandingRow(dir,"attempt-"+S(context,"startCommandId"),3,out ignored);
    if(J(start["ref"])!=J(scope["startReadyRef"]))throw Invalid();
   }
   DateTime observed=DesktopTrustKeyHostSource.Time(v,"observedAt");
   if(N(reference["version"])!=1||!ids.Add(S(reference,"id"))||S(reference,"contentHash")!=H(v)||N(v["schemaVersion"])!=1||N(v["sequence"])!=n||J(v["scope"])!=J(scope)||J(v["previousRef"])!=J(previous)||observed<last||observed>DateTime.UtcNow||n==count&&rawHash!=S(summary,"tail"))throw Invalid();last=observed;
   if(S(v,"state")=="SESSION_INIT_CONFIRMED"){
    DesktopTrustKeyHostSource.Exact(v,"schemaVersion,state,scope,sequence,previousRef,initOutputRef,observedSidDigest,prefixCount,tailRef,prefixDigest,observedAt");
    if(init!=null||lastFamily!="SYSTEM_INIT"||J(v["initOutputRef"])!=J(previous)||J(v["tailRef"])!=J(previous)||N(v["prefixCount"])!=n-1||S(v,"prefixDigest")!=prefix||S(v,"observedSidDigest")!=S(scope,"plannedSidDigest"))throw Invalid();init=reference;
   }else{
    DesktopTrustKeyHostSource.Exact(v,"schemaVersion,state,scope,sequence,previousRef,initConfirmationRef,observedAt,family,identity,payloadDigest,classification,body");
    if(S(v,"state")!=(init==null?"OUTPUT_PENDING_SESSION":"SESSION_OUTPUT")||J(v["initConfirmationRef"])!=J(init)||S(v,"classification")!="ORDINARY"||!DesktopTrustKeyHostSource.IsHash(v["payloadDigest"]))throw Invalid();
    string encoded=S(v,"body");if(encoded.Length>2796204)throw Invalid();byte[] bytes=Convert.FromBase64String(encoded);
    try{
     if(bytes.Length>2*MiB||Convert.ToBase64String(bytes)!=encoded||DesktopTrustKeyHostSource.Hash(bytes)!=S(v,"payloadDigest"))throw Invalid();
     var message=NormalExecutionCredentialSource.ReadUnderstandingSdkBody(bytes);string family=UnderstandingFamily(message);
     if(family!=S(v,"family")||H(message["uuid"])!=S(v,"identity")||!identities.Add(S(v,"identity"))||H(message["session_id"])!=S(scope,"plannedSidDigest"))throw Invalid();
     if(family=="SYSTEM_INIT"){if(initSeen||init!=null)throw Invalid();initSeen=true;}
     if(family=="ASSISTANT"){
      var content=DesktopTrustKeyHostSource.Map(message["message"]);var list=content.ContainsKey("content")?content["content"] as object[]:null;
      if(message["parent_tool_use_id"]!=null||message.ContainsKey("error")||list==null||list.Length<1||list.Length>200||content.ContainsKey("role")&&!Object.Equals(content["role"],"assistant"))throw Invalid();long textBytes=0;
      foreach(object raw in list){var block=DesktopTrustKeyHostSource.Map(raw);DesktopTrustKeyHostSource.Exact(block,"type,text");string text=S(block,"text");
       if(S(block,"type")!="text"||text.Trim(new[]{'\u0009','\u000a','\u000b','\u000c','\u000d','\u0020','\u00a0','\u1680','\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008','\u2009','\u200a','\u2028','\u2029','\u202f','\u205f','\u3000','\ufeff'}).Length==0)throw Invalid();textBytes=checked(textBytes+Encoding.UTF8.GetByteCount(text));}
      blocks=checked(blocks+list.Length);if(blocks>200||ranges.Count>=200)throw Invalid();ranges.Add(R("outputRef",reference,"sequence",n,"payloadDigest",v["payloadDigest"],"textBlocks",list.Length,"textBytes",textBytes));
     }
     lastFamily=family;
    }finally{Array.Clear(bytes,0,bytes.Length);}
    prefix=H(R("previous",prefix,"ref",reference,"payloadDigest",v["payloadDigest"]));
   }previous=reference;
  }
  if(init==null||previous==null)throw Invalid();return R("attribution","SESSION_ONLY","projectId",scope["projectId"],"executionId",scope["executionId"],"executionGeneration",scope["generation"],
   "requestRef",pickup["requestRef"],"acquisitionRef",pickup["acquisitionRef"],"contextBundleRef",context["contextBundleRef"],"initConfirmationRef",init,"tailRef",previous,"ranges",ranges.ToArray(),"wholeConversationComplete",false,"executionAuthorized",false);
 }
 // 같은 할당의 미완결 native read는 기존 모든 Control 쓰기/재개를 막는다.
 Row ReadUnderstandingRangeOutput(List<Row> rows,Row allocation,DesktopTrustKeyDirectoryFact dir,Row basis,Row pickup,Row summary,Row selection){
  var record=R("registration",R("registrationRef",basis["registrationRef"]));
  var slot=R("receiptRef",basis["slotReceiptRef"],"scope",R("projectId",basis["projectId"],"executionId",basis["executionId"],"executionGeneration",basis["executionGeneration"],"grantRef",basis["grantRef"]));
  string id=S(allocation,"id");long count=N(summary["count"]);if(count<1||count>10000)throw Invalid();
  Row context=DesktopTrustKeyHostSource.Map(pickup["context"]),scope=null;object previous=null,init=null;string prefix=H(new object[0]),lastFamily=null;bool initSeen=false;long blocks=0;DateTime last=DateTime.MinValue;
  var ids=new HashSet<string>();var identities=new HashSet<string>();var parts=new List<object>();object before=null,after=null;
  long first=N(selection["firstSequence"]),lastSelected=N(selection["lastSequence"]);var expected=selection["ranges"] as object[];
  if(expected==null||expected.Length<1||expected.Length>200||lastSelected-first+1!=expected.Length||lastSelected>count)throw Invalid();
  for(int n=1;n<=count;n++){
   Check();if(DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(pickup,"expiresAt"))throw Invalid();string rawHash;Row row=ReadUnderstandingRow(dir,Output,n,out rawHash),v=DesktopTrustKeyHostSource.Map(row["snapshot"]),reference=DesktopTrustKeyHostSource.Ref(row["ref"]);
   if(scope==null){scope=OutputScope(DesktopTrustKeyHostSource.Map(v["scope"]),rows,allocation,record,slot);
    if(J(scope["sessionBindingRef"])!=J(context["sessionBindingRef"])||!rows.Any(r=>S(r,"kind")=="GRANT"&&S(r,"key")==id&&S(r,"grant")==H(scope["grantRef"])))throw Invalid();
    var reservations=rows.Where(r=>S(r,"kind")=="RESERVED"&&S(r,"allocation")==id&&IsOutput(r)).ToArray();
    if(reservations.Length==0||reservations.Any(r=>!r.ContainsKey("output")||S(DesktopTrustKeyHostSource.Map(r["output"]),"scopeDigest")!=H(scope)||S(DesktopTrustKeyHostSource.Map(r["output"]),"recordHash")!=S(basis,"recordHash")||S(DesktopTrustKeyHostSource.Map(r["output"]),"slotHash")!=S(basis,"slotHash")||S(DesktopTrustKeyHostSource.Map(r["output"]),"attemptId")!=S(basis,"attemptId")))throw Invalid();
    object received;ReadSdkAttemptChain(rows,id,dir,scope,S(context,"startCommandId"),true,null,out received);
    string ignored;var start=ReadUnderstandingRow(dir,"attempt-"+S(context,"startCommandId"),3,out ignored);
    if(J(start["ref"])!=J(scope["startReadyRef"]))throw Invalid();
   }
   DateTime observed=DesktopTrustKeyHostSource.Time(v,"observedAt");
   if(N(reference["version"])!=1||!ids.Add(S(reference,"id"))||S(reference,"contentHash")!=H(v)||N(v["schemaVersion"])!=1||N(v["sequence"])!=n||J(v["scope"])!=J(scope)||J(v["previousRef"])!=J(previous)||observed<last||observed>DateTime.UtcNow||n==count&&rawHash!=S(summary,"tail"))throw Invalid();last=observed;
   bool selected=n>=first&&n<=lastSelected,fixedTail=S(reference,"id")==S(DesktopTrustKeyHostSource.Map(selection["tailRef"]),"id");
   if(fixedTail&&(J(reference)!=J(selection["tailRef"])||n<lastSelected))throw Invalid();
   if(n==first)before=previous;if(n==lastSelected+1)after=reference;
   if(S(v,"state")=="SESSION_INIT_CONFIRMED"){
    if(selected||J(reference)!=J(selection["initConfirmationRef"]))throw Invalid();
    DesktopTrustKeyHostSource.Exact(v,"schemaVersion,state,scope,sequence,previousRef,initOutputRef,observedSidDigest,prefixCount,tailRef,prefixDigest,observedAt");
    if(init!=null||lastFamily!="SYSTEM_INIT"||J(v["initOutputRef"])!=J(previous)||J(v["tailRef"])!=J(previous)||N(v["prefixCount"])!=n-1||S(v,"prefixDigest")!=prefix||S(v,"observedSidDigest")!=S(scope,"plannedSidDigest"))throw Invalid();init=reference;
   }else{
    DesktopTrustKeyHostSource.Exact(v,"schemaVersion,state,scope,sequence,previousRef,initConfirmationRef,observedAt,family,identity,payloadDigest,classification,body");
    if(S(v,"state")!=(init==null?"OUTPUT_PENDING_SESSION":"SESSION_OUTPUT")||J(v["initConfirmationRef"])!=J(init)||!new[]{"ORDINARY","QUARANTINED"}.Contains(S(v,"classification"))||!DesktopTrustKeyHostSource.IsHash(v["payloadDigest"]))throw Invalid();
    string encoded=S(v,"body");if(encoded.Length>2796204)throw Invalid();byte[] bytes=Convert.FromBase64String(encoded);
    try{
     if(bytes.Length>2*MiB||Convert.ToBase64String(bytes)!=encoded||DesktopTrustKeyHostSource.Hash(bytes)!=S(v,"payloadDigest"))throw Invalid();
     var message=NormalExecutionCredentialSource.ReadUnderstandingSdkBody(bytes);string family=UnderstandingFamily(message);
     if(family!=S(v,"family")||H(message["uuid"])!=S(v,"identity")||!identities.Add(S(v,"identity"))||H(message["session_id"])!=S(scope,"plannedSidDigest"))throw Invalid();
     if(family=="SYSTEM_INIT"){if(initSeen||init!=null)throw Invalid();initSeen=true;}
     if(selected){
      if(S(v,"classification")!="ORDINARY"||family!="ASSISTANT"||message.ContainsKey("subagent_type")||message.ContainsKey("task_description"))throw Invalid();
      var wanted=DesktopTrustKeyHostSource.Map(expected[n-first]);
      if(J(wanted["outputRef"])!=J(reference)||N(wanted["sequence"])!=n||S(wanted,"payloadDigest")!=S(v,"payloadDigest"))throw Invalid();
      var content=DesktopTrustKeyHostSource.Map(message["message"]);var list=content.ContainsKey("content")?content["content"] as object[]:null;
      if(message["parent_tool_use_id"]!=null||message.ContainsKey("error")||list==null||list.Length<1||list.Length>200||content.ContainsKey("role")&&!Object.Equals(content["role"],"assistant"))throw Invalid();long textBytes=0;
      foreach(object raw in list){var block=DesktopTrustKeyHostSource.Map(raw);DesktopTrustKeyHostSource.Exact(block,"type,text");string text=S(block,"text");
       if(S(block,"type")!="text"||text.Trim(new[]{'\u0009','\u000a','\u000b','\u000c','\u000d','\u0020','\u00a0','\u1680','\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008','\u2009','\u200a','\u2028','\u2029','\u202f','\u205f','\u3000','\ufeff'}).Length==0)throw Invalid();textBytes=checked(textBytes+Encoding.UTF8.GetByteCount(text));}
      if(N(wanted["textBlocks"])!=list.Length||N(wanted["textBytes"])!=textBytes)throw Invalid();
      blocks=checked(blocks+list.Length);if(blocks>200)throw Invalid();
      for(int index=0;index<list.Length;index++){string text=S(DesktopTrustKeyHostSource.Map(list[index]),"text");parts.Add(R("outputRef",reference,"sequence",n,"payloadDigest",v["payloadDigest"],"blockIndex",index,"kind","ASSISTANT_TEXT","text",text,"textHash",DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(text))));}
     }
     lastFamily=family;
    }finally{Array.Clear(bytes,0,bytes.Length);}
    prefix=H(R("previous",prefix,"ref",reference,"payloadDigest",v["payloadDigest"]));
   }previous=reference;if(fixedTail)break;
  }
  if(init==null||previous==null||parts.Count<1||J(previous)!=J(selection["tailRef"])||J(init)!=J(selection["initConfirmationRef"]))throw Invalid();
  return R("schemaVersion",1,"kind","FIXED_RANGE_SELECTION","attribution","SESSION_ONLY","projectId",scope["projectId"],"executionId",scope["executionId"],"executionGeneration",scope["generation"],
   "requestRef",pickup["requestRef"],"acquisitionRef",pickup["acquisitionRef"],"sourceRequestRef",selection["requestRef"],"sourceResultRef",selection["resultRef"],"contextBundleRef",context["contextBundleRef"],
   "initConfirmationRef",init,"tailRef",previous,"firstSequence",first,"lastSequence",lastSelected,"beforeRef",before,"afterRef",after,"parts",parts.ToArray(),"wholeConversationComplete",false,"executionAuthorized",false);
 }
 static bool PendingUnderstanding(List<Row> rows,string allocation){return rows.Any(r=>(S(r,"kind")=="UNDERSTANDING_READ_STARTED"||S(r,"kind")=="UNDERSTANDING_RANGE_READ_STARTED")&&r.ContainsKey("allocation")&&S(r,"allocation")==allocation&&!Has(rows,S(r,"kind")=="UNDERSTANDING_RANGE_READ_STARTED"?"UNDERSTANDING_RANGE_READ_CLOSED":"UNDERSTANDING_READ_CLOSED",S(r,"key")));}
 // 원 slot의 credential bearer/전체 record는 child 또는 보호 read basis에 복사하지 않는다.
 static Row UnderstandingReadBasis(Row record,Row slot,Row allocation,Row pickup){
  var reg=DesktopTrustKeyHostSource.Map(record["registration"]);var scope=DesktopTrustKeyHostSource.Map(slot["scope"]);var credential=DesktopTrustKeyHostSource.Map(record["credential"]);
  DateTime end=new[]{DesktopTrustKeyHostSource.Time(pickup,"expiresAt"),DesktopTrustKeyHostSource.Time(slot,"expiresAt"),DesktopTrustKeyHostSource.Time(reg,"registrationExpiresAt"),DesktopTrustKeyHostSource.Time(credential,"expiresAt")}.Min();
  return R("recordHash",H(record),"slotHash",H(slot),"attemptId",S(record,"attemptId"),"allocationKey",S(allocation,"key"),"installationId",reg["installationId"],"registrationRef",DesktopTrustKeyHostSource.Ref(reg["registrationRef"]),
   "slotId",S(slot,"slotId"),"slotReceiptRef",DesktopTrustKeyHostSource.Ref(slot["receiptRef"]),"projectId",scope["projectId"],"connectorId",scope["connectorId"],"executionId",scope["executionId"],"executionGeneration",scope["executionGeneration"],"grantRef",DesktopTrustKeyHostSource.Ref(scope["grantRef"]),
   "readExpiresAt",end.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",System.Globalization.CultureInfo.InvariantCulture));
 }
 static void ReadBasisShape(Row basis){
  DesktopTrustKeyHostSource.Exact(basis,"recordHash,slotHash,attemptId,allocationKey,installationId,registrationRef,slotId,slotReceiptRef,projectId,connectorId,executionId,executionGeneration,grantRef,readExpiresAt");
  foreach(string name in new[]{"recordHash","slotHash","allocationKey"})if(!DesktopTrustKeyHostSource.IsHash(basis[name]))throw Invalid();
  foreach(string name in new[]{"attemptId","installationId","slotId","projectId","connectorId","executionId"})DesktopTrustKeyHostSource.Id(basis,name);
  foreach(string name in new[]{"registrationRef","slotReceiptRef","grantRef"})DesktopTrustKeyHostSource.Ref(basis[name]);DesktopTrustKeyHostSource.Positive(basis["executionGeneration"]);DesktopTrustKeyHostSource.Time(basis,"readExpiresAt");
 }
 Row BeginSupervisedUnderstanding(List<Row> rows,FileStream log,Row value,Row record,Row slot,Row allocation,DesktopTrustKeyDirectoryFact dir){
  if(understandingSupervisor==null||understandingReadOnly)throw Invalid();
  var request=DesktopTrustKeyHostSource.Map(value["understanding"]);DesktopTrustKeyHostSource.Exact(request,"requestRef,acquisitionRef,bodyHash");
  var requested=DesktopTrustKeyHostSource.Ref(request["requestRef"]);DesktopTrustKeyHostSource.Ref(request["acquisitionRef"]);if(!DesktopTrustKeyHostSource.IsHash(request["bodyHash"]))throw Invalid();
  string key=S(requested,"id"),id=S(allocation,"id");var pickup=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_PICKUP"&&S(r,"key")==key);
  if(pickup==null||S(pickup,"pickupHost")==understandingHost||J(pickup["requestRef"])!=J(requested)||J(pickup["acquisitionRef"])!=J(request["acquisitionRef"])||S(pickup,"recordHash")!=H(record)||S(pickup,"slotHash")!=H(slot)||S(pickup,"attemptId")!=S(value,"attemptId")||DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(pickup,"expiresAt")||Has(rows,"UNDERSTANDING_READ_STARTED",key)||owned.Values.Contains(id)||Unsettled(rows).Values.Any(r=>S(r,"allocation")==id))throw Invalid();
  var basis=UnderstandingReadBasis(record,slot,allocation,pickup);ReadBasisShape(basis);understandingSupervisor.TightenRead(DesktopTrustKeyHostSource.Time(basis,"readExpiresAt"));
  var settled=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"allocation")==id&&S(r,"channel")==Output);if(settled==null)throw Invalid();var summary=DesktopTrustKeyHostSource.Map(settled["summary"]);
  if(J(Inspect(rows,Normal,id,dir,Output,summary))!=J(summary))throw Invalid();
  var started=R("kind","UNDERSTANDING_READ_STARTED","key",key,"host",understandingHost,"pickupHash",H(pickup),"allocation",id,"recordHash",H(record),"slotHash",H(slot),"directoryIdentity",dir.Identity,"summaryHash",H(summary),"readBasis",basis);
  Append(log,rows,started);
  return R("readBasis",basis,"request",request,"allocation",id,"profileId",profileId,"rootIdentity",root.Identity,"namespaceIdentity",directory.Identity,"directoryIdentity",dir.Identity,
   "pickupHash",H(pickup),"startedHash",H(started),"summary",summary,"logIdentity",FileIdentity(log,Path.Combine(directory.Path,"management.v1")),"anchorIdentity",FileIdentity(activeAnchor,AnchorPath()),"ledgerSequence",rows.Count,"ledgerTail",H(rows[rows.Count-1]));
 }
 Row BeginSupervisedUnderstandingRange(List<Row> rows,FileStream log,Row value,Row record,Row slot,Row allocation,DesktopTrustKeyDirectoryFact dir){
  if(understandingSupervisor==null||understandingReadOnly)throw Invalid();
  var request=DesktopTrustKeyHostSource.Map(value["understandingRange"]);DesktopTrustKeyHostSource.Exact(request,"requestRef,acquisitionRef,selection,bodyHash");
  var requested=DesktopTrustKeyHostSource.Ref(request["requestRef"]);DesktopTrustKeyHostSource.Ref(request["acquisitionRef"]);if(!DesktopTrustKeyHostSource.IsHash(request["bodyHash"]))throw Invalid();
  string key=S(requested,"id"),id=S(allocation,"id");var pickup=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_PICKUP"&&S(r,"key")==key);
  if(pickup==null||S(pickup,"pickupHost")==understandingHost||J(pickup["requestRef"])!=J(requested)||J(pickup["acquisitionRef"])!=J(request["acquisitionRef"])||S(pickup,"recordHash")!=H(record)||S(pickup,"slotHash")!=H(slot)||S(pickup,"attemptId")!=S(value,"attemptId")||DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(pickup,"expiresAt")||Has(rows,"UNDERSTANDING_RANGE_READ_STARTED",key)||owned.Values.Contains(id)||Unsettled(rows).Values.Any(r=>S(r,"allocation")==id))throw Invalid();
  if(H(request["selection"])!=S(pickup,"selectionHash"))throw Invalid();
  var basis=UnderstandingReadBasis(record,slot,allocation,pickup);ReadBasisShape(basis);understandingSupervisor.TightenRead(DesktopTrustKeyHostSource.Time(basis,"readExpiresAt"));
  var settled=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"allocation")==id&&S(r,"channel")==Output);if(settled==null)throw Invalid();var summary=DesktopTrustKeyHostSource.Map(settled["summary"]);
  if(J(Inspect(rows,Normal,id,dir,Output,summary))!=J(summary))throw Invalid();
  var started=R("kind","UNDERSTANDING_RANGE_READ_STARTED","key",key,"host",understandingHost,"pickupHash",H(pickup),"allocation",id,"recordHash",H(record),"slotHash",H(slot),"directoryIdentity",dir.Identity,"summaryHash",H(summary),"readBasis",basis,"requestHash",H(request));
  Append(log,rows,started);
  return R("readBasis",basis,"request",request,"allocation",id,"profileId",profileId,"rootIdentity",root.Identity,"namespaceIdentity",directory.Identity,"directoryIdentity",dir.Identity,
   "pickupHash",H(pickup),"startedHash",H(started),"summary",summary,"logIdentity",FileIdentity(log,Path.Combine(directory.Path,"management.v1")),"anchorIdentity",FileIdentity(activeAnchor,AnchorPath()),"ledgerSequence",rows.Count,"ledgerTail",H(rows[rows.Count-1]));
 }
 void CheckDelegatedSnapshot(Row request,FileStream log,List<Row> rows,out Row basis,out Row purpose,out Row allocation,out DesktopTrustKeyDirectoryFact dir,out Row pickup,out Row summary){
  DesktopTrustKeyHostSource.Exact(request,"readBasis,request,allocation,profileId,rootIdentity,namespaceIdentity,directoryIdentity,pickupHash,startedHash,summary,logIdentity,anchorIdentity,ledgerSequence,ledgerTail");
  basis=DesktopTrustKeyHostSource.Map(request["readBasis"]);ReadBasisShape(basis);purpose=DesktopTrustKeyHostSource.Map(request["request"]);summary=DesktopTrustKeyHostSource.Map(request["summary"]);
  DesktopTrustKeyHostSource.Exact(purpose,"requestRef,acquisitionRef,bodyHash");
  string id=DesktopTrustKeyHostSource.Id(request,"allocation"),key=DesktopTrustKeyHostSource.Id(DesktopTrustKeyHostSource.Ref(purpose["requestRef"]),"id"),recordHash=S(basis,"recordHash"),slotHash=S(basis,"slotHash"),slotId=S(basis,"slotId");DesktopTrustKeyHostSource.Ref(purpose["acquisitionRef"]);
  if(!DesktopTrustKeyHostSource.IsHash(purpose["bodyHash"])||S(request,"profileId")!=profileId||S(request,"rootIdentity")!=root.Identity||S(request,"namespaceIdentity")!=directory.Identity||N(request["ledgerSequence"])!=rows.Count||rows.Count==0||S(request,"ledgerTail")!=H(rows[rows.Count-1])||
   S(request,"logIdentity")!=FileIdentity(log,Path.Combine(directory.Path,"management.v1"))||S(request,"anchorIdentity")!=FileIdentity(activeAnchor,AnchorPath())||!Has(rows,"REGISTERED",recordHash)||
   !rows.Any(r=>S(r,"kind")=="SLOT_ID"&&S(r,"key")==slotId&&S(r,"slotHash")==slotHash&&S(r,"registration")==recordHash)||DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(basis,"readExpiresAt"))throw Invalid();
  string tuple=H(new object[]{Normal,recordHash,basis["installationId"],basis["registrationRef"],basis["projectId"],basis["connectorId"],basis["executionId"],basis["executionGeneration"]});
  allocation=rows.SingleOrDefault(r=>S(r,"kind")=="ALLOCATED"&&S(r,"id")==id);if(allocation==null||S(allocation,"key")!=tuple||S(basis,"allocationKey")!=tuple)throw Invalid();
  dir=root.RetainSpoolNamespace(id,false);if(dir.Identity!=S(request,"directoryIdentity")||dir.Identity!=S(allocation,"directoryIdentity")||Unsettled(rows).Values.Any(r=>S(r,"allocation")==id))throw Invalid();
  pickup=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_PICKUP"&&S(r,"key")==key);var started=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_READ_STARTED"&&S(r,"key")==key);
  if(pickup==null||started==null||H(pickup)!=S(request,"pickupHash")||H(started)!=S(request,"startedHash")||S(started,"allocation")!=id||S(started,"recordHash")!=recordHash||S(started,"slotHash")!=slotHash||S(started,"directoryIdentity")!=dir.Identity||S(started,"summaryHash")!=H(summary)||S(started,"pickupHash")!=H(pickup)||J(started["readBasis"])!=J(basis)||
   Has(rows,"UNDERSTANDING_READ_CLOSED",key)||S(pickup,"recordHash")!=recordHash||S(pickup,"slotHash")!=slotHash||S(pickup,"attemptId")!=S(basis,"attemptId")||J(pickup["requestRef"])!=J(purpose["requestRef"])||J(pickup["acquisitionRef"])!=J(purpose["acquisitionRef"])||DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(pickup,"expiresAt"))throw Invalid();
  if(!SameUnderstandingGeneration(DesktopTrustKeyHostSource.Map(pickup["context"]),basis))throw Invalid();
  var settled=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"allocation")==id&&S(r,"channel")==Output);if(settled==null||J(settled["summary"])!=J(summary)||J(Inspect(rows,Normal,id,dir,Output,summary))!=J(summary))throw Invalid();
 }
 void CheckDelegatedRangeSnapshot(Row request,FileStream log,List<Row> rows,out Row basis,out Row purpose,out Row allocation,out DesktopTrustKeyDirectoryFact dir,out Row pickup,out Row summary){
  DesktopTrustKeyHostSource.Exact(request,"readBasis,request,allocation,profileId,rootIdentity,namespaceIdentity,directoryIdentity,pickupHash,startedHash,summary,logIdentity,anchorIdentity,ledgerSequence,ledgerTail");
  basis=DesktopTrustKeyHostSource.Map(request["readBasis"]);ReadBasisShape(basis);purpose=DesktopTrustKeyHostSource.Map(request["request"]);summary=DesktopTrustKeyHostSource.Map(request["summary"]);
  DesktopTrustKeyHostSource.Exact(purpose,"requestRef,acquisitionRef,selection,bodyHash");
  string id=DesktopTrustKeyHostSource.Id(request,"allocation"),key=DesktopTrustKeyHostSource.Id(DesktopTrustKeyHostSource.Ref(purpose["requestRef"]),"id"),recordHash=S(basis,"recordHash"),slotHash=S(basis,"slotHash"),slotId=S(basis,"slotId");DesktopTrustKeyHostSource.Ref(purpose["acquisitionRef"]);
  if(!DesktopTrustKeyHostSource.IsHash(purpose["bodyHash"])||S(request,"profileId")!=profileId||S(request,"rootIdentity")!=root.Identity||S(request,"namespaceIdentity")!=directory.Identity||N(request["ledgerSequence"])!=rows.Count||rows.Count==0||S(request,"ledgerTail")!=H(rows[rows.Count-1])||
   S(request,"logIdentity")!=FileIdentity(log,Path.Combine(directory.Path,"management.v1"))||S(request,"anchorIdentity")!=FileIdentity(activeAnchor,AnchorPath())||!Has(rows,"REGISTERED",recordHash)||
   !rows.Any(r=>S(r,"kind")=="SLOT_ID"&&S(r,"key")==slotId&&S(r,"slotHash")==slotHash&&S(r,"registration")==recordHash)||DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(basis,"readExpiresAt"))throw Invalid();
  string tuple=H(new object[]{Normal,recordHash,basis["installationId"],basis["registrationRef"],basis["projectId"],basis["connectorId"],basis["executionId"],basis["executionGeneration"]});
  allocation=rows.SingleOrDefault(r=>S(r,"kind")=="ALLOCATED"&&S(r,"id")==id);if(allocation==null||S(allocation,"key")!=tuple||S(basis,"allocationKey")!=tuple)throw Invalid();
  dir=root.RetainSpoolNamespace(id,false);if(dir.Identity!=S(request,"directoryIdentity")||dir.Identity!=S(allocation,"directoryIdentity")||Unsettled(rows).Values.Any(r=>S(r,"allocation")==id))throw Invalid();
  pickup=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_PICKUP"&&S(r,"key")==key);var started=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_READ_STARTED"&&S(r,"key")==key);
  if(pickup==null||started==null||H(pickup)!=S(request,"pickupHash")||H(started)!=S(request,"startedHash")||S(started,"allocation")!=id||S(started,"recordHash")!=recordHash||S(started,"slotHash")!=slotHash||S(started,"directoryIdentity")!=dir.Identity||S(started,"summaryHash")!=H(summary)||S(started,"pickupHash")!=H(pickup)||J(started["readBasis"])!=J(basis)||
   Has(rows,"UNDERSTANDING_RANGE_READ_CLOSED",key)||S(pickup,"recordHash")!=recordHash||S(pickup,"slotHash")!=slotHash||S(pickup,"attemptId")!=S(basis,"attemptId")||J(pickup["requestRef"])!=J(purpose["requestRef"])||J(pickup["acquisitionRef"])!=J(purpose["acquisitionRef"])||DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(pickup,"expiresAt"))throw Invalid();
  if(H(purpose["selection"])!=S(pickup,"selectionHash")||S(started,"requestHash")!=H(purpose))throw Invalid();
  if(!SameUnderstandingGeneration(DesktopTrustKeyHostSource.Map(pickup["context"]),basis))throw Invalid();
  var settled=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"allocation")==id&&S(r,"channel")==Output);if(settled==null||J(settled["summary"])!=J(summary)||J(Inspect(rows,Normal,id,dir,Output,summary))!=J(summary))throw Invalid();
 }
 // 고정 reader 모드만 호출한다. key store/발급/서명 및 원장 Append는 없다.
 internal Row ReadDelegatedUnderstanding(Row request){
  if(!understandingReadOnly)throw Invalid();return Log(false,(log,rows)=>{
   if(DesktopTrustKeyHostSource.Map(request["request"]).ContainsKey("selection")){
    Row b,p,a,pick,rangeSummary;DesktopTrustKeyDirectoryFact rangeDir;CheckDelegatedRangeSnapshot(request,log,rows,out b,out p,out a,out rangeDir,out pick,out rangeSummary);
    var projection=ReadUnderstandingRangeOutput(rows,a,rangeDir,b,pick,rangeSummary,DesktopTrustKeyHostSource.Map(p["selection"]));byte[] bytes=Encoding.UTF8.GetBytes(J(projection));
    try{if(bytes.Length>2*MiB)throw Invalid();string digest=DesktopTrustKeyHostSource.Hash(bytes);
     if(digest!=S(p,"bodyHash")||J(Inspect(rows,Normal,S(a,"id"),rangeDir,Output,rangeSummary))!=J(rangeSummary)||DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(pick,"expiresAt"))throw Invalid();
     return R("schemaVersion",1,"purpose","NORMAL_UNDERSTANDING_READER_RESULT_V1","requestHash",H(request),"bodyHash",digest,"initConfirmationRef",projection["initConfirmationRef"],"tailRef",projection["tailRef"]);
    }finally{Array.Clear(bytes,0,bytes.Length);}
   }
   Row basis,purpose,allocation,pickup,summary;DesktopTrustKeyDirectoryFact dir;CheckDelegatedSnapshot(request,log,rows,out basis,out purpose,out allocation,out dir,out pickup,out summary);
   var metadata=ReadUnderstandingOutput(rows,allocation,dir,basis,pickup,summary);
   byte[] body=Encoding.UTF8.GetBytes(J(R("schemaVersion",1,"kind","DISCOVERY_METADATA","metadata",metadata)));string metadataHash;
   try{if(body.Length>2*MiB)throw Invalid();metadataHash=DesktopTrustKeyHostSource.Hash(body);}finally{Array.Clear(body,0,body.Length);}
   if(metadataHash!=S(purpose,"bodyHash")||J(Inspect(rows,Normal,S(allocation,"id"),dir,Output,summary))!=J(summary)||DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(pickup,"expiresAt"))throw Invalid();
   // 원 metadata 본문은 전송하지 않는다. 부모가 이미 기대한 digest와 고정 ref만 반환한다.
   return R("schemaVersion",1,"purpose","NORMAL_UNDERSTANDING_READER_RESULT_V1","requestHash",H(request),"bodyHash",metadataHash,"initConfirmationRef",metadata["initConfirmationRef"],"tailRef",metadata["tailRef"]);
  });
 }
 Row FinishSupervisedUnderstanding(Row request,NormalUnderstandingReadSupervisorSource.ClosedRead closed,Func<Func<Action,Row>,Row> finalGuard){
  if(understandingSupervisor==null||closed==null||finalGuard==null)throw Invalid();var result=understandingSupervisor.Consume(closed,request);
  Row savedClose=null;var answer=finalGuard(liveParent=>Log(false,(log,rows)=>{
   Row basis,purpose,allocation,pickup,summary;DesktopTrustKeyDirectoryFact dir;CheckDelegatedSnapshot(request,log,rows,out basis,out purpose,out allocation,out dir,out pickup,out summary);
   string key=S(DesktopTrustKeyHostSource.Map(purpose["requestRef"]),"id"),id=S(allocation,"id"),metadataHash=S(result,"bodyHash");
   if(metadataHash!=S(purpose,"bodyHash")||!opened.Contains(id))throw Invalid();
   liveParent();Check();
   Append(log,rows,R("kind","UNDERSTANDING_READ_CLOSED","key",key,"host",understandingHost,"pickupHash",H(pickup),"allocation",id,"directoryIdentity",dir.Identity,
    "summaryHash",H(summary),"bodyHash",metadataHash,"initConfirmationRef",result["initConfirmationRef"],"tailRef",result["tailRef"],"expiresAt",pickup["expiresAt"],"readerProcess",closed.OriginalProcessEvidence));savedClose=rows[rows.Count-1];
   liveParent();Check();opened.Remove(id);return R("state","CLOSED_CONFIRMED","understanding",R("state","NATIVE_METADATA_CLOSED","requestRef",purpose["requestRef"],"acquisitionRef",purpose["acquisitionRef"],"bodyHash",metadataHash));
  }));
  Check();if(understandingResultCapability!=null||understandingPreparedAdmission!=null||savedClose==null)throw Invalid();
  // 원 binding/spool lock 정상 회수 이후에만 같은 객체에 남긴다. 원 행 재조회로 재발급하지 않는다.
  understandingResultCapability=new UnderstandingResultCapability(DesktopTrustKeyHostSource.Parse(Encoding.UTF8.GetBytes(J(request)),false),H(savedClose));return answer;
 }
 Row FinishSupervisedUnderstandingRange(Row request,NormalUnderstandingReadSupervisorSource.ClosedRead closed,Func<Func<Action,Row>,Row> finalGuard){
  if(understandingSupervisor==null||closed==null||finalGuard==null)throw Invalid();var result=understandingSupervisor.Consume(closed,request);
  Row savedClose=null;var answer=finalGuard(liveParent=>Log(false,(log,rows)=>{
   Row basis,purpose,allocation,pickup,summary;DesktopTrustKeyDirectoryFact dir;CheckDelegatedRangeSnapshot(request,log,rows,out basis,out purpose,out allocation,out dir,out pickup,out summary);
   string key=S(DesktopTrustKeyHostSource.Map(purpose["requestRef"]),"id"),id=S(allocation,"id"),metadataHash=S(result,"bodyHash");
   if(metadataHash!=S(purpose,"bodyHash")||!opened.Contains(id))throw Invalid();
   liveParent();Check();
   Append(log,rows,R("kind","UNDERSTANDING_RANGE_READ_CLOSED","key",key,"host",understandingHost,"pickupHash",H(pickup),"allocation",id,"directoryIdentity",dir.Identity,
    "summaryHash",H(summary),"bodyHash",metadataHash,"initConfirmationRef",result["initConfirmationRef"],"tailRef",result["tailRef"],"expiresAt",pickup["expiresAt"],"readerProcess",closed.OriginalProcessEvidence));savedClose=rows[rows.Count-1];
   liveParent();Check();opened.Remove(id);return R("state","CLOSED_CONFIRMED","understandingRange",R("state","NATIVE_RANGE_CLOSED","requestRef",purpose["requestRef"],"acquisitionRef",purpose["acquisitionRef"],"bodyHash",metadataHash));
  }));
  Check();if(understandingRangeResultCapability!=null||understandingRangePreparedAdmission!=null||savedClose==null)throw Invalid();
  understandingRangeResultCapability=new UnderstandingResultCapability(DesktopTrustKeyHostSource.Parse(Encoding.UTF8.GetBytes(J(request)),false),H(savedClose));return answer;
 }
 const string PreparedKeys="kind,key,allocation,host,closeHash,pickupHash,requestRef,acquisitionRef,recordHash,slotHash,slotId,slotReceiptRef,projectId,connectorId,executionId,executionGeneration,grantRef,credentialGeneration,challengeRef,proofRequestId,nonceDigest,bodyHash,packetHash,expiresAt";
 const string SendStartedKeys="kind,key,preparedHash,requestRef,acquisitionRef,challengeRef,proofRequestId,bodyHash,packetHash,expiresAt";
 Row UnderstandingResultOrigin(List<Row> rows,Row value,Row record,Row slot,out Row pickup,out Row ended,out Row basis){
  if(understandingReadOnly||understandingSupervisor==null)throw Invalid();
  var requested=DesktopTrustKeyHostSource.Ref(value["requestRef"]);DesktopTrustKeyHostSource.Ref(value["acquisitionRef"]);string key=S(requested,"id");
  pickup=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_PICKUP"&&S(r,"key")==key);
  var started=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_READ_STARTED"&&S(r,"key")==key);
  ended=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_READ_CLOSED"&&S(r,"key")==key);
  if(pickup==null||started==null||ended==null||S(pickup,"recordHash")!=H(record)||S(pickup,"slotHash")!=H(slot)||S(pickup,"attemptId")!=S(value,"attemptId")||S(slot,"slotId")!=S(value,"slotId")||
   J(pickup["requestRef"])!=J(requested)||J(pickup["acquisitionRef"])!=J(value["acquisitionRef"])||S(ended,"pickupHash")!=H(pickup)||S(started,"pickupHash")!=H(pickup)||S(started,"host")!=S(ended,"host")||S(started,"allocation")!=S(ended,"allocation")||
   S(started,"summaryHash")!=S(ended,"summaryHash")||S(started,"directoryIdentity")!=S(ended,"directoryIdentity")||S(ended,"bodyHash")!=S(value,"bodyHash")||!ended.ContainsKey("readerProcess"))throw Invalid();
  DesktopTrustKeyHostSource.Exact(pickup,"kind,key,recordHash,slotHash,attemptId,pickupHost,requestRef,acquisitionRef,context,observedAt,expiresAt");
  DesktopTrustKeyHostSource.Exact(started,"kind,key,host,pickupHash,allocation,recordHash,slotHash,directoryIdentity,summaryHash,readBasis");
  DesktopTrustKeyHostSource.Exact(ended,"kind,key,host,pickupHash,allocation,directoryIdentity,summaryHash,bodyHash,initConfirmationRef,tailRef,expiresAt,readerProcess");
  basis=DesktopTrustKeyHostSource.Map(started["readBasis"]);ReadBasisShape(basis);
  if(S(started,"recordHash")!=H(record)||S(started,"slotHash")!=H(slot)||DesktopTrustKeyHostSource.Time(ended,"expiresAt")!=DesktopTrustKeyHostSource.Time(pickup,"expiresAt")||!SameUnderstandingGeneration(DesktopTrustKeyHostSource.Map(pickup["context"]),basis))throw Invalid();
  if(S(basis,"recordHash")!=H(record)||S(basis,"slotHash")!=H(slot)||!Has(rows,"REGISTERED",H(record))||!rows.Any(r=>S(r,"kind")=="SLOT_ID"&&S(r,"key")==S(slot,"slotId")&&S(r,"slotHash")==H(slot)))throw Invalid();
  DateTime end=new[]{DesktopTrustKeyHostSource.Time(basis,"readExpiresAt"),DesktopTrustKeyHostSource.Time(pickup,"expiresAt"),DesktopTrustKeyHostSource.Time(slot,"expiresAt"),DesktopTrustKeyHostSource.Time(DesktopTrustKeyHostSource.Map(record["credential"]),"expiresAt"),DesktopTrustKeyHostSource.Time(DesktopTrustKeyHostSource.Map(record["registration"]),"registrationExpiresAt")}.Min();
  understandingSupervisor.TightenRead(end);Check();
  string allocation=S(ended,"allocation");var original=rows.SingleOrDefault(r=>S(r,"kind")=="ALLOCATED"&&S(r,"id")==allocation);
  var settled=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"allocation")==allocation&&S(r,"channel")==Output);
  if(original==null||S(original,"key")!=S(basis,"allocationKey")||settled==null||H(settled["summary"])!=S(ended,"summaryHash")||Unsettled(rows).Values.Any(r=>S(r,"allocation")==allocation)||root.RetainSpoolNamespace(allocation,false).Identity!=S(ended,"directoryIdentity"))throw Invalid();
  return R("closeHash",H(ended),"pickupHash",H(pickup),"expiresAt",end.ToString("yyyy-MM-ddTHH:mm:ss.fffZ",System.Globalization.CultureInfo.InvariantCulture));
 }
 internal void TightenUnderstandingResult(DateTime end){if(understandingReadOnly||understandingSupervisor==null)throw Invalid();understandingSupervisor.TightenRead(end);Check();}
 internal Row TakeUnderstandingResult(Row value,Row record,Row slot){
  var capability=understandingResultCapability;understandingResultCapability=null;
  if(capability==null||understandingPreparedAdmission!=null)throw Invalid();
  DesktopTrustKeyHostSource.Exact(value,"attemptId,slotId,requestRef,acquisitionRef,bodyHash");
  var purpose=DesktopTrustKeyHostSource.Map(capability.Request["request"]);var prior=DesktopTrustKeyHostSource.Map(capability.Request["readBasis"]);
  if(S(value,"attemptId")!=S(prior,"attemptId")||S(value,"slotId")!=S(prior,"slotId")||J(value["requestRef"])!=J(purpose["requestRef"])||J(value["acquisitionRef"])!=J(purpose["acquisitionRef"])||S(value,"bodyHash")!=S(purpose,"bodyHash"))throw Invalid();
  var admission=Log(false,(log,rows)=>{Row pickup,ended,basis;var facts=UnderstandingResultOrigin(rows,value,record,slot,out pickup,out ended,out basis);
   if(S(facts,"closeHash")!=capability.CloseHash||S(ended,"host")!=understandingHost||Has(rows,"UNDERSTANDING_RESULT_PREPARED",S(pickup,"key"))||Has(rows,"UNDERSTANDING_RESULT_SEND_STARTED",S(pickup,"key")))throw Invalid();return facts;});
  Check();understandingPreparedAdmission=admission;return admission;
 }
 internal Row StoreUnderstandingPrepared(Row admission,Row value,Row record,Row slot,Row proofFacts){
  if(!Object.ReferenceEquals(admission,understandingPreparedAdmission)||admission==null)throw Invalid();understandingPreparedAdmission=null;
  DesktopTrustKeyHostSource.Exact(proofFacts,"challengeRef,proofRequestId,nonceDigest,packetHash,expiresAt");DesktopTrustKeyHostSource.Ref(proofFacts["challengeRef"]);DesktopTrustKeyHostSource.Id(proofFacts,"proofRequestId");
  foreach(string k in new[]{"nonceDigest","packetHash"})if(!DesktopTrustKeyHostSource.IsHash(proofFacts[k]))throw Invalid();
  try{
   var prepared=Log(false,(log,rows)=>{Row pickup,ended,basis;var origin=UnderstandingResultOrigin(rows,value,record,slot,out pickup,out ended,out basis);string key=S(pickup,"key");
    if(J(origin)!=J(admission)||Has(rows,"UNDERSTANDING_RESULT_PREPARED",key)||Has(rows,"UNDERSTANDING_RESULT_SEND_STARTED",key)||DesktopTrustKeyHostSource.Time(proofFacts,"expiresAt")>DesktopTrustKeyHostSource.Time(origin,"expiresAt"))throw Invalid();
    if(rows.Any(r=>S(r,"kind")=="UNDERSTANDING_RESULT_PREPARED"&&(J(r["challengeRef"])==J(proofFacts["challengeRef"])||S(r,"proofRequestId")==S(proofFacts,"proofRequestId")||S(r,"nonceDigest")==S(proofFacts,"nonceDigest"))))throw Invalid();
    understandingSupervisor.TightenRead(DesktopTrustKeyHostSource.Time(proofFacts,"expiresAt"));var scope=DesktopTrustKeyHostSource.Map(slot["scope"]);
    var row=R("kind","UNDERSTANDING_RESULT_PREPARED","key",key,"allocation",ended["allocation"],"host",ended["host"],"closeHash",origin["closeHash"],"pickupHash",origin["pickupHash"],"requestRef",pickup["requestRef"],"acquisitionRef",pickup["acquisitionRef"],
     "recordHash",H(record),"slotHash",H(slot),"slotId",slot["slotId"],"slotReceiptRef",slot["receiptRef"],"projectId",scope["projectId"],"connectorId",scope["connectorId"],"executionId",scope["executionId"],"executionGeneration",scope["executionGeneration"],"grantRef",scope["grantRef"],"credentialGeneration",scope["credentialGeneration"],
     "challengeRef",proofFacts["challengeRef"],"proofRequestId",proofFacts["proofRequestId"],"nonceDigest",proofFacts["nonceDigest"],"bodyHash",value["bodyHash"],"packetHash",proofFacts["packetHash"],"expiresAt",proofFacts["expiresAt"]);
    DesktopTrustKeyHostSource.Exact(row,PreparedKeys);Append(log,rows,row);return row;});
   Log(false,(log,rows)=>{var saved=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RESULT_PREPARED"&&S(r,"key")==S(prepared,"key"));if(saved==null||J(saved)!=J(prepared))throw Invalid();return true;});Check();return prepared;
  }catch{blocked=true;throw;}
 }
 internal Row StartUnderstandingSend(Row value,Row record,Row slot,Row proofFacts){
  DesktopTrustKeyHostSource.Exact(proofFacts,"challengeRef,proofRequestId,nonceDigest,packetHash");
  try{
   Row prepared=null;var started=Log(false,(log,rows)=>{Row pickup,ended,basis;var origin=UnderstandingResultOrigin(rows,value,record,slot,out pickup,out ended,out basis);string key=S(pickup,"key");
    prepared=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RESULT_PREPARED"&&S(r,"key")==key);if(prepared==null)throw Invalid();DesktopTrustKeyHostSource.Exact(prepared,PreparedKeys);
    if(H(prepared)!=S(value,"preparedHash")||S(prepared,"host")==understandingHost||Has(rows,"UNDERSTANDING_RESULT_SEND_STARTED",key)||S(prepared,"closeHash")!=H(ended)||S(prepared,"pickupHash")!=H(pickup)||S(prepared,"host")!=S(ended,"host")||S(prepared,"allocation")!=S(ended,"allocation")||S(prepared,"recordHash")!=H(record)||S(prepared,"slotHash")!=H(slot)||S(prepared,"slotId")!=S(slot,"slotId")||J(prepared["slotReceiptRef"])!=J(slot["receiptRef"])||J(prepared["requestRef"])!=J(value["requestRef"])||J(prepared["acquisitionRef"])!=J(value["acquisitionRef"])||S(prepared,"bodyHash")!=S(value,"bodyHash"))throw Invalid();
    foreach(string k in new[]{"challengeRef","proofRequestId","nonceDigest","packetHash"})if(J(prepared[k])!=J(proofFacts[k]))throw Invalid();
    var scope=DesktopTrustKeyHostSource.Map(slot["scope"]);foreach(string k in new[]{"projectId","connectorId","executionId","executionGeneration","grantRef","credentialGeneration"})if(J(prepared[k])!=J(scope[k]))throw Invalid();
    if(DesktopTrustKeyHostSource.Time(prepared,"expiresAt")>DesktopTrustKeyHostSource.Time(origin,"expiresAt"))throw Invalid();understandingSupervisor.TightenRead(DesktopTrustKeyHostSource.Time(prepared,"expiresAt"));
    var row=R("kind","UNDERSTANDING_RESULT_SEND_STARTED","key",key,"preparedHash",H(prepared),"requestRef",prepared["requestRef"],"acquisitionRef",prepared["acquisitionRef"],"challengeRef",prepared["challengeRef"],"proofRequestId",prepared["proofRequestId"],"bodyHash",prepared["bodyHash"],"packetHash",prepared["packetHash"],"expiresAt",prepared["expiresAt"]);
    DesktopTrustKeyHostSource.Exact(row,SendStartedKeys);Append(log,rows,row);return row;});
   Log(false,(log,rows)=>{var saved=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RESULT_SEND_STARTED"&&S(r,"key")==S(started,"key"));if(saved==null||J(saved)!=J(started))throw Invalid();return true;});Check();return prepared;
  }catch{blocked=true;throw;}
 }
 // 고정 범위 목적은 별도의 원 CLOSE capability와 관리행만 소비한다.
 Row UnderstandingRangeResultOrigin(List<Row> rows,Row value,Row record,Row slot,out Row pickup,out Row ended,out Row basis){
  if(understandingReadOnly||understandingSupervisor==null)throw Invalid();
  var requested=DesktopTrustKeyHostSource.Ref(value["requestRef"]);DesktopTrustKeyHostSource.Ref(value["acquisitionRef"]);string key=S(requested,"id");
  pickup=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_PICKUP"&&S(r,"key")==key);
  var started=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_READ_STARTED"&&S(r,"key")==key);
  ended=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_READ_CLOSED"&&S(r,"key")==key);
  if(pickup==null||started==null||ended==null||S(pickup,"recordHash")!=H(record)||S(pickup,"slotHash")!=H(slot)||S(pickup,"attemptId")!=S(value,"attemptId")||S(slot,"slotId")!=S(value,"slotId")||
   J(pickup["requestRef"])!=J(requested)||J(pickup["acquisitionRef"])!=J(value["acquisitionRef"])||S(ended,"pickupHash")!=H(pickup)||S(started,"pickupHash")!=H(pickup)||S(started,"host")!=S(ended,"host")||S(started,"allocation")!=S(ended,"allocation")||
   S(started,"summaryHash")!=S(ended,"summaryHash")||S(started,"directoryIdentity")!=S(ended,"directoryIdentity")||S(ended,"bodyHash")!=S(value,"bodyHash")||!ended.ContainsKey("readerProcess"))throw Invalid();
  DesktopTrustKeyHostSource.Exact(pickup,"kind,key,recordHash,slotHash,attemptId,pickupHost,requestRef,acquisitionRef,context,selectionHash,sourceRequestRef,sourceResultRef,initConfirmationRef,tailRef,firstSequence,lastSequence,observedAt,expiresAt");
  DesktopTrustKeyHostSource.Exact(started,"kind,key,host,pickupHash,allocation,recordHash,slotHash,directoryIdentity,summaryHash,readBasis,requestHash");
  DesktopTrustKeyHostSource.Exact(ended,"kind,key,host,pickupHash,allocation,directoryIdentity,summaryHash,bodyHash,initConfirmationRef,tailRef,expiresAt,readerProcess");
  basis=DesktopTrustKeyHostSource.Map(started["readBasis"]);ReadBasisShape(basis);
  if(S(started,"recordHash")!=H(record)||S(started,"slotHash")!=H(slot)||DesktopTrustKeyHostSource.Time(ended,"expiresAt")!=DesktopTrustKeyHostSource.Time(pickup,"expiresAt")||!SameUnderstandingGeneration(DesktopTrustKeyHostSource.Map(pickup["context"]),basis))throw Invalid();
  if(S(basis,"recordHash")!=H(record)||S(basis,"slotHash")!=H(slot)||!Has(rows,"REGISTERED",H(record))||!rows.Any(r=>S(r,"kind")=="SLOT_ID"&&S(r,"key")==S(slot,"slotId")&&S(r,"slotHash")==H(slot)))throw Invalid();
  DateTime end=new[]{DesktopTrustKeyHostSource.Time(basis,"readExpiresAt"),DesktopTrustKeyHostSource.Time(pickup,"expiresAt"),DesktopTrustKeyHostSource.Time(slot,"expiresAt"),DesktopTrustKeyHostSource.Time(DesktopTrustKeyHostSource.Map(record["credential"]),"expiresAt"),DesktopTrustKeyHostSource.Time(DesktopTrustKeyHostSource.Map(record["registration"]),"registrationExpiresAt")}.Min();
  understandingSupervisor.TightenRead(end);Check();
  string allocation=S(ended,"allocation");var original=rows.SingleOrDefault(r=>S(r,"kind")=="ALLOCATED"&&S(r,"id")==allocation);
  var settled=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"allocation")==allocation&&S(r,"channel")==Output);
  if(original==null||S(original,"key")!=S(basis,"allocationKey")||settled==null||H(settled["summary"])!=S(ended,"summaryHash")||Unsettled(rows).Values.Any(r=>S(r,"allocation")==allocation)||root.RetainSpoolNamespace(allocation,false).Identity!=S(ended,"directoryIdentity"))throw Invalid();
  return R("closeHash",H(ended),"pickupHash",H(pickup),"expiresAt",end.ToString("yyyy-MM-ddTHH:mm:ss.fffZ",System.Globalization.CultureInfo.InvariantCulture));
 }
 internal Row TakeUnderstandingRangeResult(Row value,Row record,Row slot){
  var capability=understandingRangeResultCapability;understandingRangeResultCapability=null;
  if(capability==null||understandingRangePreparedAdmission!=null)throw Invalid();
  DesktopTrustKeyHostSource.Exact(value,"attemptId,slotId,requestRef,acquisitionRef,bodyHash");
  var purpose=DesktopTrustKeyHostSource.Map(capability.Request["request"]);var prior=DesktopTrustKeyHostSource.Map(capability.Request["readBasis"]);
  if(S(value,"attemptId")!=S(prior,"attemptId")||S(value,"slotId")!=S(prior,"slotId")||J(value["requestRef"])!=J(purpose["requestRef"])||J(value["acquisitionRef"])!=J(purpose["acquisitionRef"])||S(value,"bodyHash")!=S(purpose,"bodyHash"))throw Invalid();
  var admission=Log(false,(log,rows)=>{Row pickup,ended,basis;var facts=UnderstandingRangeResultOrigin(rows,value,record,slot,out pickup,out ended,out basis);
   if(S(pickup,"selectionHash")!=H(purpose["selection"])||S(rows.Single(r=>S(r,"kind")=="UNDERSTANDING_RANGE_READ_STARTED"&&S(r,"key")==S(pickup,"key")),"requestHash")!=H(purpose))throw Invalid();
   if(S(facts,"closeHash")!=capability.CloseHash||S(ended,"host")!=understandingHost||Has(rows,"UNDERSTANDING_RANGE_RESULT_PREPARED",S(pickup,"key"))||Has(rows,"UNDERSTANDING_RANGE_RESULT_SEND_STARTED",S(pickup,"key")))throw Invalid();return facts;});
  Check();understandingRangePreparedAdmission=admission;return admission;
 }
 internal Row StoreUnderstandingRangePrepared(Row admission,Row value,Row record,Row slot,Row proofFacts){
  if(!Object.ReferenceEquals(admission,understandingRangePreparedAdmission)||admission==null)throw Invalid();understandingRangePreparedAdmission=null;
  DesktopTrustKeyHostSource.Exact(proofFacts,"challengeRef,proofRequestId,nonceDigest,packetHash,expiresAt");DesktopTrustKeyHostSource.Ref(proofFacts["challengeRef"]);DesktopTrustKeyHostSource.Id(proofFacts,"proofRequestId");
  foreach(string k in new[]{"nonceDigest","packetHash"})if(!DesktopTrustKeyHostSource.IsHash(proofFacts[k]))throw Invalid();
  try{
   var prepared=Log(false,(log,rows)=>{Row pickup,ended,basis;var origin=UnderstandingRangeResultOrigin(rows,value,record,slot,out pickup,out ended,out basis);string key=S(pickup,"key");
    if(J(origin)!=J(admission)||Has(rows,"UNDERSTANDING_RANGE_RESULT_PREPARED",key)||Has(rows,"UNDERSTANDING_RANGE_RESULT_SEND_STARTED",key)||DesktopTrustKeyHostSource.Time(proofFacts,"expiresAt")>DesktopTrustKeyHostSource.Time(origin,"expiresAt"))throw Invalid();
    if(rows.Any(r=>S(r,"kind")=="UNDERSTANDING_RANGE_RESULT_PREPARED"&&(J(r["challengeRef"])==J(proofFacts["challengeRef"])||S(r,"proofRequestId")==S(proofFacts,"proofRequestId")||S(r,"nonceDigest")==S(proofFacts,"nonceDigest"))))throw Invalid();
    understandingSupervisor.TightenRead(DesktopTrustKeyHostSource.Time(proofFacts,"expiresAt"));var scope=DesktopTrustKeyHostSource.Map(slot["scope"]);
    var row=R("kind","UNDERSTANDING_RANGE_RESULT_PREPARED","key",key,"allocation",ended["allocation"],"host",ended["host"],"closeHash",origin["closeHash"],"pickupHash",origin["pickupHash"],"requestRef",pickup["requestRef"],"acquisitionRef",pickup["acquisitionRef"],
     "recordHash",H(record),"slotHash",H(slot),"slotId",slot["slotId"],"slotReceiptRef",slot["receiptRef"],"projectId",scope["projectId"],"connectorId",scope["connectorId"],"executionId",scope["executionId"],"executionGeneration",scope["executionGeneration"],"grantRef",scope["grantRef"],"credentialGeneration",scope["credentialGeneration"],
     "challengeRef",proofFacts["challengeRef"],"proofRequestId",proofFacts["proofRequestId"],"nonceDigest",proofFacts["nonceDigest"],"bodyHash",value["bodyHash"],"packetHash",proofFacts["packetHash"],"expiresAt",proofFacts["expiresAt"]);
    DesktopTrustKeyHostSource.Exact(row,PreparedKeys);Append(log,rows,row);return row;});
   Log(false,(log,rows)=>{var saved=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_RESULT_PREPARED"&&S(r,"key")==S(prepared,"key"));if(saved==null||J(saved)!=J(prepared))throw Invalid();return true;});Check();return prepared;
  }catch{blocked=true;throw;}
 }
 internal Row StartUnderstandingRangeSend(Row value,Row record,Row slot,Row proofFacts){
  DesktopTrustKeyHostSource.Exact(proofFacts,"challengeRef,proofRequestId,nonceDigest,packetHash");
  try{
   Row prepared=null;var started=Log(false,(log,rows)=>{Row pickup,ended,basis;var origin=UnderstandingRangeResultOrigin(rows,value,record,slot,out pickup,out ended,out basis);string key=S(pickup,"key");
    prepared=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_RESULT_PREPARED"&&S(r,"key")==key);if(prepared==null)throw Invalid();DesktopTrustKeyHostSource.Exact(prepared,PreparedKeys);
    if(H(prepared)!=S(value,"preparedHash")||S(prepared,"host")==understandingHost||Has(rows,"UNDERSTANDING_RANGE_RESULT_SEND_STARTED",key)||S(prepared,"closeHash")!=H(ended)||S(prepared,"pickupHash")!=H(pickup)||S(prepared,"host")!=S(ended,"host")||S(prepared,"allocation")!=S(ended,"allocation")||S(prepared,"recordHash")!=H(record)||S(prepared,"slotHash")!=H(slot)||S(prepared,"slotId")!=S(slot,"slotId")||J(prepared["slotReceiptRef"])!=J(slot["receiptRef"])||J(prepared["requestRef"])!=J(value["requestRef"])||J(prepared["acquisitionRef"])!=J(value["acquisitionRef"])||S(prepared,"bodyHash")!=S(value,"bodyHash"))throw Invalid();
    foreach(string k in new[]{"challengeRef","proofRequestId","nonceDigest","packetHash"})if(J(prepared[k])!=J(proofFacts[k]))throw Invalid();
    var scope=DesktopTrustKeyHostSource.Map(slot["scope"]);foreach(string k in new[]{"projectId","connectorId","executionId","executionGeneration","grantRef","credentialGeneration"})if(J(prepared[k])!=J(scope[k]))throw Invalid();
    if(DesktopTrustKeyHostSource.Time(prepared,"expiresAt")>DesktopTrustKeyHostSource.Time(origin,"expiresAt"))throw Invalid();understandingSupervisor.TightenRead(DesktopTrustKeyHostSource.Time(prepared,"expiresAt"));
    var row=R("kind","UNDERSTANDING_RANGE_RESULT_SEND_STARTED","key",key,"preparedHash",H(prepared),"requestRef",prepared["requestRef"],"acquisitionRef",prepared["acquisitionRef"],"challengeRef",prepared["challengeRef"],"proofRequestId",prepared["proofRequestId"],"bodyHash",prepared["bodyHash"],"packetHash",prepared["packetHash"],"expiresAt",prepared["expiresAt"]);
    DesktopTrustKeyHostSource.Exact(row,SendStartedKeys);Append(log,rows,row);return row;});
   Log(false,(log,rows)=>{var saved=rows.SingleOrDefault(r=>S(r,"kind")=="UNDERSTANDING_RANGE_RESULT_SEND_STARTED"&&S(r,"key")==S(started,"key"));if(saved==null||J(saved)!=J(started))throw Invalid();return true;});Check();return prepared;
  }catch{blocked=true;throw;}
 }
 // 이 함수는 현재 열린 할당의 원본 3행만 확인한다. 경로/행·실행 권한을 외부에 내주지 않는다.
 internal string ReadSdkFirstAttempt(Row record,Row slot,Row scope,string startCommand,string sendCommand,Row handoff=null,bool verifyOptions=false){
  SdkStartOptions ignored;return ReadSdkFirstAttempt(record,slot,scope,startCommand,sendCommand,handoff,out ignored,verifyOptions);
 }
 internal string ReadSdkFirstAttempt(Row record,Row slot,Row scope,string startCommand,string sendCommand,Row handoff,out SdkStartOptions options,bool verifyOptions){
  options=null;SdkStartOptions candidate=null;
  if(verifyOptions&&handoff==null||startCommand==sendCommand||DesktopTrustKeyHostSource.Time(slot,"expiresAt")<=DateTime.UtcNow)throw Invalid();
  string tuple=Tuple(Normal,record,slot);
  string digest=Log(false,(log,rows)=>{
   if(!Has(rows,"REGISTERED",H(record))||!rows.Any(r=>S(r,"kind")=="SLOT_ID"&&S(r,"key")==S(slot,"slotId")&&S(r,"slotHash")==H(slot)))throw Invalid();
   Row allocation=Allocate(rows,log,Normal,tuple,true);
   string id=S(allocation,"id");
   if(!rows.Any(r=>S(r,"kind")=="GRANT"&&S(r,"key")==id&&S(r,"grant")==H(scope["grantRef"])))throw Invalid();
   var dir=root.RetainSpoolNamespace(id,false);
   if(dir.Identity!=S(allocation,"directoryIdentity"))throw Invalid();
   OutputScope(scope,rows,allocation,record,slot);
   object startReceived,sendReceived;
   string start=ReadSdkAttemptChain(rows,id,dir,scope,startCommand,true,handoff,out startReceived);
   string send=ReadSdkAttemptChain(rows,id,dir,scope,sendCommand,false,handoff,out sendReceived);
   if(verifyOptions)candidate=ReadSdkStartOptions(rows,id,dir,scope,startCommand,handoff,startReceived);
   Check();if(DesktopTrustKeyHostSource.Time(slot,"expiresAt")<=DateTime.UtcNow)throw Invalid();
   return H(new object[]{scope,start,send});
  });
  options=candidate;return digest;
 }
 string ReadSdkAttemptChain(List<Row> rows,string allocation,DesktopTrustKeyDirectoryFact dir,Row scope,string command,bool start,Row handoff,out object receivedRef){
  receivedRef=null;
  string id=DesktopTrustKeyHostSource.Id(R("id",command),"id");
  string channel="attempt-"+id;
  if(Unsettled(rows).Values.Any(r=>S(r,"allocation")==allocation&&S(r,"channel")==channel))throw Invalid();
  var settled=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"allocation")==allocation&&S(r,"channel")==channel);
  if(settled==null)throw Invalid();
  var summary=DesktopTrustKeyHostSource.Map(settled["summary"]);
  if(N(summary["count"])!=3||J(Inspect(rows,Normal,allocation,dir,channel,summary))!=J(summary))throw Invalid();
  object previous=null,first=null,permit=null,proof=null,received=null;
  string envelope=null;DateTime last=DateTime.MinValue;
  var ids=new HashSet<string>();var hashes=new List<string>();
  for(int i=1;i<=3;i++){
   Check();string path=Path.Combine(dir.Path,channel+"."+i.ToString("D6")+".json");
   using(var f=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)){
    string identity=FileIdentity(f,path);
    if(f.Length<1||f.Length>2*MiB)throw Invalid();
    byte[] bytes=new byte[checked((int)f.Length)];
    try{
     int offset=0;while(offset<bytes.Length){Check();int n=f.Read(bytes,offset,bytes.Length-offset);if(n<=0)throw Invalid();offset+=n;}
     if(f.ReadByte()!=-1||identity!=FileIdentity(f,path))throw Invalid();
     Row row=DesktopTrustKeyHostSource.Parse(bytes,true);DesktopTrustKeyHostSource.Exact(row,"ref,snapshot");
     Row snapshot=DesktopTrustKeyHostSource.Map(row["snapshot"]),reference=DesktopTrustKeyHostSource.ReceiveRef(row["ref"],true);
     string baseKeys="sequence,state,key,envelopeHash,grantRef,receivedRef,previousRef,permit,recordedAt";
     DesktopTrustKeyHostSource.Exact(snapshot,baseKeys+(start?",responseRef,processRef":",sessionBindingRef,proofResultRef"+(i==3?",localAttemptRef,dispatchAttemptRef,responseRef,processRef":"")));
     if(!ids.Add(S(reference,"id"))||S(reference,"contentHash")!=H(snapshot)||N(snapshot["sequence"])!=i||J(snapshot["previousRef"])!=J(previous))throw Invalid();
     var key=R("projectId",scope["projectId"],"executionId",scope["executionId"],"executionGeneration",scope["generation"],"commandId",id);
     if(J(snapshot["key"])!=J(key)||J(snapshot["grantRef"])!=J(scope["grantRef"])||!DesktopTrustKeyHostSource.IsHash(snapshot["envelopeHash"]))throw Invalid();
     string state=i==1?(start?"START_ATTEMPTED":"SEND_ATTEMPTED"):i==2?"PERMIT_RECORDED":(start?"START_READY_RECORDED":"SEND_DISPATCH_ATTEMPTED");
     var time=DesktopTrustKeyHostSource.Time(snapshot,"recordedAt");
     if(S(snapshot,"state")!=state||time<last||time>DateTime.UtcNow)throw Invalid();last=time;
     if(i==1){first=reference;envelope=S(snapshot,"envelopeHash");received=DesktopTrustKeyHostSource.Ref(snapshot["receivedRef"]);}
     if(J(received)!=J(snapshot["receivedRef"])||envelope!=S(snapshot,"envelopeHash"))throw Invalid();
     if(!start&&J(snapshot["sessionBindingRef"])!=J(scope["sessionBindingRef"]))throw Invalid();
     if((start||i==3)&&(snapshot["processRef"]!=null||snapshot["responseRef"]!=null))throw Invalid();
     if(i==1&&(snapshot["permit"]!=null||!start&&snapshot["proofResultRef"]!=null))throw Invalid();
     if(i==2){
      var p=DesktopTrustKeyHostSource.Map(snapshot["permit"]);DesktopTrustKeyHostSource.Exact(p,"ref,commandId,envelopeHash,issuedAt,expiresAt");
      DesktopTrustKeyHostSource.Ref(p["ref"]);var issued=DesktopTrustKeyHostSource.Time(p,"issuedAt");var expires=DesktopTrustKeyHostSource.Time(p,"expiresAt");
      if(S(p,"commandId")!=id||S(p,"envelopeHash")!=envelope||expires<=issued||expires>issued.AddSeconds(30)||!start&&expires<=DateTime.UtcNow)throw Invalid();
      permit=p;if(!start)proof=DesktopTrustKeyHostSource.Ref(snapshot["proofResultRef"]);
     }
     if(i==3&&(J(snapshot["permit"])!=J(permit)||!start&&(J(snapshot["proofResultRef"])!=J(proof)||J(snapshot["localAttemptRef"])!=J(first)||snapshot["dispatchAttemptRef"]!=null)))throw Invalid();
     if(handoff!=null)RequireSdkFirst(snapshot,reference,handoff,start,i);
     previous=reference;hashes.Add(DesktopTrustKeyHostSource.Hash(bytes));
    }finally{Array.Clear(bytes,0,bytes.Length);}
   }
  }
  if(J(previous)!=J(scope[start?"startReadyRef":"dispatchAttemptRef"])||hashes[2]!=S(summary,"tail"))throw Invalid();
  receivedRef=received;return H(hashes.ToArray());
 }
 // 원문을 새로 저장/반환하지 않는다. FIRST3의 원 receivedRef가 고정한 기존 intake에서 Options만 검산한다.
 Row ReadSdkIntakeRow(DesktopTrustKeyDirectoryFact dir,string channel,int sequence,out string rawHash){
  Check();string path=Path.Combine(dir.Path,channel+"."+sequence.ToString("D6")+".json");
  using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)){
   string identity=FileIdentity(file,path);long length=file.Length;if(length<1||length>3*MiB)throw Invalid();
   byte[] bytes=new byte[checked((int)length)];
   try{int offset=0;while(offset<bytes.Length){Check();int n=file.Read(bytes,offset,Math.Min(65536,bytes.Length-offset));if(n<=0)throw Invalid();offset+=n;}
    if(file.ReadByte()!=-1||file.Length!=length||identity!=FileIdentity(file,path))throw Invalid();
    rawHash=DesktopTrustKeyHostSource.Hash(bytes);Row row=DesktopTrustKeyHostSource.Parse(bytes,true);DesktopTrustKeyHostSource.Exact(row,"entry,bytes");Check();return row;
   }finally{Array.Clear(bytes,0,bytes.Length);}
  }
 }
 SdkStartOptions ReadSdkStartOptions(List<Row> rows,string allocation,DesktopTrustKeyDirectoryFact dir,Row scope,string command,Row handoff,object receivedRef){
  Check();string channel="intake-"+command;
  if(Unsettled(rows).Values.Any(r=>S(r,"allocation")==allocation&&S(r,"channel")==channel))throw Invalid();
  var settled=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"writer")==Normal&&S(r,"allocation")==allocation&&S(r,"channel")==channel);
  if(settled==null)throw Invalid();var summary=DesktopTrustKeyHostSource.Map(settled["summary"]);long count=N(summary["count"]);
  if(count<3||count>201||J(Inspect(rows,Normal,allocation,dir,channel,summary))!=J(summary))throw Invalid();
  string tailHash;Row tail=ReadSdkIntakeRow(dir,channel,checked((int)count),out tailHash),entry=DesktopTrustKeyHostSource.Map(tail["entry"]);
  DesktopTrustKeyHostSource.Exact(entry,"ref,snapshot");Row terminal=DesktopTrustKeyHostSource.Map(entry["snapshot"]);
  if(tailHash!=S(summary,"tail")||J(entry["ref"])!=J(receivedRef)||S(DesktopTrustKeyHostSource.Ref(entry["ref"]),"contentHash")!=H(terminal)||S(terminal,"kind")!="RECEIVED"||tail["bytes"]!=null)throw Invalid();
  Row descriptor=DesktopTrustKeyHostSource.Map(terminal["materials"]);DesktopTrustKeyHostSource.Exact(descriptor,"manifestRef,groups");DesktopTrustKeyHostSource.Ref(descriptor["manifestRef"]);
  string descriptorHash=H(descriptor);var groups=descriptor["groups"] as object[];if(groups==null||groups.Length!=2||descriptorHash!=S(terminal,"descriptorHash"))throw Invalid();
  Row envelope=DesktopTrustKeyHostSource.Map(handoff["startEnvelope"]),payload=DesktopTrustKeyHostSource.Map(envelope["payload"]);
  if(J(payload["contextBundleRef"])==J(payload["optionsRef"]))throw Invalid();
  var parts=new List<Row>();var optionIds=new HashSet<string>();var ids=new HashSet<string>();Row options=null;
  for(int g=0;g<2;g++){
   Row group=DesktopTrustKeyHostSource.Map(groups[g]);DesktopTrustKeyHostSource.Exact(group,"kind,payloadRef,sourceRef,sourceBytes,contentHash,mediaType,parts");
   DesktopTrustKeyHostSource.Ref(group["sourceRef"]);DesktopTrustKeyHostSource.Ref(group["payloadRef"]);long size=N(group["sourceBytes"]);
   if(S(group,"kind")!=(g==0?"CONTEXT_BUNDLE":"START_OPTIONS")||J(group["payloadRef"])!=J(payload[g==0?"contextBundleRef":"optionsRef"])||size<1||size>2*MiB||!DesktopTrustKeyHostSource.IsHash(group["contentHash"])||S(group,"mediaType")!="application/json")throw Invalid();
   var list=group["parts"] as object[];if(list==null||list.Length<1||list.Length>200)throw Invalid();long offset=0;
   for(int n=0;n<list.Length;n++){
    Row part=DesktopTrustKeyHostSource.Map(list[n]);DesktopTrustKeyHostSource.Exact(part,"materialId,partIndex,byteOffset,utf8Bytes,contentHash");string id=DesktopTrustKeyHostSource.Id(part,"materialId");long length=N(part["utf8Bytes"]);
    if(!ids.Add(id)||N(part["partIndex"])!=n+1||N(part["byteOffset"])!=offset||length<1||length>2*MiB||!DesktopTrustKeyHostSource.IsHash(part["contentHash"]))throw Invalid();
    offset=checked(offset+length);parts.Add(part);if(parts.Count>200)throw Invalid();if(g==1)optionIds.Add(id);
   }
   if(offset!=size)throw Invalid();if(g==1)options=group;
  }
  if(parts.Count+1!=count)throw Invalid();object previous=null;DateTime last=DateTime.MinValue;long optionBytes=0,metadataBytes=0;var references=new HashSet<string>();
  var key=R("projectId",scope["projectId"],"executionId",scope["executionId"],"executionGeneration",scope["generation"],"commandId",command);
  byte[] optionRaw=new byte[checked((int)N(options["sourceBytes"]))];
  try{using(var digest=SHA256.Create()){
   for(int n=1;n<=count;n++){
    string rowHash;Row row=ReadSdkIntakeRow(dir,channel,n,out rowHash),ev=DesktopTrustKeyHostSource.Map(row["entry"]);DesktopTrustKeyHostSource.Exact(ev,"ref,snapshot");
    Row snapshot=DesktopTrustKeyHostSource.Map(ev["snapshot"]),reference=DesktopTrustKeyHostSource.Ref(ev["ref"]);
    DesktopTrustKeyHostSource.Exact(snapshot,"sequence,kind,key,envelopeHash,descriptorHash,materialId,partContentHash,proofResultRef,materials,recordedAt,previousRef");
    metadataBytes=checked(metadataBytes+Encoding.UTF8.GetByteCount(J(ev)));if(metadataBytes>2*MiB)throw Invalid();
    DateTime at=DesktopTrustKeyHostSource.Time(snapshot,"recordedAt");DesktopTrustKeyHostSource.Ref(snapshot["proofResultRef"]);
    if(N(reference["version"])!=1||!references.Add(S(reference,"id"))||S(reference,"contentHash")!=H(snapshot)||N(snapshot["sequence"])!=n||J(snapshot["previousRef"])!=J(previous)||J(snapshot["key"])!=J(key)||S(snapshot,"envelopeHash")!=S(envelope,"envelopeHash")||S(snapshot,"descriptorHash")!=descriptorHash||at<last||at>DateTime.UtcNow)throw Invalid();
    if(n==count){if(S(snapshot,"kind")!="RECEIVED"||snapshot["materialId"]!=null||snapshot["partContentHash"]!=null||row["bytes"]!=null||J(ev)!=J(entry)||rowHash!=tailHash)throw Invalid();}
    else{
     Row part=parts[n-1];string id=S(part,"materialId");
     if(S(snapshot,"kind")!="MATERIAL"||S(snapshot,"materialId")!=id||S(snapshot,"partContentHash")!=S(part,"contentHash")||snapshot["materials"]!=null||!(row["bytes"] is string))throw Invalid();
     if(optionIds.Contains(id)){
      string encoded=S(row,"bytes");if(encoded.Length>2796203||encoded.Length%4==1||!Regex.IsMatch(encoded,@"\A[A-Za-z0-9_-]+\z"))throw Invalid();
      byte[] bytes=Convert.FromBase64String(encoded.Replace('-','+').Replace('_','/')+new string('=',(4-encoded.Length%4)%4));
      try{Check();if(bytes.LongLength!=N(part["utf8Bytes"])||Convert.ToBase64String(bytes).TrimEnd('=').Replace('+','-').Replace('/','_')!=encoded||DesktopTrustKeyHostSource.Hash(bytes)!=S(part,"contentHash"))throw Invalid();
       if(optionBytes+bytes.LongLength>optionRaw.LongLength)throw Invalid();Buffer.BlockCopy(bytes,0,optionRaw,checked((int)optionBytes),bytes.Length);
       optionBytes=checked(optionBytes+bytes.LongLength);if(optionBytes>2*MiB)throw Invalid();digest.TransformBlock(bytes,0,bytes.Length,bytes,0);
      }finally{Array.Clear(bytes,0,bytes.Length);}
     }
    }
    previous=reference;last=at;Check();
   }
   digest.TransformFinalBlock(new byte[0],0,0);
   if(optionBytes!=N(options["sourceBytes"])||BitConverter.ToString(digest.Hash).Replace("-","").ToLowerInvariant()!=S(options,"contentHash"))throw Invalid();
  }
  Check();var parsed=ValidateSdkStartOptions(optionRaw,J(payload["optionsRef"]),S(options,"contentHash"));
  if(J(Inspect(rows,Normal,allocation,dir,channel,summary))!=J(summary))throw Invalid();Check();
  return parsed;
  }finally{Array.Clear(optionRaw,0,optionRaw.Length);}
 }
 // START_OPTIONS 데이터만 검사한다. 일반 wire parser/SDK 표기/실행 계획을 발급하지 않는다.
 internal sealed class SdkStartOptions {
  internal readonly string Model,OriginalRef,BytesHash;internal readonly long? MaxTurns;internal readonly double? MaxBudgetUsd;
  internal SdkStartOptions(string model,long? turns,double? budget,string originalRef,string bytesHash){Model=model;MaxTurns=turns;MaxBudgetUsd=budget;OriginalRef=originalRef;BytesHash=bytesHash;}
 }
 SdkStartOptions ValidateSdkStartOptions(byte[] bytes,string originalRef,string bytesHash){
  try{Check();if(bytes==null||bytes.Length<1||bytes.Length>2*MiB)throw Invalid();
   string text=new UTF8Encoding(false,true).GetString(bytes);var parsed=new SdkOptionsReader(text,Check).Read(originalRef,bytesHash);Check();return parsed;
  }catch{throw Invalid();}
 }
 sealed class SdkOptionsReader {
  readonly string text;readonly Action current;int at;
  internal SdkOptionsReader(string value,Action check){text=value;current=check;}
  char Peek(){return at<text.Length?text[at]:'\0';}
  void Step(){at++;if((at&1023)==0)current();}
  void Space(){while(Peek()==' '||Peek()=='\t'||Peek()=='\r'||Peek()=='\n')Step();}
  void Token(char value){Space();if(Peek()!=value)throw Invalid();Step();}
  static bool Digit(char c){return c>='0'&&c<='9';}
  static bool Hex(char c){return Digit(c)||c>='a'&&c<='f'||c>='A'&&c<='F';}
  string Text(){
   Space();int start=at;if(Peek()!='"')throw Invalid();Step();bool ended=false;
   while(at<text.Length){char c=Peek();Step();if(c=='"'){ended=true;break;}if(c<32)throw Invalid();
    if(c=='\\'){if(at>=text.Length)throw Invalid();char escape=Peek();Step();
     if(escape=='u'){for(int n=0;n<4;n++){if(at>=text.Length||!Hex(Peek()))throw Invalid();Step();}}
     else if(escape!='"'&&escape!='\\'&&escape!='/'&&escape!='b'&&escape!='f'&&escape!='n'&&escape!='r'&&escape!='t')throw Invalid();
    }
   }
   if(!ended)throw Invalid();
   string decoded=new System.Web.Script.Serialization.JavaScriptSerializer{MaxJsonLength=2097152,RecursionLimit=2}.Deserialize<string>(text.Substring(start,at-start));
   return DesktopTrustKeyHostSource.Text(R("value",decoded),"value");
  }
  double Number(){
   Space();int start=at;if(Peek()=='-')Step();if(Peek()=='0')Step();else{if(Peek()<'1'||Peek()>'9')throw Invalid();while(Digit(Peek()))Step();}
   if(Peek()=='.'){Step();if(!Digit(Peek()))throw Invalid();while(Digit(Peek()))Step();}
   if(Peek()=='e'||Peek()=='E'){Step();if(Peek()=='+'||Peek()=='-')Step();if(!Digit(Peek()))throw Invalid();while(Digit(Peek()))Step();}
   string token=text.Substring(start,at-start);double value;
   if(!Double.TryParse(token,System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out value)||Double.IsNaN(value)||Double.IsInfinity(value))throw Invalid();
   return value;
  }
  // ECMAScript trim의 공백 집합. Char.IsWhiteSpace의 U+0085 등으로 넓히지 않는다.
  static bool TrimSpace(char c){return c=='\u0009'||c=='\u000a'||c=='\u000b'||c=='\u000c'||c=='\u000d'||c=='\u0020'||c=='\u00a0'||c=='\u1680'||c>='\u2000'&&c<='\u200a'||c=='\u2028'||c=='\u2029'||c=='\u202f'||c=='\u205f'||c=='\u3000'||c=='\ufeff';}
  internal SdkStartOptions Read(string originalRef,string bytesHash){
   string model=null;long? turns=null;double? budget=null;
   current();Token('{');string key=Text();if(key!="claudeQueryParams")throw Invalid();Token(':');Token('{');var keys=new HashSet<string>(StringComparer.Ordinal);
   while(true){key=Text();if(!keys.Add(key))throw Invalid();Token(':');
    if(key=="model"){model=Text();if(model.Length<1||model.Length>200||model.All(TrimSpace)||model.Any(c=>Char.IsControl(c)))throw Invalid();}
    else{if(key!="maxTurns"&&key!="maxBudgetUsd")throw Invalid();double value=Number();if(value<0||value>9007199254740991d||key=="maxTurns"&&(value<1||Math.Truncate(value)!=value))throw Invalid();if(key=="maxTurns")turns=checked((long)value);else budget=value;}
    Space();if(Peek()=='}'){Step();break;}Token(',');
   }
   if(!keys.Contains("model"))throw Invalid();Token('}');Space();if(at!=text.Length)throw Invalid();current();return new SdkStartOptions(model,turns,budget,originalRef,bytesHash);
  }
 }
 static void RequireSdkFirst(Row snapshot,Row reference,Row handoff,bool start,int sequence){
  var envelope=DesktopTrustKeyHostSource.Map(handoff[start?"startEnvelope":"sendEnvelope"]);
  if(S(snapshot,"envelopeHash")!=S(envelope,"envelopeHash")||J(snapshot["grantRef"])!=J(handoff["grantRef"]))throw Invalid();
  if(sequence==3&&J(reference)!=J(handoff[start?"startReadyRef":"dispatchAttemptRef"]))throw Invalid();
  if(!start){
   if(sequence==1&&J(reference)!=J(handoff["localAttemptRef"]))throw Invalid();
   if(sequence>=2&&(J(snapshot["permit"])!=J(handoff["permit"])||J(snapshot["proofResultRef"])!=J(handoff["proofResultRef"])))throw Invalid();
  }
 }
 static Row LastOutputPhase(List<Row> rows,string reservation){return rows.LastOrDefault(r=>IsOutput(r)&&S(r,"id")==reservation);}
 static void OutputTime(Row o){
  long now=System.Diagnostics.Stopwatch.GetTimestamp(),start=N(o["startTick"]),end=N(o["endTick"]);
  if(now<start||now>=end||DateTime.UtcNow>=DesktopTrustKeyHostSource.Time(o,"expiresAt"))throw Invalid();
 }
 Row OutputHandoff(List<Row> rows,FileStream log,Row value,string id,DesktopTrustKeyDirectoryFact dir,out Row timing){
  timing=null;
  string res=DesktopTrustKeyHostSource.Id(value,"reservation"),held;
  if(!owned.TryGetValue(res,out held)||held!=id||outputWrite.Contains(res))throw Invalid();
  var saved=LastOutputPhase(rows,res);if(saved==null||S(saved,"kind")!="RESERVED")throw Invalid();
  var details=DesktopTrustKeyHostSource.Map(saved["output"]);timing=details;OutputTime(details);
  var before=DesktopTrustKeyHostSource.Map(saved["before"]);
  if(J(Inspect(rows,Normal,id,dir,Output,before))!=J(before))throw Invalid();
  string challenge=Id()+Id();OutputTime(details);Append(log,rows,R("kind","SDK_READ_CLOSED","writer",Normal,"allocation",id,"channel",Output,"id",res,
   "challengeHash",H(challenge),"reservationHash",H(saved)));
  OutputTime(details);owned.Remove(res);opened.Remove(id);return R("state","SDK_READ_CLOSED","challenge",challenge);
 }
 Row OutputResume(List<Row> rows,FileStream log,Row value,Row record,Row slot,string id,DesktopTrustKeyDirectoryFact dir){
  string res=DesktopTrustKeyHostSource.Id(value,"reservation");Row saved;
  if(!Unsettled(rows).TryGetValue(res,out saved)||!IsOutput(saved)||S(saved,"allocation")!=id)throw Invalid();
  var details=DesktopTrustKeyHostSource.Map(saved["output"]);OutputTime(details);
  var phase=LastOutputPhase(rows,res);
  if(phase==null||S(phase,"kind")!="SDK_READ_CLOSED"||S(phase,"reservationHash")!=H(saved)||S(phase,"challengeHash")!=H(S(value,"challenge"))||
    S(details,"recordHash")!=H(record)||S(details,"slotHash")!=H(slot)||S(details,"attemptId")!=S(value,"attemptId")||
    S(details,"scopeDigest")!=S(value,"scopeDigest")||S(details,"requestDigest")!=S(value,"requestDigest"))throw Invalid();
  var before=DesktopTrustKeyHostSource.Map(saved["before"]);
  if(J(Inspect(rows,Normal,id,dir,Output,before))!=J(before))throw Invalid();
  OutputTime(details);Append(log,rows,R("kind","SDK_WRITE_CLAIMED","writer",Normal,"allocation",id,"channel",Output,"id",res,"handoffHash",H(phase)));
  OutputTime(details);owned.Add(res,id);outputWrite.Add(res);return details;
 }
 internal Row Control(string operation,Row value,Row record,Row slot,Action understandingCurrent=null,Func<Func<Action,Row>,Row> understandingFinal=null){
  if(understandingReadOnly)throw Invalid();
  string writer=S(value,"writer");if(writer!=Normal&&writer!=Receipt)throw Invalid();var auth=writer==Normal?"attemptId,writer,slotId":"attemptId,writer";
  bool outputReserve=writer==Normal&&operation=="NORMAL_SPOOL_RESERVE"&&Object.Equals(value.ContainsKey("channel")?value["channel"]:null,Output);
  bool resumeOutput=writer==Normal&&operation=="NORMAL_SPOOL_RESUME"&&value.ContainsKey("challenge");
  bool closeOutput=writer==Normal&&operation=="NORMAL_SPOOL_CLOSE"&&value.ContainsKey("reservation");
  bool closeRange=writer==Normal&&operation=="NORMAL_SPOOL_CLOSE"&&value.ContainsKey("understandingRange");
  bool closeUnderstanding=writer==Normal&&operation=="NORMAL_SPOOL_CLOSE"&&value.ContainsKey("understanding");
  bool binding=writer==Normal&&(operation=="NORMAL_SPOOL_RESUME"||operation=="NORMAL_SPOOL_ALLOCATE")&&value.ContainsKey("outputBinding");
  if(resumeOutput)DesktopTrustKeyHostSource.Exact(value,auth+",reservation,challenge,scopeDigest,requestDigest");
  else if(binding){DesktopTrustKeyHostSource.Exact(value,auth+",outputBinding");if(!Object.Equals(value["outputBinding"],true))throw Invalid();}
  else if(outputReserve)DesktopTrustKeyHostSource.Exact(value,auth+",allocation,channel,nodeStamp,request,scope,expiresAt");
  else if(closeOutput)DesktopTrustKeyHostSource.Exact(value,auth+",allocation,reservation");
  else if(closeRange)DesktopTrustKeyHostSource.Exact(value,auth+",allocation,understandingRange");
  else if(closeUnderstanding)DesktopTrustKeyHostSource.Exact(value,auth+",allocation,understanding");
  else if(operation=="NORMAL_SPOOL_PROFILE_STATE"||operation=="NORMAL_SPOOL_ALLOCATE"||operation=="NORMAL_SPOOL_RESUME")DesktopTrustKeyHostSource.Exact(value,auth);
  else if(operation=="NORMAL_SPOOL_RESERVE")DesktopTrustKeyHostSource.Exact(value,auth+",allocation,channel,nodeStamp");
  else if(operation=="NORMAL_SPOOL_SETTLE")DesktopTrustKeyHostSource.Exact(value,auth+",allocation,channel,reservation");
  else if(operation=="NORMAL_SPOOL_CLOSE")DesktopTrustKeyHostSource.Exact(value,auth+",allocation");else throw Invalid();
  if((closeUnderstanding||closeRange)&&(understandingCurrent==null||understandingFinal==null))throw Invalid();
  string tuple=Tuple(writer,record,slot);Row timing=null;
  var answer=Log(false,(log,rows)=>{
   if(!Has(rows,"REGISTERED",H(record)))throw Invalid();
   if(writer==Normal&&!rows.Any(r=>S(r,"kind")=="SLOT_ID"&&S(r,"key")==S(slot,"slotId")&&S(r,"slotHash")==H(slot)))throw Invalid();
   var started=rows.LastOrDefault(r=>S(r,"kind")=="ALLOCATING"&&S(r,"key")==tuple);
   if(operation=="NORMAL_SPOOL_PROFILE_STATE")return R("profileId",profileId,"allocated",started!=null);
   bool creating=operation=="NORMAL_SPOOL_ALLOCATE",resuming=operation=="NORMAL_SPOOL_RESUME";
   var allocation=Allocate(rows,log,writer,tuple,!creating);string id=S(allocation,"id");var dir=root.RetainSpoolNamespace(id,false);
   if(dir.Identity!=S(allocation,"directoryIdentity")||PendingUnderstanding(rows,id))throw Invalid();
   if(creating||resuming){if(Unsettled(rows).Values.Any(r=>S(r,"allocation")==id&&(!IsOutput(r)||S(LastOutputPhase(rows,S(r,"id")),"kind")!="SDK_READ_CLOSED")))throw Invalid();
    if(writer==Normal){var sr=DesktopTrustKeyHostSource.Map(slot["scope"]);string grant=H(sr["grantRef"]);if(creating)Append(log,rows,R("kind","GRANT","key",id,"grant",grant));
     else if(!rows.Any(r=>S(r,"kind")=="GRANT"&&S(r,"key")==id&&S(r,"grant")==grant))throw Invalid();}
    if(!opened.Add(id))throw Invalid();
    if(resumeOutput)timing=OutputResume(rows,log,value,record,slot,id,dir);
    var result=R("state",creating?"ALLOCATED":"RESUMED","profileId",profileId,"allocation",id,"root",dir.Path,"directoryIdentity",dir.Identity);
    if(binding){result.Add("profileRef",EvidenceRef(profileId,rows[0]));result.Add("assignmentRef",EvidenceRef(id,allocation));}return result;}
   if(!opened.Contains(id)||!ownedAllocation(id,value))throw Invalid();
   if(closeOutput)return OutputHandoff(rows,log,value,id,dir,out timing);
   if(closeRange){understandingCurrent();return BeginSupervisedUnderstandingRange(rows,log,value,record,slot,allocation,dir);}
   if(closeUnderstanding){understandingCurrent();return BeginSupervisedUnderstanding(rows,log,value,record,slot,allocation,dir);}
   if(operation=="NORMAL_SPOOL_CLOSE"){if(owned.Values.Contains(id))throw Invalid();opened.Remove(id);return R("state","CLOSED_CONFIRMED");}
   string channel=Channel(value,writer);var prior=rows.LastOrDefault(r=>S(r,"kind")=="SETTLED"&&S(r,"allocation")==id&&S(r,"channel")==channel);
   var before=prior==null?Empty():DesktopTrustKeyHostSource.Map(prior["summary"]);
   if(operation=="NORMAL_SPOOL_RESERVE"){string stamp=S(value,"nodeStamp");if(!Regex.IsMatch(stamp,@"\A[0-9]{1,20}:[0-9]{1,20}\z"))throw Invalid();var bound=rows.SingleOrDefault(r=>S(r,"kind")=="NODE_STAMP"&&S(r,"key")==id);if(bound==null)Append(log,rows,R("kind","NODE_STAMP","key",id,"stamp",stamp));else if(S(bound,"stamp")!=stamp)throw Invalid();var files=writer==Receipt?new Dictionary<string,string>():null;var observed=Inspect(rows,writer,id,dir,channel,null,files);if(J(observed)!=J(before))throw Invalid();
    long worst=writer==Normal?64*MiB-N(before["bytes"]):4096;
    if(outputReserve){
     var requested=DesktopTrustKeyHostSource.Map(value["request"]);DesktopTrustKeyHostSource.Exact(requested,"channel,pool,id,scopeDigest,dataBytes,rows,tailRef");
     var outputScope=OutputScope(DesktopTrustKeyHostSource.Map(value["scope"]),rows,allocation,record,slot);
     string sd=H(outputScope);long count=N(requested["rows"]),bytes=N(requested["dataBytes"]);
     if(S(requested,"channel")!="SDK_SESSION_OUTPUT"||S(requested,"pool")!=Normal||S(requested,"scopeDigest")!=sd||
        count<1||count>2||bytes<3*MiB||bytes>6*MiB||N(before["count"])+count>10000||N(before["bytes"])+bytes>64*MiB||
        rows.Any(r=>IsOutput(r)&&S(r,"kind")=="RESERVED"&&(S(DesktopTrustKeyHostSource.Map(r["output"]),"requestId")==S(requested,"id")||
          S(r,"allocation")==id&&S(DesktopTrustKeyHostSource.Map(r["output"]),"scopeDigest")!=sd)))throw Invalid();
     if((requested["tailRef"]==null)!=(N(before["count"])==0))throw Invalid();
     if(requested["tailRef"]!=null)DesktopTrustKeyHostSource.Ref(requested["tailRef"]);
     DateTime now=DateTime.UtcNow,end=DesktopTrustKeyHostSource.Time(value,"expiresAt");
     if(end<=now||end>DesktopTrustKeyHostSource.Time(slot,"expiresAt"))throw Invalid();
     long tick=System.Diagnostics.Stopwatch.GetTimestamp();var details=R("recordHash",H(record),"slotHash",H(slot),"attemptId",S(value,"attemptId"),
      "scopeDigest",sd,"requestDigest",H(requested),"requestId",DesktopTrustKeyHostSource.Id(requested,"id"),"expiresAt",value["expiresAt"],
      "startTick",tick,"endTick",checked(tick+(long)((end-now).TotalSeconds*System.Diagnostics.Stopwatch.Frequency)),"rows",count,"bytes",bytes);
     timing=details;OutputTime(details);var h=Reserve(rows,log,Normal,id,Output,checked(bytes+OutputManagementWorst),before,details);OutputTime(details);
     return R("id",h["id"],"requestDigest",details["requestDigest"],"normalUsed",h["normalUsed"],"normalHeldBefore",h["normalHeldBefore"],
       "channelRows",before["count"],"channelBytes",before["bytes"],"channelHeldBytes",0,"channelHeldRows",0,"managementBytes",OutputManagementWorst);
    }
    var hold=Reserve(rows,log,writer,id,channel,worst,before);if(files!=null)receiptPrefixes.Add(S(hold,"id"),files);return R("reservation",hold["id"],"before",before);}
   string reservation=DesktopTrustKeyHostSource.Id(value,"reservation");string held;if(!owned.TryGetValue(reservation,out held)||held!=id)throw Invalid();
   var active=Unsettled(rows);Row saved;if(!active.TryGetValue(reservation,out saved)||S(saved,"channel")!=channel)throw Invalid();
   var checkedFiles=writer==Receipt?new Dictionary<string,string>():null;var after=Inspect(rows,writer,id,dir,channel,before,checkedFiles);
   if(channel==Output){
    if(!outputWrite.Contains(reservation)||!IsOutput(saved)||S(LastOutputPhase(rows,reservation),"kind")!="SDK_WRITE_CLAIMED")throw Invalid();
    var o=DesktopTrustKeyHostSource.Map(saved["output"]);timing=o;OutputTime(o);
    if(N(after["count"])-N(before["count"])>N(o["rows"])||N(after["bytes"])-N(before["bytes"])>N(o["bytes"]))throw Invalid();outputWrite.Remove(reservation);
   }
   if(checkedFiles!=null){var original=receiptPrefixes[reservation];if(checkedFiles.Count>original.Count+1||original.Any(p=>!checkedFiles.ContainsKey(p.Key)||checkedFiles[p.Key]!=p.Value))throw Invalid();}if(N(after["count"])<N(before["count"])||N(after["bytes"])<N(before["bytes"])||N(after["bytes"])-N(before["bytes"])>N(saved["worst"]))throw Invalid();
   Append(log,rows,R("kind","SETTLED","writer",writer,"allocation",id,"channel",channel,"id",reservation,"summary",after));owned.Remove(reservation);receiptPrefixes.Remove(reservation);return R("state","SETTLED","summary",after);
  });if(timing!=null)OutputTime(timing);
  if(closeRange){var closed=understandingSupervisor.Read(answer);return FinishSupervisedUnderstandingRange(answer,closed,understandingFinal);}
  if(closeUnderstanding){
   // 원 Log/anchor가 정상 Dispose된 뒤에만 child를 시작한다. 실패는 START를 보존한다.
   var closed=understandingSupervisor.Read(answer);return FinishSupervisedUnderstanding(answer,closed,understandingFinal);
  }return answer;
 }
 static bool ownedAllocation(string id,Row payload){return id==DesktopTrustKeyHostSource.Id(payload,"allocation");}
}
