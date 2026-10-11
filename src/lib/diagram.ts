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
	// These two are blends baked into the drawings: a label mask over a 2% ink zone, and a softened muted stroke.
	'#f1f1f2': 'color-mix(in srgb, var(--ink) 2%, var(--paper))',
	'#7a8399': 'color-mix(in srgb, var(--muted) 74%, var(--paper))',
};

const TRANSLUCENT: Record<string, string> = {
	'45,49,66': 'var(--ink)',
	'79,93,117': 'var(--muted)',
	'235,108,54': 'var(--diagram-accent)',
};

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

// Takes a standalone figure file (an HTML page holding one <svg>, or an SVG
// file) and returns the <svg> alone, ready to sit inline in a post.
export function themeDiagram(source: string, alt: string): string {
	const match = source.match(/<svg[\s\S]*<\/svg>/);
	if (!match) throw new Error('Diagram source contains no <svg> element.');

	// Several figures on one page would otherwise share ids such as `arrow`, and
	// every reference would resolve to the first figure's definition.
	const prefix = `d${hash(source)}-`;

	return (
		match[0]
			// <title> would show as a tooltip over the whole figure; `alt` carries the description instead.
			.replace(/<(title|desc|metadata)[\s>][\s\S]*?<\/\1>/g, '')
			.replace(/<svg([^>]*)>/, (_, attributes: string) => {
				const kept = attributes.replace(/\s(width|height|role|aria-labelledby|id)="[^"]*"/g, '');
				return `<svg${kept} role="img" aria-label="${escapeAttribute(alt)}">`;
			})
			.replace(/\sid="([^"]+)"/g, ` id="${prefix}$1"`)
			.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
			.replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
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
