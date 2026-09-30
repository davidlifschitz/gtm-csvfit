// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { boot, pick, blobText } from "./setup.js";

async function fit(src, dstHeader) {
  const { out, $ } = await boot();
  await pick($("file-src"), "export.csv", src);
  $("paste").value = dstHeader;
  $("paste").dispatchEvent(new Event("change"));
  $("run").click();
  return { csv: await blobText(out.at(-1)), $ };
}

describe("csvfit", () => {
  it("maps columns by name and alias", async () => {
    const { csv } = await fit("Card Name,Qty,Set Code\nLuke,2,SOR\n\"Han, Solo\",1,SHD\n", "card,count,set,foil");
    expect(csv).toBe('card,count,set,foil\nLuke,2,SOR,\n"Han, Solo",1,SHD,\n');
  });
  it("lets you override a mapping", async () => {
    const { out, $ } = await boot();
    await pick($("file-src"), "e.csv", "a,b\n1,2\n");
    $("paste").value = "x";
    $("paste").dispatchEvent(new Event("change"));
    const sel = document.querySelector("select[data-dest=x]");
    sel.value = "b";
    sel.dispatchEvent(new Event("change"));
    $("run").click();
    expect(await blobText(out.at(-1))).toBe("x\n2\n");
  });
  it("shows row count and waits for both inputs", async () => {
    const { $ } = await boot();
    expect($("status").textContent).toBe("Waiting for two CSVs.");
    expect($("run").disabled).toBe(true);
  });
});
