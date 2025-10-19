export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  draw(graph, transform, selection, pinnedNodes, highlightedPath) {
    throw new Error('draw() must be implemented by subclass');
  }

  parseColor(val, fallback) {
    let c = Array.isArray(val) ? val[0] : val;
    if (!c || typeof c !== 'string') return fallback;
    c = c.trim().split(':')[0];
    return c || fallback;
  }
}