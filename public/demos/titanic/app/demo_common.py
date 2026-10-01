"""Shared by the browser demos built around the owner's notebooks (see scripts/make_stlite.py)."""
import streamlit as st

OWNER = "https://github.com/uppadadhiraj"


def banner(repo: str, notebook: str, what: str = "the notebook's code") -> None:
    """Say plainly what is whose: the notebook is the owner's; this Streamlit page around it was written with Claude Code."""
    st.info(
        f"**Interactive demo.** It uses {what} from the notebook "
        f"[{notebook}]({OWNER}/{repo}) in the **{repo}** repository. The notebook is mine; this Streamlit page was "
        "written with Claude Code so the notebook can be tried in a browser. It runs entirely in your tab: nothing you type is uploaded.",
        icon="ℹ️",
    )
