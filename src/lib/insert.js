import { cls, errorText, escapeHtml, html, keepPdfs, paintIcons, paintStatus, readFileBytes } from './ui.js';
import { insertDocument } from './pdf.js';

/**
 * "Sisipkan PDF lain": puts the pages of more files into the document a tool
 * already has open, so nobody has to merge first and come back.
 *
 * The worker swaps the stored document in place (same docId); the view only
 * has to catch its own state up in `onInserted({ pageCount, firstPage, at,
 * inserted, bytes }, position)`. Several files go in one after another, as one
 * contiguous block, and are reported once.
 *
 * `appendOnly` is for Atur Halaman, whose page order lives in the view: the
 * new pages are added at the end of the source and the view places them at
 * `position` in its own order, so nothing it already indexes has to shift.
 */
export function createInsertControl({ getDocId, getPageCount, onInserted, appendOnly = false }) {
  const element = html(`
    <div class="space-y-3 rounded-lg border border-dashed border-hairline bg-white px-5 py-4 transition-colors [&.is-dragging]:border-action">
      <div class="flex flex-wrap items-center gap-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-sm bg-parchment text-action">
          <i data-lucide="file-plus" class="size-[18px]"></i>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-caption text-ink">Sisipkan PDF lain</span>
          <span class="block text-fine text-ink-48">Tarik file ke sini atau pilih — halamannya masuk ke dokumen ini.</span>
        </span>
        <label class="flex items-center gap-2 text-fine text-ink-48">
          Setelah halaman
          <input data-position type="number" min="0" class="w-20 rounded-sm border border-hairline bg-white px-2 py-1.5 text-caption text-ink" />
        </label>
        <button type="button" data-pick class="${cls.chip}">Pilih PDF</button>
        <input data-input type="file" accept="application/pdf,.pdf" multiple class="hidden" />
      </div>
      <p class="text-fine text-ink-48">0 berarti di awal dokumen.</p>
      <div data-insert-status></div>
    </div>
  `);

  const positionInput = element.querySelector('[data-position]');
  const pickButton = element.querySelector('[data-pick]');
  const input = element.querySelector('[data-input]');
  const statusHost = element.querySelector('[data-insert-status]');
  let busy = false;

  /** Points the position at the end of the document — call after every load. */
  function refresh() {
    const count = getPageCount();
    positionInput.max = String(count);
    positionInput.value = String(count);
    paintStatus(statusHost, null, '');
  }

  async function insertFiles(files) {
    if (busy || !files.length) return;
    busy = true;
    pickButton.disabled = true;

    const count = getPageCount();
    const position = Math.max(0, Math.min(Math.round(Number(positionInput.value) || 0), count));
    // Undefined means the end of the source, whatever the view shows.
    let at = appendOnly ? undefined : position;
    let first = null;
    let last = null;
    let inserted = 0;
    let failed = false;

    try {
      for (const [index, file] of files.entries()) {
        paintStatus(statusHost, 'working', `Menyisipkan file ${index + 1} dari ${files.length}…`);
        const bytes = await readFileBytes(file);
        last = await insertDocument(getDocId(), bytes, file.name, at);
        first ??= last;
        at = last.at + last.inserted;
        inserted += last.inserted;
      }
    } catch (error) {
      failed = true;
      paintStatus(statusHost, 'error', escapeHtml(errorText(error)));
    }

    if (last) {
      await onInserted({ ...last, at: first.at, inserted }, position);
      // Read back from the view: Atur Halaman counts the cards it shows.
      const total = getPageCount();
      positionInput.max = String(total);
      positionInput.value = String(position + inserted);
      if (!failed) {
        paintStatus(statusHost, 'success', `${inserted} halaman disisipkan. Dokumen kini ${total} halaman.`);
      }
    }

    busy = false;
    pickButton.disabled = false;
  }

  pickButton.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    insertFiles(keepPdfs(input.files ?? []));
    input.value = '';
  });

  // Dropping only — paste stays with the tool's own loader.
  ['dragenter', 'dragover'].forEach((type) =>
    element.addEventListener(type, (event) => {
      event.preventDefault();
      element.classList.add('is-dragging');
    }),
  );
  ['dragleave', 'drop'].forEach((type) =>
    element.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === 'dragleave' && element.contains(event.relatedTarget)) return;
      element.classList.remove('is-dragging');
    }),
  );
  element.addEventListener('drop', (event) => insertFiles(keepPdfs(event.dataTransfer?.files ?? [])));

  paintIcons(element);
  return { element, refresh };
}
