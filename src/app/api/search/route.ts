import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const PER_GROUP = 6;

export type SearchResults = {
  projects: { id: number; name: string; fullName: string; isPrivate: boolean }[];
  notes: { id: number; repoId: number; repoName: string; title: string; snippet: string }[];
  todos: { id: number; repoId: number; repoName: string; title: string; done: boolean }[];
  issues: {
    key: string;
    repoId: number;
    repoName: string;
    number: number;
    title: string;
    state: "open" | "closed";
    isPull: boolean;
    htmlUrl: string;
  }[];
};

/** Turkce buyuk/kucuk harf dogru eslessin diye filtreleme JS tarafinda yapiliyor. */
function matches(haystack: string | null, needle: string) {
  if (!needle) return true;
  return (haystack ?? "").toLocaleLowerCase("tr").includes(needle);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .toLocaleLowerCase("tr");

  const projects = db
    .prepare(
      `SELECT id, name, full_name, description, is_private
         FROM repos
        WHERE user_id = ? AND is_archived = 0
        ORDER BY pushed_at DESC NULLS LAST, name`,
    )
    .all(user.id) as {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    is_private: number;
  }[];

  const notes = query
    ? (db
        .prepare(
          `SELECT n.id, n.repo_id, n.title, n.content, r.name AS repo_name
             FROM notes n
             JOIN repos r ON r.id = n.repo_id
            WHERE r.user_id = ? AND r.is_archived = 0
            ORDER BY n.updated_at DESC`,
        )
        .all(user.id) as {
        id: number;
        repo_id: number;
        title: string;
        content: string;
        repo_name: string;
      }[])
    : [];

  const todos = query
    ? (db
        .prepare(
          `SELECT t.id, t.repo_id, t.title, t.done, r.name AS repo_name
             FROM todos t
             JOIN repos r ON r.id = t.repo_id
            WHERE r.user_id = ? AND r.is_archived = 0
            ORDER BY t.done ASC, t.created_at DESC`,
        )
        .all(user.id) as {
        id: number;
        repo_id: number;
        title: string;
        done: number;
        repo_name: string;
      }[])
    : [];

  const issues = query
    ? (db
        .prepare(
          `SELECT i.repo_id, i.number, i.title, i.state, i.is_pull, i.html_url,
                  r.name AS repo_name
             FROM issues i
             JOIN repos r ON r.id = i.repo_id
            WHERE r.user_id = ? AND r.is_archived = 0
            ORDER BY i.state ASC, i.updated_at DESC`,
        )
        .all(user.id) as {
        repo_id: number;
        number: number;
        title: string;
        state: "open" | "closed";
        is_pull: number;
        html_url: string;
        repo_name: string;
      }[])
    : [];

  const results: SearchResults = {
    projects: projects
      .filter(
        (item) => matches(item.full_name, query) || matches(item.description, query),
      )
      .slice(0, PER_GROUP)
      .map((item) => ({
        id: item.id,
        name: item.name,
        fullName: item.full_name,
        isPrivate: Boolean(item.is_private),
      })),

    notes: notes
      .filter((item) => matches(item.title, query) || matches(item.content, query))
      .slice(0, PER_GROUP)
      .map((item) => ({
        id: item.id,
        repoId: item.repo_id,
        repoName: item.repo_name,
        title: item.title,
        snippet: item.content.replace(/\s+/g, " ").slice(0, 90),
      })),

    todos: todos
      .filter((item) => matches(item.title, query))
      .slice(0, PER_GROUP)
      .map((item) => ({
        id: item.id,
        repoId: item.repo_id,
        repoName: item.repo_name,
        title: item.title,
        done: Boolean(item.done),
      })),

    issues: issues
      .filter(
        (item) => matches(item.title, query) || `#${item.number}`.includes(query),
      )
      .slice(0, PER_GROUP)
      .map((item) => ({
        key: `${item.repo_id}-${item.number}`,
        repoId: item.repo_id,
        repoName: item.repo_name,
        number: item.number,
        title: item.title,
        state: item.state,
        isPull: Boolean(item.is_pull),
        htmlUrl: item.html_url,
      })),
  };

  return NextResponse.json(results);
}
