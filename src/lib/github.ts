const API = "https://api.github.com";

export type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  updated_at: string | null;
};

export type GithubCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
};

export type GithubBranch = { name: string };

export type GithubCommitFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url?: string;
};

export type GithubLabel = { id: number; name: string; color: string };

/** GitHub'da PR'lar da birer issue'dur; `pull_request` alani varsa PR demektir. */
export type GithubIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  draft?: boolean;
  comments: number;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string } | null;
  labels: GithubLabel[];
  assignees: { login: string; avatar_url: string }[];
  pull_request?: { html_url: string; merged_at: string | null };
};

export type GithubCommitDetail = GithubCommit & {
  committer: { login: string; avatar_url: string } | null;
  parents: { sha: string; html_url: string }[];
  stats?: { additions: number; deletions: number; total: number };
  files?: GithubCommitFile[];
};

export class GithubError extends Error {
  status: number;
  /** Kota bittiginde true; kullaniciya "baglantini kontrol et" demeyelim diye. */
  rateLimited: boolean;
  /** Kotanin sifirlanacagi an (varsa). */
  resetAt: Date | null;

  constructor(
    status: number,
    message: string,
    options: { rateLimited?: boolean; resetAt?: Date | null } = {},
  ) {
    super(message);
    this.status = status;
    this.rateLimited = options.rateLimited ?? false;
    this.resetAt = options.resetAt ?? null;
    this.name = "GithubError";
  }
}

/** Kota hatalarini normal 403'ten ayirir. */
function rateLimitInfo(response: Response) {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const retryAfter = response.headers.get("retry-after");
  const reset = response.headers.get("x-ratelimit-reset");

  const limited =
    response.status === 429 ||
    (response.status === 403 && (remaining === "0" || retryAfter !== null));

  if (!limited) return { rateLimited: false, resetAt: null };

  let resetAt: Date | null = null;
  if (reset) {
    const seconds = Number(reset);
    if (Number.isFinite(seconds)) resetAt = new Date(seconds * 1000);
  } else if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) resetAt = new Date(Date.now() + seconds * 1000);
  }

  return { rateLimited: true, resetAt };
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Hata tipine gore kullaniciya gosterilecek mesaj (dile duyarli). */
export function githubErrorMessage(
  t: Translate,
  error: unknown,
  fallback: string,
  locale = "tr",
) {
  if (!(error instanceof GithubError)) return fallback;

  if (error.rateLimited) {
    if (!error.resetAt) return t("errors.rateLimited");
    const time = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
      timeStyle: "short",
    }).format(error.resetAt);
    return t("errors.rateLimitedAt", { time });
  }

  if (error.status === 401) return t("errors.unauthorized");

  return fallback;
}

async function ghFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "dolphin-project-manager",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GithubError(
      res.status,
      `GitHub API ${res.status}: ${body.slice(0, 300)}`,
      rateLimitInfo(res),
    );
  }

  return (await res.json()) as T;
}

/** Kullanicinin erisebildigi tum public + private repolari getirir. */
export async function fetchAllRepos(token: string): Promise<GithubRepo[]> {
  const all: GithubRepo[] = [];
  const perPage = 100;

  for (let page = 1; page <= 15; page++) {
    const batch = await ghFetch<GithubRepo[]>(
      `/user/repos?per_page=${perPage}&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`,
      token,
    );
    all.push(...batch);
    if (batch.length < perPage) break;
  }

  return all;
}

export function fetchRepo(token: string, fullName: string) {
  return ghFetch<GithubRepo>(`/repos/${fullName}`, token);
}

export function fetchBranches(token: string, fullName: string) {
  return ghFetch<GithubBranch[]>(`/repos/${fullName}/branches?per_page=100`, token);
}

export function fetchCommits(
  token: string,
  fullName: string,
  opts: { branch?: string; page?: number; perPage?: number } = {},
) {
  const params = new URLSearchParams({
    per_page: String(opts.perPage ?? 20),
    page: String(opts.page ?? 1),
  });
  if (opts.branch) params.set("sha", opts.branch);

  return ghFetch<GithubCommit[]>(
    `/repos/${fullName}/commits?${params.toString()}`,
    token,
  );
}

/**
 * Issue ve PR'lari tek istekte getirir (GitHub ikisini ayni uctan doner).
 * Cagiran taraf `pull_request` alanina bakarak ayirir.
 */
export function fetchIssues(
  token: string,
  fullName: string,
  state: "open" | "closed" = "open",
) {
  const params = new URLSearchParams({
    state,
    per_page: "50",
    sort: "updated",
    direction: "desc",
  });

  return ghFetch<GithubIssue[]>(
    `/repos/${fullName}/issues?${params.toString()}`,
    token,
  );
}

/**
 * Yeni bir issue acar. Tek yazma islemi budur ve yalnizca kullanici
 * onay verdiginde cagrilir.
 */
export function createIssue(
  token: string,
  fullName: string,
  input: { title: string; body: string },
) {
  return ghFetch<GithubIssue>(`/repos/${fullName}/issues`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: input.title, body: input.body }),
  });
}

export function fetchCommitDetail(token: string, fullName: string, sha: string) {
  return ghFetch<GithubCommitDetail>(
    `/repos/${fullName}/commits/${encodeURIComponent(sha)}`,
    token,
  );
}

/** Ham metin doner; dosya yoksa null. */
async function fetchRaw(
  token: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github.raw",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "dolphin-project-manager",
    },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new GithubError(res.status, `GitHub API ${res.status}`, rateLimitInfo(res));
  }

  return res.text();
}

/** Deponun README dosyasi (GitHub hangi varyanti bulursa onu doner). */
export function fetchReadme(token: string, fullName: string) {
  return fetchRaw(token, `/repos/${fullName}/readme`);
}

/** Depodaki bir dosyanin ham icerigi. */
export function fetchFile(token: string, fullName: string, path: string) {
  return fetchRaw(token, `/repos/${fullName}/contents/${path}`);
}

/** Yaygin TODO dosyasi adlarini sirayla dener. */
const TODO_PATHS = [
  "TODO.md",
  "todo.md",
  "Todo.md",
  "TODOS.md",
  "docs/TODO.md",
  ".github/TODO.md",
];

export async function fetchTodoFile(token: string, fullName: string) {
  for (const path of TODO_PATHS) {
    const content = await fetchFile(token, fullName, path);
    if (content !== null) return { path, content };
  }
  return null;
}
