import { Parser } from './Parser.js';

export class DotParser extends Parser {
  parse(text) {
    const nodes = [];
    const links = [];

    try {
      // Use graphlib-dot if available
      if (typeof graphlibDot !== 'undefined') {
        const g = graphlibDot.read(text);
        
        // Parse nodes
        g.nodes().forEach(id => {
          const nodeData = g.node(id) || {};
          nodes.push({ id, ...nodeData });
        });

        // Parse edges
        g.edges().forEach(e => {
          const edgeData = g.edge(e) || {};
          links.push({ source: e.v, target: e.w, ...edgeData });
        });
      }

      // Fallback regex parser
      if (links.length === 0) {
        const edgeRegex = /([^\s;"\[\]]+)\s*(--|->)\s*([^\s;"\[\]]+)(?:\s*\[([^\]]+)\])?;/g;
        let match;
        
        while ((match = edgeRegex.exec(text))) {
          const source = match[1].replace(/^"|"$/g, '');
          const target = match[3].replace(/^"|"$/g, '');
          links.push({ source, target });
          
          // Ensure nodes exist
          if (!nodes.find(n => n.id === source)) {
            nodes.push({ id: source });
          }
          if (!nodes.find(n => n.id === target)) {
            nodes.push({ id: target });
          }
        }
      }

      return { nodes, links };
    } catch (error) {
      console.error('DOT parsing error:', error);
      return { nodes: [], links: [] };
    }
  }
}
