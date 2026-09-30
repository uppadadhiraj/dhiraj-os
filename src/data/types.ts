export type Status = "LIVE" | "DEMO" | "LOCAL ONLY" | "HARDWARE" | "EXPERIMENTAL" | "ARCHIVED";

/**
 * How a project was developed. Only `ai-assisted` is ever asserted from evidence
 * (commit trailers, README disclosures). `unconfirmed` means the repository has no
 * markers either way and the owner has not yet confirmed — the UI never claims
 * manual authorship for it.
 */
export type Development = "ai-assisted" | "hand-built" | "unconfirmed";

export type Category = "built" | "important";

export interface Screenshot {
  src: string;
  alt: string;
  caption?: string;
}

export type DemoKind = "embed" | "recorded" | "none";

export interface Demo {
  kind: DemoKind;
  /** full-application URL when kind === "embed" (must be a verified, working deployment) */
  url?: string;
  /** what the visitor is actually looking at, stated plainly */
  note: string;
}

export interface Challenge {
  title: string;
  detail: string;
}

export interface Fact {
  label: string;
  value: string;
}

export interface Project {
  slug: string;
  name: string;
  /** window title, e.g. "ScoutLens.exe" */
  exe: string;
  tagline: string;
  category: Category;
  featured: boolean;
  status: Status;
  development: Development;
  /** one honest sentence about how it was built, shown under the development badge */
  devNote: string;
  /** GitHub repository name under the owner account, or null if none is public */
  repo: string | null;
  stack: string[];
  /** lowercase topic tags used for "currently exploring" links and filtering */
  tags: string[];

  overview: string;
  problem?: string;
  solution?: string;
  features?: string[];
  howItWorks?: string[];
  /** rows of nodes; every row connects to the next with arrows */
  architecture?: string[][];
  contribution?: string;
  challenges?: Challenge[];
  future?: string[];
  /** verifiable facts (line counts, test counts, dates). Never estimates. */
  facts?: Fact[];
  screenshots?: Screenshot[];
  demo: Demo;
  /** what was actually run/tested when this entry was written, with date */
  verification: string;
  needs?: string[];
  runLocally?: string[];
  /** repository is a placeholder or the write-up is based on documents, not source */
  note?: string;
}
