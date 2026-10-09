# Evidência da validação integrada final

Dados originais em JSON, preservados em um anexo Markdown compatível com a auditoria do mARC.

```json
{
  "commands": [
    {
      "command": "pnpm run validate",
      "exitCode": 0,
      "durationMs": 19529,
      "tail": "> @notfounnd/marc-server@0.2.0 code:check C:\\Projetos\\marc\n> pnpm run lint:check && pnpm run format:check\n\n\n> @notfounnd/marc-server@0.2.0 lint:check C:\\Projetos\\marc\n> eslint src/**/*.{ts,tsx} test/**/*.ts eslint.config.js\n\n\n> @notfounnd/marc-server@0.2.0 format:check C:\\Projetos\\marc\n> prettier --check .\n\nChecking formatting...\nAll matched files use Prettier code style!\n\n> @notfounnd/marc-server@0.2.0 typecheck C:\\Projetos\\marc\n> tsc -p tsconfig.json --noEmit\n\n"
    },
    {
      "command": "pnpm test",
      "exitCode": 0,
      "durationMs": 11243,
      "tail": "  type: 'test'\n  ...\n# Subtest: refreshes while memory prepare or rebuild is running\nok 198 - refreshes while memory prepare or rebuild is running\n  ---\n  duration_ms: 0.7394\n  type: 'test'\n  ...\n1..198\n# tests 198\n# suites 0\n# pass 198\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 9739.1576\n"
    },
    {
      "command": "pnpm build",
      "exitCode": 0,
      "durationMs": 12767,
      "tail": "\n> @notfounnd/marc-server@0.2.0 build C:\\Projetos\\marc\n> node -e \"require('node:fs').rmSync('dist', { recursive: true, force: true })\" && tsc -p tsconfig.build.json && vite build\n\nvite v7.3.2 building client environment for production...\ntransforming...\n✓ 2212 modules transformed.\nrendering chunks...\ncomputing gzip size...\ndist/public/index.html                   0.39 kB │ gzip:   0.26 kB\ndist/public/assets/index-BK0_xBO0.css   43.97 kB │ gzip:   8.79 kB\ndist/public/assets/index-DxQd1kbE.js   660.16 kB │ gzip: 207.15 kB\n✓ built in 7.12s\n"
    }
  ],
  "protectedEngineFilesUnchanged": 35,
  "manifestUnchanged": true,
  "packageAndConfigsUnchanged": true
}
```
