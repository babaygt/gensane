import { describe, expect, it } from "vitest";
import {
  GOING_AWAY,
  Opcode,
  acceptKey,
  closeFrame,
  frame,
  opcodeOf,
  textFrame,
} from "./web-socket.ts";

describe("acceptKey", () => {
  it("answers the key of the example in the protocol's own text, RFC 6455", () => {
    expect(acceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
  });
});

describe("frame", () => {
  it("writes a short text in one byte of length, after the final bit and the opcode", () => {
    expect([...textFrame("reload")]).toEqual([0x81, 6, ...new TextEncoder().encode("reload")]);
  });

  it.each([
    [125, [0x81, 125]],
    [126, [0x81, 126, 0, 126]],
    [0xffff, [0x81, 126, 0xff, 0xff]],
    [0x10000, [0x81, 127, 0, 0, 0, 0, 0, 1, 0, 0]],
  ])("writes the length %i in the header as %j", (length, header) => {
    const written = frame(Opcode.text, new Uint8Array(length));
    expect(Array.from(written.subarray(0, header.length))).toEqual(header);
    expect(written.length).toBe(header.length + length);
  });

  it("says why it closes in two bytes", () => {
    expect([...closeFrame(GOING_AWAY)]).toEqual([0x88, 2, 0x03, 0xe9]);
  });
});

describe("opcodeOf", () => {
  it("reads the kind of a frame, whether or not it is the last part", () => {
    expect(opcodeOf(0x88)).toBe(Opcode.close);
    expect(opcodeOf(0x08)).toBe(Opcode.close);
    expect(opcodeOf(0x81)).toBe(Opcode.text);
  });
});
