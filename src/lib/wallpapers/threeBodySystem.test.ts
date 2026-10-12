import { describe, expect, it } from 'vitest';
import {
	advance,
	type Body,
	ENTRY,
	ESCAPE,
	exchange,
	loosen,
	MIN_PAIR_AXIS,
	pairAxis,
	spawn,
	type System,
} from './threeBodySystem.ts';

function seeded(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 2 ** 32;
		return state / 2 ** 32;
	};
}

const body = (x: number, y: number, vx = 0, vy = 0, rest: Partial<Body> = {}): Body => ({
	x,
	y,
	vx,
	vy,
	opacity: 1,
	leaving: false,
	...rest,
});

const total = (bodies: Body[], key: 'x' | 'y' | 'vx' | 'vy') => bodies.reduce((sum, each) => sum + each[key], 0);

// Kinetic plus potential, with the softening left out: close enough while no two bodies are near.
function energy(bodies: Body[]): number {
	let sum = 0;
	bodies.forEach((first, index) => {
		sum += (first.vx ** 2 + first.vy ** 2) / 2;
		for (const second of bodies.slice(index + 1)) sum -= 1 / Math.hypot(first.x - second.x, first.y - second.y);
	});
	return sum;
}

describe('spawn', () => {
	it('starts three bodies at rest as a whole, centred on the origin', () => {
		for (const seed of [1, 2, 3]) {
			const { bodies, centre } = spawn(seeded(seed));
			expect(bodies).toHaveLength(3);
			expect(centre).toEqual([0, 0]);
			for (const key of ['x', 'y', 'vx', 'vy'] as const) expect(total(bodies, key)).toBeCloseTo(0);
		}
	});

	it('starts every body inside the corner and not yet visible', () => {
		for (const each of spawn(seeded(4)).bodies) {
			expect(Math.hypot(each.x, each.y)).toBeLessThan(ESCAPE);
			expect(each).toMatchObject({ opacity: 0, leaving: false });
		}
	});
});

describe('advance', () => {
	it('keeps two bodies on a circular orbit at their distance', () => {
		// Two unit masses one unit apart circle their midpoint at this speed.
		const speed = Math.sqrt(0.5);
		const system: System = { bodies: [body(-0.5, 0, 0, -speed), body(0.5, 0, 0, speed)], centre: [0, 0] };
		advance(system, 5);
		const [first, second] = system.bodies as [Body, Body];
		expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeCloseTo(1, 1);
	});

	it('keeps the momentum and, while no two bodies pass close, the energy', () => {
		const system: System = {
			bodies: [body(-1, 0, 0, -0.5), body(1, 0, 0, 0.5), body(0, 3, 0.2, 0)],
			centre: [0, 0],
		};
		const [momentum, before] = [total(system.bodies, 'vx'), energy(system.bodies)];
		advance(system, 1);
		expect(total(system.bodies, 'vx')).toBeCloseTo(momentum);
		expect(energy(system.bodies)).toBeCloseTo(before, 2);
	});
});

describe('loosen', () => {
	const tight = (): [Body, Body] => [body(-0.05, 0, 0, -1), body(0.05, 0, 0, 1)];

	it('widens a pair whose orbit is too small, slowing it as it does', () => {
		const [first, second] = tight();
		const before = pairAxis(first, second) ?? 0;
		expect(before).toBeLessThan(MIN_PAIR_AXIS);
		loosen(first, second, 1);
		expect(pairAxis(first, second)).toBeGreaterThan(before);
		expect(first.x).toBeLessThan(-0.05);
		expect(Math.abs(first.vy)).toBeLessThan(1);
	});

	it('leaves the midpoint of the pair where it was', () => {
		const [first, second] = tight();
		first.x += 3;
		second.x += 3;
		loosen(first, second, 1);
		expect((first.x + second.x) / 2).toBeCloseTo(3);
	});

	it('leaves a wide pair and an unbound pair alone', () => {
		const wide: [Body, Body] = [body(-0.5, 0, 0, -0.7), body(0.5, 0, 0, 0.7)];
		const unbound: [Body, Body] = [body(-0.05, 0, 0, -9), body(0.05, 0, 0, 9)];
		for (const [first, second] of [wide, unbound]) {
			const before = { ...first };
			loosen(first, second, 1);
			expect(first).toEqual(before);
		}
		expect(pairAxis(...unbound)).toBeUndefined();
	});
});

describe('exchange', () => {
	const pair = () => [body(-0.5, 0, 0, -0.7), body(0.5, 0, 0, 0.7)];

	it('fades a body in while it stays', () => {
		const system: System = { bodies: [...pair(), body(0, 1, 0, 0, { opacity: 0 })], centre: [0, 0] };
		exchange(system, 0.75, seeded(1));
		expect(system.bodies[2]?.opacity).toBeCloseTo(0.5);
	});

	it('marks a body that has gone past the edge as leaving, and fades it out', () => {
		const system: System = { bodies: [...pair(), body(ESCAPE + 2, 0)], centre: [0, 0] };
		exchange(system, 0.75, seeded(1));
		expect(system.bodies[2]).toMatchObject({ leaving: true });
		expect(system.bodies[2]?.opacity).toBeCloseTo(0.5);
	});

	it('throws a new body in from the edge once the one that left has faded', () => {
		const gone = body(40, 0, 0, 0, { opacity: 0, leaving: true });
		const system: System = { bodies: [...pair(), gone], centre: [0, 0] };
		const after = exchange(system, 0.1, seeded(1));
		const thrown = after.bodies[2];
		expect(thrown).not.toBe(gone);
		expect(thrown).toMatchObject({ opacity: 0, leaving: false });
		expect(Math.hypot(thrown?.x ?? 0, thrown?.y ?? 0)).toBeCloseTo(ENTRY);
	});

	it('follows the visible bodies with the view', () => {
		const system: System = { bodies: [body(2, 2), body(4, 2), body(0, 0, 0, 0, { opacity: 0 })], centre: [0, 0] };
		exchange(system, 0.01, seeded(1));
		expect(system.centre).toEqual([3, 2]);
	});

	it('starts over once fewer than two bodies stay and all have faded', () => {
		const leaving = (x: number) => body(x, 0, 0, 0, { opacity: 0.1, leaving: true });
		const system: System = { bodies: [body(0, 0, 0, 0, { opacity: 0.1 }), leaving(9), leaving(-9)], centre: [0, 0] };
		expect(exchange(system, 0.01, seeded(1))).toBe(system);
		const fresh = exchange(system, 1, seeded(1));
		expect(fresh).not.toBe(system);
		expect(fresh.bodies.every((each) => !each.leaving)).toBe(true);
	});
});
