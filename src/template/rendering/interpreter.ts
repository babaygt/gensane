/**
 * A tree-walking interpreter: it visits the syntax tree and computes each node's value directly.
 * A problem produces the value `FAILED`, which spreads through the expression around it, so one
 * mistake is reported once and the rest of the template still runs.
 */
import {
  type Diagnostic,
  type DiagnosticCode,
  InternalError,
  type SourceSpan,
  assertNever,
  closestMatch,
} from "../../diagnostics/index.ts";
import type {
  BinaryExpression,
  Expression,
  FilterExpression,
  IndexExpression,
  LogicalExpression,
  MemberExpression,
  TemplateNode,
  UnaryExpression,
} from "../ast.ts";
import { TemplateCodes } from "../diagnostic-codes.ts";
import { type FilterDefinition, FilterError } from "./filters.ts";
import {
  SafeHtml,
  describeValue,
  escapeHtml,
  isRecord,
  isTruthy,
  printableText,
} from "./values.ts";

export interface InterpreterResult {
  readonly html: string;
  readonly diagnostics: readonly Diagnostic[];
}

export function interpret(
  nodes: readonly TemplateNode[],
  variables: Readonly<Record<string, unknown>>,
  filters: ReadonlyMap<string, FilterDefinition>,
): InterpreterResult {
  return new Interpreter(variables, filters).run(nodes);
}

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

function readField(object: unknown, key: string | number): unknown {
  if (!Array.isArray(object) && !isRecord(object)) return undefined;
  return Object.hasOwn(object, key) ? Reflect.get(object, key) : undefined;
}

class Interpreter {
  readonly #variables: Readonly<Record<string, unknown>>;
  readonly #filters: ReadonlyMap<string, FilterDefinition>;
  readonly #diagnostics: Diagnostic[] = [];

  constructor(
    variables: Readonly<Record<string, unknown>>,
    filters: ReadonlyMap<string, FilterDefinition>,
  ) {
    this.#variables = variables;
    this.#filters = filters;
  }

  run(nodes: readonly TemplateNode[]): InterpreterResult {
    const html = nodes.map((node) => this.#renderNode(node)).join("");
    return { html, diagnostics: this.#diagnostics };
  }

  #renderNode(node: TemplateNode): string {
    switch (node.kind) {
      case "text":
        return node.value;
      case "output":
        return this.#print(node.expression);
      default:
        return assertNever(node);
    }
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
    if (isRecord(object) && !Object.hasOwn(object, expression.name)) {
      this.#warnAboutMissingField(object, expression);
    }
    return readField(object, expression.name);
  }

  #warnAboutMissingField(
    object: Readonly<Record<string, unknown>>,
    { object: parent, name, nameSpan }: MemberExpression,
  ): void {
    const suggestion = closestMatch(name, Object.keys(object));
    this.#diagnostics.push({
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
    if (Object.hasOwn(this.#variables, name)) return this.#variables[name];
    const known = Object.keys(this.#variables);
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
    return value === FAILED ? FAILED : readField(value, name);
  }

  #evaluateIndex({ object, index, span }: IndexExpression): unknown {
    const value = this.#evaluate(object);
    const key = this.#evaluate(index);
    if (value === FAILED || key === FAILED) return FAILED;
    if (typeof key === "string" || (typeof key === "number" && Number.isInteger(key))) {
      return readField(value, key);
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
    if (operator === "==") return (left ?? null) === (right ?? null);
    if (operator === "!=") return (left ?? null) !== (right ?? null);
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
    this.#diagnostics.push({ code, severity: "error", message, span, hint });
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
