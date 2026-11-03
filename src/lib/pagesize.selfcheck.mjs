/**
 * Self-check for page resizing: `node src/lib/pagesize.selfcheck.mjs`
 * Covers the cases that silently go wrong: a rotated page, a landscape page on
 * "follow the original", and a margin.
 */
import assert from 'node:assert/strict';
import { describeSize, fitPage, mmToPoints, paperSizes } from './pagesize.js';

const a4 = paperSizes.a4.size;
const a5 = paperSizes.a5.size;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} ≠ ${expected}`);

// A4 portrait onto A5: half the area, so scaled by 1/√2 and filling the sheet.
let fit = fitPage({ width: a4[0], height: a4[1], rotation: 0 }, a5);
assert.deepEqual([fit.width, fit.height], a5);
close(fit.scale, a5[0] / a4[0]);
close(fit.x, 0);

// A landscape page on 'auto' gets a landscape sheet.
fit = fitPage({ width: 800, height: 400, rotation: 0 }, a4);
assert.deepEqual([fit.width, fit.height], [a4[1], a4[0]]);

// A portrait page stored sideways (/Rotate 90) is shown portrait: the sheet is
// portrait as shown, so landscape in the page's own unrotated space.
fit = fitPage({ width: 842, height: 595, rotation: 90 }, a4, 'auto');
assert.deepEqual([fit.width, fit.height], [a4[1], a4[0]]);
fit = fitPage({ width: 842, height: 595, rotation: -270 }, a4, 'landscape');
assert.deepEqual([fit.width, fit.height], [a4[0], a4[1]]);

// A margin shrinks the content and keeps it centred.
fit = fitPage({ width: 100, height: 100, rotation: 0 }, [200, 200], 'portrait', 20);
close(fit.scale, 1.6);
close(fit.x, 20);
close(fit.y, 20);

assert.equal(describeSize(a4[0], a4[1]), 'A4 potret (210 × 297 mm)');
assert.equal(describeSize(612, 792), 'Letter potret (216 × 279 mm)');
assert.equal(describeSize(mmToPoints(100), mmToPoints(50)), 'lanskap, 100 × 50 mm');

console.log('pagesize self-check ok');
