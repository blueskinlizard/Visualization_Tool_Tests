import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import { OrthographicView } from '@deck.gl/core';
import { CSVLoader } from '@loaders.gl/csv';
import { load } from '@loaders.gl/core';
import * as d3 from 'd3';

const categoryColors = {
    'yellow': [252, 211, 77],
    'black': [107, 114, 128],
    'green': [52, 211, 153],
    'red': [248, 113, 113]
};

const DeckGLScript = () =>{
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] }); // State to store nodes/edges
  const [loading, setLoading] = useState(true);

  useEffect(() => {loadAndProcessData()}, []);

  const loadAndProcessData = async () =>{

    const edgesList = [];
    const neededNodeIds = new Set();
    const nodeMap = new Map();
      
    // What's good about WebGL is that instead of having to convert to JSON when parsing, it kinda has the ability to parse CSVs themselves.
    // The reason I say "kinda" is because this csv parsing package is part of a separate library, not deckgl, but it is commonly used in deck applications?
    const edgesResponse = await load('../../dataset_2/dataset_edges.csv', CSVLoader, {
        csv: {
            header: true,
            dynamicTyping: true
        }});
    const edgesData = edgesResponse.data || edgesResponse; // I honestly don't know whether to treat the response as an object or array so I'll just add a fallback
      
    // Take first 4k edges (remember don't wanna fry my computer) and track necessary edges (like we do in our Reagraph script)
    edgesData.slice(0, 4000).forEach(row_data =>{ // 4k edges (should be 8k node)
        const sourceId = String(row_data.source_id);
        const targetId = String(row_data.target_id);
        
        edgesList.push({
            source: sourceId,
            target: targetId,
            influence: row_data.influence,
            derivative: row_data.derivative,
            category: row_data.category
        });
        
        // Track which nodes we are gonna actually need in our array
        neededNodeIds.add(sourceId);
        neededNodeIds.add(targetId);
      });

      // Load nodes w/ CSVLoader import
      const nodesResponse = await load('../../dataset_2/dataset_nodes.csv', CSVLoader, {
        csv: {
            header: true,
            dynamicTyping: true
        }});
      const nodesData = nodesResponse.data || nodesResponse; 
      nodesData.forEach(row_data => {
        const nodeId = String(row_data.node_id);
        
        if (neededNodeIds.has(nodeId)) { // Check if our node made it in the "needed list"
          const nodeMass = row_data.mass || 17; // if nan fallback
          const nodeSize = Math.max(5, nodeMass / 2);
          
          nodeMap.set(nodeId, {
            id: nodeId,
            label: `node_${row_data.node_id}`,
            mass: nodeMass,
            size: nodeSize,
            tagged: row_data.tagged,
            reactive: row_data.reactive,
            max_speed: row_data.max_speed,
            x: 0,
            y: 0
        });
    }});

    const nodes = Array.from(nodeMap.values()); // prune that array
      
      // Filter edges to only include nodes we loaded
      const filteredEdges = edgesList.filter(edge => nodeMap.has(edge.source) && nodeMap.has(edge.target));
      
      // Just like with stardust deckgl doesn't have a built-in graph calculation component
      // As a result we'll just use the d3 force layout calculation
      // So we'll prep our nodes for d3's format
      const d3Edges = filteredEdges.map(edge => ({
        source: nodeMap.get(edge.source),
        target: nodeMap.get(edge.target),
        influence: edge.influence,
        category: edge.category,
        derivative: edge.derivative
      }));
      
      // Run the d3 layout calc
      const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(d3Edges)
      .id(d => d.id)
      .distance(50))
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(0, 0))
      .stop();

      // we'll just run the sim manually 300 times
      for (let i = 0; i < 300; i++) {
        simulation.tick();
      }

      // prepare edges w/ positions
      const edges = d3Edges.map((edge, i) =>{
        const source = edge.source;
        const target = edge.target;
        // Just like in reagraph, we;ll set these things to what was described in the dataset_schema.json file
        const influence = edge.influence;
        const width = 1 + (Math.min(Math.abs(influence), 8) / 8) * 3;
        const opacity = 0.4 + (Math.min(Math.abs(influence), 8) / 8) * 0.5;

        return{
            sourcePos: [source.x, source.y, 0],
            targetPos: [target.x, target.y, 0],
            color: [...(categoryColors[edge.category] || [156, 163, 175]), opacity * 255],
            width
        }});
      setGraphData({nodes, edges});
      setLoading(false);
  };

  const layers = [ 
    // I ran into a lot of errors when using orthographic/other projectons
    // To simplify this, I just graphed a separate linelayer and scatterplot layer.
    // Linelayer is for edges, and then scatterplot layer is overlayed (which are the nodes)
    new LineLayer({
        id: 'edges',
        data: graphData.edges,
        getSourcePosition: d => d.sourcePos,
        getTargetPosition: d => d.targetPos,
        getColor: d => d.color,
        getWidth: d => d.width,
        widthMinPixels: 1
    }),
    new ScatterplotLayer({
        id: 'nodes',
        data: graphData.nodes,
        getPosition: d => [d.x, d.y, 0],
        getRadius: d => d.size,
        getFillColor: d => d.tagged ? [59, 130, 246] : [148, 163, 184], // Fallback
        radiusMinPixels: 2,
        radiusMaxPixels: 50
    })
  ]

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}> /*Make sure that canvas is fills our screen */
      {loading && (
        <div>Loading graph</div>
        )}
      <DeckGL views={new OrthographicView()} initialViewState={{target: [0, 0, 0],zoom: 0}} controller={true} layers={layers} style={{background: '#1a1a2e'}}/> 
    </div>
  );
}

export default DeckGLScript;