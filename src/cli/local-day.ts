function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** Today on the person's own calendar, which can differ from the date in UTC. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}
