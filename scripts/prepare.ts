import { basename, dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import fg from 'fast-glob'
import type { PackageInfo, RuleInfo } from '../packages/metadata'

const cwd = process.cwd()

async function run() {
  const paths = await fg('./packages/*/package.json', {
    onlyFiles: true,
    absolute: true,
    ignore: [
      'node_modules',
    ],
  })

  const packages = await Promise.all(paths.map(i => readPackage(dirname(i))))

  await Promise.all(packages.flatMap(i => [
    writeRulesIndex(i),
    writeREADME(i),
  ]))

  // await writeVitePressRewrite(packages)

  await fs.writeFile(
    join(cwd, 'packages', 'metadata', 'metadata.ts'), `
// generated by scripts/prepare.ts
import type { PackageInfo } from './types'

export const packages: Readonly<PackageInfo[]> = Object.freeze(${JSON.stringify(packages, null, 2)})\n
`.trimStart(),
    'utf-8',
  )
}

run()

async function readPackage(path: string): Promise<PackageInfo> {
  const dir = relative(join(cwd, 'packages'), path)
  const pkgId = `@stylistic/${dir.replace('eslint-plugin-', '')}`
  const shortId = pkgId.replace('@stylistic/', '')
  const pkgJSON = JSON.parse(await fs.readFile(join(path, 'package.json'), 'utf-8'))
  console.log(`Preparing ${path}`)
  const rulesDir = (await fg('rules/*', {
    cwd: path,
    onlyDirectories: true,
  })).sort()

  const rules = await Promise.all(
    rulesDir.map(async (ruleDir) => {
      const name = basename(ruleDir)
      let entry = join(path, ruleDir, `${name}.ts`).replace(/\\/g, '/')
      if (!existsSync(entry))
        entry = join(path, ruleDir, `${name}.js`).replace(/\\/g, '/')

      const mode = await import(entry)
      const meta = mode.default?.meta
      const rule: RuleInfo = {
        name,
        ruleId: `${pkgId}/${name}`,
        entry,
        // TODO: check if entry exists
        docsEntry: relative(cwd, resolve(path, ruleDir, 'README.md')).replace(/\\/g, '/'),
        meta: {
          fixable: meta?.fixable,
          docs: {
            description: meta?.docs?.description,
            recommended: meta?.docs?.recommended,
          },
        },
      }
      return rule
    }))

  return {
    name: pkgJSON.name,
    shortId,
    pkgId,
    path,
    rules,
  }
}

async function writeRulesIndex(pkg: PackageInfo) {
  if (!pkg.rules.length)
    return

  const ruleDir = join(pkg.path, 'rules')

  await fs.mkdir(ruleDir, { recursive: true })

  if (pkg.shortId === 'js') {
    const index = `module.exports = {\n${pkg.rules.map(i => `  '${i.name}': () => require('./${relative(ruleDir, i.entry).replace(/\\/g, '/')}'),`).join('\n')}\n}\n`
    await fs.writeFile(join(ruleDir, 'index.js'), index, 'utf-8')
  }
  else {
    const index = [
      ...pkg.rules.map(i => `import ${camelCase(i.name)} from './${i.name}/${i.name}'`),
      '',
      'export default {',
      ...pkg.rules.map(i => `  '${i.name}': ${camelCase(i.name)},`),
      '}',
      '',
    ].join('\n')
    await fs.writeFile(join(ruleDir, 'index.ts'), index, 'utf-8')
  }
}

async function writeREADME(pkg: PackageInfo) {
  if (!pkg.rules.length)
    return

  const lines = [
    `# ${pkg.name}`,
    '',
    '| Rule ID | Description | Fixable | Recommended |',
    '| --- | --- | --- | --- |',
    ...pkg.rules.map(i => `| [\`${i.ruleId}\`](./rules/${i.name}) | ${i.meta?.docs?.description || ''} | ${i.meta?.fixable ? '✅' : ''} | ${i.meta?.docs?.recommended ? '✅' : ''} |`),
  ]

  await fs.writeFile(join(pkg.path, 'rules.md'), lines.join('\n'), 'utf-8')
}

function camelCase(str: string) {
  return str
    .replace(/[^\d\w_-]+/, '')
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}
