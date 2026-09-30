import { it, expect } from "vitest";
import { boot, pick } from "./setup.js";

it("labels the paste box and every mapping dropdown, and announces status and errors", async () => {
  const { $ } = await boot();
  expect($("paste").getAttribute("aria-label")).toMatch(/header row/i);
  expect($("status").getAttribute("role")).toBe("status");
  expect($("error").getAttribute("role")).toBe("alert");
  await pick($("file-src"), "a.csv", "Name,Qty\nBolt,2\n");
  await pick($("file-dst"), "b.csv", "card_name,count\n");
  const sels = [...document.querySelectorAll("#map select")];
  expect(sels.map((s) => s.getAttribute("aria-label"))).toEqual(["Source column for card_name", "Source column for count"]);
  expect([...document.querySelectorAll("#map th")].every((th) => th.getAttribute("scope") === "col")).toBe(true);
});
