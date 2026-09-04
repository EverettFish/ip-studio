"use client";

/* eslint-disable @next/next/no-img-element -- Payment QR codes are generated as local data URLs. */

import {
  AlertCircle,
  Check,
  CircleDollarSign,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  beginTokenDanceAuthorization,
  checkTokenDanceNetwork,
  createTokenDancePayment,
  defaultCustomConnection,
  defaultOpenAiConnection,
  defaultTokenDanceConnection,
  getTokenDanceBalance,
  getTokenDancePaymentStatus,
  microYuanToYuan,
  type AiConnection,
  type AiProviderId,
  type ImageApiProtocol,
  type TokenDanceBalance,
  type TokenDancePaymentSession,
  validateAiConnection,
  validateConnectionFields,
  inspectImageModel,
  usesApiPlanning,
} from "@/lib/ai-provider";
import { browserApiError, testImageConnection } from "@/lib/browser-openai";

type Props = {
  connection?: AiConnection;
  onClose: () => void;
  onConnect: (connection: AiConnection) => void;
  onDisconnect: () => void;
  authorizationMessage?: string;
};

const providerOptions: Array<{ id: AiProviderId; title: string; detail: string }> = [
  { id: "tokendance", title: "TokenDance", detail: "授权、余额与充值" },
  { id: "openai", title: "OpenAI", detail: "官方 API Key" },
  { id: "custom", title: "其他 API", detail: "兼容接口 / 自建网关" },
];

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function money(value: number): string {
  return microYuanToYuan(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function ProviderModal({ connection, onClose, onConnect, onDisconnect, authorizationMessage }: Props) {
  const [provider, setProvider] = useState<AiProviderId>(connection?.provider || "tokendance");
  const [apiKey, setApiKey] = useState("");
  const [planningModel, setPlanningModel] = useState(connection?.planningModel || "seed-2.0-mini");
  const [imageModel, setImageModel] = useState(connection?.imageModel || "seedream-5.0-lite");
  const [customLabel, setCustomLabel] = useState(connection?.provider === "custom" ? connection.label : "我的兼容 API");
  const [baseUrl, setBaseUrl] = useState(connection?.provider === "custom" ? connection.baseUrl : "");
  const [imageBaseUrl, setImageBaseUrl] = useState(connection?.provider === "custom" ? connection.imageBaseUrl : "");
  const [imageProtocol, setImageProtocol] = useState<ImageApiProtocol>(connection?.provider === "custom" ? connection.imageProtocol : "openai-edits");
  const [planningMode, setPlanningMode] = useState<"api" | "local">(connection && !usesApiPlanning(connection) ? "local" : "api");
  const [planningApiKey, setPlanningApiKey] = useState(connection?.planningApiKey || "");
  const [feedback, setFeedback] = useState("");
  const [networkMessage, setNetworkMessage] = useState("");
  const [testBlob, setTestBlob] = useState<Blob>();
  const testUrl = useMemo(() => testBlob ? URL.createObjectURL(testBlob) : "", [testBlob]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<TokenDanceBalance>();
  const [balanceLoading, setBalanceLoading] = useState(connection?.provider === "tokendance");
  const [topUpAmount, setTopUpAmount] = useState(50);
  const [confirmPayment, setConfirmPayment] = useState(false);
  const [payment, setPayment] = useState<TokenDancePaymentSession>();
  const [paymentStatus, setPaymentStatus] = useState<TokenDancePaymentSession["status"]>();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [mobile] = useState(() => isMobileDevice());
  const sameProviderConnected = connection?.provider === provider;

  function chooseProvider(next: AiProviderId) {
    setProvider(next);
    setPlanningMode(connection?.provider === next ? (usesApiPlanning(connection) ? "api" : "local") : next === "custom" ? "local" : "api");
    setPlanningApiKey(connection?.provider === next ? connection.planningApiKey || "" : "");
    setFeedback("");
    setTestBlob(undefined);
    if (next === "openai") {
      setPlanningModel(connection?.provider === "openai" ? connection.planningModel : "gpt-5.6-luna");
      setImageModel(connection?.provider === "openai" ? connection.imageModel : "gpt-image-2");
    } else if (next === "tokendance") {
      setPlanningModel(connection?.provider === "tokendance" ? connection.planningModel : "seed-2.0-mini");
      setImageModel(connection?.provider === "tokendance" ? connection.imageModel : "seedream-5.0-lite");
    } else if (connection?.provider === "custom") {
      setPlanningModel(connection.planningModel);
      setImageModel(connection.imageModel);
      setCustomLabel(connection.label);
      setBaseUrl(connection.baseUrl);
      setImageBaseUrl(connection.imageBaseUrl);
      setImageProtocol(connection.imageProtocol);
    } else {
      setPlanningModel("");
      setImageModel("");
    }
    setApiKey("");
    setError("");
    setConfirmPayment(false);
    setPayment(undefined);
  }

  useEffect(() => {
    return () => { if (testUrl) URL.revokeObjectURL(testUrl); };
  }, [testUrl]);

  const settingsFields = (
    <>
      <div className="model-settings compact">
        {provider === "custom" && <label className="wide"><span>① 生图接口地址（必填）</span><input value={imageBaseUrl || baseUrl} onChange={(event) => setImageBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /><small>复制服务商的 Base URL。也支持粘贴以 /images/edits 或 /images/generations 结尾的完整地址。</small></label>}
        <label className="wide"><span>② 生图模型 ID（必填，不是聊天模型）</span>{provider === "tokendance" ? <select value={imageModel} onChange={(event) => setImageModel(event.target.value)}><option value="seedream-5.0-lite">Seedream 5.0 Lite · 图生图</option><option value="seedream-5.0-pro">Seedream 5.0 Pro · 图生图</option></select> : <input value={imageModel} onChange={(event) => setImageModel(event.target.value)} placeholder="复制服务商的生图模型 ID，例如 gpt-image-2" />}<small>必须支持输入参考图并返回图片。DeepSeek Chat、Claude、普通 GPT 等文字模型不能用来生图；“能看图”也不等于“能生成图”。</small></label>
        {provider === "custom" && <label className="wide"><span>③ 生图接口格式</span><select value={imageProtocol} onChange={(event) => setImageProtocol(event.target.value as ImageApiProtocol)}><option value="openai-edits">OpenAI 图片编辑 · /images/edits（GPT Image 类）</option><option value="ark-generations">Ark 多参考图 · /images/generations（Seedream 类）</option></select><small>按服务商文档选择。只有文生图、没有参考图/编辑能力的接口不能保持角色锚点，本站不支持当作图生图使用。</small></label>}
        <label className="wide"><span>④ 文章规划方式（不影响头像、贴纸等工具）</span><select value={planningMode} onChange={(event) => setPlanningMode(event.target.value as "local" | "api")}><option value="local">只有生图 API：本地按原文分段，不调用文字模型</option><option value="api">另配文字模型：AI 阅读文章并规划画面</option></select><small>本地模式不做 AI 摘要，按原文分段交给生图模型；精细理解和自动编排建议另配文字 API。</small></label>
        {planningMode === "api" && <>
          {provider === "custom" && <label className="wide"><span>文字规划接口地址</span><input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://text.example.com/v1" /></label>}
          <label className="wide"><span>文字规划模型 ID（不是生图模型）</span><input value={planningModel} onChange={(event) => setPlanningModel(event.target.value)} placeholder="例如 deepseek-chat，按文字服务商填写" /></label>
          {provider === "custom" && <label className="wide"><span>文字规划 API Key</span><input type="password" autoComplete="off" value={planningApiKey} onChange={(event) => setPlanningApiKey(event.target.value)} placeholder="另一家服务必须单独填写 Key" /><small>只有与生图接口同一域名时，留空才复用生图 Key。文字规划使用 OpenAI Chat Completions 兼容协议。</small></label>}
        </>}
      </div>
    </>
  );

  async function refreshBalance() {
    if (connection?.provider !== "tokendance") return;
    setBalanceLoading(true);
    setError("");
    try {
      setBalance(await getTokenDanceBalance(connection));
    } catch (cause) {
      setError(browserApiError(cause));
    } finally {
      setBalanceLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (connection?.provider === "tokendance") {
      void getTokenDanceBalance(connection)
        .then((next) => { if (!cancelled) setBalance(next); })
        .catch((cause) => { if (!cancelled) setError(browserApiError(cause)); })
        .finally(() => { if (!cancelled) setBalanceLoading(false); });
    }
    return () => { cancelled = true; };
  }, [connection]);

  useEffect(() => {
    let cancelled = false;
    if (!payment?.paymentUrl || mobile) {
      return;
    }
    void QRCode.toDataURL(payment.paymentUrl, { width: 224, margin: 1, color: { dark: "#111111", light: "#ffffff" } })
      .then((value) => { if (!cancelled) setQrCode(value); })
      .catch(() => { if (!cancelled) setError("支付二维码生成失败，请刷新后重试。"); });
    return () => { cancelled = true; };
  }, [mobile, payment]);

  useEffect(() => {
    if (!payment || paymentStatus !== "pending" || connection?.provider !== "tokendance") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (cancelled) return;
      if (Date.now() >= new Date(payment.expiredAt).getTime()) {
        setPaymentStatus("closed");
        return;
      }
      try {
        const status = await getTokenDancePaymentStatus(connection, payment.statusUrl);
        if (cancelled) return;
        setPaymentStatus(status);
        if (status === "paid") await refreshBalance();
        if (status === "pending") timer = setTimeout(poll, 3000);
      } catch (cause) {
        if (!cancelled) {
          setError(browserApiError(cause));
          timer = setTimeout(poll, 3000);
        }
      }
    };
    timer = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // refreshBalance is stable enough for this bounded polling lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, payment, paymentStatus]);

  async function connectWithKey(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      let next: AiConnection;
      if (provider === "openai") {
        next = defaultOpenAiConnection(apiKey);
        next = { ...next, planningModel, imageModel };
      } else if (provider === "tokendance") {
        next = defaultTokenDanceConnection(apiKey, planningModel, imageModel);
      } else {
        next = {
          ...defaultCustomConnection(),
          label: customLabel,
          apiKey,
          baseUrl: baseUrl || imageBaseUrl,
          imageBaseUrl: imageBaseUrl || baseUrl,
          planningModel,
          imageModel,
          imageProtocol,
        };
      }
      next = { ...next, planningMode, planningApiKey };
      const checked = await validateAiConnection(next);
      onConnect(checked);
      setApiKey("");
      setFeedback("配置已保存，尚未验证实际出图。可检查模型列表，或点击“测试生成 1 张”确认。");
    } catch (cause) {
      setError(browserApiError(cause));
    } finally {
      setLoading(false);
    }
  }

  function saveConnectedModels() {
    if (!connection || connection.provider !== provider) return;
    setError("");
    try {
      const next = validateConnectionFields({
        ...connection,
        planningModel,
        imageModel,
        planningMode,
        planningApiKey,
        ...(provider === "custom" ? {
          label: customLabel,
          baseUrl: baseUrl || imageBaseUrl,
          imageBaseUrl: imageBaseUrl || baseUrl,
          imageProtocol,
        } : {}),
      });
      onConnect(next);
      setTestBlob(undefined);
      setFeedback("配置已更新，修改模型后请重新测试出图。");
    } catch (cause) {
      setError(browserApiError(cause));
    }
  }

  async function authorizeTokenDance() {
    setLoading(true);
    setError("");
    try {
      await beginTokenDanceAuthorization({ planningModel, imageModel, planningMode });
    } catch (cause) {
      setError(browserApiError(cause));
      setLoading(false);
    }
  }

  async function checkModel() {
    if (!connection) return;
    setLoading(true); setError(""); setFeedback("");
    try { setFeedback(await inspectImageModel(connection)); }
    catch (cause) { setError(browserApiError(cause)); }
    finally { setLoading(false); }
  }

  async function testGeneration() {
    if (!connection || !window.confirm(`将向 ${connection.label} 发送一张程序生成的蓝色圆形测试图，使用 ${connection.imageModel} 生成 1 张图片，会消耗你的 API 额度。确认测试？`)) return;
    setLoading(true); setError(""); setFeedback("正在测试真实图生图，请勿关闭页面或重复提交…");
    try { setTestBlob(await testImageConnection(connection)); setFeedback("图生图请求已成功返回图片，请查看测试图是否保留蓝色圆形角色。"); }
    catch (cause) { setFeedback(""); setError(browserApiError(cause)); }
    finally { setLoading(false); }
  }

  async function startPayment() {
    if (connection?.provider !== "tokendance") return;
    setPaymentLoading(true);
    setError("");
    try {
      const created = await createTokenDancePayment(connection, topUpAmount);
      setPayment(created);
      setPaymentStatus(created.status);
      setConfirmPayment(false);
    } catch (cause) {
      setError(browserApiError(cause));
    } finally {
      setPaymentLoading(false);
    }
  }

  function disconnect() {
    onDisconnect();
    setBalance(undefined);
    setPayment(undefined);
    setApiKey("");
  }

  return (
    <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading && !paymentLoading) onClose(); }}>
      <div className="paper-modal provider-modal">
        <button className="modal-close" type="button" aria-label="关闭 API 配置" disabled={loading} onClick={onClose}><X /></button>
        <div className="modal-kicker"><ShieldCheck size={18} /> 模型服务由你选择</div>
        <h2>连接创作 API</h2>
        <p>Key 只保存在当前标签页，8 小时后或关闭标签页时自动清除。IP Studio 不代收模型费用，也不会把 Key 写进作品或上传到本站服务器。</p>
        {authorizationMessage && <p role="status">{authorizationMessage}</p>}

        <div className="provider-tabs" role="tablist" aria-label="选择模型服务商">
          {providerOptions.map((option) => (
            <button type="button" role="tab" disabled={loading} aria-selected={provider === option.id} className={provider === option.id ? "is-active" : ""} onClick={() => chooseProvider(option.id)} key={option.id}>
              <strong>{option.title}</strong><small>{option.detail}</small>
            </button>
          ))}
        </div>

        {sameProviderConnected ? (
          <div className="provider-connected-view">
            <div className="connected-panel"><Check size={20} /><div><strong>{connection.label} 配置已保存</strong><span>保存配置不代表模型已经通过生图测试</span></div></div>

            {provider === "tokendance" && (
              <>
                <div className="balance-card">
                  <div><small>当前可用余额</small><strong>{balance ? `¥ ${money(balance.balance)}` : balanceLoading ? "正在读取…" : "暂未读取"}</strong></div>
                  <button type="button" onClick={() => void refreshBalance()} disabled={balanceLoading} aria-label="刷新余额"><RefreshCw className={balanceLoading ? "spin" : ""} size={16} /></button>
                  {balance && <span>累计额度 ¥{money(balance.credits)} · 已使用 ¥{money(balance.creditsUsed)}</span>}
                </div>

                <section className="payment-box">
                  <div className="payment-heading"><WalletCards size={17} /><div><strong>账户充值</strong><small>付款直接进入你的 TokenDance 账户</small></div></div>
                  {!payment ? (
                    <>
                      <div className="amount-row">
                        {[10, 50, 100].map((amount) => <button type="button" className={topUpAmount === amount ? "is-active" : ""} onClick={() => { setTopUpAmount(amount); setConfirmPayment(false); }} key={amount}>¥{amount}</button>)}
                        <label><span>自定义</span><input type="number" min={1} max={100000} step={1} value={topUpAmount} onChange={(event) => { setTopUpAmount(Number(event.target.value)); setConfirmPayment(false); }} /></label>
                      </div>
                      {!confirmPayment ? (
                        <button className="payment-action" type="button" onClick={() => setConfirmPayment(true)}><CircleDollarSign size={16} /> 充值 ¥{topUpAmount}</button>
                      ) : (
                        <div className="payment-confirm"><span>确认创建 ¥{topUpAmount} 的支付订单？</span><div><button type="button" onClick={() => setConfirmPayment(false)}>取消</button><button type="button" onClick={() => void startPayment()} disabled={paymentLoading}>{paymentLoading ? "正在创建…" : "确认支付"}</button></div></div>
                      )}
                    </>
                  ) : paymentStatus === "paid" ? (
                    <div className="payment-result is-paid"><Check size={20} /><div><strong>充值成功</strong><span>余额已经刷新，可以继续创作。</span></div></div>
                  ) : (
                    <div className="payment-session">
                      {!mobile && qrCode && <img src={qrCode} alt={`支付宝充值 ${payment.amount} 元二维码`} />}
                      <div><strong>{paymentStatus === "pending" ? `等待支付 ¥${payment.amount}` : "本次订单未完成"}</strong><span>{paymentStatus === "pending" ? (mobile ? "请点击按钮打开支付宝完成付款。" : "请使用支付宝扫描二维码。") : `订单状态：${paymentStatus}`}</span>
                        {mobile && paymentStatus === "pending" && payment.alipayUrl && <button type="button" onClick={() => window.open(payment.alipayUrl, "_blank", "noopener,noreferrer")}>打开支付宝 <ExternalLink size={14} /></button>}
                        {mobile && paymentStatus === "pending" && !payment.alipayUrl && <small>当前订单没有支付宝跳转链接，请在电脑端扫码或重新创建。</small>}
                        <button className="payment-reset" type="button" onClick={() => { setPayment(undefined); setPaymentStatus(undefined); }}>换个金额</button>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}

            {settingsFields}
            <button className="save-models" type="button" disabled={loading} onClick={saveConnectedModels}>保存模型设置</button>
            <div className="provider-test-actions"><button type="button" disabled={loading} onClick={() => void checkModel()}>检查已保存的模型列表（免费）</button><button type="button" disabled={loading} onClick={() => void testGeneration()}>测试生成 1 张（消耗额度）</button></div>
            {feedback && <div className="notice" role="status">{feedback}</div>}
            {testBlob && testUrl && <a href={testUrl} download="ip-studio-api-test.png"><img className="provider-test-image" src={testUrl} alt="API 图生图测试结果" /></a>}
            {error && <div className="form-error"><AlertCircle size={15} /> {error}</div>}
            <button className="modal-primary" type="button" disabled={loading} onClick={onClose}>继续创作</button>
            <button className="disconnect-button" type="button" disabled={loading} onClick={disconnect}>断开当前服务</button>
          </div>
        ) : (
          <form onSubmit={connectWithKey}>
            {provider === "tokendance" && (
              <>
                <div className="tokendance-callout"><div><strong>推荐：OAuth 安全授权</strong><span>在 TokenDance 完成授权后自动返回，随后可在这里看余额和充值。</span></div></div>
                {settingsFields}
                <button className="save-models" type="button" onClick={() => { setNetworkMessage("正在检查…"); void checkTokenDanceNetwork().then(setNetworkMessage).catch((cause) => setNetworkMessage(browserApiError(cause))); }}>检查 TokenDance 网络（免费）</button>
                {networkMessage && <p className="provider-help" role="status">{networkMessage}</p>}
                <button className="oauth-button" type="button" onClick={() => void authorizeTokenDance()} disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17} /> 正在前往授权</> : <><ShieldCheck size={17} /> 用 TokenDance 授权连接</>}</button>
                <details className="manual-key"><summary>已有 TokenDance API Key，直接粘贴</summary><KeyInput value={apiKey} setValue={setApiKey} hint="生成消耗记入你的 TokenDance 账户" /></details>
              </>
            )}

            {provider === "openai" && (
              <>
                <KeyInput value={apiKey} setValue={setApiKey} hint="生成消耗直接记入你的 OpenAI 账户" />
                {settingsFields}
              </>
            )}

            {provider === "custom" && (
              <>
                <div className="custom-warning"><AlertCircle size={16} /><span>只把 Key 交给你信任的接口服务商。远程地址必须使用 HTTPS。</span></div>
                <KeyInput value={apiKey} setValue={setApiKey} hint="Key 只会发送到下面填写的接口地址" />
                {settingsFields}
              </>
            )}

            {error && <div className="form-error"><AlertCircle size={15} /> {error}</div>}
            {(provider !== "tokendance" || apiKey.length >= 8) && <button className="modal-primary" disabled={loading || apiKey.length < 8}>{loading ? <><LoaderCircle className="spin" size={17} /> 正在保存</> : "保存配置（不产生生图费用）"}</button>}
          </form>
        )}
      </div>
    </div>
  );
}

function KeyInput({ value, setValue, hint }: { value: string; setValue: (value: string) => void; hint: string }) {
  return <label className="key-field"><span>生图 API Key（必填）</span><input type="password" autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} placeholder="粘贴有生图权限的 API Key" /><small><KeyRound size={13} /> {hint}</small></label>;
}
