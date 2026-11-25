# 移植决策记录

为什么这么做，以及为什么不那么做。考察对象：上游 pstack 0.15.48、社区移植 [l246804/dsh-pstack](https://github.com/l246804/dsh-pstack) 0.5.2、[@lqhl/dsh-pstack](https://github.com/lqhl/dsh-pstack) 0.1.5、[@paipaipai666/dsh-pstack](https://github.com/paipaipai666/dsh-pstack)。

## 决策一览

| # | 决策 | 理由 | 放弃的替代 |
|---|---|---|---|
| D1 | 零原生 JS，纯配置 bundle | 无第三方代码跑在 Host；DSH 升级仅影响 preset schema，几乎不坏 | l246804 的 4 个原生工具 + 配置 UI（强但维护面大，个人自用不需要） |
| D2 | pstack 0.15.48（本地镜像直接生成） | 比最好的社区移植（0.15.43）新 5 版；生成器钉住本地提交，随时可追 | submodule 钉上游（多一重 git 操作；镜像本来就在） |
| D3 | Host 层独立技能提供者（providerName: pstack） | 官方支持的部署级模式：进全局层，任何 preset 的会话都可见；与 standard 内置 provider 不冲突 | @lqhl 的"整 preset 替换"（preset 复制 standard 插件清单，DSH 升级就断） |
| D4 | 61 技能隐藏，`skill` 工具加载不到它们 | 与上游"单一入口"设计同构；catalog 只 1 行，token 最省。源码已验证 `dsh-tool-skill` 对隐藏技能抛错、目录只收 model-invocable | l246804 的 `pstack_skill` 原生工具（要写 JS） |
| D5 | 路由一律 `read` 文件（含 `../<name>/SKILL.md` 相对路径） | 技能正文里的相对路径原样有效（resourceBase=技能目录）；与上游适配表同款规则 | — |
| D6 | poteto-agent / comment-sicko 做成 preset + `subagent_pstack` 委派工具 | `allowedAgentPresets` 让模型按 kickoff 需要选 preset；模型路由字段（modelSelection: true）复用 DSH 原生机制 | 自写 `pstack_subagent` 原生工具（重复造轮子） |
| D7 | 模型路由表硬编码本机 6 家族 | 用户点名 > 表默认 > 继承父模型；表是唯一权威，没有探测工具、没有规则文件 | `/setup-pstack` 写 mdc/md 规则（DSH 无 .mdc 机制；探测结果因人而异） |
| D8 | 面板用异家族席位：kimi-k3 + qwen3.8-flash + glm-5.4-max | 交叉评审的价值在异源视角；本机网关恰好有 6 家族，这是社区通用版做不到的 | 全 GLM（同源无交叉价值） |
| D9 | 评审席位同时进 `subagent-model-selection-settings` 白名单 | 白名单是会话创建时采样的，不在场=调用被拒；README 已写安装后必做 | — |
| D10 | vendored 3 技能（deslop/control-ui/control-cli）加 `disable-model-invocation` | 上游在 Cursor 自动触发；DSH 语义下自动触发会污染 catalog，手动 `/name` 才符合"每任务一次"的 pstack 精神 | 不 vendor（`poteto-mode` 的 Non-negotiables 引用它们） |
| D11 | Cursor 专属能力"跳过并注明"，不改 playbook 正文 | 上游建立的模式；生成器只注入一行适配指引，上游正文零改动，升级 diff 干净 | 逐 playbook 改写（539 文件的维护噩梦） |
| D12 | 生成器复刻上游 TERMS 检测逻辑 | 上游自己的分类器决定谁需要适配行（16 硬依赖 + 6 裸引用 = 22），比我自拟正则权威；两边树结构一致便于 diff | — |
| D13 | `/loop` 用 DSH goal 机制近似 | overnight 契约的"run until done"本质是跨轮推进；`create_goal` 的自动续轮最接近 | `schedule_create`（定时不是事件驱动） |
| D14 | 上游 `agents/*.md` 不复制，改为本仓库 DSH 版说明 + 两个 preset | 上游文件含 `model: claude-opus-5-5-xhigh-fast` 与 `~/.cursor/plugins/` 搜索逻辑，DSH 既不加载也不该把 Cursor slug 留在树里；README 的 `./agents/*.md` 链接因此需要树内落点 | 原样复制（残留 Cursor 名称，链接被改写到 GitHub 上游）；完全不留文件（README 链接悬空） |
| D15 | `setup-pstack` 用 DSH 原生正文整体替换 | 它是 catalog 里唯一可见技能，却是"探测 Cursor 模型 + 写 `.mdc`"的死步骤，与 D7 的空操作定位矛盾；改成路由说明页才有发现价值 | 只注入一行"跳过"（模型仍会读一整页无效指令） |
| D16 | 每篇指南与上游 README 的 H1 后注入 DSH 覆盖说明 | 保留 D11 的"上游正文零改动"，同时让 `/add-plugin`、`.cursor/skills/`、`~/.cursor/rules/*.mdc`、Option+Enter、`/loop` 有明确落点；适配表新增"指南与 README"映射节 | 逐句改写正文（升级 diff 爆炸） |
| D17 | 只留一份技能树，`pstack/` 生成树随仓库分发 | 顶层 `skills/`（519 文件）与 `pstack/skills/` 字节完全相同却无人引用；`pstack/` 被 gitignore 时直接装 bundle 会得到空技能目录。入库后开箱即用，镜像只在重生成时需要 | 保留双树（重复且易漂移）；把顶层 `skills/` 设为唯一（要改 patch、persona 绝对路径与适配表全部路径） |

## 关键机制考证（源码级）

- `dsh-skill-filesystem`：一层深发现 `<root>/<name>/SKILL.md`；frontmatter 只取 name/description/whenToUse/invocation/metadata，`icon`/`color` 被忽略；驼峰遗留键（如 `disableModelInvocation`）会整个拒收——pstack 用 kebab-case，安全。
- `dsh-tool-skill`：目录只渲染 `isModelInvocable` 的技能；`skill` 工具对隐藏技能返回"not available for model invocation"；`/name` 手势扫用户消息全文（空白分界），注入位置在所有其他注入之后。
- `dsh-web-app/cordis.patch.yml` 注释原文："a host skill-filesystem row registers into its global layer"——D3 的部署级模式是官方认可的。
- `dsh-tool-subagent`：`agentPreset`/`allowedAgentPresets` 需 spawn 后端且 `allowedAgentPresets` 必须包含 `agentPreset`；`modelSelection: true` 暴露 provider/model/reasoning_effort；effort 必须与 provider+model 同场出现；白名单外路由被 LLM 适配器预检拒绝。本包 `cordis.patch.yml` 的字段逐项对照 README 的 config 表核过。
- `dsh-persona`：`prefix` + `complete: true` 把预设前缀作为该系统提示唯一段，必须挂在 preset 组合层内（挂全局会与 `dsh-system-prompt` 冲突）。
- 官方 `standard.patch.yml` 用 `!!js process.getBuiltinModule(...)` 解析包路径挂 bundledSkillDir——本包技能目录固定在安装盘，直接写字面路径更稳（不依赖 baseUrl 求值环境）。
- `pstack/README.md` 里 `./agents/*.md` 链接：生成器 `resolvePstack` 先查源 pstack 树，再查生成树 `has()`。DSH 版 agent 文件进树后，`has()` 为真，链接保持相对而不再改写到 GitHub。

## 与社区移植的对照

| 维度 | l246804 0.5.2 | @lqhl 0.1.5 | 本包 |
|---|---|---|---|
| pstack 版本 | 0.15.43 | 0.15.x | **0.15.48** |
| 原生 JS | 4 工具+UI | 少量 | **0** |
| 常驻方式 | JS 开关（Poteto workflow） | 整 preset 替换 | 手势注入（每任务一次） |
| 模型路由 | 探测+规则文件 | AGENTS.md 段落 | 硬编码表+点名覆盖 |
| 多家族面板 | 依部署而定 | 无 | **硬编码 6 家族** |
| catalog 占用 | 依配置 | 依 preset | **1 行** |

## 遗留事项

- [x] **模型路由表 ↔ profile 白名单不一致（2026-11-25 已按方案 A 解决）**：适配表「模型路由」用 `tokenrhythm/glm-5.3`、`tokenrhythm/kimi-k3`、`tokenrhythm/qwen3.8-flash`、`trae-cn/glm-5.4-max`、`group/deepseek-flash`；原白名单只有 `group/deepseek-flash` 与 `group/hy4-flash`。已把前四个模型补进 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `subagent-model-selection-settings.allowedModels`（共 6 条），README 的安装示例同步改为同一集合，异家族交叉评审面板得以保留。**白名单在顶层会话创建时采样，改动只对新会话生效**；面板席位路由仍待新会话验证。
- [x] **顶层会话实机验证（2026-11-25）**：在 lead（depth 0）用 `subagent_pstack` 完成三组验证：
  - `agent_preset: poteto-agent` + `group/deepseek-flash` → `started subagent agent-5`；子代理准确报出 persona 里的绝对路径 `…\pstack\skills\poteto-mode\SKILL.md`，`poteto-mode/SKILL.md` 的 DSH 适配行（第 11 行）逐字正确，工具集为 write / edit / pwsh 且无 bash（与 `disabled: !!js process.platform` 一致）。**preset 解析与 persona 生效均验证通过。**
  - `agent_preset: comment-sicko` + `group/deepseek-flash` → 只读约束在组合层真实生效：`write` / `edit` / `bash` / `pwsh` **全部没有**，`read` / `glob` / `grep` 有。
  - 同一会话内传 `magpie/tokenrhythm/glm-5.3` → `Error: child LLM route "magpie/tokenrhythm/glm-5.3" is not allowed for this Session`。这是**预期行为**：白名单在顶层会话创建时采样，方案 A 新增的路由只对新会话生效（DSH 文档原文："later settings edits affect only new Sessions"）。该错误同时反证了白名单校验链路正常工作。
- [x] **comment-sicko persona 一致性修复**：实机验证发现上游/本仓库 `agents/comment-sicko.md` 里的标志性首句 `Yes... Ha ha ha... Yes!` 没有写进 `cordis.patch.yml` 的 `persona.prefix`，实际运行的 preset 不输出它。已补进 persona，重装后新子代理首句即为该句。
- [ ] **【重要运维事实】bundle 内 `cordis.patch.yml` 的变更不会被 HMR 热重载**：改完 patch 直接重装会被 `already-installed` 拒绝；正确流程是 `remove_bundle` → `install_bundle`。实测：改 persona 后未重装时新子代理仍读到旧 persona，remove + reinstall 后立即读到新 persona。**升级本包或修改 preset/persona 后都必须走这两步。**
- [ ] `create_worktree` 的 sandbox 权限在 danger-full-access 下无需审批，workspace-write 下首次可能要批。
- [ ] 若未来 DSH 的 preset schema 变动，先跑 `dsh --profile desktop --dump-config` 看组合结果。
- [ ] 上游 pstack 升级时：镜像 `git pull` → 重生成 → `--check` 过 → 提交；适配表冲突时手工合并 `docs/harness/dsh.md`。
- [x] 消除顶层 `skills/` / `docs/guide/` 重复副本，`pstack/` 生成树入库（D17）。
- [x] agent 定义落地、setup-pstack 原生正文、指南/README 覆盖说明（D14–D16）。
- [x] **实机安装验证（2026-11-25）**：`plugin_manager install_bundle` 返回 `application: applied` / `enabled: true` / warnings 空；profile `package.json` 出现 `link:D:/lib/deepseek-harness-plugins/pstack-dsh`；`list_plugins` 里 `skill-filesystem-pstack`、`tool-subagent-pstack`、`preset-poteto-agent`、`preset-comment-sicko` 四行全部 `enabled: true / fiberPhase: active`；安装后 skill catalog 只新增 `setup-pstack` 一行（61 个隐藏技能未进 catalog）；`skill` 工具加载 `setup-pstack` 成功且 Base directory 为 `…/pstack/skills/setup-pstack`，证明 `customSkillDirs` 的 Windows 绝对路径解析、第二个 filesystem provider 与默认 provider 并存、隐藏策略均生效；patch 的 16 个包 + `cordis:group` 经各包 README 逐字段核对，无会导致加载/激活失败的确定问题（required 字段齐全，`!!js` / group / isolate 与官方 `standard.patch.yml` 一致）。
- [ ] **渲染显示未验证**：Web GUI 新标签需要带认证的 URL，直接打开返回 `dsh web authentication required`，未能看到 Plugins 页里的标题/描述/图标。已核对资源：locale en/zh 的 `meta.title` 均为 `pstack-dsh`，description 分别 233 / 137 字符，`meta.detail` 未设置（详情页回退 package README）；`icon.svg` 735 字节合法 SVG，无外部引用；`exports` 含 `./locale/*.json` 与 `./icon`，`files` 全覆盖。
