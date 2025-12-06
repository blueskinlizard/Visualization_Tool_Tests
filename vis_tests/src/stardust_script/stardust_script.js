// Converted our reagraph csv to json script into a raw js version for this (as we need json in js scripts)
// Parsing just copy-pasted with some tweaks
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

// Given we aren't loading ALL nodes, we need to jump through some hoops
// (as not all edges will appear if most nodes are missing)
// So we'll scan edges first to find which nodes we need

// After reading the metadata, it seems like influence is normal distribution
// So most values are between -8 and +8 (within 2 SD)

// Parse edges
Papa.parse('../../dataset_2/dataset_edges.csv', {
  download: true,
  header: true,
  dynamicTyping: true,
  step: (row, parser) => {
    if (edgesList.length >= 4000) return; // Node cap (as 50k nodes fries my computer)
    
    const row_data = row.data;
    
    // CSV specific features
    const sourceId = String(row_data.source_id);
    const targetId = String(row_data.target_id);
    
    edgesList.push({
      source: sourceId,
      target: targetId,
      influence: row_data.influence,
      derivative: row_data.derivative,
      category: row_data.category
    });
    
    // Track which nodes we need
    neededNodeIds.add(sourceId);
    neededNodeIds.add(targetId);
  },
  complete: () => {
    // NOW when we finish our edges parsing we'll parse nodes
    Papa.parse('../../dataset_2/dataset_nodes.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      step: (row, parser) => {
        const row_data = row.data;
        const nodeId = String(row_data.node_id);
        
        if (neededNodeIds.has(nodeId)) {
            // THESE WERE INDICATED BY THE METADTA (dataset_schema.json)
            // Mass is the normal dist
            // Max_speed is the powerlaw distribution? I honestly dont know what that is 
            
            const nodeMass = row_data.mass || 17;
            const nodeSize = Math.max(5, nodeMass / 2); // Scale mass to visual size
            
            nodeMap.set(nodeId, {
                id: nodeId,
                label: `node_${row_data.node_id}`,
                size: nodeSize,
                fill: row_data.tagged ? '#3B82F6' : '#94A3B8', // if its tagged we'll make it blue, if not, gray
                mass: row_data.mass,
                max_speed: row_data.max_speed,
                tagged: row_data.tagged,
                reactive: row_data.reactive
            });
        }
      },
      complete: () => {
        const finalNodes = Array.from(nodeMap.values());
        
        // Lastly we'll filter edges list to only include nodes we loaded
        const finalEdges = edgesList.filter(edge => nodeMap.has(edge.source) && nodeMap.has(edge.target)).map((edge, idx) => {
            const influence = edge.influence;
            const edgeWidth = 1 + (Math.min(Math.abs(influence), 8) / 8) * 3; // Calculate edge width based on abs influence
            const opacity = 0.4 + (Math.min(Math.abs(influence), 8) / 8) * 0.5; // Opacity based on influence strength

            // Arrow/direction indicator for positive vs negative influence
            // In reagraph we have the arrow property for directed graphs
            return {
                id: `edge_${idx}`,
                source: edge.source,
                target: edge.target,
                fill: categoryColors[edge.category] || '#9CA3AF', // fallback color
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
        
        // Once data is loaded, initialize the visualization
        initVisualization();
      }
    });
  }
});

// Helper function to convert hex color to rgba array as we provide hex values in our vode
function hexToRGBA(hex, alpha = 1){
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b, alpha]
}

function initVisualization() {
  const canvas = document.getElementById("graphCanvas");
  
  // Pan and zoom state
  let transform = { x: 0, y: 0, scale: 1 };
  let isDragging = false;
  let lastMousePos = { x: 0, y: 0 };
  
  // Handle window resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    
    // we won't restart the sim but just rerender
    renderGraph();
  });

  // Basic panning functions

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const scaleFactor = Math.exp(delta);
    
    // Zoom towards mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Adjust transform to zoom towards mouse
    transform.x = mouseX - (mouseX - transform.x) * scaleFactor;
    transform.y = mouseY - (mouseY - transform.y) * scaleFactor;
    transform.scale *= scaleFactor;
    transform.scale = Math.max(0.1, Math.min(10, transform.scale));
    
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

  // Set cursor style (it's funny, as if cursor style doesn't change I know that the window is just EXTREMELY laggy and we didn't just zoom out too far)
  canvas.style.cursor = 'grab';

  const platform = Stardust.platform("webgl-2d", canvas); // Init stardust
  const edgeSpec = Stardust.mark.line(); // Create edge marks
  const edges_mark = Stardust.mark.create(edgeSpec, platform);

  
  const nodeSpec = Stardust.mark.circle(); // Create node marks
  const nodes_mark = Stardust.mark.create(nodeSpec, platform);

  // BAD PART ABOUT STARDUST: IT'S RENDER-ONLY!
  // There are no graph layout calculations integrated within stardust as with graphistry and reagraph
  // We'll just use d3's force-graph calculations, but I'm pretty sure this moves the calculation task onto the single-threaded js even loop itself rather than the gpu

  const simulation = d3.forceSimulation(nodes).force("link", d3.forceLink(edges)
  .id(d => d.id)
  .distance(50)
  .strength(d => Math.abs(d.influence) / 20))
  .force("charge", d3.forceManyBody()
  .strength(d => -30 * (d.mass || 17)))
  .force("center", d3.forceCenter(canvas.width / 2, canvas.height / 2))
  .force("collision", d3.forceCollide()
  .radius(d => d.size + 2))

  // function to apply transform to coords
  function applyTransform(x, y) {
    return [x * transform.scale + transform.x, y * transform.scale + transform.y]
  }

  // function to render the graph
  // we need to make our own animation + rendering as unlike Reagraph/Graphistry, stardust doesn't integrate an animation system into their package
  // in essence stardust is just simpler webgl
  function renderGraph() {
    // Update edge positions and styling with transform
    edges_mark.attr("p1", d => {
        const source = nodes.find(n => n.id === d.source.id || n.id === d.source);
        return source ? applyTransform(source.x, source.y) : [0, 0]});
    edges_mark.attr("p2", d => {
        const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
        return target ? applyTransform(target.x, target.y) : [0, 0]})
    edges_mark.attr("width", d => d.size * transform.scale);
    edges_mark.attr("color", d => hexToRGBA(d.fill, d.opacity));
    
    // update node positions and styling w/ transform
    nodes_mark.attr("center", d => applyTransform(d.x, d.y))
    nodes_mark.attr("radius", d => d.size * transform.scale)
    nodes_mark.attr("color", d => hexToRGBA(d.fill, 1))
    
    // set data
    edges_mark.data(edges);
    nodes_mark.data(nodes);
    
    // render
    platform.clear([0.1, 0.1, 0.1, 1]); // We want a dark background (I was aiming for a Reagraph dark background theme style here)
    edges_mark.render();
    nodes_mark.render();
  }

  // start anim loop, stop ticking when layout alg settles
  simulation.on("tick", () => {
    renderGraph();
  });

  // stop sim after it settles
  setTimeout(() => {
    simulation.stop();
    console.log("Simulation stopped which means the graph is now static!");
  }, 5000); // we stop around 5 seconds
}