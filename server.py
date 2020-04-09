from flask import Flask, render_template, redirect, request, make_response, session
from urllib.parse import urlparse
import spotipy
import pprint as pp
import os
import glob
from collections import defaultdict
import json
import random
from spotipy import oauth2
from flask.helpers import send_from_directory

app = Flask(__name__)

client_id = os.getenv("SPOTIPY_CLIENT_ID")
client_secret = os.getenv("SPOTIPY_CLIENT_SECRET")
redirect_uri = os.getenv("SPOTIPY_REDIRECT_URI")

app.secret_key = os.getenv("FLASK_SECRET") or "test"

session_manager={}
files = glob.glob('cache/*')
for f in files:
    os.remove(f)

@app.route('/top_genres', methods=['POST'])
def top_genres():
    id = session["id"]
    current_session = session_manager[id]
    sp = current_session.sp

    artist_dict = {}
    all_top_artists = {}

    genre_dict = defaultdict(list)
    overlap = defaultdict(dict)
    for time_range in ["long_term", "medium_term", "short_term"]:
        top_artists = sp.current_user_top_artists(limit=50, time_range=time_range)
        for artist in top_artists["items"]:
            if artist["name"] not in artist_dict:
                artist_dict[artist["name"]] = artist["uri"]
                for i, genre in enumerate(artist["genres"]):
                    genre_dict[genre].append(artist["name"])
                    for j in range(i+1, len(artist["genres"])): # could be changed from 1/2 n^2 to n^2
                        overlap[genre][artist["genres"][j]] = overlap[genre].get(artist["genres"][j], 0) + 1
                        
        all_top_artists[time_range] = top_artists

    
    sorted_genres = [{"genre": item[0], "artists": item[1], "id": ind} for ind, item in enumerate(sorted(genre_dict.items(), key = lambda el: len(el[1]), reverse=True))]
    formatted_overlap = [{"source": source, "target": target, "weight": weight}
     for source, item in overlap.items() for target, weight in item.items() ]

    current_session.artist_dict = artist_dict
    current_session.all_top_artists = all_top_artists

    return json.dumps({"nodes": sorted_genres, "links": formatted_overlap})

@app.route('/all_artists_top_tracks', methods=['POST'])
def all_artists_top_tracks():
    print("starting")
    id = session["id"]
    current_session = session_manager[id]
    sp = current_session.sp
    artist_dict = current_session.artist_dict

    all_artist_uri = {}
    for artist, uri in artist_dict.items():
        top_tracks = sp.artist_top_tracks(uri)
        tracks = [{"uri": track["preview_url"], "name": track["name"], "link": track["external_urls"]["spotify"]} for track in top_tracks["tracks"]]
        all_artist_uri[artist] = tracks
    
    print("done")
    return json.dumps(all_artist_uri)



@app.route('/artist_top_tracks', methods=['POST'])
def artist_top_tracks():
    id = session["id"]
    current_session = session_manager[id]
    sp = current_session.sp
    artist_dict = current_session.artist_dict

    artist = request.json["artist"]
    artist_uri = artist_dict[artist]
    top_tracks = sp.artist_top_tracks(artist_uri)
    rand_track = top_tracks["tracks"][random.randint(0,9)]
    return(json.dumps({"uri":rand_track["preview_url"], "name":rand_track["name"]}))

@app.route('/main')
def main_page():
    if session["id"] not in session_manager:
        return redirect("/")
    return render_template("main.html")

@app.route('/')
def hello_world():
    return render_template("index.html")

@app.route('/login')
def login():

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
        self.all_top_artists = {}
        self.artist_dict = {}       



if __name__ == '__main__':
   app.run(debug = True)