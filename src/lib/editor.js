import { renderWhenVisible } from './preview.js';

/**
 * The editing surface: every page rasterised underneath, an annotation layer
 * on top.
 *
 * Each layer is sized in display points — the page as pdf.js shows it at
 * scale 1 — and scaled to the column with a CSS transform. So every item's
 * geometry is stored in points, nothing here deals in screen pixels beyond the
 * one division in `pointOf`, and the save path can map straight into PDF space
 * (see `toUserSpace`).
 *
 * The editor owns no data. It reads and mutates `state.items`, and reports
 * through `remember` (before a change, for undo) and `onChange` (after one).
 */

/** Fonts offered for text: the standard PDF font family and its closest CSS stack. */
export const textFonts = [
  { id: 'Helvetica', label: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { id: 'TimesRoman', label: 'Times', css: '"Times New Roman", Times, serif' },
  { id: 'Courier', label: 'Courier', css: '"Courier New", Courier, monospace' },
];

/** Text boxes are laid out at this line height, in the browser and the PDF alike. */
export const lineHeight = 1.2;

/**
 * Where the first baseline sits inside a text box, as a fraction of the font
 * size: half the leading plus the ascent of the base-14 fonts (~0.72).
 */
export const baselineRatio = 0.86;

const svgNamespace = 'http://www.w3.org/2000/svg';
const resizable = new Set(['rect', 'ellipse', 'highlight', 'image']);
const px = (value) => `${value}px`;

let nextId = 0;
const newId = () => `item-${++nextId}`;

/** A freehand stroke as an SVG path. A lone point gets a hair of length so its round cap shows. */
function pathOf(points) {
  const [[x, y], ...rest] = points;
  if (!rest.length) return `M${x} ${y}l0.01 0`;
  return `M${x} ${y}${rest.map(([nextX, nextY]) => `L${nextX} ${nextY}`).join('')}`;
}

export function createEditor({ pdfDocument, pages, state, remember, onChange }) {
  const element = document.createElement('div');
  element.className = 'space-y-6';

  const frames = [];
  const layers = [];
  const scales = [];
  const stops = [];
  let editingId = null;
  let destroyed = false;

  const selected = () => state.items.find((item) => item.id === state.selectedId) ?? null;
  const nodeOf = (item) => layers[item.page].querySelector(`[data-item="${item.id}"]`);

  /* ------------------------------------------------------------ page shells */

  pages.forEach((size, index) => {
    const figure = document.createElement('figure');
    figure.className = 'space-y-2';
    figure.innerHTML = `
      <div data-frame class="relative mx-auto w-full max-w-[820px] overflow-hidden rounded-sm bg-white shadow-soft" style="aspect-ratio: ${size.width} / ${size.height}">
        <canvas class="block h-full w-full"></canvas>
        <div data-layer class="absolute left-0 top-0 origin-top-left select-none" style="width: ${px(size.width)}; height: ${px(size.height)}"></div>
      </div>
      <figcaption class="text-center text-fine text-ink-48">Halaman ${index + 1} dari ${pages.length}</figcaption>
    `;
    const frame = figure.querySelector('[data-frame]');
    const layer = figure.querySelector('[data-layer]');
    frames.push(frame);
    layers.push(layer);
    scales.push(1);
    element.appendChild(figure);

    layer.addEventListener('pointerdown', (event) => onPointerDown(event, index));
    layer.addEventListener('dblclick', (event) => {
      const hit = event.target.closest('[data-item]');
      const item = state.items.find((entry) => entry.id === hit?.dataset.item);
      if (item?.type === 'text') startEditing(item);
    });

    stops.push(
      renderWhenVisible(figure, async () => {
        if (destroyed) return;
        const page = await pdfDocument.getPage(index + 1);
        // Rendered once, at the width the column had when the page came into view.
        // ponytail: a much wider window later shows it a little soft; re-render on resize if that matters.
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (frame.clientWidth * ratio) / size.width });
        const canvas = frame.querySelector('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
      }),
    );
  });

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const index = frames.indexOf(entry.target);
      scales[index] = entry.contentRect.width / pages[index].width;
      layers[index].style.transform = `scale(${scales[index]})`;
      // Handles are sized against the scale, so a selection here redraws.
      if (selected()?.page === index && !editingId) paintLayer(index);
    }
  });
  frames.forEach((frame) => resizeObserver.observe(frame));

  /* --------------------------------------------------------------- drawing */

  function styleText(node, item) {
    const font = textFonts.find((entry) => entry.id === item.font) ?? textFonts[0];
    Object.assign(node.style, {
      left: px(item.x),
      top: px(item.y),
      fontFamily: font.css,
      fontSize: px(item.size),
      fontWeight: item.bold ? '700' : '400',
      lineHeight: String(lineHeight),
      color: item.color,
      opacity: String(item.opacity),
    });
  }

  function itemNode(item) {
    if (item.type === 'line' || item.type === 'draw') {
      const { width, height } = pages[item.page];
      const svg = document.createElementNS(svgNamespace, 'svg');
      svg.dataset.item = item.id;
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      svg.setAttribute('class', 'pointer-events-none absolute left-0 top-0 overflow-visible');
      const d =
        item.type === 'line' ? `M${item.x1} ${item.y1}L${item.x2} ${item.y2}` : pathOf(item.points);
      const glow = item.id === state.selectedId ? 'rgba(75,142,241,0.3)' : 'transparent';
      // A wide, invisible twin of the stroke is what the pointer grabs — a thin
      // two-point line would otherwise be nearly impossible to pick up.
      svg.innerHTML = `
        <path d="${d}" fill="none" stroke="${glow}" stroke-width="${item.thickness + 10}" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: stroke; touch-action: none; cursor: move"></path>
        <path d="${d}" fill="none" stroke="${item.color}" stroke-opacity="${item.opacity}" stroke-width="${item.thickness}" stroke-linecap="round" stroke-linejoin="round"></path>
      `;
      return svg;
    }

    const node = document.createElement(item.type === 'image' ? 'img' : 'div');
    node.dataset.item = item.id;
    node.className = 'absolute cursor-move';
    node.style.touchAction = 'none';

    if (item.type === 'text') {
      node.className += ' whitespace-pre outline-none';
      node.style.minWidth = '1ch';
      node.textContent = item.text;
      styleText(node, item);
      return node;
    }

    Object.assign(node.style, {
      left: px(item.x),
      top: px(item.y),
      width: px(item.w),
      height: px(item.h),
      opacity: String(item.opacity),
    });

    if (item.type === 'image') {
      node.src = state.images[item.image].url;
      node.alt = '';
      node.draggable = false;
      return node;
    }

    // The PDF strokes a border centred on the edge, so the CSS box grows by
    // half the stroke each way to match it.
    const half = item.thickness / 2;
    Object.assign(node.style, {
      left: px(item.x - half),
      top: px(item.y - half),
      width: px(item.w + item.thickness),
      height: px(item.h + item.thickness),
      boxSizing: 'border-box',
      background: item.fill ? item.color : 'transparent',
      border: item.thickness > 0 ? `${item.thickness}px solid ${item.color}` : 'none',
      borderRadius: item.type === 'ellipse' ? '50%' : '0',
      mixBlendMode: item.type === 'highlight' ? 'multiply' : 'normal',
    });
    return node;
  }

  function boundsOf(item) {
    if (item.type === 'line') {
      return {
        x: Math.min(item.x1, item.x2),
        y: Math.min(item.y1, item.y2),
        w: Math.abs(item.x2 - item.x1),
        h: Math.abs(item.y2 - item.y1),
      };
    }
    if (item.type === 'draw') {
      const xs = item.points.map(([x]) => x);
      const ys = item.points.map(([, y]) => y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    if (item.type === 'text') {
      // offsetWidth ignores the layer's transform, so it is already in points.
      const node = nodeOf(item);
      return { x: item.x, y: item.y, w: node?.offsetWidth ?? 0, h: node?.offsetHeight ?? 0 };
    }
    return { x: item.x, y: item.y, w: item.w, h: item.h };
  }

  /** The dashed frame around the selection, plus whatever handles its type offers. */
  function selectionNodes(item) {
    const scale = scales[item.page] || 1;
    const bounds = boundsOf(item);
    const pad = 4 / scale;
    const frame = document.createElement('div');
    frame.dataset.selection = '';
    frame.className = 'pointer-events-none absolute';
    Object.assign(frame.style, {
      left: px(bounds.x - pad),
      top: px(bounds.y - pad),
      width: px(bounds.w + pad * 2),
      height: px(bounds.h + pad * 2),
      outline: `${1.5 / scale}px dashed var(--color-action)`,
    });

    // Handles stay a fingertip wide on screen whatever the page's scale.
    const handle = (name, x, y, cursor) => {
      const size = 18 / scale;
      const node = document.createElement('span');
      node.dataset.handle = name;
      node.dataset.selection = '';
      node.className = 'absolute rounded-full border-2 border-white bg-action shadow-soft';
      Object.assign(node.style, {
        left: px(x - size / 2),
        top: px(y - size / 2),
        width: px(size),
        height: px(size),
        cursor,
        touchAction: 'none',
      });
      return node;
    };

    const nodes = [frame];
    if (resizable.has(item.type)) {
      nodes.push(handle('corner', item.x + item.w, item.y + item.h, 'nwse-resize'));
    } else if (item.type === 'line') {
      nodes.push(handle('start', item.x1, item.y1, 'move'), handle('end', item.x2, item.y2, 'move'));
    }
    return nodes;
  }

  function paintLayer(index) {
    const layer = layers[index];
    layer.replaceChildren(...state.items.filter((item) => item.page === index).map(itemNode));
    const item = selected();
    if (item?.page === index) layer.append(...selectionNodes(item));
  }

  function paint() {
    layers.forEach((layer, index) => {
      paintLayer(index);
      // Touch scrolling still works with the pointer tool; drawing tools claim the gesture.
      layer.style.touchAction = state.tool === 'select' ? 'auto' : 'none';
      layer.style.cursor = state.tool === 'select' ? 'default' : 'crosshair';
    });
  }

  /* ------------------------------------------------------------ interaction */

  function pointOf(event, index) {
    const rect = layers[index].getBoundingClientRect();
    const scale = scales[index] || 1;
    const clamp = (value, max) => Math.min(Math.max(value, 0), max);
    return {
      x: clamp((event.clientX - rect.left) / scale, pages[index].width),
      y: clamp((event.clientY - rect.top) / scale, pages[index].height),
    };
  }

  /** Follows one pointer until it lifts. `onMove(point, event)` sees every step. */
  function track(event, index, onMove, onEnd) {
    const layer = layers[index];
    const id = event.pointerId;
    layer.setPointerCapture(id);

    const move = (next) => {
      if (next.pointerId === id) onMove(pointOf(next, index), next);
    };
    const end = (next) => {
      if (next.pointerId !== id) return;
      layer.removeEventListener('pointermove', move);
      layer.removeEventListener('pointerup', end);
      layer.removeEventListener('pointercancel', end);
      onEnd?.();
    };
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', end);
  }

  function select(id) {
    const before = selected()?.page;
    state.selectedId = id;
    if (before !== undefined) paintLayer(before);
    const after = selected()?.page;
    if (after !== undefined && after !== before) paintLayer(after);
    onChange();
  }

  function onPointerDown(event, index) {
    if (event.button !== 0) return;

    const hit = event.target.closest('[data-item]');
    // Clicks inside the text being typed place the caret, nothing more.
    if (editingId && hit?.dataset.item === editingId) return;
    // preventDefault below also stops the browser moving focus, so the text
    // box being typed in has to be let go of by hand.
    if (editingId) document.activeElement?.blur();

    event.preventDefault();
    const point = pointOf(event, index);
    const handle = event.target.closest('[data-handle]');

    if (handle) {
      resize(event, index, handle.dataset.handle);
    } else if (state.tool === 'select') {
      if (!hit) {
        select(null);
        return;
      }
      select(hit.dataset.item);
      move(event, index, point);
    } else if (state.tool === 'text') {
      createText(index, point);
    } else if (state.tool !== 'image') {
      createShape(event, index, point);
    }
  }

  function move(event, index, start) {
    const item = selected();
    const from = structuredClone(item);
    let moved = false;

    track(event, index, (point) => {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      if (!moved) {
        if (Math.hypot(dx, dy) < 1) return;
        remember();
        moved = true;
      }
      if (item.type === 'line') {
        Object.assign(item, { x1: from.x1 + dx, y1: from.y1 + dy, x2: from.x2 + dx, y2: from.y2 + dy });
      } else if (item.type === 'draw') {
        item.points = from.points.map(([x, y]) => [x + dx, y + dy]);
      } else {
        Object.assign(item, { x: from.x + dx, y: from.y + dy });
      }
      paintLayer(index);
    });
  }

  function resize(event, index, which) {
    const item = selected();
    const ratio = item.h / item.w;
    let remembered = false;

    track(
      event,
      index,
      (point, next) => {
        if (!remembered) {
          remember();
          remembered = true;
        }
        if (which === 'start') Object.assign(item, { x1: point.x, y1: point.y });
        else if (which === 'end') Object.assign(item, { x2: point.x, y2: point.y });
        else {
          item.w = Math.max(point.x - item.x, 8);
          item.h = Math.max(point.y - item.y, 8);
          // Pictures keep their proportions unless Shift says otherwise.
          if (item.type === 'image' && !next.shiftKey) item.h = item.w * ratio;
        }
        paintLayer(index);
      },
      onChange,
    );
  }

  function createShape(event, index, start) {
    remember();
    const type = state.tool;
    const item = { id: newId(), page: index, type, ...state.styles[type] };

    if (type === 'draw') item.points = [[start.x, start.y]];
    else if (type === 'line') Object.assign(item, { x1: start.x, y1: start.y, x2: start.x, y2: start.y });
    else Object.assign(item, { x: start.x, y: start.y, w: 0, h: 0 });
    if (type === 'highlight') Object.assign(item, { fill: true, thickness: 0 });

    state.items.push(item);
    paintLayer(index);

    track(
      event,
      index,
      (point) => {
        if (type === 'draw') {
          const [lastX, lastY] = item.points.at(-1);
          if (Math.hypot(point.x - lastX, point.y - lastY) < 1.5) return;
          item.points.push([point.x, point.y]);
        } else if (type === 'line') {
          Object.assign(item, { x2: point.x, y2: point.y });
        } else {
          Object.assign(item, {
            x: Math.min(start.x, point.x),
            y: Math.min(start.y, point.y),
            w: Math.abs(point.x - start.x),
            h: Math.abs(point.y - start.y),
          });
        }
        paintLayer(index);
      },
      () => {
        // A click rather than a drag still leaves something visible to adjust.
        if (type === 'line' && Math.hypot(item.x2 - item.x1, item.y2 - item.y1) < 4) {
          item.x2 = Math.min(item.x1 + 120, pages[index].width);
        } else if (resizable.has(type) && item.w < 4 && item.h < 4) {
          Object.assign(item, type === 'highlight' ? { w: 160, h: 18 } : { w: 120, h: 70 });
        }
        // Freehand stays unselected so the next stroke can start straight away.
        if (type === 'draw') {
          paintLayer(index);
          onChange();
        } else {
          select(item.id);
        }
      },
    );
  }

  /* ------------------------------------------------------------------- text */

  function createText(index, point) {
    const style = state.styles.text;
    const item = {
      id: newId(),
      page: index,
      type: 'text',
      ...style,
      text: '',
      x: point.x,
      // The click lands mid-way down the first line, which is where people aim.
      y: Math.max(point.y - (style.size * lineHeight) / 2, 0),
    };
    remember();
    state.items.push(item);
    state.tool = 'select';
    state.selectedId = item.id;
    paint();
    startEditing(item, { remembered: true });
    onChange();
  }

  function startEditing(item, { remembered = false } = {}) {
    const node = nodeOf(item);
    if (!node) return;
    if (!remembered) remember();
    editingId = item.id;

    node.contentEditable = 'plaintext-only';
    // Older Firefox only knows "true"; the text is read back as plain text either way.
    if (node.contentEditable !== 'plaintext-only') node.contentEditable = 'true';
    node.classList.replace('cursor-move', 'cursor-text');
    node.focus();
    getSelection()?.selectAllChildren(node);
    getSelection()?.collapseToEnd();

    node.addEventListener('input', () => {
      item.text = node.innerText.replace(/\n$/, '');
      // Only the selection frame moves; rebuilding the node would drop the caret.
      const layer = layers[item.page];
      layer.querySelectorAll('[data-selection]').forEach((other) => other.remove());
      layer.append(...selectionNodes(item));
    });
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') node.blur();
    });
    node.addEventListener('blur', stopEditing, { once: true });
  }

  function stopEditing() {
    const item = state.items.find((entry) => entry.id === editingId);
    editingId = null;
    if (!item) return;
    // A box left empty was never really added.
    if (!item.text.trim()) {
      state.items = state.items.filter((entry) => entry !== item);
      if (state.selectedId === item.id) state.selectedId = null;
    }
    paintLayer(item.page);
    onChange();
  }

  /* ------------------------------------------------------------------ public */

  /** Re-applies the selection's style; a text box being typed in is restyled in place. */
  function restyle() {
    const item = selected();
    if (!item) return;
    if (editingId === item.id) styleText(nodeOf(item), item);
    else paintLayer(item.page);
  }

  function removeSelected() {
    const item = selected();
    if (!item) return;
    remember();
    state.items = state.items.filter((entry) => entry !== item);
    state.selectedId = null;
    paintLayer(item.page);
    onChange();
  }

  /** The page nearest the middle of the screen, and the point at that middle. */
  function centerOfView() {
    const middle = window.innerHeight / 2;
    let best = 0;
    let bestDistance = Infinity;
    frames.forEach((frame, index) => {
      const rect = frame.getBoundingClientRect();
      const distance = Math.max(rect.top - middle, middle - rect.bottom, 0);
      if (distance < bestDistance) [best, bestDistance] = [index, distance];
    });
    const rect = frames[best].getBoundingClientRect();
    const y = (middle - rect.top) / (scales[best] || 1);
    return { page: best, x: pages[best].width / 2, y: Math.min(Math.max(y, 0), pages[best].height) };
  }

  function destroy() {
    destroyed = true;
    stops.forEach((stop) => stop());
    resizeObserver.disconnect();
  }

  paint();
  return {
    element,
    paint,
    select,
    restyle,
    removeSelected,
    centerOfView,
    isEditing: () => editingId !== null,
    destroy,
  };
}
