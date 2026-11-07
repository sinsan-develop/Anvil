#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#ifndef NAPI_VERSION
#define NAPI_VERSION 8
#endif
#include <node_api.h>
#include <sys/stat.h>
#include <sys/statvfs.h>
#include <sys/vfs.h>
#include <sys/utsname.h>
#include <fcntl.h>
#include <unistd.h>
#include <pthread.h>
#include <stdint.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>
#include <limits.h>
#include <math.h>

/* 서버 내부 Linux 전용 포트. 경로/errno/바이트를 JS 오류에 넣지 않는다. */
#define SLOT_MAX 64
#define ROOT_MAX 64
#define FILE_MAX 256
#define WORK_MAX 32
#define DEPTH_MAX 256
#define BYTE_MAX 16384
#define SAFE_MAX 9007199254740991ULL
#define EXT_MAGIC 0xef53
#define PROC_MAGIC 0x9fa0
#define TAG_PORT 1
#define TAG_ROOT 2
#define TAG_FILE 3

typedef struct Env Env;
typedef struct Port Port;
typedef struct Root Root;
typedef struct File File;
typedef struct Work Work;
typedef struct {uint64_t dev,ino;} Identity;
typedef struct {char slot[37],installation[37],purpose[20],profile[37],hash[65];uint64_t version;uint32_t uid;Identity expected;} Binding;
typedef struct {Binding binding;char path[4096];} Slot;
typedef struct {int kind;bool gc,wrapped;Env *env;size_t charged;} Box;
typedef enum {OPEN_ROOT,INSPECT,CREATE,OPEN_FILE,STAT_FILE,READ_FILE,SYNC_FILE,REMOVE_FILE,PUBLISH_FILE,SYNC_PARENT,CLOSE_FILE,CLOSE_ROOT} Op;
struct Port {Box box;Slot *slots;size_t count;Port *next;};
struct File {Box box;Root *root;int fd;bool created,closing;_Atomic bool closed,unknown,fd_unknown,reserved;_Atomic int terminal;uint64_t generation;struct stat birth;char name[37];napi_ref close_promise;File *next;};
struct Root {Box box;Port *port;Slot slot;int fds[DEPTH_MAX+1];struct stat stats[DEPTH_MAX+1];char names[DEPTH_MAX][256];size_t depth,opened;bool closing,busy,claimed;_Atomic bool closed,unknown,fd_unknown;uint64_t generation;struct statvfs space;File *files;Work *head,*tail;napi_ref close_promise;Root *next;};
struct Work {Env *env;Root *root;File *file;Op op;Work *next;napi_async_work async,recovery;napi_deferred deferred;const char *error;char name[37];Identity expected;unsigned char *bytes;size_t length,max,charged;struct stat observed;};
struct Env {napi_env napi;Port *ports;Root *roots;size_t references,works;bool stopping,cleanup_queued,cleanup_done,pruning,accounting_fault;int64_t external_bytes;napi_async_cleanup_hook_handle hook;napi_async_work cleanup;};
typedef struct {bool used,tombstone;Identity id;Root *root;} Owner;
static pthread_mutex_t global_lock=PTHREAD_MUTEX_INITIALIZER;
static Owner owners[ROOT_MAX];
static size_t file_reservations=0,work_count=0;
static uint64_t serial=0;
static const napi_type_tag port_tag={0x415633464e313650ULL,0x504f52544e415038ULL};
static const napi_type_tag root_tag={0x415633464e313652ULL,0x524f4f544e415038ULL};
static const napi_type_tag file_tag={0x415633464e313646ULL,0x46494c454e415038ULL};
static void pump(Root *r);
static void maybe_cleanup(Env *e);
static void prune(Env *e,napi_env env);
static bool id_equal(Identity a,Identity b){return a.dev==b.dev&&a.ino==b.ino;}
static Identity stat_id(const struct stat *s){return (Identity){(uint64_t)s->st_dev,(uint64_t)s->st_ino};}
static void erase(void *p,size_t n){volatile unsigned char *v=p;while(n--)*v++=0;}
static uint64_t generation(void){uint64_t n=0;pthread_mutex_lock(&global_lock);if(serial<SAFE_MAX)n=++serial;pthread_mutex_unlock(&global_lock);return n;}
static bool reserve(size_t *count,size_t max){bool ok=false;pthread_mutex_lock(&global_lock);if(*count<max){++*count;ok=true;}pthread_mutex_unlock(&global_lock);return ok;}
static void release(size_t *count){pthread_mutex_lock(&global_lock);if(*count)--*count;pthread_mutex_unlock(&global_lock);}
/* 외부 메모리 반환값은 전역일 수 있으므로 자체 할당 ledger와 혼동하지 않는다. */
static bool charge(Env *e,size_t bytes){
 if(bytes>(size_t)INT64_MAX||e->external_bytes>INT64_MAX-(int64_t)bytes)return false;
 int64_t reported;
 if(napi_adjust_external_memory(e->napi,(int64_t)bytes,&reported)!=napi_ok){e->accounting_fault=true;return false;}
 e->external_bytes+=(int64_t)bytes;return true;
}
static void uncharge(Env *e,napi_env env,size_t bytes){
 if(!bytes)return;
 if(bytes>(size_t)e->external_bytes){e->accounting_fault=true;return;}
 e->external_bytes-=(int64_t)bytes;
 if(env){int64_t reported;if(napi_adjust_external_memory(env,-(int64_t)bytes,&reported)!=napi_ok)e->accounting_fault=true;}
 /* env 없는 최종 VM 파기에서는 C ledger만 회수하며 무효 env로 API를 호출하지 않는다. */
}
static void release_file_reservation(File *f){
 if(!f->fd_unknown&&atomic_exchange(&f->reserved,false))release(&file_reservations);
}
static bool claim_root(Root *r){bool ok=false;pthread_mutex_lock(&global_lock);size_t empty=ROOT_MAX;for(size_t i=0;i<ROOT_MAX;i++){if(owners[i].used&&id_equal(owners[i].id,r->slot.binding.expected))goto done;if(!owners[i].used&&empty==ROOT_MAX)empty=i;}if(empty<ROOT_MAX){owners[empty]=(Owner){true,false,r->slot.binding.expected,r};r->claimed=true;ok=true;}done:pthread_mutex_unlock(&global_lock);return ok;}
static void release_root(Root *r,bool certain){pthread_mutex_lock(&global_lock);for(size_t i=0;i<ROOT_MAX;i++)if(owners[i].used&&owners[i].root==r){if(certain)memset(&owners[i],0,sizeof owners[i]);else{owners[i].tombstone=true;owners[i].root=NULL;}}r->claimed=false;pthread_mutex_unlock(&global_lock);}
static void clear_exception(napi_env env){bool pending=false;if(napi_is_exception_pending(env,&pending)==napi_ok&&pending){napi_value v;napi_get_and_clear_last_exception(env,&v);}}
static napi_value error_value(napi_env env,const char *code){napi_value text,error;napi_create_string_utf8(env,code,NAPI_AUTO_LENGTH,&text);napi_create_error(env,NULL,text,&error);napi_set_named_property(env,error,"code",text);return error;}
static napi_value reject(napi_env env,const char *code){clear_exception(env);napi_value promise;napi_deferred deferred;if(napi_create_promise(env,&deferred,&promise)!=napi_ok)return NULL;napi_reject_deferred(env,deferred,error_value(env,code));return promise;}
static bool object(napi_env env,napi_value v){napi_valuetype t;bool arr=false;return napi_typeof(env,v,&t)==napi_ok&&t==napi_object&&napi_is_array(env,v,&arr)==napi_ok&&!arr;}
static bool keys(napi_env env,napi_value v,const char *const *expected,size_t count){if(!object(env,v))return false;napi_value names;if(napi_get_all_property_names(env,v,napi_key_own_only,napi_key_all_properties,napi_key_numbers_to_strings,&names)!=napi_ok)return false;uint32_t n;if(napi_get_array_length(env,names,&n)!=napi_ok||n!=count)return false;for(size_t i=0;i<count;i++){bool has=false;napi_value key;if(napi_create_string_utf8(env,expected[i],NAPI_AUTO_LENGTH,&key)!=napi_ok||napi_has_own_property(env,v,key,&has)!=napi_ok||!has)return false;}return true;}
static bool prop(napi_env env,napi_value v,const char *name,napi_value *out){return napi_get_named_property(env,v,name,out)==napi_ok;}
static bool string(napi_env env,napi_value v,char *out,size_t cap){napi_valuetype t;size_t n=0;if(napi_typeof(env,v,&t)!=napi_ok||t!=napi_string||napi_get_value_string_utf8(env,v,NULL,0,&n)!=napi_ok||n>=cap)return false;size_t got=0;if(napi_get_value_string_utf8(env,v,out,cap,&got)!=napi_ok||got!=n||strlen(out)!=n)return false;return true;}
static bool text_prop(napi_env env,napi_value v,const char *key,char *out,size_t cap){napi_value x;return prop(env,v,key,&x)&&string(env,x,out,cap);}
static bool number(napi_env env,napi_value v,uint64_t min,uint64_t max,uint64_t *out){napi_valuetype t;double d;if(napi_typeof(env,v,&t)!=napi_ok||t!=napi_number||napi_get_value_double(env,v,&d)!=napi_ok||!isfinite(d)||d<min||d>max||floor(d)!=d)return false;*out=(uint64_t)d;return true;}
static bool number_prop(napi_env env,napi_value v,const char *key,uint64_t min,uint64_t max,uint64_t *out){napi_value x;return prop(env,v,key,&x)&&number(env,x,min,max,out);}
static bool truth(napi_env env,napi_value v,const char *key){napi_value x;napi_valuetype t;bool b=false;return prop(env,v,key,&x)&&napi_typeof(env,x,&t)==napi_ok&&t==napi_boolean&&napi_get_value_bool(env,x,&b)==napi_ok&&b;}
static bool uuid(const char *s){if(strlen(s)!=36)return false;for(size_t i=0;i<36;i++){if(i==8||i==13||i==18||i==23){if(s[i]!='-')return false;}else if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f')))return false;}return s[14]>='1'&&s[14]<='8'&&(s[19]=='8'||s[19]=='9'||s[19]=='a'||s[19]=='b');}
static bool decimal(const char *s,uint64_t *out){size_t n=strlen(s);if(!n||n>20||(n>1&&s[0]=='0'))return false;uint64_t x=0;for(size_t i=0;i<n;i++){if(s[i]<'0'||s[i]>'9'||x>(UINT64_MAX-(unsigned)(s[i]-'0'))/10)return false;x=x*10+(unsigned)(s[i]-'0');}*out=x;return true;}
static bool read_identity(napi_env env,napi_value v,Identity *id){const char *k[]={"device","inode"};char d[21],i[21];return keys(env,v,k,2)&&text_prop(env,v,"device",d,sizeof d)&&text_prop(env,v,"inode",i,sizeof i)&&decimal(d,&id->dev)&&decimal(i,&id->ino);}
static bool read_binding(napi_env env,napi_value v,Binding *b){const char *k[]={"slotId","installationId","purpose","profileRef","expectedRootIdentity","ownerUid"};const char *pk[]={"id","version","contentHash"};napi_value p,i;uint64_t uid;memset(b,0,sizeof *b);if(!keys(env,v,k,6)||!text_prop(env,v,"slotId",b->slot,sizeof b->slot)||!uuid(b->slot)||!text_prop(env,v,"installationId",b->installation,sizeof b->installation)||!uuid(b->installation)||!text_prop(env,v,"purpose",b->purpose,sizeof b->purpose)||(strcmp(b->purpose,"KEY_VAULT")&&strcmp(b->purpose,"BACKUP_TARGET"))||!prop(env,v,"profileRef",&p)||!keys(env,p,pk,3)||!text_prop(env,p,"id",b->profile,sizeof b->profile)||!uuid(b->profile)||!number_prop(env,p,"version",1,SAFE_MAX,&b->version)||!text_prop(env,p,"contentHash",b->hash,sizeof b->hash)||strlen(b->hash)!=64||!number_prop(env,v,"ownerUid",0,UINT32_MAX,&uid)||!prop(env,v,"expectedRootIdentity",&i)||!read_identity(env,i,&b->expected))return false;for(size_t n=0;n<64;n++)if(!((b->hash[n]>='0'&&b->hash[n]<='9')||(b->hash[n]>='a'&&b->hash[n]<='f')))return false;b->uid=(uint32_t)uid;return true;}
static bool equal_binding(const Binding *a,const Binding *b){return !strcmp(a->slot,b->slot)&&!strcmp(a->installation,b->installation)&&!strcmp(a->purpose,b->purpose)&&!strcmp(a->profile,b->profile)&&!strcmp(a->hash,b->hash)&&a->version==b->version&&a->uid==b->uid&&id_equal(a->expected,b->expected);}
static bool path_valid(const char *s){size_t n=strlen(s),depth=0,start=1;if(n<2||n>4095||s[0]!='/'||s[n-1]=='/')return false;for(size_t i=1;i<=n;i++)if(s[i]=='/'||s[i]==0){size_t len=i-start;if(!len||len>255||++depth>DEPTH_MAX||(len==1&&s[start]=='.')||(len==2&&s[start]=='.'&&s[start+1]=='.'))return false;start=i+1;}return true;}
static napi_value js_string(napi_env e,const char *s){napi_value v;napi_create_string_utf8(e,s,NAPI_AUTO_LENGTH,&v);return v;}
static napi_value js_number(napi_env e,uint64_t n){napi_value v;napi_create_double(e,(double)n,&v);return v;}
static napi_value js_bool(napi_env e,bool b){napi_value v;napi_get_boolean(e,b,&v);return v;}
static napi_value js_object(napi_env e){napi_value v;napi_create_object(e,&v);return v;}
static void set(napi_env e,napi_value o,const char *k,napi_value v){napi_set_named_property(e,o,k,v);}
static napi_value js_id(napi_env e,Identity id){char d[21],i[21];snprintf(d,sizeof d,"%llu",(unsigned long long)id.dev);snprintf(i,sizeof i,"%llu",(unsigned long long)id.ino);napi_value v=js_object(e);set(e,v,"device",js_string(e,d));set(e,v,"inode",js_string(e,i));return v;}
static napi_value js_binding(napi_env e,const Binding *b){napi_value v=js_object(e),p=js_object(e);set(e,v,"slotId",js_string(e,b->slot));set(e,v,"installationId",js_string(e,b->installation));set(e,v,"purpose",js_string(e,b->purpose));set(e,p,"id",js_string(e,b->profile));set(e,p,"version",js_number(e,b->version));set(e,p,"contentHash",js_string(e,b->hash));set(e,v,"profileRef",p);set(e,v,"expectedRootIdentity",js_id(e,b->expected));set(e,v,"ownerUid",js_number(e,b->uid));return v;}
static napi_value js_stat(napi_env e,const struct stat *s){char mode[4];snprintf(mode,sizeof mode,"%03o",(unsigned)(s->st_mode&0777));napi_value v=js_object(e);set(e,v,"identity",js_id(e,stat_id(s)));set(e,v,"kind",js_string(e,S_ISDIR(s->st_mode)?"directory":"file"));set(e,v,"symlink",js_bool(e,false));set(e,v,"uid",js_number(e,s->st_uid));set(e,v,"gid",js_number(e,s->st_gid));set(e,v,"mode",js_string(e,mode));return v;}
static bool directory_ok(const struct stat *s,uint32_t uid,bool root){return S_ISDIR(s->st_mode)&&(s->st_mode&07000)==0&&(root?(s->st_uid==uid&&s->st_gid==uid&&(s->st_mode&0777)==0700):((s->st_uid==0||s->st_uid==uid)&&(s->st_mode&0022)==0));}
static bool file_ok(const struct stat *s,uint32_t uid){return S_ISREG(s->st_mode)&&s->st_uid==uid&&s->st_gid==uid&&(s->st_mode&07777)==0600&&s->st_size>0&&s->st_size<=BYTE_MAX;}
static bool close_once(int *fd){if(*fd<0)return true;int own=*fd;*fd=-1;return close(own)==0;}
static bool close_root_fds(Root *r){bool ok=true;for(size_t i=r->opened;i>0;i--)if(!close_once(&r->fds[i-1]))ok=false;r->opened=0;return ok;}
static bool root_current(Root *r){if(r->closed||r->opened!=r->depth+1||geteuid()!=r->slot.binding.uid)return false;struct stat now,name;for(size_t i=0;i<r->opened;i++){if(fstat(r->fds[i],&now)||!id_equal(stat_id(&now),stat_id(&r->stats[i]))||!directory_ok(&now,r->slot.binding.uid,i==r->depth))return false;if(i==0){if(lstat("/",&name))return false;}else if(fstatat(r->fds[i-1],r->names[i-1],&name,AT_SYMLINK_NOFOLLOW))return false;if(!id_equal(stat_id(&now),stat_id(&name))||!S_ISDIR(name.st_mode))return false;r->stats[i]=now;}struct statfs type;if(fstatfs(r->fds[r->depth],&type)||type.f_type!=EXT_MAGIC||fstatvfs(r->fds[r->depth],&r->space))return false;if(r->space.f_frsize&&r->space.f_bavail>SAFE_MAX/r->space.f_frsize)return false;return r->space.f_favail<=SAFE_MAX;}
static bool file_current(Root *r,File *f,struct stat *out){struct stat actual,named;if(f->fd<0||fstat(f->fd,&actual)||!file_ok(&actual,r->slot.binding.uid)||!id_equal(stat_id(&actual),stat_id(&f->birth))||actual.st_size!=f->birth.st_size)return false;if(f->terminal!=2){if(fstatat(r->fds[r->depth],f->name,&named,AT_SYMLINK_NOFOLLOW)||!S_ISREG(named.st_mode)||!id_equal(stat_id(&actual),stat_id(&named)))return false;}if(out)*out=actual;return true;}
static bool open_root_fds(Root *r){for(size_t i=0;i<=DEPTH_MAX;i++)r->fds[i]=-1;char path[4096];memcpy(path,r->slot.path,strlen(r->slot.path)+1);char *save=NULL,*part=strtok_r(path+1,"/",&save);r->depth=0;r->fds[0]=open("/",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(r->fds[0]<0)return false;r->opened=1;if(fstat(r->fds[0],&r->stats[0])||!directory_ok(&r->stats[0],r->slot.binding.uid,false))return false;while(part){if(r->depth>=DEPTH_MAX)return false;strcpy(r->names[r->depth],part);int fd=openat(r->fds[r->depth],part,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return false;r->depth++;r->fds[r->depth]=fd;r->opened++;if(fstat(fd,&r->stats[r->depth]))return false;part=strtok_r(NULL,"/",&save);if(!directory_ok(&r->stats[r->depth],r->slot.binding.uid,part==NULL))return false;}return id_equal(stat_id(&r->stats[r->depth]),r->slot.binding.expected)&&root_current(r);}
static bool complete_write(int fd,const unsigned char *data,size_t n){size_t done=0;while(done<n){ssize_t w=write(fd,data+done,n-done);if(w<0&&errno==EINTR)continue;if(w<=0)return false;done+=(size_t)w;}return true;}
static bool complete_read(int fd,unsigned char *data,size_t n){size_t done=0;while(done<n){ssize_t got=pread(fd,data+done,n-done,(off_t)done);if(got<0&&errno==EINTR)continue;if(got<=0)return false;done+=(size_t)got;}return true;}
static bool sync_fd(int fd){int rc;do{rc=fsync(fd);}while(rc&&errno==EINTR);return rc==0;}
static bool publish_fd(Root *r,File *f,const char *name){struct statfs proc;struct stat source,final;char procpath[64];if(statfs("/proc/self/fd",&proc)||proc.f_type!=PROC_MAGIC)return false;snprintf(procpath,sizeof procpath,"/proc/self/fd/%d",f->fd);if(stat(procpath,&source)||!id_equal(stat_id(&source),stat_id(&f->birth)))return false;if(linkat(AT_FDCWD,procpath,r->fds[r->depth],name,AT_SYMLINK_FOLLOW))return false;if(fstatat(r->fds[r->depth],name,&final,AT_SYMLINK_NOFOLLOW)||!S_ISREG(final.st_mode)||!id_equal(stat_id(&final),stat_id(&f->birth))||!file_current(r,f,NULL)||!root_current(r))return false;if(unlinkat(r->fds[r->depth],f->name,0))return false;strcpy(f->name,name);return file_current(r,f,NULL)&&root_current(r);}
static void execute(napi_env ignored,void *data){(void)ignored;Work *w=data;Root *r=w->root;File *f=w->file;if(w->op==CLOSE_FILE){bool ok=close_once(&f->fd);f->closed=true;if(ok)release_file_reservation(f);if(!ok){f->unknown=true;f->fd_unknown=true;r->unknown=true;r->fd_unknown=true;w->error="RESOURCE_STATE_UNKNOWN";}return;}if(w->op==CLOSE_ROOT){bool certain=!r->fd_unknown;for(File *x=r->files;x;x=x->next)if(!x->closed||x->fd_unknown)certain=false;if(!close_root_fds(r)){certain=false;r->fd_unknown=true;}r->closed=true;if(r->claimed)release_root(r,certain);if(!certain){r->unknown=true;w->error="RESOURCE_STATE_UNKNOWN";}return;}
 if(w->op==OPEN_ROOT){if(!open_root_fds(r)){bool closed=close_root_fds(r);r->closed=true;r->unknown=!closed;r->fd_unknown=!closed;if(r->claimed)release_root(r,closed);w->error=closed?"RESOURCE_UNVERIFIED":"RESOURCE_STATE_UNKNOWN";}return;}
 if(r->unknown){w->error="RESOURCE_STATE_UNKNOWN";return;}if(!root_current(r)){r->unknown=true;w->error="RESOURCE_UNVERIFIED";return;}
 if(w->op==INSPECT)return;
 if(w->op==CREATE||w->op==OPEN_FILE){int flags=O_NOFOLLOW|O_CLOEXEC|O_NONBLOCK|(w->op==CREATE?(O_RDWR|O_CREAT|O_EXCL):O_RDONLY);f->fd=openat(r->fds[r->depth],w->name,flags,0600);if(f->fd<0){w->error=w->op==CREATE?"RESOURCE_STATE_UNKNOWN":"RESOURCE_UNVERIFIED";goto file_failure;}strcpy(f->name,w->name);if(w->op==CREATE&&!complete_write(f->fd,w->bytes,w->length)){w->error="RESOURCE_STATE_UNKNOWN";goto file_failure;}if(fstat(f->fd,&f->birth)||!file_ok(&f->birth,r->slot.binding.uid)||!root_current(r)||!file_current(r,f,&w->observed)){w->error="RESOURCE_STATE_UNKNOWN";goto file_failure;}return;
 file_failure: if(!close_once(&f->fd)){w->error="RESOURCE_STATE_UNKNOWN";f->fd_unknown=true;r->fd_unknown=true;}release_file_reservation(f);f->closed=true;f->unknown=true;r->unknown=true;return;}
 if(w->op==SYNC_PARENT){if(!sync_fd(r->fds[r->depth])||!root_current(r)){r->unknown=true;w->error="RESOURCE_STATE_UNKNOWN";}return;}
 if(!file_current(r,f,&w->observed)){r->unknown=true;f->unknown=true;w->error="RESOURCE_UNVERIFIED";return;}
 bool ok=true;
 if(w->op==READ_FILE){w->length=(size_t)w->observed.st_size;if(w->length>w->max)w->length=w->max;ok=complete_read(f->fd,w->bytes,w->length);}
 else if(w->op==SYNC_FILE)ok=sync_fd(f->fd);
 else if(w->op==REMOVE_FILE){ok=id_equal(w->expected,stat_id(&f->birth))&&unlinkat(r->fds[r->depth],f->name,0)==0;if(ok)f->terminal=2;}
 else if(w->op==PUBLISH_FILE){ok=id_equal(w->expected,stat_id(&f->birth))&&publish_fd(r,f,w->name);if(ok)f->terminal=3;}
 if(ok)ok=root_current(r)&&file_current(r,f,&w->observed);
 if(!ok){r->unknown=true;f->unknown=true;w->error="RESOURCE_STATE_UNKNOWN";}
}

/* 모든 큐 조작/Promise는 해당 napi_env 스레드에서만 수행한다. */
static bool has_root(Env *e,Port *p){for(Root *r=e->roots;r;r=r->next)if(r->port==p)return true;return false;}
static void prune(Env *e,napi_env env){
 if(e->pruning||(e->stopping&&!e->cleanup_done))return;
 e->pruning=true;
 Root **rp=&e->roots;
 while(*rp){Root *r=*rp;File **fp=&r->files;
  while(*fp){File *f=*fp;
   if(f->box.gc&&f->closed&&!r->busy&&!r->head){
    *fp=f->next;size_t charged=f->box.charged;erase(f,sizeof *f);free(f);uncharge(e,env,charged);
   }else fp=&f->next;
  }
  if(r->box.gc&&r->closed&&!r->files&&!r->busy&&!r->head){
   *rp=r->next;size_t charged=r->box.charged;erase(r,sizeof *r);free(r);uncharge(e,env,charged);
  }else rp=&r->next;
 }
 Port **pp=&e->ports;
 while(*pp){Port *p=*pp;
  if(p->box.gc&&!has_root(e,p)){
   *pp=p->next;size_t charged=p->box.charged;erase(p->slots,sizeof(Slot)*p->count);free(p->slots);free(p);uncharge(e,env,charged);
  }else pp=&p->next;
 }
 e->pruning=false;
}
static void free_env(Env *e,napi_env env){
 if(!e->cleanup_done||e->references||e->pruning)return;
 prune(e,env);uncharge(e,env,sizeof *e);free(e);
}
static void finalizer(napi_env env,void *data,void *hint){
 (void)hint;Box *box=data;Env *e=box->env;box->gc=true;
 if(!e->stopping){napi_ref ref=NULL;if(box->kind==TAG_ROOT)ref=((Root*)box)->close_promise;else if(box->kind==TAG_FILE)ref=((File*)box)->close_promise;if(ref)napi_delete_reference(env,ref);}
 if(box->wrapped){box->wrapped=false;e->references--;}
 prune(e,env);free_env(e,env);
}
static void factory_finalizer(napi_env env,void *data,void *hint){(void)hint;Env *e=data;e->references--;free_env(e,env);}
static napi_value capability(napi_env env,Box *box,const napi_type_tag *tag){napi_value v;if(napi_create_object(env,&v)!=napi_ok||napi_type_tag_object(env,v,tag)!=napi_ok||napi_wrap(env,v,box,finalizer,NULL,NULL)!=napi_ok)return NULL;box->gc=false;box->wrapped=true;box->env->references++;return v;}
static Box *unwrap(napi_env env,napi_value v,const napi_type_tag *tag,int kind){bool match=false;void *p=NULL;if(!object(env,v)||napi_check_object_type_tag(env,v,tag,&match)!=napi_ok||!match||napi_unwrap(env,v,&p)!=napi_ok||!p)return NULL;Box *b=p;return b->kind==kind&&!b->gc?b:NULL;}
static napi_value root_observation(napi_env env,Root *r){napi_value result=js_object(env),parents,root=js_stat(env,&r->stats[r->depth]);napi_create_array_with_length(env,r->depth,&parents);for(size_t i=0;i<r->depth;i++)napi_set_element(env,parents,(uint32_t)i,js_stat(env,&r->stats[i]));set(env,root,"availableBytes",js_number(env,(uint64_t)r->space.f_bavail*r->space.f_frsize));set(env,root,"availableInodes",js_number(env,r->space.f_favail));set(env,result,"binding",js_binding(env,&r->slot.binding));set(env,result,"generation",js_number(env,r->generation));set(env,result,"root",root);set(env,result,"parents",parents);return result;}
static napi_value file_observation(napi_env env,File *f,const struct stat *s){napi_value result=js_object(env),file=js_stat(env,s);set(env,file,"bytes",js_number(env,(uint64_t)s->st_size));set(env,result,"generation",js_number(env,f->generation));set(env,result,"file",file);return result;}
static napi_value outcome(napi_env env,Work *w){napi_value result;if(w->op==OPEN_ROOT)return capability(env,&w->root->box,&root_tag);if(w->op==INSPECT)return root_observation(env,w->root);if(w->op==CREATE||w->op==OPEN_FILE){napi_value cap=capability(env,&w->file->box,&file_tag);if(!cap)return NULL;result=js_object(env);set(env,result,"capability",cap);set(env,result,"observation",file_observation(env,w->file,&w->observed));return result;}if(w->op==STAT_FILE)return file_observation(env,w->file,&w->observed);if(w->op==READ_FILE){void *out;napi_value buffer;if(napi_create_arraybuffer(env,w->length,&out,&buffer)!=napi_ok)return NULL;if(w->length)memcpy(out,w->bytes,w->length);if(napi_create_typedarray(env,napi_uint8_array,w->length,buffer,0,&result)!=napi_ok)return NULL;return result;}if(w->op==REMOVE_FILE||w->op==PUBLISH_FILE){result=js_object(env);set(env,result,"identity",js_id(env,w->expected));if(w->op==REMOVE_FILE)set(env,result,"removed",js_bool(env,true));else{set(env,result,"fileId",js_string(env,w->name));set(env,result,"exclusive",js_bool(env,true));set(env,result,"temporaryRemoved",js_bool(env,true));}return result;}napi_get_undefined(env,&result);return result;}
static bool recovery_needed(Work *w){
 if(w->op==OPEN_ROOT||w->op==CLOSE_ROOT)return !w->root->closed;
 if(w->op==CREATE||w->op==OPEN_FILE||w->op==CLOSE_FILE)return w->file&&!w->file->closed;
 return false;
}
/* 원 작업의 효과 UNKNOWN을 바꾸지 않고 그 작업이 가진 FD만 회수한다. */
static void recovery_execute(napi_env env,void *data){
 (void)env;Work *w=data;Root *r=w->root;
 if(w->op==OPEN_ROOT||w->op==CLOSE_ROOT){
  bool certain=!r->fd_unknown;
  for(File *f=r->files;f;f=f->next)if(!f->closed||f->fd_unknown)certain=false;
  if(!close_root_fds(r)){certain=false;r->fd_unknown=true;}
  r->closed=true;
  if(r->claimed)release_root(r,certain);
 }else{
  File *f=w->file;
  if(!close_once(&f->fd)){f->fd_unknown=true;r->fd_unknown=true;}
  release_file_reservation(f);f->closed=true;
 }
}
static void free_work_memory(Work *w,napi_env env){
 Env *e=w->env;size_t charged=w->charged;
 if(w->bytes){erase(w->bytes,w->op==READ_FILE?w->max:w->length);free(w->bytes);}
 free(w);uncharge(e,env,charged);
}
static void finish(Work *w){
 Env *e=w->env;Root *r=w->root;napi_env env=e->napi;e->references++;
 if(w->op==OPEN_ROOT&&w->error&&!r->box.wrapped)r->box.gc=true;
 if((w->op==CREATE||w->op==OPEN_FILE)&&w->error&&!w->file->box.wrapped)w->file->box.gc=true;
 if(w->async)napi_delete_async_work(env,w->async);
 if(w->recovery)napi_delete_async_work(env,w->recovery);
 r->head=w->next;if(!r->head)r->tail=NULL;
 e->works--;release(&work_count);
 /* negative external-memory adjustment 중 finalizer가 와도 root는 아직 busy다. */
 free_work_memory(w,env);r->busy=false;
 pump(r);prune(e,env);maybe_cleanup(e);
 e->references--;free_env(e,env);
}
static void recovery_complete(napi_env env,napi_status status,void *data){
 Work *w=data;
 if(status!=napi_ok){
  /* 취소/queue 거절은 execute 미실행인 경우다. 숫자 FD 재시도가 아니다. */
  if(recovery_needed(w))recovery_execute(NULL,w);
 }
 if(!w->env->stopping&&w->deferred){clear_exception(env);napi_reject_deferred(env,w->deferred,error_value(env,"RESOURCE_STATE_UNKNOWN"));}
 finish(w);
}
static void complete(napi_env env,napi_status status,void *data){
 Work *w=data;Env *e=w->env;Root *r=w->root;
 if(status!=napi_ok&&!w->error){w->error="RESOURCE_STATE_UNKNOWN";r->unknown=true;}
 if(!e->stopping&&w->deferred&&!w->error){
  napi_value value=outcome(env,w);bool pending=false;napi_is_exception_pending(env,&pending);
  if(!value||pending||napi_resolve_deferred(env,w->deferred,value)!=napi_ok){
   clear_exception(env);w->error="RESOURCE_STATE_UNKNOWN";r->unknown=true;
  }else w->deferred=NULL;
 }
 /* teardown에서 반환되지 않은 신규 capability도 환경 종료까지 방치하지 않는다. */
 if(e->stopping&&(w->op==OPEN_ROOT||w->op==CREATE||w->op==OPEN_FILE)&&!w->error)w->error="RESOURCE_STATE_UNKNOWN";
 if(w->error&&recovery_needed(w)){
  if(w->async){napi_delete_async_work(env,w->async);w->async=NULL;}
  if(w->recovery&&napi_queue_async_work(env,w->recovery)==napi_ok)return;
  /* 회수 큐 고장 최후 경로: 열린 자기 FD의 close만 단발 수행한다. */
  recovery_execute(NULL,w);recovery_complete(env,napi_ok,w);return;
 }
 if(!e->stopping&&w->deferred&&w->error)napi_reject_deferred(env,w->deferred,error_value(env,w->error));
 finish(w);
}
static void pump(Root *r){
 if(r->busy||!r->head)return;
 r->busy=true;Work *w=r->head;
 /* CLOSE 준비 실패도 이 FIFO head까지 기다린다. 선행 worker와 FD를 경합하지 않는다. */
 if(!w->async||napi_queue_async_work(w->env->napi,w->async)!=napi_ok){
  w->error="RESOURCE_STATE_UNKNOWN";complete(w->env->napi,napi_generic_failure,w);
 }
}
static void append(Work *w){Root *r=w->root;if(r->tail)r->tail->next=w;else r->head=w;r->tail=w;w->env->works++;pump(r);}
static void cleanup_execute(napi_env env,void *data){(void)env;Env *e=data;for(Root *r=e->roots;r;r=r->next){bool certain=!r->fd_unknown;for(File *f=r->files;f;f=f->next){if(!close_once(&f->fd)){f->unknown=true;f->fd_unknown=true;certain=false;}if(f->fd_unknown)certain=false;release_file_reservation(f);f->closed=true;}if(!close_root_fds(r))certain=false;r->closed=true;if(r->claimed)release_root(r,certain);}}
static void cleanup_complete(napi_env env,napi_status status,void *data){(void)status;Env *e=data;e->cleanup_done=true;napi_delete_async_work(env,e->cleanup);e->cleanup=NULL;napi_async_cleanup_hook_handle hook=e->hook;e->hook=NULL;napi_remove_async_cleanup_hook(hook);e->references--;prune(e,env);free_env(e,env);}
static void maybe_cleanup(Env *e){if(!e->stopping||e->works||e->cleanup_queued)return;e->cleanup_queued=true;if(napi_queue_async_work(e->napi,e->cleanup)!=napi_ok){/* 신규 JS 값 없이 자기 FD를 단발 회수하는 마지막 실패 경로. */cleanup_execute(NULL,e);cleanup_complete(e->napi,napi_generic_failure,e);}}
static void cleanup_hook(napi_async_cleanup_hook_handle hook,void *data){Env *e=data;e->hook=hook;e->stopping=true;maybe_cleanup(e);}
static File *new_file(Env *e,Root *r,bool created){
 if(!reserve(&file_reservations,FILE_MAX))return NULL;
 File *f=calloc(1,sizeof *f);
 if(!f){release(&file_reservations);return NULL;}
 f->box=(Box){TAG_FILE,true,false,e,0};f->root=r;f->fd=-1;f->created=created;f->reserved=true;f->generation=generation();
 if(!f->generation||!charge(e,sizeof *f)){release_file_reservation(f);free(f);return NULL;}
 f->box.charged=sizeof *f;f->next=r->files;r->files=f;return f;
}
static Root *new_root(Env *e,Port *p,const Slot *slot){
 Root *r=calloc(1,sizeof *r);if(!r)return NULL;
 r->box=(Box){TAG_ROOT,true,false,e,0};r->port=p;r->slot=*slot;
 for(size_t i=0;i<=DEPTH_MAX;i++)r->fds[i]=-1;
 r->generation=generation();
 if(!r->generation||!charge(e,sizeof *r)){free(r);return NULL;}
 r->box.charged=sizeof *r;r->next=e->roots;e->roots=r;return r;
}
static bool copy_bytes(napi_env env,napi_value v,unsigned char **out,size_t *length){bool typed=false,arraybuffer=false;napi_typedarray_type type;void *raw;size_t n,offset;napi_value buffer;if(napi_is_typedarray(env,v,&typed)!=napi_ok||!typed||napi_get_typedarray_info(env,v,&type,&n,&raw,&buffer,&offset)!=napi_ok||type!=napi_uint8_array||n<1||n>BYTE_MAX||!raw||napi_is_arraybuffer(env,buffer,&arraybuffer)!=napi_ok||!arraybuffer)return false;*out=malloc(n);if(!*out)return false;memcpy(*out,raw,n);*length=n;return true;}
static napi_value saved_promise(napi_env env,napi_ref ref){napi_value p;if(!ref||napi_get_reference_value(env,ref,&p)!=napi_ok)return reject(env,"RESOURCE_STATE_UNKNOWN");return p;}
static napi_value operation(napi_env env,napi_callback_info info){napi_value args[8],self;size_t argc=8;void *data=NULL;if(napi_get_cb_info(env,info,&argc,args,&self,&data)!=napi_ok)return reject(env,"INPUT_INVALID");Op op=(Op)(uintptr_t)data;Port *p=(Port*)unwrap(env,self,&port_tag,TAG_PORT);if(!p)return reject(env,"RESOURCE_UNVERIFIED");Env *e=p->box.env;if(e->stopping)return reject(env,"RESOURCE_UNVERIFIED");if(e->accounting_fault&&op!=CLOSE_FILE&&op!=CLOSE_ROOT)return reject(env,"RESOURCE_STATE_UNKNOWN");size_t wanted=op==OPEN_ROOT||op==INSPECT||op==SYNC_PARENT||op==CLOSE_ROOT?1:op==CREATE||op==STAT_FILE||op==SYNC_FILE||op==CLOSE_FILE?2:op==OPEN_FILE||op==READ_FILE||op==REMOVE_FILE?3:4;if(argc!=wanted)return reject(env,"INPUT_INVALID");
 Root *r=NULL;File *f=NULL;Binding binding;const Slot *slot=NULL;unsigned char *copied=NULL;size_t length=0,max=0;char name[37]={0};Identity expected={0};const char *error="INPUT_INVALID";
 if(op==OPEN_ROOT){if(!read_binding(env,args[0],&binding))goto bad;for(size_t i=0;i<p->count;i++)if(equal_binding(&binding,&p->slots[i].binding)){slot=&p->slots[i];break;}if(!slot){error="RESOURCE_UNVERIFIED";goto bad;}}
 else {r=(Root*)unwrap(env,args[0],&root_tag,TAG_ROOT);if(!r||r->port!=p){error="RESOURCE_UNVERIFIED";goto bad;}if(op==CLOSE_ROOT&&r->close_promise)return saved_promise(env,r->close_promise);
  if(op==STAT_FILE||op==READ_FILE||op==SYNC_FILE||op==REMOVE_FILE||op==PUBLISH_FILE||op==CLOSE_FILE){f=(File*)unwrap(env,args[1],&file_tag,TAG_FILE);if(!f||f->root!=r){error="RESOURCE_UNVERIFIED";goto bad;}if(op==CLOSE_FILE&&f->close_promise)return saved_promise(env,f->close_promise);if(op==CLOSE_FILE&&f->closing){error="RESOURCE_STATE_UNKNOWN";goto bad;}if(op!=CLOSE_FILE&&(f->closing||f->closed||f->terminal==1||f->terminal==2||f->unknown)){error=f->unknown?"RESOURCE_STATE_UNKNOWN":"RESOURCE_UNVERIFIED";goto bad;}}
  if(r->closed||r->closing){error="RESOURCE_UNVERIFIED";goto bad;}if(r->unknown&&op!=CLOSE_FILE&&op!=CLOSE_ROOT){error="RESOURCE_STATE_UNKNOWN";goto bad;}
 }
 if(op==CREATE){const char *k[]={"fileId","bytes","exclusive","noFollow","mode"};uint64_t mode;napi_value value;if(!keys(env,args[1],k,5)||!text_prop(env,args[1],"fileId",name,sizeof name)||!uuid(name)||!truth(env,args[1],"exclusive")||!truth(env,args[1],"noFollow")||!number_prop(env,args[1],"mode",0600,0600,&mode)||!prop(env,args[1],"bytes",&value)||!copy_bytes(env,value,&copied,&length))goto bad;}
 if(op==OPEN_FILE){const char *k[]={"noFollow"};if(!string(env,args[1],name,sizeof name)||!uuid(name)||!keys(env,args[2],k,1)||!truth(env,args[2],"noFollow"))goto bad;}
 if(op==READ_FILE){uint64_t value;if(!number(env,args[2],1,BYTE_MAX+1,&value))goto bad;max=(size_t)value;copied=malloc(max);if(!copied){error="RESOURCE_LIMIT";goto bad;}}
 if(op==REMOVE_FILE||op==PUBLISH_FILE){if(!read_identity(env,args[2],&expected))goto bad;if(!f->created||f->terminal||!id_equal(expected,stat_id(&f->birth))){error="RESOURCE_UNVERIFIED";goto bad;}/* 이미 접수된 file 작업이 끝나기 전 terminal mutation은 받지 않는다. */for(Work *x=r->head;x;x=x->next)if(x->file==f){error="RESOURCE_PROCESSING";goto bad;}}
 if(op==PUBLISH_FILE){const char *k[]={"fileId","exclusive","noFollow"};if(strcmp(r->slot.binding.purpose,"KEY_VAULT")||!keys(env,args[3],k,3)||!text_prop(env,args[3],"fileId",name,sizeof name)||!uuid(name)||!truth(env,args[3],"exclusive")||!truth(env,args[3],"noFollow"))goto bad;}
 if(op==CLOSE_ROOT){for(File *x=r->files;x;x=x->next)if(!x->closed){error="RESOURCE_PROCESSING";goto bad;}}
 if(!reserve(&work_count,WORK_MAX)){error="RESOURCE_LIMIT";goto bad;}Work *w=calloc(1,sizeof *w);if(!w){release(&work_count);error="RESOURCE_LIMIT";goto bad;}
 w->env=e;w->op=op;w->bytes=copied;w->length=length;w->max=max;
 size_t work_bytes=sizeof *w+(op==READ_FILE?max:length);
 if(!charge(e,work_bytes)){free_work_memory(w,env);copied=NULL;release(&work_count);error="RESOURCE_STATE_UNKNOWN";goto bad;}
 w->charged=work_bytes;
 if(op==OPEN_ROOT){r=new_root(e,p,slot);if(!r){free_work_memory(w,env);copied=NULL;release(&work_count);error="RESOURCE_LIMIT";goto bad;}if(!claim_root(r)){r->closed=true;free_work_memory(w,env);copied=NULL;release(&work_count);prune(e,env);error="RESOURCE_PROCESSING";goto bad;}}
 if(op==CREATE||op==OPEN_FILE){f=new_file(e,r,op==CREATE);if(!f){free_work_memory(w,env);copied=NULL;release(&work_count);error="RESOURCE_LIMIT";goto bad;}}
 w->env=e;w->root=r;w->file=f;w->op=op;w->bytes=copied;w->length=length;w->max=max;w->expected=expected;strcpy(w->name,name);napi_value promise;
 bool needs_recovery=op==OPEN_ROOT||op==CREATE||op==OPEN_FILE||op==CLOSE_FILE||op==CLOSE_ROOT;
 bool promise_ready=napi_create_promise(env,&w->deferred,&promise)==napi_ok;
 bool prepared=promise_ready&&napi_create_async_work(env,NULL,js_string(env,"FN16_FILE_PORT"),execute,complete,w,&w->async)==napi_ok&&(!needs_recovery||napi_create_async_work(env,NULL,js_string(env,"FN16_OWNED_FD_CLOSE"),recovery_execute,recovery_complete,w,&w->recovery)==napi_ok);
 if(!prepared){
  clear_exception(env);
  if(op==CLOSE_FILE||op==CLOSE_ROOT){
   /* Work의 메모리/상한은 이미 확보됐다. Promise가 없어도 회수 예약은 잃지 않는다. */
   w->error="RESOURCE_STATE_UNKNOWN";
   if(!promise_ready)w->deferred=NULL;
   if(op==CLOSE_FILE)f->closing=true;else r->closing=true;
   if(promise_ready){
    napi_ref ref=NULL;
    if(napi_create_reference(env,promise,1,&ref)==napi_ok){if(op==CLOSE_FILE)f->close_promise=ref;else r->close_promise=ref;}
    else clear_exception(env);
   }
   copied=NULL;append(w);
   return promise_ready?promise:reject(env,"RESOURCE_STATE_UNKNOWN");
  }
  if(w->async)napi_delete_async_work(env,w->async);
  if(w->recovery)napi_delete_async_work(env,w->recovery);
  if(op==OPEN_ROOT){r->closed=true;if(r->claimed)release_root(r,true);}
  if(op==CREATE||op==OPEN_FILE){f->closed=true;release_file_reservation(f);}
  free_work_memory(w,env);copied=NULL;release(&work_count);prune(e,env);error="RESOURCE_STATE_UNKNOWN";goto bad;
 }
 if(op==CLOSE_FILE||op==CLOSE_ROOT){napi_ref ref;if(napi_create_reference(env,promise,1,&ref)!=napi_ok){clear_exception(env);w->error="RESOURCE_STATE_UNKNOWN";if(op==CLOSE_FILE)f->closing=true;else r->closing=true;copied=NULL;append(w);return promise;}if(op==CLOSE_FILE){f->closing=true;f->close_promise=ref;}else{r->closing=true;r->close_promise=ref;}}
 if(op==REMOVE_FILE||op==PUBLISH_FILE)f->terminal=1;copied=NULL;append(w);return promise;
 bad:if(copied){erase(copied,op==READ_FILE?max:length);free(copied);}return reject(env,error);
}
static napi_value factory(napi_env env,napi_callback_info info){napi_value args[2];size_t argc=2;void *data=NULL;if(napi_get_cb_info(env,info,&argc,args,NULL,&data)!=napi_ok)return NULL;Env *e=data;const char *error="INPUT_INVALID";Port *p=NULL;if(e->stopping){error="RESOURCE_UNVERIFIED";goto bad;}if(e->accounting_fault){error="RESOURCE_STATE_UNKNOWN";goto bad;}const char *keys_top[]={"schemaVersion","installationId","slots"};napi_value slots;uint64_t schema;char installation[37];bool arr=false;uint32_t n;if(argc!=1||!keys(env,args[0],keys_top,3)||!number_prop(env,args[0],"schemaVersion",1,1,&schema)||!text_prop(env,args[0],"installationId",installation,sizeof installation)||!uuid(installation)||!prop(env,args[0],"slots",&slots)||napi_is_array(env,slots,&arr)!=napi_ok||!arr||napi_get_array_length(env,slots,&n)!=napi_ok||n<1||n>SLOT_MAX)goto bad;
 p=calloc(1,sizeof *p);if(!p){error="RESOURCE_LIMIT";goto bad;}
 p->slots=calloc(n,sizeof(Slot));if(!p->slots){free(p);p=NULL;error="RESOURCE_LIMIT";goto bad;}
 p->count=n;p->box=(Box){TAG_PORT,true,false,e,0};
 size_t port_bytes=sizeof *p+n*sizeof(Slot);
 if(!charge(e,port_bytes)){error="RESOURCE_STATE_UNKNOWN";goto bad;}p->box.charged=port_bytes;
 for(uint32_t i=0;i<n;i++){const char *sk[]={"binding","absoluteRoot"};napi_value entry,binding;if(napi_get_element(env,slots,i,&entry)!=napi_ok||!keys(env,entry,sk,2)||!prop(env,entry,"binding",&binding)||!read_binding(env,binding,&p->slots[i].binding)||strcmp(p->slots[i].binding.installation,installation)||!text_prop(env,entry,"absoluteRoot",p->slots[i].path,sizeof p->slots[i].path)||!path_valid(p->slots[i].path))goto bad;for(uint32_t j=0;j<i;j++)if(!strcmp(p->slots[i].binding.slot,p->slots[j].binding.slot)||id_equal(p->slots[i].binding.expected,p->slots[j].binding.expected)||!strcmp(p->slots[i].path,p->slots[j].path))goto bad;}
 napi_value result=capability(env,&p->box,&port_tag);if(!result){error="RESOURCE_STATE_UNKNOWN";goto bad;}p->next=e->ports;e->ports=p;
 const char *names[]={"openRoot","inspectRoot","create","open","stat","read","sync","remove","publish","fsyncParent","closeFile","closeRoot"};napi_property_descriptor properties[12];memset(properties,0,sizeof properties);for(size_t i=0;i<12;i++){properties[i].utf8name=names[i];properties[i].method=operation;properties[i].attributes=napi_enumerable;properties[i].data=(void*)(uintptr_t)i;}if(napi_define_properties(env,result,12,properties)!=napi_ok){clear_exception(env);napi_throw(env,error_value(env,"RESOURCE_STATE_UNKNOWN"));return NULL;}return result;
 bad:if(p){erase(p->slots,sizeof(Slot)*p->count);free(p->slots);size_t charged=p->box.charged;free(p);uncharge(e,env,charged);}clear_exception(env);napi_throw(env,error_value(env,error));return NULL;
}
NAPI_MODULE_INIT(){
#if !defined(__linux__) || !defined(__x86_64__)
 napi_throw(env,error_value(env,"RESOURCE_UNVERIFIED"));return NULL;
#else
 uint32_t version=0;const napi_node_version *node=NULL;if(napi_get_version(env,&version)!=napi_ok||version<8||napi_get_node_version(env,&node)!=napi_ok||!node||node->major!=24||node->minor<18){napi_throw(env,error_value(env,"RESOURCE_UNVERIFIED"));return NULL;}
 Env *e=calloc(1,sizeof *e);if(!e){napi_throw(env,error_value(env,"RESOURCE_LIMIT"));return NULL;}e->napi=env;e->references=1;if(!charge(e,sizeof *e)){free(e);napi_throw(env,error_value(env,"RESOURCE_STATE_UNKNOWN"));return NULL;}
 if(napi_create_async_work(env,NULL,js_string(env,"FN16_ENV_CLOSE"),cleanup_execute,cleanup_complete,e,&e->cleanup)!=napi_ok){uncharge(e,env,sizeof *e);free(e);napi_throw(env,error_value(env,"RESOURCE_STATE_UNKNOWN"));return NULL;}
 if(napi_add_async_cleanup_hook(env,cleanup_hook,e,&e->hook)!=napi_ok){napi_delete_async_work(env,e->cleanup);uncharge(e,env,sizeof *e);free(e);napi_throw(env,error_value(env,"RESOURCE_STATE_UNKNOWN"));return NULL;}
 napi_value fn;if(napi_create_function(env,"createInstallationResourceNativePort",NAPI_AUTO_LENGTH,factory,e,&fn)!=napi_ok){napi_throw(env,error_value(env,"RESOURCE_STATE_UNKNOWN"));return NULL;}if(napi_add_finalizer(env,fn,e,factory_finalizer,NULL,NULL)!=napi_ok){napi_throw(env,error_value(env,"RESOURCE_STATE_UNKNOWN"));return NULL;}e->references++;set(env,exports,"createInstallationResourceNativePort",fn);return exports;
#endif
}
