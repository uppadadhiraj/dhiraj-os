"""Build the in-browser demos into public/demos/<slug>/.

Each demo is a Streamlit app that runs in the visitor's browser through stlite (Streamlit on WebAssembly), served as
static files from this site. A bundle is an index.html plus the app's own files under app/.

    python scripts/make_stlite.py all            # every demo
    python scripts/make_stlite.py iris heart     # just these

Sources
  - repo:<Repo>/<path>  a file or folder in a clone of one of the owner's repositories (DEMO_REPOS, ';'-separated,
                        default C:/pf/r2;C:/pf/r;C:/pf/spaces). These are copied unchanged.
  - own:<folder>        demos-src/<folder>: Streamlit pages written with Claude Code around a notebook's code.
Set DEMO_PYTHON to a Python that has pandas + scikit-learn (only the movie demo needs it, to regenerate its pickles).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "demos"
STLITE = "1.9.2"
CDN = f"https://cdn.jsdelivr.net/npm/@stlite/browser@{STLITE}/build"
REPOS = [Path(p) for p in os.environ.get("DEMO_REPOS", "C:/pf/r2;C:/pf/r;C:/pf/spaces").split(";")]
ANALYSIS_PY = os.environ.get("DEMO_PYTHON", "C:/pf/v/Fake-News-Predictor/Scripts/python.exe")
INCLUDE = (".py", ".toml", ".pkl", ".csv", ".gitkeep")
SKIP_DIRS = {"__pycache__", "tests", "docs", "scripts", ".git", ".idea"}

SCOUTLENS_WRAPPER = '''import os
# hosted showcase: demo investigation only, nothing stored (see ui/home.py)
os.environ["PUBLIC_DEMO"] = "1"
os.environ["LLM_PROVIDER"] = "none"
os.environ["SERPAPI_KEY"] = ""
import runpy
runpy.run_path("app.py", run_name="__main__")
'''

IRIS_WRAPPER = '''import runpy
runpy.run_path("app.py", run_name="__main__")
'''

SKLEARN = ["scikit-learn", "pandas", "numpy"]

TARGETS = {
    "scoutlens": dict(
        title="ScoutLens (public demo)",
        copy=[("repo:scoutlens-demo", "")],
        skip_files=("Dockerfile",),
        requirements=["sqlite3", "pydantic>=2.7", "pydantic-settings>=2.3", "requests", "beautifulsoup4", "lxml", "pypdf", "tzdata"],
        wrapper=SCOUTLENS_WRAPPER,
        config={
            "theme.base": "light", "theme.primaryColor": "#4f46e5", "theme.backgroundColor": "#f8fafc",
            "theme.secondaryBackgroundColor": "#ffffff", "theme.textColor": "#0f172a", "theme.font": "sans serif",
        },
    ),
    "fake-news": dict(
        title="Indian News Fake News Detector",
        copy=[("repo:Fake-News-Predictor/App", "")],
        skip_files=("safe_fetch.py",),
        requirements=["scikit-learn", "numpy"],
    ),
    "iris": dict(
        title="Iris type (Iris-Predictor)",
        copy=[("repo:Iris-Predictor/app", "")],
        requirements=SKLEARN,
    ),
    "movie": dict(
        title="Movie Recommender (Movie-Recommendations)",
        copy=[("repo:Movie-Recommendations/app.py", "app.py"), ("own:movie/topsim.py", "topsim.py")],
        generate="movie",
        requirements=["pandas", "numpy"],
    ),
    "heart": dict(
        title="Heart Disease Predictor",
        copy=[("own:heart", ""), ("own:_common", ""), ("repo:Heart-Disease-Predictor/heart_disease_uci.csv", "heart_disease_uci.csv")],
        requirements=SKLEARN,
    ),
    "titanic": dict(
        title="Titanic Survival Analysis",
        copy=[("own:titanic", ""), ("own:_common", ""), ("repo:Titanic_Ship_Survival/Titanic-Dataset.csv", "Titanic-Dataset.csv")],
        requirements=["pandas", "numpy"],
    ),
    "house-price": dict(
        title="House price - linear regression (SCT_ML_1)",
        copy=[("own:house-price", ""), ("own:_common", ""), ("repo:SCT_ML_1/train.csv", "train.csv")],
        requirements=SKLEARN,
    ),
    "netflix": dict(
        title="Netflix content explorer",
        copy=[("own:netflix", ""), ("own:_common", ""), ("repo:Netflix-Content-EDA/netflix_titles.csv", "netflix_titles.csv")],
        requirements=["pandas", "numpy"],
    ),
    "linear-regression": dict(
        title="Linear regression from scratch",
        copy=[("own:linear-regression", ""), ("own:_common", ""), ("repo:linear-regression-from-scratch/salary_data.csv", "salary_data.csv")],
        requirements=SKLEARN,
    ),
    "logistic-regression": dict(
        title="Logistic regression from scratch",
        copy=[("own:logistic-regression", ""), ("own:_common", ""), ("repo:logistic-regression-from-scratch/diabetes.csv", "diabetes.csv")],
        requirements=SKLEARN,
    ),
}


def resolve(spec: str) -> Path:
    kind, _, rest = spec.partition(":")
    if kind == "own":
        return ROOT / "demos-src" / rest
    first, _, tail = rest.partition("/")
    for base in REPOS:
        if (base / first).exists():
            return base / first / tail
    raise SystemExit(f"cannot find '{first}' in {[str(r) for r in REPOS]} (set DEMO_REPOS)")


def copy_into(src: Path, dest_root: Path, dest_rel: str, skip_files, files: dict) -> None:
    def add(path: Path, rel: str) -> None:
        # an extension-less dotfile cannot be served by every static host (Next's own server answers 500), and it is only
        # there to keep an empty folder alive, so ship it under an ordinary name
        if rel.endswith(".gitkeep"):
            rel = rel[: -len(".gitkeep")] + "keep.txt"
        dst = dest_root / "app" / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(path, dst)
        files[rel] = {"url": f"./app/{rel}"}

    if src.is_file():
        add(src, dest_rel or src.name)
        return
    for root, dirs, names in os.walk(src):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in names:
            if name in skip_files or not name.endswith(INCLUDE):
                continue
            path = Path(root) / name
            rel = path.relative_to(src).as_posix()
            add(path, f"{dest_rel}/{rel}".lstrip("/"))


def generate(kind: str, dest_root: Path, files: dict) -> None:
    if kind == "movie":
        tmp = Path(tempfile.mkdtemp())
        subprocess.run([ANALYSIS_PY, str(ROOT / "demos-src" / "movie" / "generate.py"), str(resolve("repo:Movie-Recommendations/")), str(tmp)], check=True)
        for name in ("movie_dict.pkl", "similarity.pkl"):
            copy_into(tmp / name, dest_root, name, (), files)
        shutil.rmtree(tmp)


PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>{title}</title>
  <link rel="stylesheet" href="{cdn}/stlite.css" />
  <style>
    html, body {{ margin: 0; height: 100%; }}
    #boot {{ font: 15px/1.5 system-ui, sans-serif; color: #3c4052; padding: 28px; max-width: 560px; margin: 8vh auto; }}
    #boot b {{ color: #0a1f7a; }}
  </style>
</head>
<body>
  <div id="boot"><b>Starting {title}…</b><br />This is a real Streamlit app, running inside your browser (WebAssembly). The first load downloads the Python runtime (about 10&nbsp;MB) and is then cached.</div>
  <div id="root"></div>
  <noscript>This demo needs JavaScript.</noscript>
  <script type="module">
    import {{ mount }} from "{cdn}/stlite.js";
    const config = {config};
    mount(config, document.getElementById("root"));
    const hide = () => {{ if (document.querySelector("#root [data-testid='stApp'], #root .stApp, #root [data-testid='stAppViewContainer']")) document.getElementById("boot")?.remove(); }};
    new MutationObserver(hide).observe(document.getElementById("root"), {{ childList: true, subtree: true }});
  </script>
</body>
</html>
"""


def build(slug: str) -> None:
    t = TARGETS[slug]
    out = OUT / slug
    if out.exists():
        shutil.rmtree(out)
    (out / "app").mkdir(parents=True)
    files: dict = {}
    for spec, dest in t["copy"]:
        copy_into(resolve(spec), out, dest, t.get("skip_files", ()), files)
    if t.get("generate"):
        generate(t["generate"], out, files)
    entry = "app.py"
    if t.get("wrapper"):
        (out / "app" / "stlite_entry.py").write_text(t["wrapper"], encoding="utf-8", newline="\n")
        files["stlite_entry.py"] = {"url": "./app/stlite_entry.py"}
        entry = "stlite_entry.py"
    if entry not in files:
        raise SystemExit(f"{slug}: no {entry} in the bundle")
    # stlite does not read .streamlit/config.toml, so the app's own settings are passed explicitly
    sconf = {"client.toolbarMode": "minimal", "client.showErrorDetails": "none"}
    sconf.update(t.get("config", {}))
    cfg = {"entrypoint": entry, "requirements": t["requirements"], "files": files, "streamlitConfig": sconf}
    (out / "index.html").write_text(PAGE.format(title=t["title"], cdn=CDN, config=json.dumps(cfg)), encoding="utf-8", newline="\n")
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"{slug:20} {len(files):3} files {size // 1024:6} KB  -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    wanted = sys.argv[1:] or ["all"]
    slugs = list(TARGETS) if wanted == ["all"] else wanted
    for s in slugs:
        if s not in TARGETS:
            raise SystemExit(f"unknown demo '{s}'; choose from {', '.join(TARGETS)}")
        build(s)
