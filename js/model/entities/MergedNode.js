// js/model/entities/MergedNode.js
// Merged node representing a linear chain of nodes

import { Node } from './Node.js';

export class MergedNode extends Node {
  constructor(id, data = {}) {
    super(id, data);
    
    // Merged node specific properties
    this.gfaType = 'merged_segment';
    this.mergedFrom = data.mergedFrom || [];
    this.pathName = data.pathName || 'Merged Path';
    
    // Store original nodes and links for sequence reconstruction
    this.originalNodes = data.originalNodes || [];
    this.originalLinks = data.originalLinks || [];
    
    // Calculate combined properties
    this.length = this.calculateTotalLength();
    this.depth = this.calculateAverageDepth();
    this.seq = '*'; // Placeholder, actual sequence reconstructed on export
  }

  /**
   * Calculate total length of merged nodes
   * @returns {number}
   */
  calculateTotalLength() {
    return this.originalNodes.reduce((sum, node) => {
      return sum + (node.length || 1000);
    }, 0);
  }

  /**
   * Calculate average depth of merged nodes
   * @returns {number}
   */
  calculateAverageDepth() {
    if (this.originalNodes.length === 0) return 1.0;
    
    const totalDepth = this.originalNodes.reduce((sum, node) => {
      return sum + (node.depth || 1.0);
    }, 0);
    
    return totalDepth / this.originalNodes.length;
  }

  /**
   * Check if this is a merged node
   * @returns {boolean}
   */
  isMerged() {
    return true;
  }

  /**
   * Get merged node information for display
   * @returns {Object}
   */
  getMergedInfo() {
    return {
      id: this.id,
      type: 'Merged Node',
      originalNodes: this.mergedFrom,
      nodeCount: this.mergedFrom.length,
      totalLength: this.length,
      averageDepth: this.depth,
      pathName: this.pathName,
      canExportSequence: true
    };
  }

  /**
   * Get node type
   * @returns {string}
   */
  getType() {
    return 'merged';
  }

  /**
   * Clone this merged node
   * @returns {MergedNode}
   */
  clone() {
    return new MergedNode(this.id, {
      ...this._data,
      x: this.x,
      y: this.y,
      mergedFrom: [...this.mergedFrom],
      pathName: this.pathName,
      originalNodes: [...this.originalNodes],
      originalLinks: [...this.originalLinks]
    });
  }

  /**
   * Serialize to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      ...super.toJSON(),
      mergedFrom: this.mergedFrom,
      pathName: this.pathName,
      originalNodeCount: this.originalNodes.length,
      totalLength: this.length,
      averageDepth: this.depth
    };
  }
}