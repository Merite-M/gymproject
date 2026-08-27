import nextPlugin from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const gympartnerDesignSystemPlugin = {
  rules: {
    "no-arbitrary-hex-classes": {
      meta: {
        type: "problem",
        docs: {
          description: "Disallow arbitrary hex color values in Tailwind classes (e.g. bg-[#123456], text-[#abc]). Use GymPartner design tokens instead.",
        },
        messages: {
          noArbitraryHex: "Arbitrary Tailwind hex class '{{value}}' is forbidden. Use a semantic design token instead.",
        },
      },
      create(context) {
        const hexRegex = /(?:bg|text|border|ring|shadow|from|to|via)-\[#[0-9a-fA-F]{3,8}\]/g;
        return {
          Literal(node) {
            if (typeof node.value === "string" && hexRegex.test(node.value)) {
              const matches = node.value.match(hexRegex);
              if (matches) {
                matches.forEach((match) => {
                  context.report({
                    node,
                    messageId: "noArbitraryHex",
                    data: { value: match },
                  });
                });
              }
            }
          },
          TemplateElement(node) {
            if (node.value && node.value.raw && hexRegex.test(node.value.raw)) {
              const matches = node.value.raw.match(hexRegex);
              if (matches) {
                matches.forEach((match) => {
                  context.report({
                    node,
                    messageId: "noArbitraryHex",
                    data: { value: match },
                  });
                });
              }
            }
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: [".next/**", "out/**", "node_modules/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
      "gympartner": gympartnerDesignSystemPlugin,
    },
    rules: {
      // Allow any temporarily
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off", // Suppress exhaust-deps
      "@next/next/no-img-element": "warn",
      "gympartner/no-arbitrary-hex-classes": "error",
    },
  },
];
