import eslint from "@eslint/js";

export default [
  {
    ignores: [
      "node_modules/**",
      "generated/**",
      "prisma/migrations/**",
    ],
  },

  eslint.configs.recommended,
];
