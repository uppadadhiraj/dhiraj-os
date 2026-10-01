import numpy as np
import pandas as pd
import streamlit as st

from demo_common import OWNER, banner

st.set_page_config(page_title="Titanic Survival Analysis", page_icon="🚢")
st.title("Titanic Survival Analysis")
banner("Titanic_Ship_Survival", "Titanic.ipynb", "the notebook's cleaning and feature-engineering steps")


@st.cache_data
def load() -> pd.DataFrame:
    """The notebook's cleaning: median Age, modal Embarked, Cabin -> Has_Cabin, then FamilySize / IsAlone."""
    df = pd.read_csv("Titanic-Dataset.csv")
    df["Age"] = df["Age"].fillna(df["Age"].median())
    df["Embarked"] = df["Embarked"].fillna(df["Embarked"].mode()[0])
    df["Has_Cabin"] = df["Cabin"].notna().astype(int)
    df = df.drop("Cabin", axis=1)
    df["FamilySize"] = df["SibSp"] + df["Parch"] + 1
    df["IsAlone"] = (df["FamilySize"] == 1).astype(int)
    return df


df = load()

with st.sidebar:
    st.header("Filter passengers")
    sexes = st.multiselect("Sex", sorted(df["Sex"].unique()), default=sorted(df["Sex"].unique()))
    classes = st.multiselect("Passenger class", [1, 2, 3], default=[1, 2, 3])
    lo, hi = st.slider("Age", 0, 80, (0, 80))

view = df[df["Sex"].isin(sexes) & df["Pclass"].isin(classes) & df["Age"].between(lo, hi)]
if view.empty:
    st.warning("No passengers match these filters.")
    st.stop()

m1, m2, m3 = st.columns(3)
m1.metric("Passengers", len(view))
m2.metric("Survived", int(view["Survived"].sum()))
m3.metric("Survival rate", f"{view['Survived'].mean():.1%}")

st.subheader("Survival rate by …")
feature = st.selectbox(
    "Feature",
    ["Pclass", "Sex", "Embarked", "Has_Cabin", "FamilySize", "IsAlone"],
    format_func={"Pclass": "Passenger class", "Sex": "Sex", "Embarked": "Port of embarkation", "Has_Cabin": "Has a cabin number",
                 "FamilySize": "Family size", "IsAlone": "Travelling alone"}.get,
)
rate = view.groupby(feature)["Survived"].agg(["mean", "count"]).rename(columns={"mean": "survival rate", "count": "passengers"})
st.bar_chart(rate["survival rate"])
st.dataframe(rate.style.format({"survival rate": "{:.1%}"}), use_container_width=True)

st.subheader("Class and sex together")
both = view.groupby(["Pclass", "Sex"])["Survived"].mean().unstack()
st.bar_chart(both)

st.subheader("Age of those who survived and those who did not")
bins = np.arange(0, 85, 5)
counts = {
    label: np.histogram(view.loc[view["Survived"] == flag, "Age"], bins=bins)[0]
    for flag, label in ((1, "survived"), (0, "did not survive"))
}
st.bar_chart(pd.DataFrame(counts, index=[f"{b}-{b + 4}" for b in bins[:-1]]))

st.caption(
    f"Ages missing in the data were filled with the median, as in the notebook. The notebook also builds a full profiling report "
    f"(`titanic_report.html`) — see it in the [repository]({OWNER}/Titanic_Ship_Survival)."
)
