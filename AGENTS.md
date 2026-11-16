## Agent skills

### Issue tracker

Issue 以本地 Markdown 文件跟踪，位于 `.scratch/<feature>/issues/`。详见 `docs/agents/issue-tracker.md`。

### Domain docs

采用 single-context：使用根目录 `GLOSSARY.md` 和相关 `docs/adr/`。详见 `docs/agents/domain.md`。

## 实现与提交

- 以 ticket 为交付单位：一个 ticket = 一个可独立验收的功能点 = 一个 commit。
- 每个 ticket 用 `tdd` 实现：先与用户确认测试 seam，再按 red → green 推进，一次一个垂直切片。
- ticket 完成标准：
  - 验收标准逐条通过；
  - 新增测试覆盖这些验收标准，并且在实现前是红的、实现后转绿；
  - 纯重构或预重构 ticket 不要求新增红测试，要求现有测试保持绿。
- 通过验收后立即提交。提交前运行项目已有的测试和类型检查命令；全量测试在最终提交前跑一次。
- 一个 commit 只包含该 ticket 的改动。需要 prefactor 或顺手修复时，先单独开 ticket 并单独提交，再提交功能。
- 不要格式化、重排或顺手修改与 ticket 无关的文件。
- commit message 采用 Conventional Commits：type/scope 用英文，描述用中文，末尾带 ticket id。例如：
  - `feat(export): 支持 CSV 导出 (#12)`
  - `fix(auth): 修复 token 过期后未刷新 (#34)`
  - `refactor(order): 抽出订单金额计算 (#56)`
- 提交留在本地；仅当用户明确要求时 push。
- 所有 ticket 完成后，用 `code-review` 以 `main`（或分支起点）为 fixed point，对照 spec 审查整个分支。
