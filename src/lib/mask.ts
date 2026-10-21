const STARS = "****";

/**
 * Partially hides a username for privacy, always with a fixed number of stars
 * so the mask doesn't reveal the name's length. "ZeeDudeFan" -> "Ze****an".
 */
export function maskUsername(username: string): string {
  const chars = Array.from(username.trim()); // code points, so emoji aren't split
  if (chars.length === 0) return STARS;
  if (chars.length <= 3) return chars[0] + STARS;
  if (chars.length <= 6) return chars.slice(0, 2).join("") + STARS;
  return chars.slice(0, 2).join("") + STARS + chars.slice(-2).join("");
}
