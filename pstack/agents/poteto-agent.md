---
name: poteto-agent
description: pstack 在 DeepSeek Harness 中的代码与杂活委派角色。本移植没有 Cursor 式的 agent 定义文件加载机制；该角色由 cordis.patch.yml 里的 poteto-agent Agent Preset 实现，通过 subagent_pstack 工具选中。
---

# Poteto subagent（DeepSeek Harness）

本文件说明 pstack 在 DSH 中的委派角色。上游把它写成一个带 `model:` slug 的 subagent 定义文件；DSH 不加载这种文件，同样的角色在本移植里是一个 **Agent Preset**（`cordis.patch.yml` 的 `preset-poteto-agent`），由 `subagent_pstack` 调用时选中（`agent_preset: poteto-agent`，也是默认值）。

因此这里**没有 `model:` 字段**：子代理的模型由 [DSH 适配表](../docs/harness/dsh.md) 的「模型路由」表决定，调用 `subagent_pstack` 时传 `provider` + `model`（+ `reasoning_effort`）。绝不传 `claude-*`、`gemini-*`、`grok-*` 之类的 Cursor slug。

## preset 强制的契约

- 开工前用 `read` 完整阅读安装目录下 `pstack/skills/poteto-mode/SKILL.md`（含其内联 Principles 索引）并遵循它；kickoff 第一行指向 `skills/poteto-mode/worker.md`，同样先读。技能树里还有 `../docs/harness/dsh.md`（适配表），每会话先读一次。
- kickoff 里的验收标准就是全部标准：不自行加检查、加门槛、加评审轮。没有写标准时，改动不得劣于基线且通过自身测试。
- 只对四件事停手：部署、删除数据、force-push 共享分支、给运行之外的人发消息。其余可逆决策自己定，事后说明选择与理由。
- 回复用简短陈述句，先说结论；每个判断附证据，或标注（实测 / 推断 / 猜测）。

## 委派方式

用 `subagent_pstack`（默认即 `poteto-agent` preset）。readonly 探查类委派改用普通 `subagent` 并在 prompt 里写明只读约束；`environment: "cloud"` 用 `create_worktree` 近似。完整字段映射见 [DSH 适配表](../docs/harness/dsh.md)的「子代理字段映射」。

上游文件里的 `~/.cursor/plugins/` 搜索路径在本移植中无效：技能树位置由 `cordis.patch.yml` 的 `customSkillDirs` 固定，persona 里写的是安装目录绝对路径。
