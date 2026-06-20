const vscode = require('vscode');

/**
 * Tries to figure out which workspace file the error actually points to,
 * by parsing common traceback/stack-trace formats. Falls back to the
 * currently active editor if nothing matches.
 */
function resolveTargetFile(err) {
  const workspaceFolders = (vscode.workspace.workspaceFolders || []).map((f) => f.uri.fsPath);
  const isInWorkspace = (p) => workspaceFolders.length === 0 || workspaceFolders.some((w) => p.startsWith(w));
  const sep = process.platform === 'win32' ? '\\' : '/';

  // Python traceback frames: File "path", line N
  const pyMatches = [...err.output.matchAll(/File "([^"]+)", line (\d+)/g)];
  for (let i = pyMatches.length - 1; i >= 0; i--) {
    const p = pyMatches[i][1];
    if (isInWorkspace(p) && !p.includes('site-packages') && !p.includes(`${sep}venv${sep}`)) {
      return vscode.Uri.file(p);
    }
  }

  // Node.js stack frames: (path:line:col) or at path:line:col
  const nodeMatches = [...err.output.matchAll(/\(?([^\s():]+\.(?:js|ts|mjs|cjs)):(\d+):(\d+)\)?/g)];
  for (let i = nodeMatches.length - 1; i >= 0; i--) {
    const p = nodeMatches[i][1];
    if (isInWorkspace(p) && !p.includes('node_modules')) {
      return vscode.Uri.file(p);
    }
  }

  return vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri;
}

module.exports = { resolveTargetFile };
