# pstack 在 DeepSeek Harness (DSH) 中的适配表

pstack 技能使用 Cursor 术语。在 DSH 中，每个会话先读一次本文件，然后用下面的表把技能里的 Cursor 名字映射为 DSH 等价物。`<pstack>` 指 pstack-dsh 安装目录（本文件的 `../../..`）。若某个 Cursor 字段在表中没有对应行，丢弃它并在回复中说明一行。绝不把工具 schema 会拒绝的字段或值传给工具。

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

上游的 `/setup-pstack` 探测 Cursor 模型并写规则文件。本移植**跳过该技能**：模型路由已写死在上表与 `cordis.patch.yml`。用户说"配置模型"时，回答路由表内容与"在任务里点名即可覆盖"，不生成任何文件。

## 路径映射

| Cursor | DSH |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `<项目>/.dsh/skills/`（项目级）或 `~/.dsh/skills/`（用户级） |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | DSH Plugins 页安装的 bundle；本包在 `D:\lib\deepseek-harness-plugins\pstack-dsh` |
| `~/.cursor/rules/*.mdc` 常驻规则 | `~/.dsh/AGENTS.md` 或项目 `AGENTS.md`。DSH 不读 `.mdc` |
| pstack 技能正文里的 `https://github.com/cursor/plugins/blob/main/pstack/<path>` | 若 `<pstack>/pstack/<path>` 存在则读本地副本，否则才 fetch |
| 会话记录 `~/.cursor/projects/<slug>/agent-transcripts/` | DSH 会话日志在 `~/.dsh/sessions/<workdir-slug>/session-*.jsonl.zstd`；跨会话检索用 `session_search` 工具 |
| `.cursor/automations/benny/` | 不存在，见"Cursor 专属功能" |

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

- 隐藏技能（58 个）不进模型 catalog，`skill` 工具也不加载它们；路由一律走 `read` 文件。
- 子代理默认后台，`subagent_pstack` 默认 poteto-agent preset、可选 comment-sicko。
- playbook 步骤照抄进 `todo_write`；"open a todolist"即调用 `todo_write`。
- 会话/技能变更会被 watcher 感知，catalog 自动刷新——不需要"重启才能看到新技能"。
