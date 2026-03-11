import { Command } from 'commander';
import {
  applyBadges,
  applyWorkspace,
  buildDryRunReport,
  checkBadges,
  checkWorkspace,
  doctorBadges,
  initBadges,
  listBadges,
  repairBadges,
} from './applier.js';
import { loadConfig } from './config.js';
import { detectMetadata } from './detector.js';

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
    .option('--package <name>', 'Target a specific monorepo package')
    .option('--workspace', 'Apply badges to all monorepo packages', false)
    .option('--dry-run', 'Print changes without writing', false)
    .action(async (opts: { readme?: string; config?: string; package?: string; workspace?: boolean; dryRun?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      if (opts.workspace && opts.package) {
        throw new Error('Cannot use --workspace and --package together');
      }

      if (opts.workspace) {
        const workspaceResult = await applyWorkspace(cwd, config, { dryRun: opts.dryRun });
        const totalPackages = workspaceResult.results.length;

        if (opts.dryRun) {
          process.stdout.write(`Workspace: dry run for ${totalPackages} packages\n\n`);

          let succeeded = 0;
          for (const entry of workspaceResult.results) {
            if (entry.error) {
              process.stdout.write(`  ✗ ${entry.packageName} — Error: ${entry.error}\n`);
              continue;
            }

            const report = await buildDryRunReport(cwd, config, entry.packagePath);
            process.stdout.write(
              `  ${entry.packageName} — Would apply ${report.total} badge(s) (${report.newCount} new, ${report.updatedCount} updated, ${report.unchangedCount} unchanged)\n`,
            );
            succeeded += 1;
          }

          process.stdout.write(`\nDry run complete for ${succeeded} packages\n`);
          return;
        }

        process.stdout.write(`Workspace: applying badges to ${totalPackages} packages\n\n`);
        let succeeded = 0;
        for (const entry of workspaceResult.results) {
          if (entry.error) {
            process.stdout.write(`  ✗ ${entry.packageName} — Error: ${entry.error}\n`);
            continue;
          }

          const unchangedSuffix = entry.result.changed ? '' : ' (unchanged)';
          process.stdout.write(
            `  ✓ ${entry.packageName} — Applied ${entry.result.applied} badges${unchangedSuffix}\n`,
          );
          succeeded += 1;
        }

        process.stdout.write(`\nApplied badges to ${succeeded}/${totalPackages} packages\n`);
        return;
      }

      const packageDir = await resolvePackageDir(cwd, opts.package);

      const result = await applyBadges(cwd, config, { dryRun: opts.dryRun }, packageDir);

      if (opts.dryRun) {
        const report = await buildDryRunReport(cwd, config, packageDir);

        process.stdout.write('Dry run - no changes written\n\n');
        process.stdout.write(
          `Would apply ${report.total} badge(s) (${report.newCount} new, ${report.updatedCount} updated, ${report.unchangedCount} unchanged):\n`,
        );
        for (const entry of report.entries) {
          process.stdout.write(`  ${entry.marker} [${entry.badge.group}] ${entry.badge.label}\n`);
        }

        if (report.customBadges.length > 0) {
          process.stdout.write(`\n${report.customBadges.length} custom badge(s) preserved:\n`);
          for (const badge of report.customBadges) {
            process.stdout.write(`  = [custom] ${badge.label}\n`);
          }
        }

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
    .option('--package <name>', 'Target a specific monorepo package')
    .option('--workspace', 'Check badges for all monorepo packages', false)
    .option('--summary', 'Print a structured badge summary for CI', false)
    .action(async (opts: { readme?: string; config?: string; package?: string; workspace?: boolean; summary?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      if (opts.workspace && opts.package) {
        throw new Error('Cannot use --workspace and --package together');
      }

      if (opts.workspace) {
        const workspaceResult = await checkWorkspace(cwd, config);

        if (opts.summary) {
          process.stdout.write('badges summary\n\n');

          let totalValid = 0;
          let totalOutdated = 0;
          let totalMissing = 0;
          let hasErrors = false;

          for (let index = 0; index < workspaceResult.results.length; index += 1) {
            const entry = workspaceResult.results[index];
            let summary: { valid: number; outdated: number; missing: number };

            if (entry.error) {
              hasErrors = true;
              summary = { valid: 0, outdated: 0, missing: 0 };
            } else {
              const report = await buildDryRunReport(cwd, config, entry.packagePath);
              summary = {
                valid: report.unchangedCount,
                outdated: report.updatedCount,
                missing: report.newCount,
              };
            }

            totalValid += summary.valid;
            totalOutdated += summary.outdated;
            totalMissing += summary.missing;

            process.stdout.write(`  ${entry.packageName}\n`);
            process.stdout.write(`    valid:    ${summary.valid}\n`);
            process.stdout.write(`    outdated: ${summary.outdated}\n`);
            process.stdout.write(`    missing:  ${summary.missing}\n`);

            if (index < workspaceResult.results.length - 1) {
              process.stdout.write('\n');
            }
          }

          process.stdout.write('\n');
          process.stdout.write('  total\n');
          process.stdout.write(`    valid:    ${totalValid}\n`);
          process.stdout.write(`    outdated: ${totalOutdated}\n`);
          process.stdout.write(`    missing:  ${totalMissing}\n`);

          process.exit(!hasErrors && totalOutdated === 0 && totalMissing === 0 ? 0 : 1);
        }

        const totalPackages = workspaceResult.results.length;
        process.stdout.write(`Workspace: checking ${totalPackages} packages\n\n`);

        let inSyncCount = 0;
        for (const entry of workspaceResult.results) {
          if (entry.error) {
            process.stdout.write(`  ✗ ${entry.packageName} — Error: ${entry.error}\n`);
            continue;
          }

          if (entry.result.inSync) {
            process.stdout.write(`  ✓ ${entry.packageName} — in sync\n`);
            inSyncCount += 1;
            continue;
          }

          const differences = countLineDifferences(
            entry.result.expected,
            entry.result.current,
          );
          process.stdout.write(
            `  ✗ ${entry.packageName} — out of sync (${differences} differences)\n`,
          );
        }

        process.stdout.write(`\n${inSyncCount}/${totalPackages} packages in sync\n`);
        process.exit(workspaceResult.allInSync ? 0 : 1);
      }

      const packageDir = await resolvePackageDir(cwd, opts.package);

      if (opts.summary) {
        const report = await buildDryRunReport(cwd, config, packageDir);
        process.stdout.write('badges summary\n\n');
        process.stdout.write(`  valid:    ${report.unchangedCount}\n`);
        process.stdout.write(`  outdated: ${report.updatedCount}\n`);
        process.stdout.write(`  missing:  ${report.newCount}\n`);
        process.exit(report.updatedCount === 0 && report.newCount === 0 ? 0 : 1);
      }

      const result = await checkBadges(cwd, config, packageDir);

      if (result.inSync) {
        process.stdout.write('Badges are in sync\n');
        process.exit(0);
      }

      process.stdout.write('Badges are out of sync\n\n');
      process.stdout.write(`Detected ${countLineDifferences(result.expected, result.current)} difference(s)\n\n`);
      process.stdout.write('Expected:\n');
      process.stdout.write(`${result.expected}\n\n`);
      process.stdout.write('Current:\n');
      process.stdout.write(`${result.current}\n`);
      process.exit(1);
    });

  program
    .command('doctor')
    .description('Detect broken or inconsistent badges')
    .option('--readme <path>', 'README file path')
    .option('--config <path>', 'Config file path')
    .option('--timeout <ms>', 'HTTP request timeout per badge URL', '5000')
    .option('--no-cache', 'Skip cache, always make HTTP requests', false)
    .option('--refresh-cache', 'Clear cache before running', false)
    .action(async (opts: { readme?: string; config?: string; timeout?: string; noCache?: boolean; refreshCache?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      const timeout = parseInt(opts.timeout ?? '5000', 10);
      const result = await doctorBadges(cwd, config, {
        timeout,
        noCache: opts.noCache,
        refreshCache: opts.refreshCache,
      });

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
    .option('--no-cache', 'Skip cache, always make HTTP requests', false)
    .option('--refresh-cache', 'Clear cache before running', false)
    .action(async (opts: { readme?: string; config?: string; dryRun?: boolean; timeout?: string; noCache?: boolean; refreshCache?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      const timeout = parseInt(opts.timeout ?? '5000', 10);
      const result = await repairBadges(cwd, config, {
        dryRun: opts.dryRun,
        timeout,
        noCache: opts.noCache,
        refreshCache: opts.refreshCache,
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

  program
    .command('list')
    .description('List detected badges and monorepo packages')
    .option('--readme <path>', 'README file path')
    .option('--config <path>', 'Config file path')
    .action(async (opts: { readme?: string; config?: string }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      const result = await listBadges(cwd, config);

      if (result.isMonorepo) {
        process.stdout.write('Monorepo packages:\n');
        for (const pkg of result.packages) {
          process.stdout.write(`  - ${pkg.name} (${pkg.ecosystem}) at ${pkg.path}\n`);
        }
      } else {
        process.stdout.write('Monorepo packages: none\n');
      }

      process.stdout.write('Detected badges:\n');
      for (const badge of result.badges) {
        process.stdout.write(`  - [${badge.group}] ${badge.label}\n`);
      }
    });

  program
    .command('init')
    .description('Initialize badge-sync in your project')
    .option('--readme <path>', 'README file path')
    .option('--config <path>', 'Config file path')
    .option('--markers-only', 'Only insert badge markers without applying badges', false)
    .option('--dry-run', 'Preview changes without writing anything', false)
    .action(async (opts: { readme?: string; config?: string; markersOnly?: boolean; dryRun?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, opts.config);
      if (opts.readme) config.readme = opts.readme;

      const result = await initBadges(cwd, config, { markersOnly: opts.markersOnly, dryRun: opts.dryRun });

      if (result.markersAlreadyExist) {
        process.stdout.write('Badge markers already exist in README\n');
        process.stdout.write('Run `badge-sync apply` to update badges\n');
        return;
      }

      if (opts.dryRun) {
        process.stdout.write('Dry run - no changes written\n\n');
        if (result.badgesApplied > 0) {
          process.stdout.write(`Would apply ${result.badgesApplied} badge(s):\n`);
          for (const badge of result.badges) {
            process.stdout.write(`  [${badge.group}] ${badge.label}\n`);
          }
        } else {
          process.stdout.write('No badges detected\n');
        }
        return;
      }

      if (result.readmeCreated) {
        process.stdout.write(`Created ${config.readme}\n`);
      }

      process.stdout.write('Inserted badge markers\n');

      if (result.badgesApplied > 0) {
        process.stdout.write(`Applied ${result.badgesApplied} badges\n`);
        for (const badge of result.badges) {
          process.stdout.write(`  [${badge.group}] ${badge.label}\n`);
        }
      }
    });

  return program;
}

async function resolvePackageDir(cwd: string, packageName?: string): Promise<string | undefined> {
  if (!packageName) return undefined;

  const metadata = await detectMetadata(cwd);
  const target = metadata.packages.find((pkg) => pkg.name === packageName);

  if (!target) {
    throw new Error(`Monorepo package not found: ${packageName}`);
  }

  return target.path;
}

function countLineDifferences(expected: string, current: string): number {
  const expectedLines = expected.split('\n');
  const currentLines = current.split('\n');
  const maxLines = Math.max(expectedLines.length, currentLines.length);

  let differences = 0;
  for (let i = 0; i < maxLines; i += 1) {
    if ((expectedLines[i] ?? '') !== (currentLines[i] ?? '')) {
      differences += 1;
    }
  }

  return differences;
}
