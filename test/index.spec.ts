import { rmSync } from "fs-extra";
import { kratosRuntime } from "./../index";
import { expect } from "chai";
import { existsSync } from "fs-extra";

const TEST_OUTPUT = "test-output";
function cleanupOutput() {
  if (existsSync(TEST_OUTPUT)) {
    // ensureDirSync(TEST_OUTPUT);
    rmSync(TEST_OUTPUT, { force: true, recursive: true });
  }
}
before(() => {
  cleanupOutput();
});

after(() => {
  cleanupOutput();
});

describe("[unit] assertion test", () => {
  it(`should expect as expectation`, () => {
    expect(true).to.be.true;
    expect([1, 2, 3]).to.have.lengthOf.greaterThanOrEqual(3);
  });
});

describe("[unit] RuntimeWorkspace", () => {
  it("should be able to create an instance of RuntimeWorkspace", () => {
    expect(true).to.be.true;
    new kratosRuntime.RuntimeWorkspace(TEST_OUTPUT);
    expect(() => {}).to.not.throws();
  });
});
