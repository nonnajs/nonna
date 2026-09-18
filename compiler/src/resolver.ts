import path from "node:path";
import ts from "typescript";

import type {InjectorSymbols} from "./scanner";
import {findParameterDecorator} from "./scanner";

/** Where a resolved token comes from - either a named export to import, or a literal value. */
export type TokenSource =
    | {kind: "import"; moduleSpecifier: string; exportName: string}
    | {kind: "literal"; value: string};

export interface ResolvedDependency {
    token: TokenSource;
    optional: boolean;
}

export interface ResolutionError {
    message: string;
    node: ts.Node;
}

export type ParameterResolution =
    | {kind: "resolved"; dependency: ResolvedDependency}
    | {kind: "error"; error: ResolutionError};

const PRIMITIVE_FLAGS =
    ts.TypeFlags.String |
    ts.TypeFlags.Number |
    ts.TypeFlags.Boolean |
    ts.TypeFlags.BigInt |
    ts.TypeFlags.ESSymbol |
    ts.TypeFlags.StringLiteral |
    ts.TypeFlags.NumberLiteral |
    ts.TypeFlags.BooleanLiteral |
    ts.TypeFlags.Void |
    ts.TypeFlags.Undefined |
    ts.TypeFlags.Null |
    ts.TypeFlags.Never |
    ts.TypeFlags.Unknown |
    ts.TypeFlags.Any;

function moduleSpecifierForSourceFile(sourceFile: ts.SourceFile, fromDir: string): string {
    const fileName = sourceFile.fileName;
    const nodeModulesMarker = "/node_modules/";
    const nmIndex = fileName.indexOf(nodeModulesMarker);
    if (nmIndex !== -1) {
        const afterNm = fileName.slice(nmIndex + nodeModulesMarker.length);
        const segments = afterNm.split("/");
        return segments[0]!.startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0]!;
    }
    let rel = path.relative(fromDir, fileName).replace(/\.[tj]sx?$/, "");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    return rel.split(path.sep).join("/");
}

/**
 * Classifies a constructor parameter's declared type per the spec's decision tree: reject
 * unions, primitives, unresolved generics, and plain interfaces; accept class symbols (covers
 * both concrete and `abstract class`, since TypeScript represents both as class symbols).
 * Generic-class instantiations (e.g. `Repository<User>`) are also rejected - the type argument
 * is erased at runtime and two instantiations of the same generic are indistinguishable as DI
 * tokens - this is a documented v1 limitation, not an oversight.
 */
function classifyInferredType(
    typeNode: ts.TypeNode,
    type: ts.Type,
): {kind: "class"; symbol: ts.Symbol} | {kind: "rejected"; reason: string} {
    if (type.isUnion() || type.isIntersection()) {
        return {kind: "rejected", reason: "a union or intersection type, which has no single runtime DI token"};
    }
    if (type.flags & PRIMITIVE_FLAGS) {
        return {kind: "rejected", reason: "a primitive type, which has no runtime class representation"};
    }
    if (type.flags & ts.TypeFlags.TypeParameter) {
        return {kind: "rejected", reason: "an unresolved generic type parameter"};
    }

    const symbol = type.getSymbol();
    if (!symbol) {
        return {kind: "rejected", reason: "a type with no runtime value"};
    }

    if (symbol.flags & ts.SymbolFlags.Class) {
        const declarations = symbol.getDeclarations() ?? [];
        const isGenericClass = declarations.some(
            d => ts.isClassDeclaration(d) && d.typeParameters && d.typeParameters.length > 0,
        );
        const isInstantiatedWithArgs =
            ts.isTypeReferenceNode(typeNode) && !!typeNode.typeArguments && typeNode.typeArguments.length > 0;
        if (isGenericClass && isInstantiatedWithArgs) {
            return {
                kind: "rejected",
                reason:
                    "a generic class instantiation (e.g. Repository<User>) - the type argument is erased at runtime " +
                    "and cannot safely be used as a DI token; add an explicit @Inject(TOKEN)",
            };
        }
        return {kind: "class", symbol};
    }

    return {kind: "rejected", reason: "an interface or other type with no runtime class representation"};
}

function importSourceForSymbol(symbol: ts.Symbol, fromDir: string): TokenSource | undefined {
    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return undefined;
    const sourceFile = declarations[0]!.getSourceFile();
    return {
        kind: "import",
        moduleSpecifier: moduleSpecifierForSourceFile(sourceFile, fromDir),
        exportName: symbol.name,
    };
}

/** Resolves the token expression passed to an explicit @Inject(token)/@Optional(token) call. */
function resolveExplicitToken(
    checker: ts.TypeChecker,
    argument: ts.Expression,
    fromDir: string,
): {kind: "resolved"; token: TokenSource} | {kind: "error"; message: string} {
    if (ts.isStringLiteralLike(argument)) {
        return {kind: "resolved", token: {kind: "literal", value: argument.text}};
    }

    if (ts.isIdentifier(argument)) {
        let symbol = checker.getSymbolAtLocation(argument);
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
            symbol = checker.getAliasedSymbol(symbol);
        }
        if (!symbol) {
            return {
                kind: "error",
                message: `Could not resolve the token "${argument.getText()}" passed to @Inject()/@Optional().`,
            };
        }
        const source = importSourceForSymbol(symbol, fromDir);
        if (!source) {
            return {
                kind: "error",
                message: `Could not resolve an importable declaration for token "${argument.getText()}".`,
            };
        }
        return {kind: "resolved", token: source};
    }

    return {
        kind: "error",
        message:
            `Unsupported @Inject()/@Optional() token expression "${argument.getText()}". ` +
            `v1 only supports an identifier referencing an exported const, or a string literal. ` +
            `Hoist the token into a named exported constant (e.g. export const LOGGER = Symbol("LOGGER")).`,
    };
}

/**
 * Resolves a single constructor parameter to a Dependency, following the spec's precedence:
 * explicit @Inject()/@Optional() always wins over inference, and inference only succeeds for
 * concrete/abstract runtime classes.
 */
export function resolveParameter(
    checker: ts.TypeChecker,
    param: ts.ParameterDeclaration,
    symbols: InjectorSymbols,
    fromDir: string,
): ParameterResolution {
    const explicit = findParameterDecorator(checker, param, symbols);

    if (explicit) {
        const [argument] = explicit.call.arguments;
        const optional = explicit.kind === "optional";

        if (!argument) {
            if (explicit.kind === "inject") {
                return {
                    kind: "error",
                    error: {message: "@Inject() requires an explicit token argument.", node: explicit.call},
                };
            }
            // @Optional() with no token: fall through to inference below, but keep optional: true.
        } else {
            const resolved = resolveExplicitToken(checker, argument, fromDir);
            if (resolved.kind === "error") {
                return {kind: "error", error: {message: resolved.message, node: argument}};
            }
            return {kind: "resolved", dependency: {token: resolved.token, optional}};
        }

        return resolveInferredParameter(checker, param, fromDir, true);
    }

    return resolveInferredParameter(checker, param, fromDir, false);
}

function resolveInferredParameter(
    checker: ts.TypeChecker,
    param: ts.ParameterDeclaration,
    fromDir: string,
    optional: boolean,
): ParameterResolution {
    if (!param.type) {
        return {
            kind: "error",
            error: {
                message: `Parameter "${param.name.getText()}" has no type annotation and no @Inject()/@Optional(token) - cannot infer a DI token.`,
                node: param,
            },
        };
    }

    const type = checker.getTypeFromTypeNode(param.type);
    const classification = classifyInferredType(param.type, type);

    if (classification.kind === "rejected") {
        return {
            kind: "error",
            error: {
                message:
                    `Cannot resolve a DI token for parameter "${param.name.getText()}": its type is ${
                        classification.reason
                    }. ` + `Add an explicit @Inject(TOKEN)${optional ? " or @Optional(TOKEN)" : ""}.`,
                node: param,
            },
        };
    }

    const source = importSourceForSymbol(classification.symbol, fromDir);
    if (!source) {
        return {
            kind: "error",
            error: {
                message: `Could not resolve an importable declaration for parameter "${param.name.getText()}"'s type.`,
                node: param,
            },
        };
    }

    return {kind: "resolved", dependency: {token: source, optional}};
}
