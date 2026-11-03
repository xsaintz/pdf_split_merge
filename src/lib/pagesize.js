/**
 * Paper sizes and the arithmetic of putting a page onto a new sheet.
 *
 * Pure — no DOM, no pdf-lib — so the view can label sizes and the worker can
 * lay pages out from the same numbers, and the self-check can run in Node.
 */

/** ISO and US paper sizes in PDF points, short side first. */
export const paperSizes = {
  a3: { label: 'A3', size: [841.89, 1190.55] },
  a4: { label: 'A4', size: [595.28, 841.89] },
  a5: { label: 'A5', size: [419.53, 595.28] },
  letter: { label: 'Letter', size: [612, 792] },
  legal: { label: 'Legal', size: [612, 1008] },
};

export const mmToPoints = (mm) => (mm * 72) / 25.4;
export const pointsToMm = (points) => (points * 25.4) / 72;

/**
 * "A4 potret (210 × 297 mm)" for a page as it is shown. A size within 2 mm of a
 * known paper gets its name; anything else is described by its measurements.
 */
export function describeSize(width, height) {
  const [shortSide, longSide] = [width, height].sort((a, b) => a - b);
  const paper = Object.values(paperSizes).find(
    ({ size }) => Math.abs(pointsToMm(size[0] - shortSide)) < 2 && Math.abs(pointsToMm(size[1] - longSide)) < 2,
  );
  const shape = Math.abs(width - height) < 1 ? 'persegi' : width > height ? 'lanskap' : 'potret';
  const measured = `${Math.round(pointsToMm(width))} × ${Math.round(pointsToMm(height))} mm`;
  return paper ? `${paper.label} ${shape} (${measured})` : `${shape}, ${measured}`;
}

/**
 * Where a page lands on its new sheet.
 *
 * `page` is the visible box in its own unrotated space, plus its /Rotate.
 * `target` is the sheet size in points, in either order; `orientation` is
 * 'auto' (follow the page as it is shown), 'portrait' or 'landscape'; `margin`
 * is in points on every side.
 *
 * The new sheet keeps the page's /Rotate, so the answer is in unrotated space
 * too: the sheet's width and height, and the scale and offset to draw the old
 * page at — shrunk or grown to fit inside the margins, centred, never cropped.
 */
export function fitPage(page, target, orientation = 'auto', margin = 0) {
  const turned = (((page.rotation % 360) + 360) % 180) === 90;
  const [shownWidth, shownHeight] = turned ? [page.height, page.width] : [page.width, page.height];

  const [shortSide, longSide] = [...target].sort((a, b) => a - b);
  const landscape =
    orientation === 'landscape' || (orientation === 'auto' && shownWidth > shownHeight);
  const [sheetWidth, sheetHeight] = landscape ? [longSide, shortSide] : [shortSide, longSide];
  const [width, height] = turned ? [sheetHeight, sheetWidth] : [sheetWidth, sheetHeight];

  const scale = Math.max(
    Math.min((width - margin * 2) / page.width, (height - margin * 2) / page.height),
    0.01,
  );

  return {
    width,
    height,
    scale,
    x: (width - page.width * scale) / 2,
    y: (height - page.height * scale) / 2,
  };
}
