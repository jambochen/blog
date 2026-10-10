interface MdastNode {
	type: string;
	value?: string;
	children?: MdastNode[];
}

interface AstroVFile {
	data: { astro?: { frontmatter?: Record<string, unknown> } };
}

// Astro's own heading list drops formulas, because by the time it reads a
// heading the math has become SVG. This records each heading's text with the
// LaTeX source kept, in document order, so the outline can show it.
export function remarkHeadingText() {
	const textOf = (node: MdastNode): string => {
		if (node.type === 'inlineMath') return `$${node.value}$`;
		return node.value ?? node.children?.map(textOf).join('') ?? '';
	};

	return (tree: MdastNode, file: AstroVFile) => {
		const texts: string[] = [];
		const visit = (node: MdastNode) => {
			if (node.type === 'heading') texts.push(textOf(node));
			else node.children?.forEach(visit);
		};
		visit(tree);

		const frontmatter = file.data.astro?.frontmatter;
		if (frontmatter) frontmatter.headingTexts = texts;
	};
}
