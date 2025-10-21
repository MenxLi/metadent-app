declare type Config = {
  endpoint: string;
  token: string;
};

declare type UserRecord = {
  id: number;
  username: string;
  is_admin: boolean;
  create_time: string;
  max_storage: number;
  permission: number;
};

declare type FileRecord = {
  url: string;
  owner_id: number;
  file_size: number;
  create_time: string;
  access_time: string;
  mime_type: string;
};

declare type DirectoryRecord = {
  url: string;
  size: string; // Note: kept as string per original, though likely should be number
  create_time: string;
  access_time: string;
  n_files: number;
};

declare type PathListResponse = {
  dirs: DirectoryRecord[];
  files: FileRecord[];
};

declare type FileSortKey = "" | "url" | "file_size" | "create_time" | "access_time" | "mime_type";
declare type DirectorySortKey = "" | "dirname";

declare type ListFilesOptions = {
  offset?: number;
  limit?: number;
  orderBy?: FileSortKey;
  orderDesc?: boolean;
  flat?: boolean;
};

declare type ListDirsOptions = {
  offset?: number;
  limit?: number;
  orderBy?: DirectorySortKey;
  orderDesc?: boolean;
  skim?: boolean;
};

declare type ListPathOptions = {
  offset?: number;
  limit?: number;
  orderBy?: FileSortKey;
  orderDesc?: boolean;
};

declare type UploadOptions = {
  conflict?: 'abort' | 'overwrite' | 'skip';
  permission?: number;
};

export const permMap: {
  0: 'unset';
  1: 'public';
  2: 'protected';
  3: 'private';
};

export default class Connector {
  config: Config;

  constructor();

  exists(path: string): Promise<boolean>;

  getText(path: string): Promise<string>;

  putText(
    path: string,
    text: string,
    options?: {
      conflict?: 'abort' | 'overwrite' | 'skip';
      type?: string;
    }
  ): Promise<string>;

  put(
    path: string,
    file: File | Blob,
    options?: {
      conflict?: 'abort' | 'overwrite' | 'skip';
      permission?: number;
    }
  ): Promise<string>;

  post(
    path: string,
    file: File,
    options?: {
      conflict?: 'abort' | 'overwrite' | 'skip';
      permission?: number;
    }
  ): Promise<string>;

  putJson(
    path: string,
    data: object,
    options?: {
      conflict?: 'abort' | 'overwrite' | 'skip';
      permission?: number;
    }
  ): Promise<string>;

  getJson(path: string): Promise<object>;

  getMultipleText(
    paths: string[],
    options?: {
      skipContent?: boolean;
    }
  ): Promise<Record<string, string | null>>;

  delete(path: string): Promise<void>;

  getMetadata(path: string): Promise<FileRecord | DirectoryRecord | null>;

  listPath(path: string): Promise<PathListResponse>;

  countFiles(path: string, options?: { flat?: boolean }): Promise<number>;

  listFiles(path: string, options?: ListFilesOptions): Promise<FileRecord[]>;

  countDirs(path: string): Promise<number>;

  listDirs(path: string, options?: ListDirsOptions): Promise<DirectoryRecord[]>;

  whoami(): Promise<UserRecord>;

  listPeers(options?: { level?: number; incoming?: boolean }): Promise<UserRecord[]>;

  setFilePermission(path: string, permission: number): Promise<void>;

  move(srcPath: string, dstPath: string): Promise<void>;

  copy(srcPath: string, dstPath: string): Promise<void>;
}

export function listPath(
  conn: Connector,
  path: string,
  options?: ListPathOptions
): Promise<[PathListResponse, { dirs: number; files: number }]>;

export function uploadFile(
  conn: Connector,
  path: string,
  file: File,
  options?: UploadOptions
): Promise<string>;
