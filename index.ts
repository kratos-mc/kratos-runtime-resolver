import { workspace } from "kratos-core";
import { PathLike, existsSync, readJsonSync, writeJsonSync } from "fs-extra";
import { join as pathJoin } from "path";

export namespace kratosRuntime {
  export class RuntimeWorkspace extends workspace.Workspace {
    private map: RuntimeMap;
    constructor(cwd?: string) {
      super(cwd !== undefined ? pathJoin(cwd, "runtime") : "runtime");

      this.map = new RuntimeMap(this);
    }

    /**
     *
     * @returns an instance of {@link RuntimeMap}
     */
    public getRuntimeMap() {
      return this.map;
    }
  }

  export interface RuntimeMapEntry {
    major: number;
    path: PathLike;
  }

  export class RuntimeMap {
    private readonly _filePath: PathLike;
    private readonly _runtimeMap: Map<number, RuntimeMapEntry>;

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

      for (let r of runtimeList) {
        const { major } = r;
        if (this._runtimeMap.has(major)) {
          throw new Error(`Invalid runtime map (duplicated key)`);
        }

        this._runtimeMap.set(major, r);
      }
    }

    public get getFilePath(): PathLike {
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
  }

  // export function
}
