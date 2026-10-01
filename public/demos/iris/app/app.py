import streamlit as st
import pandas as pd
import pickle as pkl

model = pkl.load(open('model.pkl', 'rb'))
le = pkl.load(open('label.pkl', 'rb'))

def prediction(SepalLengthCm, SepalWidthCm, PetalLengthCm, PetalWidthCm):
    test_case = pd.DataFrame({
        'SepalLengthCm': [SepalLengthCm],
        'SepalWidthCm': [SepalWidthCm],
        'PetalLengthCm': [PetalLengthCm],
        'PetalWidthCm': [PetalWidthCm]
    })
    pred = model.predict(test_case)
    return pred

st.title('Iris type')

SepalLengthCm  = st.number_input("SepalLengthCm :")
SepalWidthCm  = st.number_input("SepalWidthCm :")
PetalLengthCm = st.number_input("PetalLengthCm :")
PetalWidthCm = st.number_input("PetalWidthCm :")

if(st.button('Predict')):
    pre = prediction(SepalLengthCm, SepalWidthCm, PetalLengthCm, PetalWidthCm)
    predicted_label = le.inverse_transform([int(pre[0])])
    st.write(predicted_label)
