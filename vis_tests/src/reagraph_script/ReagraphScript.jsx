import React, { useState, useEffect, useRef } from 'react';
import { GraphCanvas, darkTheme} from 'reagraph';
import Papa from 'papaparse';
import { forceAtlas2 } from 'reagraph';

const ReagraphScript = ( {edgeLimit = 4000} ) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  // For tracking
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [renderComplete, setRenderComplete] = useState(false);
  
  // Benchmark tracking
  const timingsRef = useRef({});
  const startTimeRef = useRef(Date.now());
  const [benchmarks, setBenchmarks] = useState({});
  const renderStartRef = useRef(null);

const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    const startEdgeParse = Date.now();
    
    // Given we aren't loading ALL nodes, we need to jump through some hoops
    // (as not all edges will appear if most nodes are missing)
    // So we'll scan edges first to find which nodes we need
    const edgesList = [];
    const neededNodeIds = new Set();
    const nodeMap = new Map();
    const categoryColors = {
      'yellow': '#FCD34D',
      'black': '#6B7280',
      'green': '#34D399',
      'red': '#F87171'
    };
    
    // After reading the metadata, it seems like influence is normal distribution
    // So most values are between -8 and +8 (within 2 SD)

    // Parse edges
    Papa.parse('/dataset_2/dataset_edges.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      step: (row, parser) => {
        if (edgesList.length >= edgeLimit) return; // Node cap (as 50k nodes fries my computer)
        
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
        setEdgeCount((count) => count + 1); // Increment counter
      },
      complete: () => {
        timingsRef.current.edge_parsing = Date.now() - startEdgeParse;
        console.log(`Edge Parsing: ${timingsRef.current.edge_parsing}ms`);
        
        // Benchmark 2: Node Parsing
        const startNodeParse = Date.now();
        
        // NOW when we finish our edges parsing we'll parse nodes
        Papa.parse('/dataset_2/dataset_nodes.csv', {
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
                    reactive: row_data.reactive});
                setNodeCount((count) => count + 1);
            }
          },
          complete: () => {
            timingsRef.current.node_parsing = Date.now() - startNodeParse;
            console.log(`Node Parsing: ${timingsRef.current.node_parsing}ms`);
            
            // Benchmark 3: Data Transformation
            const startTransform = Date.now();
            
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
            
            timingsRef.current.data_transformation = Date.now() - startTransform;
            console.log(`Data Transformation: ${timingsRef.current.data_transformation}ms`);
            
            // If nodes already done, finish loading state
            setNodes(finalNodes);
            setEdges(finalEdges);
            setLoading(false);
            renderStartRef.current = Date.now();
            
            timingsRef.current.total_time = Date.now() - startTimeRef.current;
            console.log(`Total Time: ${timingsRef.current.total_time}ms`);
            
            setBenchmarks({
              ...timingsRef.current,
              node_count: finalNodes.length,
              edge_count: finalEdges.length
            });
          }
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!loading && !renderComplete) {
      const timer = setTimeout(() => {
        const renderTime = Date.now() - startTimeRef.current;
        timingsRef.current.render_complete = renderTime;
        console.log(`Render Complete (fallback): ${renderTime}ms`);
        setRenderComplete(true);
        setBenchmarks(prev => ({
          ...prev,
          render_complete: renderTime
        }));
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [loading, renderComplete]);

  if (loading) {
    return (
      <div>
        <p>Loading graph data...</p>
        <p>Nodes loaded: {nodeCount}</p>
        <p>Edges loaded: {edgeCount}</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <GraphCanvas 
        nodes={nodes} 
        edges={edges}  // What's soooo good about Reagraph is that ALL you have to do is plug in a graph type and it does it for you
        layout={forceAtlas2} // That above comment is kinda wrong as for a lot of layouts you need some calculatable x/y positions, but for force graph it's fine!
        theme={darkTheme}
        onLayoutChange={(layout) => {
          if (!renderComplete) {
            const renderTime = Date.now() - startTimeRef.current;
            timingsRef.current.render_complete = renderTime;
            console.log(`Render Complete: ${renderTime}ms`);
            setRenderComplete(true);
            setBenchmarks(prev => ({
              ...prev,
              render_complete: renderTime
            }));
          }
        }}
      />
      
      <div style={{position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.8)',color: 'white',
      padding: '15px', borderRadius: '8px', fontFamily: 'monospace',
      fontSize: '12px', maxWidth: '300px'}}>
        <h3 style={{ margin: '0 0 10px 0' }}>Reagraph Benchmarks</h3>
        <div>Nodes: {benchmarks.node_count}</div>
        <div>Edges: {benchmarks.edge_count}</div>
        <hr style={{ margin: '10px 0' }} />
        <div>Edge Parsing: {benchmarks.edge_parsing}ms</div>
        <div>Node Parsing: {benchmarks.node_parsing}ms</div>
        <div>Data Transform: {benchmarks.data_transformation}ms</div>
        <div>Data Prep Total: {benchmarks.total_time}ms</div>
        <hr style={{ margin: '10px 0' }} />
        <div><strong>Full Render: {benchmarks.render_complete || 'calculating...'}ms</strong></div>
      </div>
    </div>
  );
};

export default ReagraphScript;