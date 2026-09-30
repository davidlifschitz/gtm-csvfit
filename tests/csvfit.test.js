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

describe("formula injection", () => {
  it("neutralizes cells that start like a formula", async () => {
    const { csv } = await fit('name,qty\n"=HYPERLINK(""http://x"",""hi"")",+1\n@SUM(A1),-2\nplain,3\n', "name,qty");
    expect(csv).toBe(`name,qty\n"'=HYPERLINK(""http://x"",""hi"")",'+1\n'@SUM(A1),'-2\nplain,3\n`);
  });
});

describe("auto-mapping", () => {
  it("does not put card names into an id column", async () => {
    const { csv } = await fit("Card Name,Qty\nLuke,2\n", "card_id,count");
    expect(csv).toBe("card_id,count\n,2\n");
  });
  it("still matches id and prefixed columns", async () => {
    const { csv } = await fit("Card ID,Card Name,Set Code,Foil Count\n1,Luke,SOR,0\n", "card_id,card,set,foil_count");
    expect(csv).toBe("card_id,card,set,foil_count\n1,Luke,SOR,0\n");
  });
});
