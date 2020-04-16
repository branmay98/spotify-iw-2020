# %%

from bs4 import BeautifulSoup
import requests, sys
from collections import defaultdict
import pickle

#%%

## Request HTML

r = requests.get("http://everynoise.com/engenremap.html")

## Parse Genre HTML Elements
soup = BeautifulSoup(r.text,"html.parser")
allGenreDivs = soup.find_all("div", "genre scanme")

# %%
r_allgenres = requests.get("http://everynoise.com/everynoise1d.cgi?vector=popularity&scope=all")

genre_metadata = defaultdict(dict)

soup = BeautifulSoup(r_allgenres.text, "html.parser")
all_rows = soup.find_all("tr")
for i, row in enumerate(all_rows):
    tds =  row.find_all("td")
    popularity = i
    embed_link = tds[1].find_next("a")["href"]
    genre = tds[2].find_next("a").getText()
    genre_metadata[genre]["url"] = embed_link
    genre_metadata[genre]["popularity_index"] = popularity
    print(f"genre: {i}")
## Cycle through genres and go to the pages

# %%
with open("genre_links_pop.p", "wb") as fp:
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

with open('genreList.p', 'wb') as fp:
    pickle.dump(genreList, fp)


# %%

with open ("kek.p", "wb") as fp:
    pickle.dump(["1", "2", "3"], fp)

with open("kek.p", "rb") as fp:
    kek = pickle.load(fp)
    print(kek)


# %%
with open('genreList.p', 'rb') as fp:
    genreList = pickle.load(fp)
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
list(artistList["JMSN"]) # check that its now alphebetized


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

with open('artistList.p', 'wb') as fp:
    pickle.dump(artistList, fp)

with open('genreList.p', 'wb') as fp:
    pickle.dump(genreList, fp)
    
with open('artists.p', 'wb') as fp:
    pickle.dump(artists, fp)

with open('genres.p', 'wb') as fp:
    pickle.dump(genres, fp)

# %%
