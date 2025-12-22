import pandas as pd 
import graphistry 
import os
import time
import json
from dotenv import load_dotenv

# Benchmark tracking
timings = {}
start_total = time.time()

# Benchmark 1: CSV Loading
start_load = time.time()
load_dotenv()
graphistry.register(api=3, server='hub.graphistry.com', 
                   username=os.getenv("GRAPHISTRY_USER"), 
                   password=os.getenv("GRAPHISTRY_PASS"))
nodes_df = pd.read_csv('../../dataset_2/dataset_nodes.csv')
edges_df = pd.read_csv('../../dataset_2/dataset_edges.csv')
timings['csv_loading'] = time.time() - start_load
print(f"CSV Loading: {timings['csv_loading']:.3f}s")

# Benchmark 2: Data Filtering
start_filter = time.time()
edges_df = edges_df.iloc[:49000].copy() # Dont want to load ALL nodes to not fry my computer (node amount is 2x edge amount)
# Type conversion
needed_node_ids = set(edges_df['source_id'].astype(str)) | set(edges_df['target_id'].astype(str))
nodes_df['node_id'] = nodes_df['node_id'].astype(str)
# Filters nodes based on their "necessary" determination by edges (so that all displayed nodes are connected to at least one other node in some way)
filtered_nodes = nodes_df[nodes_df['node_id'].isin(needed_node_ids)].copy()
timings['data_filtering'] = time.time() - start_filter
print(f"Data Filtering: {timings['data_filtering']:.3f}s")

# Benchmark 3: Data Transformation
start_transform = time.time()
category_colors = {
    'yellow': '#FCD34D',
    'black':  '#6B7280',
    'green':  '#34D399',
    'red':    '#F87171'
    }
filtered_nodes['size'] = filtered_nodes['mass'].apply(lambda m: max(5, m / 2) * 0.2) # 0.2 added because nodes were egregiously large on graphistry (just applies size calcs done in reagraph script)
filtered_nodes['color'] = filtered_nodes['tagged'].apply(lambda tagged: '#3B82F6' if tagged else '#94A3B8') # Tagged color assignment w/ fallback color
filtered_nodes['label'] = filtered_nodes['node_id'].apply(lambda nid: f'node_{nid}') # Generic label
# Formulas applied here followed same methodology as in reagraph script, which looked toward dataset_2/dataset_schema.json on determining changes to apply to nodes/edges
def edge_width_val(influence): 
    clamped = min(abs(influence), 8)
    return 1 + (clamped / 8) * 3
def edge_opacity_val(influence):
    clamped = min(abs(influence), 8)
    return 0.4 + (clamped / 8) * 0.5
edges_df['computed_width']   = edges_df['influence'].apply(edge_width_val)
edges_df['computed_opacity'] = edges_df['influence'].apply(edge_opacity_val)
edges_df['edge_color'] = edges_df['category'].map(category_colors).fillna('#9CA3AF') # Fallback color
edges_df['edge_label'] = edges_df['category']
timings['data_transformation'] = time.time() - start_transform
print(f"Data Transformation: {timings['data_transformation']:.3f}s")

# Benchmark 4: Graph Building
start_build = time.time()
g = (graphistry.bind( # General setting stuff (suprisingly the hardest part as the docs were somewhat vague on how to do this)
    source='source_id',
    destination='target_id',
    node='node_id',
    point_title="label",
    edge_title="edge_label",
    edge_weight="computed_width",
    edge_opacity="computed_opacity")
    .nodes(filtered_nodes)
    .edges(edges_df)
    .encode_point_color("color")
    .encode_point_size("size")
    .encode_edge_color("edge_color"))
timings['graph_building'] = time.time() - start_build
print(f"Graph Building: {timings['graph_building']:.3f}s")

# Benchmark 5: Plot Upload
start_plot = time.time()
g.plot()
timings['plot_upload'] = time.time() - start_plot
print(f"Plot Upload: {timings['plot_upload']:.3f}s")

# Total time
timings['total_time'] = time.time() - start_total

# Summary
print("Graphistry Results SUmmmary")
print(f"Nodes: {len(filtered_nodes)}")
print(f"Edges: {len(edges_df)}")
for key, value in timings.items():
    print(f"{key}: {value:.3f}s")

print("\nResults saved to graphistry_benchmark_results.json")


