// SequenceExporter.js - Operation for exporting DNA sequences from paths

import { Operation } from './Operation.js';

/**
 * SequenceExporter reconstructs and exports DNA sequences from paths.
 * Handles orientation, overlaps, and sequence merging.
 */
export class SequenceExporter extends Operation {
  constructor(path, graph) {
    super('SequenceExporter', `Export sequence for path: ${path.name}`);

    this.path = path;
    this.graph = graph;

    this.reconstructedSequence = '';
    this.diagnostics = [];
    this.htmlOutput = '';
  }

  /**
   * Validate if export can be performed
   */
  validate() {
    if (!this.path || !this.path.sequence) {
      throw new Error('Invalid path data');
    }

    const nodeIds = this.path.sequence.split(',').map(id => id.trim());
    if (nodeIds.length === 0) {
      throw new Error('Path contains no nodes');
    }

    return true;
  }

  /**
   * Execute sequence export
   */
  execute() {
    this.validate();

    const nodeIds = this.path.sequence.split(',').map(id => id.trim());
    const nodes = nodeIds.map(id => this.graph.getNode(id)).filter(n => n);

    if (nodes.length === 0) {
      throw new Error('No valid nodes found in path');
    }

    // Reconstruct sequence
    this.reconstructedSequence = this.reconstructSequence(nodes);

    // Generate HTML output
    this.htmlOutput = this.generateHTML(nodes);

    // Download HTML file
    this.downloadHTML();

    this.markExecuted();

    return {
      success: true,
      sequenceLength: this.reconstructedSequence.length,
      nodeCount: nodes.length,
      diagnostics: this.diagnostics
    };
  }

  /**
   * Reverse operation (not applicable for export)
   */
  reverse() {
    // Export operations cannot be reversed
    this.markReversed();
  }

  /**
   * Reconstruct sequence from nodes
   */
  reconstructSequence(nodes) {
    if (nodes.length === 0) return '';
    if (nodes.length === 1) {
      const node = nodes[0];
      return this.getNodeSequence(node, '+');
    }

    let fullSequence = '';
    const segments = [];

    // Process each node
    for (let i = 0; i < nodes.length; i++) {
      const currentNode = nodes[i];
      const nextNode = nodes[i + 1] || null;

      let orientation = '+';
      let nodeSeq = this.getNodeSequence(currentNode, orientation);

      if (i === 0) {
        // First node - determine orientation from link to next
        if (nextNode) {
          const linkInfo = this.findLinkBetween(currentNode, nextNode);
          if (linkInfo) {
            orientation = linkInfo.srcOrientation || '+';
            nodeSeq = this.getNodeSequence(currentNode, orientation);
          }
        }

        fullSequence = nodeSeq;
        segments.push({
          nodeId: currentNode.id,
          orientation,
          length: nodeSeq.length,
          overlap: 0
        });
      } else {
        // Subsequent nodes - find link and merge with overlap
        const prevNode = nodes[i - 1];
        const linkInfo = this.findLinkBetween(prevNode, currentNode);

        if (linkInfo) {
          orientation = linkInfo.tgtOrientation || '+';
          nodeSeq = this.getNodeSequence(currentNode, orientation);

          const overlapLength = linkInfo.overlapLength || 0;

          if (overlapLength > 0 && overlapLength < nodeSeq.length) {
            // Merge with overlap
            const mergedSeq = nodeSeq.substring(overlapLength);
            fullSequence += mergedSeq;

            segments.push({
              nodeId: currentNode.id,
              orientation,
              length: mergedSeq.length,
              overlap: overlapLength
            });
          } else {
            // No overlap or invalid overlap
            fullSequence += nodeSeq;

            segments.push({
              nodeId: currentNode.id,
              orientation,
              length: nodeSeq.length,
              overlap: 0
            });
          }
        } else {
          // No link found - just append
          fullSequence += nodeSeq;

          segments.push({
            nodeId: currentNode.id,
            orientation: '+',
            length: nodeSeq.length,
            overlap: 0
          });

          this.diagnostics.push(`No link found between ${prevNode.id} and ${currentNode.id}`);
        }
      }
    }

    this.segments = segments;
    return fullSequence;
  }

  /**
   * Get node sequence with orientation
   */
  getNodeSequence(node, orientation) {
    if (node.seq && node.seq !== '*') {
      if (orientation === '-') {
        return this.reverseComplement(node.seq);
      }
      return node.seq;
    }

    // No sequence available - return placeholder
    return 'N'.repeat(node.length || 1000);
  }

  /**
   * Reverse complement of DNA sequence
   */
  reverseComplement(seq) {
    const complement = {
      'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
      'a': 't', 't': 'a', 'g': 'c', 'c': 'g',
      'N': 'N', 'n': 'n'
    };

    return seq.split('').reverse().map(base => complement[base] || base).join('');
  }

  /**
   * Find link between two nodes
   */
  findLinkBetween(node1, node2) {
    const edges = this.graph.getEdges();

    for (const edge of edges) {
      const srcId = edge.getSourceId();
      const tgtId = edge.getTargetId();

      if (srcId === node1.id && tgtId === node2.id) {
        return {
          srcOrientation: edge.srcOrientation || '+',
          tgtOrientation: edge.tgtOrientation || '+',
          overlap: edge.overlap,
          overlapLength: this.parseOverlap(edge.overlap)
        };
      }

      // Check reverse direction
      if (srcId === node2.id && tgtId === node1.id) {
        return {
          srcOrientation: edge.tgtOrientation || '+',
          tgtOrientation: edge.srcOrientation || '+',
          overlap: edge.overlap,
          overlapLength: this.parseOverlap(edge.overlap)
        };
      }
    }

    return null;
  }

  /**
   * Parse CIGAR overlap string
   */
  parseOverlap(overlap) {
    if (!overlap) return 0;

    const match = overlap.match(/(\d+)M/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Generate HTML output
   */
  generateHTML(nodes) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.path.name} - Sequence</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      margin: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .sequence {
      background: white;
      padding: 20px;
      border-radius: 5px;
      word-wrap: break-word;
      line-height: 1.5;
    }
    .segment {
      display: inline;
      padding: 2px 4px;
      margin: 0 1px;
    }
    .diagnostics {
      background: white;
      padding: 20px;
      border-radius: 5px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.path.name}</h1>
    <p>Total Length: ${this.reconstructedSequence.length.toLocaleString()} bp</p>
    <p>Node Count: ${nodes.length}</p>
    <p>Path: ${nodes.map(n => n.id).join(' → ')}</p>
  </div>

  <div class="sequence">
    <h2>Reconstructed Sequence</h2>
    <div style="word-break: break-all;">
${this.formatSequenceHTML()}
    </div>
  </div>

  ${this.diagnostics.length > 0 ? `
  <div class="diagnostics">
    <h2>Diagnostics</h2>
    <ul>
      ${this.diagnostics.map(d => `<li>${d}</li>`).join('\n      ')}
    </ul>
  </div>
  ` : ''}
</body>
</html>`;

    return html;
  }

  /**
   * Format sequence with color-coded segments
   */
  formatSequenceHTML() {
    if (!this.segments) return this.reconstructedSequence;

    let html = '';
    const colors = ['#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0', '#fce4ec'];
    let colorIndex = 0;

    this.segments.forEach(segment => {
      const color = colors[colorIndex % colors.length];
      const orientation = segment.orientation === '+' ? '→' : '←';

      html += `<span class="segment" style="background-color: ${color};" title="${segment.nodeId}${orientation} (${segment.length} bp, overlap: ${segment.overlap})">${segment.nodeId}${orientation}</span>`;

      colorIndex++;
    });

    html += '<br><br>' + this.reconstructedSequence;

    return html;
  }

  /**
   * Download HTML file
   */
  downloadHTML() {
    const blob = new Blob([this.htmlOutput], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.path.name.replace(/[^a-zA-Z0-9]/g, '_')}_sequence.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
