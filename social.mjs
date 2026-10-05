import sharp from "sharp";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );
export async function roomImage(room) {
  const words = (room.name || "Spectralis room").split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const n = lines.length - 1;
    if (lines[n].length + word.length > 22 && lines[n]) lines.push(word);
    else lines[n] += (lines[n] ? " " : "") + word;
  }
  const title = lines
    .slice(0, 3)
    .map(
      (line, index) =>
        `<text x="72" y="${254 + index * 70}" fill="#eeeee6" font-family="sans-serif" font-size="58" font-weight="600">${escape(line)}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#101512"/><path d="M72 82v24m12-37v50m12-60v69m12-49v30m12-20v12" fill="none" stroke="#14b8a6" stroke-width="4" stroke-linecap="round"/><text x="154" y="106" fill="#eeeee6" font-family="sans-serif" font-size="28">spectralis / player</text><text x="72" y="178" fill="#8aa397" font-family="monospace" font-size="17" letter-spacing="3">${room.kind === "streamer_queue" ? "STREAMER QUEUE" : "LISTENING CHANNEL"}</text>${title}<rect x="824" y="181" width="304" height="304" rx="6" fill="#253c30"/><circle cx="998" cy="350" r="145" fill="#15221a" stroke="#324a39" stroke-width="12"/><circle cx="998" cy="350" r="108" fill="none" stroke="#26392b" stroke-width="14"/><circle cx="998" cy="350" r="45" fill="#59755c"/><circle cx="998" cy="350" r="5" fill="#15221a"/><text x="72" y="486" fill="#9fb0a4" font-family="sans-serif" font-size="21">${escape((room.tags || []).join(" · "))}</text><path d="M72 547h1056" stroke="#3b4e40"/><text x="72" y="586" fill="#9fb0a4" font-family="monospace" font-size="17">player.deltavdevs.com</text><text x="1128" y="586" text-anchor="end" fill="#9fb0a4" font-family="monospace" font-size="15">built by deltavdevs</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
