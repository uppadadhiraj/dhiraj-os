import { afterEach, describe, expect, it, vi } from "vitest";
import { describeEvent, fetchLive, languageBreakdown, mapEvent, mapRepo, timeAgo, type ApiRepo } from "./github-live";
import { githubSnapshot } from "./github-stats";

const apiRepo = (over: Partial<ApiRepo> = {}): ApiRepo => ({
  name: "x",
  description: null,
  language: "Python",
  fork: false,
  archived: false,
  stargazers_count: 2,
  created_at: "2026-01-01T00:00:00Z",
  pushed_at: "2026-02-01T00:00:00Z",
  html_url: "https://github.com/u/x",
  homepage: "",
  topics: undefined,
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("github helpers", () => {
  it("maps API repos to snapshot shape (empty homepage becomes null)", () => {
    const r = mapRepo(apiRepo());
    expect(r).toMatchObject({ name: "x", stars: 2, homepage: null, topics: [] });
  });

  it("strips the owner prefix from event repos", () => {
    const e = mapEvent({ id: "1", type: "PushEvent", repo: { name: "uppadadhiraj/ScoutLens" }, created_at: "2026-09-30T00:00:00Z", payload: { ref: "refs/heads/main" } }, "uppadadhiraj");
    expect(e.repo).toBe("ScoutLens");
    expect(describeEvent(e)).toBe("Pushed to ScoutLens (main)");
  });

  it("formats relative time", () => {
    const now = Date.parse("2026-09-30T12:00:00Z");
    expect(timeAgo("2026-09-30T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-09-30T11:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-09-29T13:00:00Z", now)).toBe("23 h ago");
    expect(timeAgo("2026-09-29T12:00:00Z", now)).toBe("1 day ago");
    expect(timeAgo("2026-09-20T12:00:00Z", now)).toBe("10 days ago");
    expect(timeAgo("2025-09-30T12:00:00Z", now)).toBe("1 year ago");
  });

  it("language breakdown counts only original repos and sums to ~100%", () => {
    const repos = [apiRepo({ name: "a" }), apiRepo({ name: "b" }), apiRepo({ name: "c", language: "Java" }), apiRepo({ name: "f", fork: true, language: "Go" })].map(mapRepo);
    const b = languageBreakdown(repos);
    expect(b[0]).toMatchObject({ language: "Python", count: 2 });
    expect(b.find((x) => x.language === "Go")).toBeUndefined();
    expect(b.reduce((n, x) => n + x.pct, 0)).toBeCloseTo(100, 5);
  });

  it("snapshot language breakdown matches the raw snapshot counts", () => {
    const own = githubSnapshot.repos.filter((r) => !r.fork && r.language);
    expect(languageBreakdown(githubSnapshot.repos).reduce((n, x) => n + x.count, 0)).toBe(own.length);
  });
});

describe("fetchLive fallback behaviour", () => {
  it("reports a rate limit instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
    const r = await fetchLive("u");
    expect(r).toMatchObject({ ok: false, reason: "rate-limit" });
  });

  it("reports a network failure instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const r = await fetchLive("u");
    expect(r).toMatchObject({ ok: false, reason: "network" });
  });

  it("returns mapped data on success, and survives a failing events call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([apiRepo()]), { status: 200 }))
      .mockResolvedValueOnce(new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchLive("u");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.repos).toHaveLength(1);
      expect(r.events).toEqual([]);
    }
  });
});
