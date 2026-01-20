import React from 'react';
import Sidebar from './Sidebar';
import Tutorial from './Tutorial';
import { createRef, MutableRefObject } from 'react';
import Renderer from "../webgpu/render";
import { Form } from 'react-bootstrap';

type PageState = {
    canvasRef: MutableRefObject<HTMLCanvasElement | null>,
    iterRef: MutableRefObject<HTMLLabelElement | null>,
    renderer: Renderer | null,
    renderTutorial: boolean, 
    renderAlert: boolean,
    benchmarks: any | null
}

class Page extends React.Component<{}, PageState> {
    constructor(props: {} | Readonly<{}>) {
        super(props);
        this.state = {
            canvasRef: createRef<HTMLCanvasElement | null>(),
            iterRef: createRef<HTMLLabelElement | null>(),
            renderer: null,
            renderTutorial: false,
            renderAlert: false,
            benchmarks: null
        };
        this.unmountTutorial = this.unmountTutorial.bind(this);
        this.setBenchmarks = this.setBenchmarks.bind(this);
    }

    async componentDidMount() {
        if (!navigator.gpu) {
            alert("GraphWaGu requires WebGPU, which is not currently enabled. You may be using an incompatible web browser or hardware, or have this feature disabled. If you are using Chrome, enable the setting at chrome://flags/#enable-unsafe-webgpu. If you are using Safari, first enable the Developer Menu (Preferences > Advanced), then check Develop > Experimental Features > WebGPU.");
            this.setState({ renderAlert: true });
            return;
        }
        const adapter = (await navigator.gpu.requestAdapter({
            powerPreference: "high-performance",
        }))!;
        if (!adapter) {
            alert("GraphWaGu requires WebGPU, which is not currently enabled. You may be using an incompatible web browser or hardware, or have this feature disabled. If you are using Chrome, enable the setting at chrome://flags/#enable-unsafe-webgpu. If you are using Safari, first enable the Developer Menu (Preferences > Advanced), then check Develop > Experimental Features > WebGPU.");
            this.setState({ renderAlert: true });
            return;
        }
        const device = await adapter.requestDevice({
            requiredLimits: {
                maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
                maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
                maxBufferSize: adapter.limits.maxBufferSize,
                maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
                maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize
            }
        });
        this.setState({
            renderer: new Renderer(
                device, this.state.canvasRef,
                this.state.iterRef)
        });
    }

    setNodeEdgeData(nodeData: Array<number>, edgeData: Array<number>, sourceEdges: Array<number>, targetEdges: Array<number>) {
        this.state.renderer!.setNodeEdgeData(nodeData, edgeData, sourceEdges, targetEdges);
    }

    setIdealLength(value: number) {
        this.state.renderer!.setIdealLength(value);
    }

    setEnergy(value: number) {
        this.state.renderer!.setEnergy(value);
    }

    setTheta(value: number) {
        this.state.renderer!.setTheta(value);
    }

    setCoolingFactor(value: number) {
        this.state.renderer!.setCoolingFactor(value);
    }

    setIterationCount(value: number) {
        this.state.renderer!.setIterationCount(value);
    }

    toggleNodeLayer() {
        this.state.renderer!.toggleNodeLayer();
    }

    toggleEdgeLayer() {
        this.state.renderer!.toggleEdgeLayer();
    }

    runForceDirected() {
        this.state.renderer!.runForceDirected();
    }

    stopForceDirected() {
        this.state.renderer!.stopForceDirected();
    }

    takeScreenshot() {
        this.state.renderer!.takeScreenshot();
    }

    setBenchmarks(benchmarks: any) {
        this.setState({ benchmarks });
    }

    unmountTutorial() {
        this.setState({ renderTutorial: false });
    }

    render() {
        return (
            <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
                {this.state.renderAlert ?
                    <h1 className="header" color='white'>GraphWaGu requires WebGPU, which is not currently enabled. You may be using an incompatible web browser or hardware, or have this feature disabled. If you are using Chrome, enable the setting at chrome://flags/#enable-unsafe-webgpu. If you are using Safari, first enable the Developer Menu (Preferences - Advanced), then check Develop - Experimental Features - WebGPU.</h1> :
                    (
                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                            {this.state.renderTutorial ? <Tutorial unmount={this.unmountTutorial} /> : null}
                            
                            <div style={{ 
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100vw',
                                height: '100vh',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                                margin: 0,
                                padding: 0,
                                zIndex: 0
                            }}>
                                <Form.Label className="h1 header" style={{ 
                                    position: 'absolute',
                                    top: '10px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    pointerEvents: 'auto',
                                    zIndex: 10
                                }}>GraphWaGu</Form.Label>
                                <Form.Label className={"out"} ref={this.state.iterRef} style={{
                                    position: 'absolute',
                                    top: '60px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    pointerEvents: 'auto',
                                    zIndex: 10
                                }}></Form.Label>
                                <canvas 
                                    ref={this.state.canvasRef} 
                                    width={window.innerWidth} 
                                    height={window.innerHeight}
                                    style={{
                                        position: 'fixed',
                                        top: 0,
                                        left: 0,
                                        width: '100vw',
                                        height: '100vh',
                                        maxWidth: 'none',
                                        backgroundColor: 'aliceblue',
                                        pointerEvents: 'auto',
                                        display: 'block',
                                        zIndex: 0
                                    }}
                                ></canvas>
                            </div>
                            
                            <div style={{ position: 'relative', zIndex: 100 }}>
                                <Sidebar
                                    setNodeEdgeData={this.setNodeEdgeData.bind(this)}
                                    setIdealLength={this.setIdealLength.bind(this)}
                                    setEnergy={this.setEnergy.bind(this)}
                                    setTheta={this.setTheta.bind(this)}
                                    setCoolingFactor={this.setCoolingFactor.bind(this)}
                                    setIterationCount={this.setIterationCount.bind(this)}
                                    toggleNodeLayer={this.toggleNodeLayer.bind(this)}
                                    toggleEdgeLayer={this.toggleEdgeLayer.bind(this)}
                                    runForceDirected={this.runForceDirected.bind(this)}
                                    stopForceDirected={this.stopForceDirected.bind(this)}
                                    takeScreenshot={this.takeScreenshot.bind(this)}
                                    setBenchmarks={this.setBenchmarks}
                                />
                            </div>
                                
                            {/* Benchmark Display */}
                            {this.state.benchmarks && (
                                <div style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    background: 'rgba(0,0,0,0.8)',
                                    color: 'white',
                                    padding: '15px',
                                    borderRadius: '8px',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    maxWidth: '300px',
                                    zIndex: 1000
                                }}>
                                    <h3 style={{ margin: '0 0 10px 0' }}>GraphWaGu Benchmarks</h3>
                                    <div>Nodes: {this.state.benchmarks.node_count}</div>
                                    <div>Edges: {this.state.benchmarks.edge_count}</div>
                                    <hr style={{ margin: '10px 0' }} />
                                    <div>Edge Parsing: {this.state.benchmarks.edge_parsing}ms</div>
                                    <div>Node Parsing: {this.state.benchmarks.node_parsing}ms</div>
                                    <div>Data Transform: {this.state.benchmarks.data_transformation}ms</div>
                                    <div>Graph Prep: {this.state.benchmarks.graph_preparation}ms</div>
                                    <hr style={{ margin: '10px 0' }} />
                                    <div><strong>Total: {this.state.benchmarks.total_time}ms</strong></div>
                                </div>
                            )}
                        </div>
                    )
                }
            </div>
        );
    }
}

export default Page;
