---
name: setup-pstack
description: pstack 在 DeepSeek Harness 中的模型路由说明与配置入口。查看每个角色用哪个 provider/model/reasoning_effort、如何在任务里点名覆盖、如何新增模型席位。Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack（DeepSeek Harness）

本技能是 pstack-dsh 在模型 catalog 里**唯一可见**的技能（62 个技能里其余 61 个带 `disable-model-invocation: true`，靠 `/name` 手势或 `read` 加载）。上游它会探测 Cursor 模型并写 `~/.cursor/rules/pstack-models.mdc`；**DSH 没有 `.mdc` 机制，本移植不写任何规则文件**，探测步骤和规则文件步骤全部不存在。

## 权威路由表

模型路由是本仓库维护的一张表，位置：[DSH 适配表 → 模型路由](../../docs/harness/dsh.md#模型路由)。它按角色给出 `provider` + `model` + `reasoning_effort`：代码实现、prose 与 judgment、swarm worker、三个交叉评审席位、arena 裁判、trivial 机械小改。

优先级从高到低：

1. **用户当次点名**（如「用 kimi 做交叉评审」）——在 `subagent_pstack` 调用里传对应的 `provider` + `model`，并说明一句。
2. **路由表角色默认**。
3. **省略**——继承父会话模型。

传法：`provider` 与 `model` 必须成对；`reasoning_effort` 单独传会被拒绝。任何角色不超过 `max` 档。

## 三种「配置」做法

- **临时改一次**：任务里点名即可，不改任何文件。这是推荐做法。
- **改默认**：编辑 `docs/harness/dsh.md` 的路由表。改完无需重启，适配表是按需 `read` 的纯文本。
- **加新模型**：新模型若不在 `subagent-model-selection-settings` 的 `allowedModels` 白名单里，调用会被拒绝。编辑 `~/.dsh/profiles/<profile>/cordis.patch.yml` 的 `subagent-model-selection-settings` 段加入 `{ provider, model }`，然后**新开会话**（白名单在创建会话时采样）。白名单之外的席位会按适配表的降级顺序找替代。

## 不要做的事

- 不要生成 `pstack-models.mdc` / `pstack-models.md` 或任何 `AGENTS.md` 段落；本移植以适配表为唯一权威。
- 不要调用模型探测工具去枚举 slug，也不要把探测结果写进文件。
- 不要给用户一段"已写入规则、新会话生效"的回复——那是上游行为。

如果用户想了解某个技能怎么用，指向 `/poteto-help`；如果想看全部约定，读 [DSH 适配表](../../docs/harness/dsh.md)。
