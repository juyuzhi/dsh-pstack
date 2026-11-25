# pstack-dsh

把 [pstack](https://github.com/cursor/plugins/tree/main/pstack)（poteto 的严谨工程工作流：`/poteto-mode` + 22 个 playbook + 24 条原则）移植到 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**个人定制版**。基于上游 pstack 0.15.48（比现有社区移植新 5 个版本），零原生 JS，纯配置 bundle。

## 这个移植的三个特点

1. **零原生代码**：只声明配置——一个技能提供者、两个子代理 preset、一个委派工具。没有 JS 跑在你的 DSH Host 进程里，DSH 升级几乎不会弄坏它。
2. **61 个技能对模型目录隐藏**（上游设计 + DSH `disable-model-invocation` 语义完全对齐）：模型 catalog 只多一行 `setup-pstack`，token 成本接近零。路由靠 `/poteto-mode` 手势注入和 `read` 读文件。
3. **多家族评审面板**：模型路由表针对本机 magpie 网关的 6 个模型家族定制（GLM / Kimi / Qwen / DeepSeek / Hy4 / MiMo），arena / interrogate 的交叉评审用异家族席位（Kimi K3 + Qwen3.8 + GLM-5.4-max），这是上游多厂商面板精神在单网关上的落地。

## 安装

```sh
# 方式一：命令行
dsh plugin --profile desktop add D:\lib\deepseek-harness-plugins\pstack-dsh

# 方式二：DSH Web UI → Plugins → Add plugin → 本地目录
```

安装后**需要补一步**：把面板模型加进子代理白名单。编辑 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `subagent-model-selection-settings` 段：

```yaml
- id: subagent-model-selection-settings
  name: "@deepseek-ai/dsh-tool-subagent/model-selection-settings"
  config:
    enabled: true
    allowedModels:
      - provider: magpie
        model: group/deepseek-flash
      - provider: deepseek-account
        model: deepseek-flash
      # ↓ pstack-dsh 面板席位
      - provider: magpie
        model: tokenrhythm/kimi-k3
      - provider: magpie
        model: tokenrhythm/qwen3.8-flash
      - provider: magpie
        model: trae-cn/glm-5.4-max
      - provider: magpie
        model: tokenrhythm/glm-5.3
```

然后**新开会话**（模型白名单是会话创建时采样的）。

## 使用

```text
/poteto-mode 这个 PR 有个滚动漂移 bug，先复现，再修复并验证
```

- `/poteto-mode` 开任务；playbook 步骤进 todo list；其余技能按步骤用 `read` 加载。
- 子代理委派自动走 `subagent_pstack`（默认 poteto-agent preset）。
- **临时改模型**：任务里点名即可，如 `/poteto-mode 用 kimi 做交叉评审，检查这段代码`——用户点名优先于路由表默认值。
- 评审面板默认席位见 [适配表](docs/harness/dsh.md#模型路由)。

## 仓库结构

```
cordis.patch.yml          # bundle 声明：技能提供者 + 2 preset + 委派工具
docs/harness/dsh.md       # DSH 适配表（模型路由、工具映射、跳过规则）★核心
docs/porting-log.md       # 移植决策记录
scripts/generate.mjs      # 生成器：从 cursor/plugins 镜像产出 pstack/ 树
scripts/check-patch.mjs   # cordis.patch.yml 结构自检（零依赖）
pstack/                   # ← 生成物，勿手改；重生成会清空重建（已 gitignore，克隆后需重生成）
  skills/                 #   62 个技能（59 上游 + 3 vendored）
  docs/guide/             #   上游指南（技能内链接指向它）
  docs/harness/dsh.md     #   适配表副本（22 个技能的注入行指向它）
```

## 更新上游版本

```sh
cd D:\笔记\plugins && git pull          # 更新 cursor/plugins 镜像
cd D:\lib\deepseek-harness-plugins\pstack-dsh
node scripts/generate.mjs               # 重新生成（校验失败会拒绝写出）
node scripts/generate.mjs --check       # CI 用：校验树与源同步
node scripts/check-patch.mjs cordis.patch.yml
git add -A && git commit -m "chore: regen from pstack <version>"
```

> `pstack/` 是生成物且已 gitignore：**克隆本仓库后必须先跑一次 `node scripts/generate.mjs`**（需要本地 cursor/plugins 镜像，见生成器头部 SRC 常量）。安装 DSH bundle 用的是本地目录，与 git 无关。

## 已知边界（与上游/DSH 的差异）

- 无 Cursor Automations / Bugbot / 云端代理 / Projects / Custom Mode / `/loop`：适配表规定"跳过并注明一行"，playbook 不中断（`/loop` 的 overnight 契约用 DSH goal 机制近似）。
- `setup-pstack` 保留为 catalog 里唯一可见技能（发现入口），但它在本移植中是空操作：路由表即权威，见适配表"setup-pstack"节。
- vendored 的 `deslop` / `control-ui` / `control-cli` 来自 cursor-team-kit，加了 `disable-model-invocation`（上游在 Cursor 是自动触发，这里改为手动 `/name`）。
- 若卸载本 bundle，`subagent_pstack` 工具与两个 preset 随之消失；技能目录里的 `pstack` 子树可整体删除。

## 许可

本仓库新增代码 MIT。`pstack/` 树内是上游 pstack（MIT, © Lauren Tan）与 cursor-team-kit（MIT）的内容，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
