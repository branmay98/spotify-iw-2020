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
const exp_attraction_simulation = 1.04
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
let svg = d3.select("div").append('svg').attr("width", width).attr("height", height)


let view = [width/2, height/2, height] // change the third one 

const view_root = view

var tip_node = d3Tip().attr('class', 'd3-tip').html(function(d) { return d.genre + ': ' + d.artists.length})
.style('background', d3.rgb(hue_tooltip_node,hue_tooltip_node,hue_tooltip_node,opacity_tooltip_node));
var tip_link = d3Tip().attr('class', 'd3-tip').html(function(d) { return d.source.genre + ' - ' + d.target.genre + ' strength: ' + d.weight; })
.style('background', d3.rgb(hue_tooltip_link,hue_tooltip_link,hue_tooltip_link,opacity_tooltip_link));
svg.call(tip_node)
svg.call(tip_link)
svg.append('rect').attr('id', 'tipfollowscursor')   /* .attr('r',5) /*  to debug */

let focused = svg
let expanded = null
let sim_end = false
let expanding = false
let audio = null
let artists_visible = false


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
  var nodes = results.nodes.map(d => {
    return {
      genre: d.genre, artists: d.artists, radius: d.artists.length**exp_radius_circle+const_radius_circle
    }
  })
   


  svg.on("click", function () {zoom(true, this)})
  
   
  var links = svg
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
  .on('mousemove', function (d) {
    [dir, x, y] = chooseDirection(d3.event.clientX, d3.event.clientY) 
    s = d.source.index
    t = d.target.index
    circles.filter(data => data.index === s || data.index === t).style("stroke-width",3).style("stroke", d3.rgb(80,80,80,0.9))

    var target = d3.select('#tipfollowscursor')
    .attr('x', d3.event.offsetX - x)
    .attr('y', d3.event.offsetY - y) // 5 pixels above the cursor
    .node();
    tip_link.direction(dir).show(d, target);
  })
  .on('mouseout', function (d) {
    s = d.source.index
    t = d.target.index
    circles.filter(data => data.index === s || data.index === t).style("stroke-width",0);

    tip_link.hide()
  })
  .on('click', function (d) {
    d3.event.stopPropagation()
  })

  var circles = svg.selectAll("circle").data(nodes)
    .enter().append("circle")
    .attr("index", data => data.index)
    .attr("r", data => data.radius)
    .attr("fill", function color() {
      return d3.hsl(Math.random()*360, Math.random()*0.3+0.7, Math.random()*0.1+0.6)
    })
    .on('click', function (d) {
      d3.event.stopPropagation(); 
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
    })
  // // console.log(circles)

  let labels_group = svg.append("g")
  var labels = labels_group.selectAll("text").data(nodes).enter().append("text").text(d => d.genre).attr("text-anchor", "middle")
  .attr("class", "label").style("display", "none").style("fill-opacity", 0).style("font-size", d => d.radius/10).style("font-weight", 900)
  .on("click", function(d) {
    d3.event.stopPropagation();
  })

  let artist_names_group = svg.append("g")

  let now_playing_group = svg.append("g")
  let mask = now_playing_group.append('mask').attr("id", "maskurl")
  let test_masked = now_playing_group.append("g").style("mask", "url(#maskurl)")
  var now_playing = mask.append("text").style("font-weight", 400).style("fill", "white")
  let rect_bg = test_masked.append("rect").style("fill", "444")
  let rect_moving = test_masked.append("rect").style("fill", "000")

  // let now_playing_group = svg.append("g")
  // var now_playing = now_playing_group.append("text").style("display", "none").style("font-weight", 400)

  let sidebar_labels_group = svg.append("g")
  var sidebar_labels = sidebar_labels_group.selectAll("text").data(nodes).enter().append("text").text(d => d.genre).attr("y", function (d,i) {return (i+1)*leading_sidebar})
  .on("click", function(d) {
    d3.event.stopPropagation();
    if (sim_end) {
      circle = circles.filter(data => data.genre === d.genre)
  
      circle.transition().duration(duration_stroke_transition_zoom).style("stroke-width",0);
      zoom(false, circle.data()[0]);
    }
  })
  .on("mouseover", function (d) {
    d3.select(this).attr("font-weight", "bold").text(d => `${d.genre}: ${d.artists.length}` )
    circles.filter(data => data.genre === d.genre).style("stroke-width",3).style("stroke", d3.rgb(80,80,80,0.9))
  })
  .on("mouseout", function(d) {
    d3.select(this).attr("font-weight", null).text(d => d.genre)
    circles.filter(data => data.genre === d.genre).style("stroke-width",0)
  })

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

  function zoomTo(v) {
    view = v
    const [x,y,r] = view
    circles.attr("transform",  d => 
    `
    translate(${width / 2}, ${height / 2})
    scale(${height / r})
    translate(${-x}, ${-y})
    `
    )

    links.attr("transform", d => 
    `
    translate(${width / 2}, ${height / 2})
    scale(${height / r})
    translate(${-x}, ${-y})
    `
    )

    labels.attr("transform", d => 
    `
    translate(${width / 2}, ${height / 2})
    scale(${height / r})
    translate(${-x}, ${-y})
    `)

    artist_names_group.selectAll("text").attr("transform", d => 
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

  function zoom(isBackground, orig_d) {
    var next
    focused_0 = focused
    focused = orig_d
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
        console.log(orig_d.artists)
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
          if (i < num_listed_artists) {
            d3.json('/artist_top_tracks', {
              method: "POST", 
              headers: {'Content-Type': 'application/json'}, 
              body:JSON.stringify({artist:d.name})}
            ).then(results => {
            if (audio) {audio.pause()}
            
            audio = new Audio(results.uri)
            audio.volume = 0.1
            audio.play()
            now_playing.style("font-size", orig_d.radius/15).attr("y", orig_d.y+orig_d.radius*0.12*(i-2.5-0.02))
            .attr("x", orig_d.x+orig_d.radius/50)
            .style("display", "inline").text(results.name)
            var bb = now_playing.node().getBBox()
            rect_bg.attr("x", bb.x).attr("y", bb.y).attr("width", bb.width).attr("height", bb.height)
            rect_moving.attr("x", bb.x).attr("y", bb.y).attr("width", 0).attr("height", bb.height)
            rect_moving.transition().ease(d3.easeLinear).duration(30000).attr("width", bb.width)
          })
          }
        })
        .on("mouseout", (_, i) => {
          if (i < num_listed_artists) { 
            audio.pause() 
            rect_moving.transition()
            test_masked.selectAll("rect").attr("width", 0)
            now_playing.style("display", "none")
          }
        })
        .style("display", "none")
        .style("fill-opacity", 0)
      }
    }

    svg.transition()
      .duration(duration_transition_zoom)
      .tween("zoom", () => {
        const i = d3.interpolateZoom(view, next);

        return t => zoomTo(i(t));
    });
    
    // links.transition().duration(500)
    // .style("stroke-dasharray", (d) => (d.source.index === orig_d.index) || (d.target.index === orig_d.index) ? "1" : "0")

    labels.transition().delay(d=>d===focused ? 1000 : 0 ).duration(d => d === focused ? 500 : 500)
      .style("fill-opacity", d => d === focused ? 1 : 0)
      .on("start", function(d) { if (d === focused) {this.style.display = "block"}})
      .on("end", function(d) { if (d !== focused) this.style.display = "none"; });

    if (focused_0.radius || orig_d.radius) {
      artist_names_group.selectAll("text").transition().delay((d,i)=>d.parent===focused ? 1250+i*50 : i*50 ).duration(d => d.parent === focused ? 500 : 500)
      .style("fill-opacity", d => d.parent === focused ? 1 : 0)
      .attr("x", d => d.parent === focused ? orig_d.x : focused_0.x-focused_0.radius*0.75)
      .on("start", function(d) {if (d.parent === focused) this.style.display = "inline"; })
      .on("end", function(d) { if (d.parent !== focused) this.style.display = "none"; });
    }
    
  }
  

  function expand(current, d) {
    
    if (!expanding) {
      if (expanded !== d) {
        expanded = d 
        current.raise()
        labels_group.raise()
        current_fill = d3.rgb(current.attr("fill"))
        current.transition().duration(1000).attr('r', (width**2+height**2)**(1/2)*d.radius/2*mult_zoom_radius_view/height)
        .attr("fill", adjust(brighten_expansion, current_fill)).on('start', () => expanding = true).on('end', () => expanding = false)
      } else {
        current_fill = d3.rgb(current.attr("fill"))
        artist_names_group.raise()
        now_playing_group.raise()
        current.transition().duration(750).attr('r', d => d.radius)
        .attr("fill", adjust(1/brighten_expansion, current_fill)).on('end', () => { sidebar_labels_group.raise(); expanding = false })
        expanded = null
      }
    }
  }
})

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
6
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