import type { Code, Root } from 'mdast';
import { visit } from 'unist-util-visit';

// Turns ```mermaid fences into <pre class="mermaid"> holding the raw diagram
// source, which is the markup Mermaid looks for in the browser. The node type is
// renamed so the syntax highlighter no longer treats it as a code block.
export function remarkMermaid() {
	return (tree: Root) => {
		visit(tree, { type: 'code', lang: 'mermaid' }, (node: Code) => {
			Object.assign(node, {
				type: 'mermaidDiagram',
				data: {
					hName: 'pre',
					hProperties: { className: ['mermaid'] },
					hChildren: [{ type: 'text', value: node.value }],
				},
			});
		});
	};
}
