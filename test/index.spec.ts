import { accessSync, readJsonSync, rmSync } from "fs-extra";
import { kratosRuntime } from "./../index";
import { expect } from "chai";
import { existsSync } from "fs-extra";
import fse from "fs-extra";
import { join as pathJoin } from "path";

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

describe("[unit] RuntimeMap", () => {
  let runtimeWorkspace = new kratosRuntime.RuntimeWorkspace(TEST_OUTPUT);
  it(`should make a new instance successfully`, () => {
    let runtimeMap = new kratosRuntime.RuntimeMap(runtimeWorkspace);

    expect(runtimeMap).to.not.be.undefined;
    expect(existsSync(runtimeMap.getFilePath())).to.be.true;
  });

  it(`should success a simple operation`, () => {
    let r = new kratosRuntime.RuntimeMap(runtimeWorkspace);
    expect(r).not.to.be.undefined;
    expect(r.getCacheMap()).not.to.be.undefined;
    expect(r.getRuntime(7)).to.be.undefined;

    expect(() =>
      r.setRuntime({ major: 7, path: pathJoin(TEST_OUTPUT, "major-7") })
    ).not.to.throws();
    expect(r.getRuntime(7)).to.not.be.undefined;
    expect(r.getRuntime(7)).have.keys(["major", "path"]);
  });

  it(`should save a file`, () => {
    let r = new kratosRuntime.RuntimeMap(runtimeWorkspace);
    r.setRuntime;
    expect(() =>
      r.setRuntime({ major: 7, path: pathJoin(TEST_OUTPUT, "major-7") })
    ).not.to.throws();

    r.saveFile();

    let a = readJsonSync(r.getFilePath());
    expect(a).to.not.be.undefined;
    expect(a).to.be.an("array");

    expect(a).to.have.lengthOf.gt(0);

    expect(r.hasRuntime(7)).to.be.true;
  });
});
