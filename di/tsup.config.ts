import {defineConfig} from "tsup";

export default defineConfig({
    entry: {index: "src/index.ts"},
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    platform: "neutral",
    splitting: false,
    treeshake: true,
    minify: false,
    tsconfig: "tsconfig.build.json",
});
