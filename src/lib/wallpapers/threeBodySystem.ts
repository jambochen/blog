// The motion of the three-body wallpaper, apart from how it is drawn. Lengths
// are in units of about one starting distance from the centre; every body has
// unit mass. Takes its randomness as an argument, so a test can fix it.

const STEP = 0.002;
// Keeps a close pass from flinging a body out at an unbounded speed.
const SOFTENING = 0.06;
// A body this many units out has left the corner: it fades away and another is thrown in.
// The bodies start about one unit from the centre, and the corner's radius is two units.
export const ESCAPE = 2.6;
// Inside ESCAPE, so a body thrown in is not taken for one that left.
export const ENTRY = 2.2;
const FADE_SECONDS = 1.5;
// Each body that leaves takes energy with it, so the two left behind orbit closer every time, down to a blur that flings out whatever comes near.
// A pair whose orbit is smaller than this is eased apart again, which is not physics but keeps three separate bodies on screen.
export const MIN_PAIR_AXIS = 0.3;
const LOOSEN_SECONDS = 2;

export interface Body {
	x: number;
	y: number;
	vx: number;
	vy: number;
	opacity: number;
	leaving: boolean;
}

export interface System {
	bodies: Body[];
	// The view follows the visible bodies, because a body that leaves pushes the others the opposite way.
	centre: [number, number];
}

type Random = () => number;

const mean = (group: Body[], key: 'x' | 'y' | 'vx' | 'vy') =>
	group.reduce((sum, body) => sum + body[key], 0) / group.length;

export function spawn(random: Random): System {
	const turn = random() * Math.PI * 2;
	const bodies = [0, 1, 2].map((index): Body => {
		const angle = turn + (index / 3) * Math.PI * 2 + (random() - 0.5) * 0.9;
		const radius = 0.7 + random() * 0.6;
		const speed = 0.45 + random() * 0.25;
		return {
			x: radius * Math.cos(angle),
			y: radius * Math.sin(angle),
			vx: -speed * Math.sin(angle),
			vy: speed * Math.cos(angle),
			opacity: 0,
			leaving: false,
		};
	});
	// Without this the system would start off-centre and drift before any body has left.
	for (const key of ['x', 'y', 'vx', 'vy'] as const) {
		const offset = mean(bodies, key);
		for (const body of bodies) body[key] -= offset;
	}
	return { bodies, centre: [0, 0] };
}

// Thrown from a random side towards the bodies that stayed, at a speed too low to pass straight through.
function thrownAt(stayed: Body[], random: Random): Body {
	const from = random() * Math.PI * 2;
	const aim = from + Math.PI + (random() - 0.5) * 0.8;
	const speed = 0.35 + random() * 0.35;
	return {
		x: mean(stayed, 'x') + ENTRY * Math.cos(from),
		y: mean(stayed, 'y') + ENTRY * Math.sin(from),
		vx: mean(stayed, 'vx') + speed * Math.cos(aim),
		vy: mean(stayed, 'vy') + speed * Math.sin(aim),
		opacity: 0,
		leaving: false,
	};
}

// The size of the pair's relative orbit, for two unit masses; undefined when the pair is not bound.
export function pairAxis(first: Body, second: Body): number | undefined {
	const distance = Math.hypot(first.x - second.x, first.y - second.y);
	const speed = Math.hypot(first.vx - second.vx, first.vy - second.vy);
	const energy = (speed * speed) / 2 - 2 / distance;
	return energy < 0 ? -1 / energy : undefined;
}

export function loosen(first: Body, second: Body, elapsed: number): void {
	const axis = pairAxis(first, second);
	if (axis === undefined || axis >= MIN_PAIR_AXIS) return;
	// Distances grow and speeds drop by the square root of that, which widens the orbit without changing its shape.
	const grow = Math.exp(elapsed / LOOSEN_SECONDS);
	for (const [key, factor] of [
		['x', grow],
		['y', grow],
		['vx', grow ** -0.5],
		['vy', grow ** -0.5],
	] as const) {
		const middle = (first[key] + second[key]) / 2;
		first[key] = middle + (first[key] - middle) * factor;
		second[key] = middle + (second[key] - middle) * factor;
	}
}

function accelerate(bodies: Body[], step: number): void {
	for (const body of bodies) {
		for (const other of bodies) {
			if (other === body) continue;
			const [dx, dy] = [other.x - body.x, other.y - body.y];
			const pull = step / (dx * dx + dy * dy + SOFTENING * SOFTENING) ** 1.5;
			body.vx += dx * pull;
			body.vy += dy * pull;
		}
	}
}

// Moves the bodies under each other's gravity for `time` units of simulated time.
export function advance({ bodies }: System, time: number): void {
	for (let done = 0; done < time; done += STEP) {
		// Leapfrog: half a kick, a full drift, half a kick. It keeps the energy steady over long runs.
		accelerate(bodies, STEP / 2);
		for (const body of bodies) {
			body.x += body.vx * STEP;
			body.y += body.vy * STEP;
		}
		accelerate(bodies, STEP / 2);
	}
}

// Fades out the bodies that have left and throws new ones in, over `elapsed` seconds of real time.
// Returns the system to go on with: a new one once fewer than two bodies stayed and all have faded.
export function exchange(system: System, elapsed: number, random: Random): System {
	const { bodies } = system;
	const weight = bodies.reduce((sum, body) => sum + body.opacity, 0);
	// Weighted by opacity, so the view glides as a body fades instead of jumping when it is replaced.
	if (weight > 0) {
		system.centre = [
			bodies.reduce((sum, body) => sum + body.x * body.opacity, 0) / weight,
			bodies.reduce((sum, body) => sum + body.y * body.opacity, 0) / weight,
		];
	}
	for (const body of bodies) {
		if (Math.hypot(body.x - system.centre[0], body.y - system.centre[1]) > ESCAPE) body.leaving = true;
		const change = (body.leaving ? -elapsed : elapsed) / FADE_SECONDS;
		body.opacity = Math.min(1, Math.max(0, body.opacity + change));
	}

	const stayed = bodies.filter((body) => !body.leaving);
	stayed.forEach((first, index) => {
		for (const second of stayed.slice(index + 1)) loosen(first, second, elapsed);
	});
	// One body alone has nothing to orbit, so the rest fade too and the system starts again.
	if (stayed.length < 2) {
		for (const body of bodies) body.leaving = true;
		return bodies.every((body) => body.opacity === 0) ? spawn(random) : system;
	}
	system.bodies = bodies.map((body) => (body.leaving && body.opacity === 0 ? thrownAt(stayed, random) : body));
	return system;
}
