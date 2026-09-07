"use client";

import { useEffect } from "react";

const REPLACEMENTS: Array<[string, string]> = [
  ["Tabla metrológica - Patrón vs instrumento MD", "Tabla metrológica - Patrón vs instrumento"],
  ["Instrumento MD", "Instrumento"],
];

const METROLOGY_UNITS = [
  "PSI",
  "kg/cm²",
  "bar",
  "mbar",
  "kPa",
  "MPa",
  "Pa",
  "mca",
  "mmHg",
  "inHg",
];

const DATALIST_ID = "sip-metrology-units";

function replaceMetrologyLabels(root: ParentNode = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  for (const node of nodes) {
    const current = node.nodeValue || "";
    let next = current;
    for (const [from, to] of REPLACEMENTS) {
      next = next.replaceAll(from, to);
    }
    if (next !== current) node.nodeValue = next;
  }
}

function ensureUnitDatalist() {
  if (document.getElementById(DATALIST_ID)) return;
  const datalist = document.createElement("datalist");
  datalist.id = DATALIST_ID;
  for (const unit of METROLOGY_UNITS) {
    const option = document.createElement("option");
    option.value = unit;
    datalist.appendChild(option);
  }
  document.body.appendChild(datalist);
}

function enhanceMetrologyUnitInputs() {
  ensureUnitDatalist();

  for (const table of Array.from(document.querySelectorAll("table"))) {
    const headers = Array.from(table.querySelectorAll("thead th"));
    const unitIndex = headers.findIndex(
      (th) => (th.textContent || "").trim().toUpperCase() === "UNIDAD"
    );
    if (unitIndex < 0) continue;

    // Sólo aplicar a la tabla metrológica: debe tener columnas PATRÓN y ERROR ADM.
    const headerTexts = headers.map((th) => (th.textContent || "").trim().toUpperCase());
    if (!headerTexts.includes("PATRÓN") || !headerTexts.includes("ERROR ADM.")) continue;

    for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
      const cells = Array.from(row.querySelectorAll("td"));
      const input = cells[unitIndex]?.querySelector("input") as HTMLInputElement | null;
      if (!input) continue;
      input.setAttribute("list", DATALIST_ID);
      input.setAttribute("placeholder", "PSI, kg/cm², bar...");
      input.setAttribute("autocomplete", "off");
      input.title = "Elegí una unidad sugerida o escribí cualquier otra unidad.";
    }
  }
}

function applyEnhancements(root: ParentNode = document) {
  replaceMetrologyLabels(root);
  enhanceMetrologyUnitInputs();
}

export function GenericMetrologyLabels() {
  useEffect(() => {
    applyEnhancements();

    const observer = new MutationObserver(() => {
      applyEnhancements();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
