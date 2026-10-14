import React, { useState, useEffect } from 'react';
import {
  FileDiff as FileDiffIcon,
  FolderTree,
  Terminal as TerminalIcon,
  Globe,
  GitBranch,
  Check,
  RotateCcw,
  MessageSquarePlus,
  Send,
  Columns,
  AlignJustify,
  Save,
  Play,
  Plus,
  CheckCircle2,
  GitMerge,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
  FileCode2,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import {
  FileDiff,
  FileTreeNode,
  RightPanelTab,
  Thread,
  WorkspaceLayoutMode,
  WorktreeInfo,
} from '../types/codex';
import {
  executeTerminalCommand,
  readWorkspaceFile,
  writeWorkspaceFile,
} from '../services/appServerClient';
import { VoxelVelocityGame } from './VoxelVelocityGame';

interface RightInspectorPaneProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  layoutMode: WorkspaceLayoutMode;
  thread: Thread;
  selectedDiffFile: string;
  onSelectDiffFile: (filePath: string) => void;
  fileTree: FileTreeNode[];
  worktrees: WorktreeInfo[];
  onToggleStageFile: (filePath: string) => void;
  onRevertFileDiff: (filePath: string) => void;
  onAddInlineComment: (filePath: string, lineNumber: number, body: string) => void;
  onSubmitInlineReviewToAgent: () => void;
  onCommitChanges: (message: string) => void;
  onCreateWorktree: (branchName: string) => void;
  onMergeWorktree: (worktreeId: string) => void;
}

export const RightInspectorPane: React.FC<RightInspectorPaneProps> = ({
  activeTab,
  onTabChange,
  layoutMode,
  thread,
  selectedDiffFile,
  onSelectDiffFile,
  fileTree,
  worktrees,
  onToggleStageFile,
  onRevertFileDiff,
  onAddInlineComment,
  onSubmitInlineReviewToAgent,
  onCommitChanges,
  onCreateWorktree,
  onMergeWorktree,
}) => {
  const [diffViewMode, setDiffViewMode] = useState<'unified' | 'split'>('unified');
  const [commentingLine, setCommentingLine] = useState<{
    filePath: string;
    line: number;
  } | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  // File Explorer state
  const [selectedSourcePath, setSelectedSourcePath] = useState<string>('AGENTS.md');
  const [sourceContent, setSourceContent] = useState<string>('');
  const [sourceSavedNotice, setSourceSavedNotice] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({
    '.codex': true,
    src: true,
    server: true,
  });

  // Terminal state
  const [terminalSession, setTerminalSession] = useState<'workspace' | 'app-server' | 'tests'>(
    'workspace'
  );
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<
    Array<{ id: string; cmd: string; output: string; exitCode: number }>
  >([
    {
      id: 'term_init_1',
      cmd: 'codex --version && git worktree list',
      output:
        'codex-cli 0.160.0 (app-server JSON-RPC 2.0 Lite)\n/Users/zhangjinhui/Desktop/codex-test                                  a8f4c21 [main]\n/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/jsonrpc-app-server  e91d04b [feat/jsonrpc-app-server]\n/Users/zhangjinhui/Desktop/codex-test/.codex/worktrees/voxel-drift-boost   3f92a7c [feat/drift-boost-tiers]',
      exitCode: 0,
    },
  ]);

  // Live Preview state
  const [previewApp, setPreviewApp] = useState<'voxel_velocity' | 'ui_workbench'>(
    'voxel_velocity'
  );
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>(
    'desktop'
  );

  // New Worktree Input
  const [newWorktreeBranch, setNewWorktreeBranch] = useState('');

  useEffect(() => {
    let mounted = true;
    readWorkspaceFile(selectedSourcePath).then((content) => {
      if (mounted) setSourceContent(content);
    });
    return () => {
      mounted = false;
    };
  }, [selectedSourcePath]);

  const currentDiff: FileDiff | undefined =
    thread.changedFiles.find((f) => f.filePath === selectedDiffFile) ||
    thread.changedFiles[0];

  const totalComments = thread.changedFiles.reduce(
    (sum, f) => sum + f.comments.length,
    0
  );

  const handleRunTerminal = async (e?: React.FormEvent, quickCmd?: string) => {
    e?.preventDefault();
    const cmd = (quickCmd ?? terminalInput).trim();
    if (!cmd) return;
    if (!quickCmd) setTerminalInput('');

    const res = await executeTerminalCommand(cmd);
    setTerminalLogs((prev) => [
      ...prev,
      {
        id: `term_${Date.now()}`,
        cmd,
        output: [res.stdout, res.stderr].filter(Boolean).join('\n') || '(completed with no output)',
        exitCode: res.exitCode,
      },
    ]);
  };

  const handleSaveSourceFile = async () => {
    await writeWorkspaceFile(selectedSourcePath, sourceContent);
    setSourceSavedNotice(true);
    setTimeout(() => setSourceSavedNotice(false), 1800);
  };

  const renderFileTreeNodes = (nodes: FileTreeNode[], depth = 0) => {
    return nodes.map((node) => {
      if (node.type === 'directory') {
        const isOpen = !!expandedDirs[node.path];
        return (
          <div key={node.path}>
            <button
              onClick={() =>
                setExpandedDirs((prev) => ({ ...prev, [node.path]: !prev[node.path] }))
              }
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className="w-full flex items-center gap-1.5 py-1 pr-2 text-xs text-slate-300 hover:bg-[#171C29] rounded transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
              <span className="font-medium truncate">{node.name}</span>
            </button>
            {isOpen && node.children && renderFileTreeNodes(node.children, depth + 1)}
          </div>
        );
      }

      const isSelected = selectedSourcePath === node.path;
      return (
        <button
          key={node.path}
          onClick={() => setSelectedSourcePath(node.path)}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
          className={`w-full flex items-center justify-between py-1 pr-2 text-xs font-mono rounded transition-colors ${
            isSelected
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151A26]'
          }`}
        >
          <span className="flex items-center gap-1.5 truncate">
            <FileCode2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{node.name}</span>
          </span>
        </button>
      );
    });
  };

  const renderDiffPanelContent = () => (
    <div className="flex flex-col h-full min-h-0">
      {/* Diff Summary & Review Actions Header */}
      <div className="p-2.5 border-b border-[#222736] bg-[#10131C] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">
            Changed Files ({thread.changedFiles.length})
          </span>
          <span className="text-xs font-mono text-emerald-400">
            +{thread.diffSummary.additions}
          </span>
          <span className="text-xs font-mono text-rose-400">
            -{thread.diffSummary.deletions}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Unified vs Split Toggle */}
          <div className="flex items-center bg-[#090A0F] p-0.5 rounded-lg border border-[#222736]">
            <button
              onClick={() => setDiffViewMode('unified')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                diffViewMode === 'unified'
                  ? 'bg-[#1D2230] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlignJustify className="w-3 h-3" />
              <span>Unified</span>
            </button>
            <button
              onClick={() => setDiffViewMode('split')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                diffViewMode === 'split'
                  ? 'bg-[#1D2230] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>Split</span>
            </button>
          </div>

          {totalComments > 0 && (
            <button
              onClick={onSubmitInlineReviewToAgent}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>Submit Review ({totalComments})</span>
            </button>
          )}
        </div>
      </div>

      {/* File Selector Tabs */}
      {thread.changedFiles.length > 0 ? (
        <>
          <div className="flex items-center gap-1 px-2.5 py-1.5 bg-[#0C0E15] border-b border-[#222736] overflow-x-auto shrink-0">
            {thread.changedFiles.map((file) => {
              const active = currentDiff?.filePath === file.filePath;
              return (
                <button
                  key={file.id}
                  onClick={() => onSelectDiffFile(file.filePath)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 shrink-0 border transition-colors ${
                    active
                      ? 'bg-[#1A2030] border-emerald-500/40 text-white'
                      : 'bg-[#111520] border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      file.staged ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span>{file.filePath.split('/').pop()}</span>
                  <span className="text-[10px] text-emerald-400">+{file.additions}</span>
                  <span className="text-[10px] text-rose-400">-{file.deletions}</span>
                </button>
              );
            })}
          </div>

          {/* Active File Diff Actions Bar */}
          {currentDiff && (
            <div className="px-3 py-1.5 bg-[#121622] border-b border-[#222736] flex items-center justify-between text-xs">
              <span className="font-mono text-slate-300 truncate">{currentDiff.filePath}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onToggleStageFile(currentDiff.filePath)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                    currentDiff.staged
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {currentDiff.staged ? '✓ Staged' : 'Stage File'}
                </button>
                <button
                  onClick={() => onRevertFileDiff(currentDiff.filePath)}
                  className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-mono flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Revert</span>
                </button>
              </div>
            </div>
          )}

          {/* Diff Hunks & Inline Review Comments */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3 font-mono text-xs">
            {currentDiff?.hunks.map((hunk) => (
              <div
                key={hunk.id}
                className="rounded-lg border border-[#242B3D] overflow-hidden bg-[#0A0C12]"
              >
                <div className="px-3 py-1 bg-[#141824] text-indigo-300 text-[11px] border-b border-[#222736] flex items-center justify-between">
                  <span>{hunk.header}</span>
                  <span className="text-[10px] text-slate-400">Click any line to comment</span>
                </div>

                {diffViewMode === 'unified' ? (
                  <div className="divide-y divide-[#151924]">
                    {hunk.lines.map((line, idx) => {
                      const lineNum = line.newLineNumber || line.oldLineNumber || idx + 1;
                      const lineComments = currentDiff.comments.filter(
                        (c) => c.lineNumber === lineNum
                      );
                      const isCommenting =
                        commentingLine?.filePath === currentDiff.filePath &&
                        commentingLine?.line === lineNum;

                      return (
                        <div key={idx}>
                          <div
                            onClick={() =>
                              setCommentingLine({
                                filePath: currentDiff.filePath,
                                line: lineNum,
                              })
                            }
                            className={`group flex items-start px-2 py-0.5 cursor-pointer transition-colors ${
                              line.type === 'add'
                                ? 'bg-emerald-950/30 text-emerald-200 hover:bg-emerald-900/40'
                                : line.type === 'del'
                                ? 'bg-rose-950/30 text-rose-200 hover:bg-rose-900/40'
                                : 'text-slate-300 hover:bg-[#141822]'
                            }`}
                          >
                            <span className="w-8 text-right pr-2 text-slate-600 select-none shrink-0">
                              {line.oldLineNumber ?? ''}
                            </span>
                            <span className="w-8 text-right pr-2 text-slate-600 select-none shrink-0">
                              {line.newLineNumber ?? ''}
                            </span>
                            <span className="w-4 select-none font-bold shrink-0">
                              {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                            </span>
                            <span className="flex-1 whitespace-pre overflow-x-auto">
                              {line.content}
                            </span>
                            <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-400 opacity-0 group-hover:opacity-100 shrink-0 ml-2" />
                          </div>

                          {/* Existing Inline Review Comments */}
                          {lineComments.map((cmt) => (
                            <div
                              key={cmt.id}
                              className="mx-4 my-1.5 p-2.5 rounded-lg bg-[#161B28] border border-emerald-500/40 font-sans text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between text-[11px] text-emerald-300">
                                <span className="font-semibold">
                                  @{cmt.author} · Line {cmt.lineNumber}
                                </span>
                                <span className="text-slate-400">{cmt.createdAt}</span>
                              </div>
                              <p className="text-slate-200">{cmt.body}</p>
                            </div>
                          ))}

                          {/* New Inline Comment Box */}
                          {isCommenting && (
                            <div className="mx-4 my-2 p-2.5 rounded-lg bg-[#151A28] border border-cyan-500/50 font-sans space-y-2">
                              <div className="text-[11px] text-cyan-300 font-medium">
                                Add review comment on line {lineNum}
                              </div>
                              <textarea
                                rows={2}
                                value={commentDraft}
                                onChange={(e) => setCommentDraft(e.target.value)}
                                placeholder="Ask Codex to adjust this line or explain edge cases..."
                                className="w-full rounded bg-[#0B0D13] border border-[#262E42] p-2 text-xs text-white focus:outline-none"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setCommentingLine(null)}
                                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px]"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => {
                                    if (commentDraft.trim()) {
                                      onAddInlineComment(
                                        currentDiff.filePath,
                                        lineNum,
                                        commentDraft.trim()
                                      );
                                      setCommentDraft('');
                                      setCommentingLine(null);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-medium"
                                >
                                  Save Comment
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Split Side-by-Side Diff View */
                  <div className="grid grid-cols-2 divide-x divide-[#222736]">
                    <div className="divide-y divide-[#151924]">
                      {hunk.lines
                        .filter((l) => l.type !== 'add')
                        .map((line, i) => (
                          <div
                            key={i}
                            className={`px-2 py-0.5 whitespace-pre overflow-x-auto ${
                              line.type === 'del'
                                ? 'bg-rose-950/30 text-rose-200'
                                : 'text-slate-400'
                            }`}
                          >
                            <span className="inline-block w-6 text-slate-600 select-none">
                              {line.oldLineNumber}
                            </span>
                            {line.type === 'del' ? '- ' : '  '}
                            {line.content}
                          </div>
                        ))}
                    </div>
                    <div className="divide-y divide-[#151924]">
                      {hunk.lines
                        .filter((l) => l.type !== 'del')
                        .map((line, i) => (
                          <div
                            key={i}
                            className={`px-2 py-0.5 whitespace-pre overflow-x-auto ${
                              line.type === 'add'
                                ? 'bg-emerald-950/30 text-emerald-200'
                                : 'text-slate-300'
                            }`}
                          >
                            <span className="inline-block w-6 text-slate-600 select-none">
                              {line.newLineNumber}
                            </span>
                            {line.type === 'add' ? '+ ' : '  '}
                            {line.content}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom Commit & Worktree Merge Bar */}
          <div className="p-2.5 border-t border-[#222736] bg-[#0E111A] flex items-center gap-2">
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={`Commit changes on ${thread.branch}...`}
              className="flex-1 bg-[#141824] border border-[#262E42] rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              onClick={() => {
                onCommitChanges(
                  commitMessage.trim() || `feat(${thread.branch}): apply Codex agent changes`
                );
                setCommitMessage('');
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1 shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Commit</span>
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mb-2" />
          <div className="text-xs font-medium text-slate-300">Working tree clean</div>
          <p className="text-[11px] text-slate-500 mt-1">
            All changes in this thread have been committed or merged.
          </p>
        </div>
      )}
    </div>
  );

  const renderFilesPanelContent = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b border-[#222736] bg-[#10131C] flex items-center justify-between text-xs">
        <span className="font-mono text-slate-300 truncate">{selectedSourcePath}</span>
        <div className="flex items-center gap-1.5">
          {sourceSavedNotice && (
            <span className="text-[11px] text-emerald-400 font-mono">Saved to disk ✓</span>
          )}
          <button
            onClick={handleSaveSourceFile}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium"
          >
            <Save className="w-3 h-3" />
            <span>Save</span>
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 min-h-0 divide-x divide-[#222736]">
        <div className="col-span-5 overflow-y-auto p-1.5 bg-[#0B0D13]">
          {renderFileTreeNodes(fileTree)}
        </div>
        <div className="col-span-7 flex flex-col min-h-0 bg-[#080A0F]">
          <textarea
            value={sourceContent}
            onChange={(e) => setSourceContent(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-3 bg-transparent font-mono text-xs text-slate-200 focus:outline-none resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );

  const renderTerminalPanelContent = () => (
    <div className="flex flex-col h-full min-h-0 bg-[#080A0E] font-mono text-xs">
      {/* Terminal Session Tabs & Quick Commands */}
      <div className="px-2.5 py-1.5 border-b border-[#222736] bg-[#10131C] flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          {(['workspace', 'app-server', 'tests'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTerminalSession(tab)}
              className={`px-2 py-0.5 rounded text-[11px] ${
                terminalSession === tab
                  ? 'bg-[#1D2333] text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'workspace'
                ? 'zsh · workspace'
                : tab === 'app-server'
                ? 'codex app-server'
                : 'test-runner'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {['git status', 'git worktree list', 'codex --version'].map((qCmd) => (
            <button
              key={qCmd}
              onClick={() => handleRunTerminal(undefined, qCmd)}
              className="px-1.5 py-0.5 rounded bg-[#151A28] hover:bg-[#1E2538] text-[10px] text-cyan-300 border border-slate-700/70"
            >
              {qCmd}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {terminalLogs.map((entry) => (
          <div key={entry.id} className="space-y-1">
            <div className="flex items-center justify-between text-emerald-400">
              <span>➜ codex-test ({thread.branch}) $ {entry.cmd}</span>
              <span className="text-[10px] text-slate-500">exit {entry.exitCode}</span>
            </div>
            <pre className="text-slate-300 whitespace-pre-wrap pl-3 border-l-2 border-slate-800 leading-relaxed text-[11px]">
              {entry.output}
            </pre>
          </div>
        ))}
      </div>

      {/* Terminal Command Input */}
      <form
        onSubmit={(e) => handleRunTerminal(e)}
        className="p-2 border-t border-[#222736] bg-[#0D1017] flex items-center gap-2"
      >
        <span className="text-emerald-400 font-bold">$</span>
        <input
          type="text"
          value={terminalInput}
          onChange={(e) => setTerminalInput(e.target.value)}
          placeholder="Run command in sandboxed worktree shell (e.g., git status, ls -la)..."
          className="flex-1 bg-transparent text-slate-100 focus:outline-none text-xs"
        />
        <button
          type="submit"
          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-sans font-medium"
        >
          Run
        </button>
      </form>
    </div>
  );

  const renderPreviewPanelContent = () => (
    <div className="flex flex-col h-full min-h-0 bg-[#0B0D14]">
      {/* Browser Address & App Switcher Bar */}
      <div className="p-2 border-b border-[#222736] bg-[#10131C] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPreviewApp('voxel_velocity')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${
              previewApp === 'voxel_velocity'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-[#151924] text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Voxel Velocity 3D (Playable)</span>
          </button>
          <button
            onClick={() => setPreviewApp('ui_workbench')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${
              previewApp === 'ui_workbench'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-[#151924] text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>Live UI Component Preview</span>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-[#090A0F] p-0.5 rounded-lg border border-[#222736]">
          <button
            onClick={() => setPreviewViewport('desktop')}
            className={`p-1 rounded ${
              previewViewport === 'desktop' ? 'bg-[#1D2230] text-white' : 'text-slate-500'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPreviewViewport('tablet')}
            className={`p-1 rounded ${
              previewViewport === 'tablet' ? 'bg-[#1D2230] text-white' : 'text-slate-500'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPreviewViewport('mobile')}
            className={`p-1 rounded ${
              previewViewport === 'mobile' ? 'bg-[#1D2230] text-white' : 'text-slate-500'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div
          className={`mx-auto transition-all ${
            previewViewport === 'mobile'
              ? 'max-w-[340px]'
              : previewViewport === 'tablet'
              ? 'max-w-[520px]'
              : 'w-full'
          }`}
        >
          {previewApp === 'voxel_velocity' ? (
            <VoxelVelocityGame />
          ) : (
            <div className="rounded-xl border border-[#262E42] bg-gradient-to-br from-[#121624] to-[#0D101A] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Hot Reload Active · {thread.branch}
                </span>
                <span className="text-xs font-mono text-slate-400">localhost:5173</span>
              </div>
              <h3 className="text-base font-semibold text-white">
                Codex Multi-Agent Command Center Hero Preview
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Supervise parallel coding agents across isolated Git worktrees, review inline
                diffs, and automate repetitive engineering workflows with reusable Skills.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-3 rounded-lg bg-[#161B2A] border border-[#242C42]">
                  <div className="text-[11px] text-slate-400">Active Worktrees</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {worktrees.length} Isolated
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#161B2A] border border-[#242C42]">
                  <div className="text-[11px] text-slate-400">App-Server RPC</div>
                  <div className="text-sm font-bold text-cyan-400 mt-0.5">JSON-RPC 2.0</div>
                </div>
                <div className="p-3 rounded-lg bg-[#161B2A] border border-[#242C42]">
                  <div className="text-[11px] text-slate-400">Diff Review</div>
                  <div className="text-sm font-bold text-purple-400 mt-0.5">
                    +{thread.diffSummary.additions} / -{thread.diffSummary.deletions}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderWorktreesPanelContent = () => (
    <div className="flex flex-col h-full min-h-0 p-3 space-y-3 overflow-y-auto">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newWorktreeBranch}
          onChange={(e) => setNewWorktreeBranch(e.target.value)}
          placeholder="New worktree branch (e.g., feat/mcp-oauth)..."
          className="flex-1 bg-[#141824] border border-[#262E42] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          onClick={() => {
            if (newWorktreeBranch.trim()) {
              onCreateWorktree(newWorktreeBranch.trim());
              setNewWorktreeBranch('');
            }
          }}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Worktree</span>
        </button>
      </div>

      <div className="space-y-2">
        {worktrees.map((wt) => (
          <div
            key={wt.id}
            className="p-3 rounded-xl bg-[#121622] border border-[#242B3D] space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-white font-mono">{wt.branch}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {wt.headCommit}
                </span>
              </div>
              {!wt.isMain && (
                <button
                  onClick={() => onMergeWorktree(wt.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium"
                >
                  <GitMerge className="w-3 h-3" />
                  <span>Merge to main</span>
                </button>
              )}
            </div>
            <div className="text-[11px] font-mono text-slate-400 truncate">{wt.path}</div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-[#1C2230]">
              <span>
                {wt.changedFilesCount} files changed (+{wt.additions} -{wt.deletions})
              </span>
              <span className="text-emerald-400">
                ↑{wt.ahead} ↓{wt.behind}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Tiled 4-Pane Workbench Mode (Issue #33301: simultaneous Diff + Live Preview + Terminal + Source)
  if (layoutMode === 'tiled_4pane') {
    return (
      <aside className="w-[58%] bg-[#0D1017] border-l border-[#222736] grid grid-cols-2 grid-rows-2 divide-x divide-y divide-[#222736] h-full shrink-0 overflow-hidden">
        <div className="flex flex-col min-h-0 overflow-hidden">{renderDiffPanelContent()}</div>
        <div className="flex flex-col min-h-0 overflow-hidden">{renderPreviewPanelContent()}</div>
        <div className="flex flex-col min-h-0 overflow-hidden">{renderFilesPanelContent()}</div>
        <div className="flex flex-col min-h-0 overflow-hidden">{renderTerminalPanelContent()}</div>
      </aside>
    );
  }

  return (
    <aside
      className={`${
        layoutMode === 'review_zen' ? 'w-[62%]' : 'w-[440px] xl:w-[500px]'
      } bg-[#0D1017] border-l border-[#222736] flex flex-col h-full shrink-0 transition-all`}
    >
      {/* Top Inspector Surface Tabs */}
      <div className="h-12 px-2.5 border-b border-[#222736] bg-[#0E1017] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          {[
            { id: 'diff', label: 'Diff Review', icon: FileDiffIcon, count: thread.changedFiles.length },
            { id: 'preview', label: 'Live Preview', icon: Globe },
            { id: 'files', label: 'Files', icon: FolderTree },
            { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
            { id: 'worktrees', label: 'Worktrees', icon: GitBranch, count: worktrees.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as RightPanelTab)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-[#1A2030] text-white border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-emerald-400" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="text-[10px] font-mono px-1.5 rounded bg-slate-800 text-slate-300">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Inspector Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'diff' && renderDiffPanelContent()}
        {activeTab === 'files' && renderFilesPanelContent()}
        {activeTab === 'terminal' && renderTerminalPanelContent()}
        {activeTab === 'preview' && renderPreviewPanelContent()}
        {activeTab === 'worktrees' && renderWorktreesPanelContent()}
      </div>
    </aside>
  );
};
