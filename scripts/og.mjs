// Renders the share card to public/og/energy-transition.png before `astro build`.
// Plain Node on purpose: sharp is a native module, which Cloudflare's Workers-based prerender can't load.
// shortcut: text uses whatever sans-serif the build machine has; pin a font file if Cloudflare's differs.
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { compute } from '../src/lib/energy-calc.ts';

const { rolling, last12 } = compute(readFileSync(new URL('../src/data/energy-transition-daily.csv', import.meta.url), 'utf8'));
const W = 1200, H = 630, cx0 = 640, cx1 = 1120, cy0 = 470, cy1 = 150;
const X = (i) => cx0 + (i / (rolling.length - 1)) * (cx1 - cx0);
const Y = (v) => cy0 - (v / 0.8) * (cy0 - cy1);
const line = (k, c) => {
	const d = rolling.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(r[k]).toFixed(1)}`).join('');
	return `<path d="${d}" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(rolling.length - 1)}" cy="${Y(rolling[rolling.length - 1][k])}" r="8" fill="${c}" stroke="#fff" stroke-width="3"/>`;
};
const p = (v) => Math.round(v * 100);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="#fff"/>
<text x="70" y="90" font-size="22" letter-spacing="2" fill="#8b93a1">AUSTRALIA'S ENERGY TRANSITION · NEM · 12 MONTHS TO ${last12.to.toUpperCase()}</text>
<text x="64" y="330" font-size="210" font-weight="700" letter-spacing="-8" fill="#14171c">${p(last12.ren)}%</text>
<text x="70" y="405" font-size="34" fill="#52514e">of electricity came from renewables,</text>
<text x="70" y="450" font-size="34" fill="#52514e">up from ${p(last12.first)}% in 2018-19.</text>
<text x="70" y="515" font-size="34" font-weight="700" fill="#14171c">Coal ${p(last12.coal)}% · Gas and other ${p(last12.gasOther)}%</text>
${[0, 0.2, 0.4, 0.6, 0.8].map((v) => `<line x1="${cx0}" x2="${cx1}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e1e0d9" stroke-width="2"/>`).join('')}
${line('coal', '#52514e')}${line('ren', '#0b6b5c')}
<text x="${cx1 - 10}" y="${Y(rolling[rolling.length - 1].coal) - 20}" font-size="26" text-anchor="end" fill="#52514e">Coal</text>
<text x="${cx1 - 10}" y="${Y(rolling[rolling.length - 1].ren) + 75}" font-size="26" text-anchor="end" fill="#0b6b5c">Renewables</text>
<text x="70" y="585" font-size="22" fill="#8b93a1">brianamadio.com/projects/energy-transition</text>
</svg>`;

mkdirSync(new URL('../public/og/', import.meta.url), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(new URL('../public/og/energy-transition.png', import.meta.url).pathname);
