import type { SceneFactory } from './scene';

// The side of one marching-squares cell, in px.
const CELL = 10;
// Feature sizes of the three noise maps, in px: the largest sets where land is, the smallest where ridges and rivers run.
const CONTINENT = 820;
const EROSION = 560;
const RIDGE = 400;
// Height above LAND is ground; above HIGH it is the hatched high ground.
const LAND = 0;
const HIGH = 0.3;
// How close to a valley line the ground is cut down into a river, in units of the ridge noise.
const RIVER = 0.09;
// One pass of the scan line, and the wait before the next, in seconds.
const SWEEP = 9;
const REST = 5;
// How far the afterglow trails behind the scan line, and in how many steps it fades.
const TRAIL = 260;
const TRAIL_STEPS = 13;
const RETICLE_GRID = 24;
const RETICLE_REST_MS = 2500;
const MARKERS_PER_SIDE = 2;
// Room a survey point needs beside it for its label, in px.
const LABEL_ROOM = 96;

type Point = [number, number];

// Drawn like Arknights: Endfield's map: flat landmasses with hatched high ground, outlined, with dashed routes between survey points.
export const terrain: SceneFactory = (theme) => {
	const accent = theme.dark ? '255, 226, 60' : '214, 150, 0';
	const seed = Math.random() * 1000;
	// Canvases of their own, so a frame costs two blits and the contours are traced only when the window changes.
	const base = document.createElement('canvas');
	const glow = document.createElement('canvas');
	let width = 0;
	let height = 0;
	let ratio = 1;
	let clock = 0;
	let pointer: { x: number; y: number; at: number } | undefined;
	// Heights sampled once per window size, one cell beyond each edge so outlines run off the canvas.
	let field = new Float32Array(0);
	let columns = 0;
	let rows = 0;

	// Perlin gradient noise, about -1 to 1. `channel` gives each map its own unrelated field.
	const gradient = (column: number, row: number, channel: number) => {
		const hash = Math.sin(column * 127.1 + row * 311.7 + channel * 74.7 + seed) * 43758.5453;
		return (hash - Math.floor(hash)) * Math.PI * 2;
	};
	const perlin = (x: number, y: number, channel: number) => {
		const [column, row] = [Math.floor(x), Math.floor(y)];
		const [fx, fy] = [x - column, y - row];
		const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
		const corner = (dx: number, dy: number) => {
			const angle = gradient(column + dx, row + dy, channel);
			return Math.cos(angle) * (fx - dx) + Math.sin(angle) * (fy - dy);
		};
		const [u, v] = [fade(fx), fade(fy)];
		const top = corner(0, 0) * (1 - u) + corner(1, 0) * u;
		const bottom = corner(0, 1) * (1 - u) + corner(1, 1) * u;
		return (top * (1 - v) + bottom * v) * 1.5;
	};
	const octaves = (x: number, y: number, size: number, channel: number) => {
		let [sum, weight, scale] = [0, 0, 1];
		for (let octave = 0; octave < 4; octave++) {
			sum += perlin((x / size) * scale, (y / size) * scale, channel + octave * 10) / scale;
			weight += 1 / scale;
			scale *= 2;
		}
		return sum / weight;
	};
	const clamp = (value: number) => Math.min(1, Math.max(0, value));

	// Minecraft's overworld recipe, flattened to a map: continentalness places the land, erosion decides how rugged it
	// is, and a folded "weirdness" noise raises ridges where it peaks and cuts rivers along its zero line.
	const elevation = (x: number, y: number) => {
		const continent = octaves(x, y, CONTINENT, 0) * 1.6 + 0.12;
		const erosion = octaves(x, y, EROSION, 1) * 1.6;
		const weirdness = octaves(x, y, RIDGE, 2) * 1.8;
		const peaks = 1 - Math.abs(3 * Math.abs(weirdness) - 2);

		const inland = clamp(continent / 0.35);
		const rugged = inland * clamp(0.65 - erosion);
		const ground = continent < 0 ? continent : 0.06 + continent * 0.35 + Math.max(0, peaks) * 0.55 * rugged;
		const river = inland * clamp(1 - Math.abs(weirdness) / RIVER);
		return ground - river * (ground + 0.3);
	};

	// Marching squares: the area at or above `level`, and the line along its edge.
	const contour = (level: number) => {
		const area = new Path2D();
		const outline = new Path2D();
		for (let row = 0; row < rows - 1; row++) {
			for (let column = 0; column < columns - 1; column++) {
				const [x, y] = [(column - 1) * CELL, (row - 1) * CELL];
				// The `!` is safe: the loop bounds keep every index inside the sampled grid.
				const at = (dx: number, dy: number) => field[(row + dy) * columns + column + dx]!;
				const corners: [number, number, number][] = [
					[x, y, at(0, 0)],
					[x + CELL, y, at(1, 0)],
					[x + CELL, y + CELL, at(1, 1)],
					[x, y + CELL, at(0, 1)],
				];
				const inside: Point[] = [];
				const crossings: Point[] = [];
				corners.forEach(([cx, cy, cv], index) => {
					// The `!` is safe: the index wraps within the four corners.
					const [nx, ny, nv] = corners[(index + 1) % 4]!;
					if (cv >= level) inside.push([cx, cy]);
					if (cv >= level !== nv >= level) {
						const t = (level - cv) / (nv - cv);
						const crossing: Point = [cx + (nx - cx) * t, cy + (ny - cy) * t];
						inside.push(crossing);
						crossings.push(crossing);
					}
				});
				inside.forEach(([px, py], index) => (index === 0 ? area.moveTo(px, py) : area.lineTo(px, py)));
				if (inside.length > 0) area.closePath();
				for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
					// The `!` is safe: the loop bound keeps both indices inside the array.
					outline.moveTo(...crossings[pair]!);
					outline.lineTo(...crossings[pair + 1]!);
				}
			}
		}
		return { area, outline };
	};

	// Survey points and their routes stay in the margins: a label or a dashed line behind a heading reads as part of it.
	// Each side's points come back as their own route, so no route crosses the text.
	const surveyRoutes = (): Point[][] => {
		const margin = (width - theme.textWidth) / 2;
		if (margin < LABEL_ROOM + 32) return [];
		return [16, width - margin + 16].map((left) => {
			const points: Point[] = [];
			for (let attempt = 0; attempt < 200 && points.length < MARKERS_PER_SIDE; attempt++) {
				const point: Point = [left + Math.random() * (margin - LABEL_ROOM - 16), Math.random() * height];
				const level = elevation(...point);
				const apart = points.every(([, y]) => Math.abs(y - point[1]) > height * 0.3);
				if (level > LAND + 0.03 && level < HIGH - 0.03 && apart) points.push(point);
			}
			return points.sort((a, b) => a[1] - b[1]);
		});
	};

	const diamond = (context: CanvasRenderingContext2D, [x, y]: Point, size: number) => {
		context.beginPath();
		context.moveTo(x, y - size);
		context.lineTo(x + size, y);
		context.lineTo(x, y + size);
		context.lineTo(x - size, y);
		context.closePath();
	};

	const render = () => {
		columns = Math.ceil(width / CELL) + 3;
		rows = Math.ceil(height / CELL) + 3;
		field = new Float32Array(columns * rows);
		for (let row = 0; row < rows; row++) {
			for (let column = 0; column < columns; column++) {
				field[row * columns + column] = elevation((column - 1) * CELL, (row - 1) * CELL);
			}
		}
		const land = contour(LAND);
		const high = contour(HIGH);
		const routes = surveyRoutes();
		const points = routes.flat();

		for (const canvas of [base, glow]) {
			canvas.width = width * ratio;
			canvas.height = height * ratio;
		}
		// The `!` is safe: a 2D context is only refused when the canvas already has another kind, and these two are new.
		const paper = base.getContext('2d')!;
		paper.setTransform(ratio, 0, 0, ratio, 0, 0);
		paper.fillStyle = paper.strokeStyle = theme.ink;
		paper.lineWidth = 1;

		paper.globalAlpha = 0.035;
		paper.fill(land.area);

		paper.save();
		paper.clip(high.area);
		paper.globalAlpha = 0.1;
		paper.beginPath();
		for (let offset = -height; offset < width; offset += 7) {
			paper.moveTo(offset, 0);
			paper.lineTo(offset + height, height);
		}
		paper.stroke();
		paper.restore();

		paper.globalAlpha = 0.2;
		paper.stroke(land.outline);
		paper.globalAlpha = 0.13;
		paper.stroke(high.outline);

		paper.globalAlpha = 0.28;
		paper.setLineDash([3, 6]);
		paper.beginPath();
		for (const route of routes) {
			route.forEach(([x, y], index) => (index === 0 ? paper.moveTo(x, y) : paper.lineTo(x, y)));
		}
		paper.stroke();
		paper.setLineDash([]);

		paper.font = `500 10px ${theme.font}`;
		points.forEach((point, index) => {
			paper.globalAlpha = 0.45;
			diamond(paper, point, 5);
			paper.stroke();
			paper.globalAlpha = 0.4;
			const metres = Math.round(elevation(...point) * 1000);
			paper.fillText(`PT-${String(index + 1).padStart(2, '0')}  ${metres} m`, point[0] + 10, point[1] + 3.5);
		});

		// The `!` is safe for the same reason as above.
		const light = glow.getContext('2d')!;
		light.setTransform(ratio, 0, 0, ratio, 0, 0);
		light.strokeStyle = light.fillStyle = `rgb(${accent})`;
		light.lineWidth = 1.4;
		light.stroke(land.outline);
		light.globalAlpha = 0.6;
		light.stroke(high.outline);
		light.globalAlpha = 1;
		for (const point of points) {
			diamond(light, point, 5);
			light.fill();
		}
	};

	return {
		resize(nextWidth, nextHeight) {
			[width, height, ratio] = [nextWidth, nextHeight, devicePixelRatio || 1];
			render();
		},
		frame(context, elapsed) {
			clock += elapsed;
			context.clearRect(0, 0, width, height);
			context.drawImage(base, 0, 0, width, height);

			const phase = clock % (SWEEP + REST);
			if (phase < SWEEP) {
				const scan = (phase / SWEEP) * (width + TRAIL);
				const step = TRAIL / TRAIL_STEPS;
				for (let index = 0; index < TRAIL_STEPS; index++) {
					const left = scan - (index + 1) * step;
					if (left + step < 0 || left > width) continue;
					context.globalAlpha = (1 - index / TRAIL_STEPS) ** 2 * 0.85;
					context.drawImage(glow, left * ratio, 0, step * ratio, height * ratio, left, 0, step, height);
				}
				context.globalAlpha = 1;
				if (scan < width) {
					context.fillStyle = `rgba(${accent}, 0.45)`;
					context.fillRect(scan, 0, 1, height);
				}
			}

			const idle = pointer ? performance.now() - pointer.at : Infinity;
			if (pointer && idle < RETICLE_REST_MS) {
				const x = Math.floor(pointer.x / RETICLE_GRID) * RETICLE_GRID;
				const y = Math.floor(pointer.y / RETICLE_GRID) * RETICLE_GRID;
				const [size, arm] = [RETICLE_GRID * 2, 6];
				// Fades over the last part of the rest, so the box does not blink out.
				context.globalAlpha = Math.min(1, (RETICLE_REST_MS - idle) / 600) * 0.5;
				context.strokeStyle = context.fillStyle = theme.ink;
				context.lineWidth = 1;
				context.beginPath();
				for (const [cx, cy, dx, dy] of [
					[x, y, 1, 1],
					[x + size, y, -1, 1],
					[x + size, y + size, -1, -1],
					[x, y + size, 1, -1],
				] as const) {
					context.moveTo(cx + dx * arm, cy);
					context.lineTo(cx, cy);
					context.lineTo(cx, cy + dy * arm);
				}
				context.stroke();
				context.font = `500 10px ${theme.font}`;
				const cell = (value: number) => String(value / RETICLE_GRID).padStart(3, '0');
				context.fillText(`${cell(x)}  ${cell(y)}`, x, y + size + 13);
				context.globalAlpha = 1;
			}
			return true;
		},
		move(x, y) {
			pointer = { x, y, at: performance.now() };
		},
	};
};
