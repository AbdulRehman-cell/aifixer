const vscode = require('vscode');

const PREVIEW_SCHEME = 'ai-error-fixer-preview';

// Backing store for the read-only "proposed fix" virtual documents used in diff previews.
const proposedDocs = new Map();

class ProposedContentProvider {
  constructor() {
    this.emitter = new vscode.EventEmitter();
    this.onDidChange = this.emitter.event;
  }

  provideTextDocumentContent(uri) {
    return proposedDocs.get(uri.toString()) || '';
  }
}

/**
 * Either applies the fix directly (if aiErrorFixer.autoApply is true) or
 * shows a diff and asks the user to confirm before applying.
 * Returns true if the fix was applied.
 */
async function applyOrPreviewFix(uri, fixedCode, explanation) {
  const config = vscode.workspace.getConfiguration('aiErrorFixer');
  const autoApply = config.get('autoApply', false);

  if (autoApply) {
    await writeFix(uri, fixedCode);
    vscode.window.showInformationMessage(`AI Error Fixer applied a fix: ${explanation}`);
    return true;
  }

  const proposedUri = vscode.Uri.from({
    scheme: PREVIEW_SCHEME,
    path: uri.path,
    query: String(Date.now()) // force a fresh virtual doc each time
  });
  proposedDocs.set(proposedUri.toString(), fixedCode);

  await vscode.commands.executeCommand('vscode.diff', uri, proposedUri, `AI Error Fixer Proposal: ${explanation}`);

  const choice = await vscode.window.showInformationMessage(`AI suggests a fix: ${explanation}`, 'Apply Fix', 'Discard');

  proposedDocs.delete(proposedUri.toString());

  if (choice === 'Apply Fix') {
    await writeFix(uri, fixedCode);
    return true;
  }
  return false;
}

async function writeFix(uri, fixedCode) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
  edit.replace(uri, fullRange, fixedCode);
  await vscode.workspace.applyEdit(edit);
  await doc.save();
}

module.exports = { applyOrPreviewFix, ProposedContentProvider, PREVIEW_SCHEME };
