import { defineProject, mergeConfig } from 'vitest/config'
import configShared from '../../vitest.config'

export default mergeConfig(
  configShared,
  defineProject({
    test: {
    pool: 'threads',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts']
  }})
)