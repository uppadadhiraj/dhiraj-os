"""Visual system: CSS and small HTML builders.

SECURITY: everything rendered through ``unsafe_allow_html`` comes from web pages, search results and
resumes, all untrusted. Every dynamic value MUST pass through :func:`esc`; links go through
:func:`link`, which only emits http(s) URLs. Builders return compact single-line HTML because
Markdown treats indented lines as code blocks.
"""
from __future__ import annotations

import html
from collections.abc import Iterable

import streamlit as st


def esc(value: object) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def safe_url(url: str | None) -> str | None:
    return url if url and url.startswith(("http://", "https://")) else None


def link(text: object, url: str | None, *, cls: str = "sl-link") -> str:
    target = safe_url(url)
    if not target:
        return esc(text)
    return f'<a class="{cls}" href="{esc(target)}" target="_blank" rel="noopener noreferrer">{esc(text)}</a>'


def badge(text: object, kind: str = "muted", title: str | None = None) -> str:
    tip = f' title="{esc(title)}"' if title else ""
    return f'<span class="sl-badge sl-{esc(kind)}"{tip}>{esc(text)}</span>'


def tier_badge(tier: int, label: str) -> str:
    return badge(f"Tier {tier}", f"tier{tier}", title=label)


def chips(items: Iterable[object], kind: str = "skill") -> str:
    inner = "".join(f'<span class="sl-chip sl-chip-{esc(kind)}">{esc(i)}</span>' for i in items)
    return f'<div class="sl-chips">{inner}</div>' if inner else ""


def card(inner: str, cls: str = "") -> str:
    return f'<div class="sl-card {esc(cls)}">{inner}</div>'


def label(text: str) -> str:
    return f'<div class="sl-label">{esc(text)}</div>'


def kv_grid(pairs: list[tuple[str, object | None]]) -> str:
    """Label/value tiles. ``None``/empty values render as a muted "Not stated"."""
    cells = []
    for name, value in pairs:
        shown = f'<div class="sl-kv-v">{esc(value)}</div>' if value not in (None, "") else '<div class="sl-kv-v sl-muted">Not stated</div>'
        cells.append(f'<div class="sl-kv"><div class="sl-kv-k">{esc(name)}</div>{shown}</div>')
    return f'<div class="sl-kv-grid">{"".join(cells)}</div>'


def bar(label_text: str, count: int, total: int, percent: float, *, highlight: bool = False, note: str = "") -> str:
    width = max(0.0, min(100.0, percent))
    extra = f'<span class="sl-bar-note">{esc(note)}</span>' if note else ""
    cls = " sl-bar-hl" if highlight else ""
    return (
        f'<div class="sl-bar-row"><div class="sl-bar-label">{esc(label_text)}{extra}</div>'
        f'<div class="sl-bar-track"><div class="sl-bar-fill{cls}" style="width:{width:.1f}%"></div></div>'
        f'<div class="sl-bar-value">{count}/{total} · {percent:g}%</div></div>'
    )


CSS = """
<style>
:root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--bg:#f8fafc;--card:#ffffff;--accent:#4f46e5;--accent-soft:#eef2ff;
--green:#047857;--green-soft:#d1fae5;--blue:#1d4ed8;--blue-soft:#dbeafe;--amber:#b45309;--amber-soft:#fef3c7;
--slate:#475569;--slate-soft:#e2e8f0;--red:#b91c1c;--red-soft:#fee2e2;--violet:#6d28d9;--violet-soft:#ede9fe}
.stApp{background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif}
.block-container{max-width:1180px;padding-top:1.4rem;padding-bottom:4rem}
#MainMenu,footer,[data-testid="stToolbar"],[data-testid="stDecoration"]{visibility:hidden;height:0}
h1,h2,h3,h4{letter-spacing:-.02em;color:var(--ink)}
a.sl-link{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(79,70,229,.25)}
a.sl-link:hover{border-bottom-color:var(--accent)}
.sl-muted{color:var(--muted)}
.sl-topbar{display:flex;align-items:center;justify-content:space-between;padding:.2rem 0 1rem 0}
.sl-brand{font-weight:800;letter-spacing:.14em;font-size:1.05rem}
.sl-brand span{color:var(--accent)}
.sl-hero{padding:2.2rem 0 1.4rem 0;text-align:center}
.sl-hero h1{font-size:2.9rem;line-height:1.08;margin:.2rem 0 .8rem 0;font-weight:800}
.sl-hero h1 em{font-style:normal;background:linear-gradient(90deg,#4f46e5,#0d9488);-webkit-background-clip:text;background-clip:text;color:transparent}
.sl-hero p{color:var(--muted);font-size:1.12rem;max-width:44rem;margin:0 auto}
.sl-eyebrow{font-size:.72rem;font-weight:700;letter-spacing:.18em;color:var(--accent);text-transform:uppercase}
.sl-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.05rem 1.2rem;margin:.55rem 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.sl-card h4{margin:0 0 .4rem 0;font-size:1rem}
.sl-card.sl-tight{padding:.75rem 1rem}
.sl-label{font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:.7rem 0 .15rem 0}
.sl-finding{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:14px;padding:1rem 1.2rem;margin:.6rem 0 .2rem 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.sl-fhead{display:flex;align-items:center;gap:.55rem;font-weight:700;font-size:1.02rem}
.sl-ficon{font-size:1.25rem}
.sl-fact{font-size:1.02rem;line-height:1.45}
.sl-interp{color:#334155;line-height:1.45}
.sl-action{color:var(--accent);font-weight:600}
.sl-sources{margin-top:.75rem;padding-top:.6rem;border-top:1px dashed var(--line);font-size:.82rem;color:var(--muted)}
.sl-badge{display:inline-block;padding:.12rem .55rem;border-radius:999px;font-size:.72rem;font-weight:700;letter-spacing:.02em;margin-right:.3rem;white-space:nowrap}
.sl-tier1,.sl-ok{background:var(--green-soft);color:var(--green)}
.sl-tier2,.sl-info{background:var(--blue-soft);color:var(--blue)}
.sl-tier3,.sl-muted-badge,.sl-muted{background:transparent}
.sl-badge.sl-tier3,.sl-badge.sl-muted{background:var(--slate-soft);color:var(--slate)}
.sl-warn{background:var(--amber-soft);color:var(--amber)}
.sl-bad{background:var(--red-soft);color:var(--red)}
.sl-violet{background:var(--violet-soft);color:var(--violet)}
.sl-accent{background:var(--accent-soft);color:var(--accent)}
.sl-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin:.35rem 0}
.sl-chip{padding:.22rem .7rem;border-radius:8px;font-size:.84rem;font-weight:600;background:var(--accent-soft);color:#3730a3;border:1px solid #e0e7ff}
.sl-chip-preferred{background:#f1f5f9;color:#334155;border-color:var(--line)}
.sl-kv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.65rem}
.sl-kv{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.65rem .85rem}
.sl-kv-k{font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.sl-kv-v{font-size:1rem;font-weight:600;margin-top:.15rem;word-break:break-word}
.sl-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;margin:.4rem 0 1rem 0}
.sl-metric{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.6rem .85rem}
.sl-metric-v{font-size:1.5rem;font-weight:800;line-height:1.15}
.sl-metric-k{font-size:.72rem;color:var(--muted);font-weight:600}
.sl-metric-d{font-size:.68rem;color:var(--muted);margin-top:.1rem}
.sl-bar-row{display:grid;grid-template-columns:minmax(120px,1.1fr) 3fr minmax(110px,.9fr);align-items:center;gap:.7rem;margin:.32rem 0}
.sl-bar-label{font-weight:600;font-size:.92rem}
.sl-bar-note{font-weight:500;color:var(--muted);font-size:.72rem;margin-left:.45rem}
.sl-bar-track{background:#eef2f7;border-radius:999px;height:10px;overflow:hidden}
.sl-bar-fill{background:linear-gradient(90deg,#94a3b8,#64748b);height:100%;border-radius:999px}
.sl-bar-fill.sl-bar-hl{background:linear-gradient(90deg,#6366f1,#4f46e5)}
.sl-bar-value{font-size:.82rem;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
.sl-steps{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:.6rem 1.2rem;margin:1rem 0}
.sl-step{display:flex;gap:.9rem;align-items:flex-start;padding:.62rem 0;border-bottom:1px solid #f1f5f9}
.sl-step:last-child{border-bottom:none}
.sl-step-ic{width:1.5rem;height:1.5rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;flex:none;margin-top:.05rem}
.sl-s-done .sl-step-ic{background:var(--green-soft);color:var(--green)}
.sl-s-running .sl-step-ic{background:var(--accent-soft);color:var(--accent);animation:sl-pulse 1.1s ease-in-out infinite}
.sl-s-pending .sl-step-ic{background:#f1f5f9;color:#94a3b8}
.sl-s-failed .sl-step-ic{background:var(--red-soft);color:var(--red)}
.sl-s-skipped .sl-step-ic{background:var(--slate-soft);color:var(--slate)}
.sl-s-pending .sl-step-t{color:#94a3b8}
.sl-step-t{font-weight:650}
.sl-step-d{font-size:.83rem;color:var(--muted);margin-top:.1rem}
@keyframes sl-pulse{0%,100%{box-shadow:0 0 0 0 rgba(79,70,229,.35)}50%{box-shadow:0 0 0 7px rgba(79,70,229,0)}}
.sl-demo{background:linear-gradient(90deg,#fef3c7,#fde68a);border:1px solid #fcd34d;color:#78350f;border-radius:12px;padding:.6rem 1rem;font-weight:600;margin:.3rem 0 1rem 0}
.sl-notice{background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:.6rem .9rem;color:#334155;font-size:.9rem;margin:.4rem 0}
.sl-notice.sl-warnbox{background:var(--amber-soft);border-color:#fde68a;color:#78350f}
.sl-notice.sl-gap{background:#f8fafc;border-style:dashed}
.sl-powered{text-align:center;color:var(--muted);font-size:.85rem;margin-top:2rem}
.sl-ev{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:.7rem .9rem;margin:.4rem 0}
.sl-ev-h{display:flex;flex-wrap:wrap;align-items:center;gap:.3rem;font-weight:650}
.sl-ev-meta{font-size:.78rem;color:var(--muted);margin-top:.15rem}
.sl-ev-x{font-size:.86rem;color:#334155;margin-top:.35rem;border-left:3px solid var(--line);padding-left:.6rem}
.sl-fit-row{display:grid;grid-template-columns:2rem minmax(120px,1.2fr) 6rem 3fr;gap:.6rem;align-items:start;padding:.5rem 0;border-bottom:1px solid #f1f5f9}
.sl-fit-ic{font-weight:800;font-size:1.05rem}
.sl-fit-matched .sl-fit-ic{color:var(--green)}.sl-fit-partial .sl-fit-ic{color:var(--amber)}
.sl-fit-not_found .sl-fit-ic{color:var(--slate)}.sl-fit-unknown .sl-fit-ic{color:var(--violet)}
.sl-fit-basis{font-size:.86rem;color:#334155}
.sl-fit-snip{font-size:.78rem;color:var(--muted);margin-top:.15rem}
.sl-table{width:100%;border-collapse:collapse;font-size:.86rem}
.sl-table th{text-align:left;color:var(--muted);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;padding:.4rem .5rem;border-bottom:1px solid var(--line)}
.sl-table td{padding:.42rem .5rem;border-bottom:1px solid #f1f5f9;vertical-align:top}
.sl-news{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:.75rem .95rem;margin:.45rem 0}
.sl-news-t{font-weight:700;font-size:1rem}
@media (max-width:720px){.sl-hero h1{font-size:2.05rem}.sl-bar-row{grid-template-columns:1fr}.sl-bar-value{text-align:left}
.sl-fit-row{grid-template-columns:1.6rem 1fr}.sl-fit-row>:nth-child(n+3){grid-column:2}}
</style>
"""


def inject_css() -> None:
    st.markdown(CSS, unsafe_allow_html=True)
