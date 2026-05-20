import js from "@eslint/js";
import tseslint from "typescript-eslint";

const maxLinesOptions = {
  max: 300,
  skipBlankLines: true,
  skipComments: true
};

const qualityRules = {
  "max-lines": ["error", maxLinesOptions],
  "no-console": "error",
  "no-debugger": "error",
  "no-restricted-syntax": [
    "error",
    {
      selector: "IfStatement[alternate]",
      message:
        "Do not use else branches. Use early returns or a strategy/dispatch table."
    },
    {
      selector: "IfStatement IfStatement",
      message:
        "Do not nest if blocks. Use guards, extracted functions, or a strategy/dispatch table."
    }
  ],
  "no-var": "error",
  "prefer-const": "error",
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_"
    }
  ]
};

export default tseslint.config(
  {
    ignores: [".marc/**", ".marc-daemon/**", "dist/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["eslint.config.js"],
    rules: qualityRules
  },
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.ts"],
    rules: qualityRules
  },
  {
    files: ["src/cli.ts", "src/daemon/server.ts"],
    rules: {
      "no-console": "off"
    }
  }
);
