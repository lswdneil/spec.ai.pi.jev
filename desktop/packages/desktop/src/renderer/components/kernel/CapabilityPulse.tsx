import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MuMcpServer, MuSkill, MuSkills, MuMcpServers } from '@/common/kyrn/capabilities';
import { kyrnBridge } from '@/common/kyrn/bridge';
import type { KyrnResult } from '@/common/kyrn/errors';
import type { NativeView } from '@/common/utils/nativeHost';
import { mcpServerDisplayName } from '@/renderer/hooks/mcp/mcpServerLabel';
import { capabilityActivity, type CapabilityActivity } from './capabilityActivity';
import styles from './CapabilityPulse.module.css';

type Catalog = {
  loading: boolean;
  failed: boolean;
  mcp: MuMcpServer[];
  skills: MuSkill[];
};

const EMPTY_CATALOG: Catalog = { loading: true, failed: false, mcp: [], skills: [] };
const SKILL_LIMIT = 12;

/** `-` and `_` name the same MCP server, as pi's tool names do. */
const serverKey = (name: string): string => name.replace(/-/g, '_').toLowerCase();

const dataOf = <T,>(result: KyrnResult<T>): T | undefined => (result.ok ? result.data : undefined);

/** The configured MCP servers and skills, read once and again when the window comes back. */
function useCapabilityCatalog(): Catalog {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);

  useEffect(() => {
    let live = true;
    const read = async () => {
      const [mcp, skills] = await Promise.allSettled([kyrnBridge.mcpServers.invoke(), kyrnBridge.skills.invoke()]);
      if (!live) return;
      const mcpData = mcp.status === 'fulfilled' ? dataOf<MuMcpServers>(mcp.value) : undefined;
      const skillData = skills.status === 'fulfilled' ? dataOf<MuSkills>(skills.value) : undefined;
      setCatalog({
        loading: false,
        failed: !mcpData || !skillData,
        mcp: mcpData?.servers ?? [],
        skills: skillData?.skills ?? [],
      });
    };
    void read();
    const onFocus = () => {
      void read();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      live = false;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return catalog;
}

const timeLabel = (at: number, locale: string): string =>
  at > 0 ? new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

const statusClass = (status: CapabilityActivity['status']): string => {
  if (status === 'active') return styles.statusActive;
  if (status === 'error') return styles.statusError;
  if (status === 'info') return styles.statusInfo;
  return styles.statusDone;
};

/**
 * The kernel bar's right end: how many MCP servers and skills are configured, plus a pulse for what is being
 * loaded or called in the conversation on screen. Hover or focus opens the detail panel above the bar.
 */
const CapabilityPulse: React.FC<{ view?: NativeView }> = ({ view }) => {
  const { t, i18n } = useTranslation();
  const catalog = useCapabilityCatalog();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const events = useMemo(() => capabilityActivity(view), [view]);
  const active = events.filter((event) => event.status === 'active');
  const mcpEnabled = catalog.mcp.filter((server) => server.on).length;
  const activeMcp = new Set(active.filter((event) => event.category === 'mcp').map((event) => serverKey(event.name)));
  const activeSkills = new Set(active.filter((event) => event.category === 'skills').map((event) => event.name));
  const shownSkills = catalog.skills
    .toSorted((left, right) => Number(activeSkills.has(right.name)) - Number(activeSkills.has(left.name)))
    .slice(0, SKILL_LIMIT);
  const moreSkills = Math.max(0, catalog.skills.length - shownSkills.length);
  const nameOf = (event: CapabilityActivity): string => {
    if (event.category !== 'mcp') return event.name;
    const server = catalog.mcp.find((candidate) => serverKey(candidate.name) === serverKey(event.name));
    return server ? mcpServerDisplayName(server.name, t) : event.name;
  };
  const recent = events
    .filter((event) => event.status !== 'active')
    .slice(-8)
    .reverse();
  const busy = active.length > 0;
  const counts = `${t('common.kyrn.capabilities.mcp')} ${catalog.loading ? '…' : catalog.failed ? '—' : mcpEnabled} · ${t(
    'common.kyrn.capabilities.skills'
  )} ${catalog.loading ? '…' : catalog.failed ? '—' : catalog.skills.length}`;

  const detailOf = (event: CapabilityActivity): string => {
    if (event.kind === 'call' || event.kind === 'find') return event.detail ?? '';
    if (event.kind === 'load' && event.detail && /^\d+$/.test(event.detail))
      return t('common.kyrn.capabilities.tools', { count: Number(event.detail) });
    return event.detail ?? '';
  };

  const labelOf = (event: CapabilityActivity): string => {
    if (event.kind === 'suggest') return t('common.kyrn.capabilities.suggested');
    if (event.kind === 'find') return t('common.kyrn.capabilities.find');
    if (event.kind === 'call')
      return event.status === 'active'
        ? t('common.kyrn.capabilities.calling')
        : event.status === 'error'
          ? t('common.kyrn.capabilities.failed')
          : t('common.kyrn.capabilities.called');
    if (event.status === 'error') return t('common.kyrn.capabilities.failed');
    if (event.status === 'info') return t('common.kyrn.capabilities.updated');
    return t('common.kyrn.capabilities.loaded');
  };

  const closeOnOutsideFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  return (
    <div
      ref={root}
      className={styles.pulse}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={closeOnOutsideFocus}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type='button'
        className={styles.trigger}
        aria-label={t('common.kyrn.capabilities.aria', {
          mcp: mcpEnabled,
          skills: catalog.skills.length,
          active: active.length,
        })}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-testid='mu-capability-pulse'
      >
        <span
          className={`${styles.dot} ${busy ? styles.dotBusy : catalog.loading ? styles.dotLoading : ''}`}
          aria-hidden='true'
        />
        <span>{counts}</span>
        {busy ? (
          <span className={styles.badge} data-testid='mu-capability-active'>
            {active.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={styles.panel}
          role='dialog'
          aria-label={t('common.kyrn.capabilities.label')}
          data-testid='mu-capability-panel'
        >
          <div className={styles.header}>
            <span>{t('common.kyrn.capabilities.label')}</span>
            {busy ? <span className={styles.headerBusy}>{t('common.kyrn.capabilities.active')}</span> : null}
          </div>

          {catalog.loading ? <div className={styles.empty}>{t('common.kyrn.capabilities.loading')}</div> : null}

          {active.length > 0 ? (
            <section className={styles.section}>
              <h4>{t('common.kyrn.capabilities.active')}</h4>
              {active.map((event) => (
                <div className={styles.event} key={event.id}>
                  <span className={`${styles.eventDot} ${statusClass(event.status)}`} aria-hidden='true' />
                  <span className={styles.eventName}>{nameOf(event)}</span>
                  <span className={styles.eventMeta}>{labelOf(event)}</span>
                </div>
              ))}
            </section>
          ) : null}

          <section className={styles.section}>
            <h4>{t('common.kyrn.capabilities.mcp')}</h4>
            {catalog.mcp.length === 0 ? (
              <div className={styles.empty}>
                {catalog.failed ? t('common.kyrn.capabilities.unavailable') : t('common.kyrn.capabilities.noMcp')}
              </div>
            ) : (
              catalog.mcp.map((server) => {
                const activeHere = activeMcp.has(serverKey(server.name));
                return (
                  <div className={styles.row} key={server.name}>
                    <span
                      className={`${styles.eventDot} ${activeHere ? styles.statusActive : server.on ? styles.statusDone : styles.statusOff}`}
                      aria-hidden='true'
                    />
                    <span className={styles.rowName}>{mcpServerDisplayName(server.name, t)}</span>
                    <span className={styles.rowMeta}>
                      {activeHere
                        ? t('common.kyrn.capabilities.calling')
                        : server.on
                          ? t('common.kyrn.capabilities.enabled')
                          : t('common.kyrn.capabilities.off')}
                    </span>
                  </div>
                );
              })
            )}
          </section>

          <section className={styles.section}>
            <h4>{t('common.kyrn.capabilities.skills')}</h4>
            {catalog.skills.length === 0 ? (
              <div className={styles.empty}>{t('common.kyrn.capabilities.noSkills')}</div>
            ) : (
              <>
                {shownSkills.map((skill) => (
                  <div className={styles.row} key={skill.name}>
                    <span
                      className={`${styles.eventDot} ${activeSkills.has(skill.name) ? styles.statusActive : styles.statusDone}`}
                      aria-hidden='true'
                    />
                    <span className={styles.rowName} title={skill.description}>
                      {skill.name}
                    </span>
                    <span className={styles.rowMeta}>
                      {activeSkills.has(skill.name)
                        ? t('common.kyrn.capabilities.calling')
                        : t('common.kyrn.capabilities.enabled')}
                    </span>
                  </div>
                ))}
                {moreSkills > 0 ? (
                  <div className={styles.empty}>{t('common.kyrn.capabilities.more', { count: moreSkills })}</div>
                ) : null}
              </>
            )}
          </section>

          {recent.length > 0 ? (
            <section className={styles.section}>
              <h4>{t('common.kyrn.capabilities.recent')}</h4>
              {recent.map((event) => (
                <div className={styles.recent} key={event.id}>
                  <span className={styles.recentName}>
                    {nameOf(event)}
                    {detailOf(event) ? <span className={styles.recentDetail}>{detailOf(event)}</span> : null}
                  </span>
                  <span className={styles.recentMeta}>
                    {labelOf(event)}
                    {timeLabel(event.at, i18n.language) ? ` · ${timeLabel(event.at, i18n.language)}` : ''}
                  </span>
                </div>
              ))}
            </section>
          ) : null}

          <div className={styles.footer}>
            <span className={styles.footerText}>{t('common.kyrn.capabilities.settingsHint')}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CapabilityPulse;
