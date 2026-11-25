# 移植决策记录

为什么这么做，以及为什么不那么做。考察对象：上游 pstack 0.15.48、社区移植 [l246804/dsh-pstack](https://github.com/l246804/dsh-pstack) 0.5.2、[@lqhl/dsh-pstack](https://github.com/lqhl/dsh-pstack) 0.1.5、[@paipaipai666/dsh-pstack](https://github.com/paipaipai666/dsh-pstack)。

## 决策一览

| # | 决策 | 理由 | 放弃的替代 |
|---|---|---|---|
| D1 | 零原生 JS，纯配置 bundle | 无第三方代码跑在 Host；DSH 升级仅影响 preset schema，几乎不坏 | l246804 的 4 个原生工具 + 配置 UI（强但维护面大，个人自用不需要） |
| D2 | pstack 0.15.48（本地镜像直接生成） | 比最好的社区移植（0.15.43）新 5 版；生成器钉住本地提交，随时可追 | submodule 钉上游（多一重 git 操作；镜像本来就在） |
| D3 | Host 层独立技能提供者（providerName: pstack） | 官方支持的部署级模式：进全局层，任何 preset 的会话都可见；与 standard 内置 provider 不冲突 | @lqhl 的"整 preset 替换"（preset 复制 standard 插件清单，DSH 升级就断） |
| D4 | 61 技能隐藏，`skill` 工具加载不到它们 | 与上游"单一入口"设计同构；catalog 只 1 行，token 最省。源码已验证 `dsh-tool-skill` 对隐藏技能抛错、目录只收 model-invocable | l246804 的 `pstack_skill` 原生工具（要写 JS） |
| D5 | 路由一律 `read` 文件（含 `../<name>/SKILL.md` 相对路径） | 技能正文里的相对路径原样有效（resourceBase=技能目录）；与上游 claude-code 适配表同款规则，上游已验证模型会照做 | — |
| D6 | poteto-agent / comment-sicko 做成 preset + `subagent_pstack` 委派工具 | `allowedAgentPresets` 让模型按 kickoff 需要选 preset；模型路由字段（modelSelection: true）复用 DSH 原生机制 | 自写 `pstack_subagent` 原生工具（重复造轮子） |
| D7 | 模型路由表硬编码本机 6 家族 | 用户点名 > 表默认 > 继承父模型；表是唯一权威，没有探测工具、没有规则文件 | `/setup-pstack` 写 mdc/md 规则（DSH 无 .mdc 机制；探测结果因人而异） |
| D8 | 面板用异家族席位：kimi-k3 + qwen3.8-flash + glm-5.4-max | 交叉评审的价值在异源视角；本机网关恰好有 6 家族，这是社区通用版做不到的 | 全 GLM（同源无交叉价值） |
| D9 | 评审席位同时进 `subagent-model-selection-settings` 白名单 | 白名单是会话创建时采样的，不在场=调用被拒；README 已写安装后必做 | — |
| D10 | vendored 3 技能（deslop/control-ui/control-cli）加 `disable-model-invocation` | 上游在 Cursor 自动触发；DSH 语义下自动触发会污染 catalog，手动 `/name` 才符合"每任务一次"的 pstack 精神 | 不 vendor（poteto-mode 的 Non-negotiables 引用它们） |
| D11 | Cursor 专属能力"跳过并注明"，不改 playbook 正文 | 上游为 Claude Code 建立的模式；生成器只注入一行适配指引，上游正文零改动，升级 diff 干净 | 逐 playbook 改写（539 文件的维护噩梦） |
| D12 | 生成器复刻上游 TERMS 检测逻辑 | 上游自己的分类器决定谁需要适配行（16 硬依赖 + 6 裸引用 = 22），比我自拟正则权威；两边树结构一致便于 diff | — |
| D13 | `/loop` 用 DSH goal 机制近似 | overnight 契约的"run until done"本质是跨轮推进；`create_goal` 的自动续轮最接近 | schedule_create（定时不是事件驱动） |

## 关键机制考证（源码级）

- `dsh-skill-filesystem`：一层深发现 `<root>/<name>/SKILL.md`；frontmatter 只取 name/description/whenToUse/invocation/metadata，`icon`/`color` 被忽略；驼峰遗留键（如 `disableModelInvocation`）会整个拒收——pstack 用 kebab-case，安全。
- `dsh-tool-skill`：目录只渲染 `isModelInvocable` 的技能；`skill` 工具对隐藏技能返回"not available for model invocation"；`/name` 手势扫用户消息全文（空白分界），注入位置在所有其他注入之后。
- `dsh-web-app/cordis.patch.yml` 注释原文："a host skill-filesystem row registers into its global layer"——D3 的部署级模式是官方认可的。
- `dsh-tool-subagent`：`agentPreset`/`allowedAgentPresets` 需 spawn 后端；`modelSelection: true` 暴露 provider/model/reasoning_effort；effort 必须与 provider+model 同场出现；白名单外路由被 LLM 适配器预检拒绝。
- 官方 `standard.patch.yml` 用 `!!js process.getBuiltinModule(...)` 解析包路径挂 bundledSkillDir——本包技能目录固定在安装盘，直接写字面路径更稳（不依赖 baseUrl 求值环境）。

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

- [ ] 实机验证：装 bundle → 新会话 → `/poteto-mode` 手势注入 → `subagent_pstack` 委派 → 面板席位路由（装好后逐项过）。
- [ ] `create_worktree` 的 sandbox 权限在 danger-full-access 下无需审批，workspace-write 下首次可能要批。
- [ ] 若未来 DSH 的 preset schema 变动，先跑 `dsh --profile desktop --dump-config` 看组合结果。
- [ ] 上游 pstack 升级时：镜像 `git pull` → 重生成 → `--check` 过 → 提交；适配表冲突时手工合并 `docs/harness/dsh.md`。
