import { AlertTriangle } from "lucide-react";

import { BranchSelect } from "@/components/project/BranchSelect";
import { CommitHistory } from "@/components/project/CommitHistory";
import { getT } from "@/lib/i18n/server";
import {
  GithubError,
  fetchBranches,
  fetchCommits,
  githubErrorMessage,
  type GithubBranch,
  type GithubCommit,
} from "@/lib/github";

/**
 * GitHub'a giden kisim ayri bir Suspense sinirinda duruyor; boylece sayfa
 * kabugu (ve gerekirse 404) hemen yanit verebiliyor.
 */
export async function HistorySection({
  token,
  repoId,
  fullName,
  branch,
  page,
  perPage,
}: {
  token: string;
  repoId: number;
  fullName: string;
  branch: string;
  page: number;
  perPage: number;
}) {
  let commits: GithubCommit[] = [];
  let branches: GithubBranch[] = [];
  const t = await getT();
  let error: string | null = null;

  try {
    [branches, commits] = await Promise.all([
      fetchBranches(token, fullName),
      fetchCommits(token, fullName, { branch, page, perPage }),
    ]);
  } catch (cause) {
    error =
      cause instanceof GithubError && cause.status === 409
        ? t("commits.noCommits")
        : githubErrorMessage(t, cause, t("commits.loadError"));
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-error alert-soft max-w-3xl text-[13px]">
        <AlertTriangle className="size-4" aria-hidden="true" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BranchSelect
        repoId={repoId}
        branches={branches.map((item) => item.name)}
        current={branch}
      />
      <CommitHistory
        repoId={repoId}
        commits={commits}
        branch={branch}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
