import { EventEmitter } from './EventEmitter.js';
import { Graph } from '../model/Graph.js';
import { GfaGraph } from '../model/GfaGraph.js';
import { Selection } from '../model/Selection.js';
import { Transform } from '../model/Transform.js';
import { History } from '../model/History.js';
import { PathCollection } from '../model/PathCollection.js';

export class GraphModel extends EventEmitter {
  constructor() {
    super();
    
    // Main graph
    this.graph = null;
    
    // State components
    this.selection = new Selection();
    this.transform = new Transform();
    this.history = new History();
    this.paths = new PathCollection();
    this.pinnedNodes = new Set();
    
    // Current format
    this.format = 'dot';
    
    // Forward events from components
    this.selection.on('selection:changed', (state) => this.emit('selection:changed', state));
    this.selection.on('selection:cleared', () => this.emit('selection:cleared'));
    this.paths.on('path:added', (path) => this.emit('path:added', path));
    this.paths.on('path:removed', (data) => this.emit('path:removed', data));
    this.paths.on('path:current-changed', (path) => this.emit('path:current-changed', path));
    this.history.on('history:pushed', (state) => this.emit('history:pushed', state));
  }

  /**
   * Load graph from parsed data
   */
  loadGraph(parsedData, format) {
    this.format = format;
    
    // Create appropriate graph type
    this.graph = format === 'gfa' ? new GfaGraph() : new Graph();
    
    // Add nodes
    parsedData.nodes.forEach(nodeData => {
      this.graph.addNode(nodeData);
    });
    
    // Add edges
    parsedData.links.forEach(linkData => {
      this.graph.addEdge(linkData);
    });
    
    // Forward graph events
    this.graph.on('node:added', (node) => this.emit('node:added', node));
    this.graph.on('node:removed', (node) => this.emit('node:removed', node));
    this.graph.on('node:flipped', (node) => this.emit('node:flipped', node));
    this.graph.on('edge:added', (edge) => this.emit('edge:added', edge));
    this.graph.on('edge:removed', (edge) => this.emit('edge:removed', edge));
    
    this.emit('graph:loaded', { graph: this.graph, format: this.format });
  }

  /**
   * Move a node
   */
  moveNode(nodeId, x, y) {
    const node = this.graph.getNode(nodeId);
    if (node) {
      node.move(x, y);
      this.emit('node:moved', node);
    }
  }

  /**
   * Pin/unpin a node
   */
  pinNode(nodeId) {
    const node = this.graph.getNode(nodeId);
    if (node) {
      node.pin();
      this.pinnedNodes.add(nodeId);
      this.emit('node:pinned', node);
    }
  }

  unpinNode(nodeId) {
    const node = this.graph.getNode(nodeId);
    if (node) {
      node.unpin();
      this.pinnedNodes.delete(nodeId);
      this.emit('node:unpinned', node);
    }
  }

  /**
   * Select a node
   */
  selectNode(nodeId) {
    this.selection.clear();
    this.selection.selectNode(nodeId);
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selection.clear();
  }

  /**
   * Flip a GFA node
   */
  flipNode(nodeId) {
    if (this.graph instanceof GfaGraph) {
      return this.graph.flipNode(nodeId);
    }
    return false;
  }

  /**
   * Get graph statistics
   */
  getStats() {
    return {
      ...this.graph.getStats(),
      selectedNodes: this.selection.nodes.size,
      pinnedNodes: this.pinnedNodes.size,
      savedPaths: this.paths.count()
    };
  }

  /**
   * Create history snapshot
   */
  createSnapshot() {
    return {
      nodes: this.graph.getNodesArray().map(n => n.clone()),
      edges: this.graph.edges.map(e => e.clone())
    };
  }

  /**
   * Save current state to history
   */
  pushHistory() {
    const snapshot = this.createSnapshot();
    this.history.push(snapshot);
  }

  /**
   * Undo last operation
   */
  undo() {
    const snapshot = this.history.pop();
    if (snapshot) {
      // Restore graph state
      this.graph.clear();
      snapshot.nodes.forEach(node => this.graph.addNode(node));
      snapshot.edges.forEach(edge => this.graph.addEdge(edge));
      this.emit('graph:restored', snapshot);
    }
  }
}
