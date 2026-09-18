import ts from "typescript";

export interface CompilerProgram {
    program: ts.Program;
    checker: ts.TypeChecker;
    rootFileNames: readonly string[];
}

/**
 * Builds a real ts.Program (not a syntactic-only ts.createSourceFile pass) from a tsconfig.json
 * path, so the resolver can ask the TypeChecker for actual semantic type information - this is
 * the whole point of this package versus the existing regex-based packages/aot.
 */
export function createProgramFromTsConfig(tsconfigPath: string): CompilerProgram {
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
        throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
    }

    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, tsconfigPath.replace(/[^/\\]+$/, ""));
    if (parsed.errors.length > 0) {
        throw new Error(parsed.errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));
    }

    return createProgramFromRootNames(parsed.fileNames, parsed.options);
}

export function createProgramFromRootNames(
    rootFileNames: readonly string[],
    options: ts.CompilerOptions,
): CompilerProgram {
    const program = ts.createProgram({rootNames: rootFileNames, options});
    return {program, checker: program.getTypeChecker(), rootFileNames};
}

/** TypeScript 4/5 compatible decorator accessor, mirroring node-boot-cycle-detector.ts's helper. */
export function getDecorators(node: ts.Node): readonly ts.Decorator[] | undefined {
    if (ts.canHaveDecorators(node)) {
        return ts.getDecorators(node);
    }
    return undefined;
}

export function isProjectSourceFile(sourceFile: ts.SourceFile): boolean {
    const normalized = sourceFile.fileName.replace(/\\/g, "/");
    return !sourceFile.isDeclarationFile && !normalized.includes("/node_modules/");
}
