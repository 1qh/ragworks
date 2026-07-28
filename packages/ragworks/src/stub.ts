/** biome-ignore-all lint/style/noProcessEnv: the test-mode stub flag is read directly so tests can toggle it after env caches */
const stubbed = (): boolean => process.env.MODELS_STUB === '1'
export { stubbed }
