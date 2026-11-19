/**
 * Checks every filter before anything is rendered. A mistake is found even in a part of the
 * template that wouldn't run for this page.
 */
import { type Diagnostic, assertNever, closestMatch } from "../../diagnostics/index.ts";
import type { Expression, FilterExpression, TemplateNode } from "../ast.ts";
import { TemplateCodes } from "../diagnostic-codes.ts";
import type { FilterDefinition } from "../rendering/filter-types.ts";

export function checkFilters(
  nodes: readonly TemplateNode[],
  filters: ReadonlyMap<string, FilterDefinition>,
): Diagnostic[] {
  return nodes.flatMap((node) => {
    switch (node.kind) {
      case "text":
        return [];
      case "output":
        return checkExpression(node.expression, filters);
      case "if":
        return [
          ...node.branches.flatMap((branch) => [
            ...checkExpression(branch.condition, filters),
            ...checkFilters(branch.body, filters),
          ]),
          ...checkFilters(node.otherwise, filters),
        ];
      case "for":
        return [
          ...checkExpression(node.iterable, filters),
          ...checkFilters(node.body, filters),
          ...checkFilters(node.otherwise, filters),
        ];
      default:
        return assertNever(node);
    }
  });
}

function checkExpression(
  expression: Expression,
  filters: ReadonlyMap<string, FilterDefinition>,
): Diagnostic[] {
  const check = (child: Expression) => checkExpression(child, filters);
  switch (expression.kind) {
    case "literal":
    case "variable":
      return [];
    case "member":
      return check(expression.object);
    case "index":
      return [...check(expression.object), ...check(expression.index)];
    case "unary":
      return check(expression.operand);
    case "binary":
    case "logical":
      return [...check(expression.left), ...check(expression.right)];
    case "filter":
      return [
        ...check(expression.input),
        ...checkFilterUse(expression, filters),
        ...expression.arguments.flatMap(check),
      ];
    default:
      return assertNever(expression);
  }
}

function checkFilterUse(
  use: FilterExpression,
  filters: ReadonlyMap<string, FilterDefinition>,
): Diagnostic[] {
  const definition = filters.get(use.name);
  if (definition === undefined) {
    const suggestion = closestMatch(use.name, [...filters.keys()]);
    return [
      {
        code: TemplateCodes.unknownFilter,
        severity: "error",
        message: `there is no filter named "${use.name}"`,
        span: use.nameSpan,
        hint:
          suggestion === undefined
            ? "check the spelling of the filter"
            : `did you mean "${suggestion}"?`,
      },
    ];
  }
  const count = use.arguments.length;
  const { minimumArguments: minimum, maximumArguments: maximum } = definition;
  if (count >= minimum && count <= maximum) return [];
  return [
    {
      code: TemplateCodes.wrongArgumentCount,
      severity: "error",
      message: `"${use.name}" takes ${describeCount(minimum, maximum)}, but got ${count}`,
      span: use.nameSpan,
      hint: count > maximum ? "remove the extra arguments" : "add the missing arguments",
    },
  ];
}

function describeCount(minimum: number, maximum: number): string {
  if (maximum === 0) return "no arguments";
  if (minimum === maximum) return `${minimum} argument${minimum === 1 ? "" : "s"}`;
  return `${minimum} to ${maximum} arguments`;
}
