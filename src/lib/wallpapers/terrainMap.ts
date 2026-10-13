// The shape of the terrain wallpaper, apart from how it is drawn: heights, the
// lines between levels and where the survey points go. Takes its randomness as
// arguments, so one seed always gives one map.

export type Point = [number, number];

// Feature sizes of the three noise maps, in px: the largest sets where land is, the smallest where ridges and rivers run.
const CONTINENT = 820;
const EROSION = 560;
const RIDGE = 400;
// Height above LAND is ground. Survey points stay below HIGH, where the contour lines are still far enough apart for a label.
export const LAND = 0;
export const HIGH = 0.3;
// The height between two contour lines; every INDEX_EVERY-th line is an index contour, drawn heavier and numbered.
export const INTERVAL = 0.05;
export const INDEX_EVERY = 5;
// The least distance between two contour numbers, in px.
const LABEL_SPACING = 190;
// How close to a valley line the ground is cut down into a river, in units of the ridge noise.
const RIVER = 0.09;
const MARKERS_PER_SIDE = 2;
// Room a survey point needs beside it for its label, in px.
const LABEL_ROOM = 96;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

// Minecraft's overworld recipe, flattened to a map: continentalness places the land, erosion decides how rugged it
// is, and a folded "weirdness" noise raises ridges where it peaks and cuts rivers along its zero line.
export function elevationOf(seed: number): (x: number, y: number) => number {
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

	return (x, y) => {
		const continent = octaves(x, y, CONTINENT, 0) * 1.6 + 0.12;
		const erosion = octaves(x, y, EROSION, 1) * 1.6;
		const weirdness = octaves(x, y, RIDGE, 2) * 1.8;
		const peaks = 1 - Math.abs(3 * Math.abs(weirdness) - 2);

		const inland = clamp(continent / 0.35);
		const rugged = inland * clamp(0.65 - erosion);
		// Both branches meet at zero on the shore: a step there would be traced as a staircase.
		const ground = continent < 0 ? continent : continent * 0.35 + Math.max(0, peaks) * 0.55 * rugged;
		const river = inland * clamp(1 - Math.abs(weirdness) / RIVER);
		return ground - river * (ground + 0.3);
	};
}

// Heights sampled on a grid of `columns` by `rows`, row after row.
export interface Field {
	heights: ArrayLike<number>;
	columns: number;
	rows: number;
}

export interface Contour {
	// One polygon for each cell that reaches the level: the part of the cell at or above it.
	areas: Point[][];
	// The line along the edge of that area, cell by cell.
	edges: [Point, Point][];
}

// Marching squares over a field whose cells are `cell` wide, with the grid's first sample at `origin`.
export function contourOf({ heights, columns, rows }: Field, level: number, cell: number, origin: Point): Contour {
	const areas: Point[][] = [];
	const edges: [Point, Point][] = [];
	for (let row = 0; row < rows - 1; row++) {
		for (let column = 0; column < columns - 1; column++) {
			const [x, y] = [origin[0] + column * cell, origin[1] + row * cell];
			// The `!` is safe: the loop bounds keep every index inside the sampled grid.
			const at = (dx: number, dy: number) => heights[(row + dy) * columns + column + dx]!;
			const corners: [number, number, number][] = [
				[x, y, at(0, 0)],
				[x + cell, y, at(1, 0)],
				[x + cell, y + cell, at(1, 1)],
				[x, y + cell, at(0, 1)],
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
			if (inside.length > 0) areas.push(inside);
			for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
				// The `!` is safe: the loop bound keeps both indices inside the array.
				edges.push([crossings[pair]!, crossings[pair + 1]!]);
			}
		}
	}
	return { areas, edges };
}

// Survey points and their routes stay in the margins: a label or a dashed line behind a heading reads as part of it.
// Each side's points come back as their own route, so no route crosses the text.
export function surveyRoutes(
	{ width, height, margin }: { width: number; height: number; margin: number },
	elevation: (x: number, y: number) => number,
	random: () => number,
): Point[][] {
	if (margin < LABEL_ROOM + 32) return [];
	return [16, width - margin + 16].map((left) => {
		const points: Point[] = [];
		for (let attempt = 0; attempt < 200 && points.length < MARKERS_PER_SIDE; attempt++) {
			const point: Point = [left + random() * (margin - LABEL_ROOM - 16), random() * height];
			const level = elevation(...point);
			const apart = points.every(([, y]) => Math.abs(y - point[1]) > height * 0.3);
			// On plain ground, clear of the shore and of the hatching.
			if (level > LAND + 0.03 && level < HIGH - 0.03 && apart) points.push(point);
		}
		return points.sort((a, b) => a[1] - b[1]);
	});
}

export interface ContourLabel {
	at: Point;
	// The direction of the line there, in radians, turned so the number is never upside down.
	angle: number;
	level: number;
}

// Where the index contours get their numbers. Like the survey points they stay in the margins, clear of the text,
// and apart from each other and from the points in `taken`, so a number reads as part of its line.
export function contourLabels(
	lines: { level: number; edges: [Point, Point][] }[],
	{ width, height, margin }: { width: number; height: number; margin: number },
	taken: Point[] = [],
): ContourLabel[] {
	const inset = 28;
	const near = (a: Point, b: Point, reach: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) < reach;
	const labels: ContourLabel[] = [];
	for (const { level, edges } of lines) {
		for (const [from, to] of edges) {
			const at: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
			const beside = (at[0] > inset && at[0] < margin - inset) || (at[0] > width - margin + inset && at[0] < width - inset);
			if (!beside || at[1] < inset || at[1] > height - inset) continue;
			if (labels.some((label) => near(label.at, at, LABEL_SPACING))) continue;
			// A survey point's label runs to its right, so the room kept clear is centred there.
			if (taken.some(([x, y]) => near([x + LABEL_ROOM / 2, y], at, LABEL_ROOM))) continue;
			let angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
			if (angle > Math.PI / 2) angle -= Math.PI;
			if (angle <= -Math.PI / 2) angle += Math.PI;
			labels.push({ at, angle, level });
		}
	}
	return labels;
}
