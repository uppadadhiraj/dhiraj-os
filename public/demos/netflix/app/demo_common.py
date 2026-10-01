"""Shared by the browser demos built around the owner's notebooks (see scripts/make_stlite.py)."""
import streamlit as st

OWNER = "https://github.com/uppadadhiraj"


def _patch_pyarrow() -> None:
    """Let scikit-learn run inside stlite.

    stlite ships a stripped-down `pyarrow`. scikit-learn's array indexing (used by train_test_split, OneHotEncoder, ...)
    probes `pyarrow.Table / RecordBatch / Array / ChunkedArray` with isinstance(), which raises AttributeError on that
    stub for plain NumPy input. Giving the missing names an empty class makes the probe answer "not a pyarrow object",
    which is the truth here. Nothing else about the data or the model changes.
    """
    try:
        import pyarrow as pa
    except ImportError:
        return
    for name in ("Table", "RecordBatch", "Array", "ChunkedArray"):
        if not hasattr(pa, name):
            setattr(pa, name, type(name, (), {}))


_patch_pyarrow()


def banner(repo: str, source: str, what: str = "the original code") -> None:
    """Say plainly what is whose: the original code is the owner's; this Streamlit page around it was written with Claude Code."""
    st.info(
        f"**Interactive demo.** It uses {what} from "
        f"[{source}]({OWNER}/{repo}) in the **{repo}** repository. The original code is mine; this Streamlit page was "
        "written with Claude Code so it can be tried in a browser. It runs entirely in your tab: nothing you type is uploaded.",
        icon="ℹ️",
    )
