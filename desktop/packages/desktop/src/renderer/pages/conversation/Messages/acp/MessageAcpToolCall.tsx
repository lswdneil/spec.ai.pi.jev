/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageAcpToolCall } from '@/common/chat/chatLib';
import { getAcpImageFileName, getAcpImagePath } from '@/common/chat/acpToolCallOutput';
import FileChangesPanel from '@/renderer/components/base/FileChangesPanel';
import LocalImageView from '@/renderer/components/media/LocalImageView';
import { useDiffPreviewHandlers } from '@/renderer/hooks/file/useDiffPreviewHandlers';
import { parseDiff } from '@/renderer/utils/file/diffUtils';
import { downloadFileFromPath } from '@/renderer/utils/file/download';
import { Button } from '@/renderer/ui/button';
import { Card } from '@/renderer/ui/card';
import { Message } from '@/renderer/ui/toast';
import { Tag } from '@/renderer/ui/tag';
import { Tooltip } from '@/renderer/ui/tooltip';
import { Download } from '@icon-park/react';
import { createTwoFilesPatch } from 'diff';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { capOutput, clipOutput } from '../components/toolActivity';

type StatusTone = 'neutral' | 'success' | 'warning';

const statusTone = (status: string): StatusTone => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'warning';
    default:
      return 'neutral';
  }
};

const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  const getTagProps = () => {
    switch (status) {
      case 'pending':
        return { color: 'gray', text: t('common.kyrn.toolStatus.pending') };
      case 'in_progress':
        return { color: 'blue', text: t('common.kyrn.toolStatus.in_progress') };
      case 'completed':
        return { color: 'green', text: t('common.kyrn.toolStatus.completed') };
      case 'failed':
        return { color: 'orange', text: t('common.kyrn.toolStatus.failed') };
      default:
        // A status this build does not know is shown as the agent sent it rather than guessed at.
        return { color: 'gray', text: status };
    }
  };

  const { color, text } = getTagProps();
  return <Tag color={color}>{text}</Tag>;
};

const ToolOutputPreview: React.FC<{ text: string; testId: string }> = ({ text, testId }) => {
  const { t } = useTranslation();
  const [full, setFull] = useState(false);
  const capped = useMemo(() => capOutput(text), [text]);
  const clip = useMemo(() => clipOutput(capped.text), [capped.text]);
  const shown = full ? capped.text : clip.clipped ? `${clip.text}\n…` : capped.text;

  return (
    <>
      <pre
        dir='ltr'
        data-testid={testId}
        className='sv-dense-terminal-output sv-acp-tool-output bg-1 p-2 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap m-0'
      >
        {shown}
      </pre>
      {capped.truncated && (
        <div className='mt-1 text-11px text-t-secondary' data-testid={`${testId}-truncated`}>
          {t('conversation.terminal.truncated')}
        </div>
      )}
      {clip.clipped && (
        <Button
          className='mt-1'
          type='text'
          size='mini'
          data-testid={`${testId}-more`}
          onClick={() => setFull((value) => !value)}
        >
          {t(full ? 'tools.execution.showLess' : 'tools.execution.showMore')}
        </Button>
      )}
    </>
  );
};

// Diff content display as a separate component to ensure hooks are called unconditionally
const DiffContentView: React.FC<{ old_text: string; new_text: string; path: string }> = ({
  old_text,
  new_text,
  path,
}) => {
  const { t } = useTranslation();
  const display_name = path.split(/[/\\]/).pop() || path || t('tools.unknownFile');
  const formattedDiff = useMemo(
    () => createTwoFilesPatch(display_name, display_name, old_text, new_text, '', '', { context: 3 }),
    [display_name, old_text, new_text]
  );
  const fileInfo = useMemo(() => parseDiff(formattedDiff, display_name), [formattedDiff, display_name]);
  const { handleFileClick, handleDiffClick } = useDiffPreviewHandlers({
    diffText: formattedDiff,
    display_name,
    file_path: path || display_name,
  });

  return (
    <FileChangesPanel
      title={display_name}
      files={[fileInfo]}
      onFileClick={handleFileClick}
      onDiffClick={handleDiffClick}
      defaultExpanded={true}
    />
  );
};

const ContentView: React.FC<{ content: IMessageAcpToolCall['content']['update']['content'][0] }> = ({ content }) => {
  if (content.type === 'diff') {
    return (
      <DiffContentView old_text={content.old_text || ''} new_text={content.new_text || ''} path={content.path || ''} />
    );
  }

  // 处理 content 类型，包含 text 内容
  if (content.type === 'content' && content.content && content.content.type === 'text' && content.content.text) {
    return (
      <div className='mt-3'>
        <div className='sv-dense-code-block sv-acp-tool-output bg-1 p-3 rounded border overflow-hidden'>
          <ToolOutputPreview text={content.content.text} testId='acp-tool-call-output' />
        </div>
      </div>
    );
  }

  return null;
};

/** The card title when the agent sent none: the tool kind in the reader's language. */
const getKindDisplayName = (toolKind: string, t: ReturnType<typeof useTranslation>['t']) => {
  switch (toolKind) {
    case 'edit':
      return t('tools.kind.edit');
    case 'read':
      return t('tools.kind.read');
    case 'execute':
      return t('tools.shell.displayName');
    default:
      return toolKind;
  }
};

const MessageAcpToolCall: React.FC<{ message: IMessageAcpToolCall }> = ({ message }) => {
  const { t } = useTranslation();
  const { content } = message;
  if (!content?.update) {
    return null;
  }
  const { update } = content;
  const { tool_call_id, kind, title, status, rawInput, content: diffContent } = update;
  const hasOnlyDiffs =
    Array.isArray(diffContent) &&
    diffContent.length > 0 &&
    diffContent.every((contentItem) => contentItem.type === 'diff');
  const imagePath = getAcpImagePath(update);
  const imageAlt = imagePath?.split(/[/\\]/).pop() || t('acp.image.generated_alt');
  const [messageApi, messageContext] = Message.useMessage();
  const handleDownloadImage = useCallback(
    async (path: string) => {
      try {
        await downloadFileFromPath(path, getAcpImageFileName(path));
        messageApi.success(t('acp.image.download_success'));
      } catch (error) {
        console.error('[MessageAcpToolCall] Failed to download image:', error);
        messageApi.error(t('acp.image.download_error'));
      }
    },
    [messageApi, t]
  );

  if (hasOnlyDiffs) {
    return (
      <div className='w-full mb-2 flex flex-col gap-8px'>
        {diffContent.map((contentItem, index) => (
          <ContentView key={`${contentItem.path || 'diff'}-${index}`} content={contentItem} />
        ))}
      </div>
    );
  }

  return (
    <Card className='sv-dense-acp-card w-full mb-2' size='small' bordered data-status-tone={statusTone(status)}>
      {messageContext}
      <div className='flex items-start gap-3'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-2'>
            <span className='sv-dense-acp-title font-medium text-t-primary'>
              {title || getKindDisplayName(kind, t)}
            </span>
            <StatusTag status={status} />
          </div>
          {rawInput && (
            <div className='text-sm'>
              {typeof rawInput === 'string' ? (
                <ToolOutputPreview text={rawInput} testId='acp-tool-call-input' />
              ) : (
                <ToolOutputPreview text={JSON.stringify(rawInput, null, 2)} testId='acp-tool-call-input' />
              )}
            </div>
          )}
          {imagePath && (
            <div className='group relative mt-3 overflow-hidden rounded border bg-1 p-2'>
              <LocalImageView
                src={imagePath}
                alt={imageAlt}
                className='max-w-full max-h-[520px] object-contain rounded'
              />
              <Tooltip content={t('acp.image.download')}>
                <Button
                  aria-label={t('acp.image.download_aria')}
                  className='!absolute end-10px top-10px !h-28px !w-28px !p-0 opacity-0 shadow-sm transition-opacity group-hover:opacity-90 focus:opacity-100'
                  type='secondary'
                  size='mini'
                  shape='circle'
                  icon={<Download theme='outline' className='sv-icon-sm' />}
                  onClick={() => void handleDownloadImage(imagePath)}
                />
              </Tooltip>
            </div>
          )}
          {diffContent && diffContent.length > 0 && (
            <div>
              {diffContent.map((item, index) => (
                <ContentView key={index} content={item} />
              ))}
            </div>
          )}
          <div className='text-xs text-t-secondary mt-2'>{t('tools.labels.toolCallId', { id: tool_call_id })}</div>
        </div>
      </div>
    </Card>
  );
};

export default MessageAcpToolCall;
