// js/model/GfaGraph.js
// GFA-specific graph with orientation support

import { Graph } from './Graph.js';
import { GfaNode } from './entities/GfaNode.js';
import { GfaEdge } from './entities/GfaEdge.js';

export class GfaGraph extends Graph {
  constructor() {
    super();
    this.format = 'gfa';
  }

  /**
   * Override factory to create GFA nodes
   * @param {Object} data - Node data
   * @returns {GfaNode}
   */
  createNode(data) {
    return new GfaNode(data.id, data);
  }

  /**
   * Override factory to create GFA edges
   * @param {Object} data - Edge data
   * @returns {GfaEdge}
   */
  createEdge(data) {
    return new GfaEdge(data.source, data.target, data);
  }

  /**
   * Flip a node
   * @param {string|number} nodeId - Node ID
   * @returns {boolean} Success
   */
  flipNode(nodeId) {
    const node = this.getNode(nodeId);
    if (node instanceof GfaNode) {
      node.flip();
      this.emit('node:flipped', node);
      return true;
    }
    return false;
  }

  /**
   * Get all GFA nodes (for rendering)
   * @returns {Array<GfaNode>}
   */
  getGfaNodes() {
    return this.getNodesArray().filter(node => node instanceof GfaNode);
  }
}