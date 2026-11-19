/**
 * The syntax tree of a template. Every node remembers where it was written, so that problems
 * found while rendering can still point at the exact place in the file.
 */
import type { SourceSpan } from "../diagnostics/index.ts";

export interface LiteralExpression {
  readonly kind: "literal";
  readonly value: string | number | boolean | null;
  readonly span: SourceSpan;
}

export interface VariableExpression {
  readonly kind: "variable";
  readonly name: string;
  readonly span: SourceSpan;
}

/** `page.title` */
export interface MemberExpression {
  readonly kind: "member";
  readonly object: Expression;
  readonly name: string;
  readonly nameSpan: SourceSpan;
  readonly span: SourceSpan;
}

/** `posts[0]` or `page["title"]` */
export interface IndexExpression {
  readonly kind: "index";
  readonly object: Expression;
  readonly index: Expression;
  readonly span: SourceSpan;
}

export interface UnaryExpression {
  readonly kind: "unary";
  readonly operator: "not" | "-";
  readonly operand: Expression;
  readonly span: SourceSpan;
}

export type BinaryOperator = "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | "<=" | ">" | ">=";

export interface BinaryExpression {
  readonly kind: "binary";
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
  readonly span: SourceSpan;
}

/** Kept apart from other operators, because the right side only runs when it is needed. */
export interface LogicalExpression {
  readonly kind: "logical";
  readonly operator: "and" | "or";
  readonly left: Expression;
  readonly right: Expression;
  readonly span: SourceSpan;
}

/** `title | truncate(40)` */
export interface FilterExpression {
  readonly kind: "filter";
  readonly input: Expression;
  readonly name: string;
  readonly nameSpan: SourceSpan;
  readonly arguments: readonly Expression[];
  readonly span: SourceSpan;
}

export type Expression =
  | LiteralExpression
  | VariableExpression
  | MemberExpression
  | IndexExpression
  | UnaryExpression
  | BinaryExpression
  | LogicalExpression
  | FilterExpression;

export interface TextNode {
  readonly kind: "text";
  readonly value: string;
  readonly span: SourceSpan;
}

/** `{{ expression }}` */
export interface OutputNode {
  readonly kind: "output";
  readonly expression: Expression;
  readonly span: SourceSpan;
}

export type TemplateNode = TextNode | OutputNode;
