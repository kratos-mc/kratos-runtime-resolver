import { workspace, download } from "kratos-core";
import {
  PathLike,
  ensureDir,
  existsSync,
  moveSync,
  readJsonSync,
  removeSync,
  writeJsonSync,
} from "fs-extra";
import { join as pathJoin } from "path";
import fetch from "node-fetch";
import AdminZip from "adm-zip";

export namespace kratosRuntime {
  export class RuntimeWorkspace extends workspace.Workspace {
    private map: RuntimeMap;
    private repository: RuntimeRepositoryManager;

    constructor(cwd?: string) {
      super(cwd !== undefined ? pathJoin(cwd, "runtime") : "runtime");

      this.map = new RuntimeMap(this);
      this.repository = new RuntimeRepositoryManager();
    }

    /**
     *
     * @returns an instance of {@link RuntimeMap}
     */
    public getRuntimeMap() {
      return this.map;
    }

    public getRepository() {
      return this.repository;
    }

    public getTemporaryDir() {
      return pathJoin(this.getDirectory().toString(), "temp");
    }

    public async downloadRuntime(
      major: number,
      platform: RuntimeBuildOs,
      arch: RuntimeBuildArchitecture
    ) {
      if (major === undefined || platform === undefined || arch === undefined) {
        throw new Error(`Invalid parameter`);
      }

      if (
        platform !== "linux" &&
        platform !== "mac" &&
        platform !== "windows"
      ) {
        throw new Error(`Invalid platform: ${platform}`);
      }

      if (arch !== "x64" && arch !== "x86") {
        throw new Error(`Invalid architecture: ${arch}`);
      }

      // Create a new download process
      const process = this.getRepository().createRuntimeDownloadProcess(
        {
          version: major,
          os: platform,
          arch,
        },
        pathJoin(
          this.getTemporaryDir(),
          `${major}_${arch}_${platform}.${
            platform === `windows` ? `zip` : `tar.gz`
          }`
        )
      );

      // wait for success
      const downloadInfo = (await process).startDownload();
      const extractPath = pathJoin(this.getDirectory().toString());

      // If the extract path is not exists, make it
      if (!existsSync(extractPath)) {
        ensureDir(extractPath);
      }

      // extract the runtime
      if (platform === "windows") {
        // extract using .zip
        RuntimeExtractor.extractZip(
          (await downloadInfo).destination,
          extractPath
        );
      } else {
        // extract using .tar.gz
        await RuntimeExtractor.extractTarGz(
          (
            await downloadInfo
          ).destination,
          extractPath
        );
      }

      const releaseName = this.repository.getCachedReleaseName(major);
      const exportPathName = pathJoin(extractPath, `jdk_${major}`);

      if (existsSync(exportPathName)) {
        removeSync(exportPathName);
      }
      moveSync(pathJoin(extractPath, releaseName), exportPathName);

      // Push into runtime map
      this.map.setRuntime({
        major,
        path: exportPathName,
        bin:
          platform === "mac"
            ? pathJoin(exportPathName, "Contents", "Home", "bin")
            : pathJoin(exportPathName, "bin"),
      });

      // Store runtime map
      this.getRuntimeMap().saveFile();

      // Clean up
      removeSync((await downloadInfo).destination);

      return exportPathName;
    }
  }

  export interface RuntimeMapEntry {
    major: number;
    path: PathLike;
    bin: PathLike;
  }

  export class RuntimeMap {
    private readonly _filePath: PathLike;
    private readonly _runtimeMap: Map<number, RuntimeMapEntry> = new Map();

    constructor(runtimeWorkspace: RuntimeWorkspace) {
      this._filePath = pathJoin(
        runtimeWorkspace.getDirectory().toString(),
        "runtime_map.json"
      );

      // Check if the map is exists or not
      let runtimeList: RuntimeMapEntry[] = [];
      if (existsSync(this._filePath)) {
        runtimeList = readJsonSync(this._filePath, { throws: true });
      } else {
        // Write a new file and load it
        writeJsonSync(this._filePath, []);
      }

      for (const r of runtimeList) {
        const { major } = r;
        if (this._runtimeMap.has(major)) {
          throw new Error(`Invalid runtime map (duplicated key)`);
        }

        this._runtimeMap.set(major, r);
      }
    }

    public getCacheMap() {
      return this._runtimeMap;
    }

    public getFilePath(): PathLike {
      return this._filePath;
    }

    public hasRuntime(major: number) {
      return this._runtimeMap.has(major);
    }

    public getRuntime(major: number) {
      return this._runtimeMap.get(major);
    }

    public setRuntime(runtimeEntry: RuntimeMapEntry) {
      return this._runtimeMap.set(runtimeEntry.major, runtimeEntry);
    }

    public saveFile() {
      let _buildValues = [];

      for (const i of this._runtimeMap.values()) {
        _buildValues.push(i);
      }
      writeJsonSync(this._filePath, _buildValues);
    }
  }

  export type RuntimeBuildArchitecture = "x64" | "x86";

  export type RuntimeBuildOs = "linux" | "windows" | "mac";

  export interface RuntimeBuildOptions {
    version?: number;
    arch?: RuntimeBuildArchitecture;
    os?: RuntimeBuildOs;
  }

  interface Package {
    checksum: string;
    checksum_link: string;
    download_count: number;
    link: string;
    metadata_link: string;
    name: string;
    signature_link: string;
    size: number;
  }

  interface Binary {
    architecture: string;
    download_count: number;
    heap_size: string;
    image_type: string;
    jvm_impl: string;
    os: string;
    package: Package;
    project: string;
    scm_ref: string;
    updated_at: string;
  }

  interface Version {
    build: number;
    major: number;
    minor: number;
    openjdk_version: string;
    security: number;
    semver: string;
  }

  interface Release {
    binary: Binary;
    release_link: string;
    release_name: string;
    vendor: string;
    version: Version;
  }

  export class RuntimeRepositoryManager {
    private cachedReleaseNameMap: Map<number, string> = new Map();
    /**
     * Retrieves a url which built from `https://api.adoptium.net/v3/assets/latest/...`.
     *
     * The options parameter provided platform, java runtime version,
     *  and architecture for the url.
     *
     * @param options an options for build function
     * @returns a jdk property url as json
     */
    public buildJdkPackageInfoUrl(options?: RuntimeBuildOptions): URL {
      // Platform check
      if (
        options &&
        options.os &&
        options.os !== "linux" &&
        options.os !== "mac" &&
        options.os !== "windows"
      ) {
        throw new Error(`Invalid platform from options.os ${options.os}`);
      }

      if (
        options &&
        options.arch &&
        options.arch !== "x64" &&
        options.arch !== "x86"
      ) {
        throw new Error(
          `Invalid architecture from options.arch ${options.arch}`
        );
      }

      let url = new URL("https://api.adoptium.net");
      // Add path name
      url.pathname = `v3/assets/latest/${
        (options && options.version) || 8
      }/hotspot`;
      // Add search params
      url.searchParams.append(
        "architecture",
        (options && options.arch) || "x64"
      );
      url.searchParams.append("image_type", "jdk");
      url.searchParams.append("os", (options && options.os) || "windows");
      url.searchParams.append("vendor", "eclipse");

      return url;
    }

    public async fetchPackageInfo(buildOptions?: RuntimeBuildOptions) {
      // Fetch the package info first
      const response = await fetch(
        this.buildJdkPackageInfoUrl(buildOptions).toString(),
        {}
      );
      const bodyAsJson: Release[] = await response.json();

      if (bodyAsJson.length === 0) {
        throw new Error(
          `Invalid runtime package info. Check your runtime version, os, or arch.`
        );
      }
      const firstRelease = bodyAsJson[0];

      // Store as cached name
      this.cachedReleaseNameMap.set(
        buildOptions.version,
        firstRelease.release_name
      );

      return firstRelease;
    }

    /**
     * Creates a {@link DownloadMatchingProcess} binary downloader from option.
     *
     * This function first fetch the package info from the version taken from option parameter.
     * Then get the link and checksum value and create a new download process.
     *
     * @param buildOptions a build options for construct an url . See {@link RuntimeBuildOptions}.
     * @param destination a destination of download info.
     * @returns a download info contains url and destination
     */
    public async createRuntimeDownloadProcess(
      buildOptions: RuntimeBuildOptions,
      destination: string,
      options?: download.DownloadMatchingProcess
    ): Promise<download.DownloadMatchingProcess> {
      const packageInfo = await this.fetchPackageInfo(buildOptions);

      const { link, checksum } = packageInfo.binary.package;
      // packageInfo.release_name this is the name of extracted directory

      const downloadInfo: download.DownloadInfo = {
        destination,
        url: new URL(link),
      };

      return new download.DownloadMatchingProcess(downloadInfo, checksum, {
        algorithm: "sha256",
        ...options,
      });
    }

    /**
     * Retrieves a cached release name from map that stored when executes fetch package info.
     *
     * @param major the major version of runtime
     * @returns a cached release name that fetch when executes {@link RuntimeRepositoryManager#fetchPackageInfo}
     */
    public getCachedReleaseName(major: number) {
      return this.cachedReleaseNameMap.get(major);
    }
  }

  export class RuntimeExtractor {
    public static extractZip(from: PathLike | string, to: PathLike | string) {
      // Check the path exists
      if (!existsSync(from)) {
        throw new Error(`The path is not exists: ${from}`);
      }

      const zip = new AdminZip(from.toString());
      zip.extractAllTo(to.toString(), true);
    }

    public static async extractTarGz(
      from: PathLike | string,
      to: PathLike | string
    ) {
      // Check the path exists
      if (!existsSync(from)) {
        throw new Error(`The path is not exists: ${from}`);
      }

      await (
        await import("tar")
      ).x({ file: from.toString(), cwd: to.toString() });
    }
  }
}
