import {
  cls,
  downloadBytes,
  errorText,
  escapeHtml,
  formatBytes,
  html,
  keepImages,
  paintIcons,
  paintStatus,
  resultLink,
  setVisible,
  stripPdfExtension,
} from '../lib/ui.js';
import { closeDocument, editPages, openDocument } from '../lib/pdf.js';
import { closePreview, openPreview } from '../lib/preview.js';
import { baselineRatio, createEditor, lineHeight, textFonts } from '../lib/editor.js';
import { imageKind, reencodeAsJpeg } from '../lib/image.js';
import { winAnsiText } from '../lib/annotate.js';
import { createFileLoader } from '../lib/loader.js';
import { subNavMarkup } from '../lib/nav.js';
import { brandIcon } from '../lib/icons.js';

const tools = [
  { id: 'select', label: 'Pilih', icon: 'mouse-pointer-2' },
  { id: 'text', label: 'Teks', icon: 'type' },
  { id: 'draw', label: 'Coret', icon: 'pencil' },
  { id: 'highlight', label: 'Sorot', icon: 'highlighter' },
  { id: 'rect', label: 'Kotak', icon: 'square' },
  { id: 'ellipse', label: 'Oval', icon: 'circle' },
  { id: 'line', label: 'Garis', icon: 'minus' },
  { id: 'image', label: 'Gambar', icon: 'image' },
];

/** Which style controls each kind of item has. */
const controlsFor = {
  text: ['color', 'size', 'font', 'bold', 'opacity'],
  draw: ['color', 'thickness', 'opacity'],
  line: ['color', 'thickness', 'opacity'],
  rect: ['color', 'thickness', 'fill', 'opacity'],
  ellipse: ['color', 'thickness', 'fill', 'opacity'],
  highlight: ['color', 'opacity'],
  image: ['opacity'],
};

/** What a new item of each kind starts with; the toolbar edits these between items. */
const defaultStyles = () => ({
  text: { color: '#111111', size: 16, font: 'Helvetica', bold: false, opacity: 1 },
  draw: { color: '#e11d48', thickness: 3, opacity: 1 },
  highlight: { color: '#facc15', opacity: 0.45 },
  rect: { color: '#2563eb', thickness: 2, fill: false, opacity: 1 },
  ellipse: { color: '#2563eb', thickness: 2, fill: false, opacity: 1 },
  line: { color: '#111111', thickness: 2, opacity: 1 },
  image: { opacity: 1 },
});

const typeLabels = {
  text: 'teks',
  draw: 'coretan',
  highlight: 'sorotan',
  rect: 'kotak',
  ellipse: 'oval',
  line: 'garis',
  image: 'gambar',
};

export function renderEdit() {
  /**
   * `items` is everything added on top of the pages, in display points (see
   * editor.js). `images` holds the bytes behind each picture once, however many
   * times it is placed.
   */
  const state = {
    file: null,
    docId: null,
    preview: null,
    pages: [],
    items: [],
    images: [],
    styles: defaultStyles(),
    tool: 'select',
    selectedId: null,
    busy: false,
  };

  let editor = null;
  let past = [];
  const undoLimit = 50;

  function remember() {
    past.push(structuredClone(state.items));
    if (past.length > undoLimit) past.shift();
  }

  function undo() {
    if (!past.length || editor?.isEditing()) return;
    state.items = past.pop();
    state.selectedId = null;
    editor.paint();
    sync();
  }

  const root = html(`
    <div>
      ${subNavMarkup('edit-pdf')}

      <section class="mx-auto max-w-[1120px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Edit PDF</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Tambahkan teks, sorotan, bentuk, coretan, dan gambar langsung di atas halaman —
            untuk mengisi formulir, memberi catatan, atau menempel tanda tangan. Isi asli
            dokumen tidak diubah.
          </p>
        </header>

        <div data-loader></div>

        <div data-detail class="space-y-6" style="display: none">
          <div class="flex flex-wrap items-center gap-4 rounded-lg border border-hairline bg-white px-5 py-4">
            <span class="flex size-11 shrink-0 items-center justify-center rounded-sm bg-parchment text-action">
              <i data-lucide="file-text" class="size-5"></i>
            </span>
            <span class="min-w-0 flex-1">
              <span data-name class="block truncate text-body text-ink"></span>
              <span data-meta class="block text-fine text-ink-48"></span>
            </span>
            <button type="button" data-reset class="${cls.iconButton}" aria-label="Ganti file">
              <i data-lucide="trash-2" class="size-[18px]"></i>
            </button>
          </div>

          <div class="sticky top-[136px] z-30 space-y-3 rounded-lg border border-hairline bg-white/95 p-3 shadow-soft">
            <div role="toolbar" aria-label="Alat edit" class="flex flex-wrap items-center gap-1.5">
              ${tools
                .map(
                  (tool) => `
                    <button type="button" data-tool="${tool.id}" aria-pressed="false" class="${cls.chip} inline-flex items-center gap-1.5 px-3 aria-pressed:bg-action aria-pressed:text-white">
                      <i data-lucide="${tool.icon}" class="size-4"></i>
                      ${tool.label}
                    </button>
                  `,
                )
                .join('')}
              <span class="ml-auto flex items-center gap-0.5">
                <button type="button" data-undo class="${cls.iconButton}" aria-label="Batalkan" title="Batalkan (Ctrl + Z)" disabled>
                  <i data-lucide="undo-2" class="size-[18px]"></i>
                </button>
                <button type="button" data-delete class="${cls.iconButton}" aria-label="Hapus yang dipilih" title="Hapus (Delete)" disabled>
                  <i data-lucide="trash-2" class="size-[18px]"></i>
                </button>
              </span>
            </div>

            <div data-styles class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-divider px-1 pt-3 text-fine text-ink-80">
              <span data-style-label class="font-medium text-ink"></span>
              <label data-control="color" class="flex items-center gap-2">
                Warna
                <input type="color" data-style="color" class="size-7 cursor-pointer rounded-sm border border-hairline bg-white p-0.5" />
              </label>
              <label data-control="size" class="flex items-center gap-2">
                Ukuran
                <input type="number" data-style="size" min="6" max="144" class="w-16 rounded-sm border border-hairline bg-white px-2 py-1 text-ink" />
              </label>
              <label data-control="font" class="flex items-center gap-2">
                Huruf
                <select data-style="font" class="rounded-sm border border-hairline bg-white px-2 py-1 text-ink">
                  ${textFonts.map((font) => `<option value="${font.id}">${font.label}</option>`).join('')}
                </select>
              </label>
              <label data-control="bold" class="flex items-center gap-2">
                <input type="checkbox" data-style="bold" class="accent-action" />
                Tebal
              </label>
              <label data-control="thickness" class="flex items-center gap-2">
                Ketebalan
                <input type="range" data-style="thickness" min="1" max="20" step="0.5" class="w-24 accent-action" />
              </label>
              <label data-control="fill" class="flex items-center gap-2">
                <input type="checkbox" data-style="fill" class="accent-action" />
                Isi warna
              </label>
              <label data-control="opacity" class="flex items-center gap-2">
                Transparansi
                <input type="range" data-style="opacity" min="0.1" max="1" step="0.05" class="w-24 accent-action" />
              </label>
              <span data-style-hint class="text-ink-48">
                Pilih alat lalu klik atau seret di halaman. Klik dua kali pada teks untuk mengubahnya.
              </span>
            </div>
          </div>

          <div data-pages class="rounded-lg bg-pearl p-4 sm:p-6"></div>

          <div data-status></div>

          <div class="flex flex-wrap items-center gap-4">
            <button type="button" data-save class="${cls.pillPrimary}" disabled>
              ${brandIcon('edit', 'size-[18px]')}
              Simpan PDF
            </button>
            <p data-summary class="text-fine text-ink-48"></p>
          </div>

          <input type="file" data-image-input accept="image/*" class="hidden" />
        </div>
      </section>
    </div>
  `);

  const detailHost = root.querySelector('[data-detail]');
  const nameHost = root.querySelector('[data-name]');
  const metaHost = root.querySelector('[data-meta]');
  const pagesHost = root.querySelector('[data-pages]');
  const statusHost = root.querySelector('[data-status]');
  const summaryHost = root.querySelector('[data-summary]');
  const saveButton = root.querySelector('[data-save]');
  const undoButton = root.querySelector('[data-undo]');
  const deleteButton = root.querySelector('[data-delete]');
  const imageInput = root.querySelector('[data-image-input]');
  const styleLabel = root.querySelector('[data-style-label]');
  const styleHint = root.querySelector('[data-style-hint]');

  const setStatus = (status, message) => paintStatus(statusHost, status, message);
  const selected = () => state.items.find((item) => item.id === state.selectedId) ?? null;

  /* ---------------------------------------------------------------- toolbar */

  /** The style being edited: the selection's own, or the active tool's defaults. */
  function styleTarget() {
    const item = selected();
    if (item) return { type: item.type, style: item };
    if (state.tool === 'select') return null;
    return { type: state.tool, style: state.styles[state.tool] };
  }

  /** Brings the toolbar in line with the tool, the selection, and the undo stack. */
  function sync() {
    root.querySelectorAll('[data-tool]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.tool === state.tool));
    });

    const target = styleTarget();
    const shown = target ? controlsFor[target.type] : [];
    root.querySelectorAll('[data-control]').forEach((control) => {
      setVisible(control, shown.includes(control.dataset.control));
    });
    root.querySelectorAll('[data-style]').forEach((input) => {
      const value = target?.style[input.dataset.style];
      if (value === undefined) return;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = String(value);
    });
    styleLabel.textContent = target
      ? `${selected() ? 'Terpilih' : 'Baru'}: ${typeLabels[target.type]}`
      : '';
    setVisible(styleLabel, Boolean(target));
    setVisible(styleHint, !target);

    const count = state.items.length;
    summaryHost.textContent = count
      ? `${count} tambahan pada ${new Set(state.items.map((item) => item.page)).size} halaman`
      : 'Belum ada yang ditambahkan';
    saveButton.disabled = state.busy || count === 0;
    undoButton.disabled = past.length === 0;
    deleteButton.disabled = !selected();
  }

  function setTool(tool) {
    state.tool = tool;
    editor?.select(null);
    editor?.paint();
    sync();
  }

  root.querySelectorAll('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.tool === 'image') imageInput.click();
      else setTool(button.dataset.tool);
    });
  });

  // A slider fires dozens of input events per drag; they are one undo step.
  let styling = false;
  root.querySelectorAll('[data-style]').forEach((input) => {
    const key = input.dataset.style;
    input.addEventListener('input', () => {
      const target = styleTarget();
      if (!target) return;
      let value = input.type === 'checkbox' ? input.checked : input.value;
      if (input.type === 'number' || input.type === 'range') {
        value = Number(value);
        if (!Number.isFinite(value) || value <= 0) return;
      }

      if (selected()) {
        if (!styling) remember();
        styling = true;
      }
      target.style[key] = value;
      // The next item of the same kind starts from what was just chosen.
      state.styles[target.type][key] = value;
      editor?.restyle();
      sync();
    });
    input.addEventListener('change', () => {
      styling = false;
    });
  });

  undoButton.addEventListener('click', undo);
  deleteButton.addEventListener('click', () => editor?.removeSelected());

  root.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected()) {
      event.preventDefault();
      editor.removeSelected();
    } else if (event.key === 'Escape') {
      setTool('select');
    }
  });

  /* ----------------------------------------------------------------- images */

  imageInput.addEventListener('change', async () => {
    const [file] = keepImages(imageInput.files ?? []);
    imageInput.value = '';
    if (!file || !editor) return;

    try {
      // pdf-lib takes JPEG and PNG as they are; anything else is redrawn as JPEG.
      const original = imageKind(file);
      const bytes =
        original === 'other' ? await reencodeAsJpeg(file) : new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(file);

      const picture = new Image();
      picture.src = url;
      await picture.decode().catch(() => {
        URL.revokeObjectURL(url);
        throw new Error(`"${file.name}" tidak dapat ditampilkan oleh browser ini.`);
      });

      state.images.push({ bytes, kind: original === 'png' ? 'png' : 'jpeg', url });

      // Placed in the middle of whichever page is on screen, at most 40% of its
      // width — a phone photo at its native size would cover the whole page.
      const { page, x, y } = editor.centerOfView();
      const width = Math.min(state.pages[page].width * 0.4, picture.naturalWidth * 0.75);
      const height = (width * picture.naturalHeight) / picture.naturalWidth;

      remember();
      const item = {
        id: `image-${state.images.length}-${Date.now()}`,
        page,
        type: 'image',
        image: state.images.length - 1,
        x: x - width / 2,
        y: Math.max(y - height / 2, 0),
        w: width,
        h: height,
        ...state.styles.image,
      };
      state.items.push(item);
      state.tool = 'select';
      editor.paint();
      editor.select(item.id);
      setStatus(null, '');
    } catch (error) {
      setStatus('error', escapeHtml(errorText(error)));
    }
  });

  /* ------------------------------------------------------------ file intake */

  function clearDocument() {
    editor?.destroy();
    editor = null;
    if (state.preview) closePreview(state.preview);
    closeDocument(state.docId);
    state.images.forEach((image) => URL.revokeObjectURL(image.url));

    Object.assign(state, {
      file: null,
      docId: null,
      preview: null,
      pages: [],
      items: [],
      images: [],
      tool: 'select',
      selectedId: null,
    });
    past = [];
    pagesHost.innerHTML = '';
    setVisible(detailHost, false);
    setStatus(null, '');
  }

  const loader = createFileLoader({
    id: 'edit',
    onReset: clearDocument,
    onReady: async (file, bytes) => {
      const { docId, pageCount } = await openDocument(bytes, file.name);
      state.file = file;
      state.docId = docId;
      state.preview = await openPreview(file);

      // Display size of every page, its own rotation included — the space every
      // item's geometry is measured in.
      state.pages = [];
      for (let number = 1; number <= pageCount; number++) {
        const viewport = (await state.preview.getPage(number)).getViewport({ scale: 1 });
        state.pages.push({ width: viewport.width, height: viewport.height });
      }

      nameHost.textContent = file.name;
      metaHost.textContent = `${pageCount} halaman · ${formatBytes(file.size)}`;
      setVisible(detailHost, true);

      editor = createEditor({
        pdfDocument: state.preview,
        pages: state.pages,
        state,
        remember,
        onChange: sync,
      });
      pagesHost.replaceChildren(editor.element);
      sync();
    },
  });
  root.querySelector('[data-loader]').replaceWith(loader.element);
  root.querySelector('[data-reset]').addEventListener('click', () => loader.reset());

  /* ------------------------------------------------------------------- save */

  saveButton.addEventListener('click', async () => {
    state.busy = true;
    sync();
    setStatus('working', 'Menyimpan perubahan ke PDF…');

    let replaced = false;
    const items = state.items.map(({ id, ...item }) => {
      if (item.type !== 'text') return item;
      replaced ||= item.text.split('\n').some((line) => winAnsiText(line) !== line);
      // The worker places text by its baseline; the box is stored by its top.
      return { ...item, y: item.y + item.size * baselineRatio, lineHeight };
    });

    try {
      const bytes = await editPages(
        state.docId,
        items,
        state.images.map(({ bytes: imageBytes, kind }) => ({ bytes: imageBytes, kind })),
      );
      const filename = `${stripPdfExtension(state.file.name)}-diedit.pdf`;
      const url = downloadBytes(bytes, filename, 'application/pdf', { keep: true });
      setStatus(
        replaced ? 'warning' : 'success',
        `Selesai. Disimpan sebagai "${escapeHtml(filename)}".` +
          (replaced
            ? ' Beberapa karakter tidak didukung huruf standar PDF, jadi diganti: tanda kutip lengkung menjadi lurus, huruf non-Latin menjadi "?".'
            : '') +
          resultLink(url),
      );
    } catch (error) {
      setStatus('error', escapeHtml(errorText(error)));
    } finally {
      state.busy = false;
      sync();
    }
  });

  paintIcons(root);
  return root;
}
