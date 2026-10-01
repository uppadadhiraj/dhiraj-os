"""Regenerate movie_dict.pkl and similarity.pkl for the browser demo.

Runs the notebook's own steps (Movie-recommendations.ipynb) on the TMDB 5000 files from the Movie-Recommendations
repository, then writes the two files the repository's app.py loads. Usage:

    python demos-src/movie/generate.py <path to a clone of Movie-Recommendations> <output folder>

Notes on fidelity: the notebook builds a `stem()` helper but never assigns its result, so the vectoriser sees the
un-stemmed tags; this script does the same. similarity.pkl holds a compact TopSim (see topsim.py) instead of the
full matrix, and the script verifies that every movie gets identical recommendations either way.
"""
import ast
import os
import pickle
import sys

import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

sys.path.insert(0, os.path.dirname(__file__))
from topsim import TopSim  # noqa: E402

KEEP = 12


def names(obj, limit=None, job=None):
    out = []
    for item in ast.literal_eval(obj):
        if job is not None and item["job"] != job:
            continue
        out.append(item["name"])
        if limit is not None and len(out) == limit:
            break
    return out


def main(repo: str, out: str) -> None:
    credits = pd.read_csv(os.path.join(repo, "tmdb_5000_credits.csv.zip"))
    movies = pd.read_csv(os.path.join(repo, "tmdb_5000_movies.csv.zip"))
    movies = pd.merge(movies, credits, on="title")
    movies = movies[["id", "title", "genres", "keywords", "popularity", "revenue", "overview", "cast", "crew"]]
    movies.dropna(inplace=True)

    movies["genres"] = movies["genres"].apply(names)
    movies["cast"] = movies["cast"].apply(lambda o: names(o, limit=3))
    movies["keywords"] = movies["keywords"].apply(names)
    movies["crew"] = movies["crew"].apply(lambda o: names(o, job="Director"))
    movies["overview"] = movies["overview"].apply(lambda x: x.split())
    for col in ("genres", "keywords", "cast", "crew"):
        movies[col] = movies[col].apply(lambda x: [i.replace(" ", "") for i in x])

    movies["tags"] = movies["genres"] + movies["keywords"] + movies["overview"] + movies["cast"] + movies["crew"]
    new_df = movies[["id", "title", "tags"]].copy()
    new_df["tags"] = new_df["tags"].apply(lambda x: " ".join(x)).apply(lambda x: x.lower())

    vectors = CountVectorizer(max_features=5000, stop_words="english").fit_transform(new_df["tags"]).toarray()
    similarity = cosine_similarity(vectors)
    n = len(new_df)

    neighbours = {}
    for row in range(n):
        ranked = sorted(list(enumerate(similarity[row])), reverse=True, key=lambda x: x[1])[:KEEP]
        neighbours[row] = [(int(c), float(v)) for c, v in ranked]
    compact = TopSim(n, neighbours)

    def top5(matrix, row):
        return [i for i, _ in sorted(list(enumerate(matrix[row])), reverse=True, key=lambda x: x[1])[1:6]]

    for row in range(n):
        assert top5(similarity, row) == top5(compact, row), f"recommendations differ for row {row}"
    print(f"verified: identical top-5 recommendations for all {n} movies")

    os.makedirs(out, exist_ok=True)
    # the app only reads 'title' from the dictionary, so the bulky tags column is not shipped
    with open(os.path.join(out, "movie_dict.pkl"), "wb") as f:
        pickle.dump(new_df[["id", "title"]].to_dict(), f)
    with open(os.path.join(out, "similarity.pkl"), "wb") as f:
        pickle.dump(compact, f)
    for name in ("movie_dict.pkl", "similarity.pkl"):
        print(name, os.path.getsize(os.path.join(out, name)) // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
