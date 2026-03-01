// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import security from "eslint-plugin-security";
import noSecrets from "eslint-plugin-no-secrets";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [

  // Base JS rules
  js.configs.recommended,

  // Backend (Node / Electron main)
  {
    files: ["backend/**/*.js", "index.js", "preload.js"],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      security,
      "no-secrets": noSecrets,
    },
    rules: {
      // Manually enable security rules (flat-safe)
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-require": "warn",
      "security/detect-eval-with-expression": "error",
      "security/detect-unsafe-regex": "warn",

      "no-secrets/no-secrets": ["error", { tolerance: 4.2 }],

      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },

  // Frontend (React + Vite)
  {
    files: ["frontend/**/*.{js,jsx}"],
    languageOptions: {
      globals: globals.browser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      security,
    },
    rules: {
      // React hooks rules (flat-safe)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Vite fast refresh rule
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Security subset
      "security/detect-unsafe-regex": "warn",

      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
    },
  },

  // Global ignores
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "frontend/dist/**",
      "coverage/**",
    ],
  },
];
