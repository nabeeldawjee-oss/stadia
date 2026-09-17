export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function roundRobinMatchCount(teams: number, legs = 1): number {
  return (teams * (teams - 1)) / 2 * legs;
}

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function bracketRounds(size: number): number {
  return Math.log2(size);
}

export function matchesInRound(bracketSize: number, round: number): number {
  return bracketSize / Math.pow(2, round);
}

export function nextPosition(currentPosition: number): number {
  return Math.ceil(currentPosition / 2);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function overlapsTimeRange(
  startA: Date, endA: Date,
  startB: Date, endB: Date
): boolean {
  return startA < endB && endA > startB;
}

export function formatScore(home: number | null, away: number | null): string {
  if (home === null || away === null) return "– : –";
  return `${home} – ${away}`;
}
