import numpy as np
import pandas as pd
import streamlit as st

from demo_common import banner

st.set_page_config(page_title="Netflix Content EDA", page_icon="🎬", layout="wide")
st.title("Netflix content explorer")
banner("Netflix-Content-EDA", "Netflix-EDA.ipynb", "the notebook's cleaning steps and questions")


@st.cache_data(show_spinner="Cleaning the catalogue as in the notebook…")
def load() -> pd.DataFrame:
    df = pd.read_csv("netflix_titles.csv")
    df["country"] = df["country"].fillna(df["country"].mode()[0])
    df = df.dropna(subset=["date_added", "rating"]).copy()
    df["date_added"] = pd.to_datetime(df["date_added"], format="mixed", dayfirst=True)
    df["year_added"] = df["date_added"].dt.year
    return df


df = load()
movies = df[df["type"] == "Movie"].copy()
shows = df[df["type"] == "TV Show"].copy()
movies["minutes"] = movies["duration"].str.replace(" min", "").astype(int)
shows["seasons"] = shows["duration"].str.replace(" Seasons", "").str.replace(" Season", "").astype(int)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Titles", f"{len(df):,}")
c2.metric("Movies", f"{len(movies):,}", f"{len(movies) / len(df):.1%}", delta_color="off")
c3.metric("TV shows", f"{len(shows):,}", f"{len(shows) / len(df):.1%}", delta_color="off")
c4.metric("Years covered (added)", f"{int(df['year_added'].min())}–{int(df['year_added'].max())}")

over_time, genres, lengths, browse = st.tabs(["Added over time", "Genres, countries, ratings", "Durations", "Browse titles"])

with over_time:
    st.subheader("Titles added to Netflix each year, by type")
    st.line_chart(df.groupby(["year_added", "type"]).size().unstack().fillna(0))
    st.caption("Year the title was added to the service (`date_added`), not the year it was released.")

with genres:
    top_n = st.slider("How many to show", 5, 25, 15)
    left, right = st.columns(2)
    with left:
        st.subheader("Top genres")
        g = df.assign(genre=df["listed_in"].str.split(", ")).explode("genre")["genre"].value_counts().head(top_n)
        st.bar_chart(g, horizontal=True)
    with right:
        st.subheader("Top producing countries")
        c = df.assign(country=df["country"].str.split(", ")).explode("country")["country"].value_counts().head(top_n)
        st.bar_chart(c, horizontal=True)
    st.subheader("Maturity ratings")
    st.bar_chart(df["rating"].value_counts())
    st.caption("Missing countries were filled with the most common one, as in the notebook, so the first bar is inflated.")

with lengths:
    left, right = st.columns(2)
    with left:
        st.subheader("Movie length (minutes)")
        counts, edges = np.histogram(movies["minutes"], bins=range(0, 330, 10))
        st.bar_chart(pd.Series(counts, index=[f"{int(a)}-{int(a) + 9}" for a in edges[:-1]]))
        st.write(f"Median movie: **{int(movies['minutes'].median())} minutes**.")
    with right:
        st.subheader("TV show seasons")
        st.bar_chart(shows["seasons"].value_counts().sort_index())
        st.write(f"Shows with a single season: **{(shows['seasons'] == 1).mean():.0%}**.")

with browse:
    f1, f2, f3 = st.columns(3)
    kind = f1.selectbox("Type", ["Any", "Movie", "TV Show"])
    genre_all = sorted(set(g for row in df["listed_in"] for g in row.split(", ")))
    genre = f2.selectbox("Genre", ["Any"] + genre_all)
    text = f3.text_input("Title contains")
    lo, hi = st.slider("Release year", int(df["release_year"].min()), int(df["release_year"].max()),
                       (int(df["release_year"].min()), int(df["release_year"].max())))
    view = df[df["release_year"].between(lo, hi)]
    if kind != "Any":
        view = view[view["type"] == kind]
    if genre != "Any":
        view = view[view["listed_in"].str.contains(genre, regex=False)]
    if text.strip():
        view = view[view["title"].str.contains(text.strip(), case=False, regex=False)]
    st.write(f"{len(view):,} titles match" + (" — showing the first 200." if len(view) > 200 else "."))
    st.dataframe(view[["title", "type", "release_year", "rating", "duration", "country", "listed_in"]].head(200), use_container_width=True, hide_index=True)

st.caption("The notebook also draws a word cloud of descriptions; it is left out here to keep the page light.")
