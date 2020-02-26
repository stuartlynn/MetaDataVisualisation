import * as d3 from "d3";
import createREGL from "regl";
import tween from "regl-tween";
import circleVert from "./circleVert.glsl";
import circleFrag from "./circleFrag.glsl";
import colorKey from "./color_key.json";
//import reglline2d from "regl-line2d";

//import data from './dataset_stats.csv';

//import Papa from 'pappaparse';
//let d = Papa.parse(data, {header: true});

let wx = 0;
let wy = 0;

var selectedID = null;

function findNearest(x, y, nodes, width, height) {
    const xx = x * width;
    const yy = y * height;
    const hits = nodes.filter(
        n => (n.x - xx) * (n.x - xx) + (n.y - yy) * (n.y - yy) < n.r * n.r
    );
    return hits;
}

const joinCols = [
    "bin",
    "bbl",
    "school_name",
    "council_district",
    "nta",
    "dbn",
    "census_tract",
    "district",
    "community_council"
];

let currentJoinCols = [];
let joinColIndex = 0;

function setSelected(selected) {
    const selectedDiv = document.getElementById("selected");
    if (selected) {
        const selectedTemplate = ` 
      <h1>Selection</h1>
      <p> name: ${selected.name} </p>
      <p> agency: ${selected.agency} </p>
      <p> downloads: ${selected.downloads.toLocaleString()} </p>
      <p> views: ${selected.page_views.toLocaleString()} </p>
    `;
        selectedDiv.innerHTML = selectedTemplate;
    } else {
        selectedDiv.innerHTML = "";
    }
}

const BASE_URL = process.env.PUBLIC_URL ? process.env.PUBLIC_URL : "";

d3.csv(`${BASE_URL}dataset_stats.csv`).then(datasets => {
    d3.csv(`${BASE_URL}links.csv`).then(links => {
        console.log("datasets ", datasets);
        var nodes = datasets.map((a, i) => {
            const angle = Math.random() * 2.0 * Math.PI;
            return {
                ...a,
                x: Math.cos(angle) * (window.innerWidth + 500 * i), // (Math.random() - 0.5) * 20,
                y: Math.sin(angle) * (window.innerWidth + 500 * i),
                r: 10, //Math.random() * 10 + 1,
                color: [parseFloat(a.r), parseFloat(a.g), parseFloat(a.b), 1], //.0Math.random(), Math.random(), Math.random(), 1],
                id: i
            };
        });

        document.addEventListener("mousemove", e => {
            wx = (e.pageX / window.innerWidth - 0.5) * 2;
            wy = -1.0 * (e.pageY / window.innerHeight - 0.5) * 2;
            const near = findNearest(
                wx,
                wy,
                nodes,
                window.innerWidth,
                window.innerHeight
            );
            if (near.length > 0) {
                selectedID = near[0].id;
                setSelected(near[0]);
            } else {
                setSelected(null);
                selectedID = null;
            }
        });

        const clearSizeLegend = () => {
            document.getElementById("size-key").innerHTML = "";
        };

        const setSizeLegend = (title, valStops, sizeStops) => {
            const sizeKey = ` 
             <h1>${title}</h1>
            <ul>
            ${valStops
                .map(
                    (val, index) =>
                        `<li>
                    <p class='size-label'>${val.toLocaleString()}</p>
                        <div class='size-circle' style='width:${
                            sizeStops[index]
                        }px;height:${sizeStops[index]}px; border-radius: ${
                            sizeStops[index]
                        }px '></div> 
                 </li>
                 `
                )
                .join("\n")}
            </ul>
            `;

            console.log("deploying template  ", sizeKey);
            document.getElementById("size-key").innerHTML = sizeKey;
        };

        const setColorLegend = () => {
            const keyDiv = document.getElementById("color-key");
            if (showColor) {
                const keyString = `
            <h1>Departments</h1>
            <div class='entries'>
                ${Object.entries(colorKey)
                    .map(
                        a =>
                            `<div class='entry'><div class='circle' style='background-color:rgb(${a[1][0] *
                                255}, ${a[1][1] * 255}, ${a[1][2] *
                                255})'> </div> <p>${a[0]}</p></div>`
                    )
                    .join("\n")}
            </div>
                `;
                keyDiv.innerHTML = keyString;
            } else {
                keyDiv.innerHTML = "";
            }
        };

        const noOfXClusters = 5;
        const noOfYClusters = 4;
        const topCats = Object.keys(colorKey);

        console.log("Color key ", colorKey);

        let showColor = false;

        var categoryClusters = false;

        const centerForceX = d3.forceX().strength(0.04);
        const centerForceY = d3.forceY().strength(0.04);

        const categoryForceX = d3
            .forceX(
                d =>
                    ((topCats.indexOf(d.agency) % noOfXClusters) /
                        noOfXClusters) *
                        window.innerWidth *
                        1.5 -
                    window.innerWidth * 0.5
            )
            .strength(0.04);

        const categoryForceY = d3
            .forceY(
                d =>
                    (Math.floor(topCats.indexOf(d.agency) / noOfXClusters) /
                        noOfYClusters) *
                        window.innerHeight *
                        1.3 -
                    window.innerHeight * 0.8
            )
            .strength(0.04);

        const linkForce = d3.forceLink([]);
        const chargeForce = d3.forceManyBody().strength(-20);
        let simulation = d3
            .forceSimulation(nodes)
            .velocityDecay(0.2)
            .force("forceX", centerForceX)
            .force("forceY", centerForceY)
            .force("link", linkForce)
            .force(
                "collide",
                d3
                    .forceCollide()
                    .strength(1)
                    .iterations(1)
                    .radius(d => d.r)
            )
            .stop();

        let regl = createREGL({
            extensions: ["OES_standard_derivatives", "ANGLE_instanced_arrays"]
        });
        let twee = tween(regl);
        //const line2d = reglline2d(regl);

        let radiusBuffer = twee.buffer(nodes.map(n => n.r), {
            duration: 1000,
            ease: "expo-in-out"
        });

        function setSizeVar(v) {
            const max = Math.max(...datasets.map(d => (v ? d[v] : 10)));
            const min = Math.min(...datasets.map(d => (v ? d[v] : 10)));
            const range = v === "d" ? [2, 40] : [2, 200];
            const scale = d3
                .scaleSqrt()
                .domain([min, max])
                .range(range);

            nodes = nodes.map((n, i) => ({
                ...n,
                r: v ? scale(parseFloat(datasets[i][v])) : 10
            }));
            radiusBuffer.update(nodes.map(n => n.r));
            simulation.alpha(v ? 0.01 : 0.1);
            simulation.nodes(nodes);
            const buckets = 5;
            const step = (range[1] - range[0]) / 5;
            let sizes = [...Array(5)].map((_, i) => i * step + min);
            let vals = sizes.map(r => scale.invert(r));
            setSizeLegend(`Sizing by ${v}`, vals, sizes);
        }

        const drawParticles = twee({
            vert: circleVert,
            frag: circleFrag,
            depth: { enable: false },
            attributes: {
                position: (context, props) =>
                    props.nodes.map(n => [
                        n.x / props.width,
                        n.y / props.height
                    ]),
                pointWidth: radiusBuffer,
                nodeColor: (context, props) =>
                    props.nodes.map(e =>
                        showColor ? e.color : [0.8, 0.8, 0.8, 1.0]
                    )
            },
            count: (context, props) => props.nodes.length,
            primitive: "points"
        });

        const drawPointer = regl({
            vert: circleVert,
            frag: circleFrag,
            depth: { enable: false },
            attributes: {
                position: (context, props) => [[props.x, props.y]],
                pointWidth: [50],
                nodeColor: [[1.0, 0.0, 0.0, 1.0]]
            },
            count: 1,
            primitive: "points"
        });

        regl.frame(({ tick }) => {
            simulation.tick();
            regl.clear({
                color: [0, 0, 0, 1],
                depth: 1
            });
            drawParticles({
                nodes: [...simulation.nodes()],
                width: window.innerWidth,
                height: window.innerHeight
            });

            /*drawPointer({
        x: wx,
        y: wy,
                });*/
        });
        document.addEventListener("keypress", e => {
            if (e.keyCode === 32) {
                simulation.alpha(0.4);
            }
            if (e.key === "s") {
                categoryClusters = !categoryClusters;
                if (categoryClusters) {
                    simulation.force("forceX", categoryForceX);
                    simulation.force("forceY", categoryForceY);
                    simulation.alpha(0.4);
                } else {
                    simulation.force("forceX", centerForceX);
                    simulation.force("forceY", centerForceY);
                    simulation.alpha(0.4);
                }
            }
            if (e.key === "l") {
                simulation.force("charge", chargeForce);
                simulation
                    .force("link")
                    .links(links.filter(l => joinCols[joinColIndex] === l.col));
                joinColIndex += 1;
                simulation.alpha(0.4);
            }
            if (e.key === "k") {
                simulation.force("link").links([]);
                simulation.force("charge", null);
                simulation.alpha(0.4);
            }
            if (e.key === "r") {
                setSizeVar();
                clearSizeLegend();
            }
            if (e.key === "d") {
                setSizeVar("downloads");
            }
            if (e.key === "w") {
                setSizeVar("rows");
            }
            if (e.key === "c") {
                showColor = !showColor;
                setColorLegend();
            }
            if (e.key === "j") {
                setSizeVar("d");
            }
            if (e.key === "v") {
                setSizeVar("page_views");
            }
        });
    });
});
