import path from "node:path";
import ts from "typescript";

import {generateAggregatorSource} from "./codegen";
import {createDiagnostic} from "./diagnostics";
import {createInjectorModuleMatcher} from "./module-resolution";
import {createProgramFromTsConfig} from "./program";
import {resolveParameter} from "./resolver";
import {findInjectableClasses, getConstructorParameters, resolveInjectorSymbols} from "./scanner";
import type {AggregatorEntry} from "./codegen";
import type {ResolvedDependency} from "./resolver";

/** A named export from a module that should be treated as equivalent to a built-in `@nonnajs/di` decorator. */
export interface DecoratorSource {
    moduleSpecifier: string;
    exportName: string;
}

export interface CompileOptions {
    /** Path to the consuming project's tsconfig.json. */
    project: string;
    /** Where to write the generated aggregator file. */
    outputFile: string;
    /** Module specifier the generated file imports `defineDependencies` from. */
    injectorModuleSpecifier?: string;
    /** Identifies which Program source file(s) are "the @nonnajs/di module" - defaults to node_modules resolution. */
    matchInjectorModule?: (fileName: string) => boolean;
    /**
     * Additional class-level decorators (beyond `@Injectable()`/`@Service()` from `@nonnajs/di`)
     * that should also mark a class as injectable - e.g. a framework built on top of `@nonnajs/di`
     * with its own `@Component()`/`@Controller()`.
     */
    additionalInjectableDecorators?: readonly DecoratorSource[];
    /** Additional parameter decorators (beyond `@Inject()` from `@nonnajs/di`) treated as explicit tokens. */
    additionalInjectDecorators?: readonly DecoratorSource[];
    /** Additional parameter decorators (beyond `@Optional()` from `@nonnajs/di`) treated as optional tokens. */
    additionalOptionalDecorators?: readonly DecoratorSource[];
}

export type CompileResult =
    | {success: true; outputFile: string; classCount: number}
    | {success: false; diagnostics: readonly ts.Diagnostic[]};

export function compile(options: CompileOptions): CompileResult {
    const {program, checker} = createProgramFromTsConfig(options.project);
    const injectorModuleSpecifier = options.injectorModuleSpecifier ?? "@nonnajs/di";
    const matcher =
        options.matchInjectorModule ??
        createInjectorModuleMatcher(path.dirname(options.project), injectorModuleSpecifier);

    const projectDir = path.dirname(options.project);
    const matcherCache = new Map<string, (fileName: string) => boolean>();
    const matcherFor = (moduleSpecifier: string): ((fileName: string) => boolean) => {
        let found = matcherCache.get(moduleSpecifier);
        if (!found) {
            found = createInjectorModuleMatcher(projectDir, moduleSpecifier);
            matcherCache.set(moduleSpecifier, found);
        }
        return found;
    };
    const toSourceMatches = (sources?: readonly DecoratorSource[]) =>
        (sources ?? []).map(source => ({
            matchesFile: matcherFor(source.moduleSpecifier),
            exportName: source.exportName,
        }));

    const symbols = resolveInjectorSymbols(program, checker, matcher, {
        injectable: toSourceMatches(options.additionalInjectableDecorators),
        inject: toSourceMatches(options.additionalInjectDecorators),
        optional: toSourceMatches(options.additionalOptionalDecorators),
    });
    const injectableClasses = findInjectableClasses(program, checker, symbols);

    const fromDir = path.dirname(options.outputFile);
    const diagnostics: ts.Diagnostic[] = [];
    const entries: AggregatorEntry[] = [];

    for (const {declaration, sourceFile} of injectableClasses) {
        if (!declaration.name) continue;

        const classSymbol = checker.getSymbolAtLocation(declaration.name);
        if (!classSymbol) continue;

        let classModuleSpecifier = path.relative(fromDir, sourceFile.fileName).replace(/\.[tj]sx?$/, "");
        if (!classModuleSpecifier.startsWith(".")) classModuleSpecifier = `./${classModuleSpecifier}`;
        classModuleSpecifier = classModuleSpecifier.split(path.sep).join("/");

        const dependencies: ResolvedDependency[] = [];
        let hasError = false;

        for (const param of getConstructorParameters(declaration)) {
            const resolution = resolveParameter(checker, param, symbols, fromDir);
            if (resolution.kind === "error") {
                hasError = true;
                diagnostics.push(createDiagnostic(resolution.error.node, resolution.error.message));
                continue;
            }
            dependencies.push(resolution.dependency);
        }

        if (hasError) continue;

        entries.push({
            classImport: {kind: "import", moduleSpecifier: classModuleSpecifier, exportName: classSymbol.name},
            dependencies,
        });
    }

    if (diagnostics.length > 0) {
        return {success: false, diagnostics};
    }

    const source = generateAggregatorSource(entries, injectorModuleSpecifier);
    ts.sys.writeFile(options.outputFile, source);

    return {success: true, outputFile: options.outputFile, classCount: entries.length};
}
