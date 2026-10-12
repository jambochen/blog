import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Anchored at `src`, so the copies of the repo that agents check out under
		// `.claude/worktrees/` do not have their tests run a second time from here.
		include: ['src/**/*.test.ts'],
	},
});
