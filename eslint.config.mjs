import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";

export default [
    prettierConfig,
    {
        ignores: [
            "**/dist/**",
            "**/node_modules/**",
            "**/coverage/**",
            "**/*.d.ts",
            "**/loader/**",
            "**/www/**",
            "**/stencil-dist/**",
            "**/src/components.d.ts",
        ],
    },
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}"],
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
        rules: {
            "no-cond-assign": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-member-accessibility": 0,
            "@typescript-eslint/explicit-function-return-type": 0,
            "@typescript-eslint/no-parameter-properties": 0,
            "@typescript-eslint/interface-name-prefix": 0,
            "@typescript-eslint/explicit-module-boundary-types": 0,
            "@typescript-eslint/ban-types": "off",
            "@typescript-eslint/no-var-requires": "off",
            "@typescript-eslint/no-unnecessary-type-assertion": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-cond-assign": "off",
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-unsafe-function-type": "off",
        },
    },
];
