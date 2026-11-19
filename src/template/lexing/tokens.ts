import type { SourceSpan } from "../../diagnostics/index.ts";

export type TemplateSymbol =
  | "."
  | ","
  | "("
  | ")"
  | "["
  | "]"
  | "|"
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">=";

interface TokenWith<Kind extends string, Value> {
  readonly kind: Kind;
  readonly value: Value;
  readonly span: SourceSpan;
}

interface Delimiter<Kind extends string> {
  readonly kind: Kind;
  readonly span: SourceSpan;
}

export type Token =
  | TokenWith<"text", string>
  | TokenWith<"name", string>
  | TokenWith<"string", string>
  | TokenWith<"number", number>
  | TokenWith<"symbol", TemplateSymbol>
  | Delimiter<"outputOpen">
  | Delimiter<"outputClose">
  | Delimiter<"tagOpen">
  | Delimiter<"tagClose">
  /** Marks a mistake the lexer has reported, so that the parser doesn't report it again. */
  | Delimiter<"invalid">
  /** Marks a mistake the lexer has reported, so that the parser doesn't report it again. */
  | Delimiter<"invalid">
  | Delimiter<"end">;
