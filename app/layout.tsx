import type { Metadata } from "next";
import "./globals.css";
import security from "@/lib/security-policy.json";

export const metadata: Metadata = {
  title: "IP Studio｜一个角色，长出整个内容世界",
  description: "上传一次角色锚点，用短问卷一键生成文章配图、信息图、贴纸、头像与更多个人 IP 素材。",
  icons: { icon: "/credits/everettfish.webp" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={security.csp}
        />
        <meta name="referrer" content="no-referrer" />
      </head>
      <body>{children}</body>
    </html>
  );
}
