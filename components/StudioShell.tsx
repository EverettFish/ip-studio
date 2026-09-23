"use client";

/* eslint-disable @next/next/no-img-element -- The studio renders user Blob URLs and arbitrary generated images. */

import {
  AlertCircle,
  Aperture,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import type {
  AnchorRecord,
  AnchorStyleId,
  ArtworkRecord,
  GenerationJob,
  GenerationUsage,
  JobState,
  WorkflowConfig,
  WorkflowId,
} from "@/lib/types";
import { ANCHOR_STYLE_PRESETS, getAnchorStylePreset, STARTER_ANCHOR_DEMOS } from "@/lib/anchor-styles";
import {
  assertImageModel,
  completeTokenDanceAuthorization,
  forgetAiConnection,
  getTokenDanceBalance,
  hasTokenDanceAuthorizationCallback,
  imageModelOptions,
  microYuanToYuan,
  rememberAiConnection,
  restoreAiConnection,
  type AiConnection,
  type TokenDanceBalance,
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
  generateBrowserImageResult,
  generateBrowserStarterAnchor,
  planBrowserJobs,
  type GenerationResult,
} from "@/lib/browser-openai";
import { ProviderModal } from "@/components/ProviderModal";
import { FirstVisitOnboarding, ONBOARDING_STORAGE_KEY } from "@/components/FirstVisitOnboarding";

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

function BlobArtwork({ artwork, onPreview }: { artwork: ArtworkRecord; onPreview: (src: string, title: string) => void }) {
  const url = useBlobUrl(artwork.blob);
  return url ? <button type="button" className="image-preview-trigger" onClick={() => onPreview(url, artwork.title)} aria-label={`放大预览${artwork.title}`} title="点击放大预览"><img src={url} alt={artwork.title} /></button> : <div className="image-skeleton" />;
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
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRecord>();
  const [artworks, setArtworks] = useState<ArtworkRecord[]>([]);
  const [connection, setConnection] = useState<AiConnection>();
  const [apiOpen, setApiOpen] = useState(false);
  const [apiAuthorizationMessage, setApiAuthorizationMessage] = useState("");
  const [anchorOpen, setAnchorOpen] = useState(false);
  const [anchorCreationMode, setAnchorCreationMode] = useState<"upload" | "create">("upload");
  const [starterAnchorBrief, setStarterAnchorBrief] = useState("");
  const [pendingAnchorFile, setPendingAnchorFile] = useState<File>();
  const [pendingAnchorCandidate, setPendingAnchorCandidate] = useState<File>();
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
  const [tokenDanceBalance, setTokenDanceBalance] = useState<TokenDanceBalance>();
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [runImageModel, setRunImageModel] = useState("");
  const [stopPending, setStopPending] = useState(false);
  const [roundUsage, setRoundUsage] = useState<{ model: string; totalTokens: number; completed: number; usageAvailable: boolean; spentMicros?: number }>();
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string }>();
  const previewUrls = useRef(new Set<string>());
  const oauthHandled = useRef(false);
  const stopRequested = useRef(false);
  const anchorUrl = useBlobUrl(anchor?.blob);
  const pendingAnchorUrl = useBlobUrl(pendingAnchorFile);
  const pendingAnchorCandidateUrl = useBlobUrl(pendingAnchorCandidate);
  const connected = Boolean(connection?.apiKey);

  const active = workflowMap[activeId];
  const activeConfig = configByRoute[activeId];
  const anchorStyle = getAnchorStylePreset(anchor?.styleId);
  const estimatedCount = estimateCount(activeId, activeConfig, sourceFiles.length);
  const hasPrimaryInput = Boolean(active.needsArticle || active.needsSources);
  const configStep = hasPrimaryInput ? 2 : 1;
  const previewStep = hasPrimaryInput ? 3 : 2;
  const textSensitiveRoute = activeId === "infographic" || activeId === "stickers" || activeId === "letter" || activeId === "possession";
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
    const hasOAuthCallback = hasTokenDanceAuthorizationCallback();
    if (!hasOAuthCallback) {
      try {
        if (window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "seen") setOnboardingOpen(true);
      } catch {
        setOnboardingOpen(true);
      }
    }
    if (hasOAuthCallback && !oauthHandled.current) {
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

  const closeOnboarding = useCallback(() => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "seen");
    } catch {
      // The guide still closes when private browsing blocks local storage.
    }
    setOnboardingOpen(false);
  }, []);

  useEffect(() => {
    setRunImageModel(connection?.imageModel || "");
    let cancelled = false;
    if (connection?.provider !== "tokendance") {
      setTokenDanceBalance(undefined);
      setBalanceLoading(false);
      return;
    }
    setBalanceLoading(true);
    void getTokenDanceBalance(connection)
      .then((next) => { if (!cancelled) setTokenDanceBalance(next); })
      .catch(() => { if (!cancelled) setTokenDanceBalance(undefined); })
      .finally(() => { if (!cancelled) setBalanceLoading(false); });
    return () => { cancelled = true; };
  }, [connection]);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  useEffect(() => {
    if (!busy && !anchorConverting) return;
    let disposed = false;
    let wakeLock: { release: () => Promise<void> } | undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const visibilityChanged = () => {
      if (document.hidden) setNotice("手机浏览器切到后台可能暂停当前生图请求。回到页面后先看任务状态和作品簿，不要立即重复生成。 ");
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", visibilityChanged);
    const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (wakeLockApi) void wakeLockApi.request("screen").then((lock) => { if (disposed) void lock.release().catch(() => undefined); else wakeLock = lock; }).catch(() => undefined);
    return () => {
      disposed = true;
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", visibilityChanged);
      if (wakeLock) void wakeLock.release().catch(() => undefined);
    };
  }, [busy, anchorConverting]);

  useEffect(() => {
    if (!imagePreview) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImagePreview(undefined);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [imagePreview]);

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
      setAnchorCreationMode("upload");
      setPendingAnchorCandidate(undefined);
    } else if (!pendingAnchorFile) {
      setPendingAnchorStyle("original");
    }
    setAnchorOpen(true);
  }

  function openStarterAnchor() {
    setNotice("");
    setAnchorCreationMode("create");
    setPendingAnchorFile(undefined);
    setPendingAnchorCandidate(undefined);
    setPendingAnchorStyle("mengli");
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
    setAnchorCreationMode("upload");
    setPendingAnchorCandidate(undefined);
    setPendingAnchorStyle("original");
    setNotice("图片已载入，请确认 IP 核心画风后再保存锚点。");
  }

  function chooseAnchorCreationMode(mode: "upload" | "create") {
    setAnchorCreationMode(mode);
    setPendingAnchorCandidate(undefined);
    setNotice("");
    if (mode === "create") {
      setPendingAnchorFile(undefined);
      setPendingAnchorStyle("mengli");
      return;
    }
    if (anchor) {
      const sourceBlob = anchor.sourceBlob || anchor.blob;
      const sourceName = anchor.sourceName || anchor.name;
      setPendingAnchorFile(new File([sourceBlob], sourceName, { type: sourceBlob.type || "image/png" }));
      setPendingAnchorStyle(anchor.styleId || "original");
    } else {
      setPendingAnchorFile(undefined);
      setPendingAnchorStyle("original");
    }
  }

  function chooseStarterDemo(index: number) {
    const demo = STARTER_ANCHOR_DEMOS[index];
    setStarterAnchorBrief(demo.brief);
    setPendingAnchorStyle(demo.styleId);
    setPendingAnchorFile(undefined);
    setPendingAnchorCandidate(undefined);
    setNotice(`已填入“${demo.title}”示例，你可以继续修改任何细节。`);
  }

  function choosePendingAnchorStyle(styleId: AnchorStyleId) {
    if (pendingAnchorCandidate && styleId !== pendingAnchorStyle) {
      setPendingAnchorCandidate(undefined);
      setNotice("核心画风已改变，请按新画风重新生成候选锚点。 ");
    }
    setPendingAnchorStyle(styleId);
  }

  async function generateStarterAnchorCandidate() {
    if (!connection) {
      setResumeAnchorAfterApi(true);
      setAnchorOpen(false);
      setApiOpen(true);
      setNotice("先连接一个支持文字生图的图片模型，再回来生成第一张角色锚点。 ");
      return;
    }
    const styleId = pendingAnchorStyle === "original" ? "mengli" : pendingAnchorStyle;
    setAnchorConverting(true);
    setNotice("正在生成第一张角色锚点候选，请保持页面在前台…");
    try {
      const blob = await generateBrowserStarterAnchor({ connection, brief: starterAnchorBrief, styleId, quality: "medium" });
      const file = new File([blob], `ip-anchor-${styleId}.png`, { type: blob.type || "image/png" });
      setPendingAnchorCandidate(file);
      setPendingAnchorStyle(styleId);
      setNotice("候选锚点已生成。请先核对角色特征，满意后再确认；不满意可修改描述重新生成。 ");
    } catch (cause) {
      setNotice(browserApiError(cause));
    } finally {
      setAnchorConverting(false);
    }
  }

  async function generateConvertedAnchorCandidate() {
    if (!pendingAnchorFile || pendingAnchorStyle === "original") return;
    if (!connection) {
      setResumeAnchorAfterApi(true);
      setAnchorOpen(false);
      setApiOpen(true);
      setNotice("先连接一个支持参考图的生图模型，再回来转换锚点画风。 ");
      return;
    }
    setAnchorConverting(true);
    setNotice(`正在生成${getAnchorStylePreset(pendingAnchorStyle).label}候选，请保持页面在前台…`);
    try {
      const blob = await convertBrowserAnchor({
        connection,
        source: pendingAnchorFile,
        styleId: pendingAnchorStyle,
        quality: "medium",
      });
      const baseName = pendingAnchorFile.name.replace(/\.[^.]+$/, "") || "ip-anchor";
      setPendingAnchorCandidate(new File([blob], `${baseName}-${pendingAnchorStyle}.png`, { type: blob.type || "image/png" }));
      setNotice("转画风候选已生成。可以先放大检查或下载 PNG，满意后再确认为核心锚点。 ");
    } catch (cause) {
      setNotice(browserApiError(cause));
    } finally {
      setAnchorConverting(false);
    }
  }

  async function confirmAnchorStyle() {
    const sourceFile = pendingAnchorFile || pendingAnchorCandidate;
    const acceptedFile = anchorCreationMode === "upload" && pendingAnchorStyle === "original" ? pendingAnchorFile : pendingAnchorCandidate;
    if (!sourceFile || !acceptedFile) return;

    setAnchorConverting(true);
    try {
      const record: AnchorRecord = {
        id: "primary",
        name: acceptedFile.name,
        blob: acceptedFile,
        sourceName: sourceFile.name,
        sourceBlob: sourceFile,
        styleId: pendingAnchorStyle,
        updatedAt: Date.now(),
      };
      await saveAnchor(record);
      setAnchor(record);
      setPendingAnchorFile(undefined);
      setPendingAnchorCandidate(undefined);
      setAnchorCreationMode("upload");
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
    setPendingAnchorCandidate(undefined);
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

  async function refreshStudioBalance(target = connection): Promise<TokenDanceBalance | undefined> {
    if (target?.provider !== "tokendance") return undefined;
    setBalanceLoading(true);
    try {
      const next = await getTokenDanceBalance(target);
      setTokenDanceBalance(next);
      return next;
    } catch {
      return undefined;
    } finally {
      setBalanceLoading(false);
    }
  }

  function addRoundUsage(usage?: GenerationUsage) {
    setRoundUsage((current) => current ? {
      ...current,
      completed: current.completed + 1,
      totalTokens: current.totalTokens + (usage?.totalTokens || 0),
      usageAvailable: current.usageAvailable || typeof usage?.totalTokens === "number",
    } : current);
  }

  function requestStop() {
    stopRequested.current = true;
    setStopPending(true);
    setNotice("已收到停止请求：当前正在生成的这一张会完成，尚未开始的图片不会再发送给服务商，也不会继续扣费。");
  }

  async function generateOne(target: GenerationJob, runConnection: AiConnection): Promise<GenerationResult> {
    if (!anchor) throw new Error("请先上传角色锚点。");
    return generateBrowserImageResult({
      connection: runConnection,
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

    const model = runImageModel.trim();
    try {
      assertImageModel(model);
    } catch (error) {
      setNotice(browserApiError(error));
      return;
    }
    const runConnection = { ...connection!, imageModel: model };

    stopRequested.current = false;
    setStopPending(false);
    setBusy(true);
    setRoundUsage({ model, totalTokens: 0, completed: 0, usageAvailable: false });
    setNotice(active.needsArticle ? "正在读文章，先把内容整理成画面清单…" : "已开始准备创作清单…");
    let startingBalance: TokenDanceBalance | undefined;
    try {
      startingBalance = await refreshStudioBalance(runConnection);
      const planned = await planJobs();
      clearJobPreviews();
      const state: JobState[] = planned.map((item) => ({ ...item, status: "queued" }));
      setJobs(state);
      if (stopRequested.current) {
        setJobs((current) => current.map((item) => ({ ...item, status: "stopped" })));
        const endingBalance = await refreshStudioBalance(runConnection);
        if (startingBalance && endingBalance) {
          const spentMicros = Math.max(0, startingBalance.balance - endingBalance.balance);
          setRoundUsage((current) => current ? { ...current, spentMicros } : current);
        }
        setNotice("已停止：创作清单已经整理好，但没有发送任何生图请求。");
        return;
      }
      setNotice(`清单准备好了，共 ${state.length} 张。现在逐张创作。`);

      for (let index = 0; index < planned.length; index += 1) {
        if (stopRequested.current) {
          setJobs((current) => current.map((item) => item.status === "queued" ? { ...item, status: "stopped" } : item));
          break;
        }
        const target = planned[index];
        setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "generating" } : item));
        try {
          const result = await generateOne(target, runConnection);
          const blob = result.blob;
          const image = createPreviewUrl(blob);
          await saveArtwork({
            id: target.id,
            workflow: activeId,
            title: target.title,
            blob,
            createdAt: Date.now() + index,
          });
          setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "done", image, imageBlob: blob, usage: result.usage } : item));
          addRoundUsage(result.usage);
        } catch (error) {
          const message = browserApiError(error);
          setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "error", error: message } : item));
        }
        if (startingBalance) {
          const liveBalance = await refreshStudioBalance(runConnection);
          if (liveBalance) {
            const spentMicros = Math.max(0, startingBalance.balance - liveBalance.balance);
            setRoundUsage((current) => current ? { ...current, spentMicros } : current);
          }
        }
      }
      const endingBalance = await refreshStudioBalance(runConnection);
      if (startingBalance && endingBalance) {
        const spentMicros = Math.max(0, startingBalance.balance - endingBalance.balance);
        setRoundUsage((current) => current ? { ...current, spentMicros } : current);
      }
      setArtworks(await listArtworks());
      setNotice(stopRequested.current ? "已按你的要求停止后续生成；已完成的作品仍保存在作品簿中。" : "这一轮已经完成。失败的单张可以直接重试，成功作品已留在本机作品簿。");
    } catch (error) {
      const endingBalance = await refreshStudioBalance(runConnection);
      if (startingBalance && endingBalance) {
        const spentMicros = Math.max(0, startingBalance.balance - endingBalance.balance);
        setRoundUsage((current) => current ? { ...current, spentMicros } : current);
      }
      setNotice(browserApiError(error));
    } finally {
      setBusy(false);
      setStopPending(false);
    }
  }

  async function retryJob(target: JobState) {
    if (!connection) return;
    const model = runImageModel.trim();
    try {
      assertImageModel(model);
    } catch (error) {
      setNotice(browserApiError(error));
      return;
    }
    const runConnection = { ...connection, imageModel: model };
    setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "generating", error: undefined } : item));
    try {
      const startingBalance = await refreshStudioBalance(runConnection);
      if (target.image?.startsWith("blob:")) {
        URL.revokeObjectURL(target.image);
        previewUrls.current.delete(target.image);
      }
      const result = await generateOne(target, runConnection);
      const blob = result.blob;
      const image = createPreviewUrl(blob);
      await saveArtwork({ id: target.id, workflow: activeId, title: target.title, blob, createdAt: Date.now() });
      setJobs((current) => current.map((item) => item.id === target.id ? { ...item, status: "done", image, imageBlob: blob, usage: result.usage } : item));
      addRoundUsage(result.usage);
      const endingBalance = await refreshStudioBalance(runConnection);
      if (startingBalance && endingBalance) {
        setRoundUsage((current) => current ? { ...current, spentMicros: (current.spentMicros || 0) + Math.max(0, startingBalance.balance - endingBalance.balance) } : current);
      }
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

        <a
          className="watcha-review-badge"
          href="https://watcha.cn/products/ip-studio?utm_source=product-badge&utm_content=invite"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="在观猹查看并点评 IP Studio"
        >
          <img
            src="https://tos.watcha.cn/public/images/invite-0-white.png"
            alt="IP Studio 观猹徽章"
            width={360}
          />
        </a>

        <button className={`api-mini ${connected ? "connected" : ""}`} onClick={() => setApiOpen(true)}>
          {connected ? <ShieldCheck size={17} /> : <KeyRound size={17} />}
          <span><small>{connection?.label || "模型服务"}</small><strong>{connected ? "已配置 · 可测试" : "选择 API"}</strong></span>
          {connection?.provider === "tokendance" && <b className="api-balance">{tokenDanceBalance ? `余额 ¥${microYuanToYuan(tokenDanceBalance.balance).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : balanceLoading ? "余额读取中" : "余额暂不可用"}</b>}
          <i />
        </button>
      </aside>

      <main className="main-stage">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="打开菜单"><Menu /></button>
          <div className="topbar-note"><Sparkles size={16} /><span>一个角色，长出整个内容世界。</span></div>
          <div className="topbar-actions">
            <button className="quiet-button onboarding-trigger" onClick={() => setOnboardingOpen(true)} aria-label="打开新手引导">
              <CircleHelp size={17} /><span>新手引导</span>
            </button>
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
                <h1>创建一次，<br /><em>一直用你的角色。</em></h1>
                <p>不用写复杂 Prompt。选一个工具，回答几道小问卷，剩下的交给 Studio。</p>
                <div className="hero-actions">
                  <button className="primary-cta" onClick={() => openWorkflow("article")}>
                    <WandSparkles size={18} /> 开始第一次创作
                  </button>
                  <button className="text-cta" onClick={anchor ? openAnchorManager : openStarterAnchor}>
                    {anchor ? "查看我的角色" : "还没有自己的形象？试一试"} <ChevronRight size={16} />
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
                    <div className="art-image"><BlobArtwork artwork={artwork} onPreview={(src, title) => setImagePreview({ src, title })} /></div>
                    <span>{workflowMap[artwork.workflow].title}</span><strong>{artwork.title}</strong>
                  </article>
                )) : demoArt.map((item, index) => (
                  <article className="art-card demo" key={item.src} style={{ transform: `rotate(${index % 2 ? "1.2" : "-0.8"}deg)` }}>
                    <div className="art-image"><button type="button" className="image-preview-trigger" onClick={() => setImagePreview({ src: item.src, title: item.title })} aria-label={`放大预览${item.title}`} title="点击放大预览"><img src={item.src} alt={item.title} /></button></div>
                    <span>{item.tag}</span><strong>{item.title}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="how-it-works">
              <div className="how-copy"><small>不用学提示词</small><h2>三步，把角色变成你的内容资产</h2></div>
              <div className="step"><b>1</b><span><strong>创建或上传角色锚点</strong><small>没有现成形象，也能从一段描述开始</small></span></div>
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
                      <div className="gallery-image"><BlobArtwork artwork={artwork} onPreview={(src, title) => setImagePreview({ src, title })} /></div>
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
                <button onClick={openAnchorManager}>{anchor ? "更换" : "创建"}</button>
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

              <section className="run-settings-row">
                <label className="run-model-field">
                  <span>本轮生图模型</span>
                  {connection?.provider === "tokendance" ? (
                    <select value={runImageModel} disabled={busy} onChange={(event) => setRunImageModel(event.target.value)}>
                      {imageModelOptions(connection).map((model) => <option value={model} key={model}>{model === "seedream-5.0-lite" ? "Seedream 5.0 Lite · 图生图" : model === "seedream-5.0-pro" ? "Seedream 5.0 Pro · 图生图" : model}</option>)}
                    </select>
                  ) : (
                    <><input list="run-image-models" value={runImageModel} disabled={busy || !connection} placeholder="先连接 API，再填写生图模型 ID" onChange={(event) => setRunImageModel(event.target.value)} /><datalist id="run-image-models">{connection && imageModelOptions(connection).map((model) => <option value={model} key={model} />)}</datalist></>
                  )}
                  <small>只影响这一轮，不改动 API 配置；必须选择支持参考图的生图模型。如供应商提供，优先推荐 Image 2 / gpt-image-2，其他模型可用但效果可能不同。</small>
                  {textSensitiveRoute && <small className="model-fit-tip">本工具包含文字、版式或透明结构：不同模型的中文字形、标题完整度和透明度差异会更明显。</small>}
                </label>
                <div className="quality-control">
                  <div><strong>出图质量</strong><small>中等适合预览，高等适合交付</small></div>
                  <div className="segmented">
                    {(["low", "medium", "high"] as const).map((value) => <button type="button" disabled={busy} key={value} className={quality === value ? "active" : ""} onClick={() => setQuality(value)}>{value === "low" ? "草稿" : value === "medium" ? "标准" : "精细"}</button>)}
                  </div>
                </div>
              </section>

              <div className={`foreground-generation-note ${busy ? "is-active" : ""}`}><AlertCircle size={15} /><span><strong>{busy ? "正在生成，请保持本页在前台" : "手机生成时请勿切到后台"}</strong><small>iPhone 等移动浏览器可能暂停后台请求；成品会逐张保存，返回后先检查任务状态与作品簿，再决定是否重试。</small></span></div>

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
                  {roundUsage && <div className="generation-usage"><span><b>模型</b>{roundUsage.model}</span><span><b>已生成</b>{roundUsage.completed}/{jobs.length} 张</span>{roundUsage.usageAvailable && <span><b>Token</b>{roundUsage.totalTokens.toLocaleString()}</span>}{typeof roundUsage.spentMicros === "number" && <span><b>本轮消耗</b>¥{microYuanToYuan(roundUsage.spentMicros).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>}{!busy && !roundUsage.usageAvailable && connection?.provider !== "tokendance" && <small>服务商没有返回用量，请到对应后台查看实际费用。</small>}</div>}
                  <div className="job-grid">
                    {jobs.map((item) => (
                      <article className={`job-card is-${item.status}`} key={item.id}>
                        {item.image ? <button type="button" className="job-preview image-preview-trigger" onClick={() => setImagePreview({ src: item.image!, title: item.title })} aria-label={`放大预览${item.title}`} title="点击放大预览"><img src={item.image} alt={item.title} /></button> : <div className="job-preview">{item.status === "generating" ? <LoaderCircle className="spin" size={25} /> : item.status === "error" ? <AlertCircle size={23} /> : <FileImage size={22} />}</div>}
                        <div className="job-copy"><strong>{item.title}</strong><small>{item.status === "queued" ? "排队中" : item.status === "generating" ? "正在画 · 当前请求会完成" : item.status === "done" ? `${item.usage?.totalTokens ? `${item.usage.totalTokens.toLocaleString()} tokens · ` : ""}已保存` : item.status === "stopped" ? "已停止 · 未发送请求" : item.error}</small></div>
                        {item.status === "error" && <button disabled={busy} onClick={() => void retryJob(item)}>重试</button>}
                        {item.image && <a href={item.image} download={`${item.title}.png`} aria-label={`下载${item.title}`}><Download size={15} /></a>}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <footer className="drawer-footer">
              <div><small>预计生成</small><strong>{estimatedCount || (activeId === "infographic" && activeConfig.pages === "auto" ? "自动判断" : 0)} {typeof estimatedCount === "number" && estimatedCount > 0 ? "张" : ""}</strong></div>
              <button className={`generate-button ${busy ? "stop-button" : ""}`} disabled={busy && stopPending} onClick={() => busy ? requestStop() : void startGeneration()}>
                {busy ? stopPending ? <><Check size={18} /> 将在当前图片后停止</> : <><X size={18} /> 停止后续生成</> : <><WandSparkles size={18} /> 一键生成整套</>}
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
            <h2>{anchorCreationMode === "upload" ? "先确认角色，再确认画风" : "没有现成形象，也能从这里开始"}</h2>
            <p>{anchorCreationMode === "upload" ? "上传已有角色图，可以直接沿用原画风，也可以只转换绘制媒介。确认后的结果会成为所有创作默认使用的 Image 1。" : "选一个参考起点，再把发型、服装、配色和性格改成你自己的。生成候选后仍由你确认，不满意就不保存。"}</p>
            <div className="anchor-mode-tabs" role="tablist" aria-label="选择锚点创建方式">
              <button type="button" role="tab" aria-selected={anchorCreationMode === "upload"} className={anchorCreationMode === "upload" ? "is-active" : ""} onClick={() => chooseAnchorCreationMode("upload")} disabled={anchorConverting}><UploadCloud size={15} /> 我有角色图</button>
              <button type="button" role="tab" aria-selected={anchorCreationMode === "create"} className={anchorCreationMode === "create" ? "is-active" : ""} onClick={() => chooseAnchorCreationMode("create")} disabled={anchorConverting}><Sparkles size={15} /> 还没有自己的形象？试一试</button>
            </div>

            {anchorCreationMode === "upload" ? (
              <label className={`anchor-upload ${pendingAnchorUrl ? "has-anchor" : ""}`}>
                {pendingAnchorUrl ? <><img src={pendingAnchorUrl} alt="待确认的身份原图" /><span className="replace-anchor-hint">点击更换身份原图</span></> : <><UploadCloud size={29} /><strong>上传身份原图</strong><span>正面全身、纯色背景最稳定</span></>}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleAnchorFile(event.target.files?.[0])} />
              </label>
            ) : (
              <section className="starter-anchor-builder">
                <div className="anchor-style-heading"><span>从一个可修改的 Demo 开始</span><small>示例只帮你补齐描述，不会复制角色</small></div>
                <div className="starter-demo-grid">
                  {STARTER_ANCHOR_DEMOS.map((demo, index) => <button type="button" onClick={() => chooseStarterDemo(index)} disabled={anchorConverting} key={demo.id}><img src={demo.preview} alt="" /><span><strong>{demo.title}</strong><small>{demo.description}</small></span></button>)}
                </div>
<label className="starter-brief"><span>描述你的第一版角色</span><textarea disabled={anchorConverting} value={starterAnchorBrief} maxLength={1200} placeholder="例如：蓝色短发、圆眼睛、黑色卫衣、黄色运动鞋，随身带一本笔记本，安静但有好奇心……" onChange={(event) => { setStarterAnchorBrief(event.target.value); if (pendingAnchorCandidate) setPendingAnchorCandidate(undefined); }} /><small>{starterAnchorBrief.length}/1200 · 至少写清发型或物种、服装、配色与一个记忆点</small></label>
                <div className="starter-model-note"><Sparkles size={15} /><span><strong>推荐 Image 2 / gpt-image-2</strong><small>其他生图模型也可尝试，但角色细节、中文字形和透明度可能不同；模型必须支持文字生图。</small></span></div>
              </section>
            )}

            {(pendingAnchorFile || anchorCreationMode === "create") && <div className="anchor-style-section"><div className="anchor-style-heading"><span>选择 IP 核心画风</span><small>示例只展示画法，不提供角色身份</small></div><div className="anchor-style-grid">{ANCHOR_STYLE_PRESETS.filter((preset) => anchorCreationMode === "upload" || preset.id !== "original").map((preset) => { const preview = preset.id === "original" ? pendingAnchorUrl : preset.preview; return <button type="button" className={`anchor-style-option ${pendingAnchorStyle === preset.id ? "is-selected" : ""}`} onClick={() => choosePendingAnchorStyle(preset.id)} disabled={anchorConverting} key={preset.id}>{preview && <img src={preview} alt={`${preset.label}示例`} />}<span><strong>{preset.label}</strong><small>{preset.description}</small></span>{pendingAnchorStyle === preset.id && <Check size={16} />}</button>; })}</div></div>}
            {pendingAnchorCandidateUrl && pendingAnchorCandidate && <div className="starter-candidate anchor-candidate"><button type="button" className="starter-candidate-image image-preview-trigger" onClick={() => setImagePreview({ src: pendingAnchorCandidateUrl, title: anchorCreationMode === "create" ? "待确认的基础锚点" : `待确认的${getAnchorStylePreset(pendingAnchorStyle).label}锚点` })} aria-label="放大预览待确认的锚点" title="点击放大预览"><img src={pendingAnchorCandidateUrl} alt="AI 生成的待确认锚点" /></button><span><strong>{anchorCreationMode === "create" ? "基础锚点候选已生成" : "转画风锚点候选已生成"}</strong><small>先放大检查发型、服装、手脚与标志物。下载不会自动覆盖当前角色。</small><span className="anchor-candidate-actions"><a href={pendingAnchorCandidateUrl} download={pendingAnchorCandidate.name}><Download size={14} /> 下载 PNG</a><button type="button" onClick={() => void (anchorCreationMode === "create" ? generateStarterAnchorCandidate() : generateConvertedAnchorCandidate())} disabled={anchorConverting}>重新生成</button></span></span></div>}
            {anchor && <div className="current-anchor-meta"><div><Check size={15} /><span><strong>当前：{anchorStyle.label}</strong><small>{new Date(anchor.updatedAt).toLocaleString("zh-CN")} 保存 · {anchor.name}</small></span></div><button onClick={() => void deleteAnchor()} disabled={anchorConverting}><Trash2 size={15} /> 移除</button></div>}
            <div className="anchor-style-lock">
              <ShieldCheck size={18} />
              <div><strong>生成、上传与转换后的锚点都只保存在本机</strong><small>后续默认跟随核心锚点画风；每个创作入口仍可临时改成萌粒风，表情包还可选择参考表情的原生画风。</small></div>
            </div>
            <div className="anchor-tips"><strong>更稳定的小诀窍</strong><span>完整头发或耳朵轮廓 · 标志性服装与配色 · 不要裁掉手脚 · 避免复杂场景</span></div>
            {notice && <div className="notice anchor-notice"><Sparkles size={15} /><span>{notice}</span></div>}
            {anchorCreationMode === "create" ? <button className="modal-primary" onClick={() => pendingAnchorCandidate ? void confirmAnchorStyle() : void generateStarterAnchorCandidate()} disabled={anchorConverting || (!pendingAnchorCandidate && starterAnchorBrief.trim().length < 8)}>{anchorConverting ? <><LoaderCircle className="spin" size={17} /> 正在生成角色候选，请保持前台</> : pendingAnchorCandidate ? "确认这张为核心锚点" : connected ? "生成角色锚点候选（消耗 1 张）" : "连接创作 API 后生成"}</button> : <button className="modal-primary" onClick={() => void (pendingAnchorStyle === "original" || pendingAnchorCandidate ? confirmAnchorStyle() : generateConvertedAnchorCandidate())} disabled={!pendingAnchorFile || anchorConverting}>{anchorConverting ? <><LoaderCircle className="spin" size={17} /> 正在生成转画风候选，请保持前台</> : !pendingAnchorFile ? "先上传一张身份原图" : pendingAnchorStyle === "original" ? "确认原图为核心锚点" : pendingAnchorCandidate ? "确认候选为核心锚点" : connected ? `生成${getAnchorStylePreset(pendingAnchorStyle).label}候选（消耗 1 张）` : "连接创作 API 后转换"}</button>}
          </div>
        </div>
      )}
      {imagePreview && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={`${imagePreview.title}大图预览`} onMouseDown={(event) => { if (event.target === event.currentTarget) setImagePreview(undefined); }}>
          <button type="button" className="image-lightbox-close" onClick={() => setImagePreview(undefined)} aria-label="关闭大图预览" autoFocus><X size={24} /></button>
          <figure>
            <div className="image-lightbox-stage"><img src={imagePreview.src} alt={imagePreview.title} /></div>
            <figcaption><strong>{imagePreview.title}</strong><span>点击空白处或按 Esc 关闭</span></figcaption>
          </figure>
        </div>
      )}
      <FirstVisitOnboarding open={onboardingOpen} onClose={closeOnboarding} />
    </div>
  );
}

function ArtworkDownload({ artwork }: { artwork: ArtworkRecord }) {
  const url = useBlobUrl(artwork.blob);
  return <a href={url} download={`${artwork.title}.png`} aria-label="下载作品"><Download size={16} /></a>;
}
