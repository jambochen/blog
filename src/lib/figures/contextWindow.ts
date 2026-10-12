// Sizes are in thousands of tokens and only illustrative; what matters is their proportion to the window.
export const CAPACITY = 200;
export const SIZES = { chat: 3, file: 22, tool: 12 };

export type BlockType = 'system' | 'rules' | 'chat' | 'file' | 'tool' | 'summary';

export interface Block {
	// Stays with the block for as long as it is in the window.
	id: number;
	type: BlockType;
	size: number;
	// Written by the framework before the user says anything; survives a new chat.
	fixed: boolean;
}

export interface Context {
	blocks: Block[];
	compactions: number;
	nextId: number;
}

// Compaction summarises the chat only if dropping old tool output did not free enough.
const SUMMARISE_ABOVE = 0.3;
const SUMMARY_RATIO = 0.25;

const total = (blocks: Block[]) => blocks.reduce((sum, block) => sum + block.size, 0);

export function initialContext(): Context {
	const blocks: Omit<Block, 'id'>[] = [
		{ type: 'system', size: 18, fixed: true },
		{ type: 'rules', size: 6, fixed: true },
		{ type: 'chat', size: SIZES.chat, fixed: false },
		{ type: 'file', size: SIZES.file, fixed: false },
		{ type: 'tool', size: SIZES.tool, fixed: false },
		{ type: 'chat', size: SIZES.chat, fixed: false },
	];
	return { blocks: blocks.map((block, id) => ({ ...block, id })), compactions: 0, nextId: blocks.length };
}

export function usedPercent({ blocks }: Context): number {
	return Math.round((total(blocks) / CAPACITY) * 100);
}

export function widthPercent(block: Block): number {
	return (block.size / CAPACITY) * 100;
}

function compact(context: Context): Context {
	// The `!` is safe: compaction follows an addition, so there is a newest block.
	const newest = context.blocks.at(-1)!;
	let blocks = context.blocks.filter(
		(block) => block === newest || (block.type !== 'file' && block.type !== 'tool'),
	);
	let { nextId } = context;

	if (total(blocks) > CAPACITY * SUMMARISE_ABOVE) {
		const talk = blocks.filter((block) => block !== newest && (block.type === 'chat' || block.type === 'summary'));
		const summary: Block = { id: nextId++, type: 'summary', size: total(talk) * SUMMARY_RATIO, fixed: false };
		const firstLoose = blocks.findIndex((block) => !block.fixed);
		blocks = [...blocks.slice(0, firstLoose), summary, ...blocks.slice(firstLoose)].filter(
			(block) => !talk.includes(block),
		);
	}
	return { blocks, compactions: context.compactions + 1, nextId };
}

export function add(context: Context, type: keyof typeof SIZES): Context {
	const block: Block = { id: context.nextId, type, size: SIZES[type], fixed: false };
	const grown = { ...context, blocks: [...context.blocks, block], nextId: context.nextId + 1 };
	return total(grown.blocks) > CAPACITY ? compact(grown) : grown;
}

export function newChat(context: Context): Context {
	return { ...context, blocks: context.blocks.filter((block) => block.fixed), compactions: 0 };
}
