"""Manual external verifier interchange; never connects to a provider.

Constructor and capture_import are host-only capabilities. Manual provenance is
an observation, not cryptographic provider authentication or Main acceptance.
Bundle bytes are returned to the caller; this module never writes/transmits them.
"""
from __future__ import annotations

import base64
import copy
import json
import re
import unicodedata
from dataclasses import dataclass,field
from datetime import datetime
from functools import wraps
from threading import RLock
from urllib.parse import unquote_plus

from packages.knowledge.sources import _scan_body_credentials
from packages.orchestration.result_envelope import ResultEnvelope,validate_result
from .handoff import RoleHandoffService,_bytes_hash,_id
from .role_contracts import contract_hash,_utc

BACKENDS={"CLAUDE":"ANTHROPIC","CODEX":"OPENAI","LOCAL":"OLLAMA"}
MAX_BUNDLE_BYTES=2*1024*1024


class ExternalVerificationError(ValueError):
    pass


def _guard(method):
    @wraps(method)
    def wrapped(*args,**kwargs):
        try:return method(*args,**kwargs)
        except ExternalVerificationError:raise
        except (ValueError,TypeError,KeyError,AttributeError,RecursionError,OverflowError,StopIteration):
            raise ExternalVerificationError("EXTERNAL_VERIFICATION_DENIED") from None
    return wrapped


def _inspection_step(value):
    value=unicodedata.normalize("NFKC",value)
    value=re.sub(r"\\(?:u([0-9a-fA-F]{4})|([tnr]))",lambda m:chr(int(m[1],16)) if m[1] else {"t":"\t","n":"\n","r":"\r"}[m[2]],value)
    value=unicodedata.normalize("NFKC",unquote_plus(value))
    if any(unicodedata.category(c)=="Cf" for c in value):raise ExternalVerificationError("UNSAFE_FORMAT_CONTROL")
    return value


def _inspection(value):
    # Inspection only: never change exported bytes or their canonical hashes.
    # Normalize mapping keys together with their values, preserving D03's
    # credential semantics (including empty values) instead of a new blacklist.
    if type(value) is str:
        # Normalization can expose escapes, and decoding can expose compatibility
        # characters again. Require a fixed point within four decoding rounds.
        for _ in range(4):
            checked=_inspection_step(value)
            if checked==value:return value
            value=checked
        if _inspection_step(value)!=value:raise ExternalVerificationError("UNSAFE_ENCODING_DEPTH")
        return value
    if type(value) is dict:
        result={}
        for k,v in value.items():
            key=_inspection(k)
            if key in result:raise ExternalVerificationError("NORMALIZED_KEY_COLLISION")
            result[key]=_inspection(v)
        return result
    if type(value) in (list,tuple):return [_inspection(v) for v in value]
    return value


def _safe(value):
    _scan_body_credentials(_inspection(value))


def _dump(value):
    raw=json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
    if len(raw)>MAX_BUNDLE_BYTES:raise ExternalVerificationError("BUNDLE_TOO_LARGE")
    return raw


def _json(raw):
    if type(raw) is not bytes or not raw or len(raw)>MAX_BUNDLE_BYTES:raise ExternalVerificationError("BUNDLE_BYTES_INVALID")
    def pairs(items):
        out={}
        for k,v in items:
            if k in out:raise ExternalVerificationError("DUPLICATE_FIELD")
            out[k]=v
        return out
    def invalid(value):raise ExternalVerificationError("JSON_INVALID")
    value=json.loads(raw.decode("utf-8"),object_pairs_hook=pairs,parse_constant=invalid)
    if type(value) is not dict:raise ExternalVerificationError("SCHEMA_INVALID")
    _safe(value)
    return value


def _artifact(ident,raw,media):
    _id(ident)
    if media not in {"text/plain","application/json"} or type(raw) is not bytes:raise ExternalVerificationError("ARTIFACT_INVALID")
    if media=="application/json":_json(raw)
    else:_safe(raw.decode("utf-8"))
    return {"artifact_id":ident,"checksum":_bytes_hash(raw),"byte_size":len(raw),"media_type":media,"data_base64":base64.b64encode(raw).decode()}


def _artifacts(rows):
    if type(rows) is not list or not 1<=len(rows)<=64:raise ExternalVerificationError("ARTIFACT_SET_INVALID")
    out={}
    for row in rows:
        if type(row) is not dict or set(row)!={"artifact_id","checksum","byte_size","media_type","data_base64"}:raise ExternalVerificationError("ARTIFACT_INVALID")
        raw=base64.b64decode(row["data_base64"],validate=True)
        checked=_artifact(row["artifact_id"],raw,row["media_type"])
        if checked!=row or type(row["byte_size"]) is not int or row["artifact_id"] in out:raise ExternalVerificationError("ARTIFACT_INTEGRITY")
        out[row["artifact_id"]]=raw
    return out


@dataclass(frozen=True,slots=True)
class ManualImportAuthorization:
    authorization_id:str
    bundle_id:str
    bundle_hash:str
    response_hash:str
    assignment_id:str
    assignment_hash:str
    execution_fence:str
    issued_at:datetime
    expires_at:datetime
    content_hash:str=field(init=False)

    def __post_init__(self):object.__setattr__(self,"content_hash",contract_hash(self))


class ExternalVerifierAdapter:
    @_guard
    def __init__(self,handoffs,*,design_bytes,design_hash,requirements,native_backend):
        if type(handoffs) is not RoleHandoffService:raise ExternalVerificationError("HOST_AUTHORITY_REQUIRED")
        if type(design_bytes) is not bytes or _bytes_hash(design_bytes)!=design_hash or len(design_bytes)>MAX_BUNDLE_BYTES:
            raise ExternalVerificationError("DESIGN_AUTHORITY_INVALID")
        if native_backend not in BACKENDS:raise ExternalVerificationError("BACKEND_INVALID")
        text=design_bytes.decode("utf-8");_safe(text)
        if type(requirements) is not tuple or not 1<=len(requirements)<=64:raise ExternalVerificationError("REQUIREMENTS_REQUIRED")
        entries=[]
        for row in requirements:
            if type(row) is not dict or set(row)!={"validation_id","severity","clause","quote"}:raise ExternalVerificationError("REQUIREMENT_INVALID")
            row=copy.deepcopy(row);_id(row["validation_id"])
            if row["severity"] not in {"CRITICAL","MAJOR","MINOR"}:raise ExternalVerificationError("REQUIREMENT_INVALID")
            if row["severity"]=="CRITICAL" or row["quote"] is not None or row["clause"] is not None:
                if type(row["clause"]) is not str or type(row["quote"]) is not str:raise ExternalVerificationError("CRITICAL_CITATION_REQUIRED")
                matches=list(re.finditer(r"(?m)^(#{1,6}) +"+re.escape(row["clause"])+r"(?: |$).*",text))
                if len(matches)!=1:raise ExternalVerificationError("CLAUSE_INVALID")
                match=matches[0];next_heading=re.search(r"(?m)^#{1,"+str(len(match[1]))+r"} +",text[match.end():])
                end=match.end()+next_heading.start() if next_heading else len(text)
                if row["quote"]!=text[match.start():end].strip() or len(row["quote"].encode())>65536:raise ExternalVerificationError("QUOTE_MISMATCH")
                row["quote_hash"]=_bytes_hash(row["quote"].encode())
            else:row["quote_hash"]=None
            _safe(row);entries.append(row)
        if len({r["validation_id"] for r in entries})!=len(entries):raise ExternalVerificationError("REQUIREMENT_DUPLICATE")
        self._handoffs=handoffs;self._requirements=_dump(entries);self._design_hash=design_hash;self._backend=native_backend
        self._bundles={};self._seals={};self._authorizations={};self._authorization_seals={};self._imports={};self._lock=RLock()

    @property
    def import_count(self):return len(self._imports)

    @property
    def authorization_count(self):return len(self._authorizations)

    def _source_packet(self,handoff,source):
        if (handoff.stage,source.role)==("DEVELOPER_TO_REVIEWER","DEVELOPER"):
            packet=self._handoffs._packet
        elif (handoff.stage,source.role)==("REVIEWER_TO_TESTER","REVIEWER"):
            packet=source.assignment.packet
        else:raise ExternalVerificationError("SOURCE_ROLE_MISMATCH")
        if source.result.delegation_id!=packet.delegation_id:raise ExternalVerificationError("SOURCE_PACKET_MISMATCH")
        return packet

    def _handoff_fence(self,value,auth):
        """Pure final authority fence: no adapter calls, audit or budget writes."""
        h=self._handoffs._handoffs[value["handoff_id"]]
        if h.content_hash!=value["handoff_hash"] or contract_hash(h)!=h.content_hash or self._handoffs._handoff_seals.get(h.handoff_id)!=h.content_hash:
            raise ExternalVerificationError("HANDOFF_DRIFT")
        a=self._handoffs._assignment(h.recipient_assignment_id,**auth)
        if a.content_hash!=h.recipient_assignment_hash or a.content_hash!=value["assignment_hash"] or not h.issued_at<=auth["now"]<h.expires_at:
            raise ExternalVerificationError("HANDOFF_STALE")
        s=self._handoffs._sources[h.source_id]
        if s.content_hash!=h.source_hash or contract_hash(s.manifest)!=value["manifest_hash"]:raise ExternalVerificationError("SOURCE_DRIFT")
        self._handoffs._source_fence(s,auth["now"])
        if h.stage=="REVIEWER_TO_TESTER":self._handoffs._predecessor(h.predecessor_id,h.predecessor_hash,s,auth["now"])
        p=self._source_packet(h,s)
        if (value["source_role"]!=s.role or value["source_packet_hash"]!=p.packet_hash or value["packet"]!=p.to_dict()
            or value["source_result_hash"]!=contract_hash(s.result) or value["native_result"]!=s.result.to_dict()):
            raise ExternalVerificationError("SOURCE_PROVENANCE_MISMATCH")

    def _bundle_fence(self,bundle_id,raw,seal,auth):
        if self._bundles.get(bundle_id)!=raw or self._seals.get(bundle_id)!=seal or _bytes_hash(raw)!=seal:
            raise ExternalVerificationError("BUNDLE_UNKNOWN_OR_TAMPERED")
        value=_json(raw)
        _artifacts(value["artifacts"])
        if not datetime.fromisoformat(value["issued_at"])<=auth["now"]<datetime.fromisoformat(value["expires_at"]):raise ExternalVerificationError("BUNDLE_STALE")
        self._handoff_fence(value,auth)
        return value

    def _current(self,bundle_id,auth):
        _id(bundle_id);_utc(auth["now"])
        raw=self._bundles.get(bundle_id)
        seal=self._seals.get(bundle_id)
        if raw is None or _bytes_hash(raw)!=seal:raise ExternalVerificationError("BUNDLE_UNKNOWN_OR_TAMPERED")
        value=_json(raw)
        view=self._handoffs.project(value["handoff_id"],**auth)
        if view["hash"]!=value["handoff_hash"] or not datetime.fromisoformat(value["issued_at"])<=auth["now"]<datetime.fromisoformat(value["expires_at"]):
            raise ExternalVerificationError("BUNDLE_STALE")
        return self._bundle_fence(bundle_id,raw,seal,auth)

    @_guard
    def export_bundle(self,*,bundle_id,handoff_id,expires_at,**auth):
        with self._lock:
            _id(bundle_id);_utc(expires_at)
            view=self._handoffs.project(handoff_id,**auth)
            handoff=self._handoffs._handoffs[handoff_id]
            if not auth["now"]<expires_at<=handoff.expires_at:raise ExternalVerificationError("BUNDLE_STALE")
            source=self._handoffs._sources[handoff.source_id]
            packet=self._source_packet(handoff,source)
            rows=[]
            for ref in view["artifact_refs"]:
                raw=self._handoffs.resolve(handoff_id,ref["artifact_id"],**auth)
                row=_artifact(ref["artifact_id"],raw,ref["media_type"])
                if {k:v for k,v in row.items() if k!="data_base64"}!=ref:raise ExternalVerificationError("ARTIFACT_INTEGRITY")
                rows.append(row)
            value={"schema_version":"external_verification_bundle/v1","bundle_id":bundle_id,"handoff_id":handoff_id,"handoff_hash":handoff.content_hash,
                "target_hash":handoff.target_hash,"baseline_hash":handoff.baseline_hash,"manifest_hash":handoff.manifest_hash,
                "environment_id":handoff.environment_id,"toolchain_versions":dict(handoff.toolchain_versions),
                "assignment_id":handoff.recipient_assignment_id,"assignment_hash":handoff.recipient_assignment_hash,
                "source_role":source.role,"source_packet_hash":packet.packet_hash,"source_result_hash":contract_hash(source.result),
                "packet":packet.to_dict(),"native_result":source.result.to_dict(),"native_backend":self._backend,
                "provider":BACKENDS[self._backend],"design_document_hash":self._design_hash,"requirements":json.loads(self._requirements),
                "artifacts":rows,"issued_at":auth["now"].isoformat(),"expires_at":expires_at.isoformat(),
                "limitations":["MANUAL_ONLY","PROVIDER_AUTHENTICITY_UNVERIFIED","NO_AUTOMATIC_CONNECTION","NO_MAIN_ACCEPTANCE"]}
            if bundle_id in self._bundles:value["issued_at"]=self._current(bundle_id,auth)["issued_at"]
            _safe({k:v for k,v in value.items() if k!="artifacts"});raw=_dump(value)
            if bundle_id in self._bundles and raw!=self._bundles[bundle_id]:raise ExternalVerificationError("BUNDLE_REBIND")
            if self._handoffs.project(handoff_id,**auth)["hash"]!=value["handoff_hash"]:raise ExternalVerificationError("HANDOFF_DRIFT")
            self._handoff_fence(value,auth)
            if bundle_id in self._bundles:self._bundle_fence(bundle_id,raw,_bytes_hash(raw),auth)
            self._bundles[bundle_id]=raw;self._seals[bundle_id]=_bytes_hash(raw)
            return raw

    def _response(self,bundle,data,auth):
        value=_json(data)
        fields={"schema_version","bundle_id","bundle_hash","target_hash","assignment_hash","native_backend","provider","verifier","limitations","result","artifacts"}
        if set(value)!=fields or value["schema_version"]!="external_verification_response/v1":raise ExternalVerificationError("RESPONSE_SCHEMA_INVALID")
        for name in ("bundle_id","target_hash","assignment_hash","native_backend"):
            if value[name]!=bundle[name]:raise ExternalVerificationError("RESPONSE_BINDING_MISMATCH")
        # Source backend and manual external verifier are different identities.
        # E03 supports manual Claude review of any of the three native backends.
        if value["provider"]!="ANTHROPIC":raise ExternalVerificationError("VERIFIER_PROVIDER_INVALID")
        if value["bundle_hash"]!=self._seals[bundle["bundle_id"]]:raise ExternalVerificationError("RESPONSE_BINDING_MISMATCH")
        a=self._handoffs._assignment(bundle["assignment_id"],**auth)
        if value["verifier"]!={"actor_id":a.actor_id,"context_id":a.context_id,"workspace_id":a.workspace_id}:raise ExternalVerificationError("VERIFIER_AUTHORITY_MISMATCH")
        limits=value["limitations"]
        if type(limits) is not list or not 1<=len(limits)<=16 or any(type(v) is not str or not v.strip() or len(v.encode())>256 for v in limits):raise ExternalVerificationError("LIMITATIONS_REQUIRED")
        checked=validate_result(value["result"])
        if not checked.valid:raise ExternalVerificationError("NATIVE_RESULT_INVALID")
        result=ResultEnvelope.from_dict(value["result"])
        if (result.delegation_id,result.target_hash)!=(a.packet.delegation_id,bundle["target_hash"]):raise ExternalVerificationError("NATIVE_RESULT_BINDING_MISMATCH")
        original=bundle["native_result"]
        if (result.attempt_id,result.attempt_number,result.step_lineage_id)!=(original["attempt_id"],original["attempt_number"],original["step_lineage_id"]):raise ExternalVerificationError("NATIVE_LINEAGE_MISMATCH")
        artifacts=_artifacts(value["artifacts"])
        if not result.evidence_refs or {r.evidence_id:r.checksum for r in result.evidence_refs}!={k:_bytes_hash(v) for k,v in artifacts.items()}:
            raise ExternalVerificationError("NATIVE_EVIDENCE_MISMATCH")
        if set(artifacts)&{r["artifact_id"] for r in bundle["artifacts"]}:raise ExternalVerificationError("ARTIFACT_REBIND")
        if result.changed_paths:raise ExternalVerificationError("READ_ONLY_VERIFIER_REQUIRED")
        return value

    @_guard
    def capture_import(self,*,authorization_id,bundle_id,response_bytes,verifier_assignment_id,now,expires_at):
        """HOST ONLY: attest exact manually received bytes, not actual provider authenticity."""
        with self._lock:
            _id(authorization_id);_utc(now);_utc(expires_at)
            a=self._handoffs._policy.get_assignment(verifier_assignment_id)
            auth=dict(actor_id=a.actor_id,context_id=a.context_id,session_id=a.session_id,target_hash=a.target_hash,execution_fence=a.execution_fence,now=now)
            b=self._current(bundle_id,auth)
            snapshot=self._bundles[bundle_id];seal=self._seals[bundle_id]
            if a.assignment_id!=b["assignment_id"] or not now<expires_at<=min(a.expires_at,datetime.fromisoformat(b["expires_at"])):
                raise ExternalVerificationError("IMPORT_AUTHORITY_INVALID")
            self._response(b,response_bytes,auth)
            proof=ManualImportAuthorization(authorization_id,bundle_id,self._seals[bundle_id],_bytes_hash(response_bytes),a.assignment_id,a.content_hash,a.execution_fence,now,expires_at)
            if authorization_id in self._authorization_seals and self._authorization_seals[authorization_id]!=proof.content_hash:raise ExternalVerificationError("IMPORT_AUTHORITY_REBIND")
            self._current(bundle_id,auth)
            self._bundle_fence(bundle_id,snapshot,seal,auth)
            self._authorizations[authorization_id]=proof;self._authorization_seals[authorization_id]=proof.content_hash
            return copy.deepcopy(proof)

    def _authorization(self,ident,data,now):
        _id(ident);proof=self._authorizations.get(ident)
        if proof is None or contract_hash(proof)!=self._authorization_seals.get(ident) or proof.content_hash!=self._authorization_seals.get(ident):
            raise ExternalVerificationError("IMPORT_AUTHORITY_REQUIRED")
        if not proof.issued_at<=now<proof.expires_at or type(data) is not bytes or _bytes_hash(data)!=proof.response_hash:
            raise ExternalVerificationError("IMPORT_STALE_OR_REPLAY_CONFLICT")
        return copy.deepcopy(proof)

    @_guard
    def import_bundle(self,*,authorization_id,response_bytes,**auth):
        with self._lock:
            proof=self._authorization(authorization_id,response_bytes,auth["now"])
            b=self._current(proof.bundle_id,auth)
            snapshot=self._bundles[proof.bundle_id]
            if (b["assignment_hash"],self._seals[proof.bundle_id],auth["execution_fence"])!=(proof.assignment_hash,proof.bundle_hash,proof.execution_fence):raise ExternalVerificationError("IMPORT_AUTHORITY_MISMATCH")
            value=self._response(b,response_bytes,auth)
            receipt={"status":"IMPORTED_MANUAL_RESULT","bundle_id":proof.bundle_id,"bundle_hash":proof.bundle_hash,"response_hash":proof.response_hash,
                "native_backend":value["native_backend"],"provider":value["provider"],"source":"HOST_OBSERVED_MANUAL_IMPORT",
                "native_provider":b["provider"],"verifier_provider":value["provider"],"verifier_backend":"CLAUDE_MANUAL",
                "provider_authenticity":"UNVERIFIED","declared_status":value["result"]["status"],"limitations":value["limitations"],
                "artifact_refs":[{k:v for k,v in r.items() if k!="data_base64"} for r in value["artifacts"]],"accepted":False,"state_transitions":[]}
            self._current(proof.bundle_id,auth)
            if self._authorization(authorization_id,response_bytes,auth["now"])!=proof:raise ExternalVerificationError("IMPORT_AUTHORITY_DRIFT")
            old=self._imports.get(proof.bundle_id)
            if old is not None and old[0]!=response_bytes:raise ExternalVerificationError("IMPORT_REPLAY_CONFLICT")
            self._bundle_fence(proof.bundle_id,snapshot,proof.bundle_hash,auth)
            self._imports[proof.bundle_id]=(response_bytes,_dump(receipt),authorization_id)
            return copy.deepcopy(receipt)

    @_guard
    def project(self,bundle_id,**auth):
        with self._lock:
            b=self._current(bundle_id,auth)
            return {"bundle_id":bundle_id,"bundle_hash":self._seals[bundle_id],"target_hash":b["target_hash"],"native_backend":b["native_backend"],
                "source":"MANUAL_EXPORT","provider_authenticity":"UNVERIFIED","limitations":b["limitations"],"accepted":False,
                "artifact_refs":[{k:v for k,v in r.items() if k!="data_base64"} for r in b["artifacts"]]}

    @_guard
    def resolve_artifact(self,bundle_id,artifact_id,**auth):
        with self._lock:
            _id(artifact_id);b=self._current(bundle_id,auth);artifacts=_artifacts(b["artifacts"])
            snapshot=self._bundles[bundle_id];seal=self._seals[bundle_id]
            if artifact_id in artifacts:
                current=self._handoffs.resolve(b["handoff_id"],artifact_id,**auth)
                if current!=artifacts[artifact_id]:raise ExternalVerificationError("ARTIFACT_INTEGRITY")
                self._bundle_fence(bundle_id,snapshot,seal,auth)
                return current
            imported=self._imports.get(bundle_id)
            if imported is None:raise ExternalVerificationError("ARTIFACT_NOT_MEMBER")
            self.import_bundle(authorization_id=imported[2],response_bytes=imported[0],**auth)
            artifacts=_artifacts(_json(imported[0])["artifacts"])
            if artifact_id not in artifacts:raise ExternalVerificationError("ARTIFACT_NOT_MEMBER")
            self._bundle_fence(bundle_id,snapshot,seal,auth)
            return artifacts[artifact_id]
