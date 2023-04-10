import {
  accessSync,
  readJsonSync,
  removeSync,
  rmSync,
  writeFileSync,
  writeJsonSync,
} from "fs-extra";
import { kratosRuntime } from "./../index";
import { expect } from "chai";
import { existsSync } from "fs-extra";
import fse from "fs-extra";
import { join as pathJoin } from "path";
import { getTestOutput } from "./utils/file";

const TEST_OUTPUT = getTestOutput();
/**
 * Since download test-cases require longer duration.
 */
const TEST_DOWNLOAD_DURATION = process.env.TEST_SKIP_DURATION || 50000;

/**
 * Skip download test
 */
const SKIP_DOWNLOAD_TEST = process.env.SKIP_DOWNLOAD_TEST || false;

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

  describe("initialed a instance", () => {
    let runtimeWorkspace = new kratosRuntime.RuntimeWorkspace(TEST_OUTPUT);

    it(`should throw when download invalid parameter`, () => {
      return Promise.resolve([
        expect(
          runtimeWorkspace.downloadRuntime(
            17,
            "kali-linux" as kratosRuntime.RuntimeBuildOs,
            "x64"
          )
        ).to.be.rejectedWith(Error, /Invalid platform/),
        expect(
          runtimeWorkspace.downloadRuntime(
            17,
            "mac",
            "x128" as kratosRuntime.RuntimeBuildArchitecture
          )
        ).to.be.rejectedWith(Error, /Invalid architecture/),
        expect(
          runtimeWorkspace.downloadRuntime(
            17,
            "mac",
            undefined as unknown as kratosRuntime.RuntimeBuildArchitecture
          )
        ).to.rejectedWith(Error, /Invalid parameter/),
        expect(
          runtimeWorkspace.downloadRuntime(
            17,
            undefined as unknown as kratosRuntime.RuntimeBuildOs,
            "x64"
          )
        ).to.be.rejectedWith(Error, /Invalid parameter/),
      ]);
    });

    describe("should create a download and extract into main workspace directory for", function () {
      this.timeout(TEST_DOWNLOAD_DURATION);
      beforeEach(function () {
        // If the download test skipper is active
        if (SKIP_DOWNLOAD_TEST) {
          this.skip();
        }
      });

      afterEach(() => {
        removeSync(
          pathJoin(runtimeWorkspace.getDirectory().toString(), `jdk_8`)
        );
      });

      it(`windows`, async function () {
        const extractedPath = await runtimeWorkspace.downloadRuntime(
          8,
          "windows",
          "x64"
        );
        expect(existsSync(extractedPath)).to.be.true;
        expect(existsSync(pathJoin(extractedPath, "bin", "java.exe"))).to.be
          .true;

        // Map assertion
        expect(runtimeWorkspace.getRuntimeMap().hasRuntime(8));
        let runtimeFromMap = runtimeWorkspace.getRuntimeMap().getRuntime(8);
        expect(runtimeFromMap).to.not.be.undefined;
        expect(runtimeFromMap?.path).to.eq(extractedPath);
        expect(existsSync(runtimeFromMap?.path as string)).to.be.true;

        expect(runtimeWorkspace.getLatestRuntimeEntry()).to.not.be.undefined;
        expect(runtimeWorkspace.getLatestRuntimeEntry()).to.have.keys([
          "bin",
          "path",
          "major",
        ]);

        expect(runtimeWorkspace.getLatestRuntimeEntry()?.bin).to.includes(
          extractedPath
        );
      });

      it(`macos`, async function () {
        const extractedPath = await runtimeWorkspace.downloadRuntime(
          8,
          "mac",
          "x64"
        );
        expect(existsSync(extractedPath)).to.be.true;
        expect(
          existsSync(pathJoin(extractedPath, "Contents", "Home", "bin", "java"))
        ).to.be.true;
        // Map assertion
        expect(runtimeWorkspace.getRuntimeMap().hasRuntime(8));
        let runtimeFromMap = runtimeWorkspace.getRuntimeMap().getRuntime(8);
        expect(runtimeFromMap).to.not.be.undefined;
        expect(runtimeFromMap?.path).to.eq(extractedPath);
        expect(existsSync(runtimeFromMap?.path as string)).to.be.true;

        expect(runtimeWorkspace.getLatestRuntimeEntry()).to.not.be.undefined;
        expect(runtimeWorkspace.getLatestRuntimeEntry()).to.have.keys([
          "bin",
          "path",
          "major",
        ]);

        expect(runtimeWorkspace.getLatestRuntimeEntry()?.bin).to.includes(
          extractedPath
        );
      });

      it(`linux`, async function () {
        const extractedPath = await runtimeWorkspace.downloadRuntime(
          8,
          "linux",
          "x64"
        );
        expect(existsSync(extractedPath)).to.be.true;
        expect(existsSync(pathJoin(extractedPath, "bin", "java"))).to.be.true;
        // Map assertion
        expect(runtimeWorkspace.getRuntimeMap().hasRuntime(8));
        let runtimeFromMap = runtimeWorkspace.getRuntimeMap().getRuntime(8);
        expect(runtimeFromMap).to.not.be.undefined;
        expect(runtimeFromMap?.path).to.eq(extractedPath);
        expect(existsSync(runtimeFromMap?.path as string)).to.be.true;

        expect(runtimeWorkspace.getLatestRuntimeEntry()).to.not.be.undefined;
        expect(runtimeWorkspace.getLatestRuntimeEntry()).to.have.keys([
          "bin",
          "path",
          "major",
        ]);

        expect(runtimeWorkspace.getLatestRuntimeEntry()?.bin).to.includes(
          extractedPath
        );
      });
    });
  });
});

describe("[unit] RuntimeMap", () => {
  describe("the map file is unavailable", () => {
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
        r.setRuntime({
          major: 7,
          path: pathJoin(TEST_OUTPUT, "major-7"),
          bin: pathJoin(TEST_OUTPUT, "major-7", "bin"),
        })
      ).not.to.throws();
      expect(r.getRuntime(7)).to.not.be.undefined;
      expect(r.getRuntime(7)).have.keys(["major", "path", "bin"]);
    });

    it(`should save a file`, () => {
      let r = new kratosRuntime.RuntimeMap(runtimeWorkspace);
      r.setRuntime;
      expect(() =>
        r.setRuntime({
          major: 7,
          path: pathJoin(TEST_OUTPUT, "major-7"),
          bin: pathJoin(TEST_OUTPUT, "major-7", "bin"),
        })
      ).not.to.throws();

      r.saveFile();

      let a = readJsonSync(r.getFilePath());
      expect(a).to.not.be.undefined;
      expect(a).to.be.an("array");

      expect(a).to.have.lengthOf.gt(0);

      expect(r.hasRuntime(7)).to.be.true;
      expect(r.getHighestMajor()).not.to.be.undefined;
      expect(r.getHighestMajor()).to.gt(0);
    });
  });

  describe("the map is invalid format (not json)", () => {
    let _path = pathJoin(TEST_OUTPUT, "runtime", "runtime_map.json");

    before(() => {
      // If the path is exists, find and remove it before test, and also write an invalid test
      if (existsSync(_path)) {
        rmSync(_path, { recursive: true, force: true });
        writeFileSync(_path, "null or undefined text");
      }
    });

    it(`should throw an error when building a map`, () => {
      expect(
        () =>
          new kratosRuntime.RuntimeMap(
            new kratosRuntime.RuntimeWorkspace(TEST_OUTPUT)
          )
      ).to.throws(/Unexpected token/);
    });
  });

  describe("duplicated map", () => {
    let _path = pathJoin(TEST_OUTPUT, "runtime", "runtime_map.json");
    before(() => {
      // If the path is exists, find and remove it before test, and also write an invalid test
      if (existsSync(_path)) {
        rmSync(_path, { recursive: true, force: true });
        writeJsonSync(_path, [
          {
            major: 8,
            path: "a/b/c",
          },
          {
            major: 8,
            path: "b/c/d",
          },
        ]);
      }
    });
    after(() => {
      removeSync(_path);
    });

    it(`should throw an error when filling a map`, () => {
      expect(
        () =>
          new kratosRuntime.RuntimeMap(
            new kratosRuntime.RuntimeWorkspace(TEST_OUTPUT)
          )
      ).to.throws(/Invalid runtime map/);
    });
  });
});

describe("[unit] RuntimeRepositoryManager", () => {
  const repositoryManager = new kratosRuntime.RuntimeRepositoryManager();
  it(`should build a valid jdk url`, () => {
    expect(
      repositoryManager
        .buildJdkPackageInfoUrl({ version: 8, arch: "x64", os: "mac" })
        .toString()
    ).to.eq(
      `https://api.adoptium.net/v3/assets/latest/8/hotspot?architecture=x64&image_type=jdk&os=mac&vendor=eclipse`
    );

    expect(repositoryManager.buildJdkPackageInfoUrl().toString()).to.eq(
      `https://api.adoptium.net/v3/assets/latest/8/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse`
    );

    expect(
      repositoryManager.buildJdkPackageInfoUrl({ version: -1 }).toString()
    ).to.eq(
      `https://api.adoptium.net/v3/assets/latest/-1/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse`
    );
  });

  it(`should throw with invalid architecture or platform`, () => {
    expect(() =>
      repositoryManager.buildJdkPackageInfoUrl({ arch: "nothing" as any })
    ).to.throw(/Invalid architecture from options.arch nothing/);

    expect(() =>
      repositoryManager.buildJdkPackageInfoUrl({ os: "nothing" as any })
    ).to.throw(/Invalid platform from options.os nothing/);
  });

  it(`should create a download process`, async function () {
    if (SKIP_DOWNLOAD_TEST) {
      return this.skip();
    }

    this.timeout(50000);
    const downloadProcess =
      await repositoryManager.createRuntimeDownloadProcess(
        { version: 8, arch: "x64", os: "windows" },
        pathJoin(TEST_OUTPUT, "download", "runtime", "8.tar.gz")
      );

    expect(downloadProcess).not.to.be.undefined;

    let downloadInfo = await downloadProcess.startDownload();
    expect(existsSync(downloadInfo.destination)).to.be.true;

    // Then remove the file
    rmSync("download", { force: true, recursive: true });
  });
});
