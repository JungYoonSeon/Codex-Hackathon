import { checkFit, fixtures } from './src/index.ts';
for (const [name, input] of Object.entries(fixtures)) {
  const result = checkFit(input);
  console.log(`\n${name}: ${result.status} (physical=${result.physicalFit}, usage=${result.usageFit})`);
  for (const finding of result.findings) console.log(`  ${finding.rule}: ${finding.message}`);
}
