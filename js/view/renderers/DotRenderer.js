// js/view/renderers/DotRenderer.js
// DOT format renderer for circular nodes

import { Renderer } from './Renderer.js';

export class DotRenderer extends Renderer {
  draw(graph, transform, selection, pinnedNodes, highlightedPath) {
    this.clear();

    const ctx = this.ctx;
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Draw edges
    ctx.globalAlpha = 0.6;
    graph.edges.forEach((edge, index) => {
      const source = graph.getNode(edge.getSourceId());
      const target = graph.getNode(edge.getTargetId());
      
      if (!source || !target) return;

      const isHighlighted = highlightedPath?.edges?.has(index);

      ctx.beginPath();
      ctx.strokeStyle = isHighlighted 
        ? (highlightedPath.currentColor || '#ff6b6b')
        : this.parseColor(edge.color, '#999');
      ctx.lineWidth = edge.penwidth || 1;
      if (isHighlighted) ctx.lineWidth *= 3;

      if (edge.style === 'dashed') ctx.setLineDash([4, 2]);
      else if (edge.style === 'dotted') ctx.setLineDash([1, 2]);
      else ctx.setLineDash([]);

      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1.0;

    // Draw nodes
    graph.nodes.forEach((node, nodeId) => {
      const r = node.penwidth ? 4 + parseFloat(node.penwidth) : 8;
      const isHighlighted = highlightedPath?.nodes?.has(String(nodeId));
      const isSelected = selection?.has(nodeId);
      const isPinned = pinnedNodes?.has(nodeId);

      // Fill
      ctx.beginPath();
      ctx.fillStyle = isHighlighted
        ? (highlightedPath.currentColor || '#ff6b6b')
        : this.parseColor(node.color, '#69b3a2');
      ctx.arc(node.x, node.y, r * (isHighlighted ? 1.5 : 1), 0, 2 * Math.PI);
      ctx.fill();

      // Stroke
      ctx.beginPath();
      ctx.strokeStyle = isSelected ? 'red' : isPinned ? 'orange' : this.parseColor(node.color, '#333');
      ctx.lineWidth = (isPinned || isSelected) ? 3 : (node.penwidth || 1);
      
      if (node.style === 'dashed') ctx.setLineDash([4, 2]);
      else if (node.style === 'dotted') ctx.setLineDash([1, 2]);
      else ctx.setLineDash([]);
      
      ctx.arc(node.x, node.y, r * (isHighlighted ? 1.5 : 1), 0, 2 * Math.PI);
      ctx.stroke();
    });

    ctx.restore();
  }
}