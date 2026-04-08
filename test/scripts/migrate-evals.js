import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

const goldenFile = 'test/data/golden_evals.json'
const agenticFile = 'test/data/agentic_evals.json'
const outDir = 'test/evals/cases'

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 40)
}

function processEvals(filePath, defaultCategory, idPrefix) {
  if (!fs.existsSync(filePath)) {
    return
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  data.forEach(item => {
    const category = item.category || defaultCategory
    const id = `${idPrefix}${item.id.toString().padStart(2, '0')}`
    const slug = slugify(item.prompt)
    const fileName = `${id}-${slug}.md`
    const fullPath = path.join(outDir, category, fileName)

    const frontmatter = {
      id,
      category,
      tags: item.tags || [category],
      expected_tools: item.expected_tools || [],
      forbidden_patterns: [],
      required_patterns: [],
    }

    let mdContent = `---\n${yaml.dump(frontmatter)}---\n\n`
    mdContent += `## Prompt\n${item.prompt}\n\n`
    mdContent += `## Golden Response\n${item.golden_response}\n`

    fs.writeFileSync(fullPath, mdContent)
    console.log(`Wrote ${fullPath}`)
  })
}

processEvals(goldenFile, 'knowledge', 'k')
processEvals(agenticFile, 'inspection', 'a') // Let's use 'a' for agentic, then re-map based on category?
// Wait, the instructions say: Maps IDs: golden #1 -> k01, agentic inspection #1 -> i01, etc.
