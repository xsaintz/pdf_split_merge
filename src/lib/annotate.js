/**
 * The pure half of the PDF editor: no DOM, no pdf-lib.
 *
 * Both the view (to warn about text it will change) and the worker (to draw)
 * import this, so it must stay free of anything heavy — pulling pdf-lib onto
 * the main thread for two helpers would cost 410 kB.
 */

/** Typographic characters a standard PDF font cannot encode, and their stand-ins. */
const textFallbacks = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201a': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2022': '-',
  '\u2026': '...',
  '\u00a0': ' ',
  '\t': '    ',
};

/**
 * Standard PDF fonts only speak WinAnsi, and pdf-lib throws on a character it
 * cannot encode — one pasted curly quote would fail the whole save. Common
 * typography is swapped for ASCII; anything still out of range becomes "?".
 * Works on a single line: a newline is out of range too.
 */
export function winAnsiText(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019\u201a\u201c\u201d\u2013\u2014\u2022\u2026\u00a0\t]/g, (char) => textFallbacks[char])
    .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '?');
}

/**
 * Maps a point in display space — the page as pdf.js shows it at scale 1,
 * origin top-left, the page's own /Rotate already applied — into the unrotated
 * user space pdf-lib draws in, origin bottom-left.
 *
 * `width`/`height` are the page's unrotated size in points.
 * ponytail: assumes the MediaBox starts at 0,0; offset boxes would need its origin added.
 */
export function toUserSpace({ width, height, rotation }, x, y) {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: y, y: x };
    case 180:
      return { x: width - x, y };
    case 270:
      return { x: width - y, y: height - x };
    default:
      return { x, y: height - y };
  }
}
