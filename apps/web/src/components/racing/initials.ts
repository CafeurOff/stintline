/** Initials for drivers without a code (most drivers before 2014). */
export function initials(givenName: string, familyName: string): string {
  return `${givenName.charAt(0)}${familyName.charAt(0)}`.toUpperCase();
}
