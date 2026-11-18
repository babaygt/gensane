/**
 * CommonMark spec examples that gensane does not pass, grouped by reason. The conformance
 * test fails if a listed example starts passing, so this list can only shrink.
 */
export const KNOWN_GAPS = {
  /** Not supported on purpose: code needs ``` fences. */
  indentedCode: [
    1, 2, 3, 5, 6, 7, 8, 18, 36, 48, 69, 107, 110, 111, 112, 114, 115, 116, 117, 118, 134, 183, 184,
    191, 211, 225, 231, 236, 252, 253, 254, 257, 264, 270, 271, 272, 273, 274, 278, 286, 287, 288,
    289, 290, 309, 313,
  ],
  /** Not supported on purpose: headings use #. */
  setextHeadings: [
    59, 80, 81, 82, 83, 84, 85, 86, 89, 90, 91, 95, 96, 100, 102, 103, 141, 215, 300,
  ],
  /** A tab that only partly fills the indentation of a nested list. */
  tabsInNestedLists: [9],
} as const;
