import { useId } from "react";
import wechat from "./social/wechat-public.png";
import redbook from "./social/xiaohongshu.png";
import qq from "./social/qq-group.png";
import wechatPay from "./social/wechat-pay.png";
import alipay from "./social/alipay.png";

const contacts = [
  { name: "公众号", icon: "wechat", description: "微信公众号", image: wechat, url: "http://weixin.qq.com/r/mp/aS_zq0-E-xKArQvI93p7" },
  { name: "小红书", icon: "redbook", description: "小红书", image: redbook, url: "http://xhslink.com/m/8eqzBqQl4f" },
  { name: "QQ群", icon: "qq", description: "QQ群", image: qq, url: "https://qm.qq.com/q/bdXbdLscDK" },
];

const links = [
  { name: "CNB", icon: "cnb", url: "https://cnb.cool/u/echohaoran" },
  { name: "GitHub", icon: "github", url: "https://github.com/echohaoran?tab=repositories" },
  { name: "Gitee", icon: "gitee", url: "https://gitee.com/echohaoran" },
  { name: "博客", icon: "blog", url: "https://blog.echohaoran.top/" },
  { name: "Email", icon: "email", url: "mailto:echohaoran@gmail.com" },
];

function SocialIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "wechat" && <><path d="M14.5 10.2c-.7-3.1-3.4-5.1-6.4-5.1-3.7 0-6.6 2.6-6.6 5.8 0 1.8.9 3.3 2.4 4.4l-.5 2.1 2.4-1.2c.8.3 1.6.4 2.5.4" /><path d="M21.8 14.4c0-2.6-2.3-4.5-5.1-4.5-2.9 0-5.1 1.9-5.1 4.5s2.2 4.5 5.1 4.5c.6 0 1.3-.1 1.9-.3l1.9 1-.4-1.8c1.1-.8 1.7-2 1.7-3.4Z" /><path d="M6 10h.1M10.2 10h.1M15 14h.1M18.5 14h.1" strokeWidth="2.6" /></>}
      {name === "redbook" && <><rect x="3" y="4" width="18" height="16" rx="4" /><path d="M8 8h8M8 12h8M8 16h5" /></>}
      {name === "qq" && <><path d="M7 15c-1 1-1.7 2.7-1.8 4l2-1M17 15c1 1 1.7 2.7 1.8 4l-2-1" /><path d="M7 12V9a5 5 0 0 1 10 0v3c0 4-2.2 7-5 7s-5-3-5-7ZM8.5 20h7" /><path d="M10 10h.1M14 10h.1M10 13l2 1 2-1" /></>}
      {name === "cnb" && <><path d="M12 2.8 20 7v10l-8 4.2L4 17V7l8-4.2ZM4 7l8 4.2L20 7M12 11.2v10" /></>}
      {name === "github" && <path fill="currentColor" stroke="none" d="M12 2.2a9.8 9.8 0 00-3.1 19.1c.5.1.7-.2.7-.5v-1.7c-2.7.6-3.3-1.3-3.3-1.3-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 014.9 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.5 4.9.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A9.8 9.8 0 0012 2.2z" />}
      {name === "gitee" && <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><path d="M16.5 8H10a2.5 2.5 0 0 0-2.5 2.5v3A2.5 2.5 0 0 0 10 16h4a2.5 2.5 0 0 0 2.5-2.5V12h-4" /></>}
      {name === "blog" && <><path d="M5 3.5h10l4 4V20H5zM15 3.5v4h4M8 11h8M8 14h8M8 17h5" /></>}
      {name === "email" && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>}
      {name === "coffee" && <><path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h1a2.5 2.5 0 1 1 0 5h-1M3 20h16M8 3v2M12 3v2" /></>}
    </svg>
  );
}

/** The same public contacts and support codes as the personal blog. */
export function SocialLinks() {
  const id = useId();
  return (
    <section aria-label="联系与支持" className="relative text-[12px] text-ink-3">
      <div className="grid grid-cols-3 gap-1">
        {contacts.map((contact, index) => (
          <div key={contact.name} className="group relative">
            <a href={contact.url} target="_blank" rel="noopener noreferrer" aria-label={contact.description} aria-describedby={`${id}-${contact.name}`} className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-control hover:bg-bg-sunk hover:text-accent focus-visible:text-accent">
              <SocialIcon name={contact.icon} />
              {contact.name}
            </a>
            <div id={`${id}-${contact.name}`} role="tooltip" className={`pointer-events-none invisible absolute bottom-full z-50 w-44 rounded-control border border-line bg-surface p-2 text-center opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${index === 0 ? "left-0" : index === 2 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
              <strong className="block pb-1 text-ink">{contact.description}</strong>
              <img src={contact.image} alt={`${contact.description}二维码`} width="160" height="160" className="aspect-square w-full rounded-mark bg-white object-contain" />
              <span className="mt-1 block text-[11px]">扫码查看，或点击链接打开</span>
            </div>
          </div>
        ))}
        {links.map((link) => (
          <a key={link.name} href={link.url} target={link.url.startsWith("mailto:") ? undefined : "_blank"} rel={link.url.startsWith("mailto:") ? undefined : "noopener noreferrer"} className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-control hover:bg-bg-sunk hover:text-accent focus-visible:text-accent"><SocialIcon name={link.icon} />{link.name}</a>
        ))}
        <details className="group/coffee relative" onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.open = false; }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
          <summary aria-label="Coffee，查看收款码" className="flex min-h-[52px] cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-control text-accent hover:bg-bg-sunk hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"><SocialIcon name="coffee" />Coffee</summary>
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
      </div>
    </section>
  );
}
