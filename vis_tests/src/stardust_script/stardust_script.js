// Converted our reagraph csv to json script into a raw js version for this (as we need json in js scripts)
const nodes = [];
const edges = [];

const edgesList = [];
const neededNodeIds = new Set();
const nodeMap = new Map();
const categoryColors = {
    'yellow': '#FCD34D',
    'black': '#6B7280',
    'green': '#34D399',
    'red': '#F87171'
};

const timings = {};
const startTime = Date.now();

function startParsing() {
  Papa.parse('../../dataset_2/dataset_edges.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    step: (row, parser) => {
      if (edgesList.length === 0) {
        timings.edge_loading_start = Date.now();
      }
      
      if (edgesList.length >= 49000) return;
      
      const row_data = row.data;
      
      const sourceId = String(row_data.source_id);
      const targetId = String(row_data.target_id);
      
      edgesList.push({
        source: sourceId,
        target: targetId,
        influence: row_data.influence,
        derivative: row_data.derivative,
        category: row_data.category
      });
      
      neededNodeIds.add(sourceId);
      neededNodeIds.add(targetId);
    },
    complete: () => {
      timings.edge_loading = Date.now() - timings.edge_loading_start;
      console.log(`Edge Loading: ${timings.edge_loading}ms`);
      
      const startEdgeParse = Date.now();
      timings.edge_parsing = Date.now() - startEdgeParse;
      console.log(`Edge Parsing: ${timings.edge_parsing}ms`);
      
      const startNodeLoad = Date.now();
      
      Papa.parse('../../dataset_2/dataset_nodes.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        step: (row, parser) => {
          if (!timings.node_loading_start) {
            timings.node_loading_start = Date.now();
          }
          
          const row_data = row.data;
          const nodeId = String(row_data.node_id);
          
          if (neededNodeIds.has(nodeId)) {
              const nodeMass = row_data.mass || 17;
              const nodeSize = Math.max(5, nodeMass / 2);
              
              nodeMap.set(nodeId, {
                  id: nodeId,
                  label: `node_${row_data.node_id}`,
                  size: nodeSize,
                  fill: row_data.tagged ? '#3B82F6' : '#94A3B8',
                  mass: row_data.mass,
                  max_speed: row_data.max_speed,
                  tagged: row_data.tagged,
                  reactive: row_data.reactive
              });
          }
        },
        complete: () => {
          timings.node_loading = Date.now() - timings.node_loading_start;
          console.log(`Node Loading: ${timings.node_loading}ms`);
          
          const startNodeParse = Date.now();
          
          const finalNodes = Array.from(nodeMap.values());
          
          timings.node_parsing = Date.now() - startNodeParse;
          console.log(`Node Parsing: ${timings.node_parsing}ms`);
          
          const startTransform = Date.now();
          
          const finalEdges = edgesList.filter(edge => nodeMap.has(edge.source) && nodeMap.has(edge.target)).map((edge, idx) => {
              const influence = edge.influence;
              const edgeWidth = 1 + (Math.min(Math.abs(influence), 8) / 8) * 3;
              const opacity = 0.4 + (Math.min(Math.abs(influence), 8) / 8) * 0.5;

              return {
                  id: `edge_${idx}`,
                  source: edge.source,
                  target: edge.target,
                  fill: categoryColors[edge.category] || '#9CA3AF',
                  size: edgeWidth,
                  opacity: opacity,
                  label: `${influence.toFixed(1)}`,
                  influence: edge.influence,
                  derivative: edge.derivative,
                  category: edge.category
              };
          });

          nodes.push(...finalNodes);
          edges.push(...finalEdges);
          
          timings.data_transformation = Date.now() - startTransform;
          console.log(`Data Transformation: ${timings.data_transformation}ms`);
          
          initVisualization();
        }
      });
    }
  });
}

function hexToRGBA(hex, alpha = 1){
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b, alpha]
}

function initVisualization() {
  const canvas = document.getElementById("graphCanvas");
  
  let transform = { x: 0, y: 0, scale: 1 };
  let isDragging = false;
  let lastMousePos = { x: 0, y: 0 };
  
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    
    renderGraph();
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const scaleFactor = Math.exp(delta);
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    transform.x = mouseX - (mouseX - transform.x) * scaleFactor;
    transform.y = mouseY - (mouseY - transform.y) * scaleFactor;
    transform.scale *= scaleFactor;
    transform.scale = Math.max(0.005, Math.min(10, transform.scale));
    
    renderGraph();
  });

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('mousemove', (e) => {
    if(isDragging){
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      
      transform.x += dx;
      transform.y += dy;
      
      lastMousePos = { x: e.clientX, y: e.clientY };
      renderGraph();
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });

  canvas.style.cursor = 'grab';

  const platform = Stardust.platform("webgl-2d", canvas);
  const edgeSpec = Stardust.mark.line();
  const edges_mark = Stardust.mark.create(edgeSpec, platform);

  const nodeSpec = Stardust.mark.circle();
  const nodes_mark = Stardust.mark.create(nodeSpec, platform);

  const startD3Layout = Date.now();

  const simulation = d3.forceSimulation(nodes).force("link", d3.forceLink(edges)
  .id(d => d.id)
  .distance(50)
  .strength(d => Math.abs(d.influence) / 20))
  .force("charge", d3.forceManyBody()
  .strength(d => -30 * (d.mass || 17)))
  .force("center", d3.forceCenter(canvas.width / 2, canvas.height / 2))
  .force("collision", d3.forceCollide()
  .radius(d => d.size + 2))

  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }
  
  timings.d3_layout = Date.now() - startD3Layout;
  console.log(`D3 Layout: ${timings.d3_layout}ms`);

  const startEdgePrep = Date.now();

  function applyTransform(x, y) {
    return [x * transform.scale + transform.x, y * transform.scale + transform.y]
  }

  function renderGraph() {
    edges_mark.attr("p1", d => {
        const source = nodes.find(n => n.id === d.source.id || n.id === d.source);
        return source ? applyTransform(source.x, source.y) : [0, 0]});
    edges_mark.attr("p2", d => {
        const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
        return target ? applyTransform(target.x, target.y) : [0, 0]})
    edges_mark.attr("width", d => d.size * transform.scale);
    edges_mark.attr("color", d => hexToRGBA(d.fill, d.opacity));
    
    nodes_mark.attr("center", d => applyTransform(d.x, d.y))
    nodes_mark.attr("radius", d => d.size * transform.scale)
    nodes_mark.attr("color", d => hexToRGBA(d.fill, 1))
    
    edges_mark.data(edges);
    nodes_mark.data(nodes);
    
    platform.clear([0.1, 0.1, 0.1, 1]);
    edges_mark.render();
    nodes_mark.render();
  }

  timings.edge_preparation = Date.now() - startEdgePrep;
  console.log(`Edge Preparation: ${timings.edge_preparation}ms`);

  timings.total_time = Date.now() - startTime;
  console.log(`Total Time: ${timings.total_time}ms`);

  const benchmarkDiv = document.createElement('div');
  benchmarkDiv.style.cssText = 'position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.8); color: white; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; max-width: 300px;';
  benchmarkDiv.innerHTML = `
    <h3 style="margin: 0 0 10px 0;">Stardust Benchmarks</h3>
    <div>Nodes: ${nodes.length}</div>
    <div>Edges: ${edges.length}</div>
    <hr style="margin: 10px 0;" />
    <div>Edge Loading: ${timings.edge_loading}ms</div>
    <div>Edge Parsing: ${timings.edge_parsing}ms</div>
    <div>Node Loading: ${timings.node_loading}ms</div>
    <div>Node Parsing: ${timings.node_parsing}ms</div>
    <div>Data Transform: ${timings.data_transformation}ms</div>
    <div>D3 Layout: ${timings.d3_layout}ms</div>
    <div>Edge Prep: ${timings.edge_preparation}ms</div>
    <hr style="margin: 10px 0;" />
    <div><strong>Total: ${timings.total_time}ms</strong></div>
  `;
  document.body.appendChild(benchmarkDiv);

  renderGraph();

  simulation.on("tick", () => {
    renderGraph();
  });

  setTimeout(() => {
    simulation.stop();
    console.log("Simulation stopped which means the graph is now static!");
  }, 5000);
}

window.addEventListener('load', () => {
  startParsing();
});