// Each strip is the same stretch of memory; `OTHER` cells belong to something else, which is
// why a vector cannot simply grow in place.
export const CELLS = 32;
const OTHER = new Set([3, 4]);
const START = 3;
const LIMIT = 10;

// The appended vector starts right before the foreign block, so it has no room to grow in place;
// the preallocated one is given its full length after that block.
const RESERVED_FROM = Math.max(...OTHER) + 1;

export interface Vector {
	length: number;
	// Where the appended vector starts in its strip.
	offset: number;
	// Elements copied so far by appending.
	copied: number;
	// The cells the appended vector has just moved out of.
	freed?: { from: number; length: number };
}

export interface Cell {
	state: 'other' | 'value' | 'copied' | 'new' | 'freed' | 'reserved' | 'empty';
	text: string;
}

export const initialVector = (): Vector => ({ length: START, offset: 0, copied: 0 });

// First run of `size` free cells that does not touch the vector's current cells,
// which stay occupied until the copy is finished.
function findRoom({ offset, length }: Vector, size: number): number | undefined {
	const taken = (index: number) => OTHER.has(index) || (index >= offset && index < offset + length);
	for (let from = 0; from + size <= CELLS; from++) {
		if (Array.from({ length: size }, (_, step) => from + step).every((index) => !taken(index))) return from;
	}
	return undefined;
}

export function canAppend(vector: Vector): boolean {
	return vector.length < LIMIT && findRoom(vector, vector.length + 1) !== undefined;
}

export function append(vector: Vector): Vector {
	const room = findRoom(vector, vector.length + 1);
	if (room === undefined) return vector;
	return {
		length: vector.length + 1,
		offset: room,
		copied: vector.copied + vector.length,
		freed: { from: vector.offset, length: vector.length },
	};
}

const strip = (cellAt: (index: number) => Cell) =>
	Array.from({ length: CELLS }, (_, index) => (OTHER.has(index) ? { state: 'other' as const, text: '' } : cellAt(index)));

export function appendStrip({ length, offset, freed }: Vector): Cell[] {
	return strip((index) => {
		const position = index - offset;
		if (position >= 0 && position < length) {
			const state = !freed ? 'value' : position === length - 1 ? 'new' : 'copied';
			return { state, text: String(position + 1) };
		}
		if (freed && index >= freed.from && index < freed.from + freed.length) return { state: 'freed', text: '' };
		return { state: 'empty', text: '' };
	});
}

export function preallocStrip({ length, freed }: Vector): Cell[] {
	return strip((index) => {
		const position = index - RESERVED_FROM;
		if (position >= 0 && position < length) {
			return { state: freed && position === length - 1 ? 'new' : 'value', text: String(position + 1) };
		}
		if (position >= length && position < LIMIT) return { state: 'reserved', text: '' };
		return { state: 'empty', text: '' };
	});
}
