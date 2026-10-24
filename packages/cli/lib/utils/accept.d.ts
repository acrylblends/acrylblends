//#region ../../plugins/acryl-router/src/core/utils/accept.d.ts
interface Accept {
  type: string;
  params: Record<string, string>;
  q: number;
}
declare const parseAccept: (acceptHeader: string) => Accept[];
//#endregion
export { Accept, parseAccept };