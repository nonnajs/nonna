import fs from "node:fs";
import path from "node:path";

import type {DecoratorSource} from "./compile";

/** Name of the optional config file the `nonna-compile` CLI looks for. */
export const NONNA_CONFIG_FILE = ".nonna.json";

/**
 * Contents of a `.nonna.json`, used by the `nonna-compile` CLI to recognize decorators from
 * frameworks built on top of `@nonnajs/di`. Each decorator entry is a `"<module>#<exportName>"`
 * string, e.g. `"@my-framework/core#Component"`.
 *
 * A framework ships its own `.nonna.json` in its published package: the CLI picks up the file of every
 * package the project depends on, so applications need no configuration of their own. A project's own
 * `.nonna.json` is merged on top.
 */
export interface NonnaConfig {
    injectableDecorators?: readonly string[];
    injectDecorators?: readonly string[];
    optionalDecorators?: readonly string[];
    /** Module the generated file imports `defineDependencies` from (it must re-export it). */
    defineDependenciesModule?: string;
}

export interface CliCompileOptions {
    additionalInjectableDecorators: DecoratorSource[];
    additionalInjectDecorators: DecoratorSource[];
    additionalOptionalDecorators: DecoratorSource[];
    generatedImportSpecifier?: string;
}

export function parseDecoratorSource(spec: string): DecoratorSource {
    const separator = spec.lastIndexOf("#");
    if (separator <= 0 || separator === spec.length - 1) {
        throw new Error(`Invalid decorator source "${spec}": expected "<module>#<exportName>".`);
    }
    return {moduleSpecifier: spec.slice(0, separator), exportName: spec.slice(separator + 1)};
}

function unique(values: Iterable<string>): string[] {
    return [...new Set(values)];
}

/** Merges configs in order: decorator lists are concatenated, and a later `defineDependenciesModule` wins. */
export function mergeNonnaConfigs(configs: readonly NonnaConfig[]): NonnaConfig {
    const merged: {
        injectableDecorators: string[];
        injectDecorators: string[];
        optionalDecorators: string[];
        defineDependenciesModule?: string;
    } = {injectableDecorators: [], injectDecorators: [], optionalDecorators: []};
    for (const config of configs) {
        merged.injectableDecorators.push(...(config.injectableDecorators ?? []));
        merged.injectDecorators.push(...(config.injectDecorators ?? []));
        merged.optionalDecorators.push(...(config.optionalDecorators ?? []));
        if (config.defineDependenciesModule) merged.defineDependenciesModule = config.defineDependenciesModule;
    }
    merged.injectableDecorators = unique(merged.injectableDecorators);
    merged.injectDecorators = unique(merged.injectDecorators);
    merged.optionalDecorators = unique(merged.optionalDecorators);
    return merged;
}

export function compileOptionsFromConfig(config: NonnaConfig | undefined): CliCompileOptions {
    return {
        additionalInjectableDecorators: (config?.injectableDecorators ?? []).map(parseDecoratorSource),
        additionalInjectDecorators: (config?.injectDecorators ?? []).map(parseDecoratorSource),
        additionalOptionalDecorators: (config?.optionalDecorators ?? []).map(parseDecoratorSource),
        ...(config?.defineDependenciesModule ? {generatedImportSpecifier: config.defineDependenciesModule} : {}),
    };
}

function readConfigFile(file: string): NonnaConfig | undefined {
    if (!fs.existsSync(file)) return undefined;
    try {
        return JSON.parse(fs.readFileSync(file, "utf8")) as NonnaConfig;
    } catch (error) {
        throw new Error(`Could not parse ${file}: ${(error as Error).message}`);
    }
}

/** Finds the installed directory of `packageName`, walking up `node_modules` folders from `fromDir`. */
function findInstalledPackageDir(packageName: string, fromDir: string): string | undefined {
    let current = fromDir;
    for (;;) {
        const candidate = path.join(current, "node_modules", packageName);
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(current);
        if (parent === current) return undefined;
        current = parent;
    }
}

/**
 * Loads the effective config for `projectDir`: the `.nonna.json` shipped by each package listed in
 * the project's `package.json` dependencies (in declaration order), then the project's own `.nonna.json`.
 */
export function loadNonnaConfig(projectDir: string): NonnaConfig {
    const configs: NonnaConfig[] = [];

    const manifest = path.join(projectDir, "package.json");
    if (fs.existsSync(manifest)) {
        const pkg = JSON.parse(fs.readFileSync(manifest, "utf8")) as Record<string, Record<string, string> | undefined>;
        const names = unique([
            ...Object.keys(pkg["dependencies"] ?? {}),
            ...Object.keys(pkg["devDependencies"] ?? {}),
            ...Object.keys(pkg["peerDependencies"] ?? {}),
        ]);
        for (const name of names) {
            const dir = findInstalledPackageDir(name, projectDir);
            const config = dir ? readConfigFile(path.join(dir, NONNA_CONFIG_FILE)) : undefined;
            if (config) configs.push(config);
        }
    }

    const own = readConfigFile(path.join(projectDir, NONNA_CONFIG_FILE));
    if (own) configs.push(own);
    return mergeNonnaConfigs(configs);
}
