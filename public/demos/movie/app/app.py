import streamlit as st
import pandas as pd
import pickle as pkl

def recommend(movie):
    movie_index = movies[movies['title'] == movie].index[0]
    distances = similarity[movie_index]
    movies_list = sorted(list(enumerate(distances)), reverse=True,key=lambda x: x[1])[1:6]
    recommend_movies = []
    for i in movies_list:
        recommend_movies.append(movies.iloc[i[0]].title)
    return recommend_movies

movies_dict = pkl.load(open('movie_dict.pkl', 'rb'))
movies = pd.DataFrame(movies_dict)

similarity = pkl.load(open('similarity.pkl', 'rb'))

st.title('Movie Recommender')

selected_movie_name = st.selectbox('Select Movie to recommend',movies['title'].values)
if st.button('Recommend Movie'):
    recommendations = recommend(selected_movie_name)
    for i in recommendations:
        st.write(i)