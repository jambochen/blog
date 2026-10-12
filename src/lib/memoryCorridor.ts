type Axis = 'x' | 'y' | 'z';

interface Line {
	axis: Axis;
	// The two coordinates the line does not run along, in the order x, y, z with its own axis left out.
	a: number;
	b: number;
	from: number;
	to: number;
	glow: number;
}

interface Speck {
	x: number;
	y: number;
	z: number;
	glow: number;
}

type Point = [x: number, y: number, z: number];

const HALF_WIDTH = 7;
const HALF_HEIGHT = 4;
const DEPTH = 12;
const NEAR = 0.15;
// The fraction of the height where the lines converge, a little above the middle as in the game.
const HORIZON = 0.42;
const CRUISE = 0.25;
const RUSH = 6;

const between = (low: number, high: number) => low + Math.random() * (high - low);
const wrap = (value: number, period: number) => ((value % period) + period) % period;

// Zero at the camera and at the far end, so a line that wraps from one to the other is not seen to jump.
function visibility(z: number) {
	const near = Math.min(Math.max((z - NEAR) / 0.8, 0), 1);
	const far = Math.min(Math.max((DEPTH - z) / 4, 0), 1);
	return near * far;
}

function lines(): Line[] {
	const upright = Array.from({ length: 70 }, (): Line => {
		const centre = between(-HALF_HEIGHT, HALF_HEIGHT);
		const half = between(2, 9);
		return {
			axis: 'y',
			a: between(-HALF_WIDTH, HALF_WIDTH),
			b: between(0, DEPTH),
			from: centre - half,
			to: centre + half,
			glow: between(0.3, 1),
		};
	});
	const level = Array.from({ length: 18 }, (): Line => {
		const centre = between(-HALF_WIDTH, HALF_WIDTH);
		const half = between(3, 12);
		return {
			axis: 'x',
			a: between(-1.2, 0.6),
			b: between(0, DEPTH),
			from: centre - half,
			to: centre + half,
			glow: between(0.3, 1),
		};
	});
	const receding = Array.from({ length: 40 }, (): Line => {
		const from = between(0, DEPTH);
		return {
			axis: 'z',
			a: between(-HALF_WIDTH, HALF_WIDTH),
			b: between(-HALF_HEIGHT, HALF_HEIGHT),
			from,
			to: from + between(3, 8),
			glow: between(0.3, 1),
		};
	});
	return [...upright, ...level, ...receding];
}

export function startCorridor(canvas: HTMLCanvasElement, still: boolean) {
	const context = canvas.getContext('2d');
	if (!context) return { rush: () => {} };

	const scene = lines();
	const specks = Array.from(
		{ length: 40 },
		(): Speck => ({
			x: between(-HALF_WIDTH, HALF_WIDTH),
			y: between(-HALF_HEIGHT, HALF_HEIGHT),
			z: between(0, DEPTH),
			glow: between(0.2, 0.6),
		}),
	);

	let width = 0;
	let height = 0;
	let focal = 0;
	let travel = 0;
	let surge = still ? 0 : 1;
	let yaw = 0;
	let pitch = 0;
	let wantedYaw = 0;
	let wantedPitch = 0;
	let running = false;
	let last = 0;

	const turned = ([x, y, z]: Point): Point => {
		const turnedX = x * Math.cos(yaw) - z * Math.sin(yaw);
		const depth = x * Math.sin(yaw) + z * Math.cos(yaw);
		return [turnedX, y * Math.cos(pitch) - depth * Math.sin(pitch), y * Math.sin(pitch) + depth * Math.cos(pitch)];
	};

	const onScreen = ([x, y, z]: Point) => [width / 2 + (focal * x) / z, height * HORIZON + (focal * y) / z] as const;

	const stroke = (start: Point, end: Point, alphas: [number, number, number]) => {
		let [p, q] = [turned(start), turned(end)];
		if (p[2] < NEAR && q[2] < NEAR) return;
		// A point behind the camera projects to the wrong side of the screen, so the line is cut at the near plane.
		if (p[2] < NEAR || q[2] < NEAR) {
			const [behind, ahead] = p[2] < NEAR ? [p, q] : [q, p];
			const t = (NEAR - behind[2]) / (ahead[2] - behind[2]);
			const cut: Point = [behind[0] + (ahead[0] - behind[0]) * t, behind[1] + (ahead[1] - behind[1]) * t, NEAR];
			[p, q] = p[2] < NEAR ? [cut, q] : [p, cut];
		}
		const [x0, y0] = onScreen(p);
		const [x1, y1] = onScreen(q);
		const core = Math.min(6, (0.006 * focal) / ((p[2] + q[2]) / 2)) + 0.5;
		const boost = 1 + 1.5 * surge;

		// A wide faint pass under a thin bright one stands in for a blur, which costs far more per frame on a canvas.
		for (const [lineWidth, strength] of [
			[core * 6, 0.15],
			[core, 1],
		]) {
			const gradient = context.createLinearGradient(x0, y0, x1, y1);
			alphas.forEach((alpha, stop) =>
				gradient.addColorStop(stop / 2, `rgb(255 255 255 / ${Math.min(alpha * strength * boost, 1)})`),
			);
			context.strokeStyle = gradient;
			context.lineWidth = lineWidth;
			context.beginPath();
			context.moveTo(x0, y0);
			context.lineTo(x1, y1);
			context.stroke();
		}
	};

	const draw = () => {
		context.clearRect(0, 0, width, height);

		for (const line of scene) {
			if (line.axis === 'z') {
				const length = line.to - line.from;
				// The period is longer than the corridor by the line's own length, so the line has passed the camera whole before it returns at the far end.
				const start = wrap(line.from - travel + length, DEPTH + length) - length;
				const ends = [start, start + length / 2, start + length].map((z) => visibility(z) * line.glow);
				stroke([line.a, line.b, start], [line.a, line.b, start + length], ends as [number, number, number]);
				continue;
			}
			const z = wrap(line.b - travel, DEPTH);
			const alphas: [number, number, number] = [0, visibility(z) * line.glow, 0];
			if (line.axis === 'y') stroke([line.a, line.from, z], [line.a, line.to, z], alphas);
			else stroke([line.from, line.a, z], [line.to, line.a, z], alphas);
		}

		for (const speck of specks) {
			const point = turned([speck.x, speck.y, wrap(speck.z - travel, DEPTH)]);
			if (point[2] < NEAR) continue;
			const [x, y] = onScreen(point);
			const radius = Math.min(22, (0.03 * focal) / point[2]);
			const alpha = visibility(point[2]) * speck.glow;
			const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
			gradient.addColorStop(0, `rgb(255 255 255 / ${alpha})`);
			gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
			context.fillStyle = gradient;
			context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
		}
	};

	const frame = (now: number) => {
		const elapsed = Math.min((now - last) / 1000, 0.05);
		last = now;
		travel += elapsed * (CRUISE + RUSH * surge);
		surge *= Math.exp(-elapsed * 2.2);
		yaw += (wantedYaw - yaw) * Math.min(elapsed * 3, 1);
		pitch += (wantedPitch - pitch) * Math.min(elapsed * 3, 1);
		draw();
		running = !still && !document.hidden;
		if (running) requestAnimationFrame(frame);
	};

	const wake = () => {
		if (running) return;
		running = true;
		last = performance.now();
		requestAnimationFrame(frame);
	};

	const resize = () => {
		const ratio = devicePixelRatio || 1;
		width = innerWidth;
		height = innerHeight;
		focal = 0.9 * Math.max(width, height);
		canvas.width = width * ratio;
		canvas.height = height * ratio;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		wake();
	};

	addEventListener('resize', resize);
	document.addEventListener('visibilitychange', wake);
	if (!still) {
		addEventListener(
			'pointermove',
			(event) => {
				wantedYaw = (event.clientX / width - 0.5) * 0.24;
				wantedPitch = (event.clientY / height - 0.5) * 0.16;
			},
			{ passive: true },
		);
	}
	resize();

	return {
		rush: () => {
			if (!still) surge = 1.5;
		},
	};
}
