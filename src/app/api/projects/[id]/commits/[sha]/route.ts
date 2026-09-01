import { NextResponse, type NextRequest } from "next/server";

import { db, type RepoRow } from "@/lib/db";
import { GithubError, fetchCommitDetail } from "@/lib/github";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Tek bir yamayi makul boyutta tutar; tamami zaten GitHub'da. */
const MAX_PATCH_CHARS = 8000;
const MAX_FILES = 100;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sha: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const { id, sha } = await params;

  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    return NextResponse.json({ error: "Geçersiz commit." }, { status: 400 });
  }

  const repo = db
    .prepare(`SELECT * FROM repos WHERE id = ? AND user_id = ?`)
    .get(Number(id), user.id) as RepoRow | undefined;

  if (!repo) {
    return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
  }

  try {
    const commit = await fetchCommitDetail(user.access_token, repo.full_name, sha);

    return NextResponse.json({
      sha: commit.sha,
      html_url: commit.html_url,
      message: commit.commit.message,
      author: {
        name: commit.commit.author?.name ?? null,
        email: commit.commit.author?.email ?? null,
        date: commit.commit.author?.date ?? null,
        login: commit.author?.login ?? null,
        avatar_url: commit.author?.avatar_url ?? null,
      },
      committerLogin: commit.committer?.login ?? null,
      parents: (commit.parents ?? []).map((parent) => ({
        sha: parent.sha,
        html_url: parent.html_url,
      })),
      stats: commit.stats ?? { additions: 0, deletions: 0, total: 0 },
      files: (commit.files ?? []).slice(0, MAX_FILES).map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch ? file.patch.slice(0, MAX_PATCH_CHARS) : null,
        truncated: Boolean(file.patch && file.patch.length > MAX_PATCH_CHARS),
        blob_url: file.blob_url ?? null,
      })),
      fileCount: commit.files?.length ?? 0,
    });
  } catch (error) {
    const status = error instanceof GithubError ? error.status : 502;
    return NextResponse.json(
      { error: "Commit detayı alınamadı." },
      { status: status === 404 ? 404 : 502 },
    );
  }
}
