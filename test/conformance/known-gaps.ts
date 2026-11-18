/**
 * CommonMark spec examples that gensane does not pass yet, grouped by reason. The conformance
 * test fails if a listed example starts passing, so this list can only shrink.
 */
export const KNOWN_GAPS = {
  /** Not supported on purpose: code needs ``` fences. */
  indentedCode: [
    1, 2, 3, 5, 6, 7, 8, 18, 36, 48, 69, 107, 110, 111, 112, 114, 115, 116, 117, 118, 134, 211, 225,
    231, 236, 252, 253, 254, 257, 264, 270, 271, 272, 273, 274, 278, 286, 287, 288, 289, 290, 313,
  ],
  /** Not supported on purpose: headings use #. */
  setextHeadings: [
    59, 80, 81, 82, 83, 84, 85, 86, 89, 90, 91, 95, 96, 100, 102, 103, 141, 215, 300,
  ],
  /** A tab that only partly fills the indentation of a nested list. */
  tabsInNestedLists: [9],
  /** Planned: raw HTML. */
  htmlBlocks: [
    21, 31, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164,
    165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183,
    184, 185, 186, 187, 188, 189, 190, 191, 308, 309,
  ],
  /** Planned: raw HTML. */
  rawHtml: [
    201, 344, 475, 476, 477, 491, 494, 524, 536, 613, 614, 615, 616, 617, 623, 625, 626, 627, 628,
    629, 630, 631, 642, 643,
  ],
} as const;
