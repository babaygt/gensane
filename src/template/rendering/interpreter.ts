/**
 * A tree-walking interpreter: it visits the syntax tree and computes each node's value directly.
 * A problem produces the value `FAILED`, which spreads through the expression around it, so one
 * mistake is reported once and the rest of the template still runs. Inside a loop, the same
 * mistake at the same place is reported only for the first item.
 */
import {
  type Diagnostic,
  type DiagnosticCode,
  InternalError,
  type SourceSpan,
  assertNever,
  closestMatch,
} from "../../diagnostics/index.ts";
import type { Layout } from "../analysis/link-templates.ts";
import type {
  BinaryExpression,
  BlockNode,
  Expression,
  FilterExpression,
  ForNode,
  IfNode,
  IncludeNode,
  IndexExpression,
  LogicalExpression,
  MemberExpression,
  TemplateNode,
  UnaryExpression,
} from "../ast.ts";
import { TemplateCodes } from "../diagnostic-codes.ts";
import { type FilterDefinition, FilterError } from "./filter-types.ts";
import { Scope } from "./scope.ts";
import {
  SafeHtml,
  areEqual,
  describeValue,
  escapeHtml,
  isRecord,
  isTruthy,
  ownField,
  printableText,
} from "./values.ts";

export interface InterpreterResult {
  readonly html: string;
  readonly diagnostics: readonly Diagnostic[];
}

export function interpret(
  layout: Layout,
  variables: Readonly<Record<string, unknown>>,
  filters: ReadonlyMap<string, FilterDefinition>,
  layouts: ReadonlyMap<string, Layout>,
): InterpreterResult {
  return new Interpreter(variables, filters, layouts).run(layout);
}

/** Templates can't include each other in a circle, but a long chain could still overflow the stack. */
export const MAX_INCLUDE_DEPTH = 32;

const FAILED = Symbol("failed");

const MAX_LISTED_VARIABLES = 10;

const NUMBERS_ONLY: ReadonlySet<string> = new Set(["-", "*", "/", "%"]);

/** The way a value was written, such as `page.author`, if it is a plain path. */
function pathOf(expression: Expression): string | undefined {
  if (expression.kind === "variable") return expression.name;
  if (expression.kind !== "member") return undefined;
  const parent = pathOf(expression.object);
  return parent === undefined ? undefined : `${parent}.${expression.name}`;
}

class Interpreter {
  readonly #filters: ReadonlyMap<string, FilterDefinition>;
  readonly #layouts: ReadonlyMap<string, Layout>;
  readonly #diagnostics: Diagnostic[] = [];
  readonly #reported = new Set<string>();
  #scope: Scope;
  /** Conditions and the lists of loops may read missing fields without a warning. */
  #quiet = false;
  /** The blocks of the template being shown, which may come from templates that extend it. */
  #blocks: ReadonlyMap<string, readonly TemplateNode[]> = new Map();
  #includeDepth = 0;

  constructor(
    variables: Readonly<Record<string, unknown>>,
    filters: ReadonlyMap<string, FilterDefinition>,
    layouts: ReadonlyMap<string, Layout>,
  ) {
    this.#scope = new Scope(variables);
    this.#filters = filters;
    this.#layouts = layouts;
  }

  run(layout: Layout): InterpreterResult {
    return { html: this.#renderLayout(layout), diagnostics: this.#diagnostics };
  }

  #renderLayout({ nodes, blocks }: Layout): string {
    const outside = this.#blocks;
    this.#blocks = blocks;
    const html = this.#renderNodes(nodes);
    this.#blocks = outside;
    return html;
  }

  #renderNodes(nodes: readonly TemplateNode[]): string {
    return nodes.map((node) => this.#renderNode(node)).join("");
  }

  #renderNode(node: TemplateNode): string {
    switch (node.kind) {
      case "text":
        return node.value;
      case "output":
        return this.#print(node.expression);
      case "if":
        return this.#renderIf(node);
      case "for":
        return this.#renderFor(node);
      case "include":
        return this.#renderInclude(node);
      case "block":
        return this.#renderBlock(node);
      case "extends":
        return "";
      default:
        return assertNever(node);
    }
  }

  #renderIf({ branches, otherwise }: IfNode): string {
    for (const { condition, body } of branches) {
      const value = this.#evaluateQuietly(condition);
      if (value === FAILED) return "";
      if (isTruthy(value)) return this.#renderNodes(body);
    }
    return this.#renderNodes(otherwise);
  }

  #renderFor({ variable, iterable, body, otherwise }: ForNode): string {
    const list = this.#evaluateQuietly(iterable);
    if (list === FAILED) return "";
    if (list !== null && list !== undefined && !Array.isArray(list)) {
      this.#error(
        TemplateCodes.notIterable,
        `a loop needs a list, but found ${describeValue(list)}`,
        iterable.span,
        "use a list here, such as `page.tags`",
      );
      return "";
    }
    const items: readonly unknown[] = Array.isArray(list) ? list : [];
    if (items.length === 0) return this.#renderNodes(otherwise);

    const outside = this.#scope;
    const html = items.map((item, index) => {
      const loop = {
        index: index + 1,
        first: index === 0,
        last: index === items.length - 1,
        length: items.length,
      };
      this.#scope = new Scope({ [variable]: item, loop }, outside);
      return this.#renderNodes(body);
    });
    this.#scope = outside;
    return html.join("");
  }

  /** An included template sees the variables at the place where it is included. */
  #renderInclude({ template, span }: IncludeNode): string {
    if (this.#includeDepth >= MAX_INCLUDE_DEPTH) {
      this.#error(
        TemplateCodes.nestingTooDeep,
        `templates are included more than ${MAX_INCLUDE_DEPTH} levels deep`,
        span,
        "include fewer templates inside each other",
      );
      return "";
    }
    const layout = this.#layouts.get(template);
    if (layout === undefined) throw new InternalError(`Unchecked template: ${template}`);
    this.#includeDepth++;
    const html = this.#renderLayout(layout);
    this.#includeDepth--;
    return html;
  }

  #renderBlock({ name, body }: BlockNode): string {
    return this.#renderNodes(this.#blocks.get(name) ?? body);
  }

  #evaluateQuietly(expression: Expression): unknown {
    this.#quiet = true;
    const value = this.#evaluate(expression);
    this.#quiet = false;
    return value;
  }

  #print(expression: Expression): string {
    const value = this.#evaluateAndWarn(expression);
    if (value === FAILED) return "";
    if (value instanceof SafeHtml) return value.html;
    const text = printableText(value);
    if (text !== undefined) return escapeHtml(text);
    this.#error(
      TemplateCodes.notPrintable,
      `${describeValue(value)} cannot be printed`,
      expression.span,
      this.#printingHint(value, expression),
    );
    return "";
  }

  #printingHint(value: unknown, expression: Expression): string {
    if (Array.isArray(value)) return "use the `join` filter to print a list";
    const [field] = isRecord(value) ? Object.keys(value) : [];
    const path = pathOf(expression);
    if (field === undefined || path === undefined) return "print one of its fields";
    return `print one of its fields, such as \`${path}.${field}\``;
  }

  /** Reading a missing field is normal in a condition, but printing one is probably a typo. */
  #evaluateAndWarn(expression: Expression): unknown {
    if (expression.kind !== "member") return this.#evaluate(expression);
    const object = this.#evaluateAndWarn(expression.object);
    if (object === FAILED) return FAILED;
    if (!this.#quiet && isRecord(object) && !Object.hasOwn(object, expression.name)) {
      this.#warnAboutMissingField(object, expression);
    }
    return ownField(object, expression.name);
  }

  #warnAboutMissingField(
    object: Readonly<Record<string, unknown>>,
    { object: parent, name, nameSpan }: MemberExpression,
  ): void {
    const suggestion = closestMatch(name, Object.keys(object));
    this.#report({
      code: TemplateCodes.missingField,
      severity: "warning",
      message: `"${pathOf(parent) ?? "this value"}" has no field "${name}"`,
      span: nameSpan,
      hint:
        suggestion === undefined
          ? "check the spelling, or add `default` if the field is optional"
          : `did you mean "${suggestion}"?`,
    });
  }

  #evaluate(expression: Expression): unknown {
    switch (expression.kind) {
      case "literal":
        return expression.value;
      case "variable":
        return this.#readVariable(expression.name, expression.span);
      case "member":
        return this.#evaluateMember(expression);
      case "index":
        return this.#evaluateIndex(expression);
      case "unary":
        return this.#evaluateUnary(expression);
      case "binary":
        return this.#evaluateBinary(expression);
      case "logical":
        return this.#evaluateLogical(expression);
      case "filter":
        return this.#evaluateFilter(expression);
      default:
        return assertNever(expression);
    }
  }

  #readVariable(name: string, span: SourceSpan): unknown {
    const found = this.#scope.lookup(name);
    if (found !== undefined) return found.value;
    const known = this.#scope.names();
    const suggestion = closestMatch(name, known);
    const listed = known.slice(0, MAX_LISTED_VARIABLES).join(", ");
    let hint = "no variables are available here";
    if (suggestion !== undefined) hint = `did you mean "${suggestion}"?`;
    else if (known.length > 0) hint = `the variables here are: ${listed}`;
    this.#error(TemplateCodes.unknownVariable, `there is no variable named "${name}"`, span, hint);
    return FAILED;
  }

  #evaluateMember({ object, name }: MemberExpression): unknown {
    const value = this.#evaluate(object);
    return value === FAILED ? FAILED : ownField(value, name);
  }

  #evaluateIndex({ object, index, span }: IndexExpression): unknown {
    const value = this.#evaluate(object);
    const key = this.#evaluate(index);
    if (value === FAILED || key === FAILED) return FAILED;
    if (typeof key === "string" || (typeof key === "number" && Number.isInteger(key))) {
      return ownField(value, key);
    }
    this.#error(
      TemplateCodes.invalidIndex,
      `an index must be a whole number or text, but this is ${describeValue(key)}`,
      span,
      'use a position such as `[0]`, or a field name such as `["title"]`',
    );
    return FAILED;
  }

  #evaluateUnary({ operator, operand, span }: UnaryExpression): unknown {
    const value = this.#evaluate(operand);
    if (value === FAILED) return FAILED;
    if (operator === "not") return !isTruthy(value);
    if (typeof value === "number") return -value;
    const found = describeValue(value);
    const message = `\`-\` needs a number, but found ${found}`;
    this.#error(TemplateCodes.wrongOperand, message, span, "use a number here");
    return FAILED;
  }

  #evaluateLogical({ operator, left, right }: LogicalExpression): unknown {
    const value = this.#evaluate(left);
    if (value === FAILED) return FAILED;
    const decided = operator === "and" ? !isTruthy(value) : isTruthy(value);
    return decided ? value : this.#evaluate(right);
  }

  #evaluateBinary(expression: BinaryExpression): unknown {
    const left = this.#evaluate(expression.left);
    const right = this.#evaluate(expression.right);
    if (left === FAILED || right === FAILED) return FAILED;
    const { operator } = expression;
    if (operator === "==") return areEqual(left, right);
    if (operator === "!=") return !areEqual(left, right);
    if (typeof left === "number" && typeof right === "number") {
      return this.#computeNumbers(expression, left, right);
    }
    if (typeof left === "string" && typeof right === "string" && !NUMBERS_ONLY.has(operator)) {
      return operator === "+" ? left + right : compare(operator, left, right);
    }
    const needed = NUMBERS_ONLY.has(operator) ? "two numbers" : "two numbers or two pieces of text";
    const found = `${describeValue(left)} and ${describeValue(right)}`;
    this.#error(
      TemplateCodes.wrongOperand,
      `\`${operator}\` needs ${needed}, but found ${found}`,
      expression.span,
      "check the values on both sides of the operator",
    );
    return FAILED;
  }

  #computeNumbers({ operator, span }: BinaryExpression, left: number, right: number): unknown {
    switch (operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
      case "%":
        if (right !== 0) return operator === "/" ? left / right : left % right;
        this.#error(
          TemplateCodes.divisionByZero,
          "division by zero",
          span,
          "divide by another number",
        );
        return FAILED;
      default:
        return compare(operator, left, right);
    }
  }

  #evaluateFilter(expression: FilterExpression): unknown {
    const { input, name, nameSpan } = expression;
    const value = name === "default" ? this.#evaluate(input) : this.#evaluateAndWarn(input);
    const filterArguments = expression.arguments.map((argument) => this.#evaluate(argument));
    if (value === FAILED || filterArguments.includes(FAILED)) return FAILED;
    const definition = this.#filters.get(name);
    if (definition === undefined) throw new InternalError(`Unchecked filter: ${name}`);
    try {
      return definition.apply(value, ...filterArguments);
    } catch (problem) {
      this.#reportFilterProblem(name, problem, nameSpan);
      return FAILED;
    }
  }

  #reportFilterProblem(name: string, problem: unknown, span: SourceSpan): void {
    const hint = "check the value that this filter receives";
    if (problem instanceof FilterError) {
      this.#error(TemplateCodes.filterFailed, problem.message, span, problem.hint ?? hint);
      return;
    }
    const reason = problem instanceof Error ? problem.message : String(problem);
    this.#error(TemplateCodes.filterFailed, `the filter "${name}" failed: ${reason}`, span, hint);
  }

  #error(code: DiagnosticCode, message: string, span: SourceSpan, hint: string): void {
    this.#report({ code, severity: "error", message, span, hint });
  }

  #report(diagnostic: Diagnostic): void {
    const { code, span } = diagnostic;
    const key = `${code} ${span.file} ${span.start.offset}`;
    if (this.#reported.has(key)) return;
    this.#reported.add(key);
    this.#diagnostics.push(diagnostic);
  }
}

function compare<T extends string | number>(operator: string, left: T, right: T): boolean {
  switch (operator) {
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    default:
      throw new InternalError(`Not a comparison: ${operator}`);
  }
}
