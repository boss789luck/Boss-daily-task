import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user: User | null;
  env: any; // Cloudflare Env
};

export async function createContext(
  opts: FetchCreateContextFnOptions & { env: any }
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
    user,
    env: opts.env,
  };
}
