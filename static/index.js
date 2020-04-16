

var mainDiv = document.getElementById("chart")
// var width = $(window).width()
var width = mainDiv.clientWidth;
var height = mainDiv.clientHeight;
let svg = d3.select("div#chart").append('svg').attr("width", width).attr("height", height)

var density_nodes = 0.0001
var clicked = false
var a = d3.select(".link")
var blurb = d3.select("#blurb").style("opacity", 0).style("display", "inline")
blurb.transition().delay(500).duration(1000).style("opacity", 1)

var bb = null
var rect_bg = svg.append("rect").style("fill", "000").style("fill-opacity", 1).style("display", "none")

// var bb = d3.select("#blurb").node().getBoundingClientRect()

// let rect_bg = svg.append("rect").style("fill", "000").style("fill-opacity", 1).style("display", "none")
// .attr("x", bb.x).attr("y", bb.y+bb.height*(1-0.90)).attr("width", bb.width).attr("height", bb.height*0.90)

function genNodes() {
    return d3.range(Math.round(width * height * density_nodes)).map( (i) => {
        const angle = Math.random()*2*Math.PI,
            velocity = Math.random()*2+1;

        m = 15, p = 2/5, t = 30
        succ = d3.range(t).reduce((acc, curr) => Math.random() < p? acc+1: acc, 0)
        
        console.log(succ/t*m)
        return {
            x: Math.random()*width,
            y: Math.random()*height,
            vx: Math.cos(angle)*velocity,
            vy: Math.sin(angle)*velocity,
            r: succ/t*m,
            fill: d3.hsl(Math.random()*360, Math.random()*0.2+0.5, Math.random()*0.1+0.5)
        }
    })
}

function onMouseout() {
    if (!clicked) {
        blurb = d3.select("#blurb").classed("blurb-no-hover", true)
        d3.select(".link").classed("index-text-hover", false)
        d3.select(".link").classed("index-text", true)
        rect_bg.style("display", "none")
    }
    
    sim.force('x', null).force('y', null)
    .force('container', d3.forceSurface()
    .surfaces([
        {from: {x:0,y:0}, to: {x:0,y:height}},
        {from: {x:0,y:height}, to: {x:width,y:height}},
        {from: {x:width,y:height}, to: {x:width,y:0}},
        {from: {x:width,y:0}, to: {x:0,y:0}}
    ])
    .oneWay(true)
    .radius(d => d.r));
    nodes.map((d) => {
        
        // d.vx=d.vx < 0 ? -1*(-d.vx)**0.5 : d.vx**0.5;
        // d.vy=d.vy < 0 ? -1*(-d.vy)**0.5 : d.vy**0.5;
        d.vx *=0.25;
        d.vy *=0.25
    })
}

function onClick() {
    
    setTimeout(() =>{window.location = "/login"}, 500)
    clicked = true
    
    svg.selectAll('circle').transition().duration(() => Math.min(Math.random()*1500, Math.random()*1500)).style("fill-opacity", 0)
    
    rect_bg.transition().delay(250).duration(500)
    // .style("fill-opacity", 0)
    .attr("width", 0)
    .attr("x", bb.width+bb.x)

    // rect_bg.transition().delay(250).duration(500)
    // // .style("fill-opacity", 0)
    // .attr("width", 0)
    // .attr("x", bb.width+bb.x)
    // .attr("height", 0)

    sim.force('x', d3.forceX(width/2).strength(-0.003))
    .force('y', d3.forceY(height/2).strength(-0.003)).force("container", null)
    .velocityDecay(0.03)

}

function onMouseover() {

    blurb = d3.select("#blurb").classed("blurb-no-hover", false)
    bb = blurb.node().getBoundingClientRect()

    rect_bg.attr("x", bb.x).attr("y", bb.y+bb.height*(1-0.90)).attr("width", bb.width).attr("height", bb.height*0.85)
    .style("display", "inline").raise()

    a.classed("index-text-hover", true).classed("index-text", false)
    sim.force('x', d3.forceX(width/2).strength(0.001))
    .force('y', d3.forceY(height/2).strength(0.001))
    .force('container', d3.forceSurface()
		.surfaces([
			{from: {x:0,y:0}, to: {x:0,y:height}},
			{from: {x:0,y:height}, to: {x:width,y:height}},
			{from: {x:width,y:height}, to: {x:width,y:0}},
            {from: {x:width,y:0}, to: {x:0,y:0}},
            {from: {x:bb.x, y:bb.y}, to: {x:bb.x+bb.width, y:bb.y}},
            {from: {x:bb.x+bb.width, y:bb.y}, to: {x:bb.x+bb.width, y:bb.y+bb.height}},
            {from: {x:bb.x+bb.width, y:bb.y+bb.height}, to: {x:bb.x, y:bb.y+bb.height}},
            {from: {x:bb.x, y:bb.y+bb.height}, to: {x:bb.x, y:bb.y}},
		])
		.oneWay(true)
        .radius(d => d.r));
    
}

var nodes = genNodes()
var sim = d3.forceSimulation(nodes)
    .alphaDecay(0)
    .velocityDecay(0)
    .on('tick', tick)
    .force('bounce', d3.forceBounce().radius(d=>d.r))
    .force('container', d3.forceSurface()
		.surfaces([
			{from: {x:0,y:0}, to: {x:0,y:height}},
			{from: {x:0,y:height}, to: {x:width,y:height}},
			{from: {x:width,y:height}, to: {x:width,y:0}},
			{from: {x:width,y:0}, to: {x:0,y:0}}
		])
		.oneWay(true)
        .radius(d => d.r));

function tick() {
    let particles = svg.selectAll('circle').data(nodes)

    particles.join((enter) => {
        enter.append("circle").style("fill-opacity",0)
        .call(enter => enter.transition().duration(()=> Math.random()*3000).style("fill-opacity", 1))
    }).attr('cx', d=>d.x).attr('cy', d=>d.y).attr("r", d=>d.r).style("fill", d=>d.fill)
}


window.addEventListener("resize", draw);
function draw() {
    chartDiv = document.getElementById("chart");
    width = chartDiv.clientWidth;
    height = chartDiv.clientHeight;
    svg.attr("width", width).attr("height", height)

    sim.force('container', d3.forceSurface()
            .surfaces([
                {from: {x:0,y:0}, to: {x:0,y:height}},
                {from: {x:0,y:height}, to: {x:width,y:height}},
                {from: {x:width,y:height}, to: {x:width,y:0}},
                {from: {x:width,y:0}, to: {x:0,y:0}},
            ])
            .oneWay(true)
            .radius(d => d.r));

    nodes.map((d) => {
        d.x = Math.min(width, d.x);
        d.y = Math.min(height, d.y);
    })
}