// js/model/entities/GfaEdge.js
// GFA-specific edge with orientations

import { Edge } from './Edge.js';

export class GfaEdge extends Edge {
  constructor(source, target, data = {}) {
    super(source, target, data);
    
    // GFA-specific properties
    this.srcOrientation = data.srcOrientation || '+';
    this.tgtOrientation = data.tgtOrientation || '+';
    this.overlap = data.overlap || '0M';
    this.gfaType = data.gfaType || 'link';
    this.viaPath = data.viaPath || null;
  }

  /**
   * Get edge type
   * @returns {string}
   */
  getType() {
    return 'gfa';
  }

  /**
   * Clone this GFA edge
   * @returns {GfaEdge}
   */
  clone() {
    return new GfaEdge(this.source, this.target, {
      ...this._data,
      srcOrientation: this.srcOrientation,
      tgtOrientation: this.tgtOrientation,
      overlap: this.overlap,
      gfaType: this.gfaType
    });
  }

  /**
   * Serialize to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      ...super.toJSON(),
      srcOrientation: this.srcOrientation,
      tgtOrientation: this.tgtOrientation,
      overlap: this.overlap,
      gfaType: this.gfaType
    };
  }
}