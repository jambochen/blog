interface MdastNode {
	type: string;
	lang?: string | null;
	value?: string;
	children?: MdastNode[];
	data?: Record<string, unknown>;
}

// Turns ```mermaid fences into <pre class="mermaid"> holding the raw diagram
// source, which is the markup Mermaid looks for in the browser. The node type is
// renamed so the syntax highlighter no longer treats it as a code block.
export function remarkMermaid() {
	const visit = (node: MdastNode) => {
		if (node.type === 'code' && node.lang === 'mermaid') {
			node.type = 'mermaidDiagram';
			node.data = {
				hName: 'pre',
				hProperties: { className: ['mermaid'] },
				hChildren: [{ type: 'text', value: node.value ?? '' }],
			};
			return;
		}
		node.children?.forEach(visit);
	};
	return (tree: MdastNode) => visit(tree);
}
