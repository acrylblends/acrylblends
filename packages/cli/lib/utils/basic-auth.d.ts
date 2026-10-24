//#region ../../plugins/acryl-router/src/core/utils/basic-auth.d.ts
type Auth = (req: Request) => {
  username: string;
  password: string;
} | undefined;
declare const auth: Auth;
//#endregion
export { Auth, auth };