// js/core/GraphController.js
import { DotParser } from '../utils/parsers/DotParser.js';
import { GfaParser } from '../utils/parsers/GfaParser.js';

export class GraphController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    
    // Setup all event listeners
    this.setupViewListeners();
    this.setupModelListeners();
  }
  
  setupViewListeners() {
    // File loading
    this.view.on('file:selected', async ({ file }) => {
      try {
        const content = await file.text();
        this.loadGraph(content, file.name);
      } catch (error) {
        console.error('Error loading file:', error);
        alert(`Error loading file: ${error.message}`);
      }
    });
    
    // Button clicks
    this.view.on('button:generateRandom', () => this.generateRandomGraph());
    this.view.on('button:pinNode', () => this.pinSelectedNodes());
    this.view.on('button:flipNode', () => this.flipSelectedNodes());
    this.view.on('button:removeNodes', () => this.removeSelectedNodes());
    this.view.on('button:undo', () => this.model.undo());
    this.view.on('button:resetView', () => this.resetView());
    this.view.on('button:redraw', () => this.redrawLayout());
    
    // Canvas interactions - USING ORIGINAL LOGIC
    this.view.on('canvas:pointerdown', ({ canvasX, canvasY, event }) => {
      this.handleCanvasPointerDown(canvasX, canvasY, event);
    });
    
    this.view.on('canvas:pointermove', ({ canvasX, canvasY, event }) => {
      this.handleCanvasPointerMove(canvasX, canvasY, event);
    });
    
    this.view.on('canvas:pointerup', () => {
      this.handleCanvasPointerUp();
    });
    
    this.view.on('canvas:click', ({ canvasX, canvasY, event }) => {
      this.handleCanvasClick(canvasX, canvasY, event);
    });
    
    this.view.on('canvas:resized', ({ width, height }) => {
      // Update force simulation center
      if (this.model.simulation) {
        this.model.simulation.force('center', 
          window.d3.forceCenter(width / 2, height / 2)
        );
      }
      this.view.render();
    });
  }
  
  setupModelListeners() {
    // Redraw on any model change
    this.model.on('graph:loaded', () => this.view.render());
    this.model.on('node:moved', () => this.view.render());
    this.model.on('node:added', () => this.view.render());
    this.model.on('node:removed', () => this.view.render());
    this.model.on('selection:changed', () => this.view.render());
    this.model.on('graph:changed', () => this.view.render());
  }
  
  // ORIGINAL LOGIC: Convert screen coordinates to simulation coordinates
  screenToSim(px, py) {
    const transform = this.model.transform;
    return {
      x: (px - transform.x) / transform.k,
      y: (py - transform.y) / transform.k
    };
  }
  
  // ORIGINAL LOGIC: Hit test for node at position
  findNodeAt(simX, simY) {
    const graph = this.model.getGraph();
    if (!graph) return null;
    
    // For GFA format, use GFA node contains method
    if (graph.format === 'gfa' && graph._gfaNodes) {
      for (let i = 0; i < graph._gfaNodes.length; i++) {
        const gfaNode = graph._gfaNodes[i];
        if (gfaNode && gfaNode.contains(simX, simY)) {
          const node = graph.getNode(gfaNode.id);
          return node;
        }
      }
    } else {
      // For DOT format, use circular hit detection
      let minDist = Infinity;
      let foundNode = null;
      
      graph.nodes.forEach(node => {
        const dx = node.x - simX;
        const dy = node.y - simY;
        const dist2 = dx * dx + dy * dy;
        const radius = node.penwidth ? 4 + parseFloat(node.penwidth) : 8;
        
        if (dist2 < radius * radius && dist2 < minDist) {
          minDist = dist2;
          foundNode = node;
        }
      });
      
      return foundNode;
    }
    
    return null;
  }
  
  // ORIGINAL LOGIC: Handle pointer down for dragging
  handleCanvasPointerDown(canvasX, canvasY, event) {
    const { x, y } = this.screenToSim(canvasX, canvasY);
    const node = this.findNodeAt(x, y);
    
    if (node) {
      // Start dragging
      this.dragNode = node;
      this.view.canvasManager.startDrag(node);
      
      // Set simulation target
      if (this.model.simulation) {
        this.model.simulation.alphaTarget(0.3).restart();
      }
      
      // Set fixed position
      node.fx = x;
      node.fy = y;
      
      event.preventDefault();
    }
  }
  
  // ORIGINAL LOGIC: Handle pointer move for dragging
  handleCanvasPointerMove(canvasX, canvasY, event) {
    if (!this.dragNode) return;
    
    const { x, y } = this.screenToSim(canvasX, canvasY);
    this.dragNode.fx = x;
    this.dragNode.fy = y;
    
    event.preventDefault();
  }
  
  // ORIGINAL LOGIC: Handle pointer up to end drag
  handleCanvasPointerUp() {
    if (!this.dragNode) return;
    
    this.dragNode.fx = null;
    this.dragNode.fy = null;
    
    if (this.model.simulation) {
      this.model.simulation.alphaTarget(0);
    }
    
    this.dragNode = null;
  }
  
  // ORIGINAL LOGIC: Handle click for selection
  handleCanvasClick(canvasX, canvasY, event) {
    const { x, y } = this.screenToSim(canvasX, canvasY);
    const node = this.findNodeAt(x, y);
    
    if (node) {
      this.model.selectNode(node.id);
      
      // Show node info in panel
      this.updateInfoPanel(node);
    } else {
      this.model.clearSelection();
      this.updateInfoPanel(null);
    }
  }
  
  updateInfoPanel(node) {
    const infoContent = document.getElementById('infoContent');
    if (!infoContent) return;
    
    if (node) {
      let html = `<strong>Node ${node.id}</strong><br>`;
      
      // Check if merged node
      if (node.gfaType === 'merged_segment' && node.mergedFrom) {
        html += `<br><em>Type: Merged Node</em>`;
        html += `<br><em>Merged from: ${node.mergedFrom.join(', ')}</em>`;
        html += `<br><em>Original nodes: ${node.mergedFrom.length}</em>`;
        html += `<br><em>Total length: ${node.length}bp</em>`;
        html += `<br><em>Path: ${node.pathName || 'N/A'}</em>`;
      } else {
        // Regular node info
        const graph = this.model.getGraph();
        if (graph && graph.format === 'gfa') {
          const gfaNode = graph._gfaNodes?.find(n => n.id === node.id);
          if (gfaNode) {
            html += `<br><em>Flipped: ${gfaNode.isFlipped ? 'Yes' : 'No'}</em>`;
            html += `<br><em>Angle: ${(gfaNode.angle * 180 / Math.PI).toFixed(1)}°</em>`;
          }
        }
        
        html += `<pre>${JSON.stringify(node, null, 2)}</pre>`;
      }
      
      infoContent.innerHTML = html;
    } else {
      infoContent.innerHTML = 'Select a node or edge to see details here.';
    }
  }
  
  loadGraph(content, filename) {
    try {
      // Determine format
      let format = filename.toLowerCase().endsWith('.gfa') ? 'gfa' : 'dot';
      if (format === 'dot' && (/^H\t|^S\t/m).test(content)) {
        console.log('Detected GFA content despite .dot extension');
        format = 'gfa';
      }
      
      // Parse graph
      const parser = format === 'gfa' ? new GfaParser() : new DotParser();
      const parsedData = parser.parse(content);
      
      // Load into model
      this.model.loadGraph(parsedData, format);
      
      // Update UI for format
      if (window.updateUIForFormat) {
        window.updateUIForFormat(format);
      }
      
      console.log(`Loaded ${format} graph: ${parsedData.nodes.length} nodes, ${parsedData.links.length} edges`);
    } catch (error) {
      console.error('Error parsing graph:', error);
      alert(`Error parsing graph: ${error.message}`);
    }
  }
  
  generateRandomGraph() {
    const nodes = [];
    const links = [];
    
    for (let i = 0; i < 50; i++) {
      nodes.push({ id: i });
    }
    
    for (let i = 0; i < 49; i++) {
      links.push({ source: i, target: i + 1 });
    }
    
    this.model.loadGraph({ nodes, links }, 'dot');
    
    if (window.updateUIForFormat) {
      window.updateUIForFormat('dot');
    }
  }
  
  pinSelectedNodes() {
    const selection = this.model.getSelection();
    const graph = this.model.getGraph();
    
    if (selection.size === 0) {
      console.log('No nodes selected to pin');
      return;
    }
    
    selection.forEach(nodeId => {
      const node = graph.getNode(nodeId);
      if (node) {
        node.fx = node.x;
        node.fy = node.y;
        this.model.pinnedNodes.add(nodeId);
      }
    });
    
    if (this.model.simulation) {
      this.model.simulation.alpha(0.1).restart();
    }
    
    this.view.render();
  }
  
  flipSelectedNodes() {
    const graph = this.model.getGraph();
    if (!graph || graph.format !== 'gfa') {
      console.log('Node flipping only available for GFA graphs');
      return;
    }
    
    const selection = this.model.getSelection();
    if (selection.size === 0) {
      console.log('No nodes selected for flipping');
      return;
    }
    
    selection.forEach(nodeId => {
      const gfaNode = graph._gfaNodes?.find(n => n.id === nodeId);
      if (gfaNode && typeof gfaNode.flip === 'function') {
        gfaNode.flip();
      }
    });
    
    if (this.model.simulation) {
      this.model.simulation.alpha(0.1).restart();
    }
    
    this.view.render();
  }
  
  removeSelectedNodes() {
    const selection = this.model.getSelection();
    if (selection.size === 0) return;
    
    // Store current state for undo
    this.model.pushHistory();
    
    // Remove nodes
    selection.forEach(nodeId => {
      this.model.removeNode(nodeId);
    });
    
    this.model.clearSelection();
  }
  
  resetView() {
    this.model.transform.reset();
    this.view.render();
  }
  
  redrawLayout() {
    if (this.model.simulation) {
      this.model.simulation.alpha(1).restart();
    }
  }
}