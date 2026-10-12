import { oneDecimal } from './format.ts';

// The job is fixed at ten minutes so the bars share one axis with the worked example in the text.
export const TOTAL = 10;
export const INITIAL = { serial: 1, workers: 8 };

export interface Bar {
	label: string;
	empty: boolean;
	// Too narrow for its label.
	tight: boolean;
}

function bar(minutes: number): Bar {
	return {
		label: oneDecimal(minutes),
		empty: minutes === 0,
		// Roughly the share of the axis a three-character label needs.
		tight: minutes / TOTAL < 0.04,
	};
}

export function speedupLimit(serial: number, workers: number) {
	const shared = (TOTAL - serial) / workers;
	return {
		serialLabel: `${oneDecimal(serial)} min`,
		bars: { serial: bar(serial), whole: bar(TOTAL - serial), shared: bar(shared) },
		speedup: `${oneDecimal(TOTAL / (serial + shared))}×`,
		limit: serial > 0 ? `limit ${oneDecimal(TOTAL / serial)}×` : 'no limit',
	};
}
