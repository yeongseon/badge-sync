#!/usr/bin/env node
import { createProgram } from './cli.js';

const program = createProgram();
program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);

  if (message.includes('Badge block markers not found')) {
    process.stderr.write('\nHint: Run `badge-sync init` to set up badge markers in your README.\n');
  } else if (message.includes('README file not found')) {
    process.stderr.write('\nHint: Run `badge-sync init` to create a README with badge markers.\n');
  } else if (message.includes('Monorepo package not found')) {
    process.stderr.write('\nHint: Run `badge-sync list` to see available packages.\n');
  } else if (message.includes('Config file not found')) {
    process.stderr.write('\nHint: badge-sync works without config. Remove --config or create the file.\n');
  }

  process.exit(1);
});
