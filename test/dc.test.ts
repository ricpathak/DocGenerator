import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jiraTarget,confluenceTarget,xrayMembers,confluenceChildren,sessionGet,collectXray} from '../src/dc.ts';
test('DC context paths survive endpoint construction',()=>{
 assert.deepEqual(jiraTarget('https://a.example/jira/browse/UW-1'),{base:'https://a.example/jira',key:'UW-1'});
 assert.deepEqual(confluenceTarget('https://a.example/confluence/display/UW/Flow','42'),{base:'https://a.example/confluence',id:'42'});
});
test('Xray uses one-based pagination and continues past server page cap',async()=>{
 const paths:string[]=[];const result=await xrayMembers(async p=>{paths.push(p);return paths.length<3?[{key:`UW-${paths.length}`}]:[];},'testset','UW-10',10);
 assert.equal(result.rows.length,2);assert.equal(result.limited,false);assert.match(paths[1],/page=2/);
});
test('Xray detects repeated pages and reports explicit item limits',async()=>{
 await assert.rejects(xrayMembers(async()=>[{key:'UW-1'}],'testset','UW-10',10),/repeated/);
 const r=await xrayMembers(async()=>[{key:'UW-1'},{key:'UW-2'}],'testexec','UW-10',1);assert.equal(r.limited,true);assert.equal(r.rows.length,1);
});
test('Confluence uses actual page size for next start',async()=>{
 const paths:string[]=[];const r=await confluenceChildren(async p=>{paths.push(p);return paths.length===1?{results:[{id:'1'}],_links:{next:'/anything'}}:{results:[{id:'2'}]};},'42',10);
 assert.equal(r.rows.length,2);assert.match(paths[1],/start=1/);
});
test('session reader refuses redirects and detects HTML sign-in responses',async()=>{
 let opts:any;let disposed=false;
 const get=sessionGet({get:async(_u:string,o:any)=>{opts=o;return {ok:()=>true,text:async()=>'<html>Login</html>',dispose:async()=>{disposed=true;}};}} as any,'https://a.example/jira');
 await assert.rejects(get('/rest/api/2/issue/UW-1'),/non-JSON/);assert.equal(opts.maxRedirects,0);assert.ok(disposed);
});
test('execution evidence keeps definition separate from run result and preserves fallback errors',async()=>{
 const calls:string[]=[];
 const r=await collectXray(async p=>{calls.push(p);if(p.includes('/issue/UW-10?'))return {fields:{issuetype:{name:'Test Execution'}}};if(p.includes('page=1'))return [{key:'UW-1',status:'FAIL'}];if(p.includes('page=2'))return [];if(p.includes('/step'))throw Error('403');if(p.includes('/testrun?'))return {status:'FAIL',actualResult:'Rejected'};return {fields:{summary:'Applicant validation'}};},'UW-10','',10);
 assert.ok(r.evidence.some(e=>e.label==='Test definition UW-1'));assert.ok(r.evidence.some(e=>e.label==='Execution-specific run UW-10 / UW-1'));assert.equal(r.errors.length,1);assert.ok(calls.every(p=>p.startsWith('/rest/')));
});
