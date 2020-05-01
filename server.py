import glob
import json
import os
import pprint as pp
import random
import pickle
from collections import defaultdict
from urllib.parse import urlparse

import networkx as nx
import spotipy
from flask import (Flask, make_response, redirect, render_template, request,
                   session)
from flask.helpers import send_from_directory
from spotipy import oauth2

app = Flask(__name__, static_url_path='/static')

client_id = os.getenv("SPOTIPY_CLIENT_ID")
client_secret = os.getenv("SPOTIPY_CLIENT_SECRET")
redirect_uri = os.getenv("SPOTIPY_REDIRECT_URI")

app.secret_key = os.getenv("FLASK_SECRET") or "test"

session_manager={}
files = glob.glob('cache/*')
for f in files:
    os.remove(f)

with open("./static/genre_playlists_popularity_artists_test.p", "rb") as fp:
    genre_playlists_popularity_artists = pickle.load(fp)
with open("./static/genreList.p", "rb") as fp:
    all_genres = pickle.load(fp)
    # print(all_genres)

@app.route('/top_genres', methods=['POST'])
def top_genres():
    id = session["id"]
    current_session = session_manager[id]
    sp = current_session.sp
    if not current_session.all_top_artists:
        print("getting top artists")
        artist_dict = defaultdict(dict)
        all_top_artists = {}

        genre_dict = defaultdict(list)
        overlap = defaultdict(dict)
        for time_range in ["long_term", "medium_term", "short_term"]:
            top_artists = sp.current_user_top_artists(limit=50, time_range=time_range)
            for artist in top_artists["items"]:
                artist_name = artist["name"]
                if artist_name not in artist_dict:
                    for image in artist["images"]:
                        if image["width"] < 200:
                            artist_dict[artist_name]["image"] = image["url"]
                            break
                    else:
                        print('bye')
                        artist_dict[artist_name]["image"] = artist["images"][-1]["url"]
                    artist_dict[artist_name]["genres"] = artist["genres"]
                    artist_dict[artist_name]["uri"] = artist["uri"]
                    artist_dict[artist_name]["popularity"] = artist["popularity"]
                    artist_dict[artist_name]["time_range"] = [time_range]
                    for i, genre in enumerate(artist["genres"]):
                        genre_dict[genre].append(artist_name)
                        for j in range(i+1, len(artist["genres"])): # could be changed from 1/2 n^2 to n^2
                            overlap[genre][artist["genres"][j]] = overlap[genre].get(artist["genres"][j], 0) + 1
                else:
                    artist_dict[artist_name]["time_range"].append(time_range)
            all_top_artists[time_range] = top_artists
        
        current_session.artist_dict = artist_dict
        current_session.all_top_artists = all_top_artists
        current_session.genre_dict = genre_dict
        current_session.artist_genre_overlap = overlap
        print("got top artists")
    else:
        print("top artists exists")
    
    node_data = [
        {"genre": item[0], 
        "artists": item[1], 
        "id": ind} for ind, item in enumerate(sorted(current_session.genre_dict.items(), key = lambda el: len(el[1]), reverse=True))]
    link_data = [{"source": source, "target": target, "weight": weight}
     for source, item in current_session.artist_genre_overlap.items() for target, weight in item.items() ]

    G = nx.Graph()

    for node in node_data:
        G.add_node(node["genre"], index=node["id"], artists=node["artists"])
    for link in link_data:
        G.add_edge(link["source"], link["target"], weight=link["weight"])
    
    deg = nx.degree_centrality(G)   
    close = nx.closeness_centrality(G)
    bet = nx.betweenness_centrality(G, normalized=False)
    eig = nx.eigenvector_centrality(G)

    def gen(d):
        cnt, index = 0, 0
        it = sorted(d.items(), key=lambda data: data[1], reverse=True)
        yield index, it[cnt][0]
        while cnt < len(it) - 1 :
            cnt+=1
            if it[cnt][1] != it[cnt-1][1]:
                index = cnt
            yield index, it[cnt][0]

    total_artist_pop = {
        genre: sum([current_session.artist_dict[artist]["popularity"] for artist in artists])  for genre, artists in current_session.genre_dict.items()
    }
    average_artist_pop = {
        genre: sum([current_session.artist_dict[artist]["popularity"] for artist in artists])/len(artists)  for genre, artists in current_session.genre_dict.items()
    }

    personal_pop = {
        genre: -genre_playlists_popularity_artists[genre]["popularity_index"]  for genre in genre_playlists_popularity_artists if genre in current_session.genre_dict 
    }

    personal_pop_r = {item: rank + 1 for rank, item in gen(personal_pop)}
    # # pop_r = {item: rank + 1 for rank, item in gen(pop)}
    artist_r = {item: rank + 1 for rank, item in gen({node["genre"]: len(node["artists"]) for node in node_data})}
    deg_r = {item: rank+1 for rank, item in gen(deg)}
    close_r = {item: rank+1 for rank, item in gen(close)}
    bet_r = {item: rank+1 for rank, item in gen(bet)}
    eig_r = {item: rank+1 for rank, item in gen(eig)}

    total_artist_pop_r = {item: rank + 1 for rank, item in gen(total_artist_pop)}
    average_artist_pop_r = {item: rank + 1 for rank, item in gen(average_artist_pop)}

    new_node_data = [ 
        {
            "centrality": {
                "# of artists": artist_r[node["genre"]],
                "degree": deg_r[node["genre"]],
                "closeness": close_r[node["genre"]],
                "betweenness": bet_r[node["genre"]],
                "eigenvector": eig_r[node["genre"]],
            },
            "playlists": genre_playlists_popularity_artists[node["genre"]]["playlists"],
            "popularity": {
                "global": genre_playlists_popularity_artists[node["genre"]]["popularity_index"]+1,
                "personal" : personal_pop_r[node["genre"]],
                "artist": {
                    "total": total_artist_pop_r[node["genre"]],
                    "average": average_artist_pop_r[node["genre"]],
                },
            },
            **node
        } for i, node in enumerate(node_data)]
    return json.dumps({"nodes": new_node_data, "links": link_data, "artists": current_session.artist_dict, "all_genres": {genre: len(l["artists"]) for genre, l in genre_playlists_popularity_artists.items()}})


@app.route('/all_artists_top_tracks', methods=['POST'])
def all_artists_top_tracks():
    print("starting")
    id = session["id"]
    current_session = session_manager[id]
    if not current_session.all_artists_tracks_uri: 
        sp = current_session.sp
        artist_dict = current_session.artist_dict

        all_artist_uri = {}
        for artist, data in artist_dict.items():
            top_tracks = sp.artist_top_tracks(data["uri"])
            tracks = [{"uri": track["preview_url"], "name": track["name"], "link": track["external_urls"]["spotify"]} for track in top_tracks["tracks"]]
            all_artist_uri[artist] = tracks
        current_session.all_artists_tracks_uri = all_artist_uri
    print("done")
    return json.dumps(current_session.all_artists_tracks_uri)

@app.route('/frame')
def frame():
    if "id" not in session or session["id"] not in session_manager:
        return redirect("/")
    return app.send_static_file("frame")

@app.route('/main')
def main_page():
    if "id" not in session or session["id"] not in session_manager:
        return redirect("/")
    return app.send_static_file("main.html")

@app.route('/')
def hello_world():
    return app.send_static_file("index.html")

@app.route('/login')
def login():
    try:
        current_session = session_manager[session["id"]]
        sp = current_session.sp
        print(f"existing user: {sp.me()['id']}")
        return redirect('/main')
    except KeyError:
        print("outdated session")
    print("new user")
    session_id = random.getrandbits(128)
    session["id"] = session_id

    sp_oauth = oauth2.SpotifyOAuth(
        client_id,
        client_secret,
        redirect_uri,
        cache_path=f"cache/{hex(session_id)}",
        scope='user-library-read user-top-read'
    )

    session_manager[session_id] = Session(session_id, sp_oauth)

    url = sp_oauth.get_authorize_url()
    print(url)
    return redirect(url)

@app.route('/callback')
def callback():

    current_session = session_manager[session["id"]]

    code = request.args.get('code')
    sp_oauth = current_session.oauth
    sp_oauth.token_info = sp_oauth.get_access_token(code=code, check_cache=True)
    
    sp = spotipy.Spotify(oauth_manager=sp_oauth)
    current_session.sp = sp

    print(f"Made session for {sp.me()['id']}")

    return redirect('/main')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

class Session():

    def __init__(self, session_id, oauth):
        self.session_id = session_id
        self.oauth = oauth
        self.sp = None
        self.artist_dict = None       
        self.all_top_artists = None
        self.all_artists_tracks_uri = None
        self.artist_genre_overlap = None
        self.genre_dict = None



if __name__ == '__main__':
   app.run(debug = True)
