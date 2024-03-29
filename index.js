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

const joinCols = ["school_name", "council_district", "bbl"];

const baseRadius = 7;
const noOfXClusters = 5;
const noOfYClusters = 4;

let currentJoinCols = [];
let joinColIndex = 0;

const widthBuffer = 350;
const heightBuffer = 200;

const screenToX = x => (x / 2.0 + 0.5) * window.innerWidth;
const screenToY = y => ((y * -1.0) / 2.0 + 0.5) * window.innerHeight;

const xToScreen = x => (x / window.innerWidth - 0.5) * 2;
const yToScreen = y => -1.0 * (y / window.innerHeight - 0.5) * 2;

const xClusterPosScreen = (i, noOfXClusters, noOfYClusters, buffer, other) => {
    if (other) {
        return window.innerWidth - 150;
    }
    const width = window.innerWidth - 2 * buffer;
    return ((i % noOfXClusters) / (noOfXClusters - 1)) * width + buffer;
};

const yClusterPosScreen = (i, noOfXClusters, noOfYClusters, buffer, other) => {
    if (other) {
        return window.innerHeight / 2;
    }
    const height = window.innerHeight - 2 * buffer;
    return (
        height * 2 -
        ((Math.floor(i / noOfXClusters) / noOfYClusters) * height + buffer)
    );
};

const extractAbrv = name => {
    if (name === "Mayor's Office for Economic Opportunity") {
        return "MOfEO";
    }
    return name.includes("(") ? name.split("(")[1].split(")")[0] : name;
};

function showCategoryLabels(topCats, noXClusters, noYClusters) {
    const labels = topCats
        .map(
            (cat, i) =>
                `<div class='cat-label' style='top:${yClusterPosScreen(
                    i,
                    noOfXClusters,
                    noYClusters,
                    heightBuffer,
                    cat === "Other"
                )}px; left:${xClusterPosScreen(
                    i,
                    noXClusters,
                    noYClusters,
                    widthBuffer,
                    cat === "Other"
                )}px;' > ${extractAbrv(cat)}</div> `
        )
        .join("\n");
    document.getElementById("cat-labels").innerHTML = labels;
}

function hideCategoryLabels() {
    document.getElementById("cat-labels").style.opacity = 0.0;
}

function setSelected(selected) {
    const selectedDiv = document.getElementById("selected");

    if (selected) {
        selectedDiv.style.display = "block";
        const selectedTemplate = ` 
      <p class='agency-name'>${selected.agency} </p>
      <h1>${selected.name}</h1>
      <div class='stats'>
          <p>
              <i class='fa fa-download' ></i>  
              <span>${parseInt(selected.downloads).toLocaleString()}</span>
        </p>
                  <p>
<i class='fa fa-eye' ></i>
                    <span>${parseInt(
                        selected.page_views.toLocaleString()
                    )} </span> </p>
      </div>
    `;
        selectedDiv.innerHTML = selectedTemplate;
    } else {
        selectedDiv.innerHTML = "";
        selectedDiv.style.display = "none";
    }
}

function setJoinColumn(selectedCols) {
    console.log("joining with ", selectedCols);
    document.getElementById(
        "join-col"
    ).innerHTML = `Joining on ${selectedCols.join(", ")}`;
}

function clearJoinColumn() {
    document.getElementById("join-col").innerHTML = ``;
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
                r: baseRadius, //Math.random() * 10 + 1,
                color: [parseFloat(a.r), parseFloat(a.g), parseFloat(a.b), 1], //.0Math.random(), Math.random(), Math.random(), 1],
                id: i
            };
        });

        document.addEventListener("mousemove", e => {
            wx = (e.pageX / window.innerWidth - 0.5) * 2;
            wy = -1.0 * (e.pageY / window.innerHeight - 0.5) * 2;
            const selectedDiv = document.getElementById("selected");
            if (e.pageY < innerHeight / 2) {
                selectedDiv.style.top = e.pageY + "px";
            } else {
                selectedDiv.style.top = e.pageY - 200 + "px";
            }
            if (e.pageX < innerWidth / 2) {
                selectedDiv.style.left = e.pageX + "px";
            } else {
                selectedDiv.style.left = e.pageX - 400 + "px";
            }
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
                .slice(1)
                .map(
                    (val, index) =>
                        `<li>
                    <p class='size-label'>${Math.floor(
                        val
                    ).toLocaleString()}</p>
                        <div class='size-circle' style='width:${
                            sizeStops.slice(1)[index]
                        }px;height:${
                            sizeStops.slice(1)[index]
                        }px; border-radius: ${
                            sizeStops.slice(1)[index]
                        }px '></div> 
                 </li>
                 `
                )
                .join("\n")}
            </ul>
            `;

            document.getElementById("size-key").innerHTML = sizeKey;
        };

        const setColorLegend = () => {
            const colorKeyDiv = document.getElementById("color-key");
            const key = document.getElementById("key");
            const cc = colorKey;

            if (showColor) {
                key.style.opacity = 1.0;
                const keyString = `
            <div class='entries'>
                ${[
                    ...Object.entries(colorKey).filter(a => a[0] !== "Other"),
                    ...Object.entries(colorKey).filter(a => a[0] === "Other")
                ]
                    .map(
                        a =>
                            `<div class='entry'><p style='color: rgb(${a[1][0] *
                                255}, ${a[1][1] * 255}, ${a[1][2] *
                                255});'>${extractAbrv(a[0])}
                                </p></div>`
                    )
                    .join("\n")}
            </div>
                `;
                colorKeyDiv.innerHTML = keyString;
            } else {
                key.style.opacity = 0.0;
            }
        };

        const topCats = Object.keys(colorKey);

        console.log("Color key ", colorKey);

        let showColor = false;

        var categoryClusters = false;

        const centerForceX = d3.forceX().strength(0.04);
        const centerForceY = d3.forceY().strength(0.04);

        const categoryForceX = d3
            .forceX(
                d =>
                    xToScreen(
                        xClusterPosScreen(
                            topCats.indexOf(d.agency),
                            noOfXClusters,
                            noOfYClusters,
                            widthBuffer,
                            topCats.indexOf(d.agency) === -1
                        )
                    ) * window.innerWidth
            )
            .strength(0.04);

        const categoryForceY = d3
            .forceY(
                d =>
                    yToScreen(
                        yClusterPosScreen(
                            topCats.indexOf(d.agency),
                            noOfXClusters,
                            noOfYClusters,
                            heightBuffer,
                            topCats.indexOf(d.agency) === -1
                        )
                    ) * window.innerHeight
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
                    .radius(d => d.r * 0.9)
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
                r: v ? scale(parseFloat(datasets[i][v])) : baseRadius
            }));
            radiusBuffer.update(nodes.map(n => n.r));
            simulation.alpha(v ? 0.01 : 0.1);
            simulation.nodes(nodes);
            const buckets = 5;
            const step = (range[1] - range[0]) / 5;
            let sizes = [...Array(5)].map((_, i) => i * step + min);
            let vals = sizes.map(r => scale.invert(r));
            setSizeLegend(`${v}`, vals, sizes);
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
                y: wy
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
                    showCategoryLabels(topCats, noOfXClusters, noOfYClusters);
                } else {
                    simulation.force("forceX", centerForceX);
                    simulation.force("forceY", centerForceY);
                    simulation.alpha(0.4);
                    hideCategoryLabels();
                }
            }
            if (e.key === "l") {
                simulation.force("charge", chargeForce);
                if (joinColIndex < joinCols.length) {
                    setJoinColumn([joinCols[joinColIndex]]);
                    simulation
                        .force("link")
                        .links(
                            links.filter(l => joinCols[joinColIndex] === l.col)
                        );
                    joinColIndex += 1;
                } else {
                    setJoinColumn(["bbl", "school_name", "council_district"]);
                    simulation
                        .force("link")
                        .links(
                            links.filter(l =>
                                [
                                    "bbl",
                                    "school_name",
                                    "council_district"
                                ].includes(l.col)
                            )
                        );
                    joinColIndex += 1;
                }
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
