export default {
    "*.{ts,tsx,js,jsx}": () => ["pnpm build", "pnpm tsc", "pnpm lint-format:fix"],
    "*.{json,md,css,html}": "prettier --write",
};
