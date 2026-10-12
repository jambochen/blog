import { describe, expect, it } from 'vitest';
import { loopAt, nextStep, STEPS } from './agentLoop.ts';
import { add, CAPACITY, type Context, initialContext, newChat, usedPercent } from './contextWindow.ts';
import { append, appendStrip, canAppend, initialVector, preallocStrip, type Vector } from './growingVector.ts';
import { FILE_COUNTS, finish, laneAt, raceEnd, speedupLabel } from './parallelRace.ts';
import { revertTo } from './revertModes.ts';
import { INITIAL, speedupLimit } from './speedupLimit.ts';

describe('parallel race', () => {
	const [few, many] = FILE_COUNTS as [number, number];

	it('finishes four files sooner in sequence and twenty-four sooner in parallel, as the post says', () => {
		expect(finish(few, false)).toBeLessThan(finish(few, true));
		expect(finish(many, true)).toBeLessThan(finish(many, false));
	});

	it('gives each of the four workers six of the twenty-four files', () => {
		const owners = laneAt(many, true, raceEnd(many)).cells.map(({ owner }) => owner);
		for (const worker of [1, 2, 3, 4]) expect(owners.filter((owner) => owner === worker)).toHaveLength(6);
	});

	it('starts with every file waiting, every core idle and no phase', () => {
		for (const parallel of [false, true]) {
			const lane = laneAt(many, parallel, 0);
			expect(lane.phase).toBe('');
			expect(lane.cells.every(({ state }) => state === 'waiting')).toBe(true);
			expect(lane.cores.every((core) => core === 'idle')).toBe(true);
			expect(lane.spans).toEqual({ start: 0, run: 0, merge: 0 });
		}
	});

	it('hides the cells beyond the chosen file count', () => {
		expect(laneAt(few, false, 0).cells.filter(({ state }) => state === 'absent')).toHaveLength(many - few);
	});

	it('starts the workers before any file is touched in a parallel run', () => {
		const lane = laneAt(many, true, 1);
		expect(lane.phase).toBe('start');
		expect(lane.cores).toEqual(['busy', 'starting', 'starting', 'starting', 'starting']);
		expect(lane.cells.every(({ state }) => state === 'waiting')).toBe(true);
	});

	it('keeps the main process alone at work in a sequential run', () => {
		expect(laneAt(many, false, 1.5).cores).toEqual(['busy', 'idle', 'idle', 'idle', 'idle']);
	});

	it('stops a lane at its own finish while the other goes on', () => {
		const lane = laneAt(many, true, raceEnd(many));
		expect(lane).toMatchObject({ phase: 'done', clock: finish(many, true) });
	});

	it('states the speedup only once both lanes have finished', () => {
		expect(speedupLabel(many, raceEnd(many) - 0.1)).toBe('');
		expect(speedupLabel(many, raceEnd(many))).toBe('2.4×');
		expect(speedupLabel(few, raceEnd(few))).toBe('0.8×');
	});
});

describe('speedup limit', () => {
	it('opens on the worked example of the post: one serial minute, eight workers, a little over four times', () => {
		expect(speedupLimit(INITIAL.serial, INITIAL.workers)).toMatchObject({
			serialLabel: '1 min',
			speedup: '4.7×',
			limit: 'limit 10×',
			bars: { serial: { label: '1' }, whole: { label: '9' }, shared: { label: '1.1' } },
		});
	});

	it('has no limit when nothing is serial', () => {
		expect(speedupLimit(0, 4)).toMatchObject({ speedup: '4×', limit: 'no limit' });
		expect(speedupLimit(0, 4).bars.serial).toMatchObject({ empty: true });
	});

	it('drops the label of a bar too narrow to hold it', () => {
		expect(speedupLimit(1, 32).bars.shared.tight).toBe(true);
		expect(speedupLimit(1, 8).bars.shared.tight).toBe(false);
	});
});

describe('context window', () => {
	const fill = (context: Context, type: 'chat' | 'file' | 'tool', times: number) =>
		Array.from({ length: times }).reduce<Context>((current) => add(current, type), context);

	it('opens about a third full', () => {
		expect(usedPercent(initialContext())).toBe(32);
	});

	it('adds a block at the end without compacting while it fits', () => {
		const context = add(initialContext(), 'file');
		expect(context.blocks.at(-1)).toMatchObject({ type: 'file', size: 22 });
		expect(context.compactions).toBe(0);
	});

	it('drops old file reads and command output, but not the newest block, when the window overflows', () => {
		const context = fill(initialContext(), 'file', 7);
		expect(context.compactions).toBe(1);
		expect(context.blocks.map(({ type }) => type)).toEqual(['system', 'rules', 'chat', 'chat', 'file']);
	});

	it('summarises the chat too when dropping tool output did not free enough', () => {
		const chatty = fill(initialContext(), 'chat', 40);
		const context = add(chatty, 'file');
		expect(context.blocks.map(({ type }) => type)).toEqual(['system', 'rules', 'summary', 'file']);
		expect(context.blocks[2]?.size).toBeCloseTo((42 * 3) / 4);
	});

	it('never holds more than the window after an addition', () => {
		let context = initialContext();
		for (const type of ['file', 'tool', 'chat', 'file', 'file', 'tool', 'file', 'file', 'file', 'file', 'file'] as const) {
			context = add(context, type);
			expect(context.blocks.reduce((sum, { size }) => sum + size, 0)).toBeLessThanOrEqual(CAPACITY);
		}
	});

	it('keeps a block its id through a compaction, so the page can tell which blocks left', () => {
		const before = fill(initialContext(), 'file', 6);
		const after = add(before, 'file');
		const kept = after.blocks.filter(({ id }) => before.blocks.some((block) => block.id === id));
		expect(kept.map(({ type }) => type)).toEqual(['system', 'rules', 'chat', 'chat']);
	});

	it('keeps only what the framework wrote in a new chat', () => {
		const context = newChat(fill(initialContext(), 'file', 7));
		expect(context.blocks.map(({ type }) => type)).toEqual(['system', 'rules']);
		expect(context.compactions).toBe(0);
	});
});

describe('agent loop', () => {
	it('shows nothing before the user asks', () => {
		expect(loopAt(0)).toEqual({ step: undefined, loops: 0, route: undefined });
	});

	it('carries a request from the LLM through the harness to the tools', () => {
		expect(loopAt(2).route).toEqual({
			arrows: [
				[1, 'go'],
				[2, 'go'],
			],
			arrives: 3,
		});
	});

	it('counts a loop each time a result comes back', () => {
		expect(loopAt(2).loops).toBe(0);
		expect(loopAt(3).loops).toBe(1);
		expect(loopAt(STEPS.length).loops).toBe(3);
	});

	it('starts the exchange over after the answer', () => {
		expect(nextStep(0)).toBe(1);
		expect(nextStep(STEPS.length)).toBe(1);
	});
});

describe('growing vector', () => {
	const grow = (times: number) =>
		Array.from({ length: times }).reduce<Vector>((vector) => append(vector), initialVector());
	const states = (cells: { state: string }[]) => cells.map(({ state }) => state);

	it('opens with three values in each strip and the rest of the preallocated vector reserved', () => {
		const vector = initialVector();
		expect(states(appendStrip(vector)).slice(0, 6)).toEqual(['value', 'value', 'value', 'other', 'other', 'empty']);
		expect(states(preallocStrip(vector)).slice(3, 9)).toEqual(['other', 'other', 'value', 'value', 'value', 'reserved']);
		expect(states(preallocStrip(vector)).filter((state) => state === 'reserved')).toHaveLength(7);
	});

	it('moves the appended vector past the foreign block and copies every old element', () => {
		const vector = append(initialVector());
		expect(vector).toMatchObject({ length: 4, offset: 5, copied: 3, freed: { from: 0, length: 3 } });
		expect(states(appendStrip(vector)).slice(0, 9)).toEqual([
			'freed',
			'freed',
			'freed',
			'other',
			'other',
			'copied',
			'copied',
			'copied',
			'new',
		]);
	});

	it('copies nothing in the preallocated strip, where only the new element is written', () => {
		expect(states(preallocStrip(append(initialVector()))).slice(5, 10)).toEqual([
			'value',
			'value',
			'value',
			'new',
			'reserved',
		]);
	});

	it('copies the whole vector on every append, so the copies add up', () => {
		expect(grow(7)).toMatchObject({ length: 10, copied: 3 + 4 + 5 + 6 + 7 + 8 + 9 });
	});

	it('stops at ten elements', () => {
		expect(canAppend(grow(6))).toBe(true);
		expect(canAppend(grow(7))).toBe(false);
	});
});

describe('revert modes', () => {
	it('loses every commit after the target when discarding', () => {
		expect(revertTo(1)).toMatchObject({
			discard: [undefined, 'target', 'lost', 'lost', 'lost'],
			lost: 3,
		});
	});

	it('loses nothing when keeping, and adds one commit with the old contents', () => {
		expect(revertTo(1)).toMatchObject({
			keep: [undefined, 'target', undefined, undefined, undefined],
			added: '= tidy',
		});
	});
});
