export function shortenNodeName(nodeName: string): string {
  if (nodeName.length <= 10) {
    return nodeName;
  }

  // "baptist-health-system" -> "baptisths"
  const parts = nodeName.split('-');

  // Take the first part as is
  let shortened = parts[0];

  // Concatenate the first letter of each remaining part
  for (let i = 1; i < parts.length; i++) {
    shortened += parts[i].charAt(0);
  }

  return shortened;
}
