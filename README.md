# DocGenerator — Jira, Confluence Data Center and Xray

A local Playwright/TypeScript CLI that opens a browser for manual SSO/MFA, extracts document evidence and creates Markdown. Version 0.2 adds read-only Confluence Data Center and Xray Server/DC REST adapters. There is no hosted UI. Passwords and browser authentication state are not persisted.

## Install

Node.js 22.18+ (24 recommended):

```bash
git clone https://github.com/ricpathak/DocGenerator.git
cd DocGenerator
npm install
npx playwright install chromium
```

## Xray Test Execution

```bash
npm start -- --url "https://jira.example.com/jira/browse/UW-123" --dc --xray-kind testexec --max-tests 200 --depth 0
```

## Xray Test Set

```bash
npm start -- --url "https://jira.example.com/jira/browse/UW-456" --dc --xray-kind testset --max-tests 200 --depth 0
```

## Confluence page and descendants

```bash
npm start -- --url "https://wiki.example.com/confluence/pages/viewpage.action?pageId=123" --dc --depth 2 --max-pages 50
```

Log in in the opened browser, including MFA. Return to the exact requested document and press Enter in the terminal. Before each capture, open the relevant panels, expand content and scroll/load rows. Enter captures the page; `s` skips; `q` finishes. API requests reuse cookies from this browser session. If another host requires login, complete it manually when visited.

`--dc` enables API extraction. Without it, extraction is browser-only. Jira/Xray issue types named Test, Test Set and Test Execution are detected automatically. Use `--xray-kind test|testset|testexec|issue` for localized/renamed seed issue types. Context paths such as `/jira` and `/confluence` are inferred from the source URL. Use canonical document URLs, not short links.

## What is extracted

- Browser: visible main-content text, headings, HTML tables/ARIA grids and linked Jira/Confluence documents on allowed origins.
- Jira DC API: seed issue description, summary, type and issue links.
- Xray: paginated Test Set/Test Execution members; test definitions with Jira field-name mapping; current definition preconditions and manual steps; execution-specific test-run responses for a Test Execution.
- Confluence DC: paginated child-page IDs via the hierarchy API; discovered children are queued for browser text capture within depth/page limits.

Only GET requests are used by the adapters. API responses are preserved as JSON text in Markdown and structured evidence; a normalized test-case spreadsheet/UI is not implemented. Current definition preconditions and steps are separate from historical run evidence. Actual results, statuses, environments and defects are preserved when returned by the run endpoint, not inferred or guaranteed for every version.

Pagination continues until an empty Xray page, rather than assuming a short page means completion. A repeated page is reported as a failure. `--max-tests` caps each Xray container; the default is 200. A capped container is explicitly marked partial. Confluence child discovery caps at 10,000 children per visited page. `--max-pages` limits visited browser documents; `--depth` controls both hierarchy and visible linked-document traversal. API extraction of member tests is governed by `--max-tests` and occurs even at depth 0.

## Output

Each run creates a timestamped directory under `output/`:

- `understanding.md`: extractive outline, source text, tables and API evidence with source references; not semantic AI understanding.
- `xray-tests.md`: Jira/Xray API evidence in Markdown (Data Center mode).
- `evidence.json`: structured captures, failures and pending URLs.
- `analysis-prompt.md`: prompt to analyze the evidence with enterprise-approved Copilot/Claude.
- `ai-understanding.md`: optional local AI understanding.

Source IDs in xray-tests.md are local to that file; they are independently numbered from understanding.md. API records and browser/frame records count as separate snapshots, not separate pages.

## Optional local AI

Install/run Ollama separately and pull an approved local text model. Add `--model YOUR_INSTALLED_MODEL` to any command. Inference uses only `http://127.0.0.1:11434/api/chat`. All captures, including API JSON text, are analyzed in 12,000-character chunks. The AI output cites source IDs, distinguishes facts/inferences, preserves Japanese terminology and identifies gaps. It analyzes chunks separately and does not reconcile cross-document contradictions. Review interpretations against source evidence. Failure creates `ai-error.txt` without discarding extraction.

## Additional flags

```bash
npm start -- --help
npm start -- --url "https://wiki.example.com/confluence/pages/viewpage.action?pageId=123" --dc --origins "https://jira.example.com" --depth 1 --out output
```

Only the seed origin and explicitly added `--origins` are extracted. Authentication redirects can still occur in the browser. REST redirects are refused and non-JSON login responses are reported. Browser capture remains available if the REST request is blocked by SSO, permissions, licensing or an endpoint/version mismatch. There is no automatic credential bypass or PAT fallback.

## Known boundaries

Your exact Xray/DC versions and SSO gateway must be validated in your environment. API compatibility uses documented Xray 1.0 and Jira 2 endpoints. The tool has fixture-based tests, not live-tenant certification. Membership response schemas other than the documented array are rejected and reported. A failed membership pagination request currently discards that container's API membership batch; browser evidence and failure logs remain.

Confluence page text is browser-rendered; hierarchy discovery is API-backed. Linked pages are not necessarily children. Hidden browser content, attachments, images/OCR, shadow DOM, cross-origin plugin frames and virtualized rows are not fully extracted. Jira comments are not requested. Only canonical `/browse/KEY-123`, Confluence `/spaces/.../pages/ID`, `/display/...` and `/pages/viewpage.action?pageId=...` formats are followed. Short links require canonical URLs. No automatic output merging or historical version reconciliation is implemented.

## Validation

```bash
npm test
npm start -- --help
```

Tests cover context paths, one-based Xray pagination, server-side page caps, repeated pages, item limits, Confluence pagination, SSO HTML detection, run/definition separation, URL selection and Markdown rendering.

## API references

- Xray Test Sets: https://getxraydocs.atlassian.net/wiki/spaces/XRAY650/pages/49905903/Test+Sets+-+REST
- Xray Test Executions: https://getxraydocs.atlassian.net/wiki/spaces/XRAY730/pages/46104963/Test+Executions+-+REST
- Xray Test Steps: https://getxraydocs.atlassian.net/wiki/spaces/XRAY760/pages/48760671
- Xray Test Runs: https://docs.getxray.app/space/XRAY/301669283
- Xray preconditions: https://getxraydocs.atlassian.net/wiki/spaces/XRAY410/pages/49349216
- Confluence DC: https://developer.atlassian.com/server/confluence/rest/latest/
