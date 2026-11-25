# 移植决策与边界

本文件记录 pstack-dsh 为什么这样实现，以及哪些能力没有搬。上游版本是 pstack 0.15.48，源镜像在 `D:\笔记\plugins\pstack`。

## 决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | 零原生 JS，纯配置 bundle | 没有第三方代码跑在 Host 进程里。DSH 升级只影响 preset schema，几乎不会弄坏。 |
| D2 | 从本地 cursor/plugins 镜像生成技能树 | 镜像固定在 0.15.48，生成器可复现；升级只需 `git pull` 后重跑。 |
| D3 | Host 层独立技能提供者（`providerName: pstack`） | DSH 官方支持的部署级模式，技能进全局层，任何 preset 的会话都可见，且不与 standard 内置 provider 冲突。 |
| D4 | 61 个技能隐藏，只留 `setup-pstack` 可见 | 与上游单一入口设计一致。catalog 只多一行，token 成本接近零。隐藏技能仍可通过 `/name` 手势或 `read` 加载。 |
| D5 | 技能路由一律 `read` 文件 | 技能正文里的相对路径原样有效，resourceBase 是技能目录。与上游适配表同款规则。 |
| D6 | 两个 Agent Preset 加 `subagent_pstack` 工具 | 复用 DSH 原生 spawn 后端与模型选择字段，不另写子代理工具。 |
| D7 | 模型路由表写死本机 magpie 网关 | 用户点名 > 表默认 > 继承父模型。DSH 没有 `.mdc` 规则文件机制，表是唯一权威。 |
| D8 | 面板用异家族席位 | 交叉评审的价值在异源视角。本机网关有 GLM、Kimi、Qwen、DeepSeek 等家族，席位用 Kimi K3、Qwen3.8、GLM-5.4-max。 |
| D9 | 评审席位同时进 `subagent-model-selection-settings` 白名单 | 白名单在会话创建时采样，不在场就会被拒绝。README 已写安装后必做。 |
| D10 | vendored 3 个技能加 `disable-model-invocation` | 上游在 Cursor 自动触发；DSH 语义下自动触发会污染 catalog，手动 `/name` 才符合每任务一次的精神。 |
| D11 | Cursor 专属能力跳过并注明，不改 playbook 正文 | 上游正文零改动，升级 diff 干净。遇到 Cursor 专属步骤写一行 `Skipped in DSH` 后继续。 |
| D12 | `automations/benny/` 作为休眠参考随树分发 | 保留上游完整能力面，但不注册成技能。DSH 没有 Cursor Automations 和 Slack 触发，不能假装它能跑。 |
| D13 | 只保留一份技能树 `pstack/`，随仓库分发 | 避免顶层 `skills/` 与 `pstack/skills/` 双树漂移。装 bundle 时不需要本地镜像。 |
| D14 | `setup-pstack` 用 DSH 原生正文整体替换 | 上游会探测 Cursor 模型并写 `.mdc`，在 DSH 是死步骤。改成路由说明页才有发现价值。 |
| D15 | 每篇指南、README 与 benny README 的 H1 后注入 DSH 覆盖说明 | 保留上游正文，同时让 `/add-plugin`、`.cursor/` 路径、Option+Enter、`/loop` 有明确落点。 |

## 能力对齐结果

| 能力单元 | 上游 | 本移植 | 状态 |
|---|---|---|---|
| 技能 | 59 个 pstack 技能 + 3 个 cursor-team-kit 技能 | 62 个技能，516 个上游文件逐字节一致（`SKILL.md` 只多注入行） | 完整 |
| 子代理 | poteto-agent、comment-sicko | 两个 Agent Preset，加 `subagent_pstack` | 适配 |
| 模型路由 | `/setup-pstack` 探测并写 `.mdc` | 适配表固定路由，用户点名可覆盖 | 适配 |
| 指南 | 10 篇 guide + README | 全部随树，H1 后加 DSH 说明 | 完整 |
| 自动化 | benny 12 个文件 | 随树分发，不注册、不运行 | 平台不支持 |
| Cursor 专属 | Bugbot、Automations、云端代理、Projects、Custom Mode、`/loop` | 跳过并注明 | 平台不支持 |

## 已知边界

- DSH 没有 Cursor Automations。benny 的三份 SKILL.md 依赖 Slack 触发、Slack 写权限和 Cursor 的 `/automate`，在 DSH 里只能当人工清单参考。
- DSH 没有 Custom Mode。`/poteto-mode` 只对当前消息生效，下一条任务要重新输入。`create_goal` 可以跨轮推进，但语义不是 Custom Mode。
- DSH 没有 `/loop`。长时间无人值守用 `create_goal` 近似，定时任务用 `schedule_create`，两者都需要用户明确要求。
- 模型路由表按本机网关写死。换网关要同时改 `docs/harness/dsh.md` 和 profile 白名单，并新开会话。
- `cordis.patch.yml` 与两个 persona 里有绝对路径。移动安装目录时同步改这三处。
- bundle 内 `cordis.patch.yml` 不会热重载。改完 patch 要 `remove_bundle` 再 `install_bundle`。
- 61 个技能不在模型 catalog 里。用户直接输入 `/name` 可以调用；模型需要按适配表用 `read` 读取。

## 验证

```sh
node scripts/generate.mjs --check
node scripts/check-patch.mjs cordis.patch.yml
```

期望输出：

```text
pstack/ up to date (... files, 62 skills, 21 adapter lines, ... DSH coverage blocks, 2 agent docs, 12 automation files).
patch structure OK (top ids: none, insert block present)
```

安装后用 `plugin_manager list_plugins` 或 Plugins 页确认四行都处于 active：

- `skill-filesystem-pstack`
- `tool-subagent-pstack`
- `preset-poteto-agent`
- `preset-comment-sicko`
