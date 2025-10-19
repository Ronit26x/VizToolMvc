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