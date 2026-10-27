import { useId } from "react";
import wechat from "./social/wechat-public.png";
import redbook from "./social/xiaohongshu.png";
import qq from "./social/qq-group.png";
import wechatPay from "./social/wechat-pay.png";
import alipay from "./social/alipay.png";

const contacts = [
  { name: "公众号", description: "微信公众号", image: wechat, url: "http://weixin.qq.com/r/mp/aS_zq0-E-xKArQvI93p7" },
  { name: "小红书", description: "小红书", image: redbook, url: "http://xhslink.com/m/8eqzBqQl4f" },
  { name: "QQ群", description: "QQ群", image: qq, url: "https://qm.qq.com/q/bdXbdLscDK" },
];

const links = [
  { name: "CNB", url: "https://cnb.cool/u/echohaoran" },
  { name: "GitHub", url: "https://github.com/echohaoran?tab=repositories" },
  { name: "Gitee", url: "https://gitee.com/echohaoran" },
  { name: "新闻网", url: "https://news.echohaoran.top/agent" },
  { name: "Email", url: "mailto:echohaoran@gmail.com" },
];

/** The same public contacts and support codes as the personal blog. */
export function SocialLinks() {
  const id = useId();
  return (
    <section aria-label="联系与支持" className="relative text-[12px] text-ink-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {contacts.map((contact) => (
          <div key={contact.name} className="group relative">
            <a href={contact.url} target="_blank" rel="noopener noreferrer" aria-label={contact.description} aria-describedby={`${id}-${contact.name}`} className="inline-flex min-h-7 items-center hover:text-accent focus-visible:text-accent">
              {contact.name}
            </a>
            <div id={`${id}-${contact.name}`} role="tooltip" className="pointer-events-none invisible absolute bottom-full left-0 z-50 w-44 rounded-control border border-line bg-surface p-2 text-center opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <strong className="block pb-1 text-ink">{contact.description}</strong>
              <img src={contact.image} alt={`${contact.description}二维码`} width="160" height="160" className="aspect-square w-full rounded-mark bg-white object-contain" />
              <span className="mt-1 block text-[11px]">扫码查看，或点击链接打开</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {links.map((link) => (
          <a key={link.name} href={link.url} target={link.url.startsWith("mailto:") ? undefined : "_blank"} rel={link.url.startsWith("mailto:") ? undefined : "noopener noreferrer"} className="inline-flex min-h-7 items-center hover:text-accent focus-visible:text-accent">{link.name}</a>
        ))}
      </div>
      <details className="group/coffee relative" onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.open = false; }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
        <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 font-semibold text-accent hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">☕ Buy me a coffee</summary>
        <div className="fixed left-1/2 top-1/2 z-50 w-[min(320px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-control border border-line bg-surface p-4 text-center shadow-xl lg:absolute lg:bottom-0 lg:left-full lg:top-auto lg:ml-3 lg:w-[360px] lg:translate-x-0 lg:translate-y-0">
          <p className="mb-3 font-semibold text-ink">请我喝杯咖啡</p>
          <div className="grid grid-cols-2 gap-3">
            {[{ name: "微信支付", image: wechatPay }, { name: "支付宝", image: alipay }].map((method) => (
              <a key={method.name} href={method.image} target="_blank" rel="noopener noreferrer" className="grid gap-1 hover:text-accent">
                <img src={method.image} alt={`${method.name}收款二维码`} width="160" height="160" className="aspect-square w-full rounded-mark bg-white object-contain" />
                <span>{method.name}</span>
              </a>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-4">使用对应的 App 扫码支持</p>
        </div>
      </details>
    </section>
  );
}
