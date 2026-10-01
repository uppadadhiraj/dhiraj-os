import numpy as np
import pandas as pd
import streamlit as st
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from demo_common import banner

st.set_page_config(page_title="Logistic Regression from Scratch", page_icon="🩺")
st.title("Logistic regression from scratch")
banner("logistic-regression-from-scratch", "Logistic-regression.ipynb", "the `Logistic_Regression` class (sigmoid + gradient descent, NumPy only), copied unchanged,")


# ---- the notebook's class, unchanged ----
class Logistic_Regression():

    def __init__ (self,learning_rate,no_of_iterations):
        self.learning_rate = learning_rate
        self.no_of_iterations = no_of_iterations

    def fit(self,X,Y):

        #taking the data and features
        self.m,self.n = X.shape #no of (rows and columns)

        #initlizing the weights and bias
        self.w = np.zeros(self.n)
        self.b = 0
        self.X= X
        self.Y = Y

        #implementing the Grident Descent
        for i in range(self.no_of_iterations):
            self.update_weight()

    def update_weight(self):
        #sigmoid function
        Y_hat = 1 / (1 + np.exp( - (self.X.dot(self.w) + self.b ) ))

        #calculating the gradients derivatives
        dw = (1/self.m)*np.dot(self.X.T, (Y_hat - self.Y))
        db = (1/self.m)*np.sum(Y_hat - self.Y)

        #updating the weights and bias
        self.w = self.w - self.learning_rate * dw
        self.b = self.b - self.learning_rate * db

    def predict(self,X):
        Y_predict = 1 / (1 + np.exp( - (X.dot(self.w) + self.b ) ))
        Y_predict = np.where(Y_predict > 0.5,1,0)
        return Y_predict
# ---- end of the notebook's class ----

FEATURES = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI", "DiabetesPedigreeFunction", "Age"]


@st.cache_data
def data():
    df = pd.read_csv("diabetes.csv")
    features, target = df.drop(columns="Outcome", axis=1), df["Outcome"]
    scaler = StandardScaler().fit(features)  # the notebook standardises before splitting
    X_train, X_test, Y_train, Y_test = train_test_split(scaler.transform(features), target, random_state=2, test_size=0.2)
    return df, scaler, X_train, X_test, Y_train.values, Y_test.values


df, scaler, X_train, X_test, Y_train, Y_test = data()

st.write(
    "The notebook classifies the Pima diabetes data (768 patients, `Outcome` 1 = diabetic) with learning rate 0.01 and 1,000 iterations. "
    "Change them to see how training behaves."
)
c1, c2 = st.columns(2)
lr = c1.select_slider("Learning rate", options=[0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5], value=0.01)
iters = c2.slider("Iterations", 1, 3000, 1000)

model = Logistic_Regression(learning_rate=lr, no_of_iterations=iters)
# the class's own fit() loop, stepped here so the log-loss after each update can be recorded
model.m, model.n = X_train.shape
model.w, model.b, model.X, model.Y = np.zeros(model.n), 0, X_train, Y_train
loss = []
for _ in range(iters):
    model.update_weight()
    p = np.clip(1 / (1 + np.exp(-(X_train.dot(model.w) + model.b))), 1e-9, 1 - 1e-9)
    loss.append(float(-np.mean(Y_train * np.log(p) + (1 - Y_train) * np.log(1 - p))))

m1, m2 = st.columns(2)
m1.metric("Accuracy on training data", f"{accuracy_score(Y_train, model.predict(X_train)):.3f}")
m2.metric("Accuracy on test data", f"{accuracy_score(Y_test, model.predict(X_test)):.3f}")
st.line_chart(pd.DataFrame({"log-loss": loss}))
st.caption(f"{int((df['Outcome'] == 0).sum())} non-diabetic and {int((df['Outcome'] == 1).sum())} diabetic patients, so always predicting 'non-diabetic' would already score {(df['Outcome'] == 0).mean():.1%}.")

st.subheader("Check a patient")
defaults = dict(zip(FEATURES, [5, 166, 72, 19, 175, 25.8, 0.587, 51]))  # the notebook's example input
cols = st.columns(4)
values = []
for i, name in enumerate(FEATURES):
    low, high = float(df[name].min()), float(df[name].max())
    values.append(cols[i % 4].number_input(name, low, high, float(defaults[name]), step=0.01 if name == "DiabetesPedigreeFunction" else 1.0 if float(defaults[name]).is_integer() else 0.1))

if st.button("Predict", type="primary"):
    result = int(model.predict(scaler.transform(pd.DataFrame([values], columns=FEATURES)))[0])
    (st.warning if result else st.success)("The person is diabetic" if result else "The person is not diabetic")
st.caption("Educational demo only — not medical advice.")
