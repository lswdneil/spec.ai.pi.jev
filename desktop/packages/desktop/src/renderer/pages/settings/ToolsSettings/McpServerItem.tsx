import { Collapse } from '@/renderer/ui/collapse';
import React from 'react';
import type { IMcpServer } from '@/common/config/storage';
import McpServerHeader from './McpServerHeader';
import McpServerToolsList from './McpServerToolsList';
import type { McpOAuthStatus } from '@/renderer/hooks/mcp/useMcpOAuth';

interface McpServerItemProps {
  server: IMcpServer;
  isCollapsed: boolean;
  isTestingConnection: boolean;
  oauthStatus?: McpOAuthStatus;
  isLoggingIn?: boolean;
  /** Extension-contributed servers are read-only (no edit/delete) */
  isReadOnly?: boolean;
  onToggleCollapse: () => void;
  onTestConnection: (server: IMcpServer) => void;
  onEditServer: (server: IMcpServer) => void;
  onDeleteServer: (serverId: string) => void;
  onOAuthLogin?: (server: IMcpServer) => void;
}

const McpServerItem: React.FC<McpServerItemProps> = ({
  server,
  isCollapsed,
  isTestingConnection,
  oauthStatus,
  isLoggingIn,
  isReadOnly,
  onToggleCollapse,
  onTestConnection,
  onEditServer,
  onDeleteServer,
  onOAuthLogin,
}) => {
  return (
    <Collapse
      key={server.id}
      activeKey={isCollapsed ? ['1'] : []}
      onChange={onToggleCollapse}
      bordered={false}
      className='rd-0'
    >
      <Collapse.Item
        header={
          <McpServerHeader
            server={server}
            isTestingConnection={isTestingConnection}
            oauthStatus={oauthStatus}
            isLoggingIn={isLoggingIn}
            isReadOnly={isReadOnly}
            onTestConnection={onTestConnection}
            onEditServer={onEditServer}
            onDeleteServer={onDeleteServer}
            onOAuthLogin={onOAuthLogin}
          />
        }
        name='1'
        className='[&>div:last-child]:py-3'
      >
        <McpServerToolsList server={server} />
      </Collapse.Item>
    </Collapse>
  );
};

export default McpServerItem;
