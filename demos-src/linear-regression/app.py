import numpy as np
import pandas as pd
import streamlit as st
from sklearn.model_selection import train_test_split

from demo_common import banner

st.set_page_config(page_title="Linear Regression from Scratch", page_icon="📈")
st.title("Linear regression from scratch")
banner("linear-regression-from-scratch", "Linear-Regression.ipynb", "the `Linear_Regression` class (gradient descent, NumPy only), copied unchanged,")


# ---- the notebook's class, unchanged ----
class Linear_Regression():

    def __init__(self,learning_rate,no_of_iterations):
        self.learning_rate = learning_rate
        self.no_of_iterations = no_of_iterations

    def fit(self,X,Y):
        #no.of trainig data and no of features
        self.m,self.n = X.shape     #no of rows,columns

        # intilization
        self.w = np.zeros(self.n)
        self.b = 0
        self.X = X
        self.Y = Y

        #inplementation gradient descent
        for i in range(self.no_of_iterations):
            self.update_weight()

    def update_weight(self):
        Y_predict = self.predict(self.X)

        # calculating gradients
        dw = -(2 * (self.X.T).dot(self.Y - Y_predict))/self.m
        db = -2 * np.sum(self.Y - Y_predict)/self.m

        #updating weights
        self.w = self.w - self.learning_rate * dw
        self.b = self.b - self.learning_rate * db

    def predict(self,X):
        return X.dot(self.w) + self.b
# ---- end of the notebook's class ----


@st.cache_data
def data():
    df = pd.read_csv("salary_data.csv")
    X = df.iloc[:, :-1].values
    Y = df.iloc[:, 1].values
    return train_test_split(X, Y, random_state=2, test_size=0.33)  # the notebook's split


X_train, X_test, Y_train, Y_test = data()

st.write(
    "The notebook fits `Salary = w × YearsExperience + b` by gradient descent with learning rate 0.02 for 1,000 iterations. "
    "Change them and watch the fit and the loss move."
)
c1, c2 = st.columns(2)
lr = c1.select_slider("Learning rate", options=[0.0005, 0.001, 0.005, 0.01, 0.02, 0.03, 0.04], value=0.02)
iters = c2.slider("Iterations", 1, 3000, 1000)

model = Linear_Regression(learning_rate=lr, no_of_iterations=iters)
# the class's own fit() loop, stepped here so the loss after each update can be recorded
model.m, model.n = X_train.shape
model.w, model.b, model.X, model.Y = np.zeros(model.n), 0, X_train, Y_train
loss = []
for _ in range(iters):
    model.update_weight()
    loss.append(float(np.mean((Y_train - model.predict(X_train)) ** 2)))

pred_test = model.predict(X_test)
ss_res = float(np.sum((Y_test - pred_test) ** 2))
ss_tot = float(np.sum((Y_test - Y_test.mean()) ** 2))

m1, m2, m3 = st.columns(3)
m1.metric("Weight w", f"{model.w[0]:,.0f}")
m2.metric("Bias b", f"{model.b:,.0f}")
m3.metric("R² on test data", f"{1 - ss_res / ss_tot:.3f}")
if not np.isfinite(loss[-1]) or loss[-1] > 1e15:
    st.error("The loss blew up: the learning rate is too large for this data, so each step overshoots further.")

grid = np.linspace(X_train.min(), X_train.max(), 50)
chart = pd.DataFrame({"YearsExperience": np.concatenate([X_train[:, 0], X_test[:, 0], grid])})
chart["training data"] = np.concatenate([Y_train, np.full(len(X_test), np.nan), np.full(50, np.nan)])
chart["test data"] = np.concatenate([np.full(len(X_train), np.nan), Y_test, np.full(50, np.nan)])
chart["fitted line"] = np.concatenate([np.full(len(X_train) + len(X_test), np.nan), model.predict(grid.reshape(-1, 1))])
st.scatter_chart(chart, x="YearsExperience", y=["training data", "test data", "fitted line"])

st.subheader("Training loss (mean squared error)")
st.line_chart(pd.DataFrame({"loss": loss}))

st.subheader("Try it")
years = st.slider("Years of experience", 0.0, 15.0, 5.0, step=0.5)
st.metric("Predicted salary", f"{float(model.predict(np.array([[years]]))[0]):,.0f}")
st.caption("30 rows of salary data, as in the notebook. Beyond about 11 years of experience the line is extrapolating.")
