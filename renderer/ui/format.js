/* Turning values into text for the interface.
 *
 * esc() is the one that matters: every template literal that interpolates a mod name, an
 * author or a file path runs through it, because catalog data is third-party content and
 * lands in innerHTML. Forgetting it is an injection, not a typo. */

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtMB(bytes) { return (bytes / 1024 / 1024).toFixed(1); }

export function fmtDate(unix) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleDateString(window.i18nLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function plural(n, one, few, many) {
  if (window.I18N_LANG === 'en') {
    const pair = window.EN_PLURAL[many];
    return pair ? (n === 1 ? pair[0] : pair[1]) : many;
  }
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
