#!/usr/bin/env node

import path from "node:path";

import {compile} from "./compile";
import {formatDiagnostics} from "./diagnostics";

function parseArgs(argv: readonly string[]): {project: string; outputFile: string} {
    let project = "tsconfig.json";
    let outputFile = path.join("src", "__generated__", "nonna-dependencies.generated.ts");

    for (let i = 0; i < argv.length; i++) {
        if ((argv[i] === "--project" || argv[i] === "-p") && argv[i + 1]) {
            project = argv[++i]!;
        } else if ((argv[i] === "--output" || argv[i] === "-o") && argv[i + 1]) {
            outputFile = argv[++i]!;
        }
    }

    return {project: path.resolve(process.cwd(), project), outputFile: path.resolve(process.cwd(), outputFile)};
}

function main(): void {
    const {project, outputFile} = parseArgs(process.argv.slice(2));

    console.info("===================== Nonna Compiler =====================");
    const result = compile({project, outputFile});

    if (!result.success) {
        console.error(formatDiagnostics(result.diagnostics));
        console.error(`❌ ${result.diagnostics.length} dependency resolution error(s). No file was generated.`);
        process.exit(1);
    }

    console.info(`✅ Generated dependencies for ${result.classCount} class(es) at ${result.outputFile}`);
}

main();
