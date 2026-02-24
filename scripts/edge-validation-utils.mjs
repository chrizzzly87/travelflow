/**
 * Parse [[edge_functions]] blocks from netlify.toml.
 */
export const parseEdgeFunctionEntries = (toml) => {
  const entries = [];
  const blockRegex = /\[\[edge_functions\]\]([\s\S]*?)(?=\n\[\[|\n\[|$)/g;
  let blockMatch;

  while ((blockMatch = blockRegex.exec(toml)) !== null) {
    const block = blockMatch[1] || "";
    const pathMatch = block.match(/path\s*=\s*"([^"]+)"/);
    const functionMatch = block.match(/function\s*=\s*"([^"]+)"/);
    if (!pathMatch || !functionMatch) continue;
    entries.push({
      path: pathMatch[1],
      functionName: functionMatch[1],
    });
  }

  return entries;
};

export const findCatchAllEdgeEntries = (entries) =>
  entries.filter((entry) => entry.path.trim() === "/*");
