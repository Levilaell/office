import { describe, expect, it } from 'vitest';
import {
  check,
  checkApp,
  findDrift,
  formatReport,
  parseEnvFile,
  parseExampleKeys,
} from '../check-env';

const EXAMPLE = `# comentário\nFOO=bar\nBAZ=qux\n# outra linha\nANTHROPIC_API_KEY=sk-...\nREDIS_URL=redis://localhost\n`;

describe('parseExampleKeys', () => {
  it('extrai chaves top-level e ignora comentários/blank lines', () => {
    expect(parseExampleKeys(EXAMPLE)).toEqual([
      'FOO',
      'BAZ',
      'ANTHROPIC_API_KEY',
      'REDIS_URL',
    ]);
  });

  it('deduplica chaves repetidas', () => {
    expect(parseExampleKeys('FOO=1\nFOO=2\n')).toEqual(['FOO']);
  });

  it('ignora linhas que não começam com [A-Z_]+=', () => {
    expect(parseExampleKeys('foo=lower\n  INDENTED=1\nMIX-DASH=1\nVALID=1\n')).toEqual([
      'VALID',
    ]);
  });
});

describe('parseEnvFile', () => {
  it('faz parse de pares key=value', () => {
    const m = parseEnvFile('FOO=bar\nBAZ=qux\n');
    expect(m.get('FOO')).toBe('bar');
    expect(m.get('BAZ')).toBe('qux');
  });

  it('strip de quotes (single e double)', () => {
    const m = parseEnvFile('FOO="bar"\nBAZ=\'qux\'\n');
    expect(m.get('FOO')).toBe('bar');
    expect(m.get('BAZ')).toBe('qux');
  });

  it('preserva = no value', () => {
    const m = parseEnvFile('TOKEN=abc=def=ghi\n');
    expect(m.get('TOKEN')).toBe('abc=def=ghi');
  });

  it('ignora comentários e linhas vazias', () => {
    const m = parseEnvFile('# coment\n\nFOO=bar\n# outra\n');
    expect(m.get('FOO')).toBe('bar');
    expect(m.size).toBe(1);
  });

  it('value vazio fica como string vazia', () => {
    const m = parseEnvFile('EMPTY=\n');
    expect(m.get('EMPTY')).toBe('');
  });
});

describe('checkApp', () => {
  const exampleKeys = ['FOO', 'BAR', 'BAZ'];

  it('todas presentes → missing vazio', () => {
    const r = checkApp({
      app: 'web',
      envLocalContent: 'FOO=1\nBAR=2\nBAZ=3\n',
      exampleKeys,
    });
    expect(r).toEqual({ app: 'web', envLocalPresent: true, missing: [] });
  });

  it('chave faltando → entra em missing', () => {
    const r = checkApp({
      app: 'web',
      envLocalContent: 'FOO=1\nBAZ=3\n',
      exampleKeys,
    });
    expect(r.envLocalPresent).toBe(true);
    expect(r.missing).toEqual(['BAR']);
  });

  it('chave presente mas vazia conta como faltando', () => {
    const r = checkApp({
      app: 'web',
      envLocalContent: 'FOO=1\nBAR=\nBAZ=3\n',
      exampleKeys,
    });
    expect(r.missing).toEqual(['BAR']);
  });

  it('.env.local ausente (null) → envLocalPresent=false, missing=todas', () => {
    const r = checkApp({ app: 'web', envLocalContent: null, exampleKeys });
    expect(r.envLocalPresent).toBe(false);
    expect(r.missing).toEqual(exampleKeys);
  });
});

describe('check', () => {
  const exampleContent = 'A=x\nB=y\nC=z\n';
  const allPresent = 'A=1\nB=2\nC=3\n';

  it('todas as 3 apps com tudo → ok=true (caso "exit 0")', () => {
    const r = check({
      exampleContent,
      apps: [
        { name: 'web', envLocalContent: allPresent },
        { name: 'agent-runtime', envLocalContent: allPresent },
        { name: 'workers', envLocalContent: allPresent },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.apps.every((a) => a.missing.length === 0)).toBe(true);
  });

  it('uma chave faltando em uma app → ok=false (caso "exit 1")', () => {
    const r = check({
      exampleContent,
      apps: [
        { name: 'web', envLocalContent: allPresent },
        { name: 'agent-runtime', envLocalContent: 'A=1\nC=3\n' },
        { name: 'workers', envLocalContent: allPresent },
      ],
    });
    expect(r.ok).toBe(false);
    const runtime = r.apps.find((a) => a.app === 'agent-runtime');
    expect(runtime?.missing).toEqual(['B']);
  });
});

describe('formatReport', () => {
  const exampleContent = 'A=x\nB=y\n';

  it('caso OK retorna mensagem positiva', () => {
    const r = check({
      exampleContent,
      apps: [
        { name: 'web', envLocalContent: 'A=1\nB=2\n' },
        { name: 'agent-runtime', envLocalContent: 'A=1\nB=2\n' },
        { name: 'workers', envLocalContent: 'A=1\nB=2\n' },
      ],
    });
    expect(formatReport(r)).toBe('✓ envs OK');
  });

  it('mensagem inclui nome do app + nome da env faltando', () => {
    const r = check({
      exampleContent,
      apps: [
        { name: 'web', envLocalContent: 'A=1\n' },
        { name: 'agent-runtime', envLocalContent: 'A=1\nB=2\n' },
        { name: 'workers', envLocalContent: 'A=1\nB=2\n' },
      ],
    });
    const report = formatReport(r);
    expect(report).toContain('apps/web/.env.local');
    expect(report).toContain('- B');
  });

  it('app sem .env.local sinaliza ausência explicitamente', () => {
    const r = check({
      exampleContent,
      apps: [
        { name: 'web', envLocalContent: null },
        { name: 'agent-runtime', envLocalContent: 'A=1\nB=2\n' },
        { name: 'workers', envLocalContent: 'A=1\nB=2\n' },
      ],
    });
    const report = formatReport(r);
    expect(report).toContain('apps/web/.env.local ausente');
    expect(report).toContain('- A');
    expect(report).toContain('- B');
  });
});

describe('findDrift', () => {
  it('sem drift quando valores idênticos', () => {
    const drift = findDrift([
      { name: 'web', envLocalContent: 'A=1\nB=2\n' },
      { name: 'agent-runtime', envLocalContent: 'A=1\nB=2\n' },
      { name: 'workers', envLocalContent: 'A=1\nB=2\n' },
    ]);
    expect(drift).toEqual([]);
  });

  it('detecta drift quando valor diverge entre apps', () => {
    const drift = findDrift([
      { name: 'web', envLocalContent: 'A=1\nB=2\n' },
      { name: 'agent-runtime', envLocalContent: 'A=99\nB=2\n' },
      { name: 'workers', envLocalContent: 'A=1\nB=2\n' },
    ]);
    expect(drift).toHaveLength(1);
    expect(drift[0]?.key).toBe('A');
    expect(drift[0]?.values).toEqual([
      { app: 'web', value: '1' },
      { app: 'agent-runtime', value: '99' },
      { app: 'workers', value: '1' },
    ]);
  });

  it('chave presente em só um app não conta como drift', () => {
    const drift = findDrift([
      { name: 'web', envLocalContent: 'ONLY_WEB=x\nA=1\n' },
      { name: 'agent-runtime', envLocalContent: 'A=1\n' },
      { name: 'workers', envLocalContent: 'A=1\n' },
    ]);
    expect(drift).toEqual([]);
  });

  it('chave vazia em um app ignorada na comparação', () => {
    const drift = findDrift([
      { name: 'web', envLocalContent: 'A=1\n' },
      { name: 'agent-runtime', envLocalContent: 'A=\n' },
      { name: 'workers', envLocalContent: 'A=1\n' },
    ]);
    expect(drift).toEqual([]);
  });

  it('múltiplas chaves divergentes ficam ordenadas alfabeticamente', () => {
    const drift = findDrift([
      { name: 'web', envLocalContent: 'Z=1\nA=1\n' },
      { name: 'agent-runtime', envLocalContent: 'Z=2\nA=2\n' },
      { name: 'workers', envLocalContent: 'Z=1\nA=1\n' },
    ]);
    expect(drift.map((d) => d.key)).toEqual(['A', 'Z']);
  });
});

describe('check + drift integration', () => {
  it('drift entre apps faz ok=false mesmo com todas as chaves presentes', () => {
    const r = check({
      exampleContent: 'A=x\n',
      apps: [
        { name: 'web', envLocalContent: 'A=1\n' },
        { name: 'agent-runtime', envLocalContent: 'A=2\n' },
        { name: 'workers', envLocalContent: 'A=1\n' },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.drift).toHaveLength(1);
    expect(r.drift[0]?.key).toBe('A');
  });

  it('formatReport menciona drift de valor explicitamente', () => {
    const r = check({
      exampleContent: 'A=x\n',
      apps: [
        { name: 'web', envLocalContent: 'A=1\n' },
        { name: 'agent-runtime', envLocalContent: 'A=99\n' },
        { name: 'workers', envLocalContent: 'A=1\n' },
      ],
    });
    const report = formatReport(r);
    expect(report).toContain('drift de valor');
    expect(report).toContain('TD-006');
    expect(report).toContain('A:');
  });

  it('formatReport trunca valores longos pra evitar despejar secrets', () => {
    const longA = 'a'.repeat(100);
    const longB = 'b'.repeat(100);
    const r = check({
      exampleContent: 'A=x\n',
      apps: [
        { name: 'web', envLocalContent: `A=${longA}\n` },
        { name: 'agent-runtime', envLocalContent: `A=${longB}\n` },
        { name: 'workers', envLocalContent: `A=${longA}\n` },
      ],
    });
    const report = formatReport(r);
    expect(report).toContain('...');
    expect(report.includes(longA)).toBe(false);
  });
});
