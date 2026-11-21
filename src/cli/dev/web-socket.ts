/**
 * The little of the WebSocket protocol (RFC 6455) that live reload needs: answering the handshake, and
 * the frames a server sends. A browser counts WebSockets apart from its six connections to a server, so
 * any number of open pages can wait for the next build without keeping other requests waiting.
 */
import { createHash } from "node:crypto";

/** Fixed by the protocol, so that only a WebSocket server can answer the handshake. */
const HANDSHAKE_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export const Opcode = { text: 0x1, close: 0x8 } as const;

/** Close code 1000: done, as agreed. */
export const NORMAL = 1000;

/** Close code 1001: the server is going away. */
export const GOING_AWAY = 1001;

/** The `Sec-WebSocket-Accept` answer to a browser's `Sec-WebSocket-Key`. */
export function acceptKey(key: string): string {
  return createHash("sha1")
    .update(key + HANDSHAKE_GUID)
    .digest("base64");
}

/** A whole, unmasked frame, as a server sends it. */
export function frame(opcode: number, payload: Uint8Array): Uint8Array {
  const { length } = payload;
  const header =
    length < 126
      ? Uint8Array.of(0x80 | opcode, length)
      : length < 0x10000
        ? Uint8Array.of(0x80 | opcode, 126, length >> 8, length & 0xff)
        : (() => {
            const long = new Uint8Array(10);
            long[0] = 0x80 | opcode;
            long[1] = 127;
            new DataView(long.buffer).setBigUint64(2, BigInt(length));
            return long;
          })();
  const whole = new Uint8Array(header.length + length);
  whole.set(header);
  whole.set(payload, header.length);
  return whole;
}

export function textFrame(text: string): Uint8Array {
  return frame(Opcode.text, new TextEncoder().encode(text));
}

export function closeFrame(code: number): Uint8Array {
  return frame(Opcode.close, Uint8Array.of(code >> 8, code & 0xff));
}

/** The kind of a frame a browser sent, from its first byte. */
export function opcodeOf(firstByte: number): number {
  return firstByte & 0x0f;
}
