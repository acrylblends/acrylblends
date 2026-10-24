//#region ../../plugins/acryl-router/src/core/utils/filepath.d.ts
/**
 * @module
 * FilePath utility.
 */
type FilePathOptions = {
  filename: string;
  root?: string;
  defaultDocument?: string;
};
declare const getFilePath: (options: FilePathOptions) => string | undefined;
declare const getFilePathWithoutDefaultDocument: (options: Omit<FilePathOptions, "defaultDocument">) => string | undefined;
//#endregion
export { getFilePath, getFilePathWithoutDefaultDocument };