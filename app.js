const MAX_BYTES = 8 * 1024 * 1024;

const ALIAS = {
  qty: "count",
  quantity: "count",
  amount: "count",
  copies: "count",
  name: "card",
  cardname: "card",
  card_name: "card",
  title: "card",
  setcode: "set",
  set_code: "set",
  expansion: "set",
  id: "card_id",
  cardid: "card_id",
  sku: "card_id",
};

const els = {
  dropSrc: document.getElementById("drop-src"),
  dropDst: document.getElementById("drop-dst"),
  pickSrc: document.getElementById("pick-src"),
  pickDst: document.getElementById("pick-dst"),
  fileSrc: document.getElementById("file-src"),
  fileDst: document.getElementById("file-dst"),
  srcMeta: document.getElementById("src-meta"),
  dstMeta: document.getElementById("dst-meta"),
  paste: document.getElementById("paste"),
  status: document.getElementById("status"),
  error: document.getElementById("error"),
  map: document.getElementById("map"),
  run: document.getElementById("run"),
};

let source = { name: "", headers: [], rows: [] };
let destHeaders = [];
let mapping = {};

function setError(msg) {
  els.error.hidden = !msg;
  els.error.textContent = msg || "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const s = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1].every((x) => x === "")) rows.pop();
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const body = rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      o[h] = r[i] ?? "";
    });
    return o;
  });
  return { headers, rows: body };
}

function norm(h) {
  const n = String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return ALIAS[n] || n;
}

function isId(h) {
  return norm(h) === "card_id" || /(^|[^a-z])(id|sku)$/i.test(String(h || "").trim());
}

function score(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 100;
  // "card_id" contains "card", but a name column must never feed an id column.
  if (isId(a) !== isId(b)) return 0;
  if (x.includes(y) || y.includes(x)) return 70;
  return 0;
}

function autoMap() {
  mapping = {};
  const used = new Set();
  for (const d of destHeaders) {
    let best = "";
    let bestS = 0;
    for (const s of source.headers) {
      if (used.has(s)) continue;
      const sc = score(d, s);
      if (sc > bestS) {
        bestS = sc;
        best = s;
      }
    }
    if (bestS >= 70) {
      mapping[d] = best;
      used.add(best);
    } else mapping[d] = "";
  }
}

function render() {
  const ready = source.headers.length && destHeaders.length;
  els.status.textContent = ready
    ? `${source.rows.length} rows · ${destHeaders.length} destination columns · files stayed in this tab`
    : "Waiting for two CSVs.";
  if (!ready) {
    els.map.innerHTML = "";
    els.run.disabled = true;
    return;
  }
  const opts = [`<option value="">— skip —</option>`]
    .concat(source.headers.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`))
    .join("");
  els.map.innerHTML = `<table>
    <thead><tr><th scope="col">destination</th><th scope="col">from export</th></tr></thead>
    <tbody>
      ${destHeaders
        .map(
          (d) => `<tr>
        <td>${esc(d)}</td>
        <td><select data-dest="${esc(d)}" aria-label="Source column for ${esc(d)}">${opts}</select></td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
  for (const sel of els.map.querySelectorAll("select")) {
    const d = sel.getAttribute("data-dest");
    sel.value = mapping[d] || "";
    sel.addEventListener("change", () => {
      mapping[d] = sel.value;
    });
  }
  els.run.disabled = false;
}

function esc(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

function csvCell(v) {
  let t = String(v ?? "");
  // Stop Excel/Sheets from running cells as formulas.
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[",\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
}

function fitted() {
  const lines = [destHeaders.map(csvCell).join(",")];
  for (const row of source.rows) {
    lines.push(destHeaders.map((d) => csvCell(mapping[d] ? row[mapping[d]] : "")).join(","));
  }
  return lines.join("\n") + "\n";
}

async function readSrc(file) {
  if (file.size > MAX_BYTES) throw new Error("Export is over 8 MB.");
  const parsed = parseCsv(await file.text());
  if (!parsed.headers.length) throw new Error("Export has no header row.");
  source = { name: file.name, ...parsed };
  els.srcMeta.textContent = `${file.name} · ${parsed.rows.length} rows`;
  if (destHeaders.length) autoMap();
  render();
}

async function readDst(file) {
  if (file.size > MAX_BYTES) throw new Error("Template is over 8 MB.");
  const parsed = parseCsv(await file.text());
  destHeaders = parsed.headers.filter(Boolean);
  els.dstMeta.textContent = `${file.name} · ${destHeaders.length} columns`;
  els.paste.value = destHeaders.join(",");
  if (source.headers.length) autoMap();
  render();
}

function readPaste() {
  const line = els.paste.value.trim().split("\n")[0] || "";
  if (!line) return;
  destHeaders = parseCsv(line + "\n").headers.filter(Boolean);
  els.dstMeta.textContent = `pasted · ${destHeaders.length} columns`;
  if (source.headers.length) autoMap();
  render();
}

function bindDrop(el, fn) {
  ["dragenter", "dragover"].forEach((ev) =>
    el.addEventListener(ev, (e) => {
      e.preventDefault();
      el.classList.add("over");
    })
  );
  el.addEventListener("dragleave", () => el.classList.remove("over"));
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("over");
    if (e.dataTransfer.files[0]) fn(e.dataTransfer.files[0]).catch((err) => setError(err.message));
  });
}

els.pickSrc.addEventListener("click", () => els.fileSrc.click());
els.pickDst.addEventListener("click", () => els.fileDst.click());
els.fileSrc.addEventListener("change", () => {
  if (els.fileSrc.files[0]) readSrc(els.fileSrc.files[0]).catch((e) => setError(e.message));
  els.fileSrc.value = "";
});
els.fileDst.addEventListener("change", () => {
  if (els.fileDst.files[0]) readDst(els.fileDst.files[0]).catch((e) => setError(e.message));
  els.fileDst.value = "";
});
els.paste.addEventListener("change", readPaste);
els.paste.addEventListener("blur", readPaste);
els.run.addEventListener("click", () => {
  const blob = new Blob([fitted()], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (source.name || "export").replace(/\.csv$/i, "") + "-fit.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});
bindDrop(els.dropSrc, readSrc);
bindDrop(els.dropDst, readDst);
render();
