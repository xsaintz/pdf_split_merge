/**
 * Self-check for the editor's pure helpers: `node src/lib/annotate.selfcheck.mjs`
 * The rotation cases are checked against where a page's corners must land when
 * the page is turned clockwise on screen.
 */
import assert from 'node:assert/strict';
import { toUserSpace, winAnsiText } from './annotate.js';

assert.equal(winAnsiText('“Halo” — dunia…'), '"Halo" - dunia...');
assert.equal(winAnsiText('Café ñ'), 'Café ñ');
assert.equal(winAnsiText('中文'), '??');

// A 100 × 200 page. Display space for 90/270 is 200 wide, 100 tall.
const page = (rotation) => ({ width: 100, height: 200, rotation });

// Unrotated: top-left on screen is the user-space top-left (0, 200).
assert.deepEqual(toUserSpace(page(0), 0, 0), { x: 0, y: 200 });
assert.deepEqual(toUserSpace(page(0), 100, 200), { x: 100, y: 0 });

// Turned 90° clockwise, the page's bottom-left corner shows at the top-left,
// and its bottom-right shows at the bottom-left.
assert.deepEqual(toUserSpace(page(90), 0, 0), { x: 0, y: 0 });
assert.deepEqual(toUserSpace(page(90), 0, 100), { x: 100, y: 0 });

// Upside down, the bottom-left corner shows at the top-right.
assert.deepEqual(toUserSpace(page(180), 100, 0), { x: 0, y: 0 });

// Turned 270°, the bottom-left corner shows at the bottom-right.
assert.deepEqual(toUserSpace(page(270), 200, 100), { x: 0, y: 0 });
assert.deepEqual(toUserSpace(page(-90), 200, 100), { x: 0, y: 0 });

console.log('annotate self-check ok');
