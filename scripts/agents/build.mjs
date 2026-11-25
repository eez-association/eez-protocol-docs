// Agent-facing files, written into the built site after `vocs build`:
// - /<page>.md for every human & spec page (Vocs only emits /assets/md/<page>.md; its
//   .md router needs a server, and GitHub Pages is static)
// - /SKILL.md and /.well-known/skills/ (for `npx skills add https://docs.eez.io`)
import fs from 'node:fs'
import path from 'node:path'

const site = 'https://docs.eez.io'
const repo = 'https://github.com/eez-association/eez-core-protocol'
const out = 'dist/public'
const { commit } = JSON.parse(fs.readFileSync('src/sync.json', 'utf8'))

// Ordered catalog of agent-facing pages: human guides on docs.eez.io + synced spec mirrors.
const CATALOG = [
  { section: 'Human docs', text: 'Walkthrough', link: '/eez-walkthrough' },
  { section: 'Human docs', text: 'Integrate a chain', link: '/integrate-a-chain' },
  { section: 'Human docs', text: 'Build a dApp', link: '/build-a-dapp' },
  { section: 'Specification', text: 'Core protocol', link: '/core-protocol-spec' },
  { section: 'Specification', text: 'Execution entries', link: '/execution-entry-spec' },
  { section: 'Specification', text: 'Static entries', link: '/static-entry' },
  { section: 'Specification', text: 'Multi-prover', link: '/multi-prover-spec' },
  { section: 'Specification', text: 'Events and reconstruction', link: '/events' },
  { section: 'Limits and boundaries', text: 'Call-pattern limits', link: '/call-pattern-limits' },
  { section: 'Limits and boundaries', text: 'Integration boundaries', link: '/integration-boundaries' },
  { section: 'Blobs', text: 'Message format', link: '/blobs/blob-format-spec' },
  { section: 'Blobs', text: 'U256 compressed codec', link: '/blobs/u256-compressed-codec' },
  { section: 'Blobs', text: 'Future optimizations', link: '/blobs/future-optimizations' },
]

// Hand-written routing for common jobs. Every link must exist in CATALOG.
const TASKS = [
  ['Get oriented on how one cross-rollup call works', ['/eez-walkthrough']],
  ['Integrate a chain: registration, state updates, L1↔L2 call flows, and the five proof-system invariants', ['/integrate-a-chain', '/integration-boundaries']],
  ['Build a dApp on EEZ (Quickstarts, RollupX dashboard, Remix, EVMcrispr)', ['/build-a-dapp']],
  ['Build execution entries for L1 `postAndVerifyBatch` or L2 `loadExecutionTable` / `executeIncomingCrossChainCall`', ['/execution-entry-spec', '/core-protocol-spec']],
  ['Compute or check call hashes and rolling hashes', ['/core-protocol-spec']],
  ['Handle a read-only cross-chain call (STATICCALL) or a reverting reentrant call', ['/static-entry']],
  ['Check whether a call pattern is supported today', ['/call-pattern-limits']],
  ['Configure proof systems, verification keys or the threshold for a rollup', ['/multi-prover-spec']],
  ['Index events or reconstruct execution from receipts', ['/events']],
  ['Find what a builder, prover or operator must provide outside the contracts', ['/integration-boundaries']],
  ['Encode or decode the blob message stream', ['/blobs/blob-format-spec', '/blobs/u256-compressed-codec']],
]

const description = (file) => {
  const fm = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? ''
  const v = fm.match(/^description:\s*(.+)$/m)?.[1]
  return v?.startsWith('"') ? JSON.parse(v) : v
}
const source = (link) =>
  ['.md', '.mdx', '/index.mdx'].map((ext) => `src/pages${link === '/' ? '/index' : link}${ext}`).find((f) => fs.existsSync(f))

const mdxToAgentMarkdown = (file, link) => {
  const raw = fs.readFileSync(file, 'utf8')
  const withoutFrontmatter = raw.replace(/^---\n[\s\S]*?\n---\n+/, '')
  return (
    withoutFrontmatter
      .replace(/^import\s+.*$/gm, '')
      .replace(/^<([A-Z][A-Za-z0-9]*)\s*\/>$/gm, `> Interactive widget available at ${site}${link}.`)
      .replace(/^:{3,4}steps\s*$/gm, '')
      .replace(/^:{3,4}note\s*$/gm, '> **Note:**')
      .replace(/^:{3,4}\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  )
}

const pages = CATALOG.map((entry) => {
  const file = source(entry.link)
  if (!file) throw new Error(`agents: no source for ${entry.link}`)
  return {
    ...entry,
    file,
    isMdx: file.endsWith('.mdx'),
    description: description(file),
  }
})
const byLink = new Map(pages.map((p) => [p.link, p]))
const md = (link) => `${site}${link}.md`

// 1. Markdown copies at /<page>.md.
let copied = 0
for (const p of pages) {
  const dest = path.join(out, `${p.link}.md`)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  if (p.isMdx) {
    fs.writeFileSync(dest, mdxToAgentMarkdown(p.file, p.link))
  } else {
    const from = path.join(out, 'assets/md', `${p.link}.md`)
    if (!fs.existsSync(from)) throw new Error(`agents: Vocs emitted no Markdown for ${p.link}`)
    fs.copyFileSync(from, dest)
  }
  copied++
}

// 2. SKILL.md.
const pageTable = [
  '| Page | What it covers |',
  '| --- | --- |',
  ...pages.map((p) => `| [${p.section ? `${p.section}: ` : ''}${p.text}](${md(p.link)}) | ${p.description ?? ''} |`),
].join('\n')
const taskTable = [
  '| Task | Read |',
  '| --- | --- |',
  ...TASKS.map(([task, links]) => {
    const refs = links.map((l) => {
      const p = byLink.get(l)
      if (!p) throw new Error(`agents: task links ${l}, which is not in CATALOG`)
      return `[${p.text}](${md(l)})`
    })
    return `| ${task} | ${refs.join(', ')} |`
  }),
].join('\n')
const skill = fs
  .readFileSync('scripts/agents/SKILL.template.md', 'utf8')
  .replace('{{PAGES}}', pageTable)
  .replace('{{TASKS}}', taskTable)
  .replaceAll('{{REPO}}', repo)
  .replaceAll('{{COMMIT}}', commit)
if (/\{\{\w+\}\}/.test(skill)) throw new Error('agents: unfilled placeholder in SKILL.md')
const name = skill.match(/^name:\s*(\S+)$/m)[1]
const skillDescription = skill.match(/^description:\s*(.+)$/m)[1]

fs.writeFileSync(path.join(out, 'SKILL.md'), skill)
// Discovery index read by the `skills` CLI (well-known v1 layout: <dir>/<name>/SKILL.md).
const wellKnown = path.join(out, '.well-known/skills')
fs.mkdirSync(path.join(wellKnown, name), { recursive: true })
fs.writeFileSync(path.join(wellKnown, name, 'SKILL.md'), skill)
fs.writeFileSync(
  path.join(wellKnown, 'index.json'),
  JSON.stringify({ skills: [{ name, description: skillDescription, files: ['SKILL.md'] }] }, null, 2) + '\n',
)

console.log(`agents: ${copied} .md copies, SKILL.md (${pages.length} pages, ${TASKS.length} tasks, ${commit})`)
