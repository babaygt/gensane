/**
 * The number of single-character edits between two words. Swapping two neighbouring letters counts
 * as one edit, because that is the most common typo (`titel` for `title`).
 */
export function editDistance(first: string, second: string): number {
  const rows: number[][] = [];
  for (let row = 0; row <= first.length; row++) {
    rows.push([
      row,
      ...Array.from({ length: second.length }, (_, column) => (row === 0 ? column + 1 : 0)),
    ]);
  }
  const at = (row: number, column: number): number => rows[row]?.[column] ?? 0;

  for (let row = 1; row <= first.length; row++) {
    for (let column = 1; column <= second.length; column++) {
      const same = first[row - 1] === second[column - 1];
      let best = Math.min(
        at(row - 1, column) + 1,
        at(row, column - 1) + 1,
        at(row - 1, column - 1) + (same ? 0 : 1),
      );
      const swapped =
        row > 1 &&
        column > 1 &&
        first[row - 1] === second[column - 2] &&
        first[row - 2] === second[column - 1];
      if (swapped) best = Math.min(best, at(row - 2, column - 2) + 1);
      const cells = rows[row];
      if (cells !== undefined) cells[column] = best;
    }
  }
  return at(first.length, second.length);
}

/** The candidate that `word` is most likely a typo of, if any is close enough. */
export function closestMatch(word: string, candidates: readonly string[]): string | undefined {
  const lowerWord = word.toLowerCase();
  let closest: string | undefined;
  let closestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(lowerWord, candidate.toLowerCase());
    const allowed = Math.max(1, Math.floor(Math.max(word.length, candidate.length) / 3));
    if (distance <= allowed && distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }
  return closest;
}
