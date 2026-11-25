#!/usr/bin/env node
/**
 * pstack-dsh 生成器：从本地 cursor/plugins 镜像生成 DSH 技能树。
 *
 * 用法：node scripts/generate.mjs [--check]
 *   --check  只校验已生成树是否与源同步（CI / 本机用），不写文件。
 *
 * 源：  <SRC>/pstack/skills                 59 个技能（上游 pstack 0.15.48）
 *       <SRC>/cursor-team-kit/skills        vendored 3 个（deslop/control-ui/control-cli）
 *       ./docs/harness/dsh.md               DSH 适配表（本仓库维护，生成时复制进树）
 *       ./agents/                           DSH 版 agent 定义（替代上游 Cursor agent 文件）
 *       ./overrides/setup-pstack.SKILL.md   DSH 原生 setup（catalog 里唯一可见技能）
 * 出：  ./pstack/  ← 生成树，随仓库分发；重新生成会清空重建
 *         pstack/skills/<name>/SKILL.md    62 个技能
 *         pstack/agents/*.md                2 个 DSH agent 定义
 *         pstack/docs/guide/…              上游指南 + 每篇 DSH 覆盖说明
 *         pstack/docs/harness/dsh.md       DSH 适配表（源：docs/harness/dsh.md）
 *         pstack/README.md, pstack/LICENSE
 *
 * 移植规则（上游正文零改动，升级 diff 干净）：
 *   1. 用到 Cursor 名字的技能，SKILL.md 的 H1 后注入一行 DSH 适配指引。
 *   2. 每篇指南与上游 README 的 H1 后注入 DSH 覆盖说明。
 *   3. 指向上游 pstack/ 树外文件的相对链接，重写为 GitHub main 链接。
 *   4. 3 个 vendored 技能追加 disable-model-invocation: true。
 *   5. setup-pstack 用 DSH 原生正文整体覆盖（不探测模型、不写 .mdc 规则文件）。
 *   6. 校验：树内 .md 相对链接无悬空；frontmatter name = 目录名；
 *      setup-pstack 保持 model-invocable；两个 agent 定义齐全。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
// 源仓库：本地 cursor/plugins 镜像。换镜像位置只改这一行。
const SRC = 'D:\\笔记\\plugins'
const PSTACK = join(SRC, 'pstack')
const OUT = join(ROOT, 'pstack')
const ADAPTER_SRC = join(ROOT, 'docs', 'harness', 'dsh.md')
const AGENTS_SRC = join(ROOT, 'agents')
const OVERRIDES_SRC = join(ROOT, 'overrides')
const GITHUB = 'https://github.com/cursor/plugins'
const LINK = /\]\(([^)\s]+)\)/g
const VENDORED = ['deslop', 'control-ui', 'control-cli']
const HIDE = 'disable-model-invocation: true'
const COMMAND = 'node scripts/generate.mjs'
const OVERRIDDEN_SKILL = 'setup-pstack'
const AGENT_DOCS = ['poteto-agent.md', 'comment-sicko.md']

const ADAPTER_LINE =
  'In DeepSeek Harness, read [the DSH adapter](../../docs/harness/dsh.md) once per session before you follow this skill. ' +
  'It maps the Cursor names in pstack skills to DSH tools, models, and paths.'

const GUIDE_LINE =
  'In DeepSeek Harness, read [the DSH adapter](../harness/dsh.md) first. This guide was written for Cursor: ' +
  'the adapter maps its `/add-plugin`, `.cursor/…` paths, model slugs, Custom Mode, and `/loop` to DSH. ' +
  'Install this port as a DSH bundle (see the repository README), not with a plugin command.'

const README_LINE =
  'In DeepSeek Harness, read [the DSH adapter](docs/harness/dsh.md) first. This README describes the upstream Cursor plugin; ' +
  'this port installs as a DSH bundle, and the adapter maps commands, paths, models, and Cursor-only features to DSH.'

// ── 上游 TERMS 检测（判定"哪些技能用了 Cursor 名字、需要适配行"）──────────
const TERMS = [
  { key: '`Task`', re: /`Task`|\bTask (tool|subagent|call)/ },
  { key: '`AskQuestion`', re: /AskQuestion/ },
  { key: 'todolist', re: /\btodo ?list\b/i },
  { key: 'generalPurpose', re: /generalPurpose/ },
  { key: 'poteto-agent', re: /poteto-agent/ },
  { key: 'comment-sicko', re: /comment-sicko/ },
  { key: '`readonly: true`', re: /readonly: (true|false)|readonly\/Ask/ },
  { key: '`environment: "cloud"`', re: /environment: "(cloud|local)"/ },
  { key: 'cloud_base_branch', re: /cloud_base_branch/ },
  { key: '`run_in_background: true`', re: /run_in_background/ },
  { key: '`resume`', re: /`resume`/ },
  { key: '`file_attachments`', re: /file_attachments/ },
  { key: 'claude-', re: /\bclaude-[a-z]+-\d/ },
  { key: 'grok-', re: /\bgrok-\d/ },
  { key: 'gpt-', re: /\bgpt-\d/ },
  { key: 'inherit-parent', re: /inherit-parent/ },
  { key: 'pstack-models.mdc', re: /pstack-models\.mdc/ },
  { key: '.cursor/skills/', re: /\.cursor\/skills/ },
  { key: '~/.cursor/plugins/', re: /\.cursor\/plugins|\.cursor-plugin/ },
  { key: '.cursor/rules/', re: /\.cursor\/rules|always-applied rule/ },
  { key: 'agent-transcripts', re: /agent-transcripts|\.cursor\/projects/ },
  { key: 'Cursor-only features', re: /Bugbot|Cursor [Aa]utomation|cursor\.(sh|com)\/automations|[Cc]loud [Aa]gent|built-in PR tool/ },
]
const ROUTE_KEY = 'Run another pstack skill'

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === '.DS_Store' || name === 'node_modules') return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

for (const [label, path] of [
  ['docs/harness/dsh.md', ADAPTER_SRC],
  ['agents/', AGENTS_SRC],
  [`overrides/${OVERRIDDEN_SKILL}.SKILL.md`, join(OVERRIDES_SRC, `${OVERRIDDEN_SKILL}.SKILL.md`)],
]) {
  if (!existsSync(path)) {
    console.error(`FAIL ${label} is missing; the DSH port needs it (${path}).`)
    process.exit(1)
  }
}

// ── 收集技能源 ─────────────────────────────────────────────────────────────
const sources = new Map() // skill name -> source dir
for (const name of readdirSync(join(PSTACK, 'skills'))) {
  if (existsSync(join(PSTACK, 'skills', name, 'SKILL.md'))) sources.set(name, join(PSTACK, 'skills', name))
}
for (const name of VENDORED) {
  const dir = join(SRC, 'cursor-team-kit', 'skills', name)
  if (!existsSync(join(dir, 'SKILL.md'))) throw new Error(`vendored skill missing: ${dir}`)
  sources.set(name, dir)
}

// ── 判定哪些技能需要适配行（含"裸引用兄弟技能"的路由键）────────────────────
const skills = [...sources.keys()].sort()
const classes = new Map()
for (const skill of skills) {
  const dir = sources.get(skill)
  const others = skills.filter((n) => n !== skill).join('|')
  const route = new RegExp(`the \\*\\*(?<bold>${others})\\*\\* skill|\`/(?<command>${others})\``, 'g')
  const linksToSkill = (line, name) => line.includes(`(../${name}/`)
  const namesBareSkill = (line) =>
    [...line.matchAll(route)].some(({ groups }) => !linksToSkill(line, groups.bold ?? groups.command))
  const uses = new Set()
  for (const path of walk(dir).filter((p) => p.endsWith('.md'))) {
    const text = readFileSync(path, 'utf8')
    for (const t of TERMS) if (t.re.test(text)) uses.add(t.key)
    if (text.split('\n').some(namesBareSkill)) uses.add(ROUTE_KEY)
  }
  classes.set(skill, { uses })
}

// ── 渲染目标树（pstack/ 下的 posix 相对路径 -> bytes）───────────────────────
const files = new Map()
const put = (absDir, prefix) => {
  for (const path of walk(absDir)) {
    const rel = posix.join(prefix, ...path.slice(absDir.length + 1).split(/[\\/]/))
    files.set(rel, readFileSync(path))
  }
}
for (const skill of skills) put(sources.get(skill), `skills/${skill}`)
put(join(PSTACK, 'docs', 'guide'), 'docs/guide')
files.set('README.md', readFileSync(join(PSTACK, 'README.md')))
files.set('LICENSE', readFileSync(join(PSTACK, 'LICENSE')))
files.set('docs/harness/dsh.md', readFileSync(ADAPTER_SRC))

// DSH 版 agent 定义：替代上游 Cursor agent 文件（含 model slug / ~/.cursor/plugins/）
for (const name of readdirSync(AGENTS_SRC).filter((n) => n.endsWith('.md'))) {
  files.set(`agents/${name}`, readFileSync(join(AGENTS_SRC, name)))
}

// setup-pstack：DSH 原生正文（唯一可见技能），整体覆盖上游的探测 + .mdc 规则步骤
files.set(
  `skills/${OVERRIDDEN_SKILL}/SKILL.md`,
  readFileSync(join(OVERRIDES_SRC, `${OVERRIDDEN_SKILL}.SKILL.md`)),
)

// 1) 注入适配行；vendored 技能加 disable-model-invocation
let wrapped = 0
for (const skill of skills) {
  if (skill === OVERRIDDEN_SKILL) continue // DSH 原生正文，不需要适配行
  const path = `skills/${skill}/SKILL.md`
  let next = files.get(path).toString('utf8')
  if (classes.get(skill).uses.size > 0 && /^# /m.test(next)) {
    next = next.replace(/^(# .*)\r?\n+/m, `$1\n\n${ADAPTER_LINE}\n\n`)
    wrapped += 1
  }
  if (VENDORED.includes(skill) && !/^disable-model-invocation:/m.test(next)) {
    next = next.replace(/^---\r?\n/, `---\n${HIDE}\n`)
  }
  files.set(path, Buffer.from(next))
}

// 2) 每篇指南与上游 README 注入 DSH 覆盖说明（正文不动，保持与上游可 diff）
const injectAfterH1 = (text, line) =>
  /^# /m.test(text) ? text.replace(/^(# .*)\r?\n+/m, `$1\n\n${line}\n\n`) : text
let covered = 0
for (const [path, entry] of [...files]) {
  const line = path === 'README.md' ? README_LINE : /^docs\/guide\/.*\.md$/.test(path) ? GUIDE_LINE : null
  if (!line) continue
  files.set(path, Buffer.from(injectAfterH1(entry.toString('utf8'), line)))
  covered += 1
}

// 3) 重写越出 pstack/ 的相对链接 → GitHub main；树内存在的保持相对
const resolvePstack = (from, href) => {
  const target = href.replace(/[#?].*/, '')
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined
  const path = posix.join(posix.dirname(from), target).replace(/\/$/, '')
  return existsSync(join(PSTACK, path)) ? path : undefined
}
const has = (path) => files.has(path) || [...files.keys()].some((key) => key.startsWith(`${path}/`))
for (const [path, entry] of files) {
  if (!path.endsWith('.md')) continue
  const text = entry.toString('utf8').replace(LINK, (link, href) => {
    const target = resolvePstack(path, href)
    if (!target || target.split('/')[0] === '..' || has(target)) return link
    const kind = statSync(join(PSTACK, target)).isDirectory() ? 'tree' : 'blob'
    return `](${GITHUB}/${kind}/main/pstack/${target}${href.slice(href.search(/[#?]|$/))})`
  })
  files.set(path, Buffer.from(text))
}

// 4) 校验：树内 .md 链接无悬空；frontmatter name = 目录名；kebab-case；有 description
const problems = []
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
for (const [path, entry] of files) {
  if (!path.endsWith('.md')) continue
  for (const [, href] of entry.toString('utf8').matchAll(LINK)) {
    const target = resolvePstack(path, href)
    if (target && !has(target)) problems.push(`${path} links to ${href}, which is not in the tree`)
  }
  const m = path.match(/^skills\/([^/]+)\/SKILL\.md$/)
  if (m) {
    const fm = entry.toString('utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
    const name = fm.match(/^name:(.*)$/m)?.[1].trim().replace(/^["'](.*)["']$/, '$1')
    if (name !== m[1]) problems.push(`skills/${m[1]}: frontmatter name ${JSON.stringify(name)} ≠ dir name`)
    if (!SKILL_NAME.test(m[1]) || m[1].length > 64) problems.push(`skills/${m[1]}: not kebab-case ≤64 chars`)
    if (!/^description:[ \t]*\S/m.test(fm)) problems.push(`skills/${m[1]}: missing description`)
  }
}
for (const name of AGENT_DOCS) {
  if (!files.has(`agents/${name}`)) problems.push(`agents/${name} missing from the generated tree`)
}
const setupBody = files.get(`skills/${OVERRIDDEN_SKILL}/SKILL.md`).toString('utf8')
if (/^disable-model-invocation:/m.test(setupBody)) {
  problems.push(`${OVERRIDDEN_SKILL} must stay model-invocable (the only visible skill)`)
}
if (!/^name: setup-pstack$/m.test(setupBody)) {
  problems.push(`${OVERRIDDEN_SKILL} override frontmatter name mismatch`)
}
if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`)
  process.exit(1)
}

// ── 写出（或 --check 校验）─────────────────────────────────────────────────
if (process.argv.includes('--check')) {
  const onDisk = existsSync(OUT)
    ? new Map(walk(OUT).map((p) => [relative(OUT, p).split(/[\\/]/).join('/'), readFileSync(p)]))
    : new Map()
  const drifted = [...new Set([...files.keys(), ...onDisk.keys()])].sort().filter((path) => {
    const [want, have] = [files.get(path), onDisk.get(path)]
    return !want || !have || !want.equals(have)
  })
  for (const path of drifted.slice(0, 20)) console.error(`drifted: ${path}`)
  if (drifted.length > 0) {
    console.error(`pstack/ out of date (${drifted.length} files). Run \`${COMMAND}\` and commit.`)
    process.exit(1)
  }
  console.log(
    `pstack/ up to date (${files.size} files, ${skills.length} skills, ${wrapped} adapter lines, ` +
      `${covered} DSH coverage blocks, ${AGENT_DOCS.length} agent docs).`,
  )
} else {
  rmSync(OUT, { recursive: true, force: true })
  for (const [path, bytes] of files) {
    const abs = join(OUT, path)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, bytes)
  }
  console.log(
    `generated pstack/: ${skills.length} skills (${VENDORED.length} vendored), ${files.size} files, ` +
      `${wrapped} adapter lines, ${covered} DSH coverage blocks, ${AGENT_DOCS.length} agent docs.`,
  )
  console.log('next: git add pstack && git commit')
}
