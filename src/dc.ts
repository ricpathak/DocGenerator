import type { APIRequestContext } from 'playwright';
import type { Capture } from './core.ts';

export type JsonGet = (path:string)=>Promise<any>;
export function jiraTarget(value:string){
  const u=new URL(value), m=u.pathname.match(/^(.*)\/browse\/([A-Z][A-Z0-9_]*-\d+)\/?$/i);
  return m?{base:u.origin+m[1],key:m[2]}:null;
}
export function confluenceTarget(value:string, metadataId=''){
  const u=new URL(value), m=u.pathname.match(/^(.*)\/(?:spaces\/|display\/|pages\/)/);
  const id=u.searchParams.get('pageId')||u.pathname.match(/\/pages\/(\d+)/)?.[1]||metadataId;
  return m&&/^\d+$/.test(id)?{base:u.origin+m[1],id}:null;
}
export function sessionGet(request:APIRequestContext, base:string):JsonGet {
  return async(path:string)=>{
    if(!path.startsWith('/rest/'))throw new Error('Only REST paths allowed');
    const response=await request.get(base+path,{maxRedirects:0,timeout:60000,headers:{Accept:'application/json'}});
    try {
      if(!response.ok())throw new Error(`GET ${path}: HTTP ${response.status()} (check login, permissions, endpoint/version)`);
      try{return JSON.parse(await response.text());}catch{throw new Error(`GET ${path}: non-JSON response (possible SSO login page)`);}
    } finally {await response.dispose();}
  };
}
export async function xrayMembers(get:JsonGet,kind:'testset'|'testexec',key:string,max:number){
  const rows:any[]=[], fingerprints=new Set<string>();
  for(let page=1;page<=10000;page++){
    const result=await get(`/rest/raven/1.0/api/${kind}/${encodeURIComponent(key)}/test?limit=50&page=${page}&${kind==='testexec'?'detailed=true':'testDefinition=true'}`);
    if(!Array.isArray(result))throw new Error('Unsupported Xray membership response; expected an array');
    if(!result.length)return {rows,limited:false};
    const fingerprint=JSON.stringify(result);
    if(fingerprints.has(fingerprint))throw new Error('Xray repeated a membership page; pagination may be unsupported');
    fingerprints.add(fingerprint);
    for(const row of result){if(rows.length>=max)return {rows,limited:true};rows.push(row);}
    // Request until an empty page: server may cap the requested page size.
  }
  throw new Error('Xray membership pagination exceeded 10000 pages');
}
export async function confluenceChildren(get:JsonGet,id:string,max:number){
  const rows:any[]=[],seen=new Set<string>();let start=0;
  for(let p=0;p<10000;p++){
    const result=await get(`/rest/api/content/${encodeURIComponent(id)}/child/page?start=${start}&limit=50`);
    if(!Array.isArray(result.results))throw new Error('Unsupported Confluence children response');
    if(!result.results.length)return {rows,limited:false};
    for(const row of result.results){
      if(!row.id||seen.has(String(row.id)))throw new Error('Confluence repeated/malformed child page');
      if(rows.length>=max)return {rows,limited:true};
      seen.add(String(row.id));rows.push(row);
    }
    if(!result._links?.next)return {rows,limited:false};
    start+=result.results.length;
  }
  throw new Error('Confluence children pagination exceeded 10000 pages');
}
export function apiCapture(url:string,title:string,payload:unknown,depth:number):Capture {
  return {url,title,text:JSON.stringify(payload,null,2),headings:[title],tables:[],links:[],frame:'authenticated read-only REST API',depth};
}
export async function collectXray(get:JsonGet,key:string,override:string,max:number){
  const evidence:{label:string;data:unknown}[]=[], errors:string[]=[];
  const issue=await get(`/rest/api/2/issue/${encodeURIComponent(key)}?fields=summary,description,issuetype,issuelinks&expand=names`);
  evidence.push({label:'Jira issue',data:issue});
  const kind=override||({'Test Set':'testset','Test Execution':'testexec','Test':'test'}[issue.fields?.issuetype?.name]||'issue');
  if(!['testset','testexec','test','issue'].includes(kind))throw new Error('Use --xray-kind testset, testexec, test or issue');
  const capture=async(label:string,path:string)=>{try{const data=await get(path);evidence.push({label,data});return data;}catch(e){errors.push(`${label}: ${String(e)}`);}};
  let members:any[]=[];
  if(kind==='testset'||kind==='testexec'){
    try {
      const result=await xrayMembers(get,kind,key,max);members=result.rows;
      evidence.push({label:`${kind} membership with definitions/results`,data:{containerKey:key,...result}});
      if(result.limited)errors.push(`Membership of ${key} stopped at --max-tests=${max}; extraction is partial`);
    }catch(e){errors.push(`Membership unavailable for ${key}: ${String(e)}; use browser evidence`);}
  }else if(kind==='test')members=[{key}];
  for(const member of members){
    const testKey=member.key;
    if(typeof testKey!=='string'||!/^[A-Z][A-Z0-9_]*-\d+$/i.test(testKey)){errors.push('Membership row has no supported test key');continue;}
    await capture(`Test definition ${testKey}`,`/rest/api/2/issue/${testKey}?fields=*all&expand=names`);
    await capture(`Current definition preconditions ${testKey}`,`/rest/raven/1.0/api/test/${testKey}/preconditions`);
    await capture(`Manual steps ${testKey}`,`/rest/raven/1.0/api/test/${testKey}/step`);
    if(kind==='testexec')await capture(`Execution-specific run ${key} / ${testKey}`,`/rest/raven/1.0/api/testrun?testExecIssueKey=${encodeURIComponent(key)}&testIssueKey=${encodeURIComponent(testKey)}`);
  }
  return {evidence,errors,issue};
}
