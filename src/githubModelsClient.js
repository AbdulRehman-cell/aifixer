const ENDPOINT = 'https://models.github.ai/inference/chat/completions';

const SYSTEM_PROMPT = `You are an expert software debugger embedded in a VS Code extension.
You will be given the full content of a single source file and the error output produced when it was run.
Respond ONLY with a JSON object of this exact shape, nothing else:
{"explanation": "<one or two sentence explanation of the bug and the fix>", "fixedCode": "<the COMPLETE corrected file content>"}
Rules:
- Do not wrap the JSON in markdown code fences.
- Do not include any text before or after the JSON object.
- "fixedCode" must be the entire file, not a snippet or diff.
- Preserve the original code style, comments, and structure as much as possible; change only what's needed to fix the reported error.
- If the error is caused by a missing dependency/package rather than a code bug, still return fixedCode equal to the original content, and explain the missing dependency in "explanation".`;

/**
 * Sends the file content + error output to a GitHub Models-hosted chat
 * model and asks for a corrected version of the file.
 * Returns { explanation, fixedCode }.
 */
async function requestFix(token, model, filePath, fileContent, errorOutput, command) {
  const userPrompt = `File: ${filePath}
${command ? `Command that was run: ${command}\n` : ''}
--- FILE CONTENT START ---
${fileContent}
--- FILE CONTENT END ---

--- ERROR OUTPUT START ---
${errorOutput}
--- ERROR OUTPUT END ---`;

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      })
    });
  } catch (e) {
    throw new Error(`Network error calling GitHub Models: ${e.message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GitHub Models request failed (${response.status} ${response.statusText}): ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  const raw = (data.choices && data.choices[0] && data.choices[0].message.content) || '';

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse the AI's response as JSON. Raw response started with: ${raw.slice(0, 300)}`);
  }

  if (typeof parsed.fixedCode !== 'string' || !parsed.fixedCode.length) {
    throw new Error('AI response did not include a "fixedCode" field.');
  }

  return parsed;
}

module.exports = { requestFix };
