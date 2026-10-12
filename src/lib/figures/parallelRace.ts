import { oneDecimal } from './format.ts';

// Times are in units of one file's computation. The start-up and merge costs are chosen so that
// four files finish sooner in sequence and twenty-four finish sooner in parallel.
export const FILE_COUNTS = [4, 24];
export const WORKERS = 4;
const START = 3;
const MERGE = 1;

export type Phase = '' | 'start' | 'run' | 'merge' | 'done';

export interface Lane {
	clock: number;
	phase: Phase;
	cells: { state: 'absent' | 'waiting' | 'running' | 'done'; progress: number; owner?: number }[];
	// The main process first, then each worker.
	cores: ('idle' | 'starting' | 'busy')[];
	startProgress: number;
	// How long each phase has lasted so far.
	spans: { start: number; run: number; merge: number };
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

// Each worker takes one run of neighbouring files and works through it in order.
function plan(files: number, parallel: boolean) {
	if (!parallel) return { start: 0, run: files, merge: 0, begins: (index: number) => index, owner: () => 0 };
	const batch = Math.ceil(files / WORKERS);
	return {
		start: START,
		run: batch,
		merge: MERGE,
		begins: (index: number) => START + (index % batch),
		owner: (index: number) => Math.floor(index / batch) + 1,
	};
}

export function finish(files: number, parallel: boolean): number {
	const { start, run, merge } = plan(files, parallel);
	return start + run + merge;
}

// Both lanes share one time axis, which ends when the slower of them does.
export function raceEnd(files: number): number {
	return Math.max(finish(files, false), finish(files, true));
}

export function laneAt(files: number, parallel: boolean, time: number): Lane {
	const { start, run, merge, begins, owner } = plan(files, parallel);
	const end = start + run + merge;
	const clock = Math.min(time, end);
	const phase: Phase =
		clock === 0 ? '' : clock < start ? 'start' : clock < start + run ? 'run' : clock < end ? 'merge' : 'done';

	const cells = Array.from({ length: Math.max(...FILE_COUNTS) }, (_, index): Lane['cells'][number] => {
		const progress = clamp(clock - begins(index));
		return {
			// Cells beyond the chosen file count keep their place, so the figure does not change height.
			state: index >= files ? 'absent' : progress === 0 ? 'waiting' : progress < 1 ? 'running' : 'done',
			progress,
			owner: progress > 0 && parallel ? owner(index) : undefined,
		};
	});

	const used = parallel ? Math.min(WORKERS, files) : 0;
	// The main process works alone in a sequential run and only hands out and collects in a parallel one.
	const mainBusy = parallel ? phase === 'start' || phase === 'merge' : phase === 'run';
	const worker = phase === 'start' ? 'starting' : phase === 'run' ? 'busy' : 'idle';
	const cores: Lane['cores'] = [
		mainBusy ? 'busy' : 'idle',
		...Array.from({ length: WORKERS }, (_, index) => (index < used ? worker : 'idle')),
	];

	return {
		clock,
		phase,
		cells,
		cores,
		startProgress: start === 0 ? 0 : clamp(clock / start),
		spans: {
			start: Math.min(clock, start),
			run: clamp((clock - start) / run) * run,
			merge: Math.max(0, clock - start - run),
		},
	};
}

// Empty until both lanes have finished.
export function speedupLabel(files: number, time: number): string {
	if (time < raceEnd(files)) return '';
	return `${oneDecimal(finish(files, false) / finish(files, true))}×`;
}
