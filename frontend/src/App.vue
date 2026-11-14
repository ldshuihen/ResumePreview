<template>
  <div class="app" :class="{ 'theme-dark': isDarkMode }">
    <!-- ==================== App Header ==================== -->
    <header class="app-header">
      <div class="header-left">
        <div class="logo">
          <div class="logo-mark"><FileText :size="16" :stroke-width="2.25" /></div>
          <span class="logo-text">MarkResume</span>
        </div>

        <span class="header-divider"></span>

        <div class="doc-switcher" data-tip="切换简历">
          <select v-model="currentResumeId" class="doc-select" aria-label="切换简历" @change="handleSwitchResume">
            <option v-if="!resumeList.length" :value="null">本地草稿</option>
            <option v-for="item in resumeList" :key="item.id" :value="item.id">{{ item.title }}</option>
          </select>
          <ChevronDown :size="14" class="select-chevron" />
        </div>

        <input
          v-model="currentResume.title"
          class="doc-title-input"
          placeholder="未命名简历"
          aria-label="简历标题"
          spellcheck="false"
        />

        <div class="save-status" :class="saveStatusClass">
          <LoaderCircle v-if="saving" :size="13" class="spin" />
          <span v-else-if="isDirty" class="status-dot dirty"></span>
          <CircleCheck v-else :size="13" />
          <span>{{ saveStatusText }}</span>
        </div>
      </div>

      <div class="header-right">
        <button class="btn btn-ghost" data-tip="新建空白简历" @click="handleCreateNew">
          <FilePlus2 :size="15" />
          <span>新建</span>
        </button>
        <button class="btn btn-ghost" data-tip="基于当前简历克隆一份副本" @click="handleDuplicateResume">
          <Plus :size="15" />
          <span>复制副本</span>
        </button>
        <button
          class="btn btn-ghost btn-danger-text"
          :disabled="deleting"
          data-tip="删除当前简历"
          @click="handleDeleteCurrentResume"
        >
          <Trash2 :size="15" />
          <span>{{ deleting ? '删除中…' : '删除' }}</span>
        </button>
        <button class="btn btn-ghost" @click="openTemplateModal">
          <LayoutTemplate :size="15" />
          <span>模板库</span>
        </button>

        <span class="header-divider"></span>

        <button
          class="icon-btn"
          :data-tip="isDarkMode ? '切换浅色界面' : '切换深色界面'"
          :aria-label="isDarkMode ? '切换浅色界面' : '切换深色界面'"
          @click="isDarkMode = !isDarkMode"
        >
          <Sun v-if="isDarkMode" :size="16" />
          <Moon v-else :size="16" />
        </button>
        <button
          class="icon-btn"
          :class="{ active: showInspector }"
          :data-tip="showInspector ? '收起设置面板' : '展开设置面板'"
          aria-label="切换设置面板"
          @click="showInspector = !showInspector"
        >
          <PanelRightClose v-if="showInspector" :size="16" />
          <PanelRightOpen v-else :size="16" />
        </button>

        <span class="header-divider"></span>

        <input ref="mdImportInputRef" type="file" accept=".md,.markdown,.txt" hidden @change="handleImportMd" />
        <button class="btn btn-secondary" data-tip="从本地导入 Markdown 简历文件" @click="triggerImportMd">
          <Upload :size="15" />
          <span>导入 .md</span>
        </button>
        <button class="btn btn-secondary" :disabled="saving" @click="handleSave">
          <Save :size="15" />
          <span>保存</span>
          <kbd>Ctrl S</kbd>
        </button>

        <div ref="exportDropdownRef" class="export-dropdown">
          <button
            class="btn btn-primary"
            :disabled="Boolean(exportingType)"
            aria-haspopup="menu"
            :aria-expanded="showExportMenu"
            @click="showExportMenu = !showExportMenu"
          >
            <LoaderCircle v-if="exportingType" :size="15" class="spin" />
            <Download v-else :size="15" />
            <span>{{ exportButtonText }}</span>
            <ChevronDown :size="14" class="export-chevron" :class="{ open: showExportMenu }" />
          </button>

          <Transition name="dropdown">
            <div v-if="showExportMenu" class="export-menu" role="menu">
              <button type="button" class="export-menu-item" role="menuitem" @click="handleExportPdf">
                <div class="export-item-icon pdf"><FileText :size="16" /></div>
                <div class="export-item-body">
                  <span class="export-item-title">导出 PDF 文档 (.pdf)</span>
                  <span class="export-item-desc">300DPI 高清 A4 · 保留可点击超链接</span>
                </div>
              </button>

              <button type="button" class="export-menu-item" role="menuitem" @click="handleExportPng">
                <div class="export-item-icon png"><ImageIcon :size="16" /></div>
                <div class="export-item-body">
                  <span class="export-item-title">导出为高清图片 (.png)</span>
                  <span class="export-item-desc">300DPI 简历长图 · 适合微信/Boss直聘发送</span>
                </div>
              </button>

              <button type="button" class="export-menu-item" role="menuitem" @click="handleExportMd">
                <div class="export-item-icon md"><FileCode2 :size="16" /></div>
                <div class="export-item-body">
                  <span class="export-item-title">导出 Markdown (.md)</span>
                  <span class="export-item-desc">纯文本源码文件 · 便于本地备份与迁移</span>
                </div>
              </button>

              <div class="export-menu-divider"></div>

              <button type="button" class="export-menu-item" role="menuitem" @click="handleVectorPrint">
                <div class="export-item-icon print"><Printer :size="16" /></div>
                <div class="export-item-body">
                  <div class="export-item-title-row">
                    <span class="export-item-title">系统矢量打印</span>
                    <kbd>Ctrl P</kbd>
                  </div>
                  <span class="export-item-desc">调用浏览器原生打印预览</span>
                </div>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- ==================== Workspace ==================== -->
    <main ref="workspaceRef" class="workspace" :style="workspaceGridStyle">
      <!-- ---------- Editor Panel ---------- -->
      <section class="editor-panel">
        <div class="panel-header">
          <div class="panel-title">
            <span>Markdown 编辑器</span>
            <span class="panel-subtitle">CodeMirror 6 · 语法高亮 · 章节折叠 · 输入 / 或 ::: 智能补全</span>
          </div>
          <button class="btn btn-ai btn-sm" :disabled="polishing" data-tip="按 STAR 法则润色选中的经历描述" @click="handleAiPolish">
            <LoaderCircle v-if="polishing" :size="14" class="spin" />
            <Sparkles v-else :size="14" />
            <span>{{ polishing ? '润色中…' : 'AI 润色' }}</span>
          </button>
        </div>

        <div class="editor-toolbar" role="toolbar" aria-label="Markdown 格式工具">
          <template v-for="(group, gIdx) in toolbarGroups" :key="gIdx">
            <span v-if="gIdx > 0" class="tool-sep"></span>
            <button
              v-for="tool in group"
              :key="tool.tip"
              type="button"
              class="tool-btn"
              :data-tip="tool.tip"
              :aria-label="tool.tip"
              @mousedown.prevent
              @click="tool.action"
            >
              <component :is="tool.icon" :size="16" />
            </button>
          </template>
        </div>

        <div class="editor-body">
          <MarkdownEditor
            ref="editorRef"
            v-model="currentResume.markdownContent"
            :is-dark="isDarkMode"
            @cursor-change="handleCursorChange"
            @scroll="handleEditorScroll"
          />
        </div>

        <footer class="status-bar">
          <div class="status-group">
            <span class="status-item">
              <span class="status-dot" :class="backendOnline ? 'online' : 'offline'"></span>
              {{ backendOnline ? '服务已连接' : '离线模式' }}
            </span>
            <span class="status-item">行 {{ cursorPos.line }}，列 {{ cursorPos.col }}</span>
          </div>
          <div class="status-group">
            <span class="status-item">{{ lineCount }} 行</span>
            <span class="status-item">{{ charCount }} 字符</span>
            <span class="status-item">{{ pagesHtml.length }} 页</span>
          </div>
        </footer>
      </section>

      <!-- ---------- Split Resizer ---------- -->
      <div
        class="pane-resizer"
        :class="{ 'is-resizing': isResizingPane }"
        role="separator"
        aria-orientation="vertical"
        data-tip="拖动调整宽度，双击还原"
        @mousedown="handleResizerMouseDown"
        @dblclick="leftPaneWidth = DEFAULT_LEFT_WIDTH"
      >
        <GripVertical :size="12" class="resizer-grip" />
      </div>

      <!-- ---------- Preview Panel ---------- -->
      <section class="preview-panel">
        <div class="preview-toolbar">
          <div class="toolbar-cluster">
            <span class="preview-label"><Eye :size="15" />实时预览</span>
            <span class="meta-badge">A4 · 210 × 297 mm</span>
            <span
              class="meta-badge click-to-source-badge"
              data-tip="点击右侧 A4 简历任意段落，左侧编辑器将自动跳转到对应 Markdown 行"
            >
              支持点击定位源码
            </span>
          </div>

          <div class="toolbar-cluster">
            <div class="pager">
              <button class="icon-btn icon-btn-sm" :disabled="currentPage <= 1" aria-label="上一页" @click="scrollToPage(currentPage - 1)">
                <ChevronLeft :size="15" />
              </button>
              <span class="pager-text">
                第 <strong>{{ currentPage }}</strong> / {{ pagesHtml.length }} 页
              </span>
              <button
                class="icon-btn icon-btn-sm"
                :disabled="currentPage >= pagesHtml.length"
                aria-label="下一页"
                @click="scrollToPage(currentPage + 1)"
              >
                <ChevronRight :size="15" />
              </button>
            </div>

            <span class="toolbar-sep"></span>

            <div class="zoom-control">
              <button class="icon-btn icon-btn-sm" data-tip="缩小" aria-label="缩小" @click="setZoom(zoom - 0.1)">
                <ZoomOut :size="15" />
              </button>
              <button class="zoom-value" data-tip="恢复 100%" @click="setZoom(1)">{{ Math.round(zoom * 100) }}%</button>
              <button class="icon-btn icon-btn-sm" data-tip="放大" aria-label="放大" @click="setZoom(zoom + 0.1)">
                <ZoomIn :size="15" />
              </button>
              <button
                class="icon-btn icon-btn-sm"
                :class="{ active: autoFit }"
                data-tip="适应窗口"
                aria-label="适应窗口"
                @click="fitToWidth"
              >
                <Maximize2 :size="14" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref="previewPaneRef"
          class="preview-canvas"
          @scroll="handlePreviewScroll"
          @mousedown="handlePreviewMouseDown"
          @dblclick="handlePreviewDblClick"
          @click="handlePreviewClick"
        >
          <!-- Hidden offscreen container used to measure content for pagination -->
          <div
            ref="measureContainerRef"
            class="a4-measure-container"
            :class="`theme-${currentResume.theme}`"
            :style="pageCssVars"
            v-html="renderedHtml"
          ></div>

          <div class="pages-stack" :style="{ zoom }">
            <div
              v-for="(pageContent, idx) in pagesHtml"
              :key="idx"
              class="a4-page"
              :data-page-number="idx + 1"
              :class="[`theme-${currentResume.theme}`, { 'active-page': currentPage === idx + 1 && pagesHtml.length > 1 }]"
              :style="pageCssVars"
            >
              <div class="a4-page-content" v-html="pageContent"></div>
              <div v-if="showPageFooter" class="a4-page-footer">
                第 {{ idx + 1 }} 页 / 共 {{ pagesHtml.length }} 页
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- Inspector (Settings) Panel ---------- -->
      <aside class="inspector" :class="{ collapsed: !showInspector }" aria-label="排版设置">
        <div class="inspector-inner">
          <div class="panel-header">
            <div class="panel-title">
              <SlidersHorizontal :size="15" />
              <span>排版设置</span>
            </div>
            <button class="icon-btn icon-btn-sm" aria-label="收起设置面板" @click="showInspector = false">
              <X :size="15" />
            </button>
          </div>

          <div class="inspector-body">
            <!-- Template style -->
            <section class="setting-section">
              <h4 class="section-title"><Palette :size="14" />模板风格</h4>
              <div class="theme-cards">
                <button
                  v-for="t in THEME_OPTIONS"
                  :key="t.value"
                  type="button"
                  class="theme-card"
                  :class="{ active: currentResume.theme === t.value }"
                  @click="currentResume.theme = t.value"
                >
                  <div class="theme-thumb" :class="`thumb-${t.value}`" :style="{ '--thumb-color': currentResume.primaryColor }">
                    <span class="thumb-head"></span>
                    <span class="thumb-line w80"></span>
                    <span class="thumb-line w60"></span>
                    <span class="thumb-bar"></span>
                    <span class="thumb-line w90"></span>
                    <span class="thumb-line w70"></span>
                  </div>
                  <span class="theme-name">{{ t.label }}</span>
                </button>
              </div>

              <div class="field">
                <label class="field-label">主题色</label>
                <div class="swatches">
                  <button
                    v-for="c in COLOR_PRESETS"
                    :key="c"
                    type="button"
                    class="swatch"
                    :class="{ active: currentResume.primaryColor.toLowerCase() === c }"
                    :style="{ background: c }"
                    :aria-label="`主题色 ${c}`"
                    @click="currentResume.primaryColor = c"
                  >
                    <Check v-if="currentResume.primaryColor.toLowerCase() === c" :size="12" :stroke-width="3" />
                  </button>
                  <label class="swatch swatch-custom" data-tip="自定义颜色">
                    <input v-model="currentResume.primaryColor" type="color" aria-label="自定义主题色" />
                    <Plus :size="12" />
                  </label>
                </div>
              </div>
            </section>

            <!-- Typography -->
            <section class="setting-section">
              <h4 class="section-title"><Type :size="14" />字体与文字</h4>
              <div class="field">
                <label class="field-label" for="font-select">字体</label>
                <div class="select-wrap">
                  <select id="font-select" v-model="currentResume.fontFamily" class="select">
                    <option v-for="f in FONT_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}</option>
                  </select>
                  <ChevronDown :size="14" class="select-chevron" />
                </div>
              </div>
              <SettingSlider v-model="currentResume.fontSize" label="正文字号" :min="12" :max="17" :step="0.5" unit="px" />
              <SettingSlider v-model="currentResume.lineHeight" label="行高" :min="1.25" :max="2" :step="0.05" />
            </section>

            <!-- Spacing -->
            <section class="setting-section">
              <h4 class="section-title"><Rows3 :size="14" />段落间距</h4>
              <SettingSlider v-model="currentResume.sectionGap" label="模块间距" :min="6" :max="28" unit="px" />
              <SettingSlider v-model="currentResume.itemGap" label="条目间距" :min="1" :max="12" unit="px" />
              <div class="field">
                <label class="field-label">快速预设</label>
                <div class="button-group">
                  <button type="button" class="btn btn-secondary btn-sm" @click="applySpacingPreset('compact')">紧凑一页</button>
                  <button type="button" class="btn btn-secondary btn-sm" @click="applySpacingPreset('standard')">标准</button>
                  <button type="button" class="btn btn-secondary btn-sm" @click="applySpacingPreset('relaxed')">宽松</button>
                </div>
              </div>
            </section>

            <!-- Page margins -->
            <section class="setting-section">
              <h4 class="section-title"><Ruler :size="14" />页面边距</h4>
              <SettingSlider v-model="currentResume.marginTop" label="上边距" :min="1" :max="52" unit="px" />
              <SettingSlider v-model="currentResume.marginBottom" label="下边距" :min="1" :max="52" unit="px" />
              <SettingSlider v-model="currentResume.pageMargin" label="左右边距" :min="12" :max="44" :step="2" unit="px" />
            </section>

            <!-- Header & avatar -->
            <section class="setting-section">
              <h4 class="section-title"><SquareUser :size="14" />个人信息与头像</h4>
              <div class="field">
                <label class="field-label">信息排列</label>
                <SegmentedControl v-model="headerCols" :options="HEADER_COL_OPTIONS" />
              </div>

              <div class="field">
                <label class="field-label">头像</label>
                <input ref="avatarInputRef" type="file" accept="image/*" hidden @change="handleAvatarUpload" />
                <div class="avatar-row">
                  <div class="avatar-preview" :class="`shape-${avatarShape}`">
                    <img v-if="resumeMeta.avatar" :src="resumeMeta.avatar" alt="头像预览" />
                    <CircleUser v-else :size="22" />
                  </div>
                  <div class="avatar-actions">
                    <button type="button" class="btn btn-secondary btn-sm" @click="triggerAvatarUpload">
                      <Upload :size="13" />
                      <span>{{ resumeMeta.avatar ? '更换' : '上传' }}</span>
                    </button>
                    <button
                      v-if="resumeMeta.avatar"
                      type="button"
                      class="btn btn-ghost btn-sm btn-danger-text"
                      @click="handleRemoveAvatar"
                    >
                      <Trash2 :size="13" />
                      <span>移除</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="resumeMeta.avatar" class="field">
                <label class="field-label">头像形状</label>
                <SegmentedControl v-model="avatarShape" :options="AVATAR_SHAPE_OPTIONS" />
              </div>

              <SettingSlider
                v-if="resumeMeta.avatar"
                v-model="avatarSize"
                label="头像尺寸"
                :min="52"
                :max="120"
                :step="2"
                unit="px"
              />
              <p v-if="resumeMeta.avatar" class="field-hint">在预览中拖动头像可调整位置，双击还原。</p>
            </section>

            <!-- Display options -->
            <section class="setting-section">
              <h4 class="section-title"><Settings2 :size="14" />显示与保存</h4>
              <label class="toggle-row">
                <span>自动保存（停顿 3 秒）</span>
                <input v-model="autoSave" type="checkbox" class="switch" />
              </label>
              <label class="toggle-row">
                <span>显示页码</span>
                <input v-model="showPageFooter" type="checkbox" class="switch" />
              </label>
              <label class="toggle-row">
                <span>编辑区与预览同步滚动</span>
                <input v-model="syncScroll" type="checkbox" class="switch" />
              </label>
            </section>
          </div>
        </div>
      </aside>
    </main>

    <!-- ==================== Template Library Modal ==================== -->
    <Transition name="modal">
      <div v-if="showTemplateModal" class="modal-backdrop" @click.self="showTemplateModal = false">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="tpl-title">
          <div class="modal-header">
            <div>
              <h3 id="tpl-title" class="modal-title">模板库</h3>
              <p class="modal-desc">选择一个模板开始编辑。套用模板会替换当前编辑器中的内容。</p>
            </div>
            <button class="icon-btn" aria-label="关闭" @click="showTemplateModal = false"><X :size="18" /></button>
          </div>

          <div v-if="templates.length" class="template-grid">
            <article v-for="tpl in templates" :key="tpl.id || tpl.name" class="template-card">
              <div
                class="template-cover"
                :class="`thumb-${tpl.defaultTheme || 'classic-blue'}`"
                :style="{ '--thumb-color': tpl.defaultColor || '#2563eb' }"
              >
                <div class="theme-thumb large">
                  <span class="thumb-head"></span>
                  <span class="thumb-line w80"></span>
                  <span class="thumb-line w60"></span>
                  <span class="thumb-bar"></span>
                  <span class="thumb-line w90"></span>
                  <span class="thumb-line w70"></span>
                  <span class="thumb-line w80"></span>
                </div>
              </div>
              <div class="template-info">
                <div class="template-name-row">
                  <h4 class="template-name">{{ tpl.name }}</h4>
                  <span class="tag">{{ tpl.category }}</span>
                </div>
                <p class="template-desc">{{ tpl.description }}</p>
                <button class="btn btn-primary btn-sm btn-block" @click="applyTemplate(tpl)">使用此模板</button>
              </div>
            </article>
          </div>
          <div v-else class="empty-state">
            <LayoutTemplate :size="28" />
            <p>暂无可用模板，请确认后端服务已启动。</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ==================== Toast Notifications ==================== -->
    <TransitionGroup name="toast" tag="div" class="toast-stack">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast-${t.type}`" role="status">
        <CircleCheck v-if="t.type === 'success'" :size="16" />
        <CircleAlert v-else-if="t.type === 'error'" :size="16" />
        <Info v-else :size="16" />
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>

    <!-- ==================== Global Tooltip ==================== -->
    <div
      v-if="tooltip.visible"
      class="tooltip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
      role="tooltip"
    >
      {{ tooltip.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import {
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
  Info,
  FilePlus2,
  LayoutTemplate,
  Sun,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  FileCode2,
  Save,
  Download,
  Printer,
  Image as ImageIcon,
  Sparkles,
  GripVertical,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  SlidersHorizontal,
  X,
  Palette,
  Check,
  Plus,
  Type,
  Rows3,
  Ruler,
  SquareUser,
  CircleUser,
  Upload,
  Trash2,
  Settings2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Bold,
  Italic,
  List,
  ListOrdered,
  Tag,
  Briefcase,
  Columns3,
  Columns2,
  ListTree,
  SeparatorHorizontal
} from 'lucide-vue-next'
import SettingSlider from './components/SettingSlider.vue'
import SegmentedControl from './components/SegmentedControl.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import { renderResumeMarkdown, parseFrontmatter, updateFrontmatterField } from './utils/markdownParser'
import { exportResumeToPdf, exportResumeToPng, triggerVectorPrint } from './utils/pdfExporter'
import { resumeApi } from './api/resume'

const DEFAULT_MARKDOWN = `---
name: 林远 (Lin Yuan)
role: 高级 Java 后端开发工程师 · 4年经验
headerCols: cols-3
gender: 男
birthday: 1999.08
politics: 中共预备党员
phone: 138-0013-8000
email: linyuan.dev@example.com
location: 浙江杭州
education: 浙江大学 · 硕士
github: github.com/linyuan-dev
avatar: https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=dbeafe
---

## 专业技能

- **Java 核心**：精通 Java 17/21 并发编程（JUC、AQS、线程池调优），深入理解 JVM 内存模型与 G1/ZGC 垃圾回收调优。
- **框架生态**：熟练掌握 \`Spring Boot 3\`、\`Spring Cloud Alibaba\`、\`MyBatis-Plus\`、\`Netty\`，阅读过核心模块源码。
- **数据存储**：精通 \`MySQL\`（索引优化、MVCC、分库分表 ShardingSphere）与 \`Redis\`（分布式锁、多级缓存架构、热 Key 治理）。
- **中间件与云原生**：熟悉 \`Kafka\`、\`RocketMQ\` 消息可靠性投递；熟练使用 \`Docker\`、\`Kubernetes\`、\`Prometheus + Grafana\`。

## 工作经历

::: row
**字节跳动 (ByteDance)** | 电商交易研发部 · 高级后端开发工程师 | 2023.04 - 至今
:::
- **高并发履约核心链路重构**：主导订单履约与库存预占服务拆分，引入 \`Caffeine + Redis\` 二级缓存与异步扣减方案，大促峰值 QPS 突破 **65,000+**，接口 P99 延迟从 \`140ms\` 降至 \`28ms\`。
- **分布式事务一致性治理**：基于 \`RocketMQ\` 事务消息 + 本地消息表兜底对账机制，将跨系统数据不一致率降至 **0.0001%** 以下，日均处理订单超 **1,200 万笔**。
- **线上稳定性保障**：搭建全链路压测与自适应限流降级策略（Sentinel），连续 2 年双十一核心服务可用性达 **99.995%**。

::: row
**网易 (NetEase)** | 云音乐基础架构组 · Java 开发工程师 | 2021.07 - 2023.03
:::
- **统一配置与灰度发布平台**：设计并实现基于长连接推送的毫秒级动态配置中心，接入内部 **300+** 微服务集群。
- **慢 SQL 与存储成本优化**：推进冷热数据分层存储方案（TiDB + MySQL 归档），单集群存储成本节省 **42%**，消灭全部核心链路慢查询。

## 核心项目经验

::: row
**MarkResume 分布式简历渲染与 AI 评测引擎** | 个人开源负责人 (\`Star 1.8k\`) | 2024.02 - 至今
:::
- **技术栈**：\`Spring Boot 3\` \`Vue 3\` \`markdown-it\` \`Spring AI\` \`H2/MySQL\`
- **架构设计**：采用左侧 Markdown 增量 AST 解析与右侧 A4 纸张 CSS 变量驱动渲染，支持双端毫秒级行号同步滚动与矢量 PDF 导出。
- **AI 赋能**：集成后端智能润色接口，实现针对工作经历的 **STAR 法则一键润色**。

## 教育背景

::: row
**浙江大学** | 软件工程 · 工学硕士（保研） | 2018.09 - 2021.06
:::
- **荣誉奖项**：国家奖学金、ACM-ICPC 亚洲区域赛银奖、优秀毕业研究生
`

/* -------------------- Static options -------------------- */
const DEFAULT_LEFT_WIDTH = 40
const A4_WIDTH_PX = (210 * 96) / 25.4

const THEME_OPTIONS = [
  { value: 'classic-blue', label: '经典' },
  { value: 'modern-slate', label: '现代' },
  { value: 'elegant-serif', label: '学术' }
]

const COLOR_PRESETS = ['#2563eb', '#0f766e', '#7c3aed', '#334155', '#b91c1c', '#c2410c']

const FONT_OPTIONS = [
  { value: 'sans', label: '无衬线（微软雅黑 / 苹方）' },
  { value: 'serif', label: '衬线（宋体）' },
  { value: 'kaiti', label: '楷体' },
  { value: 'mono', label: '等宽（JetBrains Mono）' }
]

const HEADER_COL_OPTIONS = [
  { value: 'cols-3', label: '三列' },
  { value: 'cols-2', label: '两列' },
  { value: 'cols-1', label: '单列' },
  { value: 'inline', label: '流式' }
]

const AVATAR_SHAPE_OPTIONS = [
  { value: 'circle', label: '圆形' },
  { value: 'rounded', label: '圆角' },
  { value: 'idphoto', label: '证件照' }
]

const FONT_FAMILY_MAP = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  serif: '"Georgia", "Noto Serif SC", "Songti SC", "SimSun", "STSong", serif',
  kaiti: '"Kaiti SC", "STKaiti", "KaiTi", "FangSong", serif',
  mono: '"JetBrains Mono", "Fira Code", Consolas, "PingFang SC", "Microsoft YaHei", monospace'
}

/* -------------------- State -------------------- */
const resumeList = ref([])
const templates = ref([])
const currentResumeId = ref(null)
const backendOnline = ref(false)
const saving = ref(false)
const deleting = ref(false)
const polishing = ref(false)
const exportingType = ref('') // '' | 'pdf' | 'png'
const showExportMenu = ref(false)
const showTemplateModal = ref(false)
const showInspector = ref(true)
const syncScroll = ref(true)
const showPageFooter = ref(true)
const autoSave = ref(true)
const isDarkMode = ref(false)
const leftPaneWidth = ref(DEFAULT_LEFT_WIDTH)
const isResizingPane = ref(false)
const currentPage = ref(1)
const pagesHtml = ref([''])
const zoom = ref(1)
const autoFit = ref(true)
const cursorPos = reactive({ line: 1, col: 1 })
const toasts = ref([])
const tooltip = reactive({ visible: false, text: '', x: 0, y: 0 })

const isDirty = ref(false)
const lastSavedAt = ref(null)
const savedLocally = ref(false)
const lastSaveWasAuto = ref(false)
let isApplyingData = false
let autoSaveTimer = null

const editorRef = ref(null)
const previewPaneRef = ref(null)
const workspaceRef = ref(null)
const measureContainerRef = ref(null)
const avatarInputRef = ref(null)
const mdImportInputRef = ref(null)
const exportDropdownRef = ref(null)
let isJumpingToSource = false
let jumpSourceTimeout = null

const currentResume = reactive({
  id: null,
  title: '林远 - 高级 Java 后端开发简历',
  theme: 'classic-blue',
  fontFamily: 'sans',
  primaryColor: '#2563eb',
  fontSize: 14,
  lineHeight: 1.6,
  sectionGap: 14,
  itemGap: 4,
  marginTop: 26,
  marginBottom: 24,
  pageMargin: 28,
  markdownContent: DEFAULT_MARKDOWN
})

/* -------------------- Derived state -------------------- */
const workspaceGridStyle = computed(() => ({
  gridTemplateColumns: `${leftPaneWidth.value}% 6px minmax(0, 1fr) ${showInspector.value ? '300px' : '0px'}`
}))

const computedFontFamily = computed(() => FONT_FAMILY_MAP[currentResume.fontFamily] || FONT_FAMILY_MAP.sans)

const pageCssVars = computed(() => ({
  '--primary-color': currentResume.primaryColor,
  '--font-size': `${currentResume.fontSize}px`,
  '--line-height': currentResume.lineHeight,
  '--margin-top': `${currentResume.marginTop}px`,
  '--margin-bottom': `${currentResume.marginBottom}px`,
  '--page-margin': `${currentResume.pageMargin}px`,
  '--section-gap': `${currentResume.sectionGap}px`,
  '--item-gap': `${currentResume.itemGap}px`,
  '--resume-font-family': computedFontFamily.value
}))

const renderedHtml = computed(() => renderResumeMarkdown(currentResume.markdownContent))

const resumeMeta = computed(() => parseFrontmatter(currentResume.markdownContent).meta)

// Header layout and avatar shape live in the Markdown frontmatter, so they stay in sync with the editor
const headerCols = computed({
  get: () => resumeMeta.value.headerCols || 'cols-3',
  set: (val) => {
    currentResume.markdownContent = updateFrontmatterField(currentResume.markdownContent, 'headerCols', val)
  }
})

const avatarShape = computed({
  get: () => resumeMeta.value.avatarShape || 'circle',
  set: (val) => {
    currentResume.markdownContent = updateFrontmatterField(currentResume.markdownContent, 'avatarShape', val)
  }
})

const avatarSize = computed({
  get: () => Number(resumeMeta.value.avatarSize) || 76,
  set: (val) => {
    currentResume.markdownContent = updateFrontmatterField(currentResume.markdownContent, 'avatarSize', String(val))
  }
})

const lineCount = computed(() => (currentResume.markdownContent || '').split('\n').length)
const charCount = computed(() => (currentResume.markdownContent || '').length)

const exportButtonText = computed(() => {
  if (exportingType.value === 'pdf') return '正在生成 PDF…'
  if (exportingType.value === 'png') return '正在生成图片…'
  return '导出'
})

const saveStatusText = computed(() => {
  if (saving.value) return lastSaveWasAuto.value ? '自动保存中…' : '保存中…'
  if (isDirty.value) return autoSave.value ? '编辑中（3 秒后自动保存）' : '有未保存的更改'
  if (lastSavedAt.value) {
    const time = lastSavedAt.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const prefix = lastSaveWasAuto.value ? '已自动保存' : '已保存'
    return savedLocally.value ? `已保存到本地 · ${time}` : `${prefix} · ${time}`
  }
  return '已同步'
})

const saveStatusClass = computed(() => {
  if (saving.value) return 'is-saving'
  if (isDirty.value) return 'is-dirty'
  return 'is-saved'
})

/* -------------------- Editor toolbar -------------------- */
const HEADING_ICONS = [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6]

const toolbarGroups = [
  HEADING_ICONS.map((icon, i) => ({
    icon,
    tip: `${i + 1} 级标题`,
    action: () => insertHeading(i + 1)
  })),
  [
    { icon: Bold, tip: '加粗 (Ctrl+B)', action: () => wrapSelection('**', '**', '加粗文字') },
    { icon: Italic, tip: '斜体 (Ctrl+I)', action: () => wrapSelection('*', '*', '斜体文字') },
    { icon: List, tip: '无序列表', action: () => prefixSelectedLines(() => '- ') },
    { icon: ListOrdered, tip: '有序列表', action: () => prefixSelectedLines((i) => `${i + 1}. `) },
    { icon: Tag, tip: '技能标签', action: () => wrapSelection('`', '`', '技能') }
  ],
  [
    { icon: Briefcase, tip: '经历行（单位 | 职位 | 时间）', action: () => insertSnippet('row') },
    { icon: Columns3, tip: '三列对齐', action: () => insertSnippet('cols3') },
    { icon: Columns2, tip: '两列对齐', action: () => insertSnippet('cols2') },
    { icon: Rows3, tip: '单列对齐', action: () => insertSnippet('cols1') },
    { icon: ListTree, tip: 'STAR 描述模板', action: () => insertSnippet('star') },
    { icon: SeparatorHorizontal, tip: '插入分页符', action: () => insertSnippet('pagebreak') }
  ]
]

/* -------------------- Toasts & tooltip -------------------- */
let toastSeq = 0
function showToast(message, type = 'success') {
  const id = ++toastSeq
  toasts.value.push({ id, message, type })
  if (toasts.value.length > 4) toasts.value.shift()
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 2800)
}

function handleTooltipOver(e) {
  const target = e.target.closest?.('[data-tip]')
  if (!target || isResizingPane.value) {
    tooltip.visible = false
    return
  }
  const rect = target.getBoundingClientRect()
  tooltip.text = target.getAttribute('data-tip')
  const estimatedWidth = tooltip.text.length * 12 + 20
  const half = estimatedWidth / 2
  tooltip.x = Math.min(window.innerWidth - half - 8, Math.max(half + 8, rect.left + rect.width / 2))
  tooltip.y = rect.bottom + 8
  tooltip.visible = true
}

function handleTooltipOut(e) {
  const from = e.target.closest?.('[data-tip]')
  const to = e.relatedTarget?.closest?.('[data-tip]')
  if (from && from !== to) tooltip.visible = false
}

/* -------------------- Pagination -------------------- */
/**
 * Split rendered resume DOM into true multi-page A4 sheets automatically + via manual `---page---` breaks.
 * Uses exact getBoundingClientRect() positions so CSS margin collapsing is 100% accurate and bottom margin can reach 1px.
 */
async function paginateResume() {
  await nextTick()
  const container = measureContainerRef.value
  if (!container) {
    pagesHtml.value = [renderedHtml.value]
    return
  }

  // Standard A4 height in px (~1122.5px at 96dpi) minus top & bottom margins
  const mmToPx = container.offsetWidth / 210
  const fullA4HeightPx = 297 * mmToPx
  const maxPageContentHeight = fullA4HeightPx - currentResume.marginTop - currentResume.marginBottom

  const headerEl = container.querySelector('.resume-header')
  const bodyEl = container.querySelector('.resume-body')
  if (!bodyEl) {
    pagesHtml.value = [renderedHtml.value]
    return
  }

  const pages = []
  let currentHeaderHtml = headerEl ? headerEl.outerHTML : ''
  let currentBodyHtmlList = []

  // Track the exact top coordinate of the first element on the current page
  let pageStartTop = headerEl ? headerEl.getBoundingClientRect().top : bodyEl.getBoundingClientRect().top

  const flushPage = (nextStartTop = null) => {
    if (currentHeaderHtml || currentBodyHtmlList.length > 0) {
      pages.push(`${currentHeaderHtml}<div class="resume-body">${currentBodyHtmlList.join('')}</div>`)
      currentHeaderHtml = ''
      currentBodyHtmlList = []
    }
    if (nextStartTop !== null) {
      pageStartTop = nextStartTop
    }
  }

  const children = Array.from(bodyEl.children)
  for (let i = 0; i < children.length; i++) {
    const el = children[i]

    // 1. Check explicit manual page break (`---page---` or `::: page`)
    if (el.classList.contains('manual-page-break')) {
      const nextSibling = children[i + 1]
      flushPage(nextSibling ? nextSibling.getBoundingClientRect().top : 0)
      continue
    }

    const elRect = el.getBoundingClientRect()
    if (currentBodyHtmlList.length === 0 && !currentHeaderHtml) {
      pageStartTop = elRect.top
    }

    const isHeadingOrRow = /^H[1-4]$/.test(el.tagName) || el.classList.contains('resume-row')
    const nextEl = children[i + 1]

    // 2. Prevent orphan headings/rows at the very bottom of a page:
    // If this heading/row fits, check if at least the first line/item of the next element also fits
    if (isHeadingOrRow && currentBodyHtmlList.length > 0 && nextEl && !nextEl.classList.contains('manual-page-break')) {
      const firstCheckTarget =
        (nextEl.tagName === 'UL' || nextEl.tagName === 'OL') && nextEl.firstElementChild
          ? nextEl.firstElementChild
          : nextEl
      const requiredBottom = firstCheckTarget.getBoundingClientRect().bottom
      if (requiredBottom - pageStartTop > maxPageContentHeight) {
        flushPage(elRect.top)
      }
    }

    // 3. Check if adding `el` exceeds `maxPageContentHeight`
    if (elRect.bottom - pageStartTop > maxPageContentHeight && (currentBodyHtmlList.length > 0 || currentHeaderHtml)) {
      // If it's a <ul> or <ol> with multiple items, split individual <li> items across the page break
      if ((el.tagName === 'UL' || el.tagName === 'OL') && el.children.length > 1) {
        const tag = el.tagName.toLowerCase()
        const fitItems = []
        const nextItems = []
        let nextPageStartTop = null

        Array.from(el.children).forEach((li) => {
          const liRect = li.getBoundingClientRect()
          if (liRect.bottom - pageStartTop <= maxPageContentHeight && nextItems.length === 0) {
            fitItems.push(li.outerHTML)
          } else {
            if (nextItems.length === 0) {
              nextPageStartTop = liRect.top
            }
            nextItems.push(li.outerHTML)
          }
        })

        if (fitItems.length > 0) {
          currentBodyHtmlList.push(`<${tag}>${fitItems.join('')}</${tag}>`)
        }
        flushPage(nextPageStartTop ?? elRect.top)
        if (nextItems.length > 0) {
          currentBodyHtmlList.push(`<${tag}>${nextItems.join('')}</${tag}>`)
        }
        continue
      } else {
        flushPage(elRect.top)
      }
    }

    currentBodyHtmlList.push(el.outerHTML)
  }

  flushPage()
  pagesHtml.value = pages.length > 0 ? pages : [renderedHtml.value]
  if (currentPage.value > pagesHtml.value.length) {
    currentPage.value = pagesHtml.value.length
  }
}

/* -------------------- Preview: paging & zoom -------------------- */
function handlePreviewScroll() {
  const pane = previewPaneRef.value
  if (!pane) return
  const pageEls = pane.querySelectorAll('.a4-page')
  if (!pageEls.length) return

  const threshold = pane.getBoundingClientRect().top + pane.clientHeight * 0.38
  let detectedPage = 1
  pageEls.forEach((pageEl, idx) => {
    if (pageEl.getBoundingClientRect().top <= threshold) {
      detectedPage = idx + 1
    }
  })
  currentPage.value = detectedPage
}

function scrollToPage(pageNum) {
  const pane = previewPaneRef.value
  if (!pane || pageNum < 1 || pageNum > pagesHtml.value.length) return
  const target = pane.querySelector(`.a4-page[data-page-number="${pageNum}"]`)
  if (target) {
    currentPage.value = pageNum
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function clampZoom(value) {
  return Math.min(2, Math.max(0.3, Math.round(value * 100) / 100))
}

function setZoom(value) {
  autoFit.value = false
  zoom.value = clampZoom(value)
}

function fitToWidth() {
  autoFit.value = true
  const pane = previewPaneRef.value
  if (!pane) return
  const available = pane.clientWidth - 64
  zoom.value = clampZoom(Math.min(1, available / A4_WIDTH_PX))
}

let previewResizeObserver = null

/* -------------------- Data loading & saving -------------------- */
function applyResumeData(data) {
  isApplyingData = true
  currentResume.id = data.id
  currentResume.title = data.title || '未命名简历'
  currentResume.theme = data.theme || 'classic-blue'
  currentResume.fontFamily = data.fontFamily || 'sans'
  currentResume.primaryColor = data.primaryColor || '#2563eb'
  currentResume.fontSize = data.fontSize || 14
  currentResume.lineHeight = data.lineHeight || 1.6
  currentResume.sectionGap = data.sectionGap ?? 14
  currentResume.itemGap = data.itemGap ?? 4
  currentResume.marginTop = data.marginTop ?? 26
  currentResume.marginBottom = data.marginBottom ?? 24
  currentResume.pageMargin = data.pageMargin || 28
  currentResume.markdownContent = data.markdownContent || DEFAULT_MARKDOWN
  currentResumeId.value = data.id
  isDirty.value = false
  nextTick(() => {
    isApplyingData = false
  })
}

function applySpacingPreset(preset) {
  const presets = {
    compact: { fontSize: 13, lineHeight: 1.42, sectionGap: 9, itemGap: 2, marginTop: 16, marginBottom: 16, pageMargin: 20, label: '紧凑一页' },
    relaxed: { fontSize: 14.5, lineHeight: 1.75, sectionGap: 18, itemGap: 6, marginTop: 34, marginBottom: 32, pageMargin: 32, label: '宽松' },
    standard: { fontSize: 14, lineHeight: 1.6, sectionGap: 14, itemGap: 4, marginTop: 26, marginBottom: 24, pageMargin: 28, label: '标准' }
  }
  const { label, ...values } = presets[preset] || presets.standard
  Object.assign(currentResume, values)
  showToast(`已应用「${label}」排版预设`, 'info')
}

async function loadInitialData() {
  try {
    const [resumesData, templatesData] = await Promise.all([resumeApi.listResumes(), resumeApi.listTemplates()])
    backendOnline.value = true
    resumeList.value = resumesData
    templates.value = templatesData
    if (resumesData.length > 0) {
      applyResumeData(resumesData[0])
    }
  } catch (err) {
    backendOnline.value = false
    const cached = localStorage.getItem('markresume_draft')
    if (cached) {
      try {
        isApplyingData = true
        Object.assign(currentResume, JSON.parse(cached))
        nextTick(() => {
          isApplyingData = false
        })
      } catch (_) {}
    }
    showToast('无法连接后端服务，已进入离线模式', 'error')
  }
}

function scheduleAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  if (!autoSave.value || !isDirty.value) return
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null
    if (isDirty.value && !saving.value) {
      handleSave({ silent: true })
    }
  }, 3000)
}

watch(
  () => currentResume.title,
  (newTitle) => {
    if (currentResume.id == null) return
    const target = resumeList.value.find((r) => r.id === currentResume.id)
    if (target) {
      target.title = newTitle || '未命名简历'
    }
  }
)

watch(
  () => ({ ...currentResume, showPageFooter: showPageFooter.value }),
  () => {
    localStorage.setItem('markresume_draft', JSON.stringify(currentResume))
    if (!isApplyingData) {
      isDirty.value = true
      scheduleAutoSave()
    }
    paginateResume()
  },
  { deep: true }
)

watch(autoSave, (enabled) => {
  if (enabled && isDirty.value) {
    scheduleAutoSave()
  } else if (!enabled && autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
})

async function handleSwitchResume() {
  if (!currentResumeId.value) return
  try {
    const data = await resumeApi.getResume(currentResumeId.value)
    applyResumeData(data)
    showToast(`已切换至「${data.title}」`, 'info')
  } catch (e) {
    showToast('切换简历失败', 'error')
  }
}

async function handleCreateNew() {
  const newPayload = {
    title: `新建简历 ${resumeList.value.length + 1}`,
    theme: 'classic-blue',
    primaryColor: '#2563eb',
    fontSize: 14,
    lineHeight: 1.6,
    pageMargin: 28,
    markdownContent: DEFAULT_MARKDOWN
  }
  if (backendOnline.value) {
    try {
      const created = await resumeApi.createResume(newPayload)
      resumeList.value.unshift(created)
      applyResumeData(created)
      showToast('已新建简历')
      return
    } catch (_) {}
  }
  applyResumeData({ ...newPayload, id: Date.now() })
  showToast('已在本地新建简历', 'info')
}

async function handleDuplicateResume() {
  const copyPayload = {
    ...currentResume,
    id: null,
    title: `${currentResume.title || '未命名简历'} (副本)`
  }
  if (backendOnline.value) {
    try {
      const created = await resumeApi.createResume(copyPayload)
      resumeList.value.unshift(created)
      applyResumeData(created)
      showToast(`已复制副本「${created.title}」`)
      return
    } catch (_) {}
  }
  const localCopy = { ...copyPayload, id: Date.now() }
  resumeList.value.unshift(localCopy)
  applyResumeData(localCopy)
  showToast(`已在本地复制副本「${localCopy.title}」`, 'info')
}

function triggerImportMd() {
  if (mdImportInputRef.value) {
    mdImportInputRef.value.value = ''
    mdImportInputRef.value.click()
  }
}

function handleImportMd(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const content = String(reader.result || '')
    const baseName = file.name.replace(/\.(md|markdown|txt)$/i, '')
    currentResume.title = baseName || currentResume.title
    currentResume.markdownContent = content
    showToast(`已导入「${file.name}」`)
  }
  reader.readAsText(file, 'utf-8')
}

async function handleDeleteCurrentResume() {
  if (deleting.value) return
  const title = currentResume.title || '未命名简历'
  if (!window.confirm(`确定要删除简历「${title}」吗？此操作不可撤销。`)) {
    return
  }

  deleting.value = true
  try {
    const targetId = currentResume.id
    if (targetId && backendOnline.value) {
      await resumeApi.deleteResume(targetId)
    }

    resumeList.value = resumeList.value.filter((r) => r.id !== targetId)

    if (resumeList.value.length > 0) {
      const nextResume = resumeList.value[0]
      if (backendOnline.value && nextResume.id) {
        const fresh = await resumeApi.getResume(nextResume.id)
        applyResumeData(fresh)
      } else {
        applyResumeData(nextResume)
      }
      showToast(`已删除「${title}」`, 'info')
    } else {
      // No resumes left — create a fresh default resume
      await handleCreateNew()
      showToast(`已删除「${title}」，并为你初始化了一份新简历`, 'info')
    }
  } catch (e) {
    showToast('删除简历失败，请稍后重试', 'error')
  } finally {
    deleting.value = false
  }
}

async function handleSave(options = {}) {
  const isSilent = options && options.silent === true
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  if (saving.value) return
  saving.value = true
  lastSaveWasAuto.value = isSilent
  try {
    if (currentResume.id && backendOnline.value) {
      const updated = await resumeApi.updateResume(currentResume.id, { ...currentResume })
      const idx = resumeList.value.findIndex((r) => r.id === updated.id)
      if (idx !== -1) resumeList.value[idx] = updated
    } else {
      const created = await resumeApi.createResume({ ...currentResume })
      backendOnline.value = true
      resumeList.value.unshift(created)
      applyResumeData(created)
    }
    savedLocally.value = false
    if (!isSilent) {
      showToast('已保存')
    }
  } catch (e) {
    localStorage.setItem('markresume_draft', JSON.stringify(currentResume))
    savedLocally.value = true
    if (!isSilent) {
      showToast('后端不可用，已保存到浏览器本地', 'info')
    }
  } finally {
    isDirty.value = false
    lastSavedAt.value = new Date()
    saving.value = false
  }
}

async function openTemplateModal() {
  showTemplateModal.value = true
  try {
    templates.value = await resumeApi.listTemplates()
  } catch (_) {}
}

function applyTemplate(tpl) {
  currentResume.theme = tpl.defaultTheme || 'classic-blue'
  currentResume.primaryColor = tpl.defaultColor || '#2563eb'
  currentResume.markdownContent = tpl.markdownContent
  showTemplateModal.value = false
  showToast(`已套用模板「${tpl.name}」`)
}

/* -------------------- Avatar -------------------- */
function triggerAvatarUpload() {
  if (avatarInputRef.value) {
    avatarInputRef.value.value = ''
    avatarInputRef.value.click()
  }
}

async function handleAvatarUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return

  try {
    // Prefer uploading to Spring Boot backend /api/upload/avatar
    const res = await resumeApi.uploadAvatar(file)
    currentResume.markdownContent = updateFrontmatterField(currentResume.markdownContent, 'avatar', res.url)
    showToast('头像已上传')
  } catch (err) {
    // Fallback to local Base64 DataURL so it still works even offline
    const reader = new FileReader()
    reader.onload = () => {
      currentResume.markdownContent = updateFrontmatterField(currentResume.markdownContent, 'avatar', reader.result)
      showToast('后端不可用，头像已在本地加载', 'info')
    }
    reader.readAsDataURL(file)
  }
}

function handleRemoveAvatar() {
  currentResume.markdownContent = updateFrontmatterField(currentResume.markdownContent, 'avatar', '')
  showToast('已移除头像', 'info')
}

function handlePreviewMouseDown(e) {
  const avatarWrap = e.target.closest('.resume-avatar-wrap')
  if (!avatarWrap) return

  e.preventDefault()
  const startOffsetX = Number(resumeMeta.value.avatarX) || 0
  const startOffsetY = Number(resumeMeta.value.avatarY) || 0
  const startClientX = e.clientX
  const startClientY = e.clientY
  const scale = zoom.value || 1

  let currentX = startOffsetX
  let currentY = startOffsetY
  let moved = false

  avatarWrap.classList.add('is-dragging')

  const onMouseMove = (moveEvent) => {
    // Screen-space deltas are divided by the preview zoom so the avatar follows the cursor exactly
    const dx = (moveEvent.clientX - startClientX) / scale
    const dy = (moveEvent.clientY - startClientY) / scale
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true
    currentX = Math.round(startOffsetX + dx)
    currentY = Math.round(startOffsetY + dy)
    avatarWrap.style.transform = `translate(${currentX}px, ${currentY}px)`
  }

  const onMouseUp = () => {
    avatarWrap.classList.remove('is-dragging')
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)

    if (moved) {
      let updated = updateFrontmatterField(currentResume.markdownContent, 'avatarX', String(currentX))
      updated = updateFrontmatterField(updated, 'avatarY', String(currentY))
      currentResume.markdownContent = updated
    }
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function handlePreviewDblClick(e) {
  const avatarWrap = e.target.closest('.resume-avatar-wrap')
  if (!avatarWrap) return
  let updated = updateFrontmatterField(currentResume.markdownContent, 'avatarX', '')
  updated = updateFrontmatterField(updated, 'avatarY', '')
  currentResume.markdownContent = updated
  showToast('头像位置已还原', 'info')
}

/**
 * Click-to-Source: clicking any block on the right A4 preview sheet jumps the left CodeMirror editor
 * to the corresponding Markdown line (`data-line`).
 */
function handlePreviewClick(e) {
  if (e.target.closest('.resume-avatar-wrap') || e.target.closest('a')) return
  const selection = window.getSelection?.()
  if (selection && selection.toString().trim().length > 0) return

  const targetEl = e.target.closest('[data-line]')
  if (!targetEl || !editorRef.value) return

  const line0Based = Number(targetEl.getAttribute('data-line'))
  if (Number.isNaN(line0Based)) return

  const line1Based = line0Based + 1

  // Pause Editor -> Preview scroll sync briefly so the preview sheet stays steady where the user clicked
  isJumpingToSource = true
  if (jumpSourceTimeout) clearTimeout(jumpSourceTimeout)
  jumpSourceTimeout = setTimeout(() => {
    isJumpingToSource = false
  }, 550)

  // Highlight clicked preview element briefly
  const prevFlashed = previewPaneRef.value?.querySelectorAll('.source-jump-highlight')
  prevFlashed?.forEach((el) => el.classList.remove('source-jump-highlight'))
  targetEl.classList.add('source-jump-highlight')
  setTimeout(() => {
    targetEl.classList.remove('source-jump-highlight')
  }, 1400)

  editorRef.value.scrollToLine(line1Based)
}

/* -------------------- Split pane resizing -------------------- */
function handleResizerMouseDown(e) {
  e.preventDefault()
  const ws = workspaceRef.value
  if (!ws) return

  isResizingPane.value = true
  tooltip.visible = false
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const onMouseMove = (moveEvent) => {
    const rect = ws.getBoundingClientRect()
    const rawPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100
    const clamped = Math.min(65, Math.max(20, rawPercent))
    leftPaneWidth.value = Number(clamped.toFixed(2))
  }

  const onMouseUp = () => {
    isResizingPane.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

/* -------------------- Editor helpers -------------------- */
function handleCursorChange({ line, col }) {
  cursorPos.line = line
  cursorPos.col = col
}

function wrapSelection(before, after = before, placeholder = '文本') {
  editorRef.value?.wrapSelection(before, after, placeholder)
}

function prefixSelectedLines(prefixFor) {
  editorRef.value?.prefixSelectedLines(prefixFor)
}

function insertHeading(level) {
  editorRef.value?.insertHeading(level)
}

function insertSnippet(type) {
  editorRef.value?.insertSnippet(type)
}

async function handleAiPolish() {
  const selected = (editorRef.value?.getSelectedText() || '').trim()

  polishing.value = true
  try {
    const res = await resumeApi.polishText(selected || '优化了订单查询接口性能，提高了并发能力', 'star')
    const polished = res.polished
    if (selected && editorRef.value) {
      editorRef.value.replaceSelection(polished)
    } else {
      currentResume.markdownContent += `\n\n${polished}\n`
    }
    showToast('AI 已按 STAR 法则完成润色')
  } catch (e) {
    showToast('AI 润色失败，请检查后端服务', 'error')
  } finally {
    polishing.value = false
  }
}

function handleEditorScroll({ scrollTop, scrollHeight, clientHeight }) {
  if (isJumpingToSource || !syncScroll.value || !previewPaneRef.value) return

  const scrollRatio = scrollTop / Math.max(1, scrollHeight - clientHeight)
  const previewEl = previewPaneRef.value
  previewEl.scrollTop = scrollRatio * (previewEl.scrollHeight - previewEl.clientHeight)
}

/* -------------------- Export -------------------- */
function handleExportMd() {
  showExportMenu.value = false
  const blob = new Blob([currentResume.markdownContent], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${currentResume.title || 'resume'}.md`
  a.click()
  URL.revokeObjectURL(url)
  showToast('已导出 Markdown 文件')
}

async function handleExportPdf() {
  showExportMenu.value = false
  if (exportingType.value) return
  exportingType.value = 'pdf'
  try {
    await paginateResume()
    await exportResumeToPdf({
      pagesContainer: previewPaneRef.value,
      title: currentResume.title || '个人简历'
    })
    showToast(`已导出「${currentResume.title || '个人简历'}.pdf」`)
  } catch (err) {
    showToast('直接导出失败，正在切换至系统矢量打印…', 'info')
    triggerVectorPrint(currentResume.title || '个人简历')
  } finally {
    exportingType.value = ''
  }
}

async function handleExportPng() {
  showExportMenu.value = false
  if (exportingType.value) return
  exportingType.value = 'png'
  try {
    await paginateResume()
    await exportResumeToPng({
      pagesContainer: previewPaneRef.value,
      title: currentResume.title || '个人简历'
    })
    showToast(`已导出高清图片「${currentResume.title || '个人简历'}.png」`)
  } catch (err) {
    showToast('导出图片失败，请重试', 'error')
  } finally {
    exportingType.value = ''
  }
}

async function handleVectorPrint() {
  showExportMenu.value = false
  await paginateResume()
  triggerVectorPrint(currentResume.title || '个人简历')
}

function handleDocumentClickOutside(e) {
  if (showExportMenu.value && exportDropdownRef.value && !exportDropdownRef.value.contains(e.target)) {
    showExportMenu.value = false
  }
}

/* -------------------- Global events -------------------- */
function onGlobalKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    handleSave()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    handleVectorPrint()
    return
  }
  if (e.key === 'Escape') {
    if (showExportMenu.value) showExportMenu.value = false
    if (showTemplateModal.value) showTemplateModal.value = false
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('resize', paginateResume)
  document.addEventListener('mousedown', handleDocumentClickOutside)
  document.addEventListener('mouseover', handleTooltipOver)
  document.addEventListener('mouseout', handleTooltipOut)

  if (previewPaneRef.value && 'ResizeObserver' in window) {
    previewResizeObserver = new ResizeObserver(() => {
      if (autoFit.value) fitToWidth()
    })
    previewResizeObserver.observe(previewPaneRef.value)
  }

  await loadInitialData()
  await paginateResume()
  fitToWidth()
})

onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('resize', paginateResume)
  document.removeEventListener('mousedown', handleDocumentClickOutside)
  document.removeEventListener('mouseover', handleTooltipOver)
  document.removeEventListener('mouseout', handleTooltipOut)
  previewResizeObserver?.disconnect()
})
</script>
