import * as React from 'react';
import { useState } from 'react';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext';
import ShellPreview from './ShellPreview';
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Dropdown,
  Empty,
  Input,
  Modal,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tag,
  toast,
  Tooltip,
} from '@renderer/ui';

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className='border-t border-sv-line py-6 first:border-0 first:pt-0'>
    <h2 className='text-[13px] font-medium text-sv-text'>{title}</h2>
    {hint ? <p className='mt-1 text-[11.5px] text-sv-muted'>{hint}</p> : null}
    <div className='mt-3'>{children}</div>
  </section>
);

const DesignSystem: React.FC = () => {
  const { activeId, selectTheme } = useThemeContext();
  const [switchOn, setSwitchOn] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const mode = activeId === 'dark' ? 'dark' : activeId === 'light' ? 'light' : 'auto';

  return (
    <div className='h-full overflow-auto bg-sv-bg text-sv-text' style={{ fontFamily: 'var(--sv-font-ui)' }}>
      <div className='mx-auto max-w-[980px] px-8 py-8'>
        <header className='flex flex-wrap items-end gap-4'>
          <div>
            <p className='text-[10px] uppercase tracking-[0.1em] text-sv-faint'>Phase 1 · internal</p>
            <h1 className='mt-2 text-[26px] font-semibold leading-[1.35] tracking-[-0.02em]'>Design system</h1>
            <p className='mt-1 text-[13px] text-sv-muted'>
              Dense primitives, tokens and states. No Arco imports on this page.
            </p>
          </div>
          <div className='ml-auto flex items-center gap-1 rounded-full border border-sv-line bg-sv-surface p-0.5'>
            {(['dark', 'light', 'auto'] as const).map((value) => (
              <button
                key={value}
                type='button'
                onClick={() => void selectTheme(value === 'auto' ? 'system' : value)}
                aria-pressed={mode === value}
                className={
                  mode === value
                    ? 'rounded-full bg-sv-raised px-3 py-1 text-[11px] text-sv-text'
                    : 'rounded-full px-3 py-1 text-[11px] text-sv-muted hover:text-sv-text'
                }
              >
                {value === 'auto' ? 'Auto' : value === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </header>

        <div className='mt-8'>
          <Section
            title='Dense shell'
            hint='The target shell with mock content. Phase 2 wires it to the real stores and router.'
          >
            <ShellPreview />
          </Section>

          <Section title='Colour' hint='Namespaced --sv-* tokens; one accent, no shadows.'>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-5'>
              {[
                ['bg', 'bg-sv-bg'],
                ['chrome', 'bg-sv-chrome'],
                ['surface', 'bg-sv-surface'],
                ['surface-2', 'bg-sv-surface-2'],
                ['raised', 'bg-sv-raised'],
                ['brand', 'bg-sv-brand'],
                ['selected', 'bg-sv-selected'],
                ['danger', 'bg-sv-danger'],
                ['warn', 'bg-sv-warn'],
                ['ok', 'bg-sv-ok'],
              ].map(([label, className]) => (
                <div key={label} className='rounded-[8px] border border-sv-line p-2'>
                  <div className={`h-8 rounded-[5px] border border-sv-line ${className}`} />
                  <p className='mt-1.5 font-mono text-[9.5px] text-sv-faint'>{label}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title='Button' hint='Primary, secondary, ghost, text, danger. Arco type/htmlType still accepted.'>
            <div className='flex flex-wrap items-center gap-2'>
              <Button type='primary'>Primary</Button>
              <Button>Secondary</Button>
              <Button variant='ghost'>Ghost</Button>
              <Button variant='text'>Text</Button>
              <Button status='danger'>Danger</Button>
              <Button type='primary' loading>
                Loading
              </Button>
              <Button type='primary' disabled>
                Disabled
              </Button>
            </div>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <Button type='primary' size='sm'>
                Small
              </Button>
              <Button type='primary' size='md'>
                Medium
              </Button>
              <Button type='primary' size='lg'>
                Large
              </Button>
            </div>
          </Section>

          <Section title='Input' hint='Labels are visible; focus uses the brand ring.'>
            <div className='grid gap-3 sm:grid-cols-2'>
              <label className='grid gap-1.5 text-[11.5px] text-sv-muted'>
                Workspace name
                <Input placeholder='spec.ai.pi.jev' />
              </label>
              <label className='grid gap-1.5 text-[11.5px] text-sv-muted'>
                Model
                <Input defaultValue='claude-sonnet-4.5' status='error' />
                <span className='text-[10.5px] text-sv-danger'>This model needs a key.</span>
              </label>
            </div>
          </Section>

          <Section title='Tag, alert, switch'>
            <div className='flex flex-wrap items-center gap-2'>
              <Tag>Neutral</Tag>
              <Tag tone='brand'>Brand</Tag>
              <Tag tone='success'>Sure</Tag>
              <Tag tone='warning'>Unsure</Tag>
              <Tag tone='danger'>Failed</Tag>
              <Tag tone='info'>Info</Tag>
              <Switch checked={switchOn} onChange={setSwitchOn} aria-label='Reduce motion' />
              <span className='text-[11.5px] text-sv-muted'>Reduce motion</span>
            </div>
            <div className='mt-3 grid gap-2 sm:grid-cols-2'>
              <Alert tone='info' title='Sync is on'>
                The board is written by the model you picked.
              </Alert>
              <Alert tone='error' title='ACP stopped'>
                The transport closed before initialize. Check the launcher.
              </Alert>
            </div>
          </Section>

          <Section title='Overlays' hint='Radix dialog and dropdown, flat surfaces, no shadows.'>
            <div className='flex flex-wrap items-center gap-2'>
              <Button type='primary' onClick={() => setModalOpen(true)}>
                Open modal
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Permission</DialogTitle>
                  <DialogDescription>spec.jev wants to run a command.</DialogDescription>
                  <p className='mt-3 font-mono text-[11.5px] text-sv-text'>npm test -- --watch=false</p>
                  <div className='mt-4 flex justify-end gap-2'>
                    <Button onClick={() => setDialogOpen(false)}>Deny</Button>
                    <Button type='primary' onClick={() => setDialogOpen(false)}>
                      Allow once
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dropdown
                items={[
                  { key: 'rename', label: 'Rename' },
                  { key: 'duplicate', label: 'Duplicate' },
                  { key: 'sep', separator: true },
                  { key: 'delete', label: 'Delete', danger: true },
                ]}
              >
                <Button>Open menu</Button>
              </Dropdown>
              <Tooltip content='The judge reviews each step.'>
                <Button variant='ghost'>Hover for tooltip</Button>
              </Tooltip>
              <Button
                onClick={() => {
                  toast.success('Saved');
                }}
              >
                Toast
              </Button>
            </div>
          </Section>

          <Section title='Tabs, empty, loading'>
            <Tabs defaultValue='overview'>
              <TabsList>
                <TabsTrigger value='overview'>Overview</TabsTrigger>
                <TabsTrigger value='activity'>Activity</TabsTrigger>
                <TabsTrigger value='files'>Files</TabsTrigger>
              </TabsList>
              <TabsContent value='overview' className='mt-3 text-[12px] text-sv-muted'>
                Dense tabs use a 32px track and 24px triggers.
              </TabsContent>
              <TabsContent value='activity' className='mt-3 text-[12px] text-sv-muted'>
                Judge steps, tool calls and verdicts live here.
              </TabsContent>
              <TabsContent value='files' className='mt-3 text-[12px] text-sv-muted'>
                Changed files and diffs.
              </TabsContent>
            </Tabs>
            <div className='mt-3 grid gap-3 sm:grid-cols-2'>
              <Card>
                <Empty
                  title='No skills yet'
                  description='Add a skill folder or import one from Claude Code.'
                  action={<Button type='primary'>Add skill</Button>}
                />
              </Card>
              <Card className='flex items-center justify-center gap-3 p-6'>
                <Spinner />
                <span className='text-[12px] text-sv-muted'>Loading the session…</span>
              </Card>
            </div>
          </Section>
        </div>
      </div>

      <Modal
        visible={modalOpen}
        onCancel={() => setModalOpen(false)}
        title='Connect a model'
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type='primary' onClick={() => setModalOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        Paste an API key or pick a service. The key is stored in spec.jev's home.
      </Modal>
    </div>
  );
};

export default DesignSystem;
