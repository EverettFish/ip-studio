"use client";

/* eslint-disable @next/next/no-img-element -- The studio renders user Blob URLs and arbitrary generated images. */

import {
  AlertCircle,
  Aperture,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Download,
  FileImage,
  FileText,
  FolderArchive,
  Frame,
  GalleryHorizontalEnd,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Plus,
  Rows3,
  Shapes,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Sticker,
  Trash2,
  UploadCloud,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import type { ComponentType, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import type {
  AnchorRecord,
  AnchorStyleId,
  ArtworkRecord,
  GenerationJob,
  JobState,
  WorkflowConfig,
  WorkflowId,
} from "@/lib/types";
import { ANCHOR_STYLE_PRESETS, getAnchorStylePreset } from "@/lib/anchor-styles";
import {
  completeTokenDanceAuthorization,
  forgetAiConnection,
  hasTokenDanceAuthorizationCallback,
  rememberAiConnection,
  restoreAiConnection,
  type AiConnection,
  usesApiPlanning,
} from "@/lib/ai-provider";
import {
  buildStaticJobs,
  defaultConfig,
  estimateCount,
  workflowDefinitions,
  workflowMap,
} from "@/lib/workflows";
import {
  clearArtworks,
  getAnchor,
  listArtworks,
  removeAnchor,
  removeArtwork,
  saveAnchor,
  saveArtwork,
} from "@/lib/db";
import {
  browserApiError,
  convertBrowserAnchor,
  generateBrowserImage,
  planBrowserJobs,
} from "@/lib/browser-openai";
import { ProviderModal } from "@/components/ProviderModal";

const iconMap: Record<WorkflowId, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  anchor: UserRound,
  article: BookOpen,
  infographic: Rows3,
  photo: Camera,
  stickers: Sticker,
  folders: FolderArchive,
  letter: FileText,
  polaroid: Frame,
  avatars: Aperture,
  expressions: SmilePlus,
  possession: Shapes,
};

const demoArt = [
  { src: "/art/gallery/article-scene.webp", title: "把观点变成小故事", tag: "文章配图" },
  { src: "/art/gallery/infographic.webp", title: "结构自己站出来", tag: "文章信息图" },
  { src: "/art/gallery/photo-fusion.webp", title: "IP 走进真实场景", tag: "实拍融合" },
  { src: "/art/gallery/stickers.webp", title: "一整页可爱日常", tag: "贴纸套装" },
  { src: "/art/gallery/folders.webp", title: "桌面也有角色分身", tag: "文件夹图标" },
  { src: "/art/gallery/avatars.webp", title: "同一个人，不同状态", tag: "场景头像" },
];

const studioCredits = [
  { name: "EverettFish", role: "作者", avatar: "/credits/everettfish.webp", href: "https://xhslink.cn/o/foXMrwFgKD" },
  { name: "OCunning_Lúc", role: "特别鸣谢", avatar: "/credits/ocunning-luc.webp", href: "https://xhslink.cn/o/4TKWMO7cn6Z" },
  { name: "TATALAB", role: "特别鸣谢", avatar: "/credits/tatalab.webp", href: "https://xhslink.cn/o/5XBuJN9C1yr" },
  { name: "摸鱼小李", role: "特别鸣谢", avatar: "/credits/moyu-xiaoli.webp", href: "https://xhslink.cn/o/9KKFHO3TH0r" },
  { name: "是金三啊", role: "特别鸣谢", avatar: "/credits/shi-jinsan.webp", href: "https://xhslink.cn/o/92QGZ0jwD1u" },
  { name: "水的离子积", role: "特别鸣谢", avatar: "/credits/shui-liziji.webp", href: "https://xhslink.cn/o/2rR7aTmN1P7" },
  { name: "99m-AIGC", role: "特别鸣谢", avatar: "/credits/99m-aigc.webp", href: "https://xhslink.cn/o/9fdvobSWLjs" },
];

const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function useBlobUrl(blob?: Blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ""), [blob]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

function BlobArtwork({ artwork }: { artwork: ArtworkRecord }) {
  const url = useBlobUrl(artwork.blob);
  return url ? <img src={url} alt={artwork.title} /> : <div className="image-skeleton" />;
}

function SourceThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useBlobUrl(file);
  return (
    <div className="source-thumb">
      {url && <img src={url} alt={file.name} />}
      <button type="button" onClick={onRemove} aria-label={`移除 ${file.name}`}>
        <X size={13} />
      </button>
      <span>{file.name}</span>
    </div>
  );
}

function CreditsMarquee() {
  return (
    <section className="credits-marquee" aria-label="IP Studio 作者与特别鸣谢">
      <div className="credits-intro"><span>MADE WITH FRIENDS</span><strong>作者与特别鸣谢</strong></div>
      <div className="credits-viewport">
        <div className="credits-track">
          {[0, 1].map((group) => (
            <div className="credits-group" aria-hidden={group === 1} key={group}>
              {studioCredits.map((person) => (
                <a href={person.href} target="_blank" rel="noopener noreferrer" tabIndex={group === 1 ? -1 : undefined} className="credit-person" key={`${group}-${person.name}`}>
                  <img src={person.avatar} alt="" />
                  <span><small>{person.role}</small><strong>@{person.name}</strong></span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StudioShell() {
  const [view, setView] = useState<"studio" | "gallery">("studio");
  const [mobileNav, setMobileNav] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRecord>();
  const [artworks, setArtworks] = useState<ArtworkRecord[]>([]);
  const [connection, setConnection] = useState<AiConnection>();
  const [apiOpen, setApiOpen] = useState(false);
  const [apiAuthorizationMessage, setApiAuthorizationMessage] = useState("");
  const [anchorOpen, setAnchorOpen] = useState(false);
  const [pendingAnchorFile, setPendingAnchorFile] = useState<File>();
  const [pendingAnchorStyle, setPendingAnchorStyle] = useState<AnchorStyleId>("original");
  const [anchorConverting, setAnchorConverting] = useState(false);
  const [resumeAnchorAfterApi, setResumeAnchorAfterApi] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<WorkflowId>("article");
  const [configByRoute, setConfigByRoute] = useState<Record<WorkflowId, WorkflowConfig>>(() =>
    Object.fromEntries(workflowDefinitions.map((route) => [route.id, defaultConfig(route)])) as Record<WorkflowId, WorkflowConfig>,
  );
  const [article, setArticle] = useState("");
  const [articleName, setArticleName] = useState("");
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [jobs, setJobs] = useState<JobState[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const previewUrls = useRef(new Set<string>());
  const oauthHandled = useRef(false);
  const anchorUrl = useBlobUrl(anchor?.blob);
  const pendingAnchorUrl = useBlobUrl(pendingAnchorFile);
  const connected = Boolean(connection?.apiKey);

  const active = workflowMap[activeId];
  const activeConfig = configByRoute[activeId];
  const anchorStyle = getAnchorStylePreset(anchor?.styleId);
  const estimatedCount = estimateCount(activeId, activeConfig, sourceFiles.length);
  const hasPrimaryInput = Boolean(active.needsArticle || active.needsSources);
  const configStep = hasPrimaryInput ? 2 : 1;
  const previewStep = hasPrimaryInput ? 3 : 2;
  const outputPreviewTitles = useMemo(() => {
    if (activeId === "article") {
      return Array.from({ length: Number(activeConfig.count || 5) }, (_, index) => `文章配图 ${index + 1} · 生成时按内容命名`);
    }
    if (activeId === "infographic") {
      if (activeConfig.pages === "auto") return ["信息图页数与标题 · 根据文章自动判断"];
      return Array.from({ length: Number(activeConfig.pages || 1) }, (_, index) => `文章信息图 ${index + 1} · 生成时按内容命名`);
    }
    if (active.needsSources && sourceFiles.length === 0) {
      return [`添加${active.sourceLabel || "参考图"}后，将按文件逐张命名`];
    }
    return buildStaticJobs(activeId, activeConfig, sourceFiles.length).map((item) => item.title);
  }, [active, activeConfig, activeId, sourceFiles.length]);

  useEffect(() => {
    setConnection(restoreAiConnection());
    void Promise.all([getAnchor(), listArtworks()]).then(([storedAnchor, storedArtworks]) => {
      setAnchor(storedAnchor);
      setArtworks(storedArtworks);
    });
    if (hasTokenDanceAuthorizationCallback() && !oauthHandled.current) {
      oauthHandled.current = true;
      setApiOpen(true);
      setNotice("正在完成 TokenDance 授权…");
      setApiAuthorizationMessage("正在交换 TokenDance 授权，请稍候…");
      void completeTokenDanceAuthorization()
        .then((authorized) => {
          rememberAiConnection(authorized);
          setConnection(authorized);
          setNotice("TokenDance 已连接，可以查看余额并开始创作。");
          setApiAuthorizationMessage("TokenDance 授权成功。请先测试生成 1 张，确认你的账户可用。");
        })
        .catch((cause) => { setNotice(browserApiError(cause)); setApiAuthorizationMessage(`授权未完成：${browserApiError(cause)} 请在当前标签页重新授权。`); });
    }
  }, []);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  const recentArtworks = useMemo(() => artworks.slice(0, 6), [artworks]);

  function createPreviewUrl(blob: Blob) {
    const url = URL.createObjectURL(blob);
    previewUrls.current.add(url);
    return url;
  }

  function clearJobPreviews() {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }

  function openWorkflow(id: WorkflowId) {
    setMobileNav(false);
    if (id === "anchor") {
      openAnchorManager();
      return;
    }
    clearJobPreviews();
    setActiveId(id);
    setJobs([]);
    setNotice("");
    setSourceFiles([]);
    setDrawerOpen(true);
  }

  function openAnchorManager() {
    setNotice("");
    if (!pendingAnchorFile && anchor) {
      const sourceBlob = anchor.sourceBlob || anchor.blob;
      const sourceName = anchor.sourceName || anchor.name;
      setPendingAnchorFile(new File([sourceBlob], sourceName, { type: sourceBlob.type || "image/png" }));
      setPendingAnchorStyle(anchor.styleId || "original");
    } else if (!pendingAnchorFile) {
      setPendingAnchorStyle("original");
    }
    setAnchorOpen(true);
  }

  function updateConfig(key: string, value: string | number | boolean) {
    if (!busy) setJobs([]);
    setConfigByRoute((current) => ({
      ...current,
      [activeId]: { ...current[activeId], [key]: value },
    }));
  }

  function handleAnchorFile(file?: File) {
    if (!file) return;
    if (!supportedImageTypes.has(file.type)) {
      setNotice("锚点图仅支持 PNG、JPG 和 WEBP。 ");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setNotice("锚点图请控制在 20MB 以内。");
      return;
    }
    setPendingAnchorFile(file);
    setPendingAnchorStyle("original");
    setNotice("图片已载入，请确认 IP 核心画风后再保存锚点。");
  }

  async function confirmAnchorStyle() {
    if (!pendingAnchorFile) return;
    if (pendingAnchorStyle !== "original" && !connection) {
      setResumeAnchorAfterApi(true);
      setAnchorOpen(false);
      setApiOpen(true);
      return;
    }

    setAnchorConverting(true);
    try {
      const acceptedBlob = pendingAnchorStyle === "original"
        ? pendingAnchorFile
        : await convertBrowserAnchor({
            connection: connection!,
            source: pendingAnchorFile,
            styleId: pendingAnchorStyle,
            quality: "medium",
          });
      const baseName = pendingAnchorFile.name.replace(/\.[^.]+$/, "") || "ip-anchor";
      const record: AnchorRecord = {
        id: "primary",
        name: pendingAnchorStyle === "original" ? pendingAnchorFile.name : `${baseName}-${pendingAnchorStyle}.png`,
        blob: acceptedBlob,
        sourceName: pendingAnchorFile.name,
        sourceBlob: pendingAnchorFile,
        styleId: pendingAnchorStyle,
        updatedAt: Date.now(),
      };
      await saveAnchor(record);
      setAnchor(record);
      setNotice(`${getAnchorStylePreset(pendingAnchorStyle).label}已确认为 IP 核心画风，之后默认沿用。`);
      setAnchorOpen(false);
    } catch (cause) {
      setNotice(browserApiError(cause));
    } finally {
      setAnchorConverting(false);
    }
  }

  async function deleteAnchor() {
    await removeAnchor();
    setAnchor(undefined);
    setPendingAnchorFile(undefined);
    setPendingAnchorStyle("original");
    setNotice("已移除本机角色锚点。");
  }

  async function importArticle(file?: File) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    try {
      let text = "";
      if (extension === "docx") {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = result.value;
      } else {
        text = await file.text();
      }
      setArticle(text.slice(0, 60000));
      setArticleName(file.name);
      setNotice(`已导入《${file.name}》`);
    } catch {
      setNotice("这篇文章暂时读不出来，请改用 TXT、Markdown 或 DOCX。 ");
    }
  }

  function onArticleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void importArticle(event.dataTransfer.files[0]);
  }

  function addSources(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files)
      .filter((file) => supportedImageTypes.has(file.type) && file.size <= 20 * 1024 * 1024)
      .slice(0, 9 - sourceFiles.length);
    setSourceFiles((current) => [...current, ...next]);
  }

  async function planJobs(): Promise<GenerationJob[]> {
    if (activeId !== "article" && activeId !== "infographic") {
      return buildStaticJobs(activeId, activeConfig, sourceFiles.length);
    }
    if (!connection) throw new Error("请先连接创作 API。");
    return planBrowserJobs({ connection, workflow: activeId, article, config: activeConfig });
  }

  async function generateOne(target: GenerationJob): Promise<Blob> {
    if (!anchor) throw new Error("请先上传角色锚点。");
    if (!connection) throw new Error("请先连接创作 API。");
    return generateBrowserImage({
      connection,
      anchor,
      job: target,
      quality,
      source: typeof target.sourceIndex === "number" ? sourceFiles[target.sourceIndex] : undefined,
    });
  }

  async function startGeneration() {
    if (!connected) {
      setApiOpen(true);
      return;
    }
    if (!anchor) {
      openAnchorManager();
      setNotice("先给 Studio 一张角色锚点，后面每次都会自动复用。");
      return;
    }
    if (active.needsArticle && article.trim().length < 40) {
      setNotice("文章有点短，再多粘贴一些内容，Studio 才能读出不同画面。");
      return;
    }
    if (active.needsSources && sourceFiles.length === 0) {
      setNotice(`请先添加${active.sourceLabel || "参考图"}。`);
      return;
    }

    setBusy(true);
    setNotice(active.needsArticle ? "正在读文章，先把内容整理成画面清单…" : "已开始准备创作清单…");
    try {
      const planned = await planJobs();
      clearJobPreviews();
      const state: JobState[] = planned.map((item) => ({ ...item, status: "queued" }));
      setJobs(state);
      setNotice(`清单准备好了，共 ${state.length} 张。现在逐张创作。`);

      for (let index = 0; index < planned.length; index += 1) {
        const target = planned[index];
        setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "generating" } : item));
        try {
          const blob = await generateOne(target);
          const image = createPreviewUrl(blob);
          await saveArtwork({
            id: target.id,
            workflow: activeId,
            title: target.title,
            blob,
            createdAt: Date.now() + index,
          });
          setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "done", image, imageBlob: blob } : item));
        } catch (error) {
          const message = browserApiError(error);
          setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "error", error: message } : item));
        }
      }
      setArtworks(await listArtworks());
      setNotice("这一轮已经完成。失败的单张可以直接重试，成功作品已留在本机作品簿。");
    } catch (error) {
      setNotice(browserApiError(error));
    } finally {
      setBusy(false);
    }
  }

  async function retryJob(target: JobState) {
    setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "generating", error: undefined } : item));
    try {
      if (target.image?.startsWith("blob:")) {
        URL.revokeObjectURL(target.image);
        previewUrls.current.delete(target.image);
      }
      const blob = await generateOne(target);
      const image = createPreviewUrl(blob);
      await saveArtwork({ id: target.id, workflow: activeId, title: target.title, blob, createdAt: Date.now() });
      setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "done", image, imageBlob: blob } : item));
      setArtworks(await listArtworks());
    } catch (error) {
      setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "error", error: browserApiError(error) } : item));
    }
  }

  async function downloadRound() {
    const completed = jobs.filter((item): item is JobState & { imageBlob: Blob } => item.status === "done" && item.imageBlob instanceof Blob);
    if (!completed.length) return;
    const zip = new JSZip();
    completed.forEach((item, index) => {
      zip.file(`${String(index + 1).padStart(2, "0")}-${item.title}.png`, item.imageBlob);
    });
    const file = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `IP-Studio-${active.title}-${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteArtworkItem(id: string) {
    await removeArtwork(id);
    setArtworks((current) => current.filter((item) => item.id !== id));
  }

  async function clearGallery() {
    if (!window.confirm("确定清空这台设备上的全部生成作品吗？下载过的文件不受影响。")) return;
    await clearArtworks();
    setArtworks([]);
  }

  return (
    <div className="studio-shell">
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="brand" onClick={() => setView("studio")} role="button" tabIndex={0}>
          <div className="brand-mark"><img src="/brand/ip-studio-logo.webp" alt="IP Studio 双人角色 Logo" /></div>
          <div><strong>IP Studio</strong><span>你的角色创作间</span></div>
        </div>

        <button className="sidebar-close" onClick={() => setMobileNav(false)} aria-label="关闭菜单"><X /></button>

        <div className="anchor-card">
          <div className="anchor-preview">
            {anchorUrl ? <img src={anchorUrl} alt="当前角色锚点" /> : <UserRound size={28} />}
          </div>
          <div className="anchor-copy">
            <small>{anchor ? `当前角色 · ${anchorStyle.shortLabel}` : "当前角色"}</small>
            <strong>{anchor ? anchor.name.replace(/\.[^.]+$/, "") : "还没认识你"}</strong>
          </div>
          <button onClick={openAnchorManager} aria-label="管理角色锚点"><Plus size={16} /></button>
        </div>

        <nav className="primary-nav">
          <button className={view === "studio" ? "active" : ""} onClick={() => { setView("studio"); setMobileNav(false); }}>
            <LayoutDashboard size={18} /><span>创作间</span>
          </button>
          <button className={view === "gallery" ? "active" : ""} onClick={() => { setView("gallery"); setMobileNav(false); }}>
            <GalleryHorizontalEnd size={18} /><span>作品簿</span><em>{artworks.length}</em>
          </button>
        </nav>

        <div className="nav-label">一键创作</div>
        <nav className="workflow-nav">
          {workflowDefinitions.slice(1).map((route) => {
            const Icon = iconMap[route.id];
            return (
              <button key={route.id} onClick={() => openWorkflow(route.id)} className={drawerOpen && activeId === route.id ? "active" : ""}>
                <Icon size={17} /><span>{route.title}</span><ChevronRight size={14} />
              </button>
            );
          })}
        </nav>

        <button className={`api-mini ${connected ? "connected" : ""}`} onClick={() => setApiOpen(true)}>
          {connected ? <ShieldCheck size={17} /> : <KeyRound size={17} />}
          <span><small>{connection?.label || "模型服务"}</small><strong>{connected ? "已配置 · 可测试" : "选择 API"}</strong></span>
          <i />
        </button>
      </aside>

      <main className="main-stage">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="打开菜单"><Menu /></button>
          <div className="topbar-note"><Sparkles size={16} /><span>一个角色，长出整个内容世界。</span></div>
          <div className="topbar-actions">
            <button className="quiet-button" onClick={() => setView(view === "studio" ? "gallery" : "studio")}>
              {view === "studio" ? <GalleryHorizontalEnd size={17} /> : <LayoutDashboard size={17} />}
              <span>{view === "studio" ? "我的作品" : "回创作间"}</span>
            </button>
            <button className={`key-button ${connected ? "is-connected" : ""}`} onClick={() => setApiOpen(true)}>
              {connected ? <Check size={16} /> : <KeyRound size={16} />}{connected ? `${connection?.label} 已配置` : "连接创作 API"}
            </button>
          </div>
        </header>

        {view === "studio" ? (
          <div className="page-content">
            <section className="hero-board">
              <div className="hero-copy">
                <div className="kicker"><span /> ALL-IN-ONE PERSONAL IP</div>
                <h1>上传一次，<br /><em>一直用你的角色。</em></h1>
                <p>不用写复杂 Prompt。选一个工具，回答几道小问卷，剩下的交给 Studio。</p>
                <div className="hero-actions">
                  <button className="primary-cta" onClick={() => openWorkflow("article")}>
                    <WandSparkles size={18} /> 开始第一次创作
                  </button>
                  <button className="text-cta" onClick={() => setAnchorOpen(true)}>
                    {anchor ? "查看我的角色" : "先上传角色锚点"} <ChevronRight size={16} />
                  </button>
                </div>
                <div className="hero-proof">
                  <span><Check size={13} /> Key 用你自己的</span>
                  <span><Check size={13} /> 锚点保存在本机</span>
                  <span><Check size={13} /> 成功作品不会丢</span>
                </div>
              </div>
              <div className="hero-collage" aria-label="IP Studio 创作示例">
                <div className="paper-card main-paper"><img src="/art/hero-cover.webp" alt="All-in-one IP 创作盒" /></div>
              </div>
            </section>

            <section className="quick-start">
              <CreditsMarquee />
              <div className="section-heading">
                <div><span className="section-index">01</span><h2>今天想做什么？</h2></div>
                <p>每个工具都已经装好了 Skill 的专业判断。</p>
              </div>
              <div className="tool-grid">
                {workflowDefinitions.slice(1).map((route, index) => {
                  const Icon = iconMap[route.id];
                  return (
                    <button className={`tool-card tone-${route.color}`} key={route.id} onClick={() => openWorkflow(route.id)}>
                      <span className="tool-number">{String(index + 1).padStart(2, "0")}</span>
                      <div className="tool-art"><img src={route.routeImage} alt="" /></div>
                      <div className="tool-info">
                        <span className="tool-icon"><Icon size={18} /></span>
                        <div><small>{route.eyebrow}</small><strong>{route.title}</strong></div>
                      </div>
                      <p>{route.description}</p>
                      <span className="tool-arrow"><ChevronRight size={17} /></span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="recent-section">
              <div className="section-heading">
                <div><span className="section-index">02</span><h2>{recentArtworks.length ? "刚刚出炉" : "这个 Studio 能长成什么"}</h2></div>
                <button className="section-link" onClick={() => setView("gallery")}>打开作品簿 <ChevronRight size={16} /></button>
              </div>
              <div className="art-strip">
                {recentArtworks.length ? recentArtworks.map((artwork) => (
                  <article className="art-card" key={artwork.id}>
                    <div className="art-image"><BlobArtwork artwork={artwork} /></div>
                    <span>{workflowMap[artwork.workflow].title}</span><strong>{artwork.title}</strong>
                  </article>
                )) : demoArt.map((item, index) => (
                  <article className="art-card demo" key={item.src} style={{ transform: `rotate(${index % 2 ? "1.2" : "-0.8"}deg)` }}>
                    <div className="art-image"><img src={item.src} alt={item.title} /></div>
                    <span>{item.tag}</span><strong>{item.title}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="how-it-works">
              <div className="how-copy"><small>不用学提示词</small><h2>三步，把角色变成你的内容资产</h2></div>
              <div className="step"><b>1</b><span><strong>上传并确认锚点画风</strong><small>原图直用，或用已连接的图片模型转换</small></span></div>
              <div className="step-line" />
              <div className="step"><b>2</b><span><strong>回答短问卷</strong><small>主题、数量、用途就够了</small></span></div>
              <div className="step-line" />
              <div className="step"><b>3</b><span><strong>一键生成</strong><small>逐张保存，失败单独重试</small></span></div>
            </section>
          </div>
        ) : (
          <div className="page-content gallery-page">
            <section className="gallery-header">
              <div><div className="kicker"><span /> LOCAL ARTBOOK</div><h1>我的作品簿</h1><p>所有作品只保存在这台设备的浏览器里。记得下载喜欢的成品。</p></div>
              {artworks.length > 0 && <button className="danger-quiet" onClick={() => void clearGallery()}><Trash2 size={16} /> 清空本机作品</button>}
            </section>
            {artworks.length ? (
              <div className="gallery-grid">
                {artworks.map((artwork) => {
                  const route = workflowMap[artwork.workflow];
                  return (
                    <article className="gallery-item" key={artwork.id}>
                      <div className="gallery-image"><BlobArtwork artwork={artwork} /></div>
                      <div className="gallery-meta">
                        <span className={`route-pill tone-${route.color}`}>{route.title}</span>
                        <strong>{artwork.title}</strong>
                        <small><Clock3 size={12} /> {new Date(artwork.createdAt).toLocaleString("zh-CN")}</small>
                      </div>
                      <div className="gallery-actions">
                        <ArtworkDownload artwork={artwork} />
                        <button onClick={() => void deleteArtworkItem(artwork.id)} aria-label="删除作品"><Trash2 size={16} /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-gallery">
                <img src="/art/gallery/world.webp" alt="角色内容世界" />
                <div><span>作品簿还是空的</span><h2>先让你的角色去完成一件小事吧。</h2><button className="primary-cta" onClick={() => { setView("studio"); openWorkflow("avatars"); }}><WandSparkles size={18} /> 做一组场景头像</button></div>
              </div>
            )}
          </div>
        )}
      </main>

      {drawerOpen && (
        <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDrawerOpen(false); }}>
          <aside className="workflow-drawer">
            <header className={`drawer-header tone-${active.color}`}>
              <div className="drawer-number">{active.number}</div>
              <div><small>{active.eyebrow}</small><h2>{active.title}</h2><p>{active.description}</p></div>
              <button onClick={() => !busy && setDrawerOpen(false)} aria-label="关闭" disabled={busy}><X /></button>
            </header>

            <div className="drawer-body">
              <section className="mini-anchor-row">
                <div className="mini-anchor-preview">{anchorUrl ? <img src={anchorUrl} alt="角色锚点" /> : <UserRound size={24} />}</div>
                <div><small>Image 1 · 最高优先级 · 核心画风：{anchor ? anchorStyle.shortLabel : "待确认"}</small><strong>{anchor ? anchor.name : "尚未上传角色锚点"}</strong></div>
                <button onClick={openAnchorManager}>{anchor ? "更换" : "上传"}</button>
              </section>

              {active.needsArticle && (
                <section className="form-section">
                  <div className="notice">{connection && usesApiPlanning(connection) ? `AI 文章规划：${connection.planningModel}，与生图模型分别调用。` : "本地分段模式：不需要文字 API，不做 AI 摘要。按原文分段交给生图模型；可在 API 配置中另配文字规划。"}</div>
                  <div className="form-title"><b>1</b><div><strong>把文章交给 Studio</strong><small>支持 TXT、Markdown、DOCX，最多读取 6 万字</small></div></div>
                  <div className={`article-drop ${article ? "has-content" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={onArticleDrop}>
                    <textarea value={article} onChange={(event) => { setArticle(event.target.value.slice(0, 60000)); setArticleName(""); }} placeholder="把文章粘贴在这里，或拖一个文件进来…" />
                    <div className="article-drop-footer">
                      <label><UploadCloud size={15} /> 导入文章<input type="file" accept=".txt,.md,.markdown,.docx" onChange={(event) => void importArticle(event.target.files?.[0])} /></label>
                      <span>{articleName || (article ? `${article.length.toLocaleString()} 字` : "还没有内容")}</span>
                    </div>
                  </div>
                </section>
              )}

              {active.needsSources && (
                <section className="form-section">
                  <div className="form-title"><b>1</b><div><strong>添加{active.sourceLabel}</strong><small>{active.sourceHelp}</small></div></div>
                  <label className="source-drop">
                    <UploadCloud size={24} /><strong>拖进来，或点这里选择</strong><span>PNG / JPG / WEBP，单张不超过 20MB</span>
                    <input type="file" multiple accept={active.accept || "image/*"} onChange={(event) => addSources(event.target.files)} />
                  </label>
                  {sourceFiles.length > 0 && <div className="source-grid">{sourceFiles.map((file, index) => <SourceThumb key={`${file.name}-${index}`} file={file} onRemove={() => setSourceFiles((current) => current.filter((_, target) => target !== index))} />)}</div>}
                </section>
              )}

              <section className="form-section">
                <div className="form-title"><b>{configStep}</b><div><strong>回答几个小问题</strong><small>修改任一输入，下方输出名称和数量会立即同步</small></div></div>
                <div className="field-grid">
                  {active.fields.map((field) => (
                    <label className={field.kind === "textarea" ? "wide-field" : ""} key={field.key}>
                      <span>{field.label}</span>
                      {field.kind === "select" ? (
                        <select value={String(activeConfig[field.key] ?? field.defaultValue)} onChange={(event) => updateConfig(field.key, event.target.value)}>
                          {field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                        </select>
                      ) : field.kind === "textarea" ? (
                        <textarea value={String(activeConfig[field.key] ?? field.defaultValue)} placeholder={field.placeholder} onChange={(event) => updateConfig(field.key, event.target.value)} />
                      ) : (
                        <input type={field.kind === "number" ? "number" : "text"} min={field.min} max={field.max} value={String(activeConfig[field.key] ?? field.defaultValue)} placeholder={field.placeholder} onChange={(event) => updateConfig(field.key, field.kind === "number" ? Number(event.target.value) : event.target.value)} />
                      )}
                      {field.help && <small>{field.help}</small>}
                    </label>
                  ))}
                </div>
              </section>

              <section className="quality-row">
                <div><strong>出图质量</strong><small>中等适合预览，高等适合交付</small></div>
                <div className="segmented">
                  {(["low", "medium", "high"] as const).map((value) => <button key={value} className={quality === value ? "active" : ""} onClick={() => setQuality(value)}>{value === "low" ? "草稿" : value === "medium" ? "标准" : "精细"}</button>)}
                </div>
              </section>

              <section className="form-section output-plan">
                <div className="form-title"><b>{previewStep}</b><div><strong>核对本轮输出</strong><small>这里的名称会用于任务卡、作品簿和下载文件</small></div></div>
                <div className="output-title-list">
                  {outputPreviewTitles.map((title, index) => <span key={`${title}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b>{title}</span>)}
                </div>
              </section>

              {notice && <div className="notice"><Sparkles size={15} /><span>{notice}</span></div>}

              {jobs.length > 0 && (
                <section className="job-section">
                  <div className="job-heading"><div><strong>这一轮的创作清单</strong><small>{jobs.filter((item) => item.status === "done").length}/{jobs.length} 已完成</small></div>{jobs.some((item) => item.status === "done") && <button onClick={() => void downloadRound()}><Download size={15} /> 打包下载</button>}</div>
                  <div className="job-grid">
                    {jobs.map((item) => (
                      <article className={`job-card is-${item.status}`} key={item.id}>
                        <div className="job-preview">
                          {item.image ? <img src={item.image} alt={item.title} /> : item.status === "generating" ? <LoaderCircle className="spin" size={25} /> : item.status === "error" ? <AlertCircle size={23} /> : <FileImage size={22} />}
                        </div>
                        <div className="job-copy"><strong>{item.title}</strong><small>{item.status === "queued" ? "排队中" : item.status === "generating" ? "正在画" : item.status === "done" ? "已保存" : item.error}</small></div>
                        {item.status === "error" && <button onClick={() => void retryJob(item)}>重试</button>}
                        {item.image && <a href={item.image} download={`${item.title}.png`} aria-label={`下载${item.title}`}><Download size={15} /></a>}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <footer className="drawer-footer">
              <div><small>预计生成</small><strong>{estimatedCount || (activeId === "infographic" && activeConfig.pages === "auto" ? "自动判断" : 0)} {typeof estimatedCount === "number" && estimatedCount > 0 ? "张" : ""}</strong></div>
              <button className="generate-button" disabled={busy} onClick={() => void startGeneration()}>
                {busy ? <><LoaderCircle className="spin" size={18} /> 正在创作，请别关掉</> : <><WandSparkles size={18} /> 一键生成整套</>}
              </button>
            </footer>
          </aside>
        </div>
      )}

      {apiOpen && <ProviderModal key={connection ? "saved" : "new"} connection={connection} authorizationMessage={apiAuthorizationMessage} onClose={() => { setApiOpen(false); setResumeAnchorAfterApi(false); }} onConnect={(value) => { rememberAiConnection(value); setConnection(value); if (resumeAnchorAfterApi) { setResumeAnchorAfterApi(false); setApiOpen(false); setAnchorOpen(true); } }} onDisconnect={() => { forgetAiConnection(); setConnection(undefined); setApiAuthorizationMessage(""); }} />}
      {anchorOpen && (
        <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !anchorConverting) setAnchorOpen(false); }}>
          <div className="paper-modal anchor-modal">
            <button className="modal-close" onClick={() => setAnchorOpen(false)} disabled={anchorConverting}><X /></button>
            <div className="modal-kicker"><UserRound size={18} /> Image 1 · IP 核心锚点</div>
            <h2>先确认角色，再确认画风</h2>
            <p>每次上传都要在这里确认一次。选择转换时，当前图片模型只改变绘制媒介；身份仍严格来自你的原图。确认后的结果会成为所有创作默认使用的 Image 1。</p>
            <label className={`anchor-upload ${pendingAnchorUrl ? "has-anchor" : ""}`}>
              {pendingAnchorUrl ? <><img src={pendingAnchorUrl} alt="待确认的身份原图" /><span className="replace-anchor-hint">点击更换身份原图</span></> : <><UploadCloud size={29} /><strong>上传身份原图</strong><span>正面全身、纯色背景最稳定</span></>}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleAnchorFile(event.target.files?.[0])} />
            </label>
            {pendingAnchorFile && <div className="anchor-style-section"><div className="anchor-style-heading"><span>选择 IP 核心画风</span><small>示例只展示画法，不提供角色身份</small></div><div className="anchor-style-grid">{ANCHOR_STYLE_PRESETS.map((preset) => { const preview = preset.id === "original" ? pendingAnchorUrl : preset.preview; return <button type="button" className={`anchor-style-option ${pendingAnchorStyle === preset.id ? "is-selected" : ""}`} onClick={() => setPendingAnchorStyle(preset.id)} disabled={anchorConverting} key={preset.id}>{preview && <img src={preview} alt={`${preset.label}示例`} />}<span><strong>{preset.label}</strong><small>{preset.description}</small></span>{pendingAnchorStyle === preset.id && <Check size={16} />}</button>; })}</div></div>}
            {anchor && <div className="current-anchor-meta"><div><Check size={15} /><span><strong>当前：{anchorStyle.label}</strong><small>{new Date(anchor.updatedAt).toLocaleString("zh-CN")} 保存 · {anchor.name}</small></span></div><button onClick={() => void deleteAnchor()} disabled={anchorConverting}><Trash2 size={15} /> 移除</button></div>}
            <div className="anchor-style-lock">
              <ShieldCheck size={18} />
              <div><strong>身份原图与转换后锚点都会只保存在本机</strong><small>后续默认跟随核心锚点画风；每个创作入口仍可临时改成萌粒风，表情包还可选择参考表情的原生画风。</small></div>
            </div>
            <div className="anchor-tips"><strong>更稳定的小诀窍</strong><span>完整头发或耳朵轮廓 · 标志性服装与配色 · 不要裁掉手脚 · 避免复杂场景</span></div>
            {notice && <div className="notice anchor-notice"><Sparkles size={15} /><span>{notice}</span></div>}
            <button className="modal-primary" onClick={() => void confirmAnchorStyle()} disabled={!pendingAnchorFile || anchorConverting}>{anchorConverting ? <><LoaderCircle className="spin" size={17} /> 图片模型正在转换并核对身份</> : !pendingAnchorFile ? "先上传一张身份原图" : pendingAnchorStyle === "original" ? "确认原图为核心锚点" : connected ? `转换为${getAnchorStylePreset(pendingAnchorStyle).label}并确认` : "连接创作 API 后转换"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArtworkDownload({ artwork }: { artwork: ArtworkRecord }) {
  const url = useBlobUrl(artwork.blob);
  return <a href={url} download={`${artwork.title}.png`} aria-label="下载作品"><Download size={16} /></a>;
}
