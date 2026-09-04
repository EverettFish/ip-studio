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
import { useEffect, useState } from "react";
import {
  beginTokenDanceAuthorization,
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
} from "@/lib/ai-provider";
import { browserApiError } from "@/lib/browser-openai";

type Props = {
  connection?: AiConnection;
  onClose: () => void;
  onConnect: (connection: AiConnection) => void;
  onDisconnect: () => void;
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

export function ProviderModal({ connection, onClose, onConnect, onDisconnect }: Props) {
  const [provider, setProvider] = useState<AiProviderId>(connection?.provider || "tokendance");
  const [apiKey, setApiKey] = useState("");
  const [planningModel, setPlanningModel] = useState(connection?.planningModel || "seed-2.0-mini");
  const [imageModel, setImageModel] = useState(connection?.imageModel || "seedream-5.0-lite");
  const [customLabel, setCustomLabel] = useState(connection?.provider === "custom" ? connection.label : "我的兼容 API");
  const [baseUrl, setBaseUrl] = useState(connection?.provider === "custom" ? connection.baseUrl : "");
  const [imageBaseUrl, setImageBaseUrl] = useState(connection?.provider === "custom" ? connection.imageBaseUrl : "");
  const [imageProtocol, setImageProtocol] = useState<ImageApiProtocol>(connection?.provider === "custom" ? connection.imageProtocol : "openai-edits");
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
          baseUrl,
          imageBaseUrl: imageBaseUrl || baseUrl,
          planningModel,
          imageModel,
          imageProtocol,
        };
      }
      const checked = await validateAiConnection(next);
      onConnect(checked);
      setApiKey("");
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
        ...(provider === "custom" ? {
          label: customLabel,
          baseUrl,
          imageBaseUrl: imageBaseUrl || baseUrl,
          imageProtocol,
        } : {}),
      });
      onConnect(next);
    } catch (cause) {
      setError(browserApiError(cause));
    }
  }

  async function authorizeTokenDance() {
    setLoading(true);
    setError("");
    try {
      await beginTokenDanceAuthorization({ planningModel, imageModel });
    } catch (cause) {
      setError(browserApiError(cause));
      setLoading(false);
    }
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
        <button className="modal-close" type="button" onClick={onClose}><X /></button>
        <div className="modal-kicker"><ShieldCheck size={18} /> 模型服务由你选择</div>
        <h2>连接创作 API</h2>
        <p>Key 只保存在当前标签页，8 小时后或关闭标签页时自动清除。IP Studio 不代收模型费用，也不会把 Key 写进作品或上传到本站服务器。</p>

        <div className="provider-tabs" role="tablist" aria-label="选择模型服务商">
          {providerOptions.map((option) => (
            <button type="button" role="tab" aria-selected={provider === option.id} className={provider === option.id ? "is-active" : ""} onClick={() => chooseProvider(option.id)} key={option.id}>
              <strong>{option.title}</strong><small>{option.detail}</small>
            </button>
          ))}
        </div>

        {sameProviderConnected ? (
          <div className="provider-connected-view">
            <div className="connected-panel"><Check size={20} /><div><strong>{connection.label} 已连接</strong><span>当前标签页可直接创作</span></div></div>

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

            <div className="model-settings">
              <label><span>规划模型</span><input value={planningModel} onChange={(event) => setPlanningModel(event.target.value)} /></label>
              {provider === "tokendance" ? (
                <label><span>图片模型</span><select value={imageModel} onChange={(event) => setImageModel(event.target.value)}><option value="seedream-5.0-lite">Seedream 5.0 Lite · 省钱</option><option value="seedream-5.0-pro">Seedream 5.0 Pro · 高精度</option></select></label>
              ) : <label><span>图片模型</span><input value={imageModel} onChange={(event) => setImageModel(event.target.value)} /></label>}
              {provider === "custom" && <CustomEndpointFields label={customLabel} setLabel={setCustomLabel} baseUrl={baseUrl} setBaseUrl={setBaseUrl} imageBaseUrl={imageBaseUrl} setImageBaseUrl={setImageBaseUrl} imageProtocol={imageProtocol} setImageProtocol={setImageProtocol} />}
              <button className="save-models" type="button" onClick={saveConnectedModels}>保存模型设置</button>
            </div>
            {error && <div className="form-error"><AlertCircle size={15} /> {error}</div>}
            <button className="modal-primary" type="button" onClick={onClose}>继续创作</button>
            <button className="disconnect-button" type="button" onClick={disconnect}>断开当前服务</button>
          </div>
        ) : (
          <form onSubmit={connectWithKey}>
            {provider === "tokendance" && (
              <>
                <div className="tokendance-callout"><div><strong>推荐：OAuth 安全授权</strong><span>在 TokenDance 完成授权后自动返回，随后可在这里看余额和充值。</span></div></div>
                <div className="model-settings compact">
                  <label><span>规划模型</span><input value={planningModel} onChange={(event) => setPlanningModel(event.target.value)} /></label>
                  <label><span>图片模型</span><select value={imageModel} onChange={(event) => setImageModel(event.target.value)}><option value="seedream-5.0-lite">Seedream 5.0 Lite · 省钱</option><option value="seedream-5.0-pro">Seedream 5.0 Pro · 高精度</option></select></label>
                </div>
                <button className="oauth-button" type="button" onClick={() => void authorizeTokenDance()} disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17} /> 正在前往授权</> : <><ShieldCheck size={17} /> 用 TokenDance 授权连接</>}</button>
                <details className="manual-key"><summary>已有 TokenDance API Key，直接粘贴</summary><KeyInput value={apiKey} setValue={setApiKey} hint="生成消耗记入你的 TokenDance 账户" /></details>
              </>
            )}

            {provider === "openai" && (
              <>
                <KeyInput value={apiKey} setValue={setApiKey} hint="生成消耗直接记入你的 OpenAI 账户" />
                <div className="model-settings compact"><label><span>规划模型</span><input value={planningModel} onChange={(event) => setPlanningModel(event.target.value)} /></label><label><span>图片模型</span><input value={imageModel} onChange={(event) => setImageModel(event.target.value)} /></label></div>
              </>
            )}

            {provider === "custom" && (
              <>
                <div className="custom-warning"><AlertCircle size={16} /><span>只把 Key 交给你信任的接口服务商。远程地址必须使用 HTTPS。</span></div>
                <KeyInput value={apiKey} setValue={setApiKey} hint="Key 只会发送到下面填写的接口地址" />
                <div className="model-settings compact">
                  <label><span>规划模型</span><input value={planningModel} onChange={(event) => setPlanningModel(event.target.value)} placeholder="例如 deepseek-chat" /></label>
                  <label><span>图片模型</span><input value={imageModel} onChange={(event) => setImageModel(event.target.value)} placeholder="例如 gpt-image-1" /></label>
                  <CustomEndpointFields label={customLabel} setLabel={setCustomLabel} baseUrl={baseUrl} setBaseUrl={setBaseUrl} imageBaseUrl={imageBaseUrl} setImageBaseUrl={setImageBaseUrl} imageProtocol={imageProtocol} setImageProtocol={setImageProtocol} />
                </div>
              </>
            )}

            {error && <div className="form-error"><AlertCircle size={15} /> {error}</div>}
            {(provider !== "tokendance" || apiKey.length >= 8) && <button className="modal-primary" disabled={loading || apiKey.length < 8}>{loading ? <><LoaderCircle className="spin" size={17} /> 正在验证</> : "连接并验证"}</button>}
          </form>
        )}
      </div>
    </div>
  );
}

function KeyInput({ value, setValue, hint }: { value: string; setValue: (value: string) => void; hint: string }) {
  return <label className="key-field"><span>API Key</span><input type="password" autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} placeholder="粘贴你的 API Key" /><small><KeyRound size={13} /> {hint}</small></label>;
}

function CustomEndpointFields(props: {
  label: string;
  setLabel: (value: string) => void;
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  imageBaseUrl: string;
  setImageBaseUrl: (value: string) => void;
  imageProtocol: ImageApiProtocol;
  setImageProtocol: (value: ImageApiProtocol) => void;
}) {
  return (
    <>
      <label><span>服务名称</span><input value={props.label} onChange={(event) => props.setLabel(event.target.value)} placeholder="例如 我的 API" /></label>
      <label className="wide"><span>规划接口 Base URL</span><input value={props.baseUrl} onChange={(event) => props.setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
      <label className="wide"><span>图片接口 Base URL</span><input value={props.imageBaseUrl} onChange={(event) => props.setImageBaseUrl(event.target.value)} placeholder="留空则与规划接口相同" /></label>
      <label className="wide"><span>图片接口协议</span><select value={props.imageProtocol} onChange={(event) => props.setImageProtocol(event.target.value as ImageApiProtocol)}><option value="openai-edits">OpenAI /images/edits · 文件上传</option><option value="ark-generations">Ark /images/generations · 多参考图</option></select><small>锚点创作必须使用支持参考图的图片模型。</small></label>
    </>
  );
}
