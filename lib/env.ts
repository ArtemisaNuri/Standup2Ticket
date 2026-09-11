function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getTogetherApiKey() {
  return requireEnv("TOGETHER_API_KEY");
}

export function getLinearConfig() {
  return {
    apiKey: requireEnv("LINEAR_API_KEY"),
    teamId: requireEnv("LINEAR_TEAM_ID"),
  };
}

export function getNotionConfig() {
  return {
    apiKey: requireEnv("NOTION_API_KEY"),
    parentPageId: requireEnv("NOTION_PARENT_PAGE_ID"),
  };
}
