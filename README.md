# AI Error Fixer (VS Code extension)

Watches your integrated terminal and debugger for errors, sends the error +
the relevant file to a GitHub Models AI model, and applies (or previews) a fix.

Plain JavaScript — no build/compile step needed.

## 1. Get a GitHub token

You need a **fine-grained personal access token** with the `models: read`
permission (no other permissions are required):

1. https://github.com/settings/personal-access-tokens/new
2. Under **Permissions → Account permissions**, set **Models** to **Read-only**.
3. Generate the token and copy it (starts with `github_pat_...`).

GitHub Models is free to use with normal GitHub accounts, subject to rate limits.

## 2. Run it

No dependencies to install — this extension only uses the built-in `vscode`
API and Node's global `fetch`. Just open this folder in VS Code and press
**F5**. This opens an "Extension Development Host" window with the extension
loaded — that's where you'll actually test it (open a Python/Node/etc.
project there).

In the Extension Development Host:

1. Run command **"AI Error Fixer: Set GitHub Token"** (Ctrl+Shift+P / Cmd+Shift+P) and paste your token.
2. Open a script and run it in the **integrated terminal** (e.g. `python app.py`), or start a debug session.
3. If it errors, the extension sends the file + error to the model and:
   - shows a diff with **Apply Fix** / **Discard**, or
   - applies the fix immediately and re-runs the command — if you've turned on auto-apply.

Toggle auto-apply any time with **"AI Error Fixer: Toggle Auto-Apply Fixes"**,
or manually re-trigger a fix on the last captured error with
**"AI Error Fixer: Fix Last Captured Error"**.

## Settings (Settings UI → search "AI Error Fixer")

| Setting | Default | Description |
|---|---|---|
| `aiErrorFixer.autoApply` | `false` | Apply fixes without showing a diff first |
| `aiErrorFixer.model` | `openai/gpt-4.1` | Any model ID from the GitHub Models catalog |
| `aiErrorFixer.autoRerun` | `true` | Re-run the same command after a fix is applied |
| `aiErrorFixer.watchTerminal` | `true` | Watch terminal exit codes |
| `aiErrorFixer.watchDebugger` | `true` | Watch debug sessions for exceptions |
| `aiErrorFixer.maxAutoAttempts` | `3` | Consecutive auto fix+rerun cycles before pausing to ask you |

You can list available model IDs with:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://models.github.ai/catalog/models
```

## How file detection works

The extension parses the error output for `File "...", line N` (Python) or
`(path:line:col)` (Node.js) stack frames and edits *that* file — not just
whatever tab happens to be open. If nothing matches, it falls back to your
currently active editor.

## Known limitations / good next steps

- **Terminal watching** requires VS Code's shell integration (works in the
  default integrated terminal with bash/zsh/PowerShell/pwsh; not all shells
  support reading command output).
- File detection currently covers Python and Node.js stack-trace formats;
  add more regexes in `src/fileResolver.js` for other languages (e.g. Java,
  Go, Rust) as needed.
- The model edits one file at a time. Multi-file fixes (e.g. error caused by
  a bug in an imported helper module from a different file than the
  traceback's deepest frame) aren't handled yet.
- There's no diffing against multiple candidate model responses — it's a
  single request/response per error. You could add retries with the error
  fed back in if the rerun fails again.

## Packaging as a .vsix (optional)

If you want to install it permanently rather than always running via F5:

```bash
npm install -g @vscode/vsce
vsce package
```

This produces an `.vsix` file you can install via the Extensions panel's
"Install from VSIX..." command.
