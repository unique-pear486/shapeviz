import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

var vis = d3.select("body").append("svg")
         .attr("width", 1000)
         .attr("height", 667);

var scaleX = d3.scaleLinear()
        .domain([-100,100])
        .range([0,600]);

var scaleY = d3.scaleLinear()
        .domain([0,600])
        .range([500,0]);

var scaleColor = d3.scaleLinear()
	.domain([0,100])
  .range(["#e41a1c", "#377eb8"])
	.interpolate(d3.interpolateLab)

console.log(scaleColor(4));

var poly1 = [{"x":-80.0, "y":200.0, "value": 10.0},
        {"x":80.0,"y":200},
        {"x":80.0,"y":500},
        {"x":-80.0,"y":500}];

var poly2 = [{"x":0, "y":400.0, "value": 90.0},
        {"x":60,"y":400},
        {"x":0,"y":600}];

vis.selectAll("polygon")
    .data([poly1, poly2])
  .enter().append("polygon")
    .attr("points",function(d) { 
        return d.map(function(d) { return [scaleX(d.x),scaleY(d.y)].join(","); }).join(" ");})
    .attr("stroke","black")
    .attr("stroke-width",2)
    .attr("fill", function(d) { return scaleColor(d[0].value) });

