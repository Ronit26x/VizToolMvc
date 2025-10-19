// js/view/renderers/GfaRenderer.js
// GFA renderer using YOUR ORIGINAL rendering logic from gfa-renderer.js

import { Renderer } from './Renderer.js';

// Bandage-style settings (from your original code)
const GFA_SETTINGS = {
  averageNodeWidth: 12.0,
  depthPower: 0.5,
  depthEffectOnWidth: 0.8,
  nodeSegmentLength: 25,
  minimumNodeLength: 10,
  edgeLength: 40,
  minDepth: 0.1,
  maxDepth: 50,
  meanNodeLength: 50.0,
  minTotalGraphLength: 2000.0,
  autoNodeLengthPerMegabase: 5000.0
};

export class GfaRenderer extends Renderer {
  constructor(canvas) {
    super(canvas);
    this._gfaNodesCache = null;
  }

  draw(graph, transform, selection, pinnedNodes, highlightedPath) {
    // Get GFA nodes
    const gfaNodes = this.getOrCreateGfaNodes(graph);
    
    // Update positions from graph
    gfaNodes.forEach((gfaNode, i) => {
      const graphNode = graph.getNode(gfaNode.id);
      if (graphNode) {
        gfaNode.x = graphNode.x;
        gfaNode.y = graphNode.y;
      }
    });

    this.clear();
    
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw edges
    ctx.globalAlpha = 0.6;
    graph.edges.forEach((link, index) => {
      const sourceGfaNode = gfaNodes.find(n => n.id === link.getSourceId());
      const targetGfaNode = gfaNodes.find(n => n.id === link.getTargetId());
      
      if (sourceGfaNode && targetGfaNode) {
        const isHighlighted = highlightedPath && highlightedPath.edges && highlightedPath.edges.has(index);
        this.drawCurvedGfaEdge(ctx, transform, sourceGfaNode, targetGfaNode, link, isHighlighted, highlightedPath);
      }
    });
    ctx.globalAlpha = 1.0;
    
    // Draw nodes
    gfaNodes.forEach(gfaNode => {
      const isSelected = selection && selection.has(gfaNode.id);
      const isPinned = pinnedNodes && pinnedNodes.has(gfaNode.id);
      const isHighlighted = highlightedPath && highlightedPath.nodes && highlightedPath.nodes.has(String(gfaNode.id));
      gfaNode.draw(ctx, transform, isSelected, isPinned, isHighlighted);
    });
    
    ctx.restore();
  }

  getOrCreateGfaNodes(graph) {
    if (!this._gfaNodesCache) {
      const nodes = graph.getNodesArray();
      this.calculateAutoNodeLength(nodes);
      this._gfaNodesCache = nodes.map(nodeData => new GfaNodeRenderable(nodeData, 1.0));
      this.layoutGfaNodes(this._gfaNodesCache, graph.edges);
    }
    return this._gfaNodesCache;
  }

  calculateAutoNodeLength(nodes) {
    let totalLength = 0;
    let nodeCount = 0;
    
    nodes.forEach(node => {
      if (node.length && node.length > 0) {
        totalLength += node.length;
        nodeCount++;
      }
    });
    
    const targetDrawnGraphLength = Math.max(
      nodeCount * GFA_SETTINGS.meanNodeLength,
      GFA_SETTINGS.minTotalGraphLength
    );
    
    const megabases = totalLength / 1000000.0;
    if (megabases > 0.0) {
      GFA_SETTINGS.autoNodeLengthPerMegabase = targetDrawnGraphLength / megabases;
    }
  }

  layoutGfaNodes(gfaNodes, links) {
    // Build connection map
    const nodeMap = new Map();
    gfaNodes.forEach(node => nodeMap.set(node.id, node));
    
    const connections = new Map();
    gfaNodes.forEach(node => connections.set(node.id, { incoming: [], outgoing: [] }));
    
    links.forEach(link => {
      const sourceId = link.getSourceId();
      const targetId = link.getTargetId();
      
      if (connections.has(sourceId)) {
        connections.get(sourceId).outgoing.push({
          nodeId: targetId,
          orientation: link.tgtOrientation || '+'
        });
      }
      if (connections.has(targetId)) {
        connections.get(targetId).incoming.push({
          nodeId: sourceId,
          orientation: link.srcOrientation || '+'
        });
      }
    });
    
    // Calculate orientations
    gfaNodes.forEach(node => {
      const conn = connections.get(node.id);
      let targetAngle = 0;
      let angleSet = false;
      
      if (conn.outgoing.length > 0) {
        let totalX = 0, totalY = 0, count = 0;
        
        conn.outgoing.forEach(({ nodeId }) => {
          const targetNode = nodeMap.get(nodeId);
          if (targetNode) {
            const dx = targetNode.x - node.x;
            const dy = targetNode.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              totalX += dx / dist;
              totalY += dy / dist;
              count++;
            }
          }
        });
        
        if (count > 0) {
          targetAngle = Math.atan2(totalY / count, totalX / count);
          angleSet = true;
        }
      }
      
      if (!angleSet && conn.incoming.length > 0) {
        let totalX = 0, totalY = 0, count = 0;
        
        conn.incoming.forEach(({ nodeId }) => {
          const sourceNode = nodeMap.get(nodeId);
          if (sourceNode) {
            const dx = node.x - sourceNode.x;
            const dy = node.y - sourceNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              totalX += dx / dist;
              totalY += dy / dist;
              count++;
            }
          }
        });
        
        if (count > 0) {
          targetAngle = Math.atan2(totalY / count, totalX / count);
          angleSet = true;
        }
      }
      
      if (angleSet) {
        node.angle = targetAngle;
      }
      
      node.updatePosition();
    });
  }

  drawCurvedGfaEdge(ctx, transform, sourceNode, targetNode, linkData, isHighlighted, highlightedPath) {
    const start = sourceNode.getSubnodeForEdge(true);
    const end = targetNode.getSubnodeForEdge(false);
    
    ctx.save();
    
    if (isHighlighted) {
      ctx.strokeStyle = highlightedPath?.currentColor || '#ff6b6b';
      ctx.lineWidth = Math.max(1, 6 * transform.k);
    } else {
      ctx.strokeStyle = linkData.color || '#333333';
      ctx.lineWidth = Math.max(1, 2 * transform.k);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const startX = start.x * transform.k + transform.x;
    const startY = start.y * transform.k + transform.y;
    const endX = end.x * transform.k + transform.x;
    const endY = end.y * transform.k + transform.y;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    ctx.restore();
  }
}

// GFA Node Renderable (from your original code)
class GfaNodeRenderable {
  constructor(nodeData, scaleFactor = 1.0) {
    this.id = nodeData.id;
    this.depth = nodeData.depth || 1.0;
    this.length = nodeData.length || 1000;
    this.seq = nodeData.seq || '';
    this.x = nodeData.x || 0;
    this.y = nodeData.y || 0;
    this.angle = 0;
    this.isFlipped = false;
    this.segments = [];
    this.scaleFactor = scaleFactor;
    
    this.width = this.calculateWidth();
    this.drawnLength = this.calculateDrawnLength(scaleFactor);
    
    this.createSubnodes();
    this.createSegments();
  }

  calculateWidth() {
    const depthRelativeToMean = Math.max(0.1, this.depth / 10);
    const widthRelativeToAverage = (Math.pow(depthRelativeToMean, GFA_SETTINGS.depthPower) - 1.0) * 
                                   GFA_SETTINGS.depthEffectOnWidth + 1.0;
    return Math.max(4, GFA_SETTINGS.averageNodeWidth * widthRelativeToAverage);
  }

  calculateDrawnLength(scaleFactor = 1.0) {
    const drawnNodeLength = GFA_SETTINGS.autoNodeLengthPerMegabase * this.length / 1000000.0 * scaleFactor;
    return Math.max(GFA_SETTINGS.minimumNodeLength, drawnNodeLength);
  }

  createSubnodes() {
    this.inSubnode = {
      id: `${this.id}_in`,
      parentId: this.id,
      type: 'incoming',
      x: this.x,
      y: this.y,
      radius: 3
    };
    
    this.outSubnode = {
      id: `${this.id}_out`,
      parentId: this.id,
      type: 'outgoing',
      x: this.x,
      y: this.y,
      radius: 3
    };
    
    this.updateSubnodePositions();
  }

  updateSubnodePositions() {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const halfLength = this.drawnLength / 2;
    
    this.inSubnode.x = this.x - cos * halfLength;
    this.inSubnode.y = this.y - sin * halfLength;
    
    this.outSubnode.x = this.x + cos * halfLength;
    this.outSubnode.y = this.y + sin * halfLength;
  }

  createSegments() {
    const numSegments = this.getNumberOfSegments();
    const segmentLength = this.drawnLength / (numSegments - 1);
    
    this.segments = [];
    for (let i = 0; i < numSegments; i++) {
      this.segments.push({
        x: this.x + (i * segmentLength) - (this.drawnLength / 2),
        y: this.y
      });
    }
  }

  getNumberOfSegments() {
    const numberOfEdges = Math.max(1, Math.round(this.drawnLength / GFA_SETTINGS.nodeSegmentLength));
    return numberOfEdges + 1;
  }

  updatePosition() {
    const centerX = this.x;
    const centerY = this.y;
    
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const segmentLength = this.drawnLength / (this.segments.length - 1);
    
    this.segments.forEach((segment, i) => {
      const offset = (i * segmentLength) - (this.drawnLength / 2);
      segment.x = centerX + cos * offset;
      segment.y = centerY + sin * offset;
    });
    
    this.updateSubnodePositions();
  }

  getSubnodeForEdge(isOutgoing) {
    return isOutgoing ? this.outSubnode : this.inSubnode;
  }

  getColor() {
    const hash = this.id.toString().split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  draw(ctx, transform, isSelected, isPinned, isHighlighted) {
    if (this.segments.length < 2) return;

    ctx.save();
    
    const width = this.width * transform.k;
    const minWidth = 2;
    const effectiveWidth = Math.max(width, minWidth);
    
    if (isHighlighted) {
      ctx.fillStyle = '#ff6b6b';
      ctx.strokeStyle = '#cc0000';
      ctx.lineWidth = Math.max(0.5, 3 * transform.k);
    } else {
      ctx.fillStyle = this.getColor();
      ctx.strokeStyle = isSelected ? '#ff0000' : (isPinned ? '#ff8800' : '#000000');
      ctx.lineWidth = Math.max(0.5, (isSelected ? 2 : 0.5) * transform.k);
    }
    
    const transformedSegments = this.segments.map(segment => ({
      x: segment.x * transform.k + transform.x,
      y: segment.y * transform.k + transform.y
    }));
    
    const nodeWidth = isHighlighted ? effectiveWidth * 1.5 : effectiveWidth;
    const path = this.createNodePath(transformedSegments, nodeWidth);
    
    ctx.fill(path);
    ctx.stroke(path);
    
    // Draw label
    if (transform.k > 0.3 && this.drawnLength > 30) {
      const centerX = this.x * transform.k + transform.x;
      const centerY = this.y * transform.k + transform.y;
      
      const fontSize = Math.min(12, Math.max(8, 10 * transform.k));
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const label = this.drawnLength > 80 
        ? `${this.id} (${this.formatLength(this.length)})${this.isFlipped ? ' ↻' : ''}`
        : `${this.id}${this.isFlipped ? ' ↻' : ''}`;
      const metrics = ctx.measureText(label);
      const textWidth = metrics.width;
      const textHeight = fontSize;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(
        centerX - textWidth/2 - 2,
        centerY - textHeight/2 - 1,
        textWidth + 4,
        textHeight + 2
      );
      
      ctx.fillStyle = '#000000';
      ctx.fillText(label, centerX, centerY);
    }
    
    // Draw subnodes
    if (transform.k > 1.5) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(
        this.inSubnode.x * transform.k + transform.x,
        this.inSubnode.y * transform.k + transform.y,
        4 * transform.k, 0, 2 * Math.PI
      );
      ctx.fill();
      
      ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(
        this.outSubnode.x * transform.k + transform.x,
        this.outSubnode.y * transform.k + transform.y,
        4 * transform.k, 0, 2 * Math.PI
      );
      ctx.fill();
    }
    
    ctx.restore();
  }

  createNodePath(segments, width) {
    // Your original rounded node path creation logic
    if (segments.length < 2) return new Path2D();
    
    const path = new Path2D();
    const halfWidth = width / 2;
    
    const topPoints = [];
    const bottomPoints = [];
    
    segments.forEach((segment, i) => {
      let dx = 0, dy = 0;
      
      if (i === 0) {
        dx = segments[1].x - segments[0].x;
        dy = segments[1].y - segments[0].y;
      } else if (i === segments.length - 1) {
        dx = segments[i].x - segments[i-1].x;
        dy = segments[i].y - segments[i-1].y;
      } else {
        const dx1 = segments[i].x - segments[i-1].x;
        const dy1 = segments[i].y - segments[i-1].y;
        const dx2 = segments[i+1].x - segments[i].x;
        const dy2 = segments[i+1].y - segments[i].y;
        dx = (dx1 + dx2) / 2;
        dy = (dy1 + dy2) / 2;
      }
      
      const len = Math.sqrt(dx * dx + dy * dy);
      const normalX = len > 0 ? -dy / len : 0;
      const normalY = len > 0 ? dx / len : 1;
      
      topPoints.push({
        x: segment.x + normalX * halfWidth,
        y: segment.y + normalY * halfWidth
      });
      
      bottomPoints.push({
        x: segment.x - normalX * halfWidth,
        y: segment.y - normalY * halfWidth
      });
    });
    
    const firstCenter = segments[0];
    const startAngle = Math.atan2(topPoints[0].y - bottomPoints[0].y, topPoints[0].x - bottomPoints[0].x);
    path.arc(firstCenter.x, firstCenter.y, halfWidth, startAngle, startAngle + Math.PI);
    
    for (let i = 1; i < topPoints.length; i++) {
      path.lineTo(topPoints[i].x, topPoints[i].y);
    }
    
    const lastCenter = segments[segments.length - 1];
    const secondLastCenter = segments[segments.length - 2];
    const arrowDx = lastCenter.x - secondLastCenter.x;
    const arrowDy = lastCenter.y - secondLastCenter.y;
    const arrowLen = Math.sqrt(arrowDx * arrowDx + arrowDy * arrowDy);
    
    if (arrowLen > 0) {
      const arrowSize = Math.min(width * 1.5, arrowLen * 0.5);
      const arrowUnitX = arrowDx / arrowLen;
      const arrowUnitY = arrowDy / arrowLen;
      
      const arrowTipX = lastCenter.x + arrowUnitX * arrowSize * 0.5;
      const arrowTipY = lastCenter.y + arrowUnitY * arrowSize * 0.5;
      
      path.lineTo(arrowTipX, arrowTipY);
      path.lineTo(bottomPoints[bottomPoints.length - 1].x, bottomPoints[bottomPoints.length - 1].y);
    }
    
    for (let i = bottomPoints.length - 2; i >= 0; i--) {
      path.lineTo(bottomPoints[i].x, bottomPoints[i].y);
    }
    
    path.closePath();
    return path;
  }

  formatLength(length) {
    if (length >= 1000000) {
      return (length / 1000000).toFixed(1) + 'Mb';
    } else if (length >= 1000) {
      return (length / 1000).toFixed(1) + 'kb';
    }
    return length + 'bp';
  }
}