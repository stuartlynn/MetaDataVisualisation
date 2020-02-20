import * as d3 from 'd3';
import createREGL from 'regl';
import tween from 'regl-tween';
import circleVert from './circleVert.glsl';
import circleFrag from './circleFrag.glsl';
import colorKey from './color_key.json';

let wx = 0;
let wy = 0;

var selectedID = null;

function findNearest(x, y, nodes, width, height) {
  const xx = x * width;
  const yy = y * height;
  console.log('xx ', xx, ' yy ', yy, ' x ', x, ' y ', y);
  const hits = nodes.filter(
    n => (n.x - xx) * (n.x - xx) + (n.y - yy) * (n.y - yy) < n.r * n.r,
  );
  return hits;
}

function setSelected(selected) {
  const selectedDiv = document.getElementById('selected');
  if (selected) {
    console.log(selected);
    const selectedTemplate = ` 
      <h1>Selection</h1>
      <p> name: ${selected.name} </p>
      <p> agency: ${selected.agency} </p>
      <p> downloads: ${selected.downloads} </p>
      <p> views: ${selected.page_views} </p>
    `;
    selectedDiv.innerHTML = selectedTemplate;
  } else {
    selectedDiv.innerHTML = '';
  }
}

const BASE_URL = window.location.href; //process.env.PUBLIC_URL ? process.env.PUBLIC_URL : '';

d3.csv(`${BASE_URL}/dataset_stats.csv`).then(datasets => {
  d3.csv(`${BASE_URL}/links.csv`).then(links => {
    var nodes = datasets.map((a, i) => {
      const angle = Math.random() * 2.0 * Math.PI;
      return {
        ...a,
        x: Math.cos(angle) * (window.innerWidth + 500 * i), // (Math.random() - 0.5) * 20,
        y: Math.sin(angle) * (window.innerWidth + 500 * i),
        r: 10, //Math.random() * 10 + 1,
        color: [parseFloat(a.r), parseFloat(a.g), parseFloat(a.b), 1], //.0Math.random(), Math.random(), Math.random(), 1],
        id: i,
      };
    });

    document.addEventListener('mousemove', e => {
      wx = (e.pageX / window.innerWidth - 0.5) * 2;
      wy = -1.0 * (e.pageY / window.innerHeight - 0.5) * 2;
      const near = findNearest(
        wx,
        wy,
        nodes,
        window.innerWidth,
        window.innerHeight,
      );
      if (near.length > 0) {
        console.log('near ', near[0].id);
        selectedID = near[0].id;
        setSelected(near[0]);
      } else {
        setSelected(null);
        selectedID = null;
      }
    });

    const setColorLegend = () => {
      const keyDiv = document.getElementById('color-key');
      if (showColor) {
        const keyString = `
            <h1>Departments</h1>
            <div class='entries'>
                ${Object.entries(colorKey)
                  .map(
                    a =>
                      `<div class='entry'><div class='circle' style='background-color:rgb(${a[1][0] *
                        255}, ${a[1][1] * 255}, ${a[1][2] * 255})'> </div> <p>${
                        a[0]
                      }</p></div>`,
                  )
                  .join('\n')}
            </div>
                `;
        keyDiv.innerHTML = keyString;
      } else {
        keyDiv.innerHTML = '';
      }
    };

    let showColor = false;

    const linkForce = d3.forceLink([]);
    const chargeForce = d3.forceManyBody().strength(-20);
    let simulation = d3
      .forceSimulation(nodes)
      .velocityDecay(0.2)
      .force('x', d3.forceX().strength(0.04))
      .force('y', d3.forceY().strength(0.04))
      .force('link', linkForce)
      .force(
        'collide',
        d3
          .forceCollide()
          .strength(1)
          .iterations(1)
          .radius(d => d.r),
      )
      .stop();

    let regl = createREGL({
      extensions: ['OES_standard_derivatives'],
    });
    let twee = tween(regl);

    let radiusBuffer = twee.buffer(nodes.map(n => n.r), {
      duration: 1000,
      ease: 'expo-in-out',
    });

    function setSizeVar(v) {
      const max = Math.max(...datasets.map(d => (v ? d[v] : 10)));
      const min = Math.min(...datasets.map(d => (v ? d[v] : 10)));
      const range = v === 'd' ? [2, 40] : [2, 200];
      const scale = d3
        .scaleSqrt()
        .domain([min, max])
        .range(range);

      nodes = nodes.map((n, i) => ({
        ...n,
        r: v ? scale(parseFloat(datasets[i][v])) : 10,
      }));
      radiusBuffer.update(nodes.map(n => n.r));
      simulation.alpha(v ? 0.01 : 0.1);
      simulation.nodes(nodes);
    }

    const drawParticles = twee({
      vert: circleVert,
      frag: circleFrag,
      depth: {enable: false},
      attributes: {
        position: (context, props) =>
          props.nodes.map(n => [n.x / props.width, n.y / props.height]),
        pointWidth: radiusBuffer,
        nodeColor: (context, props) =>
          props.nodes.map(e => (showColor ? e.color : [0.8, 0.8, 0.8, 1.0])),
      },
      count: (context, props) => props.nodes.length,
      primitive: 'points',
    });

    const drawPointer = regl({
      vert: circleVert,
      frag: circleFrag,
      depth: {enable: false},
      attributes: {
        position: (context, props) => [[props.x, props.y]],
        pointWidth: [50],
        nodeColor: [[1.0, 0.0, 0.0, 1.0]],
      },
      count: 1,
      primitive: 'points',
    });

    regl.frame(({tick}) => {
      simulation.tick();
      regl.clear({
        color: [0, 0, 0, 1],
        depth: 1,
      });
      drawParticles({
        nodes: [...simulation.nodes()],
        width: window.innerWidth,
        height: window.innerHeight,
      });
      /*drawPointer({
        x: wx,
        y: wy,
                });*/
    });
    document.addEventListener('keypress', e => {
      if (e.key === 'l') {
        simulation.force('charge', chargeForce);
        simulation.force('link').links(links);
        simulation.alpha(0.4);
      }
      if (e.key === 'k') {
        simulation.force('link').links([]);
        simulation.force('charge', null);
        simulation.alpha(0.4);
      }
      if (e.key === 'r') {
        setSizeVar();
      }
      if (e.key === 'd') {
        setSizeVar('downloads');
      }
      if (e.key === 'c') {
        showColor = !showColor;
        setColorLegend();
      }
      if (e.key === 'j') {
        setSizeVar('d');
      }
      if (e.key === 'v') {
        setSizeVar('page_views');
      }
    });
  });
});
