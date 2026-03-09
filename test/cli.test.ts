import { describe, it, expect } from 'vitest';
import { createProgram } from '../src/cli.js';

describe('cli', () => {
  it('creates a program with correct name', () => {
    const program = createProgram();
    expect(program.name()).toBe('badge-sync');
  });

  it('has apply command', () => {
    const program = createProgram();
    const apply = program.commands.find((c) => c.name() === 'apply');
    expect(apply).toBeDefined();
  });

  it('has check command', () => {
    const program = createProgram();
    const check = program.commands.find((c) => c.name() === 'check');
    expect(check).toBeDefined();
  });

  it('has doctor command', () => {
    const program = createProgram();
    const doctor = program.commands.find((c) => c.name() === 'doctor');
    expect(doctor).toBeDefined();
  });

  it('has repair command', () => {
    const program = createProgram();
    const repair = program.commands.find((c) => c.name() === 'repair');
    expect(repair).toBeDefined();
  });

  it('apply command has --dry-run option', () => {
    const program = createProgram();
    const apply = program.commands.find((c) => c.name() === 'apply')!;
    const opts = apply.options.map((o) => o.long);
    expect(opts).toContain('--dry-run');
  });

  it('apply command has --readme option', () => {
    const program = createProgram();
    const apply = program.commands.find((c) => c.name() === 'apply')!;
    const opts = apply.options.map((o) => o.long);
    expect(opts).toContain('--readme');
  });

  it('doctor command has --timeout option', () => {
    const program = createProgram();
    const doctor = program.commands.find((c) => c.name() === 'doctor')!;
    const opts = doctor.options.map((o) => o.long);
    expect(opts).toContain('--timeout');
  });
});
