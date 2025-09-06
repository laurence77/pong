import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    ignores: ["icons/**", "node_modules/**"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        performance: "readonly",
        fetch: "readonly",
        requestAnimationFrame: "readonly",
        localStorage: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-constant-condition": "off",
      "no-console": "off",
      "no-empty": ["warn", { "allowEmptyCatch": true }]
    }
  },
  // Node scripts
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        require: "readonly",
        module: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly"
      }
    }
  },
  // Service worker
  {
    files: ["sw.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        clients: "readonly"
      }
    }
  }
];
