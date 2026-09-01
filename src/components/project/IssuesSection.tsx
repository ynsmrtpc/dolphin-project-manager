import { IssuesPanel } from "@/components/project/IssuesPanel";
import type { RepoRow } from "@/lib/db";
import { githubErrorMessage } from "@/lib/github";
import { getT } from "@/lib/i18n/server";
import { isStale, readIssues, syncIssues } from "@/lib/issues";
import { nowIso } from "@/lib/time";

/** Onbellek bayatsa tazeler, sonra tabloyu okur. */
export async function IssuesSection({
  token,
  repo,
  state,
}: {
  token: string;
  repo: RepoRow;
  state: "open" | "closed";
}) {
  const t = await getT();
  let warning: string | null = null;
  let syncedAt = repo.issues_synced_at;

  if (isStale(repo)) {
    try {
      await syncIssues(token, repo);
      syncedAt = nowIso();
    } catch (error) {
      warning = githubErrorMessage(
        t,
        error,
        repo.issues_synced_at ? t("issues.staleWarning") : t("issues.loadError"),
      );
    }
  }

  return (
    <IssuesPanel
      repoId={repo.id}
      issues={readIssues(repo.id, state)}
      state={state}
      syncedAt={syncedAt}
      warning={warning}
    />
  );
}
