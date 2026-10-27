import type { TFunction } from 'i18next';
import { BUILTIN_BROWSER_MCP_NAME } from '@/common/config/constants';
import { BUILTIN_MCP_SERVER_NAMES } from '@/common/platform/legacyNames';
import type { IMcpServer } from '@/common/config/storage';

/**
 * The name an MCP server is shown by: its own, except the built-in browser's, whose name is an internal id kept for
 * the config it is stored under.
 */
export const mcpServerLabel = (server: Pick<IMcpServer, 'name'>, t: TFunction): string => {
  if (server.name === BUILTIN_BROWSER_MCP_NAME) return t('settings.mcpBuiltinBrowserName');
  if (server.name === BUILTIN_MCP_SERVER_NAMES.windows) return t('settings.mcpBuiltinWindowsName');
  return server.name;
};
