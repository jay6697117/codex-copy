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
  X,
} from 'lucide-react';
import {
  AppLanguage,
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
import { t } from '../i18n/translations';

interface RightInspectorPaneProps {
  lang: AppLanguage;
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
  onRefreshGit: () => void;
  layoutMode: WorkspaceLayoutMode;
  thread: Thread;
  selectedDiffFile: string;
  onSelectDiffFile: (filePath: string) => void;
  fileTree: FileTreeNode[];
  worktrees: WorktreeInfo[];
  onToggleStageFile: (filePath: string, currentStaged: boolean) => void;
  onRevertFileDiff: (filePath: string) => void;
  onAddInlineComment: (filePath: string, lineNumber: number, body: string) => void;
  onSubmitInlineReviewToAgent: () => void;
  onCommitChanges: (message: string, push?: boolean) => void;
  onCreateWorktree: (branchName: string) => void;
  onMergeWorktree: (worktreeId: string) => void;
}

export const RightInspectorPane: React.FC<RightInspectorPaneProps> = ({
  lang,
  activeTab,
  onTabChange,
  onClose,
  onRefreshGit,
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
  const i18n = t(lang);

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
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<
    Array<{ id: string; cmd: string; output: string; exitCode: number }>
  >([]);
  const [terminalRunning, setTerminalRunning] = useState(false);

  // Live Preview state
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

  useEffect(() => {
    if (activeTab === 'terminal' && terminalLogs.length === 0) {
      handleRunTerminal(undefined, 'codex --version 2>&1 || true; git status --short');
    }
  }, [activeTab]);

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
    setTerminalRunning(true);

    const res = await executeTerminalCommand(cmd, thread.cwd);
    setTerminalRunning(false);
    setTerminalLogs((prev) => [
      ...prev,
      {
        id: `term_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        cmd,
        output:
          [res.stdout, res.stderr].filter(Boolean).join('\n').trim() ||
          '(completed with exit code 0)',
        exitCode: res.exitCode,
      },
    ]);
  };

  const handleSaveSourceFile = async () => {
    await writeWorkspaceFile(selectedSourcePath, sourceContent);
    setSourceSavedNotice(true);
    setTimeout(() => setSourceSavedNotice(false), 1800);
    onRefreshGit();
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
              className="w-full flex items-center gap-1.5 py-1 pr-2 text-xs codex-text-secondary codex-hover rounded transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 codex-text-muted shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 codex-text-muted shrink-0" />
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
              ? 'codex-active codex-text-primary font-medium'
              : 'codex-text-secondary codex-hover'
          }`}
        >
          <span className="flex items-center gap-1.5 truncate">
            <FileCode2 className="w-3.5 h-3.5 codex-accent-text shrink-0" />
            <span className="truncate">{node.name}</span>
          </span>
        </button>
      );
    });
  };

  const renderDiffPanelContent = () => (
    <div className="flex flex-col h-full min-h-0">
      {/* Diff Summary & Review Actions Header */}
      <div className="px-3 py-2 border-b codex-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium codex-text-primary">
            {thread.changedFiles.length} {i18n.inspector.changedFiles}
          </span>
          <span className="text-xs font-mono text-emerald-500">
            +{thread.diffSummary.additions}
          </span>
          <span className="text-xs font-mono text-rose-500">
            -{thread.diffSummary.deletions}
          </span>
          <button
            onClick={onRefreshGit}
            title={i18n.inspector.refreshDiff}
            className="p-1 rounded codex-hover codex-text-muted hover:codex-text-primary"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center codex-card p-0.5 rounded-lg border codex-border">
            <button
              onClick={() => setDiffViewMode('unified')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                diffViewMode === 'unified'
                  ? 'codex-active codex-text-primary'
                  : 'codex-text-muted hover:codex-text-primary'
              }`}
            >
              <AlignJustify className="w-3 h-3" />
              <span>{i18n.inspector.unified}</span>
            </button>
            <button
              onClick={() => setDiffViewMode('split')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                diffViewMode === 'split'
                  ? 'codex-active codex-text-primary'
                  : 'codex-text-muted hover:codex-text-primary'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>{i18n.inspector.split}</span>
            </button>
          </div>

          {totalComments > 0 && (
            <button
              onClick={onSubmitInlineReviewToAgent}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg codex-accent-btn text-xs font-medium transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>
                {i18n.inspector.sendFeedback} ({totalComments})
              </span>
            </button>
          )}
        </div>
      </div>

      {thread.changedFiles.length > 0 ? (
        <>
          {/* File Selector Pills */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 border-b codex-border overflow-x-auto shrink-0">
            {thread.changedFiles.map((file) => {
              const active = currentDiff?.filePath === file.filePath;
              return (
                <button
                  key={file.id}
                  onClick={() => onSelectDiffFile(file.filePath)}
                  className={`px-2 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 shrink-0 border transition-colors ${
                    active
                      ? 'codex-active codex-border codex-text-primary'
                      : 'border-transparent codex-text-secondary codex-hover'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      file.staged ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}
                  />
                  <span>{file.filePath.split('/').pop()}</span>
                  <span className="text-[10px] text-emerald-500">+{file.additions}</span>
                  <span className="text-[10px] text-rose-500">-{file.deletions}</span>
                </button>
              );
            })}
          </div>

          {/* Active File Stage / Revert Actions */}
          {currentDiff && (
            <div className="px-3 py-1.5 codex-card border-b codex-border flex items-center justify-between text-xs">
              <span className="font-mono codex-text-secondary truncate text-[11px]">
                {currentDiff.filePath}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onToggleStageFile(currentDiff.filePath, currentDiff.staged)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                    currentDiff.staged
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                      : 'codex-elevated codex-border codex-text-secondary hover:codex-text-primary'
                  }`}
                >
                  {currentDiff.staged ? i18n.inspector.staged : i18n.inspector.stage}
                </button>
                <button
                  onClick={() => onRevertFileDiff(currentDiff.filePath)}
                  className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/25 text-[11px] font-mono flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{i18n.inspector.revert}</span>
                </button>
              </div>
            </div>
          )}

          {/* Diff Hunks */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3 font-mono text-xs">
            {currentDiff?.hunks.map((hunk) => (
              <div
                key={hunk.id}
                className="rounded-xl border codex-border overflow-hidden codex-card"
              >
                <div className="px-3 py-1 codex-elevated codex-text-muted text-[11px] border-b codex-border flex items-center justify-between">
                  <span className="truncate">{hunk.header}</span>
                  <span className="text-[10px] shrink-0 ml-2">
                    {i18n.inspector.clickLineToComment}
                  </span>
                </div>

                {diffViewMode === 'unified' ? (
                  <div className="divide-y divide-black/5">
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
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15'
                                : line.type === 'del'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15'
                                : 'codex-text-secondary codex-hover'
                            }`}
                          >
                            <span className="w-7 text-right pr-2 codex-text-muted select-none shrink-0 text-[10px]">
                              {line.oldLineNumber ?? ''}
                            </span>
                            <span className="w-7 text-right pr-2 codex-text-muted select-none shrink-0 text-[10px]">
                              {line.newLineNumber ?? ''}
                            </span>
                            <span className="w-3.5 select-none font-bold shrink-0">
                              {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                            </span>
                            <span className="flex-1 whitespace-pre overflow-x-auto">
                              {line.content}
                            </span>
                            <MessageSquarePlus className="w-3.5 h-3.5 codex-accent-text opacity-0 group-hover:opacity-100 shrink-0 ml-1" />
                          </div>

                          {lineComments.map((cmt) => (
                            <div
                              key={cmt.id}
                              className="mx-3 my-1.5 p-2.5 rounded-lg codex-elevated border codex-border font-sans text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between text-[11px] codex-accent-text">
                                <span className="font-semibold">
                                  @{cmt.author} · Line {cmt.lineNumber}
                                </span>
                                <span className="codex-text-muted">{cmt.createdAt}</span>
                              </div>
                              <p className="codex-text-primary">{cmt.body}</p>
                            </div>
                          ))}

                          {isCommenting && (
                            <div className="mx-3 my-2 p-2.5 rounded-lg codex-elevated border codex-border font-sans space-y-2">
                              <div className="text-[11px] codex-text-primary font-medium">
                                {i18n.inspector.commentOnLine} {lineNum}
                              </div>
                              <textarea
                                rows={2}
                                value={commentDraft}
                                onChange={(e) => setCommentDraft(e.target.value)}
                                placeholder={i18n.inspector.commentPlaceholder}
                                className="w-full rounded-lg codex-card border codex-border p-2 text-xs codex-text-primary focus:outline-none"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setCommentingLine(null)}
                                  className="px-2 py-1 rounded codex-card text-xs codex-text-secondary"
                                >
                                  {i18n.inspector.cancel}
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
                                  className="px-2.5 py-1 rounded codex-accent-btn text-xs font-medium"
                                >
                                  {i18n.inspector.addComment}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 divide-x codex-border">
                    <div className="divide-y divide-black/5 overflow-x-auto">
                      {hunk.lines
                        .filter((l) => l.type !== 'add')
                        .map((line, i) => (
                          <div
                            key={i}
                            className={`px-2 py-0.5 whitespace-pre ${
                              line.type === 'del'
                                ? 'bg-rose-500/10 text-rose-500'
                                : 'codex-text-secondary'
                            }`}
                          >
                            <span className="inline-block w-6 codex-text-muted select-none text-[10px]">
                              {line.oldLineNumber}
                            </span>
                            {line.type === 'del' ? '- ' : '  '}
                            {line.content}
                          </div>
                        ))}
                    </div>
                    <div className="divide-y divide-black/5 overflow-x-auto">
                      {hunk.lines
                        .filter((l) => l.type !== 'del')
                        .map((line, i) => (
                          <div
                            key={i}
                            className={`px-2 py-0.5 whitespace-pre ${
                              line.type === 'add'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'codex-text-secondary'
                            }`}
                          >
                            <span className="inline-block w-6 codex-text-muted select-none text-[10px]">
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

          {/* Bottom Commit Input Bar */}
          <div className="p-2.5 border-t codex-border flex items-center gap-2">
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={`${i18n.inspector.commitPlaceholder} (${thread.branch})...`}
              className="flex-1 codex-card border codex-border rounded-lg px-2.5 py-1.5 text-xs codex-text-primary placeholder:codex-text-muted focus:outline-none"
            />
            <button
              onClick={() => {
                onCommitChanges(
                  commitMessage.trim() || `Update via Codex (${thread.branch})`,
                  false
                );
                setCommitMessage('');
              }}
              className="px-3 py-1.5 rounded-lg codex-accent-btn text-xs font-medium flex items-center gap-1 shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{i18n.header.commit}</span>
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle2 className="w-8 h-8 codex-accent-text opacity-70 mb-2" />
          <div className="text-xs font-medium codex-text-primary">
            {i18n.inspector.noUncommittedChanges}
          </div>
          <p className="text-[11px] codex-text-muted mt-1 max-w-xs">
            <span className="font-mono">{thread.branch}</span> — {i18n.inspector.cleanWorkingTree}
          </p>
        </div>
      )}
    </div>
  );

  const renderFilesPanelContent = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b codex-border flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono codex-text-primary truncate">{selectedSourcePath}</span>
          <button
            onClick={() => setSelectedSourcePath('~/.codex/config.toml')}
            className="px-1.5 py-0.5 rounded codex-card border codex-border text-[10px] font-mono codex-accent-text shrink-0"
          >
            ~/.codex/config.toml
          </button>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {sourceSavedNotice && (
            <span className="text-[11px] codex-accent-text font-mono">
              {i18n.inspector.saved}
            </span>
          )}
          <button
            onClick={handleSaveSourceFile}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg codex-accent-btn text-[11px] font-medium"
          >
            <Save className="w-3 h-3" />
            <span>{i18n.inspector.save}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 min-h-0 divide-x codex-border">
        <div className="col-span-5 overflow-y-auto p-1.5">
          {renderFileTreeNodes(fileTree)}
        </div>
        <div className="col-span-7 flex flex-col min-h-0 codex-card">
          <textarea
            value={sourceContent}
            onChange={(e) => setSourceContent(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-3 bg-transparent font-mono text-xs codex-text-primary focus:outline-none resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );

  const renderTerminalPanelContent = () => (
    <div className="flex flex-col h-full min-h-0 font-mono text-xs">
      <div className="px-2.5 py-1.5 border-b codex-border flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[11px] codex-text-secondary">zsh · {thread.branch}</span>
        <div className="flex items-center gap-1">
          {['codex --version', 'codex login status', 'git status', 'git worktree list'].map(
            (qCmd) => (
              <button
                key={qCmd}
                onClick={() => handleRunTerminal(undefined, qCmd)}
                className="px-1.5 py-0.5 rounded codex-card border codex-border codex-hover text-[10px] codex-text-secondary"
              >
                {qCmd}
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 codex-card">
        {terminalLogs.map((entry) => (
          <div key={entry.id} className="space-y-1">
            <div className="flex items-center justify-between codex-accent-text">
              <span>$ {entry.cmd}</span>
              <span className="text-[10px] codex-text-muted">exit {entry.exitCode}</span>
            </div>
            <pre className="codex-text-primary whitespace-pre-wrap pl-2.5 border-l-2 codex-border leading-relaxed text-[11px]">
              {entry.output}
            </pre>
          </div>
        ))}
        {terminalRunning && (
          <div className="text-xs codex-text-muted animate-pulse">
            {i18n.inspector.runningCmd}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => handleRunTerminal(e)}
        className="p-2 border-t codex-border flex items-center gap-2"
      >
        <span className="codex-accent-text font-bold">$</span>
        <input
          type="text"
          value={terminalInput}
          onChange={(e) => setTerminalInput(e.target.value)}
          placeholder={i18n.inspector.terminalPlaceholder}
          className="flex-1 bg-transparent codex-text-primary focus:outline-none text-xs"
        />
        <button
          type="submit"
          className="px-2.5 py-1 rounded-lg codex-accent-btn text-[11px] font-sans font-medium"
        >
          {i18n.inspector.run}
        </button>
      </form>
    </div>
  );

  const renderPreviewPanelContent = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b codex-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium codex-text-primary">
          <Globe className="w-3.5 h-3.5 codex-accent-text" />
          <span>{i18n.inspector.browserInspectorTitle}</span>
        </div>

        <div className="flex items-center gap-1 codex-card p-0.5 rounded-lg border codex-border">
          <button
            onClick={() => setPreviewViewport('desktop')}
            className={`p-1 rounded ${
              previewViewport === 'desktop' ? 'codex-active codex-text-primary' : 'codex-text-muted'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPreviewViewport('tablet')}
            className={`p-1 rounded ${
              previewViewport === 'tablet' ? 'codex-active codex-text-primary' : 'codex-text-muted'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPreviewViewport('mobile')}
            className={`p-1 rounded ${
              previewViewport === 'mobile' ? 'codex-active codex-text-primary' : 'codex-text-muted'
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
          <div className="rounded-xl border codex-border codex-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono codex-accent-soft">
                @Browser · {thread.branch}
              </span>
              <span className="text-xs font-mono codex-text-muted">
                {thread.cwd || '/Users/zhangjinhui/Desktop/codex-test'}
              </span>
            </div>
            <h3 className="text-sm font-semibold codex-text-primary">
              {i18n.inspector.browserInspectorTitle}
            </h3>
            <p className="text-xs codex-text-secondary leading-relaxed">
              {i18n.inspector.browserInspectorDesc}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-3 rounded-lg codex-elevated border codex-border">
                <div className="text-[11px] codex-text-muted">
                  {i18n.inspector.activeWorktrees}
                </div>
                <div className="text-sm font-semibold codex-accent-text mt-0.5">
                  {worktrees.length} {i18n.inspector.tracked}
                </div>
              </div>
              <div className="p-3 rounded-lg codex-elevated border codex-border">
                <div className="text-[11px] codex-text-muted">
                  {i18n.inspector.gitDiffStatus}
                </div>
                <div className="text-sm font-semibold codex-text-primary mt-0.5 font-mono">
                  +{thread.diffSummary.additions} / -{thread.diffSummary.deletions}
                </div>
              </div>
            </div>
          </div>
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
          placeholder="codex/new-feature..."
          className="flex-1 codex-card border codex-border rounded-lg px-2.5 py-1.5 text-xs codex-text-primary focus:outline-none font-mono"
        />
        <button
          onClick={() => {
            if (newWorktreeBranch.trim()) {
              onCreateWorktree(newWorktreeBranch.trim());
              setNewWorktreeBranch('');
            }
          }}
          className="px-3 py-1.5 rounded-lg codex-accent-btn text-xs font-medium flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{i18n.inspector.addWorktree}</span>
        </button>
      </div>

      <div className="space-y-2">
        {worktrees.map((wt) => (
          <div
            key={wt.id}
            className="p-3 rounded-xl codex-card border codex-border space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 codex-accent-text" />
                <span className="text-xs font-mono font-semibold codex-text-primary">
                  {wt.branch}
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded codex-accent-soft">
                {wt.status}
              </span>
            </div>
            <div className="text-[11px] font-mono codex-text-muted truncate">{wt.path}</div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] codex-text-muted">
                HEAD {wt.headCommit} · {wt.createdAt}
              </span>
              {wt.branch !== 'main' && wt.branch !== 'master' && (
                <button
                  onClick={() => onMergeWorktree(wt.id)}
                  className="px-2 py-0.5 rounded codex-elevated border codex-border text-[11px] codex-text-primary codex-hover flex items-center gap-1"
                >
                  <GitMerge className="w-3 h-3 codex-accent-text" />
                  <span>{i18n.inspector.syncMerge}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <aside className="w-[460px] xl:w-[520px] codex-inspector-bg border-l codex-border flex flex-col h-full shrink-0 select-none">
      {/* Right Drawer Top Tab Header */}
      <div className="h-11 px-2.5 border-b codex-border flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {[
            {
              id: 'diff' as RightPanelTab,
              label: i18n.inspector.review,
              icon: FileDiffIcon,
              badge: thread.changedFiles.length || undefined,
            },
            { id: 'files' as RightPanelTab, label: i18n.inspector.files, icon: FolderTree },
            {
              id: 'terminal' as RightPanelTab,
              label: i18n.inspector.terminal,
              icon: TerminalIcon,
            },
            { id: 'preview' as RightPanelTab, label: i18n.inspector.browser, icon: Globe },
            {
              id: 'worktrees' as RightPanelTab,
              label: i18n.inspector.worktrees,
              icon: GitBranch,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                  active
                    ? 'codex-active codex-text-primary'
                    : 'codex-text-secondary codex-hover'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono codex-card border codex-border">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          title={i18n.header.closeInspector}
          className="p-1.5 rounded-md codex-text-muted hover:codex-text-primary codex-hover shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Active Drawer Content */}
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
