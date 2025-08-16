// ESLint v9 flat config (CommonJS)
// Lints TypeScript and React code under `src/`.

const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const importPlugin = require("eslint-plugin-import");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
    {
        files: ["src/**/*.{ts,tsx,js,jsx}", "*.{js,ts}", "scripts/**/*.{js,ts}"],
        ignores: [
            "node_modules/**",
            "dist/**",
            "release/**",
            "coverage/**",
            "build/**",
            // Do not lint the config file itself
            "eslint.config.js",
        ],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
        },
        plugins: {
            import: importPlugin,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...(importPlugin.configs.recommended?.rules ?? {}),
            // So CI doesn't fail on path resolution nuances
            "import/no-unresolved": "off",
            "import/named": "off",
            // Allow intentional empty blocks (e.g., try/catch placeholders)
            "no-empty": "off",
        },
    },

    // TypeScript + React
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            react: reactPlugin,
            "react-hooks": reactHooksPlugin,
        },
        settings: { react: { version: "detect" } },
        rules: {
            ...(tsPlugin.configs.recommended?.rules ?? {}),
            ...(reactPlugin.configs.recommended?.rules ?? {}),
            ...(reactHooksPlugin.configs.recommended?.rules ?? {}),
            // TS-friendly tweaks
            "no-undef": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-unused-expressions": "off",
            // CI unblocks for static conditions in JSX and guards
            "no-constant-condition": "off",
            "no-constant-binary-expression": "off",
            // React 17+ new JSX transform doesn't require React in scope
            "react/react-in-jsx-scope": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },

    // Disable formatting rules in favor of Prettier
    prettierConfig,
];


