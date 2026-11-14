<template>
  <div ref="editorHostRef" class="cm-editor-host" :class="{ 'is-dark': isDark }"></div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { EditorState, StateEffect, StateField, Compartment } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  Decoration,
  ViewPlugin,
  placeholder as cmPlaceholder
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  syntaxHighlighting,
  HighlightStyle,
  foldGutter,
  foldKeymap,
  foldService,
  unfoldEffect,
  foldedRanges,
  bracketMatching
} from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { autocompletion, completionKeymap, startCompletion } from '@codemirror/autocomplete'
import { tags } from '@lezer/highlight'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  isDark: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '在此编写 Markdown 简历内容…（输入 / 或 ::: 唤起智能排版指令）'
  }
})

const emit = defineEmits(['update:modelValue', 'cursor-change', 'scroll'])

const editorHostRef = ref(null)
let view = null
let isInternalUpdate = false
let flashTimeoutId = null
const themeCompartment = new Compartment()

/* -------------------- Snippets & Slash / ::: Autocomplete -------------------- */
const RESUME_SNIPPETS = {
  row: `::: row\n**公司/学校名称** | 职位 / 专业方向 | 2024.01 - 至今\n:::\n- **核心成果**：在此描述你的核心贡献与量化指标。`,
  cols3: `::: cols-3\n**电话**：138-0013-8000 | **邮箱**：name@example.com | **地址**：浙江杭州\n**性别**：男 | **出生年月**：1999.08 | **政治面貌**：中共党员\n:::`,
  cols2: `::: cols-2\n**主修课程**：数据结构、操作系统 | **英语水平**：CET-6 (615分)\n**平均绩点**：3.88 / 4.0 (前5%) | **荣誉奖项**：国家奖学金\n:::`,
  cols1: `::: cols-1\n**求职意向**：Java 后端开发工程师\n**期望城市**：杭州 / 上海\n:::`,
  star: `- **项目背景与目标**：针对高并发场景下的性能瓶颈，主导核心服务重构；\n- **核心技术行动**：引入 \`Redis\` 多级缓存与 \`RocketMQ\` 异步削峰方案；\n- **量化业务结果**：接口 P99 耗时降低 **65%**，系统吞吐量提升 **3 倍**。`,
  pagebreak: `---page---`
}

const SLASH_COMMAND_ITEMS = [
  {
    label: '/row',
    displayLabel: '/row · 经历同行三栏',
    detail: '::: row',
    info: '插入「公司/学校 | 职位/专业 | 起止时间」左右两端对齐行',
    template: RESUME_SNIPPETS.row,
    selectOffset: [8, 17]
  },
  {
    label: '/star',
    displayLabel: '/star · STAR 法则经历模板',
    detail: '高分简历写法',
    info: '按「背景目标 → 核心行动 → 量化结果」结构生成项目/工作描述',
    template: RESUME_SNIPPETS.star
  },
  {
    label: '/cols3',
    displayLabel: '/cols3 · 三列对齐网格',
    detail: '::: cols-3',
    info: '插入三列严格对齐的信息网格（适合多行个人信息或技能清单）',
    template: RESUME_SNIPPETS.cols3
  },
  {
    label: '/cols2',
    displayLabel: '/cols2 · 两列对齐网格',
    detail: '::: cols-2',
    info: '插入两列严格对齐的信息网格（适合主修课程、绩点与荣誉奖项）',
    template: RESUME_SNIPPETS.cols2
  },
  {
    label: '/cols1',
    displayLabel: '/cols1 · 单列对齐网格',
    detail: '::: cols-1',
    info: '插入单列规整排列块',
    template: RESUME_SNIPPETS.cols1
  },
  {
    label: '/page',
    displayLabel: '/page · 强制分页符',
    detail: '---page---',
    info: '在此处强制换入下一张 A4 纸',
    template: RESUME_SNIPPETS.pagebreak
  },
  {
    label: '/h2',
    displayLabel: '/h2 · 简历模块主标题',
    detail: '## 标题',
    info: '插入二级模块标题（如：## 工作经历、## 专业技能）',
    template: '## 模块标题',
    selectOffset: [3, 7]
  },
  {
    label: '/h3',
    displayLabel: '/h3 · 子模块标题',
    detail: '### 标题',
    info: '插入三级子标题',
    template: '### 子模块标题',
    selectOffset: [4, 9]
  },
  {
    label: '/tag',
    displayLabel: '/tag · 技能胶囊标签',
    detail: '`技能`',
    info: '插入高亮胶囊样式的技能标签',
    template: '`Spring Boot 3` `Redis` `MySQL`',
    selectOffset: [1, 14]
  },
  {
    label: '/edu',
    displayLabel: '/edu · 教育背景模块',
    detail: '完整章节',
    info: '一键插入标准教育背景章节与院校同行排版',
    template: `## 教育背景\n\n::: row\n**XX大学 (985/211)** | 计算机科学与技术 · 本科/硕士 | 2020.09 - 2024.06\n:::\n- **主修课程**：数据结构与算法、操作系统、计算机网络、数据库系统原理\n- **荣誉奖项**：国家奖学金、校级一等奖学金、ACM 程序设计竞赛银奖`
  },
  {
    label: '/work',
    displayLabel: '/work · 工作经历模块',
    detail: '完整章节',
    info: '一键插入标准工作经历章节与 STAR 成果列表',
    template: `## 工作经历\n\n${RESUME_SNIPPETS.row}`
  }
]

const COLON_BLOCK_ITEMS = [
  {
    label: '::: row',
    displayLabel: '::: row · 经历同行三栏',
    detail: '左 / 中 / 右对齐',
    info: '公司名称 | 岗位名称 | 在职时间 同行展示',
    template: RESUME_SNIPPETS.row,
    selectOffset: [8, 17]
  },
  {
    label: '::: cols-3',
    displayLabel: '::: cols-3 · 三列对齐网格',
    detail: '3 列 CSS Grid',
    info: '使用 | 分隔单元格，多行自动对齐为 3 列',
    template: RESUME_SNIPPETS.cols3
  },
  {
    label: '::: cols-2',
    displayLabel: '::: cols-2 · 两列对齐网格',
    detail: '2 列 CSS Grid',
    info: '使用 | 分隔单元格，多行自动对齐为 2 列',
    template: RESUME_SNIPPETS.cols2
  },
  {
    label: '::: cols-1',
    displayLabel: '::: cols-1 · 单列对齐网格',
    detail: '1 列 CSS Grid',
    info: '单列垂直对齐网格块',
    template: RESUME_SNIPPETS.cols1
  },
  {
    label: '::: page',
    displayLabel: '::: page · 强制分页符',
    detail: '---page---',
    info: '在此处强制换入下一张 A4 纸',
    template: RESUME_SNIPPETS.pagebreak
  }
]

function applySnippetCompletion(v, completion, from, to, item) {
  const tpl = item.template
  const anchor = item.selectOffset ? from + item.selectOffset[0] : from + tpl.length
  const head = item.selectOffset ? from + item.selectOffset[1] : anchor
  v.dispatch({
    changes: { from, to, insert: tpl },
    selection: { anchor, head },
    scrollIntoView: true
  })
}

function resumeAutocompleteSource(context) {
  const line = context.state.doc.lineAt(context.pos)
  const textBefore = line.text.slice(0, context.pos - line.from)

  // 1. Trigger on `:` / `::` / `:::` at the start of a line
  const colonMatch = textBefore.match(/^\s*(:{1,3}[a-zA-Z0-9_-]*)$/)
  if (colonMatch) {
    const token = colonMatch[1]
    // Require at least `::` unless explicitly invoked
    if (token.length < 2 && !context.explicit) return null
    const from = context.pos - token.length
    return {
      from,
      options: COLON_BLOCK_ITEMS.map((item, idx) => ({
        label: item.label,
        displayLabel: item.displayLabel,
        detail: item.detail,
        info: item.info,
        boost: 90 - idx,
        apply: (v, completion, f, t) => applySnippetCompletion(v, completion, f, t, item)
      })),
      validFor: /^:{1,3}[a-zA-Z0-9_-]*$/
    }
  }

  // 2. Trigger on `/` at the start of a line or after whitespace
  const slashMatch = textBefore.match(/(?:^|\s)(\/[a-zA-Z0-9_-]*)$/)
  if (slashMatch) {
    const token = slashMatch[1]
    const from = context.pos - token.length
    return {
      from,
      options: SLASH_COMMAND_ITEMS.map((item, idx) => ({
        label: item.label,
        displayLabel: item.displayLabel,
        detail: item.detail,
        info: item.info,
        boost: 90 - idx,
        apply: (v, completion, f, t) => applySnippetCompletion(v, completion, f, t, item)
      })),
      validFor: /^\/[a-zA-Z0-9_-]*$/
    }
  }

  return null
}

/* -------------------- Custom Folding: Frontmatter, ::: Blocks, Headings -------------------- */
const resumeFoldService = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart)
  const trimmed = line.text.trim()

  // 1. Fold YAML Frontmatter (`---` on line 1)
  if (line.number === 1 && trimmed === '---') {
    for (let i = 2; i <= Math.min(state.doc.lines, 40); i++) {
      const nextLine = state.doc.line(i)
      if (nextLine.text.trim() === '---') {
        return { from: line.to, to: nextLine.to }
      }
    }
  }

  // 2. Fold custom container blocks (`::: row`, `::: cols-3`, etc.)
  if (/^:::\s*(row|cols[- ]?[123])\s*$/i.test(trimmed)) {
    for (let i = line.number + 1; i <= Math.min(state.doc.lines, line.number + 30); i++) {
      const nextLine = state.doc.line(i)
      if (/^:::\s*$/.test(nextLine.text.trim())) {
        return { from: line.to, to: nextLine.to }
      }
    }
  }

  // 3. Fold Markdown Headings (`#` ~ `######`) until next heading of equal or higher level
  const headingMatch = line.text.match(/^(#{1,6})\s+/)
  if (headingMatch) {
    const level = headingMatch[1].length
    let foldEnd = line.to
    for (let i = line.number + 1; i <= state.doc.lines; i++) {
      const nextLine = state.doc.line(i)
      const nextHeading = nextLine.text.match(/^(#{1,6})\s+/)
      if (nextHeading && nextHeading[1].length <= level) {
        break
      }
      foldEnd = nextLine.to
    }
    if (foldEnd > line.to) {
      return { from: line.to, to: foldEnd }
    }
  }

  return null
})

/* -------------------- Custom Line & Token Decorations (Frontmatter, :::, ---page---) -------------------- */
const directiveLineDeco = Decoration.line({ class: 'cm-directive-line' })
const pageBreakLineDeco = Decoration.line({ class: 'cm-pagebreak-line' })
const frontmatterLineDeco = Decoration.line({ class: 'cm-frontmatter-line' })
const frontmatterKeyDeco = Decoration.mark({ class: 'cm-frontmatter-key' })

const resumeCustomDecorations = ViewPlugin.fromClass(
  class {
    constructor(v) {
      this.decorations = this.buildDecorations(v)
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }
    buildDecorations(v) {
      const builder = []
      const doc = v.state.doc

      // Check if document starts with YAML frontmatter `---`
      let fmEndLine = -1
      if (doc.lines >= 2 && doc.line(1).text.trim() === '---') {
        for (let i = 2; i <= Math.min(doc.lines, 40); i++) {
          if (doc.line(i).text.trim() === '---') {
            fmEndLine = i
            break
          }
        }
      }

      for (const { from, to } of v.visibleRanges) {
        let pos = from
        while (pos <= to) {
          const line = doc.lineAt(pos)
          const trimmed = line.text.trim()

          if (fmEndLine > 0 && line.number >= 1 && line.number <= fmEndLine) {
            builder.push(frontmatterLineDeco.range(line.from))
            if (line.number > 1 && line.number < fmEndLine) {
              const colonIdx = line.text.indexOf(':')
              if (colonIdx > 0) {
                builder.push(frontmatterKeyDeco.range(line.from, line.from + colonIdx + 1))
              }
            }
          } else if (/^:::\s*(row|cols[- ]?[123])?\s*$/i.test(trimmed)) {
            builder.push(directiveLineDeco.range(line.from))
          } else if (/^(---page---|:::\s*page\s*)$/i.test(trimmed)) {
            builder.push(pageBreakLineDeco.range(line.from))
          }

          pos = line.to + 1
        }
      }
      return Decoration.set(builder, true)
    }
  },
  {
    decorations: (v) => v.decorations
  }
)

/* -------------------- Flash Target Line Effect (for Click-to-Source) -------------------- */
const setFlashLineEffect = StateEffect.define()

const flashLineField = StateField.define({
  create() {
    return Decoration.none
  },
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setFlashLineEffect)) {
        if (effect.value == null) {
          deco = Decoration.none
        } else {
          const lineNum = Math.min(Math.max(1, effect.value), tr.state.doc.lines)
          const line = tr.state.doc.line(lineNum)
          deco = Decoration.set([Decoration.line({ class: 'cm-flash-target-line' }).range(line.from)])
        }
      }
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f)
})

/* -------------------- Syntax Highlighting Styles -------------------- */
const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: '#1d4ed8', fontWeight: '800', fontSize: '1.14em' },
  { tag: tags.heading2, color: '#2563eb', fontWeight: '700', fontSize: '1.06em' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: '#1e40af', fontWeight: '700' },
  { tag: tags.strong, color: '#0f172a', fontWeight: '700' },
  { tag: tags.emphasis, color: '#334155', fontStyle: 'italic' },
  {
    tag: tags.monospace,
    color: '#0f766e',
    backgroundColor: 'rgba(15, 118, 110, 0.08)',
    borderRadius: '4px'
  },
  { tag: [tags.list, tags.processingInstruction, tags.meta], color: '#2563eb', fontWeight: '600' },
  { tag: tags.quote, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.link, color: '#2563eb', textDecoration: 'underline' },
  { tag: tags.url, color: '#0284c7' },
  { tag: tags.contentSeparator, color: '#94a3b8', fontWeight: '600' }
])

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: '#60a5fa', fontWeight: '800', fontSize: '1.14em' },
  { tag: tags.heading2, color: '#93c5fd', fontWeight: '700', fontSize: '1.06em' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: '#bfdbfe', fontWeight: '700' },
  { tag: tags.strong, color: '#f8fafc', fontWeight: '700' },
  { tag: tags.emphasis, color: '#cbd5e1', fontStyle: 'italic' },
  {
    tag: tags.monospace,
    color: '#5eead4',
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
    borderRadius: '4px'
  },
  { tag: [tags.list, tags.processingInstruction, tags.meta], color: '#60a5fa', fontWeight: '600' },
  { tag: tags.quote, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.link, color: '#60a5fa', textDecoration: 'underline' },
  { tag: tags.url, color: '#38bdf8' },
  { tag: tags.contentSeparator, color: '#64748b', fontWeight: '600' }
])

function getThemeExtension(isDark) {
  return syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle)
}

/* -------------------- Editor Operations & Expose API -------------------- */
function wrapSelection(before, after = before, placeholder = '文本') {
  if (!view) return
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to) || placeholder
  const insert = `${before}${selected}${after}`
  view.dispatch({
    changes: { from, to, insert },
    selection: {
      anchor: from + before.length,
      head: from + before.length + selected.length
    },
    scrollIntoView: true
  })
  view.focus()
}

function prefixSelectedLines(prefixFor) {
  if (!view) return
  const { state } = view
  const { from, to } = state.selection.main
  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to)

  const lines = []
  for (let i = startLine.number; i <= endLine.number; i++) {
    const lineText = state.doc.line(i).text
    const idx = i - startLine.number
    lines.push(prefixFor(idx) + lineText.replace(/^\s*([-*+]|\d+\.)\s+/, ''))
  }
  const block = lines.join('\n')
  view.dispatch({
    changes: { from: startLine.from, to: endLine.to, insert: block },
    selection: { anchor: startLine.from + block.length },
    scrollIntoView: true
  })
  view.focus()
}

function insertHeading(level) {
  if (!view) return
  const { state } = view
  const { from } = state.selection.main
  const line = state.doc.lineAt(from)
  const prefix = `${'#'.repeat(level)} `
  const stripped = line.text.replace(/^#{1,6}\s*/, '')
  const newLine = `${prefix}${stripped || `${level} 级标题`}`

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newLine },
    selection: { anchor: line.from + newLine.length },
    scrollIntoView: true
  })
  view.focus()
}

function insertSnippet(type) {
  if (!view) return
  const raw = RESUME_SNIPPETS[type]
  if (!raw) return
  const { from, to } = view.state.selection.main
  const insertText = `\n${raw}\n`
  view.dispatch({
    changes: { from, to, insert: insertText },
    selection: { anchor: from + insertText.length },
    scrollIntoView: true
  })
  view.focus()
}

function getSelectedText() {
  if (!view) return ''
  const { from, to } = view.state.selection.main
  return view.state.sliceDoc(from, to)
}

function replaceSelection(text) {
  if (!view) return
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from, head: from + text.length },
    scrollIntoView: true
  })
  view.focus()
}

/**
 * Scroll editor to 1-based line number, unfold if folded, move cursor there, and flash highlight
 */
function scrollToLine(line1Based) {
  if (!view) return
  const doc = view.state.doc
  const targetLineNum = Math.min(Math.max(1, Math.round(line1Based)), doc.lines)
  const line = doc.line(targetLineNum)

  // Unfold any folded range that hides this line
  const effects = [
    EditorView.scrollIntoView(line.from, { y: 'center' }),
    setFlashLineEffect.of(targetLineNum)
  ]
  const folded = foldedRanges(view.state)
  folded.between(0, doc.length, (from, to) => {
    if (line.from >= from && line.from <= to) {
      effects.push(unfoldEffect.of({ from, to }))
    }
  })

  view.dispatch({
    selection: { anchor: line.from },
    effects
  })
  view.focus()

  if (flashTimeoutId) clearTimeout(flashTimeoutId)
  flashTimeoutId = setTimeout(() => {
    if (view) {
      view.dispatch({ effects: setFlashLineEffect.of(null) })
    }
  }, 1600)
}

function focus() {
  view?.focus()
}

defineExpose({
  wrapSelection,
  prefixSelectedLines,
  insertHeading,
  insertSnippet,
  getSelectedText,
  replaceSelection,
  scrollToLine,
  focus
})

/* -------------------- Lifecycle & Watchers -------------------- */
onMounted(() => {
  if (!editorHostRef.value) return

  const customKeymap = keymap.of([
    {
      key: 'Mod-b',
      run: () => {
        wrapSelection('**', '**', '加粗文字')
        return true
      }
    },
    {
      key: 'Mod-i',
      run: () => {
        wrapSelection('*', '*', '斜体文字')
        return true
      }
    },
    {
      key: 'Mod-/',
      run: (v) => {
        startCompletion(v)
        return true
      }
    }
  ])

  const state = EditorState.create({
    doc: props.modelValue || '',
    extensions: [
      lineNumbers(),
      foldGutter({
        openText: '▾',
        closedText: '▸'
      }),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      bracketMatching(),
      EditorView.lineWrapping,
      cmPlaceholder(props.placeholder),
      markdown(),
      resumeFoldService,
      resumeCustomDecorations,
      flashLineField,
      themeCompartment.of(getThemeExtension(props.isDark)),
      autocompletion({
        override: [resumeAutocompleteSource],
        activateOnTyping: true,
        icons: false,
        maxRenderedOptions: 12
      }),
      customKeymap,
      keymap.of([...completionKeymap, ...foldKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newDoc = update.state.doc.toString()
          if (newDoc !== props.modelValue) {
            isInternalUpdate = true
            emit('update:modelValue', newDoc)
          }
        }
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head
          const line = update.state.doc.lineAt(head)
          emit('cursor-change', {
            line: line.number,
            col: head - line.from + 1
          })
        }
      }),
      EditorView.domEventHandlers({
        scroll(event, v) {
          const scroller = v.scrollDOM
          if (scroller) {
            emit('scroll', {
              scrollTop: scroller.scrollTop,
              scrollHeight: scroller.scrollHeight,
              clientHeight: scroller.clientHeight
            })
          }
        }
      })
    ]
  })

  view = new EditorView({
    state,
    parent: editorHostRef.value
  })
})

watch(
  () => props.modelValue,
  (newVal) => {
    if (!view) return
    if (isInternalUpdate) {
      isInternalUpdate = false
      return
    }
    const currentDoc = view.state.doc.toString()
    if (newVal !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: newVal || '' }
      })
    }
  }
)

watch(
  () => props.isDark,
  (isDark) => {
    if (!view) return
    view.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtension(isDark))
    })
  }
)

onBeforeUnmount(() => {
  if (flashTimeoutId) clearTimeout(flashTimeoutId)
  view?.destroy()
  view = null
})
</script>
