import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { getTestOutput } from "./utils/file";
import { removeSync } from "fs-extra";

/**
 * Using chai-as-promised for testing
 */
use(chaiAsPromised);

export async function mochaGlobalSetup() {
  console.log(`Setting up testing env...`);
  console.log(`Test output: ${getTestOutput()}`);
}

export async function mochaGlobalTeardown() {
  console.log(`Tearing down things`);
  removeSync(getTestOutput());
}
