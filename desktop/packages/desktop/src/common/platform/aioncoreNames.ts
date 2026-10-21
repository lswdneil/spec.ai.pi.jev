/**
 * Names that AionCore, the bundled backend (a separate program, see NOTICE), reads and writes. It began as AionUi's
 * backend and still uses AionUi's names in its protocol: in the error codes and ownership it gives its own errors, in
 * its environment variables, headers and files. The app can't rename them, so it speaks them only here and at the
 * launcher, and turns AionCore's answers into spec.jev's names where they come in.
 */

/** The prefix AionCore gives the codes of its own errors (`AIONUI_STREAM_BROKEN`); the app calls them `MU_…`. */
const AIONCORE_CODE_PREFIX = 'AIONUI_';
const MU_CODE_PREFIX = 'MU_';

/** The ownership AionCore gives its own errors; the app calls it `spec.jev`. */
const AIONCORE_OWN_OWNERSHIP = 'aionui';

/** AionCore's file name for its database, in the app's data folder. */
export const AIONCORE_DATABASE_FILE = 'aionui-backend.db';

/** The header that marks the app's own requests to AionCore, as against a browser's. */
export const AIONCORE_INTERNAL_HEADER = 'x-aionui-internal';

/** The source AionCore gives a conversation made in the app, as against one from a chat channel. */
export const AIONCORE_APP_SOURCE = 'aionui';

/** The id of AionCore's built-in assistant that helps with the app itself (the Butler). */
export const AIONCORE_BUTLER_ASSISTANT_ID = 'aionui-assistant';

/** The variable in which AionCore names the conversation to an agent it starts (the ACP adapter). */
export const AIONCORE_CONVERSATION_ID_ENV = 'AIONUI_CONVERSATION_ID';

/** The suffix AionCore adds to the name of a file it stores for a message: `_aionui_` and the time in milliseconds. */
export const AIONCORE_UPLOAD_SUFFIX = /_aionui_\d{13}(\.\w+)?$/;

/** An error code from AionCore by the app's name for it: its own errors' codes start `MU_`, the rest stay. */
export function fromAionCoreCode(code: string): string {
  return code.startsWith(AIONCORE_CODE_PREFIX) ? MU_CODE_PREFIX + code.slice(AIONCORE_CODE_PREFIX.length) : code;
}

/** An error ownership from AionCore by the app's name for it. */
export function fromAionCoreOwnership(ownership: string): string {
  return ownership === AIONCORE_OWN_OWNERSHIP ? 'mu' : ownership;
}
