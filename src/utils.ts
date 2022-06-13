export function from(lines: Iterable<string>): string {
  return Array.from(lines).join('\n');
}

let indentCount = 0;

export function* block(
  line: string,
  body: string | Iterable<string> | (() => string | Iterable<string>),
): Iterable<string> {
  yield line;
  yield* indent(body);
  yield 'end';
}

export function* indent(
  lines: string | Iterable<string> | (() => string | Iterable<string>),
): Iterable<string> {
  try {
    indentCount++;
    const x = typeof lines === 'function' ? iter(lines()) : iter(lines);
    for (const line of x) {
      yield line.trim().length
        ? `${'  '.repeat(indentCount)}${line.trim()}`
        : '';
    }
  } finally {
    indentCount--;
  }
}

function iter(value: string | Iterable<string>): Iterable<string> {
  return typeof value === 'string' ? [value] : value;
}
