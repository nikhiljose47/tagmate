import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularTemplateParser from '@angular-eslint/template-parser';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'worker-configuration.d.ts'],
  },
  {
    files: ['src/**/*.ts'],
    extends: [tseslint.configs.recommended],
    plugins: { '@angular-eslint': angular },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['src/**/*.html'],
    languageOptions: { parser: angularTemplateParser },
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: angularTemplate.configs.recommended.rules,
  },
);
