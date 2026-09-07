"use client";

import { useEffect } from "react";

const REPLACEMENTS: Array<[string, string]> = [
  ["Tabla metrológica - Patrón vs instrumento MD", "Tabla metrológica - Patrón vs instrumento"],
  ["Instrumento MD", "Instrumento"],
];

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

export function GenericMetrologyLabels() {
  useEffect(() => {
    replaceMetrologyLabels();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
          if (added.nodeType === Node.TEXT_NODE) {
            const text = added as Text;
            const current = text.nodeValue || "";
            let next = current;
            for (const [from, to] of REPLACEMENTS) {
              next = next.replaceAll(from, to);
            }
            if (next !== current) text.nodeValue = next;
          } else if (added.nodeType === Node.ELEMENT_NODE) {
            replaceMetrologyLabels(added as Element);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
