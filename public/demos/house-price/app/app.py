import pandas as pd
import streamlit as st
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from demo_common import banner

st.set_page_config(page_title="House Price - Linear Regression", page_icon="🏠")
st.title("House price · linear regression")
banner("SCT_ML_1", "house_predict.ipynb", "the feature choice and the LinearRegression model")


@st.cache_resource(show_spinner="Fitting the notebook's model on the Kaggle training data…")
def fit():
    """The notebook: GrLivArea, BedroomAbvGr and TotalBathrooms (full + 0.5 x half, above ground and basement) -> SalePrice."""
    data = pd.read_csv("train.csv")
    data["TotalBathrooms"] = data["FullBath"] + 0.5 * data["HalfBath"] + data["BsmtFullBath"] + 0.5 * data["BsmtHalfBath"]
    df = data[["GrLivArea", "BedroomAbvGr", "TotalBathrooms", "SalePrice"]].dropna()
    X, y = df[["GrLivArea", "BedroomAbvGr", "TotalBathrooms"]], df["SalePrice"]
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    model = LinearRegression().fit(X_train, y_train)
    pred = model.predict(X_val)
    return model, df, r2_score(y_val, pred), mean_absolute_error(y_val, pred)


model, df, r2, mae = fit()

st.caption("Prices are in US dollars (the Kaggle “House Prices” data, Ames, Iowa).")
c1, c2, c3 = st.columns(3)
area = c1.number_input("Living area (sq ft)", 300, 6000, 1500, step=50)
bedrooms = c2.number_input("Bedrooms above ground", 0, 8, 3)
baths = c3.number_input("Total bathrooms", 0.0, 8.0, 2.0, step=0.5, help="Half baths count as 0.5, as in the notebook")

price = float(model.predict(pd.DataFrame([[area, bedrooms, baths]], columns=["GrLivArea", "BedroomAbvGr", "TotalBathrooms"]))[0])
st.metric("Estimated sale price", f"${price:,.0f}")
if price < 0:
    st.warning("A straight-line model can go negative far outside the training data — this is one of its limits.")

m1, m2 = st.columns(2)
m1.metric("R² on held-out 20%", f"{r2:.3f}")
m2.metric("Mean absolute error", f"${mae:,.0f}")

coef = pd.Series(model.coef_, index=["per sq ft", "per bedroom", "per bathroom"])
st.write("What the model learned (dollars added by one more unit, others held fixed):")
st.dataframe(coef.rename("coefficient").to_frame().style.format("{:,.1f}"), use_container_width=True)
corr = df["GrLivArea"].corr(df["BedroomAbvGr"])
st.caption(
    f"Fitted on {len(df):,} houses. Bedrooms get a negative coefficient here: they are correlated with living area "
    f"(r = {corr:.2f}), which already carries most of the signal, so read coefficients as 'holding the others fixed', not as advice."
)
