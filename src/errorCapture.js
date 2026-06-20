const vscode = require('vscode');
const { log } = require('./logger');

/**
 * Watches the integrated terminal's shell integration API for commands that
 * exit with a non-zero code, then reads their combined output.
 * Calls onError({ source: 'terminal', command, output, timestamp }).
 */
function registerTerminalWatcher(context, onError) {
  // Shell integration events are only available on recent VS Code versions.
  if (!('onDidEndTerminalShellExecution' in vscode.window)) {
    log('Shell integration API (onDidEndTerminalShellExecution) is not available in this VS Code version. Terminal watching disabled.');
    vscode.window.showWarningMessage(
      'AI Error Fixer: this VS Code version does not expose the shell integration API ' +
        '(onDidEndTerminalShellExecution). Terminal watching is disabled; debugger watching still works.'
    );
    return;
  }

  log('Terminal watcher registered. Waiting for shell commands to finish...');

  const disposable = vscode.window.onDidEndTerminalShellExecution(async (event) => {
    const config = vscode.workspace.getConfiguration('aiErrorFixer');
    log(`Terminal command ended: "${event.execution.commandLine.value}" exitCode=${event.exitCode}`);

    if (!config.get('watchTerminal', true)) {
      log('watchTerminal is disabled in settings, ignoring.');
      return;
    }

    // exitCode is undefined if the shell doesn't report it; 0 means success.
    if (event.exitCode === undefined) {
      log('exitCode was undefined — this shell/profile may not report exit codes via shell integration.');
      return;
    }
    if (event.exitCode === 0) {
      return;
    }

    let output = '';
    try {
      for await (const chunk of event.execution.read()) {
        output += chunk;
      }
    } catch (e) {
      log(`Could not read terminal output: ${e.message}`);
      return;
    }

    if (!output.trim()) {
      log('Captured empty output, ignoring.');
      return;
    }

    log(`Captured ${output.length} chars of error output, handing off to fix pipeline.`);

    onError({
      source: 'terminal',
      command: event.execution.commandLine.value,
      // Cap size so we don't blow up the request to the model.
      output: output.slice(-8000),
      timestamp: Date.now()
    });
  });

  context.subscriptions.push(disposable);
}

/**
 * Watches all debug sessions for "stopped" events whose reason is an
 * uncaught exception, and pulls exception details via the DAP.
 * Calls onError({ source: 'debugger', output, timestamp }).
 */
function registerDebugWatcher(context, onError) {
  log('Debug watcher registered.');
  const factory = {
    createDebugAdapterTracker(session) {
      return {
        onDidSendMessage(message) {
          const config = vscode.workspace.getConfiguration('aiErrorFixer');
          if (!config.get('watchDebugger', true)) {
            return;
          }

          if (message.type === 'event' && message.event === 'stopped') {
            log(`Debug session stopped, reason="${message.body && message.body.reason}"`);
          }

          if (
            message.type === 'event' &&
            message.event === 'stopped' &&
            message.body &&
            message.body.reason === 'exception'
          ) {
            session.customRequest('exceptionInfo', { threadId: message.body.threadId }).then(
              (info) => {
                const text = [info.description, info.details && info.details.message, info.details && info.details.stackTrace]
                  .filter(Boolean)
                  .join('\n');

                onError({
                  source: 'debugger',
                  output: text || JSON.stringify(info),
                  timestamp: Date.now()
                });
              },
              () => {
                // Adapter doesn't support exceptionInfo; ignore.
              }
            );
          }
        }
      };
    }
  };

  context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('*', factory));
}

module.exports = { registerTerminalWatcher, registerDebugWatcher };
