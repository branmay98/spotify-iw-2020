// const Http = new XMLHttpRequest();
// const url='/top_artists';
// Http.open("POST", url);
// Http.send();

// Http.onreadystatechange = (e) => {
//   console.log(Http.responseText)
// }

// var d3 = require("d3")

function wrap(text, width) {
  text.each(function () {
      var text = d3.select(this),
          words = text.text().split(/\s+/).reverse(),
          word,
          line = [],
          lineNumber = 0,
          lineHeight = 1.1, // ems
          x = text.attr("x"),
          y = text.attr("y"),      
          dy = 0, //parseFloat(text.attr("dy")),
          tspan = text.text(null)
                      .append("tspan")
                      .attr("x", x)
                      .attr("y", y)
                      .attr("dy", dy + "em");
      while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node().getComputedTextLength() > width) {
              line.pop();
              tspan.text(line.join(" "));
              line = [word];
              tspan = text.append("tspan")
                          .attr("x", x)
                          .attr("y", y)
                          .attr("dy", ++lineNumber * lineHeight + dy + "em")
                          .text(word);
          }
      }
  });
}

/* CONSTANTS - START */

// tooltips
const hue_tooltip_node = 30
const hue_tooltip_link = 128
const opacity_tooltip_node = 0.9
const opacity_tooltip_link = 0.9
const margin_tooltip_multiplier = 10
const offset_x_tooltip = 5
const offset_y_tooltip = 5

// circles 
const exp_radius_circle = 1.4
const const_radius_circle = 5
const stroke_width_highlight_hover_circle = 3
const hue_highlight_hover_circle = 70
const opacity_highlight_hover_circle = 0.9

// sidebar
const leading_sidebar = 13

// links
const max_link_weight = 25
const range_hue_link = 125
const min_hue_link = 75
const mult_link_weight_stroke_width = 1
const const_link_weight_stroke_width = 0

// simulation
const padding_collision_simulation = 5
const exp_repulsion_simulation = 2
const mult_repulsion_simulation = 1/10000
const exp_attraction_simulation = 1.03
const mult_attraction_simulation = 1/15

// zooms + views
const mult_zoom_radius_view = 2
const duration_transition_zoom = 1500
const duration_stroke_transition_zoom = 1250
const brighten_expansion = 7

// artist lists
const num_listed_artists = 8

/* CONSTANTS - END */

var chartDiv = document.getElementById("chart");
var width = chartDiv.clientWidth;
var height = chartDiv.clientHeight;
let svg = d3.select("div#chart").append('svg').attr("width", width).attr("height", height)


let view = [width/2, height/2, height] // change the third one 

let view_root = view

var tip_node = d3Tip().attr('class', 'd3-tip').html(function(d) {return d.html})
.style('background', d3.rgb(hue_tooltip_node,hue_tooltip_node,hue_tooltip_node,opacity_tooltip_node));
// var tip_link = d3Tip().attr('class', 'd3-tip').html(function(d) { return d.source.genre + ' - ' + d.target.genre + ' strength: ' + d.weight; })
// .style('background', d3.rgb(hue_tooltip_link,hue_tooltip_link,hue_tooltip_link,opacity_tooltip_link));
svg.call(tip_node)
// svg.call(tip_link)
svg.append('rect').attr('id', 'tipfollowscursor')   /* .attr('r',5) /*  to debug */

let focused = svg.node()
let expanded = null
let sim_end = false
let expanding = false
let audio = null
let artists_visible = false
let all_artists_top_tracks = null
let song_locked = false
let current_artist = null
let current_track = null
let current_link = null
let sim = null

let circles = null
let links = null
let labels = null
let artist_names = null
let sidebar = null
let sidebar_selected = null
let unlocked = null
let locked = null
let current_track_text = null
let current_artist_text = null
let current_track_link = null
let current_track_link_text = null
let nodes = null

let results = null

let links_group = svg.append("g").attr("id", "links")
let circles_group = svg.append("g").attr("id", "circles")
let labels_group = svg.append("g").attr("id", "labels")
let artist_names_group = svg.append("g").attr("id", "artist_names").style("cursor", "pointer")
let lock_group = svg.append("g").attr("id", "lock")

let now_playing_group = svg.append("g").attr("id", "now_playing")
let mask = now_playing_group.append('mask').attr("id", "maskurl")
let test_masked = now_playing_group.append("g").style("mask", "url(#maskurl)")
var now_playing = mask.append("text").style("font-weight", 400).style("fill", "white")
let rect_bg = test_masked.append("rect").style("fill", "333").style("fill-opacity", 0.5)
let rect_moving = test_masked.append("rect").style("fill", "000").style("fill-opacity", 0.5)


window.addEventListener("resize", draw)
window.addEventListener('keydown', function (e) {
  if (e.key === "Escape") {
    if (expanded) {
      expandZoom(expanded)
    }
    else {
      zoom(true, svg.node())
    }
  }
  
});
function draw() {
  chartDiv = document.getElementById("chart");
  width = chartDiv.clientWidth;
  height = chartDiv.clientHeight;
  svg.attr("width", width).attr("height", height)
  view_root = [width/2, height/2, height]
  sim.force('center', d3.forceCenter(width/2, height/2)).restart()

  // if (expanded) {
  //   expand(circles.filter((data) => data === expanded), expanded)
  // }
  if (!expanded) {
    zoom(true,svg.node(), true)
  }
  
  unlocked.attr("y", height-200)
  .attr("x", width-200)
  locked.attr("y", height-200)
  .attr("x", width-200)

  current_track_text.attr("y", height-150).attr("x", width-225)
  current_artist_text.attr("y", height-100).attr("x", width-225)
  current_track_link_text.attr("y", height-60).attr("x", width-225)
}

function sidebarSelectorClick(event) {
  if (event === "genres" || event === "artists") {
    sidebar_selected = event
  } else {
    node = event.target
    sidebar_selected = node.innerHTML
  }
  $("#sidebar").empty()
  if (sidebar_selected === "artists") {
    entries = Object.entries(results.artists)
    $("#sidebar").append(entries.map((current, i) => "<p class=\"sidebar\" style=\"cursor:default;opacity:0;font-size:" +(0.1+(current[1].popularity/10)**1.1/5)+"rem\">" + current[0] + "</p>", ""))
    $("#sidebar-artist").addClass("sidebar-options-selected")
    $("#sidebar-genre").removeClass("sidebar-options-selected")
  } else {
    $("#sidebar").append(nodes.map((current, i) => "<p class=\"sidebar\" style=\"cursor:pointer;opacity:0;font-size:" +(0.90+(current.radius/50)**1.1)+"rem\">" + current.genre + "</p>", ""))
    $("#sidebar-artist").removeClass("sidebar-options-selected")
    $("#sidebar-genre").addClass("sidebar-options-selected")
  }
  
  sidebar = d3.selectAll("p.sidebar")
  sidebar.transition().delay((_,i)=>20*i).duration(500).style("opacity", 1)
  $("#sidebar p").click(sidebarClick).mouseover(sidebarMouseover).mouseout(sidebarMouseout)

}


function sidebarClick() {
  if (sidebar_selected === "genres") {
    node = event.target
    console.log(node)
    var id = [].indexOf.call(node.parentNode.children, node)
    if (sim_end) {
      selected = circles.filter((_, i) => i === id)
      selected.transition().duration(duration_stroke_transition_zoom).style("stroke-width",0);
      zoom(false, selected.data()[0]);
      tip_node.direction(dir).hide(selected.data()[0]);
    }
  }

}

function sidebarMouseover() {
  node = event.target
  node.classList.add("hover")

  if (sidebar_selected === "genres") {

    var id = [].indexOf.call(node.parentNode.children, node)
    selected = circles.filter((_, i) => i === id).style("stroke-width",3).style("stroke", d3.rgb(80,80,80,0.9))
    if (focused === svg.node()) {
      
      x = selected.attr("cx")
      y = selected.attr("cy")
      
      let offset_x, offset_y, dir
      [dir, offset_x, offset_y] = chooseDirection(x, y) 
      
      var target = d3.select('#tipfollowscursor')
      .attr('x', x - offset_x)
      .attr('y', y - offset_y) // 5 pixels above the cursor
      .node();
      
      tip_node.direction(dir).show(selected.data()[0], target);
    }
  } else {
    curr_artist = node.innerText
    curr_artist_genres = results.artists[curr_artist].genres
    selected = circles.filter((d) => curr_artist_genres.includes(d.genre)).style("stroke-width",3).style("stroke", d3.rgb(80,80,80,0.9))
    selected_links = links.filter(d => !d.source.artists.includes(curr_artist) || !d.target.artists.includes(curr_artist))
      .style("stroke-dasharray", "4 4").style("stroke", d3.rgb(225,225,225,0.9))
    console.log(selected_links)
  }
  // console.log(node.innerHtml)
}

function sidebarMouseout() {
  node=event.target
  node.classList.remove("hover")
  if (sidebar_selected === "genres") {

    var id = [].indexOf.call(node.parentNode.children, node)
    selected = circles.filter((_, i) => i === id).style("stroke-width",0)
    if (focused === svg.node()) {
      tip_node.hide(selected.data()[0]);
    }
  } else {
    curr_artist = node.innerText
    curr_artist_genres = results.artists[curr_artist].genres
    selected = circles.filter((d) => curr_artist_genres.includes(d.genre)).style("stroke-width",0)
    selected_links = links.filter(d => !d.source.artists.includes(curr_artist) || !d.target.artists.includes(curr_artist))
      .style("stroke-dasharray", null).style("stroke", d => {
        var amt = (max_link_weight - d.weight)/max_link_weight * range_hue_link + min_hue_link;
        var color = d3.rgb(amt, amt, amt, 1);
        return color
      })
  }
}

function song_lock_toggle() {
  song_locked = !song_locked
  unlocked.style("display", () => song_locked ? "none" : "inline").style("opacity", 0.2).raise()
  locked.style("display", () => song_locked ? "inline" : "none").style("opacity", 0.7).raise()
  update_player()
}

function update_player() {
  if (song_locked) {
    current_track_text.text(current_track)
    current_artist_text.text(current_artist)
    current_track_link.select("text").text("Click to open in Spotify")
    current_track_link.attr("xlink:href", current_link)
  } else {
    current_track_text.text("")
    current_artist_text.text("")
    current_track_link.select("text").text("")
  }
}

function zoomTo(v) {
  view = v
  const [x,y,r] = view
  circles_group.attr("transform",  d => 
  `
  translate(${width / 2}, ${height / 2})
  scale(${height / r})
  translate(${-x}, ${-y})
  `
  )

  links_group.attr("transform", d => 
  `
  translate(${width / 2}, ${height / 2})
  scale(${height / r})
  translate(${-x}, ${-y})
  `
  )

  labels_group.attr("transform", d => 
  `
  translate(${width / 2}, ${height / 2})
  scale(${height / r})
  translate(${-x}, ${-y})
  `)

  artist_names_group.attr("transform", d => 
  `
  translate(${width / 2}, ${height / 2})
  scale(${height / r})
  translate(${-x}, ${-y})
  `)

  now_playing_group.attr("transform", d => 
  `
  translate(${width / 2}, ${height / 2})
  scale(${height / r})
  translate(${-x}, ${-y})
  `)
  
}

function expandZoom(circle) {
  if (!expanding) {
    if (!expanded) {
      expanded = circle
      data = circle.data()[0]
      // console.log(data)
      var next = [data.x, data.y, data.radius*0.01]
      current_fill = d3.rgb(circle.attr("fill"))
      
      circle.transition().delay(duration_transition_zoom*(1/5)).duration(duration_transition_zoom*(4/5))
        .attr("fill", adjust(1/brighten_expansion, current_fill))
        .on('end', () => {
          d3.select("#sidebar-general").style("display", "none")
          artist_names_group.style("display", "none")
          circle.style("stroke-width", 0)

          show_genre_page(circle)
        })

      svg.transition()
        .duration(duration_transition_zoom)
        .tween("zoom", () => {
          const i = d3.interpolateZoom(view, next);

          return t => zoomTo(i(t));
      }).on('start', () => expanding = true).on('end', () => expanding = false);

      sidebar.transition().duration(500).style("opacity", 0)
      
      svg_node = svg.node()
      on_background = focused===svg_node
      on_zoom = focused!==svg_node && expanded === null
      on_expand = expanded 
      console.log(on_zoom)
      console.log(on_expand)
      
      d3.selectAll("div.zoom").transition().delay((on_zoom?1000 : 0)*resize).duration(500*resize)
      .style("opacity", on_zoom ? 1 : 0)
      .on("start", function() { if (on_zoom) {this.style.display = "flex"}})
      .on("end", function() { if (!on_zoom) this.style.display = "none"; });

      // d3.selectAll("div.expand").transition().delay((on_expand?1000 : 0)*resize).duration(500*resize)
      // .style("opacity", on_expand ? 1 : 0)
      // .on("start", function() { if (on_expand) {console.log("hi");this.style.display = "flex"}})
      // .on("end", function() { if (!on_expand) {console.log("bye");this.style.display = "none";}}); 
    } else {
      expanded = null
      d3.select("#genre-page").transition().duration(500).style("row-gap", "1000px").style("opacity", 0).on('end', () => {
        d3.select("#genre-page-container").remove()
        data = circle.data()[0]
        zoomTo([data.x, data.y, data.radius*0.01])
        artist_names_group.selectAll("text")
        .attr("x", data.x).attr("y", (_, i) => data.y+data.radius*0.12*(i-2.5))

        zoom(false, data)
        current_fill = d3.rgb(circle.attr("fill"))
        circle.transition().duration(duration_transition_zoom).attr("fill", adjust(brighten_expansion, current_fill))
        .on('start', () => expanding = true).on('end', () => expanding = false)
        sidebar.transition().duration(500).style("opacity", 1).on('start', () => {
          artist_names_group.style("display", "inline")
          d3.select("#sidebar-general").style("display", "flex")

        })
      })
    }
  }
}


function zoom(isBackground, orig_d, redraw=false) {
  resize = redraw ? 0 : 1
  var next
  focused_0 = focused
  focused = orig_d

  now_playing.style("display", "none")
  // if (artists_visible) {
  //   // transition off
  //   artist_names_group.transition().duration(500)
  //   .style("fill-opacity", 0)
  //   .on("end", function(d) { if (d !== focused) this.style.display = "none"; });
  // }
  if (isBackground) {
    next = view_root
  } else {
    next = [orig_d.x, orig_d.y, orig_d.radius*mult_zoom_radius_view]
    if (focused !== focused_0){
      if (orig_d.artists.length > num_listed_artists) {
        name_data = d3.shuffle(orig_d.artists).slice(0,num_listed_artists).concat(`and ${orig_d.artists.length-num_listed_artists} more...`)
      }
      else {
        name_data = d3.shuffle(orig_d.artists).slice(0,num_listed_artists)
      }
      full_data = name_data.map((value) => {return {name: value, parent:orig_d}})
      artist_names_group.selectAll("text").data(full_data).join("text").text(d => d.name)
      .attr("x", orig_d.x-orig_d.radius*0.75).attr("y", (_, i) => orig_d.y+orig_d.radius*0.12*(i-2.5))
      .attr("font-size", (_, i) => i === num_listed_artists ? orig_d.radius/15 : orig_d.radius/12).attr("font-weight", (_, i) => i === num_listed_artists ? 400 : 700)
      .attr("text-anchor", "end")
      .on("mouseover", function (d, i) {
        if (i < num_listed_artists & (!song_locked)) {
          d3.select(this).style("fill-opacity", 1)
          if (audio) {audio.pause()}
          rand_track = all_artists_top_tracks[d.name][Math.floor(Math.random()*10)]
          audio = new Audio(rand_track.uri)
          audio.addEventListener('ended', function(d) { 
            current_artist = null
            current_track = null
            current_link = null
            if (song_locked) {
              song_lock_toggle(); 
            }
            now_playing.style("display", "none");
          })
          audio.volume = 0.5
          audio.play()

          now_playing.style("font-size", orig_d.radius/15).attr("y", orig_d.y+orig_d.radius*0.12*(i-2.5-0.02))
          .attr("x", orig_d.x+orig_d.radius/50)
          .style("display", "inline").text(rand_track.name)

          var bb = now_playing.node().getBBox()
          rect_bg.attr("x", bb.x).attr("y", bb.y).attr("width", bb.width).attr("height", bb.height)
          rect_moving.attr("x", bb.x).attr("y", bb.y).attr("width", 0).attr("height", bb.height)
          rect_moving.transition().ease(d3.easeLinear).duration(30000).attr("width", bb.width)
          current_artist = d.name
          current_track = rand_track.name
          current_link = rand_track.link

        }
      })
      .on("mouseout", function(_,i) {
      d3.select(this).style("fill", "000")
        if (i < num_listed_artists & (!song_locked)) { 
          audio.pause() 
          rect_moving.transition()
          test_masked.selectAll("rect").attr("width", 0)
          now_playing.style("display", "none")
          artist_names_group.selectAll("text").style("fill-opacity", 0.8)
          current_track = null
          current_artist = null
          current_link = null
        }
      })
      .on("click", function(d, i) { 
        d3.event.stopPropagation();
        if (i < num_listed_artists) {song_lock_toggle(); }
      })
      .style("display", "none")
      .style("fill-opacity", 0)
    }
  }

  svg.transition()
    .duration(duration_transition_zoom*resize)
    .tween("zoom", () => {
      const i = d3.interpolateZoom(view, next);

      return t => zoomTo(i(t));
  });
  svg_node = svg.node()
  on_background = focused===svg_node
  on_zoom = focused!==svg_node && expanded === null
  already_zoom = on_zoom && focused_0!==svg_node
  on_expand = expanded 
  console.log(on_zoom)
  // links.transition().duration(500)
  // .style("stroke-dasharray", (d) => (d.source.index === orig_d.index) || (d.target.index === orig_d.index) ? "1" : "0")
  d3.selectAll("div.background").transition().delay((on_background?1000 : 0)*resize).duration(500*resize)
  .style("opacity", on_background ? 1 : 0)
  .on("start", function() { if (on_background) {this.style.display = "flex"}})
  .on("end", function() { if (!on_background) this.style.display = "none"; });

  if (already_zoom) {
    d3.selectAll("div.zoom").transition().duration(500*resize)
    .style("opacity", 0).on('end', function () {
      d3.selectAll("div.zoom").transition().delay(500*resize).duration(500*resize)
      .style("opacity",1)
    }).on('start', function () {
      d3.selectAll("div.zoom").style("display", "flex")
    })
  } else {
    d3.selectAll("div.zoom").transition().delay((on_zoom?1000 : 0)*resize).duration(500*resize)
    .style("opacity", on_zoom ? 1 : 0)
    .on("start", function() { if (on_zoom) {this.style.display = "flex"}})
    .on("end", function() { if (!on_zoom) this.style.display = "none"; });
  }
  labels_group.selectAll("text").transition().delay(d=>(d===focused ? 1000 : 0)*resize ).duration((500)*resize)
    .style("fill-opacity", d => d === focused ? 1 : 0)
    .on("start", function(d) { if (d === focused) {this.style.display = "block"}})
    .on("end", function(d) { if (d !== focused) this.style.display = "none"; });

  if (focused_0.radius || orig_d.radius) {
    artist_names_group.selectAll("text").transition().delay((d,i)=>(d.parent===focused ? 1250+i*50 : i*50)*resize ).duration((500)*resize)
    .style("fill-opacity", d => d.parent === focused ? 0.8 : 0)
    .attr("x", d => d.parent === focused ? orig_d.x : focused_0.x-focused_0.radius*0.75)
    .on("start", function(d) {if (d.parent === focused) this.style.display = "inline"; })
    .on("end", function(d) { if (d.parent !== focused) this.style.display = "none"; });
  }
  
}

unlocked = lock_group.append("svg:image")
            .attr("xlink:href", "static/unlocked.svg").attr("y", height-200)
            .attr("x", width-200).style("display", "inline").style("opacity", 0.2).on('click', function () {
              d3.event.stopPropagation()
            })
locked = lock_group.append("svg:image")
            .attr("xlink:href", "static/locked.svg").attr("y", height-200)
            .attr("x", width-200).style("display", "none").style("opacity", 0.7)
            .on('mouseover', function() {
              d3.select(this).style("opacity",0)
              unlocked.style("opacity", 0.8).style("display", "inline")
            })
            .on('click', function () {
              d3.event.stopPropagation()
              song_lock_toggle()
            })
            .on('mouseout', function() {
              if (song_locked) {
                d3.select(this).style("opacity",0.7)
                unlocked.style("opacity", 0).style("display", "none")
              }
            })
            
  current_track_text = lock_group.append("text").attr("y", height-150).attr("x", width-225).attr("font-size", 36)
  .attr("text-anchor", "end")
  current_artist_text = lock_group.append("text").attr("y", height-100).attr("x", width-225).attr("font-size", 24)
  .attr("text-anchor", "end")
  current_track_link = lock_group.append("a").attr("target", "_blank").on('click', () => d3.event.stopPropagation())
  current_track_link_text = current_track_link.append("text").attr("y", height-60).attr("x", width-225).attr("font-size", 16).style("fill", "333")
  .attr("text-anchor", "end")
  .on('mouseover', function() {d3.select(this).style("fill","000")})
  .on('mouseout', function() {d3.select(this).style("fill","333")}) 


function chooseDirection(x, y) { 
  row = y/height*margin_tooltip_multiplier
  col = x/width*margin_tooltip_multiplier
  y_offset = 0
  x_offset = 0
  dir = ""
  if (col < 1) {
    x_offset = -offset_x_tooltip
    if (row < 1) {
      dir = "se"
      y_offset = -offset_y_tooltip
    }
    else if (row > margin_tooltip_multiplier) {
      dir = "ne"
      y_offset = offset_y_tooltip
    }
    else {
      dir = "e"
    }
  }
  else if (col > margin_tooltip_multiplier) {
    x_offset = offset_x_tooltip
    if (row < 1) {
      dir = "sw"
      y_offset = -offset_y_tooltip
    }
    else if (row > margin_tooltip_multiplier) {
      dir = "nw"
      y_offset = offset_y_tooltip
    }
    else {
      dir = "w"
    }
  } else {
    if (row < 1) {
      dir = "s"
      y_offset = -offset_y_tooltip
    }
    else  {
      dir = "n"
      y_offset = offset_y_tooltip
    }
  }
  return [dir, x_offset, y_offset]
}

function show_genre_page(circle) {

  data = circle.data()[0]

  neighbor_links_string = results.links.filter(d => d.source.index === data.index || d.target.index === data.index)
    .sort((a,b) => b.weight-a.weight).slice(0,4).map((d)=>d.source.index === data.index ? d.target.genre : d.source.genre)
    .join(", ")

  

  current_fill = d3.rgb(circle.attr("fill"))
  accent = adjust(brighten_expansion, current_fill)

  stylesheet = document.styleSheets[0]
  
  stylesheet.insertRule(`.accent { font-weight:700; color:${accent}}`,stylesheet.cssRules.length)
  stylesheet.insertRule(`.background-light {background-color:${current_fill}}`,stylesheet.cssRules.length)
  stylesheet.insertRule(`.background-accent {background-color:${accent}}`,stylesheet.cssRules.length)

  var template = document.getElementById("listen-template").innerHTML
  compiled = Handlebars.compile(template)
  context = data

  artists_by_artists = data.artists.length/results.nodes.length
  artists_by_genre = data.artists.length/results.all_genres[data.genre]

  // TODO: change this to use helpers instead for anything that touches results
  new_data = {...context, 
    time_terms:["long_term", "medium_term", "short_term"],
    index:data.index+1,
    personal_genre_count:results.nodes.length,
    neighbor_links_string,
    global_artist_genre_count:results.all_genres[data.genre],
    artists_by_artists:(artists_by_artists*100).toFixed(1),
    artists_by_genre:(artists_by_genre*100).toFixed(1),
    global_genre_count:Object.keys(results.all_genres).length}

  console.log(new_data)
  var html = compiled(new_data)
  $("body").append(html)

  d3.select("#genre-page").transition().duration(500).style("row-gap", "30px").style("opacity", 1)
  

  $(".spotify-toggle").on('click', function () {
    $(".spotify-toggle").removeClass("accent")
    this.classList.add("accent")
  })
  $("a:contains('sound')")[0].click()

  
  svg_node = svg.node()
  on_background = focused===svg_node
  on_zoom = focused!==svg_node && expanded === null
  on_expand = expanded 
  console.log(on_zoom)
  console.log(on_expand)
  d3.selectAll("div.expand").transition().duration(500)
  .style("opacity", on_expand ? 1 : 0)
  .on("start", function() { if (on_expand) {console.log("hi");this.style.display = "flex"}})
  .on("end", function() { if (!on_expand) {console.log("bye");this.style.display = "none";}}); 

}

function hide_genre_page(circle) {
  // console.log("hidden")
}

d3.json("/top_genres", {method:"POST"}).then( r => {

  results = r
  console.log(Object.keys(results.artists))
  
  d3.json("/all_artists_top_tracks", {method:"POST"}).then( function(d) {
    all_artists_top_tracks = d
  })

  nodes = results.nodes.map(d => {
    
    html = `<h1>${d.genre}</h1>
    <span style="display:block"><span class="grey"># of artists:</span><b> ${d.artists.length}</b></span>
    <h3>centralities</h3>

    `
    for (var key in d.centrality) {
      html += `<span style="display:block"><span class="grey">${key}: </span><b>${d.centrality[key]}${nth(d.centrality[key])}</b>  </span>`
    }

    return {
      genre: d.genre, artists: d.artists, radius: d.artists.length**exp_radius_circle+const_radius_circle,
      centrality: d.centrality,
      html,
      playlists:d.playlists,
      popularity:d.popularity,
    }
  })

   
  svg.on("click", function () {d3.event.stopPropagation(); zoom(true, d3.event.target)})
   
  links = links_group
  .selectAll("line")
  .data(results.links)
  .enter()
  .append("line")
  .style("stroke", d => {
    var amt = (max_link_weight - d.weight)/max_link_weight * range_hue_link + min_hue_link;
    var color = d3.rgb(amt, amt, amt, 1);
    return color
  })
  .style("stroke-width", d=> {
    return d.weight*mult_link_weight_stroke_width + const_link_weight_stroke_width
  })
  // .on('mousemove', function (d) {
  //   [dir, x, y] = chooseDirection(d3.event.clientX, d3.event.clientY) 
  //   s = d.source.index
  //   t = d.target.index
  //   circles.filter(data => data.index === s || data.index === t).style("stroke-width",3).style("stroke", d3.rgb(80,80,80,0.9))

  //   var target = d3.select('#tipfollowscursor')
  //   .attr('x', d3.event.offsetX - x)
  //   .attr('y', d3.event.offsetY - y) // 5 pixels above the cursor
  //   .node();
  //   tip_link.direction(dir).show(d, target);
  // })
  // .on('mouseout', function (d) {
  //   s = d.source.index
  //   t = d.target.index
  //   circles.filter(data => data.index === s || data.index === t).style("stroke-width",0);

  //   tip_link.hide()
  // })
  .on('click', function (d) {
    d3.event.stopPropagation()
  })
  // .style("opacity", 0)
  // .call(node => node.transition().delay(1000).duration(500).style("opacity", 1))

  circles = circles_group.selectAll("circle").data(nodes)
    .enter().append("circle")
    .attr("index", data => data.index)
    .attr("r", data => data.radius)
    .attr("fill", function color(_, i) {
      
      radius = Math.random()*50+50
      if (i < 12) {
        angle = (Math.random()+i)*Math.PI/6 
      } else {
        angle = Math.random()*2*Math.PI  
      }
      
      return d3.lab(Math.random()*5+75, Math.cos(angle)*radius, Math.sin(angle)*radius)

      if (i < 6) {
        return d3.hsl(Math.max(Math.min(Math.random()*60+60*i-30, 360),0), Math.random()*0.3+0.7, Math.random()*0.1+0.6)
      }
      return d3.hsl(Math.random()*360, Math.random()*0.3+0.7, Math.random()*0.1+0.6)
    })
    .on('click', function (d) {
      d3.event.stopPropagation(); 
      tip_node.hide(d)
      if (d3.event.defaultPrevented) return; // dragged
      if (sim_end) {
        if (focused !== d) {
          d3.select(this).transition().duration(duration_stroke_transition_zoom).style("stroke-width",0);
          zoom(false, d);
        }
        else {
          expandZoom(d3.select(this))
          // expand(d3.select(this), d)
        }
      }
    })  
    .on('mousemove', function (d) {
      if (focused !== d ) {
        [dir, x, y] = chooseDirection(d3.event.clientX, d3.event.clientY) 

        var target = d3.select('#tipfollowscursor')
            .attr('x', d3.event.clientX - x)
            .attr('y', d3.event.clientY - y) // 5 pixels above the cursor
            .node();
        tip_node.direction(dir).show(d, target);
        d3.select(this).style("stroke-width",stroke_width_highlight_hover_circle).style("stroke", 
        d3.rgb(hue_highlight_hover_circle,hue_highlight_hover_circle,hue_highlight_hover_circle,opacity_highlight_hover_circle))
      }
  })
  .on('mouseout', function (d) {
    if (focused !== d ) {
      d3.select(this).style("stroke-width",0);
      tip_node.hide(d)
    }
  }).call(d3.drag()
  .on("start", dragstarted)
  .on("drag", dragged)
  .on("end", dragended))
  // .style("fill-opacity", 0)
  // .call(node => node.transition().duration(1000).style("fill-opacity", 1))
  // // console.log(circles)


  labels = labels_group.selectAll("text").data(nodes).enter().append("text").text(d => d.genre).attr("text-anchor", "middle")
  .attr("class", "label").style("display", "none").style("fill-opacity", 0).style("font-size", d => d.radius/10).style("font-weight", 900)
  .on("click", function(d) {
    d3.event.stopPropagation();
  })

  // let now_playing_group = svg.append("g")
  // var now_playing = now_playing_group.append("text").style("display", "none").style("font-weight", 400)

  // let sidebar_labels_group = svg.append("g")
  // var sidebar_labels = sidebar_labels_group.selectAll("text").data(nodes).enter().append("text").text(d => d.genre).attr("y", function (d,i) {return (i+1)*leading_sidebar})
  // .on("click", function(d) {
  //   d3.event.stopPropagation();
  //   if (sim_end) {
  //     circle = circles.filter(data => data.genre === d.genre)
  
  //     circle.transition().duration(duration_stroke_transition_zoom).style("stroke-width",0);
  //     zoom(false, circle.data()[0]);
  //   }
  // })
  // .on("mouseover", function (d) {
  //   d3.select(this).attr("font-weight", "bold").text(d => `${d.genre}: ${d.artists.length}` )
  //   circles.filter(data => data.genre === d.genre).style("stroke-width",3).style("stroke", d3.rgb(80,80,80,0.9))
  // })
  // .on("mouseout", function(d) {
  //   d3.select(this).attr("font-weight", null).text(d => d.genre)
  //   circles.filter(data => data.genre === d.genre).style("stroke-width",0)
  // })
  // .style("display", "none")



  $(".sidebar-options").click(sidebarSelectorClick)
  sidebarSelectorClick("genres")
  
  
  

  sim = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().distanceMax(height/3).strength(function (d) {
      return -150
    }))
    .force('center', d3.forceCenter(width/2, height/2))
    .force('x', d3.forceX(width/2).strength(0.015))
    .force('y', d3.forceY(height/2).strength(0.02))
    .force('collision', d3.forceCollide().radius(function(d) {
      return d.radius + padding_collision_simulation
    }))
    .force("links", d3.forceLink()                               
            .id(function(d) { return d.genre; })                   
            .links(results.links)
            // .strength(d => -(d.weight**exp_repulsion_simulation)*mult_repulsion_simulation/5)
            .strength(d => d.weight**exp_attraction_simulation*mult_attraction_simulation)
      )
    .on('tick', ticked)
    .on('end', function () {
      sim_end = true
      labels.attr("x", d => d.x).attr("y", d => d.y-d.radius*0.5)
    })

    

  
   

// console.log(svg.selectAll('circle'))
  function ticked() {
    
    // console.log("hi")
    svg.selectAll('circle')
    .data(nodes).attr('cx', function(d) {
      return d.x
    }).attr('cy', function(d) {
      return d.y
    })

    links
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

  }


  function dragstarted(d) {
    tip_node.hide(d)
    if (focused === svg.node()) {
      d.fx = d.x;
      d.fy = d.y;
    }
  }
  
  function dragged(d) {
    if (focused === svg.node()){
      sim.alphaTarget(0.08).restart();
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }
  }
  
  function dragended(d) {
    if (focused === svg.node()){
      if (!d3.event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }



  
})
function expand(current, d) {
    
  if (!expanding) {
    if (expanded !== d) {
      expanded = d 
      current.raise()
      current_fill = d3.rgb(current.attr("fill"))
      current.transition().duration(1000).attr('r', (width**2+height**2)**(1/2)*d.radius*2/2*mult_zoom_radius_view/height)
      .attr("fill", adjust(1/brighten_expansion, current_fill)).on('start', () => expanding = true).on('end', () => expanding = false)
    } else {
      current_fill = d3.rgb(current.attr("fill"))
      // artist_names_group.raise()
      // now_playing_group.raise()
      current.transition().duration(750).attr('r', d => d.radius)
      .attr("fill", adjust(brighten_expansion, current_fill)).on('end', () => {expanding = false; 
        circles.order() })
      expanded = null
    }
  }
}
function adjust(k, color) {

  // console.log(color)
  let new_c = d3.rgb(
    r= (255-(255-color.r)*k),
    g= (255-(255-color.g)*k),
    b= (255-(255-color.b)*k),
  );
  // let new_c = d3.rgb(
  //   r= color.r*k,
  //   g= color.g*k,
  //   b= color.b*k,
  // );
  // console.log(new_c)
  return new_c
}

const nth = function(d) {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
}

Handlebars.registerHelper("nth", nth);

Handlebars.registerHelper("join-artists", function(genre, artist) {
  return [...results.artists[artist].genres.filter(g=>g!==genre), `(${genre})`].join( ", ")
});

Handlebars.registerHelper("url", function(artist) {
  return results.artists[artist].image
})

Handlebars.registerHelper("make-bars", function (artist) {
  filled = Math.round(results.artists[artist].popularity/10)
  acc = ""
  for (var index = 0; index < 10; index ++) {
    if (index < filled) {
      acc+= `<div class="bar background-accent"></div>`
    } else {
      acc+= `<div class="bar bar-unfilled"></div>`
    }
  }
  return acc
})

Handlebars.registerHelper("time-terms", function (artist) {
  divs = []
  for (var term of ["short_term", "medium_term", "long_term"]) {
    if (results.artists[artist].time_range.includes(term)) {
      divs.push(`<div class='artist-time-term-exist accent'>&#10004; ${timeWords(term)}</div>`)
    } else {
      divs.push(`<div class='artist-time-term-no-exist'>&#10008; ${timeWords(term)}</div>`)
    }
  }
  return divs.join("")
})


function timeWords (time) {
  switch (time) {
    case "long_term":
      return "more than 1 year"
    case "medium_term":
      return "within 6 months"
    case "short_term":
      return "within 1 month"
    default:
      return "whomst"
  }  
}
// nodes.then(nodes => 
//   svg.selectAll("circle").data(nodes.data)
//   .enter().append("circle")
//   .attr("r", data => data.artists.length+1)
//   .attr("fill", "#235689")
//   .attr("cx", (_, index) => index * 60+ 100)
//   .attr("cy", 500).transition().duration(2500).attr('cy', (_, index) => index*60 + 100).attr('cx', (_, index) => width/20)
// )



// var circles = nodes.then(nodes => 
//   svg.selectAll("circle").data(nodes.data)
//   .enter().append("circle")
//   .attr("r", data => data.artists.length+1)
//   .attr("fill", "#235689")
//   .attr("cx", (_, index) => index * 60+ 100)
//   .attr("cy", 500)
// )

// console.log(circles)

// circles.then(nodes => 
//   d3.forceSimulation(nodes)
//     .force('charge', d3.forceManyBody().strength(5))
//     .force('center', d3.forceCenter(width / 2, height / 2))
//     .force('collision', d3.forceCollide().radius(function(d) {
//       return d.radius
//     }))
// )


// //   var simulation = d3.forceSimulation()
//   // var simulation = d3.forceSimulation()
// // fetch("/top_genres", {"method": "POST"})
// //   .then(response => response.json())
// //   .then(json => d3.select("body")
// //     .selectAll("p")
// //     .data(json.data)
// //     .enter().append("p")
// //       .text(function(d) { return d["genre"] + ": " + d["artists"] ;}));




// // fetch("/top_artists", {"method": "POST"})
// //   .then(response => response.json())
// //   .then(json => d3.select("body")
// //     .selectAll("p")
// //     .data(json.items)
// //     .enter().append("p")
// //       .text(function(d) { return d["name"] + ": " + d["genres"] ;}));

// // d3.selectAll("circle").transition()
// //   .duration(750)
// //   .delay(function(d, i) { return i * 10; })
// //   .attr("r", function(d) { return Math.sqrt(d * scale); });

// // d3.select("body")
// //   .selectAll("p")
// //   .data([4, 8, 15, 16, 23, 42])
// //   .enter().append("p")
// //     .text(function(d) { return "I’m number " + d + "!"; });

// // d3.select("body")
// //   .selectAll("p")
// //   .data([data["items"]])
// //   .enter().append("p")
// //   .text(function (d) { return d["name"];});