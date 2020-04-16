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
const range_hue_link = 100
const min_hue_link = 75
const mult_link_weight_stroke_width = 1
const const_link_weight_stroke_width = 0

// simulation
const padding_collision_simulation = 5
const exp_repulsion_simulation = 2
const mult_repulsion_simulation = 1/10000
const exp_attraction_simulation = 1.03
const mult_attraction_simulation = 1/10

// zooms + views
const mult_zoom_radius_view = 2
const duration_transition_zoom = 1500
const duration_stroke_transition_zoom = 1250
const brighten_expansion = 5 

// artist lists
const num_listed_artists = 8

/* CONSTANTS - END */

var chartDiv = document.getElementById("chart");
var width = chartDiv.clientWidth;
var height = chartDiv.clientHeight;
let svg = d3.select("div#chart").append('svg').attr("width", width).attr("height", height)


let view = [width/2, height/2, height] // change the third one 

const view_root = view

var tip_node = d3Tip().attr('class', 'd3-tip').html(function(d) { return d.genre + ': ' + d.artists.length})
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

let circles = null
let links = null
let labels = null
let artist_names = null
let unlocked = null
let locked = null
let current_track_text = null
let current_artist_text = null
let current_track_link = null
let current_track_link_text = null

let links_group = svg.append("g")
let circles_group = svg.append("g")
let labels_group = svg.append("g")
let artist_names_group = svg.append("g")
let lock_group = svg.append("g")

let now_playing_group = svg.append("g")
let mask = now_playing_group.append('mask').attr("id", "maskurl")
let test_masked = now_playing_group.append("g").style("mask", "url(#maskurl)")
var now_playing = mask.append("text").style("font-weight", 400).style("fill", "white")
let rect_bg = test_masked.append("rect").style("fill", "333").style("fill-opacity", 0.5)
let rect_moving = test_masked.append("rect").style("fill", "000").style("fill-opacity", 0.5)


window.addEventListener("resize", draw);
function draw() {
  chartDiv = document.getElementById("chart");
  width = chartDiv.clientWidth;
  height = chartDiv.clientHeight;
  svg.attr("width", width).attr("height", height)

  if (expanded) {
    expand(circles.filter((data) => data === expanded), expanded)
  }
  zoom(true,svg, true)

  unlocked.attr("y", height-200)
  .attr("x", width-200)
  locked.attr("y", height-200)
  .attr("x", width-200)

  current_track_text.attr("y", height-150).attr("x", width-225)
  current_artist_text.attr("y", height-100).attr("x", width-225)
  current_track_link_text.attr("y", height-60).attr("x", width-225)
}

function sidebarClick() {
  node = event.target
  // console.log(node)
  var id = [].indexOf.call(node.parentNode.children, node)
  if (sim_end) {
    circle = circles.filter((_, i) => i === id)

    circle.transition().duration(duration_stroke_transition_zoom).style("stroke-width",0);
    zoom(false, circle.data()[0]);
  }

}

function sidebarMouseover() {
  node = event.target
  node.classList.add("hover")

  var id = [].indexOf.call(node.parentNode.children, node)
  selected = circles.filter((_, i) => i === id).style("stroke-width",3).style("stroke", d3.rgb(80,80,80,0.9))
  node.innerHTML+= ":<i style=\"font-weight:normal\"> " + selected.data()[0].artists.length + "</i>"
  // console.log(node.innerHtml)
}

function sidebarMouseout() {
  node=event.target
  node.classList.remove("hover")

  var id = [].indexOf.call(node.parentNode.children, node)
  circles.filter((_, i) => i === id).style("stroke-width",0)
  node.innerHTML = node.innerHTML.split(":")[0]
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
    // console.log(orig_d)
   
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
          audio.volume = 0.2
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




        //   d3.json('/artist_top_tracks', {
        //     method: "POST", 
        //     headers: {'Content-Type': 'application/json'}, 
        //     body:JSON.stringify({artist:d.name})}
        //   ).then(results => {
        //   if (audio) {audio.pause()}
        //   now_playing.style("font-size", orig_d.radius/15).attr("y", orig_d.y+orig_d.radius*0.12*(i-2.5-0.02))
        //   .attr("x", orig_d.x+orig_d.radius/50)
        //   .style("display", "inline").text(results.name)
        //   var bb = now_playing.node().getBBox()
        //   rect_bg.attr("x", bb.x).attr("y", bb.y).attr("width", bb.width).attr("height", bb.height)
        //   rect_moving.attr("x", bb.x).attr("y", bb.y).attr("width", 0).attr("height", bb.height)
        //   rect_moving.transition().ease(d3.easeLinear).duration(30000).attr("width", bb.width)
        //   audio = new Audio(results.uri)
        //   audio.volume = 0.1
        //   audio.play()
        // })
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
  
  // links.transition().duration(500)
  // .style("stroke-dasharray", (d) => (d.source.index === orig_d.index) || (d.target.index === orig_d.index) ? "1" : "0")

  labels_group.selectAll("text").transition().delay(d=>(d===focused ? 1000 : 0)*resize ).duration(d => (d === focused ? 500 : 500)*resize)
    .style("fill-opacity", d => d === focused ? 1 : 0)
    .on("start", function(d) { if (d === focused) {this.style.display = "block"}})
    .on("end", function(d) { if (d !== focused) this.style.display = "none"; });

  if (focused_0.radius || orig_d.radius) {
    artist_names_group.selectAll("text").transition().delay((d,i)=>(d.parent===focused ? 1250+i*50 : i*50)*resize ).duration(d => (d.parent === focused ? 500 : 500)*resize)
    .style("fill-opacity", d => d.parent === focused ? 0.8 : 0)
    .attr("x", d => d.parent === focused ? orig_d.x : focused_0.x-focused_0.radius*0.75)
    .on("start", function(d) {if (d.parent === focused) this.style.display = "inline"; })
    .on("end", function(d) { if (d.parent !== focused) this.style.display = "none"; });
  }
  
}

unlocked = lock_group.append("svg:image")
            .attr("xlink:href", "static/unlocked.svg").attr("y", height-200)
            .attr("x", width-200).style("display", "inline").style("opacity", 0.2)
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

var results = d3.json("/top_genres", {method:"POST"}).then( results => {
  
  d3.json("/all_artists_top_tracks", {method:"POST"}).then( function(d) {
    all_artists_top_tracks = d
  })

  var nodes = results.nodes.map(d => {
    return {
      genre: d.genre, artists: d.artists, radius: d.artists.length**exp_radius_circle+const_radius_circle
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
      if (i < 6) {
        return d3.hsl(Math.max(Math.min(Math.random()*60+60*i-30, 360),0), Math.random()*0.3+0.7, Math.random()*0.1+0.6)
      }
      return d3.hsl(Math.random()*360, Math.random()*0.3+0.7, Math.random()*0.1+0.6)
    })
    .on('click', function (d) {
      d3.event.stopPropagation(); 
      if (d3.event.defaultPrevented) return; // dragged
      if (sim_end) {
        if (focused !== d) {
          d3.select(this).transition().duration(duration_stroke_transition_zoom).style("stroke-width",0);
          tip_node.hide(d)
          zoom(false, d);
        }
        else {
          expand(d3.select(this), d)
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


  
  $("#sidebar").append(nodes.map((current, i) => "<p style=\"font-size:" +(0.90+(current.radius/50)**1.1)+"rem\">" + current.genre + "</p>", ""))

  $("p").click(sidebarClick).mouseover(sidebarMouseover).mouseout(sidebarMouseout)
  


  var sim = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().distanceMax(110).strength(function (d) {
      return -30
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
            // .strength(d => -(d.weight**exp_repulsion_simulation)*mult_repulsion_simulation)
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
    if (focused === svg.node()) {
      d.fx = d.x;
      d.fy = d.y;
    }
  }
  
  function dragged(d) {
    if (focused === svg.node()){
      sim.alphaTarget(0.3).restart();
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
      labels_group.raise()
      current_fill = d3.rgb(current.attr("fill"))
      current.transition().duration(1000).attr('r', (width**2+height**2)**(1/2)*d.radius*2/2*mult_zoom_radius_view/height)
      .attr("fill", adjust(brighten_expansion, current_fill)).on('start', () => expanding = true).on('end', () => expanding = false)
    } else {
      current_fill = d3.rgb(current.attr("fill"))
      artist_names_group.raise()
      now_playing_group.raise()
      current.transition().duration(750).attr('r', d => d.radius)
      .attr("fill", adjust(1/brighten_expansion, current_fill)).on('end', () => {expanding = false; 
        circles.order() })
      expanded = null
    }
  }
}
function adjust(k, color) {
  let new_c = d3.rgb(
    r= (255-(255-color.r)/k),
    g= (255-(255-color.g)/k),
    b= (255-(255-color.b)/k),
  );
  return new_c
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