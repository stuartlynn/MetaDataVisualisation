import * as d3 from 'd3';
import createREGL from 'regl';
import tween from 'regl-tween';
import circleVert from './circleVert.glsl';
import circleFrag from './circleFrag.glsl';

//import data from './dataset_stats.csv';

//import Papa from 'pappaparse';
//let d = Papa.parse(data, {header: true});

console.log(circleVert, circleFrag);

d3.csv(`${process.env.PUBLIC_URL}/dataset_stats.csv`).then(datasets => {
  d3.csv(`${process.env.PUBLIC_URL}/links.csv`).then(links => {
    console.log('datasets are ', datasets);
    console.log('links are ', links[0]);
    let nodes = datasets.map((a, i) => {
      const angle = Math.random() * 2.0 * Math.PI;
      return {
        x: Math.cos(angle) * (700 + 500 * i), // (Math.random() - 0.5) * 20,
        y: Math.sin(angle) * (700 + 500 * i),
        r: 10, //Math.random() * 10 + 1,
        color: [parseFloat(a.r), parseFloat(a.g), parseFloat(a.b), 1], //.0Math.random(), Math.random(), Math.random(), 1],
        id: i,
      };
    });

    const linkForce = d3.forceLink(links);
    const chargeForce = d3.forceManyBody().strength(-20);
    let simulation = d3
      .forceSimulation(nodes)
      .velocityDecay(0.2)
      .force('x', d3.forceX().strength(0.04))
      .force('y', d3.forceY().strength(0.04))
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

      window.scale = scale;

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
          props.nodes.map(n => [n.x * 0.001, n.y * 0.001]),
        pointWidth: radiusBuffer,
        nodeColor: (context, props) => props.nodes.map(e => e.color),
      },
      count: (context, props) => props.nodes.length,
      primitive: 'points',
    });

    regl.frame(({tick}) => {
      simulation.tick();
      regl.clear({
        color: [0, 0, 0, 1],
        depth: 1,
      });

      drawParticles({nodes: [...simulation.nodes()]});
    });
    document.addEventListener('keypress', e => {
      if (e.key === 'l') {
        simulation.force('link', linkForce);
        simulation.force('charge', chargeForce);
        simulation.alpha(0.4);
      }
      if (e.key === 'k') {
        simulation.force('link', null);
        simulation.force('charge', null);
        simulation.alpha(0.4);
      }
      if (e.key === 'r') {
        setSizeVar();
      }
      if (e.key === 'd') {
        setSizeVar('downloads');
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
