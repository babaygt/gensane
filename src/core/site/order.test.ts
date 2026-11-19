import { describe, expect, it } from "vitest";
import { compareDates, compareOrder, compareStrings, compareText } from "./order.ts";

const date = (year: number, month: number, day?: number, time?: string) => ({
  text: "",
  year,
  month,
  ...(day === undefined ? {} : { day }),
  ...(time === undefined ? {} : { time }),
});

describe("orders", () => {
  it("compares strings, and equal strings are equal", () => {
    expect([compareStrings("a", "b"), compareStrings("b", "a"), compareStrings("a", "a")]).toEqual([
      -1, 1, 0,
    ]);
  });

  it("compares text without caring about capital letters first", () => {
    expect(compareText("apple", "Banana")).toBeLessThan(0);
    expect(compareText("B", "b")).toBeLessThan(0);
    expect(compareText("same", "same")).toBe(0);
  });

  it.each([
    [date(2025, 12, 31), date(2026, 1, 1)],
    [date(2026, 1), date(2026, 2)],
    [date(2026, 1), date(2026, 1, 1)],
    [date(2026, 1, 1), date(2026, 1, 2)],
    [date(2026, 1, 1, "09:00:00Z"), date(2026, 1, 1, "18:00:00Z")],
  ])("puts %j before %j", (earlier, later) => {
    expect(compareDates(earlier, later)).toBeLessThan(0);
    expect(compareDates(later, earlier)).toBeGreaterThan(0);
  });

  it("finds two equal dates equal", () => {
    expect(compareDates(date(2026, 1, 1, "09:00:00Z"), date(2026, 1, 1, "09:00:00Z"))).toBe(0);
  });

  it("puts entries with an order first, lowest first", () => {
    const orders = [undefined, 2, undefined, 1];
    expect(orders.toSorted(compareOrder)).toEqual([1, 2, undefined, undefined]);
    expect(compareOrder(undefined, undefined)).toBe(0);
  });
});
