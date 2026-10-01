import pickle as pkl
import re
from pathlib import Path

import streamlit as st

try:  # fetching a page by URL needs a server (newspaper3k + network); not available when run inside a browser (stlite)
    from newspaper import Article

    from safe_fetch import FetchError, UnsafeURLError, fetch_html

    URL_MODE = True
except ImportError:
    URL_MODE = False

HERE = Path(__file__).resolve().parent
MIN_CHARS = 200

EXAMPLES = {
    "A fact-check style paragraph": (
        "A viral video shared on Twitter and Facebook claims to show a protest in Delhi. BOOM fact-checked the claim and found "
        "that the video is old and unrelated to the recent events. The image was first posted years earlier. "
    )
    * 4,
    "A news-report style paragraph": (
        "NEW DELHI: A final decision on the proposal will be taken after the committee submits its report, an official said on "
        "Saturday. The minister said the plan would be discussed with state governments before it goes to Parliament, and added "
        "that the schedule for the first phase would be announced next month. "
    )
    * 4,
}


@st.cache_resource
def load_artifacts():
    """Load the model, vectoriser and label encoder once per process (these are this repo's own pickles)."""
    with open(HERE / "model.pkl", "rb") as f:
        model = pkl.load(f)
    with open(HERE / "vectorizer.pkl", "rb") as f:
        vectorizer = pkl.load(f)
    with open(HERE / "le.pkl", "rb") as f:
        le = pkl.load(f)
    return model, vectorizer, le


def preprocess_text(text):
    """Same preprocessing as in the training notebook."""
    text = text.lower()
    return re.sub(r"\W+", " ", text)


def predict(text, top_n=6):
    """Return (label, confidence, words that pushed the prediction toward that label)."""
    model, vectorizer, le = load_artifacts()
    x = vectorizer.transform([preprocess_text(text)])
    proba = model.predict_proba(x)[0]
    idx = int(proba.argmax())
    label = le.inverse_transform([model.classes_[idx]])[0]
    # for a binary logistic regression, positive coefficients push toward classes_[1]
    sign = 1.0 if idx == 1 else -1.0
    contributions = x.toarray()[0] * model.coef_[0] * sign
    names = vectorizer.get_feature_names_out()
    top = [names[i] for i in contributions.argsort()[::-1][:top_n] if contributions[i] > 0]
    return label, float(proba[idx]), top


def article_text_from_url(url):
    html = fetch_html(url)  # validated, size-limited fetch (see safe_fetch.py)
    article = Article(url)
    article.download(input_html=html)
    article.parse()
    return article.text


def show_result(text):
    if len(text.strip()) < MIN_CHARS:
        st.warning("Not enough text to score. Paste or link a full article (at least a few paragraphs).")
        return
    label, confidence, words = predict(text)
    st.success(f"Prediction: {label} (Confidence: {confidence:.2f})")
    if words:
        with st.expander("Which words pushed this prediction?"):
            st.write(", ".join(words))
            st.caption(
                "If these look like the vocabulary of fact-check write-ups (video, viral, claim, fact...) "
                "rather than anything about the story itself, that is the limitation described below."
            )


st.set_page_config(page_title="Indian News Fake News Detector", page_icon="📰")
st.title("Indian News Fake News Detector")
st.caption(
    "A TF-IDF + logistic-regression model trained on a labelled dataset of Indian news. "
    "It scores the writing, not the truth, so treat the result as a demo signal."
)

def render_paste():
    st.caption("No article handy? Load an example, then press “Check text”.")
    cols = st.columns(len(EXAMPLES))
    for col, (label, text) in zip(cols, EXAMPLES.items()):
        if col.button(label, key=f"example_{label}"):
            st.session_state["pasted"] = text
    with st.form("text_form"):
        pasted = st.text_area("Paste the article text", height=220, key="pasted")
        go_text = st.form_submit_button("Check text")
    if go_text:
        show_result(pasted)


if URL_MODE:
    tab_url, tab_text = st.tabs(["Article URL", "Paste text"])

    with tab_url:
        with st.form("url_form"):
            url = st.text_input("Enter the news article URL", placeholder="https://example.com/news/story")
            go_url = st.form_submit_button("Check News")
        if go_url:
            if not url.strip():
                st.warning("Enter a link first.")
            else:
                with st.spinner("Analyzing article..."):
                    try:
                        show_result(article_text_from_url(url))
                    except UnsafeURLError as e:
                        st.error(f"That link can't be used: {e}")
                    except FetchError as e:
                        st.error(f"Couldn't read that page: {e}")
                    except Exception:  # noqa: BLE001 - never show a traceback to visitors
                        st.error("Couldn't extract an article from that page.")

    with tab_text:
        render_paste()
else:
    st.info(
        "This copy runs entirely inside your browser, which cannot download other sites' pages, "
        "so it scores text you paste. (The server version can also fetch a link.)"
    )
    render_paste()

with st.expander("How reliable is this? (read before trusting a score)"):
    st.markdown(
        """
On its own held-out split (745 articles) the saved model is about **99.5% accurate**, but that number mostly measures the
*source*, not whether a story is true. Its strongest FAKE-class words are fact-checking vocabulary
(*video, boom, viral, fake, image, claim, fact*): in the training split, 1,327 of 2,976 articles contain "boom" (a
fact-checking outlet's name) and every one is labelled FAKE. The model has learned which outlet wrote an article more than
whether it is false, so it will not generalise to articles from other outlets.

Measured by re-evaluating the saved model on the notebook's own 80/20 split (random_state 42).
"""
    )
