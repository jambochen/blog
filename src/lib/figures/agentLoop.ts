export interface Step {
	kind: 'ask' | 'request' | 'result' | 'answer';
	text: string;
}

// One exchange from the post, cut down to a line per step.
export const STEPS: Step[] = [
	{ kind: 'ask', text: 'What changed in the latest lme4?' },
	{ kind: 'request', text: 'search "lme4 CRAN NEWS"' },
	{ kind: 'result', text: 'titles, URLs, snippets' },
	{ kind: 'request', text: 'open the CRAN page' },
	{ kind: 'result', text: 'page text' },
	{ kind: 'request', text: 'open NEWS' },
	{ kind: 'result', text: 'full changelog' },
	{ kind: 'answer', text: 'main changes, with sources' },
];

export const NODES = ['User', 'LLM', 'Harness', 'Tools'];

interface Route {
	// The arrows that carry the text, as [link, direction]; link `n` joins node `n` to the next.
	arrows: [number, 'go' | 'back'][];
	// The node the text arrives at.
	arrives: number;
}

const ROUTES: Record<Step['kind'], Route> = {
	ask: { arrows: [[0, 'go']], arrives: 1 },
	request: {
		arrows: [
			[1, 'go'],
			[2, 'go'],
		],
		arrives: 3,
	},
	result: {
		arrows: [
			[2, 'back'],
			[1, 'back'],
		],
		arrives: 1,
	},
	answer: { arrows: [[0, 'back']], arrives: 0 },
};

// `current` counts the steps taken; zero is before the user asks.
export function loopAt(current: number): { step?: Step; loops: number; route?: Route } {
	const step = STEPS[current - 1];
	return {
		step,
		// A loop closes each time a result comes back to the LLM.
		loops: STEPS.slice(0, current).filter(({ kind }) => kind === 'result').length,
		route: step && ROUTES[step.kind],
	};
}

// Past the answer, the next step starts the exchange over.
export function nextStep(current: number): number {
	return current === STEPS.length ? 1 : current + 1;
}
