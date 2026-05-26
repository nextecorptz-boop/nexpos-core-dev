const fs = require('fs');
const path = require('path');

const dirs = [
  'app/(workspace)/app',
  'components'
];

const replacements = [
  { rx: /text-\[#FAF6EE\]/g, to: 'text-nx-text' },
  { rx: /text-\[#A19B94\]/g, to: 'text-nx-text-sec' },
  { rx: /bg-\[#292521\]/g, to: 'bg-nx-surface' },
  { rx: /border-\[#292521\]/g, to: 'border-nx-border' },
  { rx: /border-\[#2D2823\]/g, to: 'border-nx-border' },
  { rx: /bg-\[#41362D\]/g, to: 'bg-nx-hover' },
  { rx: /border-\[#41362D\]/g, to: 'border-nx-border' },
  { rx: /text-\[#B48E4F\]/g, to: 'text-nx-gold' },
  { rx: /bg-\[#B48E4F\]/g, to: 'bg-nx-gold' },
  { rx: /border-\[#B48E4F\]/g, to: 'border-nx-gold' },
  { rx: /text-\[#C9A84C\]/g, to: 'text-nx-gold' },
  { rx: /bg-\[#C9A84C\]/g, to: 'bg-nx-gold' },
  { rx: /bg-\[#1C1A17\]/g, to: 'bg-nx-surface' },
  { rx: /bg-\[#12110F\]/g, to: 'bg-nx-bg' },
  { rx: /bg-\[#0E0D0B\]/g, to: 'bg-nx-surface' },
  { rx: /text-\[#0E0D0B\]/g, to: 'text-nx-surface' },
  { rx: /text-\[#10B981\]/g, to: 'text-nx-green' },
  { rx: /bg-\[#10B981\]/g, to: 'bg-nx-green' },
  { rx: /text-\[#EF4444\]/g, to: 'text-nx-red' },
  { rx: /bg-\[#EF4444\]/g, to: 'bg-nx-red' },
  // Specific modifiers
  { rx: /hover:bg-\[#41362D\]/g, to: 'hover:bg-nx-hover' },
  { rx: /hover:bg-\[#B48E4F\]/g, to: 'hover:bg-nx-gold' },
  { rx: /hover:border-\[#B48E4F\]/g, to: 'hover:border-nx-gold' },
  { rx: /hover:text-\[#FAF6EE\]/g, to: 'hover:text-nx-text' },
  { rx: /hover:border-\[#FAF6EE\]/g, to: 'hover:border-nx-border' },
  { rx: /text-\[#FAF6EE\]\/80/g, to: 'text-nx-text/80' },
  { rx: /bg-\[#292521\]\/50/g, to: 'bg-nx-surface/50' },
  { rx: /border-\[#292521\]\/50/g, to: 'border-nx-border/50' },
  { rx: /text-\[#B48E4F\]\/50/g, to: 'text-nx-gold/50' },
  { rx: /hover:border-\[#B48E4F\]\/50/g, to: 'hover:border-nx-gold/50' },
  { rx: /bg-\[#B48E4F\]\/10/g, to: 'bg-nx-gold/10' },
  { rx: /bg-\[#C9A84C\]\/10/g, to: 'bg-nx-gold/10' },
  { rx: /text-\[#B48E4F\]\/20/g, to: 'text-nx-gold/20' },
  { rx: /group-hover:text-\[#B48E4F\]\/40/g, to: 'group-hover:text-nx-gold/40' },
  { rx: /group-hover:text-\[#B48E4F\]/g, to: 'group-hover:text-nx-gold' },
];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      let content = fs.readFileSync(full, 'utf8');
      let changed = false;
      for (const rep of replacements) {
        if (rep.rx.test(content)) {
          content = content.replace(rep.rx, rep.to);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(full, content);
        console.log("Updated", full);
      }
    }
  }
}

dirs.forEach(d => walk(path.join(__dirname, d)));
