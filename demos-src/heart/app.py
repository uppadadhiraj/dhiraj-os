import numpy as np
import pandas as pd
import streamlit as st
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC

from demo_common import banner

st.set_page_config(page_title="Heart Disease Predictor", page_icon="❤️")
st.title("Heart Disease Predictor")
banner("Heart-Disease-Predictor", "Heart Disease Predictor.ipynb", "the preprocessing and SVM model")

CATEGORICAL = ["sex", "cp", "fbs", "restecg", "exang", "slope", "thal"]
NUMERICAL = ["age", "trestbps", "chol", "thalch", "oldpeak", "ca"]
LEVELS = {
    0: "no heart disease",
    1: "disease, level 1",
    2: "disease, level 2",
    3: "disease, level 3",
    4: "disease, level 4",
}


@st.cache_resource(show_spinner="Training the notebook's SVM on the UCI heart-disease data…")
def train():
    """Exactly the notebook's pipeline: impute, scale, one-hot encode, 80/20 stratified split (random_state=42), SVC(random_state=42)."""
    df = pd.read_csv("heart_disease_uci.csv")
    X = df.drop("num", axis=1).drop(["id", "dataset"], axis=1)
    y = df["num"]

    num_imputer = SimpleImputer(strategy="mean")
    scaler = StandardScaler()
    X_num_scaled = scaler.fit_transform(num_imputer.fit_transform(X[NUMERICAL]))

    cat_imputer = SimpleImputer(strategy="most_frequent")
    encoder = OneHotEncoder(drop="first", handle_unknown="ignore", sparse_output=False)
    X_cat_encoded = encoder.fit_transform(cat_imputer.fit_transform(X[CATEGORICAL]))

    X_pre = np.hstack([X_num_scaled, X_cat_encoded])
    X_train, X_test, y_train, y_test = train_test_split(X_pre, y, test_size=0.2, random_state=42, stratify=y)
    svm = SVC(random_state=42).fit(X_train, y_train)
    accuracy = accuracy_score(y_test, svm.predict(X_test))
    return df, num_imputer, scaler, cat_imputer, encoder, svm, accuracy, len(y_test)


def predict(parts, row: dict) -> int:
    _, num_imputer, scaler, cat_imputer, encoder, svm = parts[:6]
    frame = pd.DataFrame([row])
    num = scaler.transform(num_imputer.transform(frame[NUMERICAL]))
    cat = encoder.transform(cat_imputer.transform(frame[CATEGORICAL]))
    return int(svm.predict(np.hstack([num, cat]))[0])


parts = train()
df, accuracy, n_test = parts[0], parts[6], parts[7]


def options(col):
    return sorted(df[col].dropna().unique().tolist(), key=str)


st.caption(
    "The model is a support-vector classifier trained on the 5-level `num` column "
    "(0 = no heart disease, 1–4 = increasing severity). Educational demo only — not medical advice."
)

c1, c2 = st.columns(2)
with c1:
    age = st.number_input("Age", 25, 90, 54)
    sex = st.selectbox("Sex", options("sex"), index=1)
    cp = st.selectbox("Chest pain type", options("cp"), index=2)
    trestbps = st.number_input("Resting blood pressure (mm Hg)", 80, 220, 130)
    chol = st.number_input("Cholesterol (mg/dl)", 100, 603, 240)
    fbs = st.selectbox("Fasting blood sugar > 120 mg/dl", options("fbs"), index=0)
    restecg = st.selectbox("Resting ECG", options("restecg"), index=1)
with c2:
    thalch = st.number_input("Max heart rate achieved", 60, 210, 150)
    exang = st.selectbox("Exercise-induced angina", options("exang"), index=0)
    oldpeak = st.number_input("ST depression (oldpeak)", -3.0, 7.0, 1.0, step=0.1)
    slope = st.selectbox("Slope of the peak ST segment", options("slope"), index=1)
    ca = st.number_input("Major vessels coloured by fluoroscopy (0–3)", 0, 3, 0)
    thal = st.selectbox("Thalassemia", options("thal"), index=1)

if st.button("Predict", type="primary"):
    row = dict(age=age, sex=sex, cp=cp, trestbps=trestbps, chol=chol, fbs=fbs, restecg=restecg, thalch=thalch,
               exang=exang, oldpeak=oldpeak, slope=slope, ca=ca, thal=thal)
    level = predict(parts, row)
    (st.success if level == 0 else st.warning)(f"Predicted class {level}: {LEVELS[level]}")

with st.expander("How good is this model?"):
    st.write(
        f"Accuracy on the notebook's held-out 20% ({n_test} patients) is **{accuracy:.1%}** across all five classes, "
        "computed live when this page started. The classes are imbalanced "
        f"({', '.join(f'{k}: {v}' for k, v in df['num'].value_counts().sort_index().items())} patients), "
        "so treat any single prediction as a classroom example, not a diagnosis."
    )
