import { describe, expect, it } from 'vitest';
import { contourLabels, contourOf, elevationOf, type Field, HIGH, LAND, type Point, surveyRoutes } from './terrainMap.ts';

// A small repeatable generator, so a failing case can be run again.
function seeded(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 2 ** 32;
		return state / 2 ** 32;
	};
}

const grid = (rows: number[][]): Field => ({ heights: rows.flat(), columns: rows[0]?.length ?? 0, rows: rows.length });

describe('elevationOf', () => {
	it('gives one map for one seed and another for another', () => {
		expect(elevationOf(7)(300, 400)).toBe(elevationOf(7)(300, 400));
		expect(elevationOf(7)(300, 400)).not.toBe(elevationOf(8)(300, 400));
	});

	it('changes little between neighbouring points, so outlines are smooth', () => {
		const elevation = elevationOf(42);
		for (let x = 0; x < 2000; x += 37) {
			expect(Math.abs(elevation(x, 500) - elevation(x + 1, 500))).toBeLessThan(0.05);
		}
	});

	it('has no step anywhere, also at the shore, so the coast is traced as a curve', () => {
		const elevation = elevationOf(42);
		// Fine enough that the steepest river bank changes far less than a step would.
		for (let x = 0; x < 2000; x += 0.05) {
			expect(Math.abs(elevation(x, 500) - elevation(x + 0.05, 500))).toBeLessThan(0.01);
		}
	});

	it('gives a window both sea and land for most seeds', () => {
		const mixed = Array.from({ length: 20 }, (_, seed) => {
			const elevation = elevationOf(seed * 50);
			const samples = Array.from({ length: 400 }, (_, index) => elevation((index % 20) * 96, Math.floor(index / 20) * 54));
			return samples.some((height) => height < LAND) && samples.some((height) => height >= LAND);
		});
		expect(mixed.filter(Boolean).length).toBeGreaterThanOrEqual(15);
	});
});

describe('contourOf', () => {
	it('finds nothing where the whole field is below the level', () => {
		expect(contourOf(grid([[0, 0], [0, 0]]), 1, 10, [0, 0])).toEqual({ areas: [], edges: [] });
	});

	it('covers a cell that is wholly at or above the level, with no edge', () => {
		const { areas, edges } = contourOf(grid([[1, 1], [1, 1]]), 1, 10, [0, 0]);
		expect(areas).toEqual([[[0, 0], [10, 0], [10, 10], [0, 10]]]);
		expect(edges).toEqual([]);
	});

	it('cuts a corner where one sample is above, crossing each side in proportion to the heights', () => {
		const { areas, edges } = contourOf(grid([[2, 0], [0, 0]]), 1, 10, [0, 0]);
		expect(areas).toEqual([[[0, 0], [5, 0], [0, 5]]]);
		expect(edges).toEqual([[[5, 0], [0, 5]]]);
	});

	it('places the cells from the origin it is given', () => {
		const { edges } = contourOf(grid([[2, 0], [0, 0]]), 1, 10, [-10, -10]);
		expect(edges).toEqual([[[-5, -10], [-10, -5]]]);
	});

	it('draws two edges in a saddle cell, where opposite corners are above', () => {
		const { edges } = contourOf(grid([[2, 0], [0, 2]]), 1, 10, [0, 0]);
		expect(edges).toHaveLength(2);
	});

	it('joins the edges of neighbouring cells end to end', () => {
		const { edges } = contourOf(grid([[2, 2, 2], [0, 0, 0]]), 1, 10, [0, 0]);
		expect(edges).toEqual([
			[[10, 5], [0, 5]],
			[[20, 5], [10, 5]],
		]);
	});
});

describe('surveyRoutes', () => {
	const plain = () => (LAND + HIGH) / 2;
	const view = { width: 1600, height: 900, margin: 272 };

	it('places none where the margin has no room for a label', () => {
		expect(surveyRoutes({ ...view, margin: 100 }, plain, seeded(1))).toEqual([]);
	});

	it('gives each side its own route of two points, from the top down', () => {
		const routes = surveyRoutes(view, plain, seeded(1));
		expect(routes.map((route) => route.length)).toEqual([2, 2]);
		for (const route of routes) expect(route[0]?.[1]).toBeLessThan(route[1]?.[1] ?? 0);
	});

	it('keeps every point and its label inside a margin, clear of the text', () => {
		for (const seed of [1, 2, 3, 4, 5]) {
			const [left = [], right = []] = surveyRoutes(view, plain, seeded(seed));
			for (const [x] of left) expect(x + 96).toBeLessThanOrEqual(view.margin);
			for (const [x] of right) {
				expect(x).toBeGreaterThanOrEqual(view.width - view.margin);
				expect(x + 96).toBeLessThanOrEqual(view.width);
			}
		}
	});

	it('keeps the points of one side well apart', () => {
		for (const route of surveyRoutes(view, plain, seeded(9))) {
			expect(Math.abs((route[0]?.[1] ?? 0) - (route[1]?.[1] ?? 0))).toBeGreaterThan(view.height * 0.3);
		}
	});

	it('places points on plain ground only', () => {
		const sea = () => LAND - 0.1;
		const hill = () => HIGH + 0.1;
		expect(surveyRoutes(view, sea, seeded(1))).toEqual([[], []]);
		expect(surveyRoutes(view, hill, seeded(1))).toEqual([[], []]);
	});
});

describe('contourLabels', () => {
	const view = { width: 1600, height: 900, margin: 272 };
	// A level line across the whole window, in 10px pieces.
	const across = (y: number, level: number) => ({
		level,
		edges: Array.from({ length: 160 }, (_, index): [Point, Point] => [[index * 10, y], [index * 10 + 10, y]]),
	});

	it('numbers a line in the margins only, clear of the text', () => {
		const labels = contourLabels([across(400, 0.25)], view);
		expect(labels.length).toBeGreaterThan(0);
		for (const { at, level } of labels) {
			expect(at[0] < view.margin || at[0] > view.width - view.margin).toBe(true);
			expect(level).toBe(0.25);
		}
	});

	it('places none where the window has no margins', () => {
		expect(contourLabels([across(400, 0.25)], { ...view, margin: 0 })).toEqual([]);
	});

	it('keeps the numbers apart, also between two lines', () => {
		const labels = contourLabels([across(400, 0.25), across(420, 0.5)], view);
		labels.forEach((a, index) => {
			for (const b of labels.slice(index + 1)) expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1])).toBeGreaterThanOrEqual(190);
		});
	});

	it('turns a number to follow its line, never upside down', () => {
		const down: [Point, Point] = [[100, 410], [100, 400]];
		const back: [Point, Point] = [[110, 400], [100, 400]];
		expect(contourLabels([{ level: 0.25, edges: [down] }], view)[0]?.angle).toBeCloseTo(Math.PI / 2);
		expect(contourLabels([{ level: 0.25, edges: [back] }], view)[0]?.angle).toBeCloseTo(0);
	});

	it('leaves room for the label of a survey point', () => {
		const edge: [Point, Point] = [[100, 400], [110, 400]];
		expect(contourLabels([{ level: 0.25, edges: [edge] }], view, [[80, 400]])).toEqual([]);
	});
});
