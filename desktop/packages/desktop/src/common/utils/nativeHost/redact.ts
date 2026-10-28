/**
 * Masks credentials in text before it is shown, logged, or sent to another process. The text is otherwise left as it is:
 * enough of a key stays visible to recognize its kind, and diagnostics keep their useful wording.
 */

const URL_CREDENTIAL = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:)[^\s/@]*(?=@)/gi;

const SECRETS: readonly (readonly [RegExp, string])[] = [
  // A private key pasted in: everything after its header, to the end line or, when there is none, to the end of the text.
  [
    /(-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----)[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
    '$1',
  ],
  // Authorization headers, proxy ones included. Keep the scheme (Bearer, Basic) as the useful diagnostic prefix.
  [/\b((?:proxy-)?authorization\s*:\s*(?:(?:bearer|basic)\s+)?)[^\r\n]+/gi, '$1'],
  [/\b((?:set-)?cookie\s*:\s*)[^\r\n]+/gi, '$1'],
  // Key/value pairs in environment output, query strings, and JSON.
  [
    /\b((?:[A-Z][A-Z0-9_]*_)?(?:API[_-]?KEY|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|AUTH[_-]?TOKEN|TOKEN|SECRET|PASSWORD|PASSWD|COOKIE))=([^\s&,;]+)/gi,
    '$1=',
  ],
  [/([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|secret|password)=)[^&#\s]+/gi, '$1'],
  [
    /("(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|secret|password|passwd|cookie|authorization)"\s*:\s*")[^"]*(?=")/gi,
    '$1',
  ],
  [/\b(gh[pousr]\\?_)[A-Za-z0-9]{20,}/g, '$1'],
  [/\b(github_pat_)[A-Za-z0-9_]{20,}/g, '$1'],
  [/\b(sk-(?:ant-|proj-|or-v1-)?)(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{20,}/g, '$1'],
  [/\b(AIza)[0-9A-Za-z_-]{30,}/g, '$1'],
  [/\b(AKIA)[0-9A-Z]{16}\b/g, '$1'],
  [/\b(xox[abprs]-)[A-Za-z0-9-]{10,}/g, '$1'],
  [/\b(eyJ)[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '$1'],
  [/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1'],
  [/\b(Basic\s+)[A-Za-z0-9+/=]{8,}/gi, '$1'],
];

/** The text with credentials masked: what identifies a key stays, and its secret part becomes `••••`. */
export function maskSecrets(text: string): string {
  const withoutUrlCredentials = text.replace(URL_CREDENTIAL, '$1••••');
  return SECRETS.reduce((masked, [pattern, keep]) => masked.replace(pattern, `${keep}••••`), withoutUrlCredentials);
}
