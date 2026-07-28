const getEnv = (key: string) => {
  if (typeof (globalThis as any).__ENV !== 'undefined' && (globalThis as any).__ENV[key] !== undefined) {
    return (globalThis as any).__ENV[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  return undefined;
};

export const ENV = {
  get googleClientId() { return getEnv("GOOGLE_CLIENT_ID") ?? ""; },
  get googleClientSecret() { return getEnv("GOOGLE_CLIENT_SECRET") ?? ""; },
  get appId() { return getEnv("VITE_APP_ID") ?? ""; },
  get cookieSecret() { return getEnv("JWT_SECRET") ?? ""; },
  get databaseUrl() { return getEnv("DATABASE_URL") ?? ""; },
  get oAuthServerUrl() { return getEnv("OAUTH_SERVER_URL") ?? ""; },
  get ownerOpenId() { return getEnv("OWNER_OPEN_ID") ?? ""; },
  get isProduction() { return getEnv("NODE_ENV") === "production"; },
  get forgeApiUrl() { return getEnv("BUILT_IN_FORGE_API_URL") ?? getEnv("OPENAI_BASE_URL") ?? "https://api.openai.com"; },
  get forgeApiKey() { return getEnv("BUILT_IN_FORGE_API_KEY") ?? getEnv("OPENAI_API_KEY") ?? ""; },
  get openAiDalleKey() { return getEnv("OPENAI_DALLE_API_KEY") ?? ""; },
  get defaultLlmModel() { return getEnv("LLM_MODEL") ?? "gpt-4o-mini"; },
};
