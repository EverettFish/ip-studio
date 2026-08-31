# IP Studio

[在线使用](https://ipstudio.fun/) · [反馈问题](https://github.com/EverettFish/ip-studio/issues) · [参与开发](CONTRIBUTING.md)

把个人 IP 插画 Skill 变成普通用户可以直接使用的网页工作室：上传一次角色锚点，用短问卷一键生成文章配图、信息图、实拍融合、贴纸、文件夹图标、信纸、拍立得框、场景头像与表情包。

## 本地运行

需要 Node.js 22 和 npm。

```bash
npm ci
npm run dev
```

打开 `http://localhost:3000/`。项目不需要服务端环境变量；用户在页面中连接自己的 OpenAI API Key。

## 常用检查

```bash
npm test
npm run lint
npm run build
```

- `npm test`：验证身份锁、画风、输出清单与图片解码等关键逻辑。
- `npm run lint`：检查代码质量。
- `npm run build`：生成 GitHub Pages 使用的静态站点到 `out/`。
- `npm run build:standalone`：生成可单独分发的单文件网站到 `standalone/index.html`。

## 数据与隐私

- OpenAI API Key 不写入代码、仓库、URL 或数据库，只保存在当前标签页的 `sessionStorage`，八小时、关闭标签页或主动断开后失效。
- 浏览器使用用户自己的 Key 直接请求 OpenAI API，费用计入用户自己的 API 账户。
- 角色锚点和作品保存在当前浏览器的 IndexedDB。
- 仓库不保存用户上传的锚点、文章、参考图或生成作品。

## 协作与发布

完整源码位于 `main`。新改动应从短期功能分支提交 Pull Request；PR 会自动运行测试、代码检查和生产构建。合并到 `main` 后，GitHub Actions 自动构建并发布到 `ipstudio.fun`，不需要手动上传 `index.html`。

详细规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。
