import { workspace } from "kratos-core";
import { PathLike, existsSync } from "fs-extra";
import { join as pathJoin } from "path";

export namespace kratosRuntime {
  export class RuntimeWorkspace extends workspace.Workspace {
    private map: RuntimeMap;
    constructor() {
      super("runtime");

      this.map = new RuntimeMap(this);
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
      if (existsSync(this._filePath)) {
        // readJson;
      }
    }

    public get getFilePath(): PathLike {
      return this._filePath;
    }
  }

  // export function
}
