"""Compact stand-in for the notebook's 4,806 x 4,806 cosine-similarity matrix.

The notebook pickles the full matrix (about 185 MB) as `similarity.pkl`; the Streamlit app only ever reads
`similarity[row]` and sorts it. This object stores each row's ten most similar movies and answers
`similarity[row]` with a full-length row (zeros elsewhere), so the unmodified app code produces the same
recommendations. `generate.py` checks that against the full matrix for every movie before writing the file.
"""


class TopSim:
    def __init__(self, n, neighbours):
        self.n = n
        self.neighbours = neighbours  # {row: [(column, similarity), ...]}

    def __getitem__(self, row):
        out = [0.0] * self.n
        for column, value in self.neighbours[int(row)]:
            out[column] = value
        return out

    def __len__(self):
        return self.n
