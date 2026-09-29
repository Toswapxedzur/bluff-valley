// Review sheet for the UI icons: big on navy, big on light, and at real size inside the round
// .btn-icon (18 px on the 34 px button) in both themes.
import { ICONS, svg, themeVars } from "./icons.js";
import { writeFileSync } from "node:fs";
const big = (bg, fg) => ICONS.map(([k, name, repl, body]) => `<div class="t" style="background:${bg};${themeVars(bg !== "#ffffff")}">${svg(body(), 72)}<b style="color:${fg}">${name}</b><i style="color:${fg}">${repl}</i></div>`).join("");
const small = (bg, well) => ICONS.map(([k, , , body]) => `<div class="s" style="background:${bg};${themeVars(bg !== "#e9eef8")}"><span class="b" style="background:${well}">${svg(body(), 18)}</span></div>`).join("");
writeFileSync(new URL("./sheet.html", import.meta.url), `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0b1222;font:12px system-ui;padding:16px;display:grid;gap:12px;width:1440px;box-sizing:border-box}
.row{display:grid;grid-template-columns:repeat(9,1fr);gap:8px}.t{border-radius:12px;padding:12px 6px 8px;display:grid;justify-items:center;gap:5px;text-align:center}
.t b{font-weight:600}.t i{font-style:normal;opacity:.75;font-size:11px}.s{border-radius:10px;padding:10px;display:grid;place-items:center}
.b{width:34px;height:34px;border-radius:99px;display:grid;place-items:center}
</style>
<div class="row">${big("#182541", "#9db0d6")}</div>
<div class="row">${small("#0f172a", "#0b1220")}</div>
<div class="row">${big("#ffffff", "#55627b")}</div>
<div class="row">${small("#e9eef8", "#dde5f4")}</div>`);
console.log("sheet.html written,", ICONS.length, "icons");
