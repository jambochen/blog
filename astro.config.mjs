// @ts-check

import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
import { defineConfig, fontProviders } from 'astro/config';
import rehypeMathjax from 'rehype-mathjax';
import remarkMath from 'remark-math';
import { remarkHeadingText } from './src/lib/remarkHeadingText.ts';
import { remarkMermaid } from './src/lib/remarkMermaid.ts';

// The Latin faces sit in front of the CJK face in one font-family stack, so they
// must not carry a generic fallback: `serif` would match first and swallow every
// Chinese glyph before the stack reaches the CJK face.
const latinOnly = { fallbacks: [], optimizedFallbacks: false, subsets: ['latin'] };

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	integrations: [
		// Has to come before mdx() so MDX code blocks go through it too.
		expressiveCode({
			themes: ['vitesse-light', 'vitesse-dark'],
			useDarkModeMediaQuery: false,
			themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
			styleOverrides: {
				borderRadius: '0',
				borderColor: 'transparent',
				codeBackground: ({ theme }) => (theme.type === 'dark' ? '#1f2429' : '#e1e5e9'),
				codeFontFamily: 'var(--font-code), var(--font-gothic), monospace',
				codeFontSize: '0.82rem',
				codeLineHeight: '1.7',
				uiFontFamily: 'var(--font-ui), var(--font-gothic), sans-serif',
				frames: {
					frameBoxShadowCssValue: 'none',
					editorActiveTabIndicatorTopColor: 'transparent',
					editorTabBarBackground: ({ theme }) => (theme.type === 'dark' ? '#000000' : '#16191d'),
					editorActiveTabBackground: ({ theme }) => (theme.type === 'dark' ? '#1f2429' : '#e1e5e9'),
					terminalTitlebarBackground: ({ theme }) => (theme.type === 'dark' ? '#000000' : '#16191d'),
					terminalBackground: ({ theme }) => (theme.type === 'dark' ? '#1f2429' : '#e1e5e9'),
				},
			},
		}),
		mdx(),
		sitemap(),
	],
	markdown: {
		processor: unified({
			remarkPlugins: [remarkMath, remarkMermaid, remarkHeadingText],
			// `ams` numbers only equation/align-style environments, which is what \label and \eqref need.
			rehypePlugins: [[rehypeMathjax, { tex: { tags: 'ams' } }]],
		}),
	},
	fonts: [
		{
			// Google serves this face in ~100 unicode-range slices, so a page downloads only
			// the glyphs it uses; Fontsource ships one 1.3 MB file per weight.
			provider: fontProviders.google(),
			name: 'Noto Serif TC',
			cssVariable: '--font-mincho',
			weights: [400, 700, 900],
			styles: ['normal'],
			subsets: ['chinese-traditional', 'latin'],
			fallbacks: ['serif'],
		},
		{
			// Running text is set in a sans face: the thin horizontal strokes of the serif
			// face blur at text sizes on ordinary-density screens. Its own Latin is used too.
			provider: fontProviders.google(),
			name: 'Noto Sans TC',
			cssVariable: '--font-gothic',
			weights: [400, 700],
			styles: ['normal'],
			subsets: ['chinese-traditional', 'latin'],
			fallbacks: ['sans-serif'],
		},
		{
			provider: fontProviders.fontsource(),
			name: 'Barlow Semi Condensed',
			cssVariable: '--font-ui',
			weights: [500, 600],
			styles: ['normal', 'italic'],
			...latinOnly,
		},
		{
			provider: fontProviders.fontsource(),
			name: 'Commit Mono',
			cssVariable: '--font-code',
			weights: [400, 700],
			styles: ['normal', 'italic'],
			...latinOnly,
		},
	],
});
