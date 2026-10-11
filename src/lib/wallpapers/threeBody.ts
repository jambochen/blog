import type { SceneFactory } from './scene';

// The system lives in the bottom right corner, clear of the text. Its radius follows the side margin between these bounds, in px.
const MIN_RADIUS = 48;
const MAX_RADIUS = 150;
const EDGE_GAP = 28;
const STEP = 0.002;
// Simulated time per second of real time.
const PACE = 0.5;
// Keeps a close pass from flinging a body out at an unbounded speed.
const SOFTENING = 0.06;
const TRAIL_LENGTH = 900;
// A body this many units out has left the corner: it fades away and another is thrown in.
// The bodies start about one unit from the centre, and the corner's radius is two units.
const ESCAPE = 2.6;
// Inside ESCAPE, so a body thrown in is not taken for one that left.
const ENTRY = 2.2;
const FADE_SECONDS = 1.5;
// Each body that leaves takes energy with it, so the two left behind orbit closer every time, down to a blur that flings out whatever comes near.
// A pair whose orbit is smaller than this is eased apart again, which is not physics but keeps three separate bodies on screen.
const MIN_PAIR_AXIS = 0.3;
const LOOSEN_SECONDS = 2;
const FADE_BANDS = 12;

interface Body {
	x: number;
	y: number;
	vx: number;
	vy: number;
	trail: [number, number][];
	opacity: number;
	leaving: boolean;
}

// The Three-Body Problem: three equal masses under gravity, whose paths never repeat.
export const threeBody: SceneFactory = (theme) => {
	let bodies: Body[] = [];
	let width = 0;
	let height = 0;
	// The view follows the visible bodies, because a body that leaves pushes the others the opposite way.
	let centre: [number, number] = [0, 0];

	const reset = () => {
		const turn = Math.random() * Math.PI * 2;
		bodies = [0, 1, 2].map((index) => {
			const angle = turn + (index / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
			const radius = 0.7 + Math.random() * 0.6;
			const speed = 0.45 + Math.random() * 0.25;
			return {
				x: radius * Math.cos(angle),
				y: radius * Math.sin(angle),
				vx: -speed * Math.sin(angle),
				vy: speed * Math.cos(angle),
				trail: [],
				opacity: 0,
				leaving: false,
			};
		});
		// Without this the system would start off-centre and drift before any body has left.
		for (const key of ['x', 'y', 'vx', 'vy'] as const) {
			const mean = bodies.reduce((sum, body) => sum + body[key], 0) / bodies.length;
			for (const body of bodies) body[key] -= mean;
		}
		centre = [0, 0];
	};

	const mean = (group: Body[], key: 'x' | 'y' | 'vx' | 'vy') =>
		group.reduce((sum, body) => sum + body[key], 0) / group.length;

	// Thrown from a random side towards the bodies that stayed, at a speed too low to pass straight through.
	const thrownAt = (stayed: Body[]): Body => {
		const from = Math.random() * Math.PI * 2;
		const aim = from + Math.PI + (Math.random() - 0.5) * 0.8;
		const speed = 0.35 + Math.random() * 0.35;
		return {
			x: mean(stayed, 'x') + ENTRY * Math.cos(from),
			y: mean(stayed, 'y') + ENTRY * Math.sin(from),
			vx: mean(stayed, 'vx') + speed * Math.cos(aim),
			vy: mean(stayed, 'vy') + speed * Math.sin(aim),
			trail: [],
			opacity: 0,
			leaving: false,
		};
	};

	const loosen = (first: Body, second: Body, elapsed: number) => {
		const distance = Math.hypot(first.x - second.x, first.y - second.y);
		const speed = Math.hypot(first.vx - second.vx, first.vy - second.vy);
		// The energy of the pair's relative orbit, for two unit masses; an orbit's size is -1 over it.
		const energy = (speed * speed) / 2 - 2 / distance;
		if (energy >= 0 || -1 / energy >= MIN_PAIR_AXIS) return;
		// Distances grow and speeds drop by the square root of that, which widens the orbit without changing its shape.
		const grow = Math.exp(elapsed / LOOSEN_SECONDS);
		for (const [key, factor] of [['x', grow], ['y', grow], ['vx', grow ** -0.5], ['vy', grow ** -0.5]] as const) {
			const middle = (first[key] + second[key]) / 2;
			first[key] = middle + (first[key] - middle) * factor;
			second[key] = middle + (second[key] - middle) * factor;
		}
	};

	const exchange = (elapsed: number) => {
		const weight = bodies.reduce((sum, body) => sum + body.opacity, 0);
		// Weighted by opacity, so the view glides as a body fades instead of jumping when it is replaced.
		if (weight > 0) {
			centre = [
				bodies.reduce((sum, body) => sum + body.x * body.opacity, 0) / weight,
				bodies.reduce((sum, body) => sum + body.y * body.opacity, 0) / weight,
			];
		}
		for (const body of bodies) {
			if (Math.hypot(body.x - centre[0], body.y - centre[1]) > ESCAPE) body.leaving = true;
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
			if (bodies.every((body) => body.opacity === 0)) reset();
			return;
		}
		bodies = bodies.map((body) => (body.leaving && body.opacity === 0 ? thrownAt(stayed) : body));
	};

	const accelerate = (step: number) => {
		for (const body of bodies) {
			for (const other of bodies) {
				if (other === body) continue;
				const [dx, dy] = [other.x - body.x, other.y - body.y];
				const pull = step / (dx * dx + dy * dy + SOFTENING * SOFTENING) ** 1.5;
				body.vx += dx * pull;
				body.vy += dy * pull;
			}
		}
	};

	return {
		resize(nextWidth, nextHeight) {
			[width, height] = [nextWidth, nextHeight];
			if (bodies.length === 0) reset();
		},
		frame(context, elapsed) {
			for (let time = 0; time < elapsed * PACE; time += STEP) {
				// Leapfrog: half a kick, a full drift, half a kick. It keeps the energy steady over long runs.
				accelerate(STEP / 2);
				for (const body of bodies) {
					body.x += body.vx * STEP;
					body.y += body.vy * STEP;
				}
				accelerate(STEP / 2);
			}
			exchange(elapsed);

			const margin = (width - theme.textWidth) / 2;
			const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, margin / 2 - EDGE_GAP / 2));
			const unit = radius / 2;
			const [centreX, centreY] = [width - EDGE_GAP - radius, height - EDGE_GAP - radius];
			const place = (x: number, y: number): [number, number] => [
				centreX + (x - centre[0]) * unit,
				centreY + (y - centre[1]) * unit,
			];

			context.clearRect(0, 0, width, height);
			context.strokeStyle = context.fillStyle = theme.ink;
			context.lineWidth = 1;
			for (const body of bodies) {
				body.trail.push([body.x, body.y]);
				if (body.trail.length > TRAIL_LENGTH) body.trail.shift();

				// Stroked in bands of equal opacity: one stroke per segment would be several thousand a frame.
				const band = Math.ceil(body.trail.length / FADE_BANDS);
				for (let start = 0; start < body.trail.length - 1; start += band) {
					context.globalAlpha = ((start + band) / body.trail.length) * 0.3 * body.opacity;
					context.beginPath();
					body.trail.slice(start, start + band + 1).forEach(([x, y], index) => {
						if (index === 0) context.moveTo(...place(x, y));
						else context.lineTo(...place(x, y));
					});
					context.stroke();
				}
				context.globalAlpha = 0.55 * body.opacity;
				context.beginPath();
				context.arc(...place(body.x, body.y), 2.5, 0, Math.PI * 2);
				context.fill();
			}
			context.globalAlpha = 1;
			return true;
		},
	};
};
