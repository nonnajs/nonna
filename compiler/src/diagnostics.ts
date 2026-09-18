import ts from "typescript";

/** Custom diagnostic codes live in the 9xxx range to avoid colliding with TypeScript's own. */
export const UNRESOLVED_DEPENDENCY_CODE = 9001;

export function createDiagnostic(node: ts.Node, message: string): ts.DiagnosticWithLocation {
    const sourceFile = node.getSourceFile();
    return {
        category: ts.DiagnosticCategory.Error,
        code: UNRESOLVED_DEPENDENCY_CODE,
        file: sourceFile,
        start: node.getStart(sourceFile),
        length: node.getWidth(sourceFile),
        messageText: message,
    };
}

export function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
    return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => process.cwd(),
        getCanonicalFileName: fileName => fileName,
        getNewLine: () => ts.sys.newLine,
    });
}
