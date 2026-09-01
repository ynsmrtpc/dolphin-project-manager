function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const env = {
  appUrl: process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  databasePath: process.env.DATABASE_PATH ?? "./data/dolphin.db",

  /**
   * Issue/PR onbellegi bu sureden eskiyse sekme acildiginda tazelenir.
   * Zamanlanmis is yok: yalnizca baktigin depo icin istek harcanir.
   */
  issueSyncTtlMinutes: positiveInt(process.env.ISSUE_SYNC_TTL_MINUTES, 360),

  /** Depo meta verisi (yildiz, aciklama, son push) icin tazelik suresi. */
  repoSyncTtlMinutes: positiveInt(process.env.REPO_SYNC_TTL_MINUTES, 720),
};

export function isGithubConfigured() {
  return Boolean(env.githubClientId && env.githubClientSecret);
}
