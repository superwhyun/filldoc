import { build } from "esbuild"
import { chmodSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const outdir = join(here, "dist")

const ENTRIES = [
  "extract-doc",
  "extract-text",
  "render-doc",
  "templatize-doc",
  "build-template",
  "fill-doc",
  "analyze-doc",
  "repgen",
]

// packages/core/src와 lib/server/* 등 monorepo-internal 소스만 번들에 포함하고,
// 실제 npm 배포 패키지는 external로 남겨 tarball 설치 시 pnpm/npm이 정상 설치하게 한다.
const EXTERNAL = ["docx", "docxtemplater", "pizzip", "pdf-parse", "openai", "@ai-sdk/xai", "ai"]

rmSync(outdir, { recursive: true, force: true })
mkdirSync(outdir, { recursive: true })

await build({
  entryPoints: ENTRIES.map((name) => join(here, "src", `${name}.ts`)),
  outdir,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: EXTERNAL,
  // entry 소스가 이미 #!/usr/bin/env node로 시작하므로 banner를 추가하지 않는다
  // (추가하면 shebang이 두 줄로 중복돼 두 번째 줄이 SyntaxError가 된다).
  logLevel: "info",
})

for (const name of ENTRIES) {
  chmodSync(join(outdir, `${name}.js`), 0o755)
}

console.log(`apps/cli: ${ENTRIES.length}개 entry를 dist/에 번들링했습니다.`)
