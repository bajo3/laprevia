/**
 * The shop's own details, in one place.
 *
 * The WhatsApp number used to be written out in four components and the
 * address in one more, so a change meant hunting for them. It also matters for
 * the day the catalog moves to its own domain: `SITE_URL` is the value that
 * has to agree with the `canonical` and `og:url` tags in index.html.
 */

/** International format, no plus sign and no separators — what wa.me expects. */
export const WHATSAPP_NUMBER = "5492494009317";

/** Opens the shop's WhatsApp catalog. */
export const WHATSAPP_CATALOG_URL = `https://wa.me/c/${WHATSAPP_NUMBER}`;

/** Opens a plain chat, with no message prefilled. */
export const WHATSAPP_CHAT_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

/** Prefills the chat with an order. */
export function whatsappOrderUrl(message: string) {
  return `${WHATSAPP_CHAT_URL}?text=${encodeURIComponent(message)}`;
}

export const INSTAGRAM_HANDLE = "distribuidoralaprevia_";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export const ADDRESS = "Darragueira 1774, Tandil";
export const MAPS_URL =
  "https://maps.google.com/?q=Darragueira+1774,+Tandil,+Provincia+de+Buenos+Aires";

export const OPENING_HOURS = "Lunes a sábados de 9 a 13 y de 15 a 19 hs";

export const PHONE_DISPLAY = "+54 9 2494 00-9317";

/**
 * Where the catalog lives, without a trailing slash.
 *
 * www.distribuidoralaprevia.com.ar — not the bare apex. Vercel has a
 * certificate for the www subdomain; the apex (distribuidoralaprevia.com.ar
 * with no www) is not registered as a domain on the Vercel project at all, so
 * it has no certificate and fails the TLS handshake. Getting the apex working
 * needs two things outside this codebase: an A/ALIAS record for the bare
 * domain at whoever holds its DNS (this is a .com.ar domain, registered
 * through nic.ar — not the Hostinger account this project can otherwise
 * reach), and adding the apex as a domain in the Vercel project so it issues
 * a certificate for it. Once that is done, swap this back to the apex and
 * add "https://distribuidoralaprevia.com.ar" to the redirect sources in
 * vercel.json so both spellings land on the one canonical address.
 *
 * Keep this in step with the `canonical`, `og:url` and `og:image` tags in
 * index.html and with public/sitemap.xml and public/robots.txt — those are
 * static files and cannot read this constant.
 */
export const SITE_URL = "https://www.distribuidoralaprevia.com.ar";
