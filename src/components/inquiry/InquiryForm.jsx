import { useId, useMemo, useRef, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitInquiry } from "../../services/platformApi.js";
import { CaptchaField } from "./CaptchaField.jsx";
import { customerSession } from "../../services/customerAuth.js";

const copy = {
  zh: {
    name: "姓名",
    country: "国家或地区",
    company: "公司名称",
    phone: "电话",
    whatsapp: "WhatsApp",
    email: "邮箱",
    message: "咨询内容",
    submit: "提交询盘",
    sending: "提交中...",
    success: "询盘已提交，我们会尽快联系您。",
    contact: "电话、WhatsApp 或邮箱至少填写一项。",
    failed: "提交失败，请稍后重试。",
  },
  en: {
    name: "Name",
    country: "Country or region",
    company: "Company",
    phone: "Phone",
    whatsapp: "WhatsApp",
    email: "Email",
    message: "Message",
    submit: "Send inquiry",
    sending: "Sending...",
    success: "Your inquiry has been submitted. We will contact you shortly.",
    contact: "Provide at least a phone number, WhatsApp, or email.",
    failed: "Submission failed. Please try again.",
  },
  ru: {
    name: "Имя",
    country: "Страна или регион",
    company: "Компания",
    phone: "Телефон",
    whatsapp: "WhatsApp",
    email: "Эл. почта",
    message: "Сообщение",
    submit: "Отправить запрос",
    sending: "Отправка...",
    success: "Ваш запрос отправлен. Мы скоро свяжемся с вами.",
    contact: "Укажите телефон, WhatsApp или электронную почту.",
    failed: "Не удалось отправить. Повторите попытку.",
  },
};

export function InquiryForm({ lang = "ru", vehicle, onSuccess }) {
  const text = copy[lang] || copy.ru;
  const contactId = useId();
  const phoneRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    country: "",
    companyName: "",
    phone: "",
    whatsapp: "",
    email: "",
    message: "",
    website: "",
  });
  const [state, setState] = useState({ status: "idle", message: "" });
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState(false);
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0);
  const captchaProvider = String(
    import.meta.env.VITE_CAPTCHA_PROVIDER || "disabled",
  ).toLowerCase();
  const captchaEnabled =
    captchaProvider === "turnstile" || captchaProvider === "hcaptcha";
  const captchaSiteKey = import.meta.env.VITE_CAPTCHA_SITE_KEY || "";
  const vehicleTitle = vehicle?.titleI18n?.[lang] || vehicle?.title || "";
  const initialMessage = useMemo(
    () =>
      vehicleTitle ? `${vehicleTitle} (${vehicle.stockNo || vehicle.id})` : "",
    [vehicleTitle, vehicle],
  );

  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.phone && !form.whatsapp && !form.email) {
      setState({ status: "error", message: text.contact });
      phoneRef.current?.focus();
      return;
    }
    setState({ status: "loading", message: "" });
    const params = new URLSearchParams(window.location.search);
    try {
      const payload = {
        ...form,
        captchaToken: captchaEnabled ? captchaToken : undefined,
        message: form.message || initialMessage,
        preferredLanguage: lang,
        vehicleId: vehicle?.databaseId,
        sourcePage: `${window.location.pathname}${window.location.search}`,
        utmSource: params.get("utm_source") || undefined,
        utmMedium: params.get("utm_medium") || undefined,
        utmCampaign: params.get("utm_campaign") || undefined,
      };
      const result = await submitInquiry(
        Object.fromEntries(
          Object.entries(payload)
            .map(([key, value]) => [
              key,
              typeof value === "string" ? value.trim() : value,
            ])
            .filter(
              ([, value]) =>
                value !== "" && value !== undefined && value !== null,
            ),
        ),
        customerSession()?.accessToken,
      );
      setState({
        status: "success",
        message: `${text.success} #${result.reference}`,
      });
      setCaptchaResetNonce((value) => value + 1);
      onSuccess?.(result);
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : text.failed,
      });
    }
  };

  if (state.status === "success") {
    return (
      <div className="inquiry-success" role="status">
        <CheckCircle2 size={42} />
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form
      className="inquiry-form"
      onSubmit={submit}
      aria-busy={state.status === "loading"}
    >
      <div className="inquiry-form-grid">
        <label>
          <span>{text.name} *</span>
          <input
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={update("name")}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label>
          <span>{text.country}</span>
          <input
            value={form.country}
            onChange={update("country")}
            maxLength={100}
          />
        </label>
        <label>
          <span>{text.company}</span>
          <input
            name="organization"
            autoComplete="organization"
            value={form.companyName}
            onChange={update("companyName")}
            maxLength={191}
          />
        </label>
        <label>
          <span>{text.phone}</span>
          <input
            ref={phoneRef}
            autoComplete="tel"
            aria-describedby={contactId}
            aria-invalid={
              (state.status === "error" && state.message === text.contact) ||
              undefined
            }
            value={form.phone}
            onChange={update("phone")}
            inputMode="tel"
            maxLength={64}
          />
        </label>
        <label>
          <span>{text.whatsapp}</span>
          <input
            aria-describedby={contactId}
            value={form.whatsapp}
            onChange={update("whatsapp")}
            inputMode="tel"
            maxLength={64}
          />
        </label>
        <label>
          <span>{text.email}</span>
          <input
            name="email"
            autoComplete="email"
            aria-describedby={contactId}
            value={form.email}
            onChange={update("email")}
            type="email"
            maxLength={191}
          />
        </label>
        <label className="inquiry-message">
          <span>{text.message} *</span>
          <textarea
            value={form.message}
            onChange={update("message")}
            placeholder={initialMessage}
            required={!initialMessage}
            minLength={5}
            maxLength={5000}
            rows={5}
          />
        </label>
        <label className="inquiry-honeypot" aria-hidden="true">
          <span>Website</span>
          <input
            value={form.website}
            onChange={update("website")}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
      <p className="form-hint" id={contactId}>
        {text.contact}
      </p>
      {captchaEnabled ? (
        <CaptchaField
          provider={captchaProvider}
          siteKey={captchaSiteKey}
          onToken={(token) => {
            setCaptchaToken(token);
            setCaptchaError(false);
          }}
          onError={() => setCaptchaError(true)}
          resetNonce={captchaResetNonce}
        />
      ) : null}
      {state.status === "error" ? (
        <p className="inquiry-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="inquiry-submit"
        type="submit"
        disabled={
          state.status === "loading" ||
          (captchaEnabled && (!captchaToken || captchaError))
        }
      >
        <Send size={18} />
        {state.status === "loading" ? text.sending : text.submit}
      </button>
    </form>
  );
}
