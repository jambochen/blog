import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

// The size link previews are cut to; other proportions get cropped.
const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 72;

// The light page's colours in `global.css`. A card is one picture for every reader, so it does not follow a theme.
const PAPER = '#fff';
const INK = '#16191d';
const MUTED = '#59616b';
const AMBER = '#eda900';

const UI = 'Barlow Semi Condensed';
const FONTS = resolve('node_modules/@fontsource');

type Font = { name: string; data: Buffer; weight: 500 | 900; style: 'normal' };

// Satori draws glyphs as outlines and so needs the font files themselves, in a format older than the WOFF2 the pages load.
// The mincho face comes cut into about a hundred files that each hold part of its glyphs, and Satori takes a glyph
// from the first font of a name only, so each file goes by a name of its own and a title is set in all of them.
function loadFonts() {
	const folder = resolve(FONTS, 'noto-serif-tc/files');
	const slices = readdirSync(folder)
		.filter((file) => /^noto-serif-tc-(latin|\d+)-900-normal\.woff$/.test(file))
		// Latin leads, so a Latin letter is not taken from a file of full-width forms.
		.sort((a, b) => Number(b.includes('latin')) - Number(a.includes('latin')))
		.map((file, index): Font => ({ name: `Mincho ${index}`, data: readFileSync(resolve(folder, file)), weight: 900, style: 'normal' }));
	const ui: Font = {
		name: UI,
		data: readFileSync(resolve(FONTS, 'barlow-semi-condensed/files/barlow-semi-condensed-latin-500-normal.woff')),
		weight: 500,
		style: 'normal',
	};
	return { fonts: [ui, ...slices], mincho: slices.map(({ name }) => name).join(', ') };
}
const { fonts, mincho } = loadFonts();

type Style = Record<string, string | number>;
type Node = { type: 'div'; props: { style: Style; children?: Node[] | string } };

// Satori lays out only flex containers, so every element is one.
const box = (style: Style, children?: Node[] | string): Node => ({
	type: 'div',
	props: { style: { display: 'flex', ...style }, children },
});

export interface Card {
	title: string;
	// The line above the title: the series the post belongs to.
	context?: string;
	// The episode number, set large beside the title as in a post's header.
	number?: number;
	siteName: string;
}

export async function shareCard({ title, context, number, siteName }: Card): Promise<Response> {
	// A long title at the full size would run past the bottom of the card.
	const titleSize = title.length > 36 ? 46 : title.length > 14 ? 64 : 80;
	const text = box({ flexDirection: 'column', flex: 1 }, [
		...(context ? [box({ marginBottom: 20, fontSize: 30, lineHeight: 1.4, color: MUTED }, context)] : []),
		box({ fontSize: titleSize, lineHeight: 1.25, textWrap: 'balance' }, title),
	]);

	const card = box(
		{
			// Satori adds the padding to these, as `box-sizing: content-box` does.
			width: WIDTH - 2 * MARGIN,
			height: HEIGHT - 2 * MARGIN,
			flexDirection: 'column',
			justifyContent: 'space-between',
			padding: MARGIN,
			background: PAPER,
			color: INK,
			fontFamily: mincho,
			fontWeight: 900,
		},
		[
			box({ flexDirection: 'column' }, [
				box({ height: 10, marginBottom: 48, background: INK }),
				box({ alignItems: 'flex-start' }, [
					...(number === undefined
						? []
						: [
								box(
									{ marginRight: 56, fontFamily: UI, fontWeight: 500, fontSize: 230, lineHeight: 0.85 },
									String(number).padStart(2, '0'),
								),
							]),
					text,
				]),
			]),
			box({ flexDirection: 'column', alignItems: 'flex-start' }, [
				box({ fontSize: 40, lineHeight: 1.2 }, siteName),
				box({ width: 96, height: 6, marginTop: 10, background: AMBER }),
			]),
		],
	);

	const svg = await satori(card, { width: WIDTH, height: HEIGHT, fonts });
	const png = await sharp(Buffer.from(svg)).png().toBuffer();
	return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
