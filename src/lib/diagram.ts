// The palette the figures are drawn with (diagram-design HTML and the matplotlib
// charts share it), mapped onto the site's tokens so figures follow the theme.
const SOLID: Record<string, string> = {
	'#f5f5f5': 'var(--paper)',
	'#2d3142': 'var(--ink)',
	'#4f5d75': 'var(--muted)',
	'#eb6c36': 'var(--diagram-accent)',
	'#ffffff': 'var(--diagram-raised)',
	'#d9dadd': 'var(--rule)',
	'#2e5aa8': 'var(--accent)',
	// Drawn as a label mask over a tinted zone; `siteStyle` removes the tint, so it masks to the page.
	'#f1f1f2': 'var(--paper)',
	// A softened muted stroke, baked into the drawings as a blend.
	'#7a8399': 'color-mix(in srgb, var(--muted) 74%, var(--paper))',
};

const RULE_STROKE = /stroke="rgba\(45,49,66,0\.1[02]?\)"/g;

const TRANSLUCENT: Record<string, string> = {
	'45,49,66': 'var(--ink)',
	'79,93,117': 'var(--muted)',
	'235,108,54': 'var(--diagram-accent)',
};

// Units of the 960-wide drawing: the margin on every side, how far a zone's tab
// sits in from the zone's edge, how far text hangs below its baseline, and the
// height of the strip at the bottom that holds a legend.
const PAGE_MARGIN = 40;
const ZONE_INSET = 16;
const TEXT_DESCENT = 4;
const LEGEND_BAND = 16;
// The figures are drawn with 12-unit text, which the text column shrinks to under 9px.
const TEXT_SIZE = 13.5;

const UI_FONT = 'var(--font-ui), var(--font-gothic), sans-serif';
const CODE_FONT = 'var(--font-code), var(--font-gothic), monospace';

function hash(text: string): string {
	let value = 0;
	for (let index = 0; index < text.length; index++) {
		value = (Math.imul(value, 31) + text.charCodeAt(index)) | 0;
	}
	return (value >>> 0).toString(36);
}

const escapeAttribute = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// The diagram-design figures come as soft cards: rounded boxes inside tinted,
// rounded zones, with a wide margin for a page of their own. The site is square
// and ruled, so this redraws those parts in its terms without touching the files.
// Charts carry none of these patterns and pass through unchanged.
function siteStyle(svg: string): string {
	if (!/viewBox="0 0 960 \d+"/.test(svg)) return svg;

	const restyled = svg
		.replace(/\s(?:rx|ry)="[\d.]+"/g, '')
		// A zone becomes a heavy rule over its contents, as a series is on the home page.
		.replace(
			/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="\d+" fill="rgba\(45,49,66,0\.02\)" stroke="rgba\(45,49,66,0\.10\)" stroke-width="0\.8"\/>/g,
			(_, x: string, y: string, width: string) =>
				`<line x1="${x}" y1="${y}" x2="${Number(x) + Number(width)}" y2="${y}" stroke="#2d3142" stroke-width="3"/>`,
		)
		// Its name was centred on a tab cut into the zone's border; it now starts at the rule's left end.
		.replace(
			/<rect x="(\d+)" y="\d+" width="\d+" height="(?:16|20)" fill="#f1f1f2"\/>(\s*)<text x="[\d.]+"([^>]*?) fill="rgba\(45,49,66,0\.55\)"([^>]*?) font-weight="500"([^>]*?) text-anchor="middle">/g,
			(_, x: string, gap: string, a: string, b: string, c: string) =>
				`${gap}<text x="${Number(x) - ZONE_INSET}"${a} fill="#2d3142"${b} font-weight="600"${c}>`,
		);

	// Paths are left out: they are connectors, which never reach below the boxes they join.
	const bottoms = [
		...[...restyled.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map(
			([, y, height]) => Number(y) + Number(height),
		),
		...[...restyled.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g)].map(([, y]) => Number(y) + TEXT_DESCENT),
		...[...restyled.matchAll(/<line [^>]*y1="([\d.]+)"[^>]*y2="([\d.]+)"/g)].flatMap(([, a, b]) => [Number(a), Number(b)]),
		...[...restyled.matchAll(/<circle cx="[\d.]+" cy="([\d.]+)" r="([\d.]+)"/g)].map(
			([, y, r]) => Number(y) + Number(r),
		),
	];
	const bottom = Math.max(...bottoms);
	const top = PAGE_MARGIN - 2;

	return (
		restyled
			// A legend lays its entries out by the width of 12-unit text, so larger text would run them together.
			.replace(/<text x="[\d.]+" y="([\d.]+)"[^>]*>/g, (tag, y: string) =>
				Number(y) > bottom - LEGEND_BAND ? tag : tag.replace('font-size="12"', `font-size="${TEXT_SIZE}"`),
			)
			.replace(
				/viewBox="0 0 960 \d+"/,
				`viewBox="${PAGE_MARGIN} ${top} ${960 - 2 * PAGE_MARGIN} ${bottom + 2 - top}"`,
			)
	);
}

// Takes a standalone figure file (an HTML page holding one <svg>, or an SVG
// file) and returns the <svg> alone, ready to sit inline in a post.
export function themeDiagram(source: string, alt: string): string {
	const match = source.match(/<svg[\s\S]*<\/svg>/);
	if (!match) throw new Error('Diagram source contains no <svg> element.');

	// Several figures on one page would otherwise share ids such as `arrow`, and
	// every reference would resolve to the first figure's definition.
	const prefix = `d${hash(source)}-`;

	return (
		siteStyle(match[0])
			// <title> would show as a tooltip over the whole figure; `alt` carries the description instead.
			.replace(/<(title|desc|metadata)[\s>][\s\S]*?<\/\1>/g, '')
			.replace(/<svg([^>]*)>/, (_, attributes: string) => {
				const kept = attributes.replace(/\s(width|height|role|aria-labelledby|id)="[^"]*"/g, '');
				return `<svg${kept} role="img" aria-label="${escapeAttribute(alt)}">`;
			})
			.replace(/\sid="([^"]+)"/g, ` id="${prefix}$1"`)
			.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
			.replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
			// The figures' `rule` role is a faint wash of ink; on the page it has to be the
			// theme's own rule colour, or a figure's hairlines read fainter than the page's.
			.replace(RULE_STROKE, 'stroke="var(--rule)"')
			.replace(/#[0-9a-f]{6}\b/gi, (colour) => SOLID[colour.toLowerCase()] ?? colour)
			.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g, (colour, r, g, b, alpha) => {
				const token = TRANSLUCENT[`${r},${g},${b}`];
				if (!token) return colour;
				return `color-mix(in srgb, ${token} ${Math.round(Number(alpha) * 100)}%, transparent)`;
			})
			.replace(/font-family="([^"]*)"/g, (_, stack: string) => {
				return `font-family="${stack.includes('Mono') ? CODE_FONT : UI_FONT}"`;
			})
			.replace(/font-family:[^;"]*/g, `font-family: ${UI_FONT}`)
	);
}
