# pstack 在 DeepSeek Harness (DSH) 中的适配表

pstack 技能使用 Cursor 术语。在 DSH 中，每个会话先读一次本文件，然后用下面的表把技能里的 Cursor 名字映射为 DSH 等价物。`<pstack>` 指 pstack-dsh 的安装目录（含 `cordis.patch.yml`、`pstack/`、`docs/` 的那一层；本机为 `D:\lib\deepseek-harness-plugins\pstack-dsh`）。技能树固定在 `<pstack>/pstack/skills`，由 `cordis.patch.yml` 的 `customSkillDirs` 声明。若某个 Cursor 字段在表中没有对应行，丢弃它并在回复中说明一行。绝不把工具 schema 会拒绝的字段或值传给工具。

生成器会在每个技能的 H1 后注入一行本文件的指引，在每篇指南与上游 README 的 H1 后注入一段 DSH 覆盖说明；上游正文保持原样，便于跟进上游版本。

## 工具映射

| Cursor | DSH |
| --- | --- |
| `Task`（spawn 子代理） | `subagent_pstack`（pstack 运行中的委派）或 `subagent`（普通委派）。均为后台启动，返回后完成通知会自动送达 |
| `AskQuestion` | `ask_user_question` |
| 打开 todolist / 把步骤复制进 todolist 工具 | `todo_write`（把 playbook 步骤逐字复制为条目） |
| 运行另一个 pstack 技能（`/name` 或"the **name** skill"） | 用 `read` 工具读 `<pstack>/pstack/skills/<name>/SKILL.md` 并遵循它。`skill` 工具拒绝加载隐藏技能（`disable-model-invocation: true`），这是预期行为。要用户手敲时，写作 `/name` |
| `Grep`, `Glob` | `grep`, `glob`（DSH 原生就有） |
| `run_in_background: true` | 省略。DSH 子代理默认后台运行 |
| `file_attachments` | 在 kickoff 里列路径，让子代理自己 `read` |
| `resume` 一个子代理 | 用 `send_message` 给该子代理名发后续指令；子代理仍在运行时优先用这个而不是再 spawn 新的 |
| readonly 探查类委派 | `subagent` + 子代理 prompt 里写明"只读，不要写文件"，事后用 `git status` 复核 |

## 子代理字段映射

| Cursor | DSH |
| --- | --- |
| `subagent_type: "poteto-agent"` | `agent_preset: "poteto-agent"`（`subagent_pstack` 的默认值，可省略） |
| `subagent_type: "comment-sicko"` | `agent_preset: "comment-sicko"` |
| `subagent_type: "generalPurpose"` | 用普通 `subagent` 工具（standard preset），或 `subagent_pstack` 不带 `agent_preset` 字段 |
| `model:` 里的 Cursor slug | 见下面"模型路由"：**绝不**把 `claude-*`/`gemini-*`/`grok-*` 之类的 slug 传给 DSH 工具 |
| `readonly: true` | 组合层已剥夺 comment-sicko 的写工具；其他场景在 kickoff 里写"只读"约束 |
| `environment: "cloud"` / `cloud_base_branch` | 无云端代理。本地替代：kickoff 里让子代理先用 `create_worktree` 建独立 worktree（记得指名基线分支），把 `cloud_base_branch` 的值写成 worktree 的 from 参数 |
| `interrupt` 一个子代理 | `send_message` 说明终止理由，或经父会话处理；不要反复 spawn 代替中断 |

## Agent 定义

上游的 `agents/poteto-agent.md` 与 `agents/comment-sicko.md` 是 Cursor 的 subagent 定义文件（frontmatter 带 `model: claude-opus-5-5-xhigh-fast`，正文让子代理搜索 `~/.cursor/plugins/`）。DSH 不加载这种文件，两个角色由 `cordis.patch.yml` 里的 **Agent Preset** 实现：

| 上游 | DSH |
| --- | --- |
| `subagent_type: "poteto-agent"` | `preset-poteto-agent`；`subagent_pstack` 默认选中，`agent_preset: "poteto-agent"` |
| `subagent_type: "comment-sicko"` | `preset-comment-sicko`；`agent_preset: "comment-sicko"`，组合层只挂只读工具，没有 `write` / `edit` / shell |
| `model: claude-opus-5-5-xhigh-fast` | 无 `model:` 字段；路由见"模型路由"，调用时传 `provider` + `model`（+ `reasoning_effort`） |
| 搜索 `~/.cursor/plugins/` 找 `skills/poteto-mode/SKILL.md` | `<pstack>/pstack/skills/poteto-mode/SKILL.md`，由 `customSkillDirs` 固定，persona 里写绝对路径 |

生成树里 `<pstack>/pstack/agents/*.md` 是本仓库维护的 **DSH 版说明文件**（不是可加载的 agent 定义），内容已去掉 Cursor slug 与 `~/.cursor/plugins/` 搜索逻辑。上游 README 的 `./agents/*.md` 链接因此在树内有效，不再被改写到 GitHub 上的 Cursor 原文。

## 模型路由

**优先级（从高到低）：用户当次点名 > 本表角色默认 > 省略（继承父会话模型）。**

用户在任务提示词里点名模型时（如"用 kimi 做交叉评审"），照用户的办：在 `subagent_pstack` 调用里传对应的 `provider` + `model`（+ 合理的 `reasoning_effort`），并在回复里说一句"按你的指定用了 X"。

未点名时按角色默认（本机 magpie 网关实测可用，2026-11 校订）：

| pstack 角色 | DSH provider + model | reasoning_effort | 说明 |
| --- | --- | --- | --- |
| 代码实现（feature / refactoring / bug-fix / perf / hillclimb） | `magpie` + `tokenrhythm/glm-5.3` | `max` | 主力模型，上下文 1M |
| prose 与 judgment（判断/文档/评审判断） | `magpie` + `tokenrhythm/glm-5.3` | `high` | 同模型降一档 |
| swarm worker（机械批量编辑/验证跑腿） | `magpie` + `group/deepseek-flash` | `high` | 快且便宜 |
| 交叉评审面板席位 1 | `magpie` + `tokenrhythm/kimi-k3` | `high` | 异家族视角 |
| 交叉评审面板席位 2 | `magpie` + `tokenrhythm/qwen3.8-flash` | `xhigh` | 异家族视角 |
| 交叉评审面板席位 3 | `magpie` + `trae-cn/glm-5.4-max` | `xhigh` | 同家族不同版本 |
| 交叉评委（arena 裁判） | `magpie` + `tokenrhythm/kimi-k3` | `high` | 不得与执行者是同一家族 |
| trivial 机械小改 | `magpie` + `group/deepseek-flash` | `low` | 省成本 |

规则：

- 三个字段必须一起传：`provider` 与 `model` 成对，`reasoning_effort` 出现时两者必须已在场；单独传 effort 会被拒绝。
- 传 `provider`+`model` 但不传 effort 时，该模型用自身默认档位。
- 白名单（`subagent-model-selection-settings`）外的模型调用会被拒绝：面板模型若被拒，按"席位1→席位2→席位3"顺序向下找白名单内的替代，并在回复里注明降级。
- 任何角色都不超过 `max` 档。
- `pstack-models.mdc` / `pstack-models.md` 规则文件在本移植中不存在：上表即权威路由。用户点名是唯一覆盖方式。

## setup-pstack

上游会探测 Cursor 模型并写 `~/.cursor/rules/pstack-models.mdc`。本移植用仓库维护的 **DSH 原生正文整体替换**了这个技能（它是 catalog 里唯一可见技能）：

- 不探测模型、不写任何规则文件（DSH 没有 `.mdc` 机制）；
- 把上面的路由表作为唯一权威，说明"用户点名 > 表默认 > 继承父模型"；
- 说明三种配置做法：任务里点名、改本路由表、把新模型加进 `subagent-model-selection-settings` 白名单（需新开会话）。

用户说"配置模型"时按该技能回答即可，不要执行上游的探测或写文件步骤。

## 路径映射

| Cursor | DSH |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `<项目>/.dsh/skills/`（项目级）或 `~/.dsh/skills/`（用户级） |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | DSH Plugins 页安装的 bundle；本包在 `D:\lib\deepseek-harness-plugins\pstack-dsh` |
| `~/.cursor/rules/*.mdc` 常驻规则 | `~/.dsh/AGENTS.md` 或项目 `AGENTS.md`。DSH 不读 `.mdc` |
| `agents/poteto-agent.md`, `agents/comment-sicko.md` | `<pstack>/pstack/agents/*.md`（DSH 版说明）；实际角色是 `cordis.patch.yml` 的两个 preset |
| pstack 技能正文里的 `https://github.com/cursor/plugins/blob/main/pstack/<path>` | 若 `<pstack>/pstack/<path>` 存在则读本地副本，否则才 fetch |
| 会话记录 `~/.cursor/projects/<slug>/agent-transcripts/` | DSH 会话日志在 `~/.dsh/sessions/<workdir-slug>/session-*.jsonl.zstd`；跨会话检索用 `session_search` 工具 |
| `.cursor/automations/benny/` | 不存在，见"Cursor 专属功能" |

## 指南与 README

`pstack/docs/guide/*.md` 与 `pstack/README.md` 保留上游原文，仅在 H1 后注入一段 DSH 覆盖说明。遇到这些 Cursor 表述时按下列处理：

| 原文 | DSH |
| --- | --- |
| `/add-plugin pstack` | 装 bundle：`dsh plugin --profile desktop add <pstack>`，或 DSH Web → Plugins → Add plugin → 本地目录 |
| `.cursor/skills/verify-<app>/` | `<项目>/.dsh/skills/verify-<app>/` |
| `~/.cursor/rules/pstack-models.mdc` | 不存在，见"模型路由"与"setup-pstack" |
| Option+Enter / Alt+Enter 常驻 Custom Mode | 无常驻；每个任务开始敲 `/poteto-mode`，同一会话内自然延续 |
| `/loop` | `create_goal` 近似（跨轮推进），或 `schedule_create`（定时，语义不同，需用户确认） |
| 上游 README 的 `/plugin …` 与 marketplace 说明 | 忽略，只用 DSH bundle 安装 |

## Cursor 专属功能（跳过规则）

DSH 没有 Cursor Automations、Bugbot、云端代理、Cursor Projects、内置 PR 工具、Custom Modes、`/loop`。当某个 playbook 步骤需要其中之一时，在回复里写一行 `Skipped in DSH: <步骤>. <原因>.` 然后继续下一步。不要停、不要问、不要重试。

| Cursor 能力 | DSH 替代或跳过 |
| --- | --- |
| Cursor Automations（routines、`update_state`、webhook 唤醒） | 跳过并注明。定时类需求可建议 `schedule_create`（语义不同，需用户确认） |
| Bugbot | 已有的 Bugbot 评论按普通 review 线程处理；"启动/等待/配置 Bugbot"的步骤跳过并注明 |
| 云端代理 / Cursor Projects | `environment: "cloud"` 映射为本地 `create_worktree`（见子代理字段表） |
| 内置 PR 工具 | `gh` CLI（`gh pr create/view/merge`），照 playbook 给的 forge 命令执行 |
| Custom Mode（Option+Enter 常驻 poteto-mode） | 无常驻。每个任务开始时由用户敲 `/poteto-mode`；连续任务可在同一会话内自然延续 |
| `/loop` 命令 | DSH 用 goal 机制（`create_goal`）或 `schedule_create` 近似：`create_goal` 能让同一会话跨轮推进，最接近 overnight 契约的"run until done" |
| `control-ui` / `control-cli` | 已 vendored 为普通技能（`<pstack>/pstack/skills/control-ui/` 等）；浏览器验证也可用已配置的 chromedevtools MCP 工具 |
| `/deslop` | 已 vendored 为 `deslop` 技能 |

## poteto-mode 的差异速览

供主会话按需查阅，不是必读：

- 隐藏技能（61 个）不进模型 catalog，`skill` 工具也不加载它们；路由一律走 `read` 文件。
- 子代理默认后台，`subagent_pstack` 默认 poteto-agent preset、可选 comment-sicko。
- playbook 步骤照抄进 `todo_write`；"open a todolist"即调用 `todo_write`。
- 会话/技能变更会被 watcher 感知，catalog 自动刷新——不需要"重启才能看到新技能"。
