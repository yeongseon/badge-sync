import { Command } from 'commander';
import { loadConfig } from './config.js';
import { applyBadges, checkBadges, doctorBadges, repairBadges } from './applier.js';

/**
 * Create and configure the CLI program.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('badge-sync')
    .description('Keep your README badges clean, valid, and consistent')
    .version('0.1.0');

  program
    .command('apply')
    .description('Generate and apply badges to the README')
    .option('--readme <path>', 'README file path')
    .option('--config <path>', 'Config file path')
    .option('--dry-run', 'Print changes without writing', false)
    .action(async (opts: { readme?: string; config?: string; dryRun?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      const result = await applyBadges(cwd, config, { dryRun: opts.dryRun });

      if (opts.dryRun) {
        const { formatBadges } = await import('./formatter.js');
        const { resolveBadges } = await import('./resolver.js');
        const { detectMetadata } = await import('./detector.js');
        const metadata = await detectMetadata(cwd);
        const badges = resolveBadges(metadata);
        const formatted = formatBadges(badges, config);
        process.stdout.write(formatted + '\n');
        return;
      }

      if (!result.changed) {
        process.stdout.write('Badges are up to date\n');
        return;
      }

      process.stdout.write(`Applied ${result.applied} badges\n`);
      for (const badge of result.badges) {
        process.stdout.write(`  [${badge.group}] ${badge.label}\n`);
      }
    });

  program
    .command('check')
    .description('Validate badge configuration and ordering')
    .option('--readme <path>', 'README file path')
    .option('--config <path>', 'Config file path')
    .action(async (opts: { readme?: string; config?: string }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      const result = await checkBadges(cwd, config);

      if (result.inSync) {
        process.stdout.write('Badges are in sync\n');
        process.exit(0);
      }

      process.stdout.write('Badges are out of sync\n\n');
      process.stdout.write('Expected:\n');
      process.stdout.write(result.expected + '\n\n');
      process.stdout.write('Current:\n');
      process.stdout.write(result.current + '\n');
      process.exit(1);
    });

  program
    .command('doctor')
    .description('Detect broken or inconsistent badges')
    .option('--readme <path>', 'README file path')
    .option('--config <path>', 'Config file path')
    .option('--timeout <ms>', 'HTTP request timeout per badge URL', '5000')
    .action(async (opts: { readme?: string; config?: string; timeout?: string }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      const timeout = parseInt(opts.timeout ?? '5000', 10);
      const result = await doctorBadges(cwd, config, { timeout });

      if (result.issues.length === 0) {
        process.stdout.write('No issues found\n');
        process.exit(0);
      }

      process.stdout.write(`Found ${result.issues.length} issue(s)\n\n`);
      for (const issue of result.issues) {
        const icon = issue.severity === 'error' ? '✗' : '⚠';
        process.stdout.write(`  ${icon} [${issue.issue}] ${issue.message}\n`);
      }
      process.exit(1);
    });

  program
    .command('repair')
    .description('Automatically repair detected badge issues')
    .option('--readme <path>', 'README file path')
    .option('--config <path>', 'Config file path')
    .option('--dry-run', 'Print repairs without writing', false)
    .option('--timeout <ms>', 'HTTP request timeout per badge URL', '5000')
    .action(async (opts: { readme?: string; config?: string; dryRun?: boolean; timeout?: string }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      const timeout = parseInt(opts.timeout ?? '5000', 10);
      const result = await repairBadges(cwd, config, {
        dryRun: opts.dryRun,
        timeout,
      });

      if (result.fixed.length === 0 && result.remaining.length === 0) {
        process.stdout.write('No issues to repair\n');
        process.exit(0);
      }

      if (result.fixed.length > 0) {
        process.stdout.write(`Fixed ${result.fixed.length} issue(s)\n`);
        for (const issue of result.fixed) {
          process.stdout.write(`  ✓ [${issue.issue}] ${issue.message}\n`);
        }
      }

      if (result.remaining.length > 0) {
        process.stdout.write(`\n${result.remaining.length} issue(s) require manual intervention\n`);
        for (const issue of result.remaining) {
          process.stdout.write(`  ✗ [${issue.issue}] ${issue.message}\n`);
        }
        process.exit(1);
      }
    });

  return program;
}
