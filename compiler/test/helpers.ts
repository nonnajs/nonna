import path from "node:path";
import ts from "typescript";

import {createInjectorModuleMatcher} from "../src/module-resolution";
import {resolveInjectorSymbols} from "../src/scanner";
import type {InjectorSymbols} from "../src/scanner";

export const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
export const INJECTOR_LIKE_FILE = path.join(FIXTURES_DIR, "injector-like.ts");

export function fixturePath(...segments: string[]): string {
    return path.join(FIXTURES_DIR, ...segments);
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    experimentalDecorators: true,
    strict: false,
    skipLibCheck: true,
    noEmit: true,
};

export function createFixtureProgram(rootFiles: readonly string[]): {
    program: ts.Program;
    checker: ts.TypeChecker;
    symbols: InjectorSymbols;
} {
    const program = ts.createProgram({rootNames: rootFiles, options: COMPILER_OPTIONS});
    const checker = program.getTypeChecker();
    const symbols = resolveInjectorSymbols(program, checker, fileName => fileName === INJECTOR_LIKE_FILE);
    return {program, checker, symbols};
}

/**
 * Same as `createFixtureProgram()`, but also recognizes the `nodeboot-like` fixture package's
 * `Component`/`Inject` as additional decorator sources - simulating a framework (Node-Boot) built
 * on top of `@nonna/di` that registers its own decorators as equivalent triggers. `nodeboot-like`
 * is a real package under `test/fixtures/node_modules/`, resolved the same way the real
 * `@nodeboot/core` would be in production.
 */
export function createFixtureProgramWithAdditionalSources(rootFiles: readonly string[]): {
    program: ts.Program;
    checker: ts.TypeChecker;
    symbols: InjectorSymbols;
} {
    const program = ts.createProgram({rootNames: rootFiles, options: COMPILER_OPTIONS});
    const checker = program.getTypeChecker();
    const matchesNodeBootLike = createInjectorModuleMatcher(FIXTURES_DIR, "nodeboot-like");
    const symbols = resolveInjectorSymbols(program, checker, fileName => fileName === INJECTOR_LIKE_FILE, {
        injectable: [{matchesFile: matchesNodeBootLike, exportName: "Component"}],
        inject: [{matchesFile: matchesNodeBootLike, exportName: "Inject"}],
    });
    return {program, checker, symbols};
}
