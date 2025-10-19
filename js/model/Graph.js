// js/model/Graph.js
// Base Graph class containing nodes and edges

import { EventEmitter } from '../core/EventEmitter.js';
import { Node } from './entities/Node.js';
import { Edge } from './entities/Edge.js';

export class Graph extends EventEmitter {
  constructor() {
    super();
    this.nodes = new Map();
    this.edges = [];
    this.format = 'dot';
  }

  /**
   * Factory method to create nodes (override in subclasses)
   * @param {Object} data - Node data
   * @returns {Node}
   */
  createNode(data) {
    return new Node(data.id, data);
  }

  /**
   * Factory method to create edges (override in subclasses)
   * @param {Object} data - Edge data
   * @returns {Edge}
   */
  createEdge(data) {
    return new Edge(data.source, data.target, data);
  }

  /**
   * Add a node to the graph
   * @param {Node|Object} nodeOrData - Node instance or node data
   * @returns {Node}
   */
  addNode(nodeOrData) {
    const node = nodeOrData instanceof Node 
      ? nodeOrData 
      : this.createNode(nodeOrData);
    
    this.nodes.set(node.id, node);
    this.emit('node:added', node);
    return node;
  }

  /**
   * Remove a node from the graph
   * @param {string|number} id - Node ID
   * @returns {Node|null}
   */
  removeNode(id) {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    // Remove edges connected to this node
    this.edges = this.edges.filter(edge => !edge.involves(id));
    
    this.nodes.delete(id);
    this.emit('node:removed', node);
    return node;
  }

  /**
   * Get a node by ID
   * @param {string|number} id - Node ID
   * @returns {Node|null}
   */
  getNode(id) {
    return this.nodes.get(id) || null;
  }

  /**
   * Add an edge to the graph
   * @param {Edge|Object} edgeOrData - Edge instance or edge data
   * @returns {Edge}
   */
  addEdge(edgeOrData) {
    const edge = edgeOrData instanceof Edge 
      ? edgeOrData 
      : this.createEdge(edgeOrData);
    
    this.edges.push(edge);
    this.emit('edge:added', edge);
    return edge;
  }

  /**
   * Remove an edge from the graph
   * @param {number} index - Edge index
   * @returns {Edge|null}
   */
  removeEdge(index) {
    if (index < 0 || index >= this.edges.length) return null;
    
    const edge = this.edges[index];
    this.edges.splice(index, 1);
    this.emit('edge:removed', edge);
    return edge;
  }

  /**
   * Get all edges involving a node
   * @param {string|number} nodeId - Node ID
   * @returns {Array<{edge: Edge, index: number}>}
   */
  getEdgesForNode(nodeId) {
    const result = [];
    this.edges.forEach((edge, index) => {
      if (edge.involves(nodeId)) {
        result.push({ edge, index });
      }
    });
    return result;
  }

  /**
   * Get edges between two nodes
   * @param {string|number} nodeId1 - First node ID
   * @param {string|number} nodeId2 - Second node ID
   * @returns {Array<{edge: Edge, index: number}>}
   */
  getEdgesBetween(nodeId1, nodeId2) {
    const result = [];
    this.edges.forEach((edge, index) => {
      if (edge.connects(nodeId1, nodeId2)) {
        result.push({ edge, index });
      }
    });
    return result;
  }

  /**
   * Clear all nodes and edges
   */
  clear() {
    this.nodes.clear();
    this.edges = [];
    this.emit('graph:cleared');
  }

  /**
   * Get all nodes as array
   * @returns {Array<Node>}
   */
  getNodesArray() {
    return Array.from(this.nodes.values());
  }

  /**
   * Get graph statistics
   * @returns {Object}
   */
  getStats() {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      format: this.format
    };
  }

  /**
   * Serialize graph to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      format: this.format,
      nodes: this.getNodesArray().map(node => node.toJSON()),
      edges: this.edges.map(edge => edge.toJSON())
    };
  }
}