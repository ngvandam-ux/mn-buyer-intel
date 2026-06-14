/**
 * Detect a Radware/ShieldSquare bot-wall page. Note: real mn.gov pages embed a single
 * `perfdrive` challenge-script reference even when serving real content, so we key on the
 * captcha *title*, not a mere script reference.
 */
export function looksLikeBotWall(html: string): boolean {
  return /<title>[^<]*Bot Manager Captcha|Radware Bot Manager|Are you a human\?/i.test(html);
}
