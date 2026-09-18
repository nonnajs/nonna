import fs from "node:fs";
import path from "node:path";

/**
 * Walks up from a resolved file, looking for the package.json whose "name" matches
 * `packageName` - this is the package's real root directory, however it was reached
 * (plain node_modules install, or a pnpm/yarn workspace symlink).
 */
function findPackageRoot(startFile: string, packageName: string): string | undefined {
    let dir = path.dirname(startFile);
    for (;;) {
        const pkgJsonPath = path.join(dir, "package.json");
        if (fs.existsSync(pkgJsonPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as {name?: string};
                if (pkg.name === packageName) return dir;
            } catch {
                // Not valid JSON or unreadable - keep walking up.
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) return undefined;
        dir = parent;
    }
}

/**
 * Builds a matcher that identifies which Program source files belong to `packageName`.
 *
 * This can't simply check for a literal "/node_modules/<packageName>/" path segment: in a
 * pnpm (or yarn) workspace, `workspace:*` dependencies are symlinked, and TypeScript's module
 * resolution (like Node's own `require`) reports the symlink's *real* path - e.g.
 * `/repo/packages/injector/dist/index.d.ts` - which never contains "node_modules" at all.
 * Resolving the package root via `require.resolve` and comparing against it handles both a
 * plain npm install and a symlinked workspace package identically.
 */
export function createInjectorModuleMatcher(
    fromDir: string,
    packageName = "@nonnajs/di",
): (fileName: string) => boolean {
    let packageRoot: string | undefined;
    try {
        const resolvedEntry = require.resolve(packageName, {paths: [fromDir]});
        packageRoot = findPackageRoot(resolvedEntry, packageName);
    } catch {
        packageRoot = undefined;
    }

    const nodeModulesFallback = new RegExp(`/node_modules/${packageName.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")}/`);

    return (fileName: string) => {
        const normalized = fileName.replace(/\\/g, "/");
        if (packageRoot) {
            const normalizedRoot = packageRoot.replace(/\\/g, "/");
            if (normalized === normalizedRoot || normalized.startsWith(normalizedRoot + "/")) {
                return true;
            }
        }
        return nodeModulesFallback.test(normalized);
    };
}
