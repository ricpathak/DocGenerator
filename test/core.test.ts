import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize,isDocument,markdown } from '../src/core.ts';
test('canonical URLs retain Confluence identity and remove trackers',()=>{assert.equal(normalize('https://wiki.example/pages/viewpage.action?pageId=42&utm=x#foo'),'https://wiki.example/pages/viewpage.action?pageId=42');assert.throws(()=>normalize('file:///etc/passwd'));});
test('document filter avoids action links',()=>{assert.ok(isDocument('https://jira.example/browse/QA-42'));assert.ok(isDocument('https://wiki.example/wiki/spaces/UW/pages/123/Flow'));assert.equal(isDocument('https://jira.example/secure/DeleteIssue.jspa?id=1'),false);});
test('Markdown preserves table evidence and explicitly limits completeness',()=>{const md=markdown([{url:'https://jira.example/browse/QA-1',title:'Tests',text:'Given applicant',headings:['Steps'],tables:[[['Step','Expected'],['A|B','Pass\nNext']]],links:[],frame:'main',depth:0}],[],2);assert.match(md,/A\\\|B/);assert.match(md,/Pass<br>Next/);assert.match(md,/2 queued links/);assert.match(md,/not AI interpretation/);});
