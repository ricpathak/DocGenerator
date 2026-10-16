export function normalize(value: string): string {
  const u = new URL(value);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error('Use an HTTP(S) URL without embedded credentials');
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) if (!['pageId'].includes(key)) u.searchParams.delete(key);
  return u.href;
}
export function isDocument(value: string): boolean {
  const u = new URL(value);
  return /\/browse\/[A-Z][A-Z0-9_]*-\d+\/?$/i.test(u.pathname) || /\/spaces\/[^/]+\/pages\/\d+/.test(u.pathname) || /\/(display\/|pages\/viewpage.action)/.test(u.pathname);
}
export type Capture = {url:string;title:string;text:string;headings:string[];tables:string[][][];links:{text:string;url:string}[];frame:string;depth:number};
export function markdown(records: Capture[], errors: string[], pending: number): string {
  const out = ['# Jira / Confluence evidence brief', '', `Generated: ${new Date().toISOString()}`, '', '## Coverage', '', `Captured ${records.length} document/frame snapshots. ${pending} queued links were not visited.`, '', 'This is an extractive brief, not AI interpretation. Linked pages are not necessarily hierarchical children. Visible tables are evidence, not a verified complete test inventory. Hidden tabs, pagination, collapsed panels, attachments and virtualized rows may be missing.', '', '## Understanding outline (source headings)', ''];
  records.forEach((r,i) => out.push(`### [S${i+1}] ${r.title}`, `Source: ${r.url}`, ...r.headings.map(h=>`- ${h.replace(/\n/g,' ')}`), ''));
  out.push('## Test information / table evidence', '');
  const cell = (s:string) => s.replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
  records.forEach((r,i)=>r.tables.forEach((t,j)=>{
    if (!t.length) return;
    const width = Math.max(...t.map(row=>row.length));
    const row = (a:string[])=>'| '+Array.from({length:width},(_,k)=>cell(a[k]||'')).join(' | ')+' |';
    out.push(`### S${i+1} table ${j+1}`, row(t[0]),row(Array(width).fill('---')),...t.slice(1).map(row),'');
  }));
  out.push('## Full source text', '');
  records.forEach((r,i)=>out.push(`### S${i+1}: ${r.title}`,`Source: ${r.url}`,`Frame: ${r.frame}`,'',...r.text.split('\n').map(l=>`> ${l}`),'', 'Linked documents:',...r.links.map(l=>`- ${l.text || l.url}: ${l.url}`),''));
  out.push('## Gaps and failures', '', ...(errors.length?errors:['No navigation failures recorded. Completeness has not been verified.']));
  return out.join('\n');
}
