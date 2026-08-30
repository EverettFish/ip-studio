# IP Studio

把「萌粒风个人 IP 全套」Skill 变成普通用户也能直接使用的网页工作室。

## 本地启动

1. 复制 `.env.example` 为 `.env.local`，填入一个至少 32 字节的随机会话密钥。
2. 安装依赖：`npm install`
3. 启动开发环境：`npm run dev`
4. 打开 `http://localhost:3000`

网站使用纯静态托管，不依赖 ChatGPT Sites。用户的 OpenAI API Key 不写入代码、仓库、URL 或数据库，只保存在当前标签页的 `sessionStorage`，8 小时、关闭标签页或主动断开后失效。浏览器会用该 Key 直接请求 OpenAI API；角色锚点和作品保存在当前浏览器的 IndexedDB。

## 支持的功能

- 角色锚点一次上传、长期复用
- 文章粘贴与 TXT / Markdown / DOCX 拖拽导入
- 文章配图、信息图、实拍融合、贴纸、文件夹图标、信纸、拍立得框、场景头像、表情包、表情包夺舍
- GPT Image 2 生成与多参考图编辑
- 多图顺序队列、失败单张重试、本地作品簿与 ZIP 打包下载

## 部署注意

- 必须通过 HTTPS 部署。
- 生产环境必须设置 `IP_STUDIO_SESSION_SECRET`，不要使用仓库中的示例值。
- 反向代理需要允许图像请求所需的上传大小和较长响应时间。
- 本项目不会替用户承担 API 费用；请求计入用户自己连接的 OpenAI API 账户。
