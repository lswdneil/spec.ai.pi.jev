/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { ipcBridge } from '@/common';
import { addRecentWorkspace } from '@/renderer/components/workspace/recentWorkspaces';
import type { I18nKey } from '@/renderer/services/i18n';
import { Button } from '@/renderer/ui/button';
import { cn } from '@/renderer/ui/cn';
import { Modal } from '@/renderer/ui/dialog';
import { Input, Textarea } from '@/renderer/ui/input';
import {
  Chip,
  Cpu,
  FileExcel,
  FilePdf,
  FilePpt,
  FileWord,
  FolderClose,
  GridFour,
  Ruler,
  Search,
  TreeDiagram,
} from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type QuickActionSkill = {
  name: string;
  description: string;
};

type QuickActionFieldOption = {
  value: string;
  labelKey: I18nKey;
  /** The sentence inserted into the prompt when it differs from the chip label. */
  promptKey?: I18nKey;
};

type QuickActionField = {
  key: string;
  promptVar: string;
  labelKey: I18nKey;
  options: QuickActionFieldOption[];
};

type QuickActionId = 'pptx' | 'docx' | 'xlsx' | 'diagram' | 'pdf' | 'sch' | 'pcb' | 'cad';

type QuickActionCard = {
  id: QuickActionId;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  nameKey: I18nKey;
  descKey: I18nKey;
};

type QuickActionReady = QuickActionCard & {
  comingSoon?: false;
  /** Installed skill names that can serve this capability, preferred name first. */
  skills: readonly string[];
  hintKey: I18nKey;
  placeholderKey: I18nKey;
  promptKey: I18nKey;
  fields: QuickActionField[];
  defaults: Record<string, string>;
};

/** A card that announces a capability this build does not ship yet. It opens a notice instead of the composer. */
type QuickActionComingSoon = QuickActionCard & {
  comingSoon: true;
};

type QuickActionCapability = QuickActionReady | QuickActionComingSoon;

const isComingSoonCard = (capability: QuickActionCapability): capability is QuickActionComingSoon =>
  capability.comingSoon === true;

const isReadyCard = (capability: QuickActionCapability): capability is QuickActionReady =>
  !isComingSoonCard(capability);

const QUICK_ACTIONS: readonly QuickActionCapability[] = [
  {
    id: 'pptx',
    skills: ['pptx', 'officecli-pptx', 'officecli'],
    icon: FilePpt,
    nameKey: 'conversation.quickActions.pptx.name',
    descKey: 'conversation.quickActions.pptx.desc',
    hintKey: 'conversation.quickActions.pptx.hint',
    placeholderKey: 'conversation.quickActions.pptx.placeholder',
    promptKey: 'conversation.quickActions.pptx.prompt',
    fields: [
      {
        key: 'pages',
        promptVar: 'pages',
        labelKey: 'conversation.quickActions.field.pages',
        options: [
          {
            value: '8',
            labelKey: 'conversation.quickActions.value.pages8',
            promptKey: 'conversation.quickActions.pptx.pages8Prompt',
          },
          {
            value: '12',
            labelKey: 'conversation.quickActions.value.pages12',
            promptKey: 'conversation.quickActions.pptx.pages12Prompt',
          },
          {
            value: '20',
            labelKey: 'conversation.quickActions.value.pages20',
            promptKey: 'conversation.quickActions.pptx.pages20Prompt',
          },
          {
            value: 'unlimited',
            labelKey: 'conversation.quickActions.value.unlimited',
            promptKey: 'conversation.quickActions.pptx.pagesUnlimitedPrompt',
          },
        ],
      },
      {
        key: 'style',
        promptVar: 'style',
        labelKey: 'conversation.quickActions.field.style',
        options: [
          { value: 'minimal', labelKey: 'conversation.quickActions.value.styleMinimal' },
          { value: 'business', labelKey: 'conversation.quickActions.value.styleBusiness' },
          { value: 'tech', labelKey: 'conversation.quickActions.value.styleTech' },
        ],
      },
    ],
    defaults: { pages: '12', style: 'minimal' },
  },
  {
    id: 'docx',
    skills: ['docx', 'officecli-docx', 'officecli'],
    icon: FileWord,
    nameKey: 'conversation.quickActions.docx.name',
    descKey: 'conversation.quickActions.docx.desc',
    hintKey: 'conversation.quickActions.docx.hint',
    placeholderKey: 'conversation.quickActions.docx.placeholder',
    promptKey: 'conversation.quickActions.docx.prompt',
    fields: [
      {
        key: 'docType',
        promptVar: 'docType',
        labelKey: 'conversation.quickActions.field.docType',
        options: [
          { value: 'report', labelKey: 'conversation.quickActions.value.report' },
          { value: 'proposal', labelKey: 'conversation.quickActions.value.proposal' },
          { value: 'summary', labelKey: 'conversation.quickActions.value.summary' },
        ],
      },
      {
        key: 'length',
        promptVar: 'length',
        labelKey: 'conversation.quickActions.field.length',
        options: [
          {
            value: 'short',
            labelKey: 'conversation.quickActions.value.lengthShort',
            promptKey: 'conversation.quickActions.docx.lengthShortPrompt',
          },
          {
            value: 'medium',
            labelKey: 'conversation.quickActions.value.lengthMedium',
            promptKey: 'conversation.quickActions.docx.lengthMediumPrompt',
          },
          {
            value: 'long',
            labelKey: 'conversation.quickActions.value.lengthLong',
            promptKey: 'conversation.quickActions.docx.lengthLongPrompt',
          },
          {
            value: 'unlimited',
            labelKey: 'conversation.quickActions.value.unlimited',
            promptKey: 'conversation.quickActions.docx.lengthUnlimitedPrompt',
          },
        ],
      },
    ],
    defaults: { docType: 'report', length: 'medium' },
  },
  {
    id: 'xlsx',
    skills: ['xlsx', 'officecli-xlsx', 'officecli'],
    icon: FileExcel,
    nameKey: 'conversation.quickActions.xlsx.name',
    descKey: 'conversation.quickActions.xlsx.desc',
    hintKey: 'conversation.quickActions.xlsx.hint',
    placeholderKey: 'conversation.quickActions.xlsx.placeholder',
    promptKey: 'conversation.quickActions.xlsx.prompt',
    fields: [
      {
        key: 'sheetType',
        promptVar: 'sheetType',
        labelKey: 'conversation.quickActions.field.sheetType',
        options: [
          { value: 'stats', labelKey: 'conversation.quickActions.value.stats' },
          { value: 'list', labelKey: 'conversation.quickActions.value.list' },
          { value: 'budget', labelKey: 'conversation.quickActions.value.budget' },
        ],
      },
      {
        key: 'data',
        promptVar: 'data',
        labelKey: 'conversation.quickActions.field.data',
        options: [
          {
            value: 'sample',
            labelKey: 'conversation.quickActions.value.sampleData',
            promptKey: 'conversation.quickActions.xlsx.dataSample',
          },
          {
            value: 'user',
            labelKey: 'conversation.quickActions.value.myData',
            promptKey: 'conversation.quickActions.xlsx.dataUser',
          },
        ],
      },
    ],
    defaults: { sheetType: 'stats', data: 'sample' },
  },
  {
    id: 'diagram',
    skills: ['stack-diagram', 'mermaid'],
    icon: TreeDiagram,
    nameKey: 'conversation.quickActions.diagram.name',
    descKey: 'conversation.quickActions.diagram.desc',
    hintKey: 'conversation.quickActions.diagram.hint',
    placeholderKey: 'conversation.quickActions.diagram.placeholder',
    promptKey: 'conversation.quickActions.diagram.prompt',
    fields: [
      {
        key: 'diagramType',
        promptVar: 'diagramType',
        labelKey: 'conversation.quickActions.field.diagramType',
        options: [
          { value: 'flow', labelKey: 'conversation.quickActions.value.flow' },
          { value: 'architecture', labelKey: 'conversation.quickActions.value.architecture' },
          { value: 'sequence', labelKey: 'conversation.quickActions.value.sequence' },
        ],
      },
      {
        key: 'detail',
        promptVar: 'detail',
        labelKey: 'conversation.quickActions.field.detail',
        options: [
          { value: 'concise', labelKey: 'conversation.quickActions.value.concise' },
          { value: 'detailed', labelKey: 'conversation.quickActions.value.detailed' },
        ],
      },
      {
        key: 'output',
        promptVar: 'output',
        labelKey: 'conversation.quickActions.field.output',
        options: [
          { value: 'html', labelKey: 'conversation.quickActions.value.html' },
          { value: 'html-png', labelKey: 'conversation.quickActions.value.htmlPng' },
        ],
      },
    ],
    defaults: { diagramType: 'flow', detail: 'concise', output: 'html' },
  },
  {
    id: 'pdf',
    skills: ['pdf', 'officecli'],
    icon: FilePdf,
    nameKey: 'conversation.quickActions.pdf.name',
    descKey: 'conversation.quickActions.pdf.desc',
    hintKey: 'conversation.quickActions.pdf.hint',
    placeholderKey: 'conversation.quickActions.pdf.placeholder',
    promptKey: 'conversation.quickActions.pdf.prompt',
    fields: [
      {
        key: 'pdfType',
        promptVar: 'docType',
        labelKey: 'conversation.quickActions.field.pdfType',
        options: [
          { value: 'report', labelKey: 'conversation.quickActions.value.report' },
          { value: 'resume', labelKey: 'conversation.quickActions.value.resume' },
          { value: 'guide', labelKey: 'conversation.quickActions.value.guide' },
        ],
      },
    ],
    defaults: { pdfType: 'report' },
  },
  {
    id: 'sch',
    comingSoon: true,
    icon: Cpu,
    nameKey: 'conversation.quickActions.sch.name',
    descKey: 'conversation.quickActions.sch.desc',
  },
  {
    id: 'pcb',
    comingSoon: true,
    icon: Chip,
    nameKey: 'conversation.quickActions.pcb.name',
    descKey: 'conversation.quickActions.pcb.desc',
  },
  {
    id: 'cad',
    comingSoon: true,
    icon: Ruler,
    nameKey: 'conversation.quickActions.cad.name',
    descKey: 'conversation.quickActions.cad.desc',
  },
];

const FEATURED_SKILLS = new Set(QUICK_ACTIONS.filter(isReadyCard).flatMap((capability) => capability.skills));

type Props = {
  /** Reachable skills: every installed skill on the start page, loaded ones inside a chat. */
  skills: readonly QuickActionSkill[];
  onSendPrompt: (prompt: string, skillName: string) => Promise<boolean | void>;
  onInsertSkill: (name: string) => void;
  /** Enables a skill that the current conversation has not loaded yet. */
  onLoadSkill?: (name: string) => void;
  /** The folder the new conversation works in; omit where the cards have no workspace of their own. */
  workspaceDir?: string;
  onSelectWorkspace?: (dir: string) => void;
  /** The native host cannot start a conversation without a folder. */
  workspaceRequired?: boolean;
  className?: string;
};

const QuickActions: React.FC<Props> = ({
  skills,
  onSendPrompt,
  onInsertSkill,
  onLoadSkill,
  workspaceDir = '',
  onSelectWorkspace,
  workspaceRequired = false,
  className,
}) => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const topicInputRef = useRef<HTMLInputElement | null>(null);
  const [activeId, setActiveId] = useState<QuickActionCapability['id'] | null>(null);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [topicError, setTopicError] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [comingSoonId, setComingSoonId] = useState<QuickActionComingSoon['id'] | null>(null);
  const [workspaceError, setWorkspaceError] = useState(false);

  useEffect(() => {
    if (workspaceDir) setWorkspaceError(false);
  }, [workspaceDir]);

  const availableSkills = useMemo(() => new Set(skills.map((skill) => skill.name)), [skills]);
  const resolvedSkills = useMemo(() => {
    const resolved = new Map<QuickActionId, string>();
    for (const capability of QUICK_ACTIONS) {
      if (!isReadyCard(capability)) continue;
      const skillName = capability.skills.find((candidate) => availableSkills.has(candidate));
      if (skillName) resolved.set(capability.id, skillName);
    }
    return resolved;
  }, [availableSkills]);
  const cards = useMemo(() => {
    const ready = QUICK_ACTIONS.filter(
      (capability): capability is QuickActionReady => isReadyCard(capability) && resolvedSkills.has(capability.id)
    );
    // Announcements ride with the ready cards: no installed skill means no card section at all.
    if (ready.length === 0) return [];
    return [...ready, ...QUICK_ACTIONS.filter(isComingSoonCard)];
  }, [resolvedSkills]);
  const moreSkills = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return skills
      .filter((skill) => !FEATURED_SKILLS.has(skill.name))
      .filter((skill) => {
        if (!keyword) return true;
        return skill.name.toLowerCase().includes(keyword) || (skill.description ?? '').toLowerCase().includes(keyword);
      });
  }, [query, skills]);

  const activeCapability =
    QUICK_ACTIONS.find(
      (capability): capability is QuickActionReady => isReadyCard(capability) && capability.id === activeId
    ) ?? null;
  const comingSoonCapability =
    QUICK_ACTIONS.find(
      (capability): capability is QuickActionComingSoon =>
        isComingSoonCard(capability) && capability.id === comingSoonId
    ) ?? null;
  const activeIcon = activeCapability?.icon;
  const activeSkillName = activeCapability ? (resolvedSkills.get(activeCapability.id) ?? '') : '';

  const openCapability = useCallback((capability: QuickActionReady) => {
    setActiveId(capability.id);
    setTopic('');
    setNotes('');
    setTopicError(false);
    setChoices({ ...capability.defaults });
    setWorkspaceError(false);
  }, []);

  const closeCapability = useCallback(() => {
    if (sending) return;
    setActiveId(null);
  }, [sending]);

  const buildPrompt = useCallback(
    (
      capability: QuickActionReady,
      skillName: string,
      text: string,
      picked: Record<string, string>,
      notesText: string
    ) => {
      const values: Record<string, string> = { topic: text, skill: skillName };
      for (const field of capability.fields) {
        const value = picked[field.key] ?? capability.defaults[field.key];
        const option = field.options.find((candidate) => candidate.value === value) ?? field.options[0];
        values[field.promptVar] = t(option.promptKey ?? option.labelKey);
      }
      const prompt = t(capability.promptKey, values);
      const trimmedNotes = notesText.trim();
      return trimmedNotes ? `${prompt} ${t('conversation.quickActions.notesPrompt', { notes: trimmedNotes })}` : prompt;
    },
    [t]
  );

  const handleGenerate = useCallback(async () => {
    if (!activeCapability || !activeSkillName || sending) return;
    if (workspaceRequired && !workspaceDir) {
      setWorkspaceError(true);
      return;
    }
    const trimmed = topic.trim();
    if (!trimmed) {
      setTopicError(true);
      topicInputRef.current?.focus();
      return;
    }
    setSending(true);
    try {
      const result = await onSendPrompt(
        buildPrompt(activeCapability, activeSkillName, trimmed, choices, notes),
        activeSkillName
      );
      if (result === false) return;
      setActiveId(null);
    } catch {
      // The send path reports its own error and the dialog stays open for a retry.
    } finally {
      setSending(false);
    }
  }, [
    activeCapability,
    activeSkillName,
    buildPrompt,
    choices,
    notes,
    onSendPrompt,
    sending,
    topic,
    workspaceDir,
    workspaceRequired,
  ]);

  const chooseWorkspace = useCallback(() => {
    if (!onSelectWorkspace) return;
    ipcBridge.dialog.showOpen
      .invoke({ properties: ['openDirectory', 'createDirectory'] })
      .then((dirs) => {
        if (dirs && dirs[0]) {
          addRecentWorkspace(dirs[0]);
          onSelectWorkspace(dirs[0]);
          setWorkspaceError(false);
        }
      })
      .catch((error) => {
        console.error('Failed to open directory dialog:', error);
      });
  }, [onSelectWorkspace]);

  const handleInsertSkill = useCallback(
    (name: string) => {
      onLoadSkill?.(name);
      onInsertSkill(name);
      setMoreOpen(false);
      setQuery('');
    },
    [onInsertSkill, onLoadSkill]
  );

  if (isMobile || cards.length === 0) {
    return null;
  }

  return (
    <>
      <div className={cn('w-full', className)}>
        <div
          className='sendbox-quick-actions grid w-full grid-cols-2 items-stretch gap-2 sm:grid-cols-3'
          data-testid='quick-action-cards'
        >
          {cards.map((capability) => {
            const Icon = capability.icon;
            return (
              <button
                key={capability.id}
                type='button'
                data-testid={`quick-action-${capability.id}`}
                onClick={() => {
                  if (isComingSoonCard(capability)) {
                    setComingSoonId(capability.id);
                    return;
                  }
                  openCapability(capability);
                }}
                className='group flex h-[58px] w-full min-w-0 items-center gap-2.5 rounded-[12px] border border-sv-line bg-sv-surface px-3 text-left outline-none transition-colors hover:border-sv-line-strong hover:bg-sv-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sv-focus'
              >
                <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-sv-surface-2 text-sv-muted transition-colors group-hover:text-sv-text'>
                  <Icon size={17} />
                </span>
                <span className='min-w-0'>
                  <span className='block truncate text-[12.5px] font-medium text-sv-text'>{t(capability.nameKey)}</span>
                  <span className='mt-0.5 block truncate text-[11px] text-sv-faint'>{t(capability.descKey)}</span>
                </span>
              </button>
            );
          })}
          {moreSkills.length > 0 && (
            <button
              type='button'
              data-testid='quick-action-more'
              onClick={() => setMoreOpen(true)}
              className='group flex h-[58px] w-full min-w-0 items-center gap-2.5 rounded-[12px] border border-sv-line bg-sv-surface px-3 text-left outline-none transition-colors hover:border-sv-line-strong hover:bg-sv-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sv-focus'
            >
              <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-sv-surface-2 text-sv-muted transition-colors group-hover:text-sv-text'>
                <GridFour size={17} />
              </span>
              <span className='min-w-0'>
                <span className='block truncate text-[12.5px] font-medium text-sv-text'>
                  {t('conversation.quickActions.more')}
                </span>
                <span className='mt-0.5 block truncate text-[11px] text-sv-faint'>
                  {t('conversation.quickActions.moreDesc')}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>

      <Modal
        visible={Boolean(activeCapability)}
        onCancel={closeCapability}
        maskClosable={false}
        width={480}
        className='max-h-[calc(100vh-32px)] overflow-y-auto overflow-x-hidden'
        title={
          activeCapability && activeIcon ? (
            <span className='flex items-center gap-2'>
              {React.createElement(activeIcon, { size: 18, className: 'text-sv-muted' })}
              {t(activeCapability.nameKey)}
            </span>
          ) : null
        }
        description={activeCapability ? t(activeCapability.hintKey) : null}
        footer={
          <div className='flex items-center justify-end gap-2'>
            <Button variant='secondary' onClick={closeCapability} disabled={sending}>
              {t('common.cancel')}
            </Button>
            <Button variant='primary' loading={sending} onClick={() => void handleGenerate()}>
              {t('conversation.quickActions.generate')}
            </Button>
          </div>
        }
        data-testid='quick-action-dialog'
      >
        {activeCapability && (
          <div className='flex flex-col gap-3.5'>
            {onSelectWorkspace && (
              <div>
                <div className='mb-1 block text-[12px] text-sv-muted'>
                  {t('conversation.quickActions.workspace')}
                  {workspaceRequired ? <span className='ms-1 text-sv-danger'>*</span> : null}
                </div>
                <div className='flex items-center gap-2'>
                  <div
                    title={workspaceDir || undefined}
                    data-testid='quick-action-workspace-path'
                    className={cn(
                      'flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[var(--sv-r-control)] border px-3 text-[12.5px]',
                      workspaceError ? 'border-sv-danger' : 'border-sv-line',
                      workspaceDir ? 'text-sv-text' : 'text-sv-faint'
                    )}
                  >
                    <FolderClose size={15} className='shrink-0 text-sv-muted' />
                    <span className='min-w-0 truncate'>{workspaceDir || t('conversation.quickActions.notChosen')}</span>
                  </div>
                  <Button
                    size='small'
                    variant='secondary'
                    className='shrink-0'
                    data-testid='quick-action-workspace'
                    onClick={chooseWorkspace}
                  >
                    {t('conversation.quickActions.chooseFolder')}
                  </Button>
                </div>
                {workspaceError && (
                  <div className='mt-1 text-[11.5px] text-sv-danger'>{t('mu.native.home.noFolder')}</div>
                )}
              </div>
            )}
            <div>
              <label className='mb-1 block text-[12px] text-sv-muted' htmlFor='quick-action-topic'>
                {t('conversation.quickActions.topic')}
              </label>
              <Input
                id='quick-action-topic'
                ref={topicInputRef}
                autoFocus
                value={topic}
                status={topicError ? 'error' : 'normal'}
                placeholder={t(activeCapability.placeholderKey)}
                onChange={(value) => {
                  setTopic(value);
                  if (topicError) setTopicError(false);
                }}
                onPressEnter={(event) => {
                  if (!event.nativeEvent.isComposing) void handleGenerate();
                }}
              />
              {topicError && (
                <div className='mt-1 text-[11.5px] text-sv-danger'>{t('conversation.quickActions.topicRequired')}</div>
              )}
            </div>
            <div>
              <label className='mb-1 block text-[12px] text-sv-muted' htmlFor='quick-action-notes'>
                {t('conversation.quickActions.otherRequirements')}
              </label>
              <Textarea
                id='quick-action-notes'
                value={notes}
                onChange={setNotes}
                placeholder={t('conversation.quickActions.notesPlaceholder')}
                rows={3}
                className='text-[13px]'
              />
            </div>
            {activeCapability.fields.map((field) => (
              <div key={field.key}>
                <div className='mb-1.5 text-[12px] text-sv-muted'>{t(field.labelKey)}</div>
                <div className='flex flex-wrap gap-1.5'>
                  {field.options.map((option) => {
                    const selected = (choices[field.key] ?? activeCapability.defaults[field.key]) === option.value;
                    return (
                      <button
                        key={option.value}
                        type='button'
                        aria-pressed={selected}
                        onClick={() => setChoices((previous) => ({ ...previous, [field.key]: option.value }))}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[12px] outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sv-focus',
                          selected
                            ? 'border-sv-brand bg-sv-selected text-sv-text'
                            : 'border-sv-line bg-transparent text-sv-muted hover:border-sv-line-strong hover:text-sv-text'
                        )}
                      >
                        {t(option.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        visible={moreOpen}
        onCancel={() => setMoreOpen(false)}
        maskClosable={false}
        width={520}
        title={t('conversation.quickActions.moreTitle')}
        description={t('conversation.quickActions.moreHint')}
        footer={null}
        data-testid='quick-action-more-dialog'
      >
        <Input
          value={query}
          onChange={setQuery}
          placeholder={t('conversation.quickActions.moreSearch')}
          prefix={<Search size={14} className='text-sv-faint' />}
          allowClear
          onClear={() => setQuery('')}
        />
        <div className='mt-3 max-h-[320px] overflow-y-auto rounded-[10px] border border-sv-line bg-sv-surface'>
          {moreSkills.length === 0 ? (
            <div className='px-3 py-6 text-center text-[12px] text-sv-faint'>
              {t('conversation.quickActions.moreEmpty')}
            </div>
          ) : (
            moreSkills.map((skill) => (
              <button
                key={skill.name}
                type='button'
                onClick={() => handleInsertSkill(skill.name)}
                className='flex w-full items-start gap-2.5 border-b border-sv-line bg-transparent px-3 py-2.5 text-left outline-none transition-colors last:border-b-0 hover:bg-sv-surface-2 focus-visible:bg-sv-surface-2'
              >
                <span className='mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-sv-surface-2 font-mono text-[11px] text-sv-muted'>
                  /
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-[12.5px] font-medium text-sv-text'>{skill.name}</span>
                  <span className='mt-0.5 block truncate text-[11px] text-sv-faint'>
                    {skill.description || t('conversation.quickActions.moreNoDescription')}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </Modal>

      <Modal
        visible={Boolean(comingSoonCapability)}
        onCancel={() => setComingSoonId(null)}
        maskClosable={false}
        width={420}
        title={comingSoonCapability ? t(comingSoonCapability.nameKey) : null}
        footer={
          <div className='flex items-center justify-end'>
            <Button variant='primary' onClick={() => setComingSoonId(null)}>
              {t('common.confirm')}
            </Button>
          </div>
        }
        data-testid='quick-action-coming-soon'
      >
        <div className='text-[13px] leading-6 text-sv-text'>{t('conversation.quickActions.comingSoon')}</div>
      </Modal>
    </>
  );
};

export default QuickActions;
