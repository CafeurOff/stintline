/** Official portraits are served by width (`w_320`): ask for a sharper copy for large busts. */
const SIZED = /([,/])w_\d+([,/])/;

export function sharper(url: string, width: number): string {
  return SIZED.test(url) ? url.replace(SIZED, `$1w_${String(width)}$2`) : url;
}
