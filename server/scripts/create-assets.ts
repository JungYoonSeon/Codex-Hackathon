/** Original vector demo assets, rasterized for the image provider; no external images. */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { catalog } from '../src/catalog.ts';
const root = fileURLToPath(new URL('../assets/', import.meta.url));
const furniture = (id: string) => {
  const sofa = id.startsWith('sofa'); const oak = id === 'chair-oak';
  const color = id === 'sofa-linen' ? '#c9b99e' : id === 'sofa-sage' ? '#7c9685' : oak ? '#c99a62' : '#577c9e';
  const w = sofa ? 380 : 200; const x = (600-w)/2;
  return `<ellipse cx="300" cy="422" rx="${w/2+15}" ry="24" fill="#20372f" opacity=".12"/>
  <path d="M${x+30} 365v55 M${x+w-30} 365v55" stroke="${oak?'#a47142':'#564637'}" stroke-width="15"/>
  <rect x="${x}" y="150" width="${w}" height="180" rx="${oak?15:35}" fill="${color}" stroke="#4a554c" stroke-width="3"/>
  ${sofa?`<path d="M300 160v145" stroke="#607568" opacity=".6" stroke-width="3"/>`:''}
  <rect x="${x-10}" y="294" width="${w+20}" height="83" rx="18" fill="${oak?'#e4d4b7':color}" stroke="#4a554c" stroke-width="3"/>
  ${!oak?`<rect x="${x-20}" y="250" width="40" height="125" rx="18" fill="${color}" stroke="#4a554c" stroke-width="3"/><rect x="${x+w-20}" y="250" width="40" height="125" rx="18" fill="${color}" stroke="#4a554c" stroke-width="3"/>`:''}`;
};
const wrap = (body: string, w=600, h=500) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
await mkdir(`${root}/catalog`, { recursive: true }); await mkdir(`${root}/sample`, { recursive: true });
for (const item of catalog) {
  const svg = wrap(`<rect width="600" height="500" fill="#faf8f3"/>${furniture(item.id)}`);
  await writeFile(`${root}/catalog/${item.id}.svg`, svg);
  await sharp(Buffer.from(svg)).png().toFile(item.referencePath);
}
const room = `<rect width="960" height="720" fill="#efece4"/><path d="M0 0L180 90V450L0 720Z" fill="#dadfd9"/>
<path d="M960 0L780 90V450L960 720Z" fill="#e0e3dc"/><path d="M0 720L180 450H780L960 720Z" fill="#c7ac88"/>
<path d="M180 450H780 M100 570H860 M480 450V720 M300 450L200 720 M660 450L760 720" stroke="#ae916f" stroke-width="2"/>
<rect x="245" y="155" width="210" height="175" rx="3" fill="#a8c9d2" stroke="#fffdf7" stroke-width="14"/>
<path d="M350 155V330M245 242H455" stroke="#fffdf7" stroke-width="8"/>
<rect x="660" y="190" width="90" height="260" fill="#b69a78" stroke="#947958" stroke-width="6"/>
<circle cx="732" cy="325" r="5" fill="#685849"/>
<ellipse cx="200" cy="550" rx="44" ry="10" fill="#9a866d" opacity=".4"/>
<path d="M180 505H220L213 548H187Z" fill="#b87553"/>
<path d="M200 505V415M200 460Q155 425 165 403Q199 410 200 460M200 480Q240 443 237 420Q205 431 200 480" fill="#68866b" stroke="#486b4f" stroke-width="4"/>`;
await sharp(Buffer.from(wrap(room,960,720))).jpeg({quality:90}).toFile(`${root}/sample/room.jpg`);
for (const id of ['sofa-linen','sofa-sage']) {
  const label = `<rect x="0" y="670" width="960" height="50" fill="#203c34"/><text x="480" y="700" text-anchor="middle" font-family="sans-serif" font-size="19" fill="white">SAVED ILLUSTRATED EXAMPLE — NOT A LIVE AI RESULT</text>`;
  const svg=wrap(`${room}<g transform="translate(215 235) scale(.88)">${furniture(id)}</g>${label}`,960,720);
  await sharp(Buffer.from(svg)).jpeg({quality:90}).toFile(`${root}/sample/${id}.jpg`);
}
console.log('Created four fictional furniture references, an illustrated room, and two explicitly labeled saved examples.');
