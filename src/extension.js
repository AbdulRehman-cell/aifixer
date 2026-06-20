const vscode = require('vscode');
const path = require('path');

const { runCommand, getRunCommand } = require('./runner');
const { requestFix } = require('./githubModelsClient');
const { applyOrPreviewFix } = require('./fixApplier');

const TOKEN_KEY = 'aiErrorFixer.githubToken';

const retryCounts = new Map();

class RunCodeLensProvider {
  provideCodeLenses(document) {
    const range = new vscode.Range(0, 0, 0, 0);

    return [
      new vscode.CodeLens(range, {
        title: "▶ Run with AI Fixer",
        command: "aiErrorFixer.runCurrentFile"
      })
    ];
  }
}

function activate(context) {
  console.log('AI Error Fixer (REWRITE) active');

  vscode.window.showInformationMessage('AI Error Fixer Activated ✅');

  // Register CodeLens provider
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file' },
      new RunCodeLensProvider()
    )
  );

  // Set token command
  context.subscriptions.push(
    vscode.commands.registerCommand('aiErrorFixer.setToken', async () => {
      const token = await vscode.window.showInputBox({
        title: 'GitHub Token',
        password: true
      });

      if (token) {
        await context.secrets.store(TOKEN_KEY, token);
        vscode.window.showInformationMessage('Token saved');
      }
    })
  );

  // Run file command (triggered by CodeLens)
  context.subscriptions.push(
    vscode.commands.registerCommand('aiErrorFixer.runCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showErrorMessage('No active file');
        return;
      }

      const filePath = editor.document.fileName;
      const command = getRunCommand(filePath);

      if (!command) {
        vscode.window.showErrorMessage('Unsupported file type');
        return;
      }

      await executeAndFix(context, filePath, command);
    })
  );
}

/**
 * CORE LOOP: run → detect error → fix → rerun
 */
async function executeAndFix(context, filePath, command) {
  const config = vscode.workspace.getConfiguration('aiErrorFixer');
  const maxRetries = config.get('maxAutoAttempts', 3);

  const dir = path.dirname(filePath);

  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;

    const result = await runCommand(command, dir);

    if (result.code === 0) {
      vscode.window.showInformationMessage('✅ Execution succeeded');
      return;
    }

    const token = await context.secrets.get(TOKEN_KEY);

    if (!token) {
      vscode.window.showErrorMessage('No GitHub token set');
      return;
    }

    const doc = await vscode.workspace.openTextDocument(filePath);

    vscode.window.showInformationMessage('AI is fixing error...');

    const fix = await requestFix(
      token,
      config.get('model', 'openai/gpt-4.1'),
      filePath,
      doc.getText(),
      result.output,
      command
    );

    const applied = await applyOrPreviewFix(
      doc.uri,
      fix.fixedCode,
      fix.explanation
    );

    if (!applied) return;

    vscode.window.showInformationMessage(`🔁 Retry ${attempt}/${maxRetries}`);
  }

  vscode.window.showErrorMessage('Max retries reached. Fix not resolved.');
}

function deactivate() {}

module.exports = { activate, deactivate };