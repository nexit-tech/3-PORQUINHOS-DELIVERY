import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// O lint deste projeto estava quebrado: o config importava "eslint/config",
// que só existe no ESLint 9, mas o package.json travava o ESLint em 8.57.
// Ou seja, `npx eslint` sempre morria antes de checar qualquer arquivo — e
// por isso ninguém viu o erro de hooks na Navbar.
//
// O .eslintrc.json legado também foi removido: com um eslint.config.mjs
// presente, o ESLint ignora o formato antigo. Aquelas regras (inclusive
// "react-hooks/rules-of-hooks": "off") nunca chegaram a valer.
//
// FlatCompat traduz os presets do eslint-config-next, que ainda são escritos
// no formato antigo, para o flat config.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "next-env.d.ts",
      ".electron-build-backup/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Ruído no código atual — avisa, mas não trava
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",

      // Esta fica ligada de propósito: é a regra que pega
      // "useEffect declarado depois de um return condicional".
      "react-hooks/rules-of-hooks": "error",
    },
  },
];

export default eslintConfig;
