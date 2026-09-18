import ts from "typescript";

import {getDecorators, isProjectSourceFile} from "./program";

/**
 * The `@nonna/di` decorator/helper symbols this compiler recognizes, resolved once per
 * Program by their *declaration*, never by name. This is what lets the compiler tell `Inject`
 * imported from `@nonna/di` apart from a same-named `Inject` imported from another library.
 *
 * Each set can hold more than one symbol: a framework built on top of `@nonna/di` (e.g.
 * Node-Boot's `@Component`/`@Service`/`@Controller`/`@Middleware`/`@Interceptor`/`@Inject`) can
 * register its own decorators as additional, equally-valid triggers - see
 * `resolveInjectorSymbols()`'s `additional` parameter.
 */
export interface InjectorSymbols {
    injectableClassSymbols: readonly ts.Symbol[];
    injectParamSymbols: readonly ts.Symbol[];
    optionalParamSymbols: readonly ts.Symbol[];
}

/** One additional decorator export this compiler should treat as equivalent to the built-in one. */
export interface DecoratorSourceMatch {
    matchesFile: (fileName: string) => boolean;
    exportName: string;
}

export interface AdditionalDecoratorSources {
    /** Additional class-level triggers, equivalent to `@Injectable()`/`@Service()`. */
    injectable?: readonly DecoratorSourceMatch[];
    /** Additional parameter-level triggers, equivalent to `@Inject()`. */
    inject?: readonly DecoratorSourceMatch[];
    /** Additional parameter-level triggers, equivalent to `@Optional()`. */
    optional?: readonly DecoratorSourceMatch[];
}

function resolveAlias(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
    return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function findExportedSymbol(
    program: ts.Program,
    checker: ts.TypeChecker,
    matchesFile: (fileName: string) => boolean,
    exportName: string,
): ts.Symbol | undefined {
    for (const sourceFile of program.getSourceFiles()) {
        if (!matchesFile(sourceFile.fileName)) continue;
        const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
        if (!moduleSymbol) continue;
        // A bundled .d.ts (e.g. tsup's rollup output) typically re-exports via a trailing
        // `export { X }` clause, so the module's export table holds an alias symbol for X, not
        // X's own declaration - unwrap it so this matches what resolveDecoratorSymbol() below
        // (and importSourceForSymbol() in resolver.ts) resolve on the consuming side.
        const found = checker.getExportsOfModule(moduleSymbol).find(s => s.name === exportName);
        if (found) return resolveAlias(checker, found);
    }
    return undefined;
}

function resolveAll(
    program: ts.Program,
    checker: ts.TypeChecker,
    builtins: {matchesFile: (fileName: string) => boolean; exportName: string}[],
    additional: readonly DecoratorSourceMatch[] = [],
): ts.Symbol[] {
    return [...builtins, ...additional]
        .map(source => findExportedSymbol(program, checker, source.matchesFile, source.exportName))
        .filter((s): s is ts.Symbol => s !== undefined);
}

/**
 * Resolves the canonical @nonna/di export symbols from the given Program, plus any
 * `additional` decorator sources a downstream framework registers as equivalent triggers.
 * `matchesFile` identifies which source file(s) in the Program are "the @nonna/di module" - in
 * production this matches `node_modules/@nonna/di`, in tests it points at a fixture
 * standing in for the real package.
 */
export function resolveInjectorSymbols(
    program: ts.Program,
    checker: ts.TypeChecker,
    matchesFile: (fileName: string) => boolean,
    additional?: AdditionalDecoratorSources,
): InjectorSymbols {
    return {
        injectableClassSymbols: resolveAll(
            program,
            checker,
            [
                {matchesFile, exportName: "Injectable"},
                {matchesFile, exportName: "Service"},
            ],
            additional?.injectable,
        ),
        injectParamSymbols: resolveAll(program, checker, [{matchesFile, exportName: "Inject"}], additional?.inject),
        optionalParamSymbols: resolveAll(
            program,
            checker,
            [{matchesFile, exportName: "Optional"}],
            additional?.optional,
        ),
    };
}

function resolveDecoratorSymbol(checker: ts.TypeChecker, decorator: ts.Decorator): ts.Symbol | undefined {
    const expression = ts.isCallExpression(decorator.expression)
        ? decorator.expression.expression
        : decorator.expression;
    let symbol = checker.getSymbolAtLocation(expression);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        symbol = checker.getAliasedSymbol(symbol);
    }
    return symbol;
}

export interface InjectableClass {
    declaration: ts.ClassDeclaration;
    sourceFile: ts.SourceFile;
}

/**
 * Finds every class declaration, across every project source file, decorated with the real
 * @Injectable()/@Service() from @nonna/di (verified by symbol identity, not by name).
 */
export function findInjectableClasses(
    program: ts.Program,
    checker: ts.TypeChecker,
    symbols: InjectorSymbols,
): InjectableClass[] {
    const results: InjectableClass[] = [];
    const recognized = new Set(symbols.injectableClassSymbols);
    if (recognized.size === 0) return results;

    for (const sourceFile of program.getSourceFiles()) {
        if (!isProjectSourceFile(sourceFile)) continue;

        ts.forEachChild(sourceFile, node => {
            if (!ts.isClassDeclaration(node)) return;
            const decorators = getDecorators(node) ?? [];
            const isInjectable = decorators.some(decorator => {
                const symbol = resolveDecoratorSymbol(checker, decorator);
                return symbol !== undefined && recognized.has(symbol);
            });
            if (isInjectable) {
                results.push({declaration: node, sourceFile});
            }
        });
    }

    return results;
}

export function getConstructorParameters(classDeclaration: ts.ClassDeclaration): readonly ts.ParameterDeclaration[] {
    const ctor = classDeclaration.members.find(ts.isConstructorDeclaration);
    return ctor ? ctor.parameters : [];
}

/** Resolves the @Inject(...)/@Optional(...) decorator (if any) applied to a single parameter, by symbol identity. */
export function findParameterDecorator(
    checker: ts.TypeChecker,
    param: ts.ParameterDeclaration,
    symbols: InjectorSymbols,
): {kind: "inject" | "optional"; call: ts.CallExpression} | undefined {
    const injectSymbols = new Set(symbols.injectParamSymbols);
    const optionalSymbols = new Set(symbols.optionalParamSymbols);
    const decorators = getDecorators(param) ?? [];
    for (const decorator of decorators) {
        if (!ts.isCallExpression(decorator.expression)) continue;
        const symbol = resolveDecoratorSymbol(checker, decorator);
        if (symbol !== undefined && injectSymbols.has(symbol)) return {kind: "inject", call: decorator.expression};
        if (symbol !== undefined && optionalSymbols.has(symbol)) return {kind: "optional", call: decorator.expression};
    }
    return undefined;
}
