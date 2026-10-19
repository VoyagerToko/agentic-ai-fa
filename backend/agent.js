// The Agent: Claude answers questions by calling the graph + GitHub tools in a loop until it has
// enough to answer. Progress is reported through onEvent so the Agent tab can show it live:
//   onEvent('model', { round })                   a request to Claude is starting
//   onEvent('think', { line })                    a summary of Claude's reasoning
//   onEvent('tool', { id, name, input })          Claude called a tool
//   onEvent('node', { slug, tool })               an entity that tool touched (lights up in the UI)
//   onEvent('tool_done', { id, ms, preview })     the tool finished (duration + start of its result)

import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, runTool } from './tools.js';

export const MODEL = 'claude-sonnet-5-5';
const MAX_STEPS = 25;

const SYSTEM = `You are Nexus, an assistant for a company knowledge graph. The graph holds the company's services, teams, people, engineering standards, tools and guides, with typed facts between them (ownedBy, dependsOn, memberOf, ledBy, mustSatisfy, maintainedBy, relatesTo). Facts are "verified" (trusted) or "proposed" (unconfirmed - say so when you use one).

How to work:
- For anything about the company, use the graph: graph_search to find entities, graph_entity to read one in full, graph_related to follow dependencies or ownership several hops.
- Only use the repo_* tools when the answer must come from live source code on GitHub.
- Never claim a fact is missing until you have opened the relevant entity with graph_entity.

Answer in GitHub-flavored Markdown (tables for comparisons). Cite the entities you used by name. If the graph genuinely lacks something, say exactly what is missing; never invent facts.`;

// The Agent is read-only: it never gets the tools that change the graph.
const AGENT_TOOLS = TOOLS.filter((t) => !t.write).map(({ name, description, input_schema }) => ({ name, description, input_schema }));

let client;

/**
 * Answer one question. `history` is the earlier turns of this chat as [{ role, content }] text.
 * Returns { answer, entities } where entities are the slugs the agent touched.
 */
export async function runAgent(question, history, onEvent) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set in .env');
  client ??= new Anthropic();

  const touched = new Set();
  const messages = [...history.slice(-6), { role: 'user', content: question }];

  for (let step = 0; step < MAX_STEPS; step++) {
    onEvent('model', { round: step + 1 });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools: AGENT_TOOLS,
      messages,
      thinking: { type: 'adaptive', display: 'summarized' }, // readable reasoning summaries for the live trace
      output_config: { effort: 'medium' },
      // If a safety classifier declines, retry server-side on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (response.stop_reason === 'refusal') {
      return { answer: 'Sorry, I can\'t help with that request.', entities: [...touched] };
    }
    // Keep the assistant turn exactly as returned (including thinking blocks) for the next request.
    messages.push({ role: 'assistant', content: response.content });

    for (const block of response.content) {
      if (block.type === 'thinking' && block.thinking?.trim()) onEvent('think', { line: block.thinking.trim() });
    }

    const calls = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || !calls.length) {
      const answer = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      return { answer: answer || '(no answer)', entities: [...touched] };
    }

    // Run every requested tool and send all results back in one user message.
    const results = [];
    for (const call of calls) {
      onEvent('tool', { id: call.id, name: call.name, input: call.input });
      const started = Date.now();
      const onNode = (slug) => {
        touched.add(slug);
        onEvent('node', { slug, tool: call.id });
      };
      const output = await runTool(call.name, call.input, onNode);
      onEvent('tool_done', { id: call.id, ms: Date.now() - started, preview: output.slice(0, 160) });
      results.push({ type: 'tool_result', tool_use_id: call.id, content: output.slice(0, 20000) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { answer: 'I stopped after too many steps - try a narrower question.', entities: [...touched] };
}
