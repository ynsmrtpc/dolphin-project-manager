import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GithubError,
  createIssue,
  fetchIssues,
  fetchReadme,
  fetchTodoFile,
} from "@/lib/github";

type Call = { url: string; init?: RequestInit };

let calls: Call[];
let respond: (url: string) => Response;

beforeEach(() => {
  calls = [];
  respond = () => new Response("[]", { status: 200 });

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return respond(String(url));
  });
});

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200 });

describe("istek başlıkları", () => {
  it("token ve API sürümünü gönderir", async () => {
    respond = () => ok([]);
    await fetchIssues("gizli-token", "tester/repo");

    const headers = new Headers(calls[0].init?.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer gizli-token");
    expect(headers.get("X-GitHub-Api-Version")).toBe("2022-11-28");
  });

  it("durum ve sıralama parametrelerini ekler", async () => {
    respond = () => ok([]);
    await fetchIssues("token", "tester/repo", "closed");

    expect(calls[0].url).toContain("state=closed");
    expect(calls[0].url).toContain("sort=updated");
  });
});

describe("kota (rate limit) tespiti", () => {
  it("403 + kalan hak 0 ise kota hatası olarak işaretler", async () => {
    respond = () =>
      new Response("forbidden", {
        status: 403,
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1788000000" },
      });

    const error = await fetchIssues("token", "tester/repo").catch((cause) => cause);

    expect(error).toBeInstanceOf(GithubError);
    expect(error.rateLimited).toBe(true);
    expect(error.resetAt?.getTime()).toBe(1788000000 * 1000);
  });

  it("429'u kota hatası sayar", async () => {
    respond = () => new Response("too many", { status: 429 });

    const error = await fetchIssues("token", "tester/repo").catch((cause) => cause);
    expect(error.rateLimited).toBe(true);
  });

  it("retry-after başlığından sıfırlanma zamanı çıkarır", async () => {
    respond = () =>
      new Response("slow down", { status: 403, headers: { "retry-after": "60" } });

    const error = await fetchIssues("token", "tester/repo").catch((cause) => cause);

    expect(error.rateLimited).toBe(true);
    expect(error.resetAt).toBeInstanceOf(Date);
  });

  /** Asil kirilma noktasi: kota disi 403 "yetkin yok" demektir, "bekle" degil. */
  it("kalan hak varken 403'ü kota hatası saymaz", async () => {
    respond = () =>
      new Response("forbidden", {
        status: 403,
        headers: { "x-ratelimit-remaining": "4980" },
      });

    const error = await fetchIssues("token", "tester/repo").catch((cause) => cause);

    expect(error).toBeInstanceOf(GithubError);
    expect(error.rateLimited).toBe(false);
    expect(error.status).toBe(403);
  });
});

describe("ham dosya okuma", () => {
  it("404'te hata fırlatmaz, null döner", async () => {
    respond = () => new Response("not found", { status: 404 });
    expect(await fetchReadme("token", "tester/repo")).toBeNull();
  });

  it("500'de hata fırlatır", async () => {
    respond = () => new Response("boom", { status: 500 });
    await expect(fetchReadme("token", "tester/repo")).rejects.toBeInstanceOf(GithubError);
  });

  it("README'yi ham metin olarak ister", async () => {
    respond = () => ok("# Başlık");

    expect(await fetchReadme("token", "tester/repo")).toBe("# Başlık");
    const headers = new Headers(calls[0].init?.headers as HeadersInit);
    expect(headers.get("Accept")).toBe("application/vnd.github.raw");
  });
});

describe("TODO dosyası arama", () => {
  it("yaygın adları sırayla dener ve ilk bulduğunu döner", async () => {
    respond = (url) =>
      url.includes("todo.md") && !url.includes("TODO.md")
        ? ok("- [ ] madde")
        : new Response("yok", { status: 404 });

    const result = await fetchTodoFile("token", "tester/repo");

    expect(result).toEqual({ path: "todo.md", content: "- [ ] madde" });
    // Once TODO.md denenmis olmali.
    expect(calls[0].url).toContain("TODO.md");
  });

  it("hiçbiri yoksa null döner", async () => {
    respond = () => new Response("yok", { status: 404 });

    expect(await fetchTodoFile("token", "tester/repo")).toBeNull();
    expect(calls.length).toBeGreaterThan(3);
  });
});

describe("issue açma", () => {
  it("POST ile başlık ve gövdeyi gönderir", async () => {
    respond = () => ok({ number: 7, html_url: "https://example.com/7" });

    const issue = await createIssue("token", "tester/repo", {
      title: "başlık",
      body: "gövde",
    });

    expect(issue.number).toBe(7);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      title: "başlık",
      body: "gövde",
    });
  });
});
