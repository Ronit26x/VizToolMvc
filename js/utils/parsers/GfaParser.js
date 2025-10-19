import { Parser } from './Parser.js';

export class GfaParser extends Parser {
  parseTyped(type, val) {
    switch (type) {
      case 'i': return parseInt(val, 10);
      case 'f': return parseFloat(val);
      case 'Z': case 'H': return val;
      case 'B':
        const sub = val[0];
        return val.slice(2).split(',').map(v => this.parseTyped(sub, v));
      default: return val;
    }
  }

  parse(text) {
    const nodes = [];
    const links = [];
    const seen = new Set();

    text.split(/\r?\n/).forEach(line => {
      if (!line || line.startsWith('#')) return;
      
      const cols = line.split('\t');
      const tag = cols[0];

      if (tag === 'S') {
        // Segment line
        const [, id, seq = ''] = cols;
        const node = {
          id,
          seq,
          length: seq === '*' ? 1000 : seq.length,
          depth: 1.0,
          gfaType: 'segment'
        };

        // Parse optional tags
        for (let i = 3; i < cols.length; i++) {
          const tagMatch = cols[i].match(/^([A-Za-z][A-Za-z0-9]):([AifZHB]):(.+)$/);
          if (tagMatch) {
            const [, tagName, tagType, tagValue] = tagMatch;
            const parsedValue = this.parseTyped(tagType, tagValue);

            // Extract depth from various tags
            if (tagName === 'DP') {
              node.depth = parsedValue;
            } else if (tagName === 'KC' && node.length > 0) {
              node.depth = parsedValue / node.length;
            } else if (tagName === 'RC' && node.length > 0) {
              node.depth = parsedValue / node.length;
            } else if (tagName === 'LN') {
              node.length = parsedValue;
            }

            node[tagName] = parsedValue;
          }
        }

        nodes.push(node);
      } else if (tag === 'L' || tag === 'E') {
        // Link/Edge line
        const [, src, srcOri, tgt, tgtOri, overlap] = cols;
        const key = `${src}→${tgt}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          links.push({
            source: src,
            target: tgt,
            overlap: overlap || '0M',
            srcOrientation: srcOri,
            tgtOrientation: tgtOri,
            gfaType: 'link'
          });
        }
      } else if (tag === 'P') {
        // Path line
        const [, pathName, segList = ''] = cols;
        const segs = segList.split(',').map(s => s.replace(/[-+]$/, ''));
        
        for (let i = 0; i + 1 < segs.length; i++) {
          const key = `${segs[i]}→${segs[i+1]}`;
          if (!seen.has(key)) {
            seen.add(key);
            links.push({
              source: segs[i],
              target: segs[i+1],
              viaPath: pathName,
              gfaType: 'path'
            });
          }
        }
      }
    });

    return { nodes, links };
  }
}