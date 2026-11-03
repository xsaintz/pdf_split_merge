import {
  cls,
  downloadBytes,
  errorText,
  escapeHtml,
  formatBytes,
  html,
  paintIcons,
  paintStatus,
  resultLink,
  setVisible,
  stripPdfExtension,
} from '../lib/ui.js';
import { closeDocument, openDocument, resizePages } from '../lib/pdf.js';
import { describeSize, mmToPoints, paperSizes } from '../lib/pagesize.js';
import { createFileLoader } from '../lib/loader.js';
import { createInsertControl } from '../lib/insert.js';
import { subNavMarkup } from '../lib/nav.js';
import { brandIcon } from '../lib/icons.js';

const orientations = [
  { value: 'auto', label: 'Ikuti halaman asli' },
  { value: 'portrait', label: 'Potret' },
  { value: 'landscape', label: 'Lanskap' },
];

/** Custom sheets stay within what a printer or viewer can sensibly handle. */
const customLimits = { min: 25, max: 2000 };

export function renderResize() {
  const state = { file: null, docId: null, pageCount: 0, busy: false };

  const inputClass =
    'rounded-sm border border-hairline bg-white px-3 py-2 text-caption text-ink';

  const root = html(`
    <div>
      ${subNavMarkup('ubah-ukuran-pdf')}

      <section class="mx-auto max-w-[820px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Ubah ukuran halaman PDF</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Pindahkan setiap halaman ke ukuran kertas lain — A4, A5, Letter, atau ukuran
            Anda sendiri. Isi halaman diperbesar atau diperkecil agar pas, tanpa terpotong.
          </p>
        </header>

        <div data-loader></div>

        <div data-detail class="space-y-8" style="display: none">
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

          <div data-insert></div>

          <div class="space-y-6 rounded-lg border border-hairline bg-white p-5">
            <label class="block space-y-2">
              <span class="block text-tagline text-ink">Ukuran kertas</span>
              <select data-paper class="${inputClass} w-full max-w-xs">
                ${Object.entries(paperSizes)
                  .map(
                    ([key, paper]) =>
                      `<option value="${key}"${key === 'a4' ? ' selected' : ''}>${escapeHtml(describeSize(...paper.size))}</option>`,
                  )
                  .join('')}
                <option value="custom">Ukuran sendiri…</option>
              </select>
            </label>

            <div data-custom class="flex flex-wrap items-end gap-4" style="display: none">
              <label class="space-y-1">
                <span class="block text-fine text-ink-48">Lebar (mm)</span>
                <input data-custom-width type="number" min="${customLimits.min}" max="${customLimits.max}" value="210" class="${inputClass} w-28" />
              </label>
              <label class="space-y-1">
                <span class="block text-fine text-ink-48">Tinggi (mm)</span>
                <input data-custom-height type="number" min="${customLimits.min}" max="${customLimits.max}" value="297" class="${inputClass} w-28" />
              </label>
            </div>

            <fieldset class="space-y-2">
              <legend class="mb-2 text-tagline text-ink">Orientasi</legend>
              <div class="flex flex-wrap gap-2">
                ${orientations
                  .map(
                    (option) => `
                      <label class="${cls.radioCard} items-center px-4 py-2.5">
                        <input type="radio" name="orientation" value="${option.value}"${option.value === 'auto' ? ' checked' : ''} class="accent-action" />
                        <span class="text-caption text-ink">${option.label}</span>
                      </label>
                    `,
                  )
                  .join('')}
              </div>
              <p class="text-fine text-ink-48">
                "Ikuti halaman asli" memberi halaman lanskap kertas lanskap dan halaman
                potret kertas potret.
              </p>
            </fieldset>

            <label class="block space-y-2">
              <span class="block text-tagline text-ink">Margin (mm)</span>
              <input data-margin type="number" min="0" max="100" value="0" class="${inputClass} w-28" />
              <span class="block text-fine text-ink-48">Jarak kosong di setiap sisi. 0 berarti isi halaman memenuhi kertas.</span>
            </label>
          </div>

          <p class="text-fine text-ink-48">
            Isi halaman ditaruh di tengah kertas baru tanpa diubah bentuknya; bila
            perbandingan sisinya berbeda, sisa ruangnya dibiarkan kosong. Tautan dan isian
            formulir di dalam PDF tidak ikut terbawa.
          </p>

          <div data-status></div>

          <button type="button" data-resize class="${cls.pillPrimary}">
            ${brandIcon('resize', 'size-[18px]')}
            Ubah ukuran PDF
          </button>
        </div>
      </section>
    </div>
  `);

  const detailHost = root.querySelector('[data-detail]');
  const nameHost = root.querySelector('[data-name]');
  const metaHost = root.querySelector('[data-meta]');
  const statusHost = root.querySelector('[data-status]');
  const paperSelect = root.querySelector('[data-paper]');
  const customHost = root.querySelector('[data-custom]');
  const widthInput = root.querySelector('[data-custom-width]');
  const heightInput = root.querySelector('[data-custom-height]');
  const marginInput = root.querySelector('[data-margin]');
  const resizeButton = root.querySelector('[data-resize]');

  const setStatus = (status, message) => paintStatus(statusHost, status, message);

  const describe = (size, firstPage) =>
    `${state.pageCount} halaman · ${formatBytes(size)} · ${describeSize(firstPage.width, firstPage.height)}`;

  const insertControl = createInsertControl({
    getDocId: () => state.docId,
    getPageCount: () => state.pageCount,
    onInserted: (result) => {
      state.pageCount = result.pageCount;
      state.file = new File([result.bytes], state.file.name, { type: 'application/pdf' });
      metaHost.textContent = describe(state.file.size, result.firstPage);
      setStatus(null, '');
    },
  });
  root.querySelector('[data-insert]').replaceWith(insertControl.element);

  paperSelect.addEventListener('change', () =>
    setVisible(customHost, paperSelect.value === 'custom'),
  );

  /** The chosen sheet in points, the label for messages, and the margin — or a reason it is invalid. */
  function readOptions() {
    let target;
    let label;
    if (paperSelect.value === 'custom') {
      const width = Number(widthInput.value);
      const height = Number(heightInput.value);
      const valid = (value) => value >= customLimits.min && value <= customLimits.max;
      if (!valid(width) || !valid(height)) {
        throw new Error(
          `Lebar dan tinggi kertas harus antara ${customLimits.min} dan ${customLimits.max} mm.`,
        );
      }
      target = [mmToPoints(width), mmToPoints(height)];
      label = `${width} × ${height} mm`;
    } else {
      const paper = paperSizes[paperSelect.value];
      target = paper.size;
      label = paper.label;
    }

    const margin = Number(marginInput.value || 0);
    // A third of the short side is already a lot of white space; past half,
    // nothing would be left to draw the page into.
    if (!(margin >= 0) || mmToPoints(margin) * 3 > Math.min(...target)) {
      throw new Error('Margin terlalu besar untuk kertas ini. Gunakan margin yang lebih kecil.');
    }

    const orientation = root.querySelector('input[name="orientation"]:checked').value;
    return { target, label, margin: mmToPoints(margin), orientation };
  }

  function clearDocument() {
    closeDocument(state.docId);
    state.file = null;
    state.docId = null;
    state.pageCount = 0;
    setVisible(detailHost, false);
    setStatus(null, '');
  }

  const loader = createFileLoader({
    id: 'resize',
    onReset: clearDocument,
    onReady: async (file, bytes) => {
      const { docId, pageCount, firstPage } = await openDocument(bytes, file.name);
      state.file = file;
      state.docId = docId;
      state.pageCount = pageCount;

      nameHost.textContent = file.name;
      metaHost.textContent = describe(file.size, firstPage);
      insertControl.refresh();
      setVisible(detailHost, true);
      paintIcons(detailHost);
    },
  });
  root.querySelector('[data-loader]').replaceWith(loader.element);

  root.querySelector('[data-reset]').addEventListener('click', () => loader.reset());

  resizeButton.addEventListener('click', async () => {
    let options;
    try {
      options = readOptions();
    } catch (error) {
      setStatus('error', escapeHtml(errorText(error)));
      return;
    }

    state.busy = true;
    resizeButton.disabled = true;
    setStatus('working', `Memindahkan ${state.pageCount} halaman ke kertas ${escapeHtml(options.label)}…`);

    try {
      const { label, ...request } = options;
      const bytes = await resizePages(state.docId, request);
      // "A4" -> "a4", "100 × 50 mm" -> "100x50mm".
      const suffix = label.toLowerCase().replace(' × ', 'x').replace(/[^a-z0-9]+/g, '');
      const filename = `${stripPdfExtension(state.file.name)}-${suffix}.pdf`;
      const url = downloadBytes(bytes, filename, 'application/pdf', { keep: true });
      setStatus(
        'success',
        `Selesai. ${state.pageCount} halaman kini berukuran ${escapeHtml(label)}, disimpan sebagai "${escapeHtml(filename)}".` +
          resultLink(url),
      );
    } catch (error) {
      setStatus('error', escapeHtml(errorText(error)));
    } finally {
      state.busy = false;
      resizeButton.disabled = false;
    }
  });

  return root;
}
