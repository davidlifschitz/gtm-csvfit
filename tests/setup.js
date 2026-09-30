import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

// Load index.html's body, then import app.js fresh so each test gets clean state.
export async function boot() {
  const html = readFileSync(join(__dirname, "../index.html"), "utf8");
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, "");
  const out = [];
  URL.createObjectURL = (b) => (out.push(b), "blob:x");
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () {};
  vi.resetModules();
  await import("../app.js");
  return { out, $: (id) => document.getElementById(id) };
}

export async function pick(input, name, text) {
  const f = new File([text], name, { type: "text/csv" });
  f.text ??= async () => text;
  Object.defineProperty(input, "files", { value: [f], configurable: true });
  input.dispatchEvent(new Event("change"));
  await new Promise((r) => setTimeout(r, 0));
}

export async function blobText(b) {
  return await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsText(b);
  });
}
