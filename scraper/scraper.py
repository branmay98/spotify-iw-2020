# %%

from bs4 import BeautifulSoup
import requests, sys
from collections import defaultdict
import pickle


# %%

# get popularity indices

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

# %%

## Get all playlists for all genres

r = requests.get("http://everynoise.com/engenremap.html")

## Parse Genre HTML Elements
soup = BeautifulSoup(r.text,"html.parser")
allGenreDivs = soup.find_all("div", "genre scanme")

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

    
# %%
with open("../static/genre_playlists_popularity.p", "wb") as fp:
    pickle.dump(genre_metadata, fp)


## Cycle through genres and go to that genres page
# %%
genreList = defaultdict(list)
genreCnt = 0
for genreDiv in allGenreDivs:
    print("Pulling genre #" + str(genreCnt))
    sys.stdout.flush()
        
    genre = str.strip(genreDiv.getText())[:-1]
    genrePage = "http://everynoise.com/" + genreDiv.find_next("a")["href"]

    ## Pull artists from genre page
    r2 = requests.get(genrePage)
    soup2 = BeautifulSoup(r2.text,"html.parser")
    allArtistDivs = soup2.find_all("div", "genre scanme")

    for artist in allArtistDivs:
        artistName = str.strip(artist.getText())[:-1]
        if not(artistName.isspace()):
            genreList[genre].append(artistName) 
    genreCnt = genreCnt+1

with open('../static/genreList.p', 'wb') as fp:
    pickle.dump(genreList, fp)

print ("There are " + str(len(genreList)) + " genres")


# %%
## Make artist list
artistList = defaultdict(list)
for genre in genreList:
    artists = genreList[genre]
    for a in artists:
        artistList[a].append(genre)
        
print ("There are " + str(len(artistList)) + " artists")


# %%
# alphebetize lists, remove redundancies
for artist in artistList:
    artistList[artist] = sorted(list(set(artistList[artist])))

for genre in genreList:
    genreList[genre] = sorted(list(set(genreList[genre])))


# %%
artists = None 
artists = list()
genres = list()

for artist in artistList:
    artists.append(artist)
artists.sort()

for genre in genreList:
    genres.append(genre)
genres.sort()


# %%
## save data for HTML processing

with open('../static/artistList.p', 'wb') as fp:
    pickle.dump(artistList, fp)

with open('../static/genreList.p', 'wb') as fp:
    pickle.dump(genreList, fp)
    
with open('../static/artists.p', 'wb') as fp:
    pickle.dump(artists, fp)

with open('../static/genres.p', 'wb') as fp:
    pickle.dump(genres, fp)

# %%

with open("../static/genreList.p", 'rb') as fp:
    
    print(sorted([(name, len(val)) for name, val in pickle.load(fp).items()], key=lambda d: -d[1])[:100])

# %%
