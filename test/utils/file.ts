/**
 *
 * @returns a test output from process.env or use default as `test-output`.
 */
export function getTestOutput() {
  return process.env.TEST_OUTPUT || "test-output";
}
