import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true
})

// Inject accurate source line numbers (0-based data-line) for synchronized scrolling & Click-to-Source
const injectLineNumbers = (tokens, idx, options, env, slf) => {
  const token = tokens[idx]
  if (token.map) {
    const processedLine = token.map[0]
    const actualLine =
      env?.lineMap && env.lineMap[processedLine] !== undefined
        ? env.lineMap[processedLine]
        : processedLine + (env?.lineOffset || 0)
    token.attrSet('data-line', String(actualLine))
  }
  return slf.renderToken(tokens, idx, options, env, slf)
}

md.renderer.rules.paragraph_open = injectLineNumbers
md.renderer.rules.heading_open = injectLineNumbers
md.renderer.rules.bullet_list_open = injectLineNumbers
md.renderer.rules.ordered_list_open = injectLineNumbers
md.renderer.rules.list_item_open = injectLineNumbers
md.renderer.rules.blockquote_open = injectLineNumbers

/**
 * Parse YAML-like frontmatter from the top of the Markdown document
 */
export function parseFrontmatter(rawMarkdown = '') {
  const normalized = rawMarkdown.replace(/\r\n/g, '\n')
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) {
    return {
      meta: {},
      metaLines: {},
      body: normalized,
      lineOffset: 0
    }
  }

  const yamlBlock = match[1]
  const meta = {}
  const metaLines = {}
  yamlBlock.split('\n').forEach((line, idx) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim()
      const val = line.slice(colonIdx + 1).trim()
      if (key) {
        meta[key] = val
        // Line 0 is the opening `---`, so yamlBlock line `idx` is at 0-based line `idx + 1`
        metaLines[key] = idx + 1
      }
    }
  })

  const frontmatterLines = match[0].split('\n').length - 1
  const body = normalized.slice(match[0].length)

  return {
    meta,
    metaLines,
    body,
    lineOffset: frontmatterLines
  }
}

/**
 * Update or insert a key-value field in the YAML frontmatter of the Markdown string
 */
export function updateFrontmatterField(rawMarkdown = '', key, value) {
  const normalized = rawMarkdown.replace(/\r\n/g, '\n')
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) {
    if (!value) return rawMarkdown
    return `---\nname: 姓名\n${key}: ${value}\n---\n\n${normalized}`
  }

  const lines = match[1].split('\n')
  let found = false
  const updatedLines = []

  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx !== -1 && line.slice(0, idx).trim() === key) {
      found = true
      if (value !== null && value !== '') {
        updatedLines.push(`${key}: ${value}`)
      }
    } else {
      updatedLines.push(line)
    }
  }

  if (!found && value !== null && value !== '') {
    updatedLines.push(`${key}: ${value}`)
  }

  const newFrontmatter = `---\n${updatedLines.join('\n')}\n---\n`
  return newFrontmatter + normalized.slice(match[0].length)
}

/**
 * Fix CommonMark edge cases in Chinese resumes:
 * 1) `-**bold**` without space after `-` -> `- **bold**`
 * 2) `#标题` without space after `#` -> `# 标题`
 * 3) `**bold**` containing symbols/punctuation adjacent to CJK characters -> explicit `<strong>`
 * 4) `` `code` `` -> explicit `<code class="resume-tag">` so backticks (even with full-width `｀`) always render
 */
function normalizeChineseMarkdown(line = '') {
  let s = line
  // Normalize full-width backticks `｀` to standard backticks `` ` ``
  s = s.replace(/｀/g, '`')
  // Ensure space after bullet `-` or `*` when followed by `**` or `` ` ``
  s = s.replace(/^(\s*[-*+])(?=\*\*|`)/, '$1 ')
  // Ensure space after heading `#` ~ `######` if missing
  s = s.replace(/^(\s*#{1,6})(?=[^\s#])/, '$1 ')
  // Convert inline `code` into <code class="resume-tag">...</code> directly to avoid any delimiter issues
  s = s.replace(/`([^`\n]+)`/g, '<code class="resume-tag">$1</code>')
  // Convert **bold** into <strong>...</strong> directly so Chinese punctuation like `**65,000+**` or `**标题**：` never fails CommonMark flanking rules
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  return s
}

/**
 * Transform custom blocks:
 * 1) `::: row ... :::` -> flex space-between row (left / center / right) for Experience headers
 * 2) `::: cols-3 ... :::` or `::: cols-2 ... :::` -> multi-row aligned 3-column or 2-column CSS Grid
 */
function preprocessCustomBlocks(body, lineOffset) {
  const lines = body.split('\n')
  const out = []
  const lineMap = []
  let blockType = null // 'row' | 'cols-1' | 'cols-2' | 'cols-3'
  let blockBuffer = []
  let blockStartLine = 0

  const pushLine = (text, sourceLine) => {
    out.push(text)
    lineMap.push(sourceLine)
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    const currentSourceLine = i + lineOffset

    if (!blockType) {
      if (/^(---page---|:::\s*page\s*)$/i.test(trimmed)) {
        pushLine('', currentSourceLine)
        pushLine(`<div class="manual-page-break" data-line="${currentSourceLine}"></div>`, currentSourceLine)
        pushLine('', currentSourceLine)
        continue
      }
      if (/^:::\s*row\s*$/i.test(trimmed)) {
        blockType = 'row'
        blockBuffer = []
        blockStartLine = currentSourceLine
        continue
      }
      const colsMatch = trimmed.match(/^:::\s*cols[- ]?([123])\s*$/i)
      if (colsMatch) {
        blockType = `cols-${colsMatch[1]}`
        blockBuffer = []
        blockStartLine = currentSourceLine
        continue
      }
    }

    if (blockType && /^:::\s*$/.test(trimmed)) {
      const contentLine = blockBuffer.length > 0 ? blockBuffer[0].sourceLine : blockStartLine
      if (blockType === 'row') {
        const content = blockBuffer.map((b) => b.text).join(' ').trim()
        const parts = content.split('|').map((p) => md.renderInline(normalizeChineseMarkdown(p.trim())))
        let rowHtml = ''
        if (parts.length >= 3) {
          rowHtml = `<div class="resume-row" data-line="${contentLine}"><span class="row-left">${parts[0]}</span><span class="row-center">${parts[1]}</span><span class="row-right">${parts.slice(2).join(' | ')}</span></div>`
        } else if (parts.length === 2) {
          rowHtml = `<div class="resume-row" data-line="${contentLine}"><span class="row-left">${parts[0]}</span><span class="row-right">${parts[1]}</span></div>`
        } else {
          rowHtml = `<div class="resume-row" data-line="${contentLine}"><span class="row-left">${parts[0] || ''}</span></div>`
        }
        // IMPORTANT: Add trailing blank line so CommonMark HTML block closes immediately
        // and does not swallow the following `- **xxx**` markdown list lines!
        pushLine('', blockStartLine)
        pushLine(rowHtml, contentLine)
        pushLine('', currentSourceLine)
      } else if (blockType === 'cols-1' || blockType === 'cols-2' || blockType === 'cols-3') {
        const cells = []
        blockBuffer.forEach(({ text: rawLine, sourceLine }) => {
          const lineStr = rawLine.trim()
          if (!lineStr) return
          const splitter = lineStr.includes('|') ? '|' : '，'
          lineStr.split(splitter).forEach((cell) => {
            const c = cell.trim()
            if (c) {
              cells.push(`<div class="grid-cell" data-line="${sourceLine}">${md.renderInline(normalizeChineseMarkdown(c))}</div>`)
            }
          })
        })
        pushLine('', blockStartLine)
        pushLine(
          `<div class="resume-grid ${blockType}" data-line="${contentLine}">${cells.join('')}</div>`,
          contentLine
        )
        pushLine('', currentSourceLine)
      }

      blockType = null
      blockBuffer = []
      continue
    }

    if (blockType) {
      blockBuffer.push({ text: lines[i], sourceLine: currentSourceLine })
    } else {
      pushLine(normalizeChineseMarkdown(lines[i]), currentSourceLine)
    }
  }

  return {
    processedBody: out.join('\n'),
    lineMap
  }
}

const ICONS = {
  phone: `<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  email: `<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  location: `<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  github: `<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`,
  blog: `<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  gender: `<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  birthday: `<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>`,
  politics: `<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>`,
  education: `<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`
}
ICONS['性别'] = ICONS.gender
ICONS['出生年月'] = ICONS.birthday
ICONS['政治面貌'] = ICONS.politics
ICONS['学历'] = ICONS.education
ICONS['电话'] = ICONS.phone
ICONS['邮箱'] = ICONS.email
ICONS['地址'] = ICONS.location

function renderHeaderHtml(meta, metaLines = {}) {
  if (!meta || Object.keys(meta).length === 0) return ''

  const RESERVED_KEYS = new Set([
    'name',
    'role',
    'avatar',
    'avatarShape',
    'avatarSize',
    'avatarX',
    'avatarY',
    'headerCols'
  ])
  const LABEL_MAP = {
    phone: '电话',
    email: '邮箱',
    location: '地址',
    github: 'GitHub',
    blog: '主页',
    gender: '性别',
    birthday: '出生年月',
    birth: '出生年月',
    age: '年龄',
    politics: '政治面貌',
    exp: '经验',
    education: '学历',
    status: '状态'
  }

  const headerCols = meta.headerCols || 'cols-3' // 'cols-3' | 'cols-2' | 'cols-1' | 'inline'
  const isGridHeader =
    headerCols === 'cols-3' || headerCols === 'cols-2' || headerCols === 'cols-1'

  const contactItems = []
  Object.entries(meta).forEach(([key, val]) => {
    if (RESERVED_KEYS.has(key) || !val) return
    const icon = ICONS[key] || ''
    const label = LABEL_MAP[key] || key
    const itemLine = metaLines[key] ?? 0

    if (isGridHeader) {
      let valueHtml = `<span>${val}</span>`
      if (key === 'email') {
        valueHtml = `<a href="mailto:${val}">${val}</a>`
      } else if (key === 'github' || key === 'blog') {
        const href = val.startsWith('http') ? val : `https://${val}`
        valueHtml = `<a href="${href}" target="_blank" rel="noreferrer">${val}</a>`
      }
      contactItems.push(
        `<div class="meta-grid-item" data-line="${itemLine}">${icon}<span class="meta-label">${label}：</span>${valueHtml}</div>`
      )
    } else {
      if (key === 'email') {
        contactItems.push(`<span class="meta-item" data-line="${itemLine}">${icon}<a href="mailto:${val}">${val}</a></span>`)
      } else if (key === 'github' || key === 'blog') {
        const href = val.startsWith('http') ? val : `https://${val}`
        contactItems.push(`<span class="meta-item" data-line="${itemLine}">${icon}<a href="${href}" target="_blank" rel="noreferrer">${val}</a></span>`)
      } else if (ICONS[key]) {
        contactItems.push(`<span class="meta-item" data-line="${itemLine}">${icon}<span>${val}</span></span>`)
      } else {
        contactItems.push(`<span class="meta-item" data-line="${itemLine}"><strong>${label}：</strong><span>${val}</span></span>`)
      }
    }
  })

  const shape = meta.avatarShape || 'circle'
  const size = Number(meta.avatarSize) || 76
  const height = shape === 'idphoto' ? Math.round(size * 1.33) : size
  const offsetX = Number(meta.avatarX) || 0
  const offsetY = Number(meta.avatarY) || 0
  const avatarStyle = `width: ${size}px; height: ${height}px; transform: translate(${offsetX}px, ${offsetY}px);`

  const avatarHtml = meta.avatar
    ? `<div class="resume-avatar-wrap avatar-${shape}" style="${avatarStyle}" title="按住鼠标左键可自由拖拽移动头像位置（双击复位）"><img class="resume-avatar" src="${meta.avatar}" alt="avatar" draggable="false" /></div>`
    : ''

  const contactsContainerHtml = isGridHeader
    ? `<div class="resume-contacts-grid ${headerCols}">${contactItems.join('')}</div>`
    : `<div class="resume-contacts">${contactItems.join('<span class="meta-divider">·</span>')}</div>`

  const nameLine = metaLines.name ?? 0
  const roleLine = metaLines.role ?? nameLine

  return `
    <header class="resume-header" data-line="${nameLine}">
      <div class="resume-header-main">
        <div class="resume-title-row">
          <h1 class="resume-name" data-line="${nameLine}">${meta.name || '未命名'}</h1>
          ${meta.role ? `<span class="resume-role" data-line="${roleLine}">${meta.role}</span>` : ''}
        </div>
        ${contactsContainerHtml}
      </div>
      ${avatarHtml}
    </header>
  `
}

export function renderResumeMarkdown(rawMarkdown = '') {
  const { meta, metaLines, body, lineOffset } = parseFrontmatter(rawMarkdown)
  const { processedBody, lineMap } = preprocessCustomBlocks(body, lineOffset)
  const bodyHtml = md.render(processedBody, { lineOffset, lineMap })
  const fullHtml = renderHeaderHtml(meta, metaLines) + `<div class="resume-body">${bodyHtml}</div>`

  return DOMPurify.sanitize(fullHtml, {
    ADD_TAGS: ['svg', 'path', 'rect', 'circle'],
    ADD_ATTR: [
      'data-line',
      'viewBox',
      'fill',
      'stroke',
      'stroke-width',
      'd',
      'cx',
      'cy',
      'r',
      'x',
      'y',
      'rx',
      'target',
      'style',
      'title',
      'draggable'
    ]
  })
}

