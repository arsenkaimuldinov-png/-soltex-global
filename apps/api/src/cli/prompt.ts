/** Console prompts for the CLI scripts; hidden input never echoes and is never logged. */
import readline from 'node:readline';

export async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  try {
    return (await new Promise<string>((resolve) => rl.question(question, resolve))).trim();
  } finally {
    rl.close();
  }
}

/** Reads a line from the terminal without echoing it. Requires a TTY. */
export function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) throw new Error('hidden input needs an interactive terminal (or use --password-stdin)');
  process.stderr.write(question);
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk: Buffer) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') return finish(new Error('cancelled'));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    const finish = (error?: Error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stderr.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

/** The whole of standard input, first line only (for automation: `… --password-stdin < file`). */
export async function readStdinLine(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.split(/\r?\n/)[0] ?? '';
}
