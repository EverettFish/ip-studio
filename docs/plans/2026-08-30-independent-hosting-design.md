# IP Studio 脱离 ChatGPT Sites 的独立托管设计

## 目标

`ipstudio.fun` 不再指向 `chatgpt.site`、ChatGPT Sites 或其 Cloudflare 防护链路。网站改为静态 Next.js 导出，由 GitHub Pages 托管；自定义域名继续使用 `ipstudio.fun`。所有创作、锚点和作品簿功能保留。

## 客户端数据流

角色锚点和成功作品继续保存在浏览器 IndexedDB。用户自己的 OpenAI API Key 改为仅保存在当前标签页的 `sessionStorage`，最长八小时；关闭标签页、主动断开或过期后清除。Key 不写入代码、仓库、URL、日志、长期本地存储或第三方统计服务。

文章规划和图像生成由浏览器直接调用 OpenAI API。锚点仍强制作为第一张图，固定萌粒风策略仍在最终请求前注入；文章内容和后续参考图不能覆盖身份规则。上传类型、大小、锚点必填和参考图顺序继续在客户端检查。浏览器直连的代价是：Key 可被用户自己的浏览器开发工具看到，因此页面明确提示只在私人设备使用、不要共享标签页。

## 构建与托管

Next.js 使用 `output: "export"` 生成纯静态 `out/`。删除所有服务端 API 路由和 ChatGPT Sites 配置，增加 GitHub Pages 工作流；每次推送主分支自动构建并发布。GitHub Pages 仓库设置中绑定 `ipstudio.fun`，随后把阿里云 DNS 从 ChatGPT Sites 的两个 A 记录切换为 GitHub Pages 官方的四个 A 记录。域名切换只在新站已经成功发布、默认 `github.io` 地址可访问后进行。

## 验证

- 单元测试验证 Key 会话过期、锚点排序、固定萌粒风和生成结果解析。
- 生产构建必须产生 `out/index.html`，且不包含 `/api/` 依赖或 ChatGPT Sites 配置。
- 先检查 GitHub Pages 默认地址，再切换 DNS，最后验证 `https://ipstudio.fun`、静态资源和 HTTPS。
