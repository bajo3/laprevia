import {
  ADDRESS,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  MAPS_URL,
  OPENING_HOURS,
  PHONE_DISPLAY,
  WHATSAPP_CATALOG_URL,
} from "../data/site-config";

const items = [
  {
    icon: "📍",
    label: "Dirección",
    value: ADDRESS,
    href: MAPS_URL,
  },
  {
    icon: "🕒",
    label: "Horario",
    value: OPENING_HOURS,
  },
  {
    icon: "📱",
    label: "WhatsApp",
    value: PHONE_DISPLAY,
    href: WHATSAPP_CATALOG_URL,
  },
  {
    icon: "📷",
    label: "Instagram",
    value: `@${INSTAGRAM_HANDLE}`,
    href: INSTAGRAM_URL,
  },
];

export default function InfoTicket() {
  return (
    <section id="contacto" className="relative mx-auto max-w-4xl px-5 pb-24">
      <div className="relative rounded-[2.5rem] border-[3px] border-ink bg-violet px-8 py-10 text-white shadow-[6px_6px_0_var(--color-ink)] sm:px-14 sm:py-12">
        <div className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-cream border-[3px] border-ink" />
        <div className="absolute -right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-cream border-[3px] border-ink" />

        <h2 className="font-display text-center text-3xl sm:text-4xl">Vení a buscar tu pedido</h2>
        <p className="mt-2 text-center text-white/80">o pedilo por WhatsApp y lo coordinamos</p>

        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-widest text-white/60">{item.label}</dt>
                {/* Every term needs its <dd>; the link goes inside it rather
                    than replacing it, which left the <dt> unpaired. */}
                <dd className="font-display text-lg">
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-yellow decoration-2 underline-offset-4 transition hover:text-yellow"
                    >
                      {item.value}
                    </a>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
