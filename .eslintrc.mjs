module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: ['dist/', 'node_modules/'],
  overrides: [
    {
      files: ['**/tests/**/*.ts', '**/*.test.ts'],
      env: {
        node: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
};
