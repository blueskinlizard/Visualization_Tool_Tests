import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { Graph} from '@cosmos.gl/graph';

const categoryColors = {
  'yellow': '#fcd34d',
  'black': '#6b7280',
  'green': '#34d399',
  'red': '#f87171'
};

const CosmosGLBenchmark = ({ edgeLimit = 4000 }) => {
  const [loading, setLoading] = useState(true);
  const [benchmarks, setBenchmarks] = useState({});
  const containerRef = useRef();
  const graphRef = useRef(null);

  const timingsRef = useRef({});
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.destroy();
      graphRef.current = null;
    }
    loadAndProcessData();
  }, [edgeLimit]);


  const loadAndProcessData = async () => {
    // Benchmark 1: Edge Loading & Parsing
    const startEdgeParse = Date.now();

    const edgesList = [];
    const neededNodeIds = new Set();
    const nodeMap = new Map();
      
    await new Promise((resolve) => {
      Papa.parse('/dataset_2/dataset_edges.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        step: (row) => {
          if (edgesList.length >= edgeLimit) return;
          
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
          resolve();
        }
      });
    });
    
    timingsRef.current.edge_parsing = Date.now() - startEdgeParse;
    console.log(`Edge Parsing: ${timingsRef.current.edge_parsing}ms`);

    // Benchmark 2: Node Loading & Parsing
    const startNodeParse = Date.now();

    await new Promise((resolve) => {
      let indexCounter = 0;
      Papa.parse('/dataset_2/dataset_nodes.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        step: (row, parser) => {
          const row_data = row.data;
          const nodeId = String(row_data.node_id);
          
          if (neededNodeIds.has(nodeId)) {
            const nodeMass = row_data.mass || 17;
            const nodeSize = Math.max(5, nodeMass / 2);
            nodeMap.set(nodeId, {
              id: nodeId,
              index: indexCounter++,
              label: `node_${row_data.node_id}`,
              mass: nodeMass,
              size: nodeSize,
              tagged: row_data.tagged,
              reactive: row_data.reactive,
              max_speed: row_data.max_speed
            });
          }
          
          if (nodeMap.size === neededNodeIds.size) {
            console.log(`Aborting after finding all ${nodeMap.size} nodes`);
            parser.abort();
          }
        },
        complete: () => {
          resolve();
        }
      });
    });

    const nodes = Array.from(nodeMap.values());
    
    const nodeIdToIndex = {};
    nodes.forEach((node) => {
      nodeIdToIndex[node.id] = node.index;
    });
    
    timingsRef.current.node_parsing = Date.now() - startNodeParse;
    console.log(`Node Parsing: ${timingsRef.current.node_parsing}ms`);
      
    // Benchmark 3: Data Transformation
    const startTransform = Date.now();
    const filteredEdges = edgesList.filter(edge => 
      nodeMap.has(edge.source) && nodeMap.has(edge.target)
    );

    timingsRef.current.data_transformation = Date.now() - startTransform;
    console.log(`Data Transformation: ${timingsRef.current.data_transformation}ms`);
      
    // Benchmark 4: Graph Preparation for Cosmos.gl
    const startGraphPrep = Date.now();
    
    const links = new Float32Array(filteredEdges.length * 2); // Create Float32Array for links (source, target pairs), as Cosmos requires it in Float32 type
    filteredEdges.forEach((edge, i) => {
      links[i * 2] = nodeIdToIndex[edge.source];
      links[i * 2 + 1] = nodeIdToIndex[edge.target];
    });
    
    const linkColors = new Float32Array(filteredEdges.length * 4); 
    filteredEdges.forEach((edge, i) => {
      const hex = categoryColors[edge.category] || '#9ca3af'; 
      const r = parseInt(hex.slice(1, 3), 16) / 255; // Convert hex to RGB
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const influence = edge.influence; 
      const a = 0.4 + (Math.min(Math.abs(influence), 8) / 8) * 0.5; 
      linkColors[i * 4] = r;
      linkColors[i * 4 + 1] = g;
      linkColors[i * 4 + 2] = b;
      linkColors[i * 4 + 3] = a;
    });

    
    const linkWidths = new Float32Array(filteredEdges.length);
    filteredEdges.forEach((edge, i) => {
      const influence = edge.influence;
      linkWidths[i] = 1 + (Math.min(Math.abs(influence), 8) / 8) * 3;
    });
    
    const nodeColors = new Float32Array(nodes.length * 4);
    nodes.forEach((node, i) => {
      const hex = node.tagged ? '#3b82f6' : '#94a3b8';
      nodeColors[i * 4] = parseInt(hex.slice(1, 3), 16) / 255;
      nodeColors[i * 4 + 1] = parseInt(hex.slice(3, 5), 16) / 255;
      nodeColors[i * 4 + 2] = parseInt(hex.slice(5, 7), 16) / 255;
      nodeColors[i * 4 + 3] = 1.0; 
    });
    
    timingsRef.current.graph_preparation = Date.now() - startGraphPrep;
    console.log(`Graph Preparation: ${timingsRef.current.graph_preparation}ms`);
    
    // Benchmark 5: Graph Initialization and Rendering
    const startRender = Date.now();
    
    const config = {
      spaceSize: 4096,
      backgroundColor: '#1a1a2e', 
      nodeColor: nodeColors,
      nodeSize: nodes.map(n => n.size),
      scaleNodesOnZoom: true,
      linkColor: linkColors,
      linkWidth: linkWidths,
      linkArrows: false,
      simulation: false, 
      fitViewDelay: 1000,
      fitViewPadding: 0.3,
      rescalePositions: true,
      enableDrag: false,
      onNodeClick: (nodeIndex) => {
        console.log('Clicked node index:', nodeIndex, nodes[nodeIndex]);
      },
      onBackgroundClick: () => {
        console.log('Clicked background');
      },
      showFPSMonitor: true
    };

    graphRef.current = new Graph(containerRef.current, config);

    const positions = new Float32Array(nodes.length * 2);
    for (let i = 0; i < nodes.length; i++) {
      positions[i * 2] = Math.random() * 4096;   
      positions[i * 2 + 1] = Math.random() * 4096; 
    }
    graphRef.current.setPointPositions(positions);

    console.log('links', links.length, 'linkColors', linkColors.length, 'linkWidths', linkWidths.length);
    if (linkColors.length / 4 !== linkWidths.length || linkWidths.length !== links.length / 2) {
      console.error('Link array lengths do not match!');
    }
    graphRef.current.setLinks(links);

    graphRef.current.setLinkColors(linkColors);
    graphRef.current.setLinkWidths(linkWidths);

    graphRef.current.render();
    setTimeout(() => {
      graphRef.current.pause();
    }, 30000); // Pause sim after this amount of time... If we don't pause it will keep moving forever
    
    timingsRef.current.render_init = Date.now() - startRender;
    console.log(`Render Init: ${timingsRef.current.render_init}ms`);
    
    setLoading(false);
    
    timingsRef.current.total_time = Date.now() - startTimeRef.current;
    console.log(`Total Time: ${timingsRef.current.total_time}ms`);
    
    setBenchmarks({
      ...timingsRef.current,
      node_count: nodes.length,
      edge_count: filteredEdges.length
    });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      {loading && (
        <div style={{ 
          padding: '20px', 
          color: 'white', 
          background: '#1a1a2e',
          fontSize: '16px' 
        }}>
          Loading graph data...
        </div>
      )}
      <div 
        ref={containerRef}
        style={{ width: '100%', height: '100%', background: '#1a1a2e' }}
      />
      {!loading && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '12px',
          maxWidth: '300px',
          zIndex: 1000
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Cosmos.gl Static Graph</h3>
          <div>Nodes: {benchmarks.node_count}</div>
          <div>Edges: {benchmarks.edge_count}</div>
          <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #444' }} />
          <div>Edge Parsing: {benchmarks.edge_parsing}ms</div>
          <div>Node Parsing: {benchmarks.node_parsing}ms</div>
          <div>Data Transform: {benchmarks.data_transformation}ms</div>
          <div>Graph Prep: {benchmarks.graph_preparation}ms</div>
          <div>Render Init: {benchmarks.render_init}ms</div>
          <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #444' }} />
          <div><strong>Total: {benchmarks.total_time}ms</strong></div>
        </div>
      )}
    </div>
  );
};

export default CosmosGLBenchmark;
