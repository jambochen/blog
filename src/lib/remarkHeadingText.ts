import type { Nodes, Root } from 'mdast';
import { visit } from 'unist-util-visit';

interface AstroVFile {
	data: { astro?: { frontmatter?: Record<string, unknown> } };
}

// Astro's own heading list drops formulas, because by the time it reads a
// heading the math has become SVG. This records each heading's text with the
// LaTeX source kept, in document order, so the outline can show it.
export function remarkHeadingText() {
	const textOf = (node: Nodes): string => {
		if (node.type === 'inlineMath') return `$${node.value}$`;
		if ('children' in node) return node.children.map(textOf).join('');
		return 'value' in node ? node.value : '';
	};

	return (tree: Root, file: AstroVFile) => {
		const texts: string[] = [];
		visit(tree, 'heading', (node) => {
			texts.push(textOf(node));
		});

		const frontmatter = file.data.astro?.frontmatter;
		if (frontmatter) frontmatter.headingTexts = texts;
	};
}
