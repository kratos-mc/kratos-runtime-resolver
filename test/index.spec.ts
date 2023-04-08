import { accessSync, rmSync } from "fs-extra";
import { kratosRuntime } from "./../index";
import { expect } from "chai";
import { existsSync } from "fs-extra";
import fse from "fs-extra";

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
    let t = new kratosRuntime.RuntimeWorkspace(TEST_OUTPUT);
    expect(existsSync(t.getDirectory())).to.be.true;
    expect(() =>
      accessSync(
        t.getDirectory(),
        fse.constants.R_OK | fse.constants.W_OK | fse.constants.X_OK
      )
    ).to.not.be.throw();
  });
});
