#!/usr/bin/env node
// 零依赖 YAML 结构校验：验证 cordis.patch.yml 的顶层形状与关键字段。
// 不是完整 YAML 解析器——只覆盖本文件用到的子集（顶层数组、insert、标量、
// 行内列表、块标量、!!js 表达式）。Loader 是最终裁判；这里拦截手写笔误。
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const text = readFileSync(file, 'utf8')
const lines = text.split(/\r?\n/)

const errors = []
let i = 0
function fail(msg) { errors.push(`line ${i + 1}: ${msg}`) }

// 顶层必须是 "- insert:" 或 "- id: ..." 的数组
let sawInsert = false
const topIds = []
while (i < lines.length) {
  const line = lines[i]
  if (/^\s*#/.test(line) || /^\s*$/.test(line)) { i++; continue }
  if (/^- insert:/.test(line)) { sawInsert = true }
  else if (/^- id:\s*(\S+)/.test(line)) { topIds.push(/^- id:\s*(\S+)/.exec(line)[1]) }
  else if (/^-\s+\S/.test(line)) { /* 数组后续行，忽略 */ }
  else if (/^\s/.test(line)) { /* 缩进行，忽略 */ }
  else { fail(`unexpected top-level content: ${line.slice(0, 50)}`) }
  i++
}
if (!sawInsert) errors.push('no - insert: block found')

// 关键行存在性检查（按本 bundle 的契约）
const must = [
  /providerName:\s*pstack/,
  /includeDefaultRoots:\s*false/,
  /toolName:\s*subagent_pstack/,
  /agentPreset:\s*poteto-agent/,
  /allowedAgentPresets:\s*\[poteto-agent,\s*comment-sicko\]/,
  /id:\s*preset-poteto-agent/,
  /id:\s*preset-comment-sicko/,
  /id:\s*skill-filesystem-pstack/,
  /id:\s*tool-subagent-pstack/,
]
for (const re of must) {
  if (!re.test(text)) errors.push(`missing expected pattern: ${re}`)
}

// 每个 !!js 表达式必须带引号（含 === / !== / process. 的行）
lines.forEach((line, idx) => {
  if (/!!js\s+\S/.test(line) && /process\.platform/.test(line) && !/['"]/.test(line)) {
    // 无引号且含表达式体：块内单 token（process.platform === 'win32' 需引号）
    const m = /!!js\s+(.+)$/.exec(line)
    if (m && /\s/.test(m[1].trim()) && !/^['"]/.test(m[1].trim())) {
      errors.push(`line ${idx + 1}: !!js expression with spaces must be quoted: ${m[1].trim().slice(0, 40)}`)
    }
  }
})

if (errors.length > 0) {
  for (const e of errors) console.error(`FAIL ${e}`)
  process.exit(1)
}
console.log(`patch structure OK (top ids: ${topIds.join(', ') || 'none'}, insert block present)`)
