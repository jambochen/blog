// At most one decimal, and none when it would be zero: 4.66 is "4.7", 10 is "10".
export function oneDecimal(value: number): string {
	return String(Number(value.toFixed(1)));
}
