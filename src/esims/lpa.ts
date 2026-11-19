/**
 * An eSIM's LPA string, `LPA:1$<SM-DP+ address>$<activation code>`, read out of
 * whatever a supplier sent (vande-2011 #004).
 *
 * MicroEsim answered one poll with the LPA and a later one with an empty
 * string, or with its portal's HTML block (`<br>ICCID: …<br>SM-DP+Address: …
 * <br>Activation Code: …<br>LPA:1$rsp.esim.pub$8C28…`). The empty answer
 * overwrote a good LPA, so order ORD-261118085937993-81ZIOX had no QR although
 * the supplier showed one. Null means "nothing usable": never store it over a
 * value that is there.
 */
export function normalizeLpa(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&');
  const m = text.match(/LPA:1\$([^$\s]+)\$([^\s$]+)/i);
  if (m) return `LPA:1$${m[1]}$${m[2]}`;
  // The portal's labelled form, without an LPA line.
  const smdp = text.match(/SM-?DP\+?\s*Address\s*:\s*([^\s]+)/i)?.[1];
  const code = text.match(/Activation\s*Code\s*:\s*([^\s]+)/i)?.[1];
  return smdp && code ? `LPA:1$${smdp}$${code}` : null;
}

/** The LPA to show and encode in the QR: the stored one, or built from its parts. */
export function lpaOf(esim: {
  lpa?: string | null;
  smdpAddress?: string | null;
  activationCode?: string | null;
}): string | null {
  const stored = normalizeLpa(esim.lpa);
  if (stored) return stored;
  const smdp = esim.smdpAddress?.trim();
  const code = esim.activationCode?.trim();
  return smdp && code ? `LPA:1$${smdp}$${code}` : null;
}

/** A supplier string that says something, or null for "", spaces or nothing. */
export function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
