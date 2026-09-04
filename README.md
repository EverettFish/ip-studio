# IP Studio

[在线使用](https://ipstudio.fun/) · [反馈问题](https://github.com/EverettFish/ip-studio/issues) · [参与开发](CONTRIBUTING.md)

把个人 IP 插画 Skill 变成普通用户可以直接使用的网页工作室：上传一次角色锚点，用短问卷一键生成文章配图、信息图、实拍融合、贴纸、文件夹图标、信纸、拍立得框、场景头像与表情包。

## 本地运行

需要 Node.js 22 和 npm。

```bash
npm ci
npm run dev
```

打开 `http://localhost:3000/`。项目不需要服务端环境变量；用户可以在页面中选择 OpenAI 官方、观猹 TokenDance，或自行填写兼容 API。

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

- API Key 不写入代码、仓库、URL 或数据库，只保存在当前标签页的 `sessionStorage`，八小时、关闭标签页或主动断开后失效。
- 浏览器使用用户自己的 Key 直接请求所选模型服务，费用计入用户自己的服务商账户。
- TokenDance 支持 S256 PKCE 授权、余额显示与用户明确确认后的支付宝充值；自定义接口仅接受 HTTPS（本机 localhost 除外）。
- 角色锚点和作品保存在当前浏览器的 IndexedDB。
- 仓库不保存用户上传的锚点、文章、参考图或生成作品。

## API 怎么填写

- 生图必须配置有图生图/参考图编辑能力的模型。聊天模型或只能识图的模型不能代替生图模型。
- TokenDance：在当前标签页完成授权；生图选择 Seedream 5.0 Lite / Pro。可先点“检查 TokenDance 网络”，不产生费用。
- 其他 API：依次填写生图 Key、Base URL、精确模型 ID 和参考图协议。支持 OpenAI `/images/edits` 与 Ark `/images/generations`；不支持任意厂商私有协议。
- 只有生图 API：选择“本地按原文分段”，头像、贴纸等无需文字模型；文章类按原文分段交给生图模型，不执行 AI 摘要。
- 需要 AI 文章规划：单独启用文字模型。文字服务可以用另一家地址和 Key，不会把生图 Key 隐式转交给另一家。
- 自定义接口缺少 `/models` 不阻止保存。保存不代表出图成功，可明确确认后执行“测试生成 1 张”（会消耗用户额度）。
- 自定义服务必须支持浏览器 CORS；只允许服务端调用的 API 无法在纯静态站直接连接。
- 网站和单文件版共用 `lib/security-policy.json`：仅网络连接允许 HTTPS 自配地址，脚本等其他 CSP 限制保持不变。

## 协作与发布

完整源码位于 `main`。新改动应从短期功能分支提交 Pull Request；PR 会自动运行测试、代码检查和生产构建。合并到 `main` 后，GitHub Actions 自动构建并发布到 `ipstudio.fun`，不需要手动上传 `index.html`。

详细规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。
