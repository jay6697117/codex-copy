import React, { useState } from 'react';
import {
  Inbox,
  Check,
  X,
  MessageSquare,
  Sparkles,
  Plus,
  Save,
  Play,
  CalendarClock,
  GitBranch,
  GitMerge,
  Trash2,
  Bot,
  Shield,
  Terminal,
  Lock,
  Globe,
  FileCode2,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import {
  AutomationJob,
  ModelId,
  NavSection,
  ReviewQueueItem,
  SandboxPolicy,
  SkillDefinition,
  SubagentConfig,
  WorktreeInfo,
} from '../types/codex';
import { writeWorkspaceFile } from '../services/appServerClient';

interface MainFeatureViewsProps {
  activeNav: Exclude<NavSection, 'threads'>;
  reviewQueue: ReviewQueueItem[];
  onApproveReviewItem: (id: string) => void;
  onRejectReviewItem: (id: string) => void;
  onOpenReviewInThread: (item: ReviewQueueItem) => void;
  skills: SkillDefinition[];
  onToggleSkill: (id: string) => void;
  onSaveSkill: (skill: SkillDefinition) => void;
  onCreateSkill: (skill: Omit<SkillDefinition, 'id'>) => void;
  onLaunchSkillThread: (skill: SkillDefinition) => void;
  automations: AutomationJob[];
  onToggleAutomation: (id: string) => void;
  onRunAutomationNow: (id: string) => void;
  onCreateAutomation: (job: Omit<AutomationJob, 'id' | 'lastRunAt' | 'nextRunAt' | 'status' | 'totalRuns'>) => void;
  worktrees: WorktreeInfo[];
  onCreateWorktree: (branch: string) => void;
  onMergeWorktree: (id: string) => void;
  onDeleteWorktree: (id: string) => void;
  onJumpToWorktreeThread: (worktree: WorktreeInfo) => void;
  subagents: SubagentConfig[];
  onSaveSubagent: (agent: SubagentConfig) => void;
  onCreateSubagent: (agent: Omit<SubagentConfig, 'id'>) => void;
  agentsMdContent: string;
  onSaveAgentsMd: (content: string) => void;
  sandboxPolicy: SandboxPolicy;
  onUpdateSandboxPolicy: (patch: Partial<SandboxPolicy>) => void;
}

export const MainFeatureViews: React.FC<MainFeatureViewsProps> = ({
  activeNav,
  reviewQueue,
  onApproveReviewItem,
  onRejectReviewItem,
  onOpenReviewInThread,
  skills,
  onToggleSkill,
  onSaveSkill,
  onCreateSkill,
  onLaunchSkillThread,
  automations,
  onToggleAutomation,
  onRunAutomationNow,
  onCreateAutomation,
  worktrees,
  onCreateWorktree,
  onMergeWorktree,
  onDeleteWorktree,
  onJumpToWorktreeThread,
  subagents,
  onSaveSubagent,
  onCreateSubagent,
  agentsMdContent,
  onSaveAgentsMd,
  sandboxPolicy,
  onUpdateSandboxPolicy,
}) => {
  // Skill Studio state
  const [selectedSkillId, setSelectedSkillId] = useState<string>(skills[0]?.id || '');
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<string>('All');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [skillSavedToast, setSkillSavedToast] = useState(false);

  // Automations state
  const [newAutoName, setNewAutoName] = useState('');
  const [newAutoCron, setNewAutoCron] = useState('0 9 * * 1-5');
  const [newAutoPrompt, setNewAutoPrompt] = useState('');
  const [newAutoSkill, setNewAutoSkill] = useState('linear-triage');

  // Worktrees state
  const [wtBranchInput, setWtBranchInput] = useState('');

  // Subagents state
  const [selectedSubagentId, setSelectedSubagentId] = useState<string>(subagents[0]?.id || '');
  const [newCommandRule, setNewCommandRule] = useState('');
  const [agentsMdDraft, setAgentsMdDraft] = useState(agentsMdContent);
  const [savedNotice, setSavedNotice] = useState('');

  const triggerSavedNotice = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(''), 2200);
  };

  // 1. REVIEW QUEUE VIEW
  if (activeNav === 'review_queue') {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-[#090A0F] space-y-6">
        <div className="flex items-center justify-between border-b border-[#222736] pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Inbox className="w-5 h-5 text-amber-400" />
              <span>Central Review Queue · Human-in-the-Loop Approvals</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Completed background Automations and parallel worktree runs land here for diff
              inspection before merging into your primary branch.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {reviewQueue.filter((i) => i.status === 'pending_review').length} Pending Review
          </span>
        </div>

        <div className="space-y-4">
          {reviewQueue.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-[#111520] border border-[#242B3D] p-5 space-y-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                        item.status === 'pending_review'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : item.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-mono text-cyan-300">
                      {item.automationName}
                    </span>
                    <span className="text-xs text-slate-500">· {item.createdAt}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#171C2B] border border-[#262F45] text-xs font-mono text-indigo-300 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    {item.worktreeBranch}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#171C2B] border border-[#262F45] text-xs font-mono">
                    <span className="text-emerald-400">+{item.diffSummary.additions}</span>{' '}
                    <span className="text-rose-400">-{item.diffSummary.deletions}</span>
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{item.summary}</p>

              {/* Inline Diff Preview for Queued Item */}
              {item.files.map((file) => (
                <div
                  key={file.id}
                  className="rounded-xl border border-[#222736] bg-[#0A0C12] overflow-hidden font-mono text-xs"
                >
                  <div className="px-3 py-1.5 bg-[#141824] border-b border-[#222736] flex items-center justify-between text-slate-300">
                    <span>{file.filePath}</span>
                    <span>
                      <span className="text-emerald-400">+{file.additions}</span>{' '}
                      <span className="text-rose-400">-{file.deletions}</span>
                    </span>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {file.hunks[0]?.lines.map((l, idx) => (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 rounded ${
                          l.type === 'add'
                            ? 'bg-emerald-950/30 text-emerald-200'
                            : l.type === 'del'
                            ? 'bg-rose-950/30 text-rose-200'
                            : 'text-slate-400'
                        }`}
                      >
                        {l.type === 'add' ? '+ ' : l.type === 'del' ? '- ' : '  '}
                        {l.content}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Review Queue Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#1D2332]">
                <button
                  onClick={() => onOpenReviewInThread(item)}
                  className="px-3 py-1.5 rounded-lg bg-[#1A2030] hover:bg-[#222A3E] text-slate-200 border border-[#2C354D] text-xs font-medium flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open in Thread & Steer</span>
                </button>
                {item.status === 'pending_review' && (
                  <>
                    <button
                      onClick={() => onRejectReviewItem(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject & Discard Worktree</span>
                    </button>
                    <button
                      onClick={() => onApproveReviewItem(item.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve & Merge to Main</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. SKILLS LIBRARY & STUDIO VIEW
  if (activeNav === 'skills') {
    const selectedSkill = skills.find((s) => s.id === selectedSkillId) || skills[0];
    const categories = [
      'All',
      'Engineering',
      'Design & UI',
      'Project Ops',
      'Cloud & DevOps',
      'Creative & Games',
      'Documents',
    ];
    const filteredSkills =
      skillCategoryFilter === 'All'
        ? skills
        : skills.filter((s) => s.category === skillCategoryFilter);

    return (
      <div className="flex-1 grid grid-cols-12 h-full bg-[#090A0F] divide-x divide-[#222736] overflow-hidden">
        {/* Left: Skill Catalog */}
        <div className="col-span-5 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[#222736] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Agent Skills Library (`$skill`)</span>
              </h2>
              <span className="text-xs font-mono text-slate-400">{skills.length} bundled</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSkillCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    skillCategoryFilter === cat
                      ? 'bg-purple-500/25 text-purple-200 border border-purple-500/40'
                      : 'bg-[#131722] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredSkills.map((skill) => (
              <div
                key={skill.id}
                onClick={() => setSelectedSkillId(skill.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedSkill?.id === skill.id
                    ? 'bg-[#161B29] border-purple-500/50 shadow-sm'
                    : 'bg-[#10131C] border-[#222736] hover:bg-[#141824]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-purple-300">
                    ${skill.slug}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {skill.category}
                    </span>
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleSkill(skill.id);
                      }}
                      className="accent-emerald-500"
                    />
                  </div>
                </div>
                <div className="text-sm font-medium text-white mt-1">{skill.name}</div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{skill.description}</p>
              </div>
            ))}

            {/* Quick Create Custom Skill Box */}
            <div className="p-3.5 rounded-xl bg-[#111520] border border-dashed border-[#2C354D] space-y-2 mt-4">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Create New Team Skill (`.codex/skills/`)</span>
              </div>
              <input
                type="text"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                placeholder="Skill slug (e.g., prisma-migration-check)"
                className="w-full bg-[#090B10] border border-[#222736] rounded px-2.5 py-1.5 text-xs text-white"
              />
              <input
                type="text"
                value={newSkillDesc}
                onChange={(e) => setNewSkillDesc(e.target.value)}
                placeholder="Short description of what this skill automates..."
                className="w-full bg-[#090B10] border border-[#222736] rounded px-2.5 py-1.5 text-xs text-white"
              />
              <button
                onClick={() => {
                  if (!newSkillName.trim()) return;
                  const slug = newSkillName
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9-_]/g, '-');
                  onCreateSkill({
                    slug,
                    name: newSkillName.trim(),
                    category: 'Engineering',
                    description:
                      newSkillDesc.trim() || 'Custom team workflow skill checked into .codex/skills',
                    author: 'zhangjinhui',
                    version: '1.0.0',
                    enabled: true,
                    builtIn: false,
                    path: `.codex/skills/${slug}/SKILL.md`,
                    samplePrompt: `Use $${slug} to execute the team workflow on this repository.`,
                    tags: ['Custom', 'Team Config'],
                    content: `---\nname: ${slug}\ndescription: ${
                      newSkillDesc.trim() || 'Custom Codex Skill'
                    }\n---\n# ${newSkillName.trim()} ($${slug})\n\n## Instructions\n1. Inspect target files.\n2. Run workflow verification and output clean diffs.`,
                  });
                  setNewSkillName('');
                  setNewSkillDesc('');
                }}
                className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium"
              >
                Save New SKILL.md
              </button>
            </div>
          </div>
        </div>

        {/* Right: SKILL.md Studio Editor & Runner */}
        {selectedSkill && (
          <div className="col-span-7 flex flex-col h-full overflow-hidden bg-[#0B0D14]">
            <div className="p-4 border-b border-[#222736] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white">{selectedSkill.name}</h3>
                  <span className="text-xs font-mono text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                    ${selectedSkill.slug}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  {selectedSkill.path} · v{selectedSkill.version}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {skillSavedToast && (
                  <span className="text-xs font-mono text-emerald-400">Saved SKILL.md ✓</span>
                )}
                <button
                  onClick={async () => {
                    onSaveSkill(selectedSkill);
                    await writeWorkspaceFile(selectedSkill.path, selectedSkill.content);
                    setSkillSavedToast(true);
                    setTimeout(() => setSkillSavedToast(false), 1800);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#1A2030] hover:bg-[#232B40] text-slate-200 border border-[#2C354D] text-xs font-medium flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Save SKILL.md</span>
                </button>
                <button
                  onClick={() => onLaunchSkillThread(selectedSkill)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Run Skill in New Thread</span>
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-[#222736] bg-[#10131D] space-y-2">
              <div className="text-xs text-slate-300">{selectedSkill.description}</div>
              <div className="text-[11px] font-mono text-emerald-300 bg-[#090B10] p-2.5 rounded-lg border border-[#222736]">
                Example Prompt: &ldquo;{selectedSkill.samplePrompt}&rdquo;
              </div>
            </div>

            <div className="flex-1 flex flex-col p-4 min-h-0">
              <div className="text-xs font-mono text-slate-400 mb-2">
                SKILL.md Content (YAML Frontmatter + Agent Workflow Instructions):
              </div>
              <textarea
                value={selectedSkill.content}
                onChange={(e) =>
                  onSaveSkill({ ...selectedSkill, content: e.target.value })
                }
                spellCheck={false}
                className="flex-1 w-full rounded-xl bg-[#08090E] border border-[#222736] p-4 font-mono text-xs text-slate-200 focus:outline-none leading-relaxed resize-none"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. AUTOMATIONS & SCHEDULED TASKS VIEW
  if (activeNav === 'automations') {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-[#090A0F] space-y-6">
        <div className="flex items-center justify-between border-b border-[#222736] pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-cyan-400" />
              <span>Scheduled Automations · Background Agent Jobs</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Combine instructions with optional `$skills` on a recurring schedule. Completed
              runs automatically populate the Central Review Queue.
            </p>
          </div>
        </div>

        {/* Create New Automation Card */}
        <div className="rounded-2xl bg-[#111520] border border-[#242B3D] p-5 space-y-3">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Schedule New Background Automation</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={newAutoName}
              onChange={(e) => setNewAutoName(e.target.value)}
              placeholder="Automation title (e.g., Daily Flaky Test Triage)"
              className="bg-[#090B10] border border-[#222736] rounded-lg px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={newAutoCron}
              onChange={(e) => setNewAutoCron(e.target.value)}
              placeholder="Cron schedule (e.g., 0 9 * * 1-5)"
              className="bg-[#090B10] border border-[#222736] rounded-lg px-3 py-2 text-xs font-mono text-cyan-300"
            />
            <select
              value={newAutoSkill}
              onChange={(e) => setNewAutoSkill(e.target.value)}
              className="bg-[#090B10] border border-[#222736] rounded-lg px-3 py-2 text-xs text-purple-300 font-mono"
            >
              {skills.map((s) => (
                <option key={s.id} value={s.slug}>
                  Skill: ${s.slug}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={newAutoPrompt}
              onChange={(e) => setNewAutoPrompt(e.target.value)}
              placeholder="Agent prompt instructions to execute on schedule..."
              className="flex-1 bg-[#090B10] border border-[#222736] rounded-lg px-3 py-2 text-xs text-white"
            />
            <button
              onClick={() => {
                if (!newAutoName.trim() || !newAutoPrompt.trim()) return;
                onCreateAutomation({
                  name: newAutoName.trim(),
                  projectId: 'proj_codex_desktop',
                  scheduleCron: newAutoCron.trim(),
                  scheduleLabel: `Cron (${newAutoCron.trim()})`,
                  prompt: newAutoPrompt.trim(),
                  skills: [newAutoSkill],
                  worktreeStrategy: 'isolated_worktree',
                  enabled: true,
                });
                setNewAutoName('');
                setNewAutoPrompt('');
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shrink-0"
            >
              Create Automation
            </button>
          </div>
        </div>

        {/* Existing Automations List */}
        <div className="space-y-3">
          {automations.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl bg-[#111520] border border-[#242B3D] p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={job.enabled}
                    onChange={() => onToggleAutomation(job.id)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm font-semibold text-white">{job.name}</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono">
                    {job.scheduleLabel} ({job.scheduleCron})
                  </span>
                  {job.skills.map((sk) => (
                    <span
                      key={sk}
                      className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-mono"
                    >
                      ${sk}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-300">{job.prompt}</p>
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
                  <span>Last run: {job.lastRunAt}</span>
                  <span>Next run: {job.nextRunAt}</span>
                  <span>Total runs: {job.totalRuns}</span>
                </div>
              </div>

              <button
                onClick={() => onRunAutomationNow(job.id)}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Trigger Run Now → Review Queue</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4. GIT WORKTREES COMMAND CENTER VIEW
  if (activeNav === 'worktrees') {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-[#090A0F] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222736] pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-indigo-400" />
              <span>Git Worktree Isolation Matrix</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Each parallel Codex agent works in an isolated Git worktree directory sharing
              repository history without polluting your local checkout.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={wtBranchInput}
              onChange={(e) => setWtBranchInput(e.target.value)}
              placeholder="feat/new-agent-worktree..."
              className="bg-[#121622] border border-[#262E42] rounded-lg px-3 py-1.5 text-xs text-white font-mono"
            />
            <button
              onClick={() => {
                if (wtBranchInput.trim()) {
                  onCreateWorktree(wtBranchInput.trim());
                  setWtBranchInput('');
                }
              }}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Isolated Worktree</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {worktrees.map((wt) => (
            <div
              key={wt.id}
              className="rounded-2xl bg-[#111520] border border-[#242B3D] p-5 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold font-mono text-white">
                      {wt.branch}
                    </span>
                    {wt.isMain ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Primary Checkout
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Isolated Worktree
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-400">HEAD {wt.headCommit}</span>
                </div>

                <div className="text-xs font-mono text-slate-400 bg-[#0A0C12] p-2 rounded-lg border border-[#1E2434] truncate">
                  {wt.path}
                </div>

                <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-300">
                  <span>
                    {wt.changedFilesCount} modified files (
                    <span className="text-emerald-400">+{wt.additions}</span>{' '}
                    <span className="text-rose-400">-{wt.deletions}</span>)
                  </span>
                  <span>
                    ↑{wt.ahead} ahead · ↓{wt.behind} behind
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1D2332]">
                <button
                  onClick={() => onJumpToWorktreeThread(wt)}
                  className="px-3 py-1.5 rounded-lg bg-[#1A2030] hover:bg-[#232B40] text-slate-200 border border-[#2C354D] text-xs font-medium"
                >
                  Open Bound Thread
                </button>
                {!wt.isMain && (
                  <>
                    <button
                      onClick={() => onMergeWorktree(wt.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>Merge to main</span>
                    </button>
                    <button
                      onClick={() => onDeleteWorktree(wt.id)}
                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
                      title="Prune worktree"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. SUBAGENTS & AGENTS.MD VIEW
  if (activeNav === 'subagents') {
    const selectedAgent =
      subagents.find((s) => s.id === selectedSubagentId) || subagents[0];

    return (
      <div className="flex-1 grid grid-cols-12 h-full bg-[#090A0F] divide-x divide-[#222736] overflow-hidden">
        <div className="col-span-5 p-4 space-y-4 overflow-y-auto">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-teal-400" />
              <span>Subagent Orchestration (`.codex/agents/*.toml`)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Codex enables subagent workflows by default (`default`, `worker`, `explorer`)
              and supports custom TOML agent definitions.
            </p>
          </div>

          <div className="space-y-2">
            {subagents.map((ag) => (
              <div
                key={ag.id}
                onClick={() => setSelectedSubagentId(ag.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedAgent?.id === ag.id
                    ? 'bg-[#161B29] border-teal-500/50'
                    : 'bg-[#10131C] border-[#222736] hover:bg-[#141824]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-teal-300">
                    /agent {ag.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {ag.model} · {ag.sandboxMode}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1.5">{ag.description}</p>
                <div className="text-[10px] font-mono text-slate-500 mt-1">{ag.tomlPath}</div>
              </div>
            ))}
          </div>

          {selectedAgent && (
            <div className="p-4 rounded-xl bg-[#111520] border border-[#242B3D] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Edit Subagent: {selectedAgent.name}
                </span>
                <span className="text-[11px] font-mono text-teal-400">
                  {selectedAgent.tomlPath}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedAgent.model}
                  onChange={(e) =>
                    onSaveSubagent({
                      ...selectedAgent,
                      model: e.target.value as ModelId,
                    })
                  }
                  className="bg-[#090B10] border border-[#222736] rounded px-2 py-1.5 text-xs text-white"
                >
                  <option value="gpt-6.1-sol">gpt-6.1-sol</option>
                  <option value="gpt-6-luna">gpt-6-luna</option>
                  <option value="gpt-5.3-codex">gpt-5.3-codex</option>
                </select>
                <select
                  value={selectedAgent.sandboxMode}
                  onChange={(e) =>
                    onSaveSubagent({
                      ...selectedAgent,
                      sandboxMode: e.target.value as SubagentConfig['sandboxMode'],
                    })
                  }
                  className="bg-[#090B10] border border-[#222736] rounded px-2 py-1.5 text-xs text-white"
                >
                  <option value="read-only">read-only</option>
                  <option value="workspace-write">workspace-write</option>
                  <option value="full-access">full-access</option>
                </select>
              </div>
              <textarea
                rows={4}
                value={selectedAgent.developerInstructions}
                onChange={(e) =>
                  onSaveSubagent({
                    ...selectedAgent,
                    developerInstructions: e.target.value,
                  })
                }
                className="w-full bg-[#090B10] border border-[#222736] rounded-lg p-2.5 text-xs font-mono text-slate-200"
              />
              <button
                onClick={async () => {
                  const toml = `name = "${selectedAgent.name}"\ndescription = "${selectedAgent.description}"\nmodel = "${selectedAgent.model}"\nsandbox_mode = "${selectedAgent.sandboxMode}"\ndeveloper_instructions = """\n${selectedAgent.developerInstructions}\n"""\n`;
                  await writeWorkspaceFile(selectedAgent.tomlPath, toml);
                  triggerSavedNotice(`Saved ${selectedAgent.tomlPath} ✓`);
                }}
                className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium"
              >
                Sync Subagent TOML to Disk
              </button>
            </div>
          )}
        </div>

        {/* Right: AGENTS.md Repository Instructions Editor */}
        <div className="col-span-7 flex flex-col h-full p-5 bg-[#0B0D14]">
          <div className="flex items-center justify-between pb-3 border-b border-[#222736]">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-emerald-400" />
                <span>Repository `AGENTS.md` Instructions</span>
              </h3>
              <p className="text-xs text-slate-400">
                Loaded automatically into every Codex thread and subagent turn in this repo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savedNotice && (
                <span className="text-xs font-mono text-emerald-400">{savedNotice}</span>
              )}
              <button
                onClick={async () => {
                  onSaveAgentsMd(agentsMdDraft);
                  await writeWorkspaceFile('AGENTS.md', agentsMdDraft);
                  triggerSavedNotice('Saved AGENTS.md to disk ✓');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save AGENTS.md</span>
              </button>
            </div>
          </div>

          <textarea
            value={agentsMdDraft}
            onChange={(e) => setAgentsMdDraft(e.target.value)}
            spellCheck={false}
            className="flex-1 mt-4 w-full rounded-xl bg-[#08090E] border border-[#222736] p-4 font-mono text-xs text-slate-200 focus:outline-none leading-relaxed resize-none"
          />
        </div>
      </div>
    );
  }

  // 6. SANDBOX, SECURITY & APP-SERVER CONFIG VIEW
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#090A0F] space-y-6">
      <div className="flex items-center justify-between border-b border-[#222736] pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-400" />
            <span>Sandbox Scope, Approval Policy & App-Server Harness</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure OS-level filesystem write boundaries, network access controls, allowed
            commands, and `codex app-server` connection settings (`.codex/config.toml`).
          </p>
        </div>
        {savedNotice && (
          <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-mono">
            {savedNotice}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sandbox & Network Controls */}
        <div className="rounded-2xl bg-[#111520] border border-[#242B3D] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Filesystem & Network Sandbox Boundaries</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Filesystem Scope (`sandbox.mode`)
              </label>
              <select
                value={sandboxPolicy.mode}
                onChange={(e) =>
                  onUpdateSandboxPolicy({
                    mode: e.target.value as SandboxPolicy['mode'],
                  })
                }
                className="w-full bg-[#090B10] border border-[#222736] rounded-lg px-3 py-2 text-white"
              >
                <option value="workspace-write">
                  workspace-write (Edit active folder/worktree only — Default)
                </option>
                <option value="worktree-isolated">
                  worktree-isolated (Strict Git worktree write lock)
                </option>
                <option value="read-only">
                  read-only (Exploration & code review only)
                </option>
                <option value="full-access">
                  full-access (Unrestricted local filesystem access)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Network Access (`sandbox.network_access`)
              </label>
              <select
                value={sandboxPolicy.networkAccess}
                onChange={(e) =>
                  onUpdateSandboxPolicy({
                    networkAccess: e.target.value as SandboxPolicy['networkAccess'],
                  })
                }
                className="w-full bg-[#090B10] border border-[#222736] rounded-lg px-3 py-2 text-white"
              >
                <option value="disabled">
                  disabled (Blocked by default; prompt for elevated network commands)
                </option>
                <option value="cached-web">
                  cached-web (Allow cached OpenAI docs & package index lookups)
                </option>
                <option value="enabled">enabled (Allow outbound HTTP/WebSocket traffic)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Command Approval Policy (`sandbox.approval_policy`)
              </label>
              <select
                value={sandboxPolicy.approvalPolicy}
                onChange={(e) =>
                  onUpdateSandboxPolicy({
                    approvalPolicy: e.target.value as SandboxPolicy['approvalPolicy'],
                  })
                }
                className="w-full bg-[#090B10] border border-[#222736] rounded-lg px-3 py-2 text-white"
              >
                <option value="on-risk">
                  on-risk (Ask before network, socket bind, or destructive commands)
                </option>
                <option value="always-ask">
                  always-ask (Require interactive approval before every shell command)
                </option>
                <option value="auto-allow-safe">
                  auto-allow-safe (Auto-run allowlisted commands in sandbox)
                </option>
                <option value="never">
                  never (Never pause for approval; enforce OS sandbox boundary only)
                </option>
              </select>
            </div>
          </div>

          {/* Allowed Commands List */}
          <div className="space-y-2 pt-2 border-t border-[#1E2434]">
            <div className="text-xs font-medium text-slate-300">
              Auto-Allowed Commands (`allowed_commands` allowlist)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sandboxPolicy.allowedCommands.map((cmd) => (
                <span
                  key={cmd}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#090B10] border border-[#222736] text-xs font-mono text-emerald-300"
                >
                  <span>{cmd}</span>
                  <button
                    onClick={() =>
                      onUpdateSandboxPolicy({
                        allowedCommands: sandboxPolicy.allowedCommands.filter((c) => c !== cmd),
                      })
                    }
                    className="text-slate-500 hover:text-rose-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newCommandRule}
                onChange={(e) => setNewCommandRule(e.target.value)}
                placeholder="Add safe command prefix (e.g., npm test)..."
                className="flex-1 bg-[#090B10] border border-[#222736] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
              />
              <button
                onClick={() => {
                  if (newCommandRule.trim()) {
                    onUpdateSandboxPolicy({
                      allowedCommands: [
                        ...sandboxPolicy.allowedCommands,
                        newCommandRule.trim(),
                      ],
                    });
                    setNewCommandRule('');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
              >
                Add Rule
              </button>
            </div>
          </div>
        </div>

        {/* App-Server & Model Provider Connection */}
        <div className="rounded-2xl bg-[#111520] border border-[#242B3D] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Codex App-Server & Harness Mode</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Active Agent Harness Backend
              </label>
              <select
                value={sandboxPolicy.harnessMode}
                onChange={(e) =>
                  onUpdateSandboxPolicy({
                    harnessMode: e.target.value as SandboxPolicy['harnessMode'],
                  })
                }
                className="w-full bg-[#090B10] border border-[#222736] rounded-lg px-3 py-2 text-white"
              >
                <option value="hybrid_simulator">
                  Hybrid Embedded Harness + Local Node App-Server Bridge (Default)
                </option>
                <option value="local_app_server_cli">
                  Native `codex app-server` CLI Child Process (stdio JSONL / ws://127.0.0.1:4500)
                </option>
                <option value="openai_compatible_api">
                  Direct OpenAI / Compatible Responses API Endpoint
                </option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">API Base URL</label>
                <input
                  type="text"
                  value={sandboxPolicy.apiEndpoint}
                  onChange={(e) => onUpdateSandboxPolicy({ apiEndpoint: e.target.value })}
                  className="w-full bg-[#090B10] border border-[#222736] rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">App-Server Port</label>
                <input
                  type="number"
                  value={sandboxPolicy.appServerPort}
                  onChange={(e) =>
                    onUpdateSandboxPolicy({ appServerPort: Number(e.target.value) })
                  }
                  className="w-full bg-[#090B10] border border-[#222736] rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                OpenAI API Key / Remote Capability Bearer Token (Optional)
              </label>
              <input
                type="password"
                value={sandboxPolicy.apiKey}
                onChange={(e) => onUpdateSandboxPolicy({ apiKey: e.target.value })}
                placeholder="sk-... or codex_cap_..."
                className="w-full bg-[#090B10] border border-[#222736] rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
              />
            </div>

            <div className="pt-2">
              <div className="text-slate-400 font-mono text-[11px] mb-1">
                Generated `.codex/config.toml` Preview:
              </div>
              <pre className="p-3 rounded-xl bg-[#08090E] border border-[#222736] font-mono text-[11px] text-emerald-300 overflow-x-auto">
{`model = "gpt-6.1-sol"
[sandbox]
mode = "${sandboxPolicy.mode}"
network_access = ${sandboxPolicy.networkAccess === 'enabled'}
approval_policy = "${sandboxPolicy.approvalPolicy}"
allowed_commands = ${JSON.stringify(sandboxPolicy.allowedCommands)}

[app_server]
http_bridge_port = ${sandboxPolicy.appServerPort}
experimental_api = true`}
              </pre>
            </div>

            <button
              onClick={async () => {
                const toml = `model = "gpt-6.1-sol"\n\n[sandbox]\nmode = "${sandboxPolicy.mode}"\nnetwork_access = ${
                  sandboxPolicy.networkAccess === 'enabled'
                }\napproval_policy = "${
                  sandboxPolicy.approvalPolicy
                }"\nallowed_commands = ${JSON.stringify(
                  sandboxPolicy.allowedCommands
                )}\n\n[app_server]\nhttp_bridge_port = ${
                  sandboxPolicy.appServerPort
                }\nexperimental_api = true\n`;
                await writeWorkspaceFile('.codex/config.toml', toml);
                triggerSavedNotice('Synced .codex/config.toml to disk ✓');
              }}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
            >
              Save & Reload `.codex/config.toml`
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
