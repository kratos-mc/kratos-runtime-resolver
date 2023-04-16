import { workspace, download } from "kratos-core";
import {
  PathLike,
  existsSync,
  moveSync,
  readJsonSync,
  removeSync,
  writeJsonSync,
} from "fs-extra";
import { join as pathJoin } from "path";
import fetch from "node-fetch";
import AdminZip from "adm-zip";
import tar from "tar";

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

    /**
     * Retrieves the instance of repository.
     *
     * @returns the repository manager instance
     */
    public getRepository() {
      return this.repository;
    }

    /**
     * Retrieves the temporary directory path name.
     *
     * The temporary directory is created as a destination to store downloaded files.
     *
     * @returns the temporary directory path name
     */
    public getTemporaryDir() {
      return pathJoin(this.getDirectory().toString(), "temp");
    }

    /**
     * Downloads and extracts the runtime into current runtime workspace value.
     *
     * After extracted, the map stores the version into workspace.
     *
     * @param major a major version of java runtime
     * @param platform a platform of java runtime to download. Should be windows, mac, or linux
     * @param arch an architecture of java runtime to download. Should be x64 or x86
     * @returns the destination of the extracted directory as know as Java path.
     */
    public async downloadRuntime(
      major: number,
      platform: RuntimeBuildOs,
      arch: RuntimeBuildArchitecture,
      imageType?: "jre" | "jdk"
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
      const process = await this.getRepository().createRuntimeDownloadProcess(
        {
          version: major,
          os: platform,
          arch,
          image_type: imageType || "jre",
        },
        pathJoin(
          this.getTemporaryDir(),
          `${major}_${arch}_${platform}${imageType === "jre" && "-jre"}.${
            platform === `windows` ? `zip` : `tar.gz`
          }`
        )
      );

      // wait for success
      const downloadInfo = await process.startDownload();
      // const extractDestinationPath = pathJoin(this.getDirectory().toString());

      const extractDestination = await this.extractDownloadRuntime(
        major,
        platform,
        downloadInfo
      );

      // Push into runtime map
      this.map.setRuntime({
        major,
        path: extractDestination,
        bin:
          platform === "mac"
            ? pathJoin(extractDestination, "Contents", "Home", "bin")
            : pathJoin(extractDestination, "bin"),
      });

      // Store runtime map
      this.getRuntimeMap().saveFile();

      // Clean up download information
      removeSync(downloadInfo.destination);

      return extractDestination;
    }
    /**
     * Extracts a downloaded destination file into a form of Kratos launcher format.
     *
     * @param major a major version of downloaded package
     * @param platform a platform of downloaded package
     * @param downloadInfo a download info from download process
     * @returns a path after extracted
     */
    public async extractDownloadRuntime(
      major: number,
      platform: RuntimeBuildOs,
      downloadInfo: download.DownloadInfo
    ) {
      // extract the runtime
      if (platform === "windows") {
        // extract using .zip
        await RuntimeExtractor.extractZip(
          downloadInfo.destination,
          this.getDirectory()
        );
      } else {
        // extract using .tar.gz
        await RuntimeExtractor.extractTarGz(
          downloadInfo.destination,
          this.getDirectory()
        );
      }

      const releaseName = this.repository.getCachedReleaseName(major);
      const extractDestination = pathJoin(
        this.getDirectory().toString(),
        `jdk_${major}`
      );

      if (existsSync(extractDestination)) {
        removeSync(extractDestination);
      }

      moveSync(
        pathJoin(this.getDirectory().toString(), releaseName),
        extractDestination
      );

      return extractDestination;
    }

    /**
     * Finds the highest runtime version entry from the cache map.
     * If the map is empty, undefined is returned.
     *
     * @returns the highest latest runtime version entry from map
     */
    public getLatestRuntimeEntry() {
      return this.getRuntimeMap().getRuntime(
        this.getRuntimeMap().getHighestMajor()
      );
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
    private _highestRuntimeMajor: number | undefined;

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
        if (
          this._highestRuntimeMajor < major ||
          this._highestRuntimeMajor === undefined
        )
          this._highestRuntimeMajor = major;
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
      // Replace a highest runtime major
      if (
        this._highestRuntimeMajor < runtimeEntry.major ||
        this._highestRuntimeMajor === undefined
      )
        this._highestRuntimeMajor = runtimeEntry.major;

      return this._runtimeMap.set(runtimeEntry.major, runtimeEntry);
    }

    public saveFile() {
      let _buildValues = [];

      for (const i of this._runtimeMap.values()) {
        _buildValues.push(i);
      }
      writeJsonSync(this._filePath, _buildValues);
    }

    /**
     * Retrieves the highest major version of the map. If no entry was found, return undefined.
     *
     * @returns the highest major that contains in map. Otherwise return undefined
     */
    public getHighestMajor(): number | undefined {
      return this._highestRuntimeMajor;
    }
  }

  export type RuntimeBuildArchitecture = "x64" | "x86";

  export type RuntimeBuildOs = "linux" | "windows" | "mac";

  export interface RuntimeBuildOptions {
    version?: number;
    arch?: RuntimeBuildArchitecture;
    os?: RuntimeBuildOs;
    image_type?: "jdk" | "jre";
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
      url.searchParams.append(
        "image_type",
        (options && options.image_type) || "jdk"
      );
      url.searchParams.append("os", (options && options.os) || "windows");
      url.searchParams.append("vendor", "eclipse");

      return url;
    }

    /**
     * Retrieves the package information of current runtime.
     *
     * @param buildOptions a build option for the runtime
     * @returns a {@link Release} body which fetch from server
     */
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

  /**
   * The extractor use to extract archives.
   */
  export class RuntimeExtractor {
    /**
     * Extracts a zip file.
     *
     * @param from the source of the file to be extracted
     * @param to the destination directory to be extracted
     */
    public static async extractZip(
      from: PathLike | string,
      to: PathLike | string
    ) {
      // Check the path exists
      if (!existsSync(from)) {
        throw new Error(`The path is not exists: ${from}`);
      }

      const zip = new AdminZip(from.toString());
      zip.extractAllTo(to.toString(), true, false);
    }

    /**
     * Extracts a .tar.gz file.
     *
     * @param from the source of the file to be extracted
     * @param to the destination directory to be extracted
     */
    public static async extractTarGz(
      from: PathLike | string,
      to: PathLike | string
    ) {
      // Check the path exists
      if (!existsSync(from)) {
        throw new Error(`The path is not exists: ${from}`);
      }

      await tar.x({ file: from.toString(), cwd: to.toString() });
    }
  }
}
