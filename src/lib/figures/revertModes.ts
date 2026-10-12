export const COMMITS = ['clean', 'tidy', 'model', 'log', 'plot'];
// The latest commit is left out of the choices: going back to it changes nothing.
export const CHOICES = COMMITS.slice(0, -1);
export const INITIAL_TARGET = 1;

export type CommitState = 'target' | 'lost' | undefined;

export function revertTo(target: number) {
	const mark = (discarding: boolean) =>
		COMMITS.map((_, index): CommitState =>
			index === target ? 'target' : discarding && index > target ? 'lost' : undefined,
		);
	return {
		discard: mark(true),
		keep: mark(false),
		lost: COMMITS.length - 1 - target,
		// The one new commit that keeping adds, holding the target's contents.
		added: `= ${COMMITS[target]}`,
	};
}
