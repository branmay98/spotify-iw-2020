
from bs4 import BeautifulSoup
import requests, sys
from collections import defaultdict
import pickle
r_allgenres = requests.get("http://everynoise.com/everynoise1d.cgi?vector=popularity&scope=all")

genre_metadata = defaultdict(dict)

soup = BeautifulSoup(r_allgenres.text, "html.parser")
all_rows = soup.find_all("tr")
for i, row in enumerate(all_rows):
    tds =  row.find_all("td")
    popularity = i
    sound_playlist_link = tds[1].find_next("a")["href"]

    genre_a = tds[2].find_next("a")
    genre = genre_a.getText()

    genre_metadata[genre]["popularity_index"] = popularity
    print(f"genre: {i}")


## Get all playlists for all genres

r = requests.get("http://everynoise.com/engenremap.html")

## Parse Genre HTML Elements
soup = BeautifulSoup(r.text,"html.parser")
allGenreDivs = soup.find_all("div", "genre scanme")


genreCnt = 0

for i, div in enumerate(allGenreDivs):
    
    genre = div.get_text().split("»")[0]

    playlist_link_dict = {} 
    url = f"http://everynoise.com/{(div.find_next('a')['href'])}"
    soup = BeautifulSoup(requests.get(url).text,"html.parser")


    all_a = soup.find("div", "title").find_all("a")
    for a in all_a:
        if a.get_text() == "playlist":
            playlist_link_dict["sound"] = a["href"].split("playlist/")[-1]
        elif a.get_text() == "intro":
            playlist_link_dict["intro"] = a["href"].split("playlist/")[-1]
        elif a.get_text() == "pulse":
            playlist_link_dict["pulse"] = a["href"].split("playlist/")[-1]
        elif a.get_text() == "edge":
            playlist_link_dict["edge"] = a["href"].split("playlist/")[-1]

    if len(playlist_link_dict) != 4:
        print(i, genre, playlist_link_dict)

    genre_metadata[genre]["playlists"] = playlist_link_dict

    
    genre_metadata[genre]["artists"] = []

    allArtistDivs = soup.find_all("div", "genre scanme")

    for artist in allArtistDivs:
        artistName = str.strip(artist.getText())[:-1]
        if not(artistName.isspace()):
            genre_metadata[genre]["artists"].append(artistName) 
    genreCnt = genreCnt+1

print ("There are " + str(len(genre_metadata)) + " genres")


for genre in genre_metadata:
    genre_metadata[genre]["artists"] = sorted(list(set(genre_metadata[genre]["artists"])))

with open("../static/genre_playlists_popularity_artists_test.p", "wb") as fp:
    pickle.dump(genre_metadata, fp)

