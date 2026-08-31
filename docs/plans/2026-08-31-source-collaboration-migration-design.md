# GitHub 源码协作迁移设计

## 目标

把电脑上的完整 Next.js 源码与 GitHub 上现有的单文件部署历史合并为一个可协作仓库。`main` 成为唯一可信源码，保留双方既有提交，不使用强制推送；线上域名继续使用 `ipstudio.fun`。

## 工作流

贡献者从 `main` 创建短期 `feature/*` 或 `fix/*` 分支，通过 Pull Request 讨论和评审。PR 自动执行依赖安装、测试、代码检查和生产构建。合并进入 `main` 后，Pages 工作流重新执行同一组检查，把 Next.js 静态导出目录作为部署产物发布。仓库不再手动维护压缩后的根目录 `index.html`。

## 仓库治理

仓库提供贡献指南、Pull Request 模板、Bug 与功能 Issue 表单，以及由 `@EverettFish` 负责的 CODEOWNERS。`config/`、环境变量、构建产物和依赖目录保持忽略，避免上传本机路径、密钥或重复产物。后续为 `main` 启用规则集，禁止强制推送并要求 PR 与自动检查通过；自定义域名由 GitHub Pages 设置管理。
