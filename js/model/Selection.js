import { EventEmitter } from '../core/EventEmitter.js';

export class Selection extends EventEmitter {
  constructor() {
    super();
    this.nodes = new Set();
    this.edges = new Set();
  }

  selectNode(nodeId) {
    this.nodes.add(nodeId);
    this.emit('selection:changed', this.getState());
  }

  deselectNode(nodeId) {
    this.nodes.delete(nodeId);
    this.emit('selection:changed', this.getState());
  }

  selectEdge(edgeIndex) {
    this.edges.add(edgeIndex);
    this.emit('selection:changed', this.getState());
  }

  toggleNode(nodeId) {
    if (this.nodes.has(nodeId)) {
      this.deselectNode(nodeId);
    } else {
      this.selectNode(nodeId);
    }
  }

  clear() {
    const hadSelection = this.nodes.size > 0 || this.edges.size > 0;
    this.nodes.clear();
    this.edges.clear();
    if (hadSelection) {
      this.emit('selection:cleared');
      this.emit('selection:changed', this.getState());
    }
  }

  hasNode(nodeId) {
    return this.nodes.has(nodeId);
  }

  hasEdge(edgeIndex) {
    return this.edges.has(edgeIndex);
  }

  getSelectedNodes() {
    return Array.from(this.nodes);
  }

  getSelectedEdges() {
    return Array.from(this.edges);
  }

  getState() {
    return {
      nodes: this.getSelectedNodes(),
      edges: this.getSelectedEdges()
    };
  }

  isEmpty() {
    return this.nodes.size === 0 && this.edges.size === 0;
  }
}

// ============================================================================
// FILE: js/model/Transform.js
// ============================================================================
export class Transform {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.k = 1; // scale
  }

  set(x, y, k) {
    this.x = x;
    this.y = y;
    this.k = k;
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.k = 1;
  }

  clone() {
    const t = new Transform();
    t.x = this.x;
    t.y = this.y;
    t.k = this.k;
    return t;
  }

  toD3Transform() {
    return { x: this.x, y: this.y, k: this.k };
  }

  fromD3Transform(d3Transform) {
    this.x = d3Transform.x;
    this.y = d3Transform.y;
    this.k = d3Transform.k;
  }

  screenToSimulation(screenX, screenY) {
    return {
      x: (screenX - this.x) / this.k,
      y: (screenY - this.y) / this.k
    };
  }

  simulationToScreen(simX, simY) {
    return {
      x: simX * this.k + this.x,
      y: simY * this.k + this.y
    };
  }
}