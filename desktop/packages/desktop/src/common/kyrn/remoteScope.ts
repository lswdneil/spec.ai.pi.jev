import type { WebUiDeviceScope } from '../webui/scopes';

/**
 * KyRN host methods a `read` device may call.
 *
 * These read files, sessions, settings metadata, or a provider's public model
 * list. Anything that writes settings, appends lessons, starts a login, runs a
 * judge, imports transcripts, or reveals a local folder stays control-only.
 */
const READ_METHODS: ReadonlySet<string> = new Set([
  'kyrn.catalog',
  'kyrn.settings',
  'kyrn.availableModels',
  'kyrn.defaultModel',
  'kyrn.login.state',
  'kyrn.login.status',
  'kyrn.localJudge.state',
  'kyrn.activity',
  'kyrn.modelLevels',
  'kyrn.lessons',
  'kyrn.import.list',
  'kyrn.import.history',
  'kyrn.skills',
  'kyrn.mcp',
  'kyrn.folder.lessons',
  'kyrn.folder.files',
]);

/** Whether a device scope may invoke this exact KyRN wire method. */
export function isKyrnMethodAllowed(scope: WebUiDeviceScope, method: string): boolean {
  return scope === 'control' || READ_METHODS.has(method);
}
