"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const steps = [
  {
    eyebrow: "STEP 01 · 核心锚点",
    title: "先让 Studio 认识你的角色",
    body: "上传现有角色图，或从一段描述生成第一张锚点。确认以后，所有创作都会优先守住这张脸。",
    image: "/art/onboarding/01-anchor.png",
    alt: "蓝发角色在三面镜前确认造型，绿发角色拿着角色设定表",
  },
  {
    eyebrow: "STEP 02 · 生图能力",
    title: "接上你的生图 API",
    body: "一键授权 TokenDance，或填写自己的兼容生图 API。请使用支持生图的模型，费用走你自己的账户。",
    image: "/art/onboarding/02-api.png",
    alt: "两位角色把钥匙形接口接入创作机器",
  },
  {
    eyebrow: "STEP 03 · 一键创作",
    title: "选工具，回答几道小问卷",
    body: "文章、信息图、贴纸、头像等工具都预装了 Skill 判断。只说用途、主题和数量，不必写复杂 Prompt。",
    image: "/art/onboarding/03-tools.png",
    alt: "两位角色在桌边选择创作工具卡片并填写小问卷",
  },
  {
    eyebrow: "STEP 04 · 作品带走",
    title: "预览、下载，然后一直复用",
    body: "结果会逐张保存到作品簿，可以放大、单张下载或打包。角色锚点留在本机，下一次继续使用。",
    image: "/art/onboarding/04-download.png",
    alt: "两位角色展示插画和贴纸作品，旁边有下载按钮和作品收纳盒",
  },
] as const;

export const ONBOARDING_STORAGE_KEY = "ip-studio-onboarding-v1";

export function FirstVisitOnboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const dismiss = useCallback(() => {
    setStepIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [dismiss, open]);

  if (!open) return null;

  return (
    <div className="onboarding-layer" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <section className="onboarding-shell">
        <header className="onboarding-header">
          <div className="onboarding-brand"><Image src="/brand/ip-studio-logo.webp" alt="" width={64} height={64} /><span><strong>IP Studio</strong><small>四步开始你的角色创作间</small></span></div>
          <button type="button" className="onboarding-skip" onClick={dismiss}>跳过引导 <X size={16} /></button>
        </header>

        <div className="onboarding-progress" aria-label={`引导进度：第 ${stepIndex + 1} 步，共 ${steps.length} 步`}>
          {steps.map((item, index) => (
            <button type="button" className={index <= stepIndex ? "is-active" : ""} onClick={() => setStepIndex(index)} aria-label={`前往第 ${index + 1} 步：${item.title}`} aria-current={index === stepIndex ? "step" : undefined} key={item.eyebrow}><span>{index + 1}</span></button>
          ))}
        </div>

        <div className="onboarding-body">
          <div className="onboarding-copy">
            <div className="onboarding-eyebrow"><Sparkles size={16} /> {step.eyebrow}</div>
            <h2 id="onboarding-title">{step.title}</h2>
            <p>{step.body}</p>
            <div className="onboarding-promise"><Check size={16} /><span><strong>不用学复杂 Prompt</strong><small>角色锚点确认一次，后面的工具直接复用。</small></span></div>
          </div>
          <figure className="onboarding-art">
            <Image src={step.image} alt={step.alt} width={1254} height={1254} priority={stepIndex === 0} />
            <figcaption>一个角色，长出整个内容世界。</figcaption>
          </figure>
        </div>

        <footer className="onboarding-footer">
          <button type="button" className="onboarding-back" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={stepIndex === 0}><ArrowLeft size={17} /> 上一步</button>
          <span>{String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span>
          <button type="button" className="onboarding-next" onClick={() => isLast ? dismiss() : setStepIndex((current) => Math.min(steps.length - 1, current + 1))}>{isLast ? <><Check size={18} /> 开始创作</> : <>下一步 <ArrowRight size={18} /></>}</button>
        </footer>
      </section>
    </div>
  );
}
