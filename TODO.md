# 待完善功能清单 (TODO)

本文档用于记录 **MarkResume** 后续待实现、待完善的功能需求、已知细节问题与演进规划。

---

## 一、排版与样式（高优先级）

### 1. [ ] 支持 `H1 ~ H6` 标题字体大小独立调节
- **优先级**：高
- **现状问题**：
  - 右侧检查器「字体与文字」区域（`frontend/src/App.vue`）目前仅提供「正文字号」（`fontSize`，`12px ~ 17px`）滑块，无法单独调节 `H1 ~ H6` 各级标题的字体大小。
  - `frontend/src/styles/resume.css` 中 `.resume-body h1` ~ `.resume-body h6` 的 `font-size` 目前为固定 `em` 倍率（`h1: 1.5em`、`h2: 1.16em`、`h3: 1.05em`、`h4: 0.98em`、`h5: 0.92em`、`h6: 0.85em`）。
  - 后端实体 `backend/src/main/java/com/resume/entity/Resume.java` 当前仅持久化 `fontSize` 字段，尚无各级标题字号字段。
- **实现目标**：
  - **前端检查器**：在 `frontend/src/App.vue` 的「字体与文字」设置区新增 `H1 ~ H6` 字体大小调节控件（支持各级独立调节与一键恢复默认）。
  - **样式与分页同步**：在 `frontend/src/styles/resume.css` 中通过 CSS 变量控制 `.resume-body h1` ~ `h6` 的字号，确保 A4 预览画布、`.a4-measure-container` 自动分页测算、PNG 长图导出与 PDF 导出效果完全一致。
  - **数据持久化**：在 `backend/src/main/java/com/resume/entity/Resume.java` 及简历保存/读取逻辑中补充 `H1 ~ H6` 字号配置存储，实现刷新不丢失与离线备份兼容。

### 2. [ ] 修复正文字号小数步长保存精度丢失问题
- **优先级**：高
- **现状问题**：`frontend/src/App.vue` 中正文字号滑块步长为 `0.5`（如「宽松」预设为 `14.5px`），但 `backend/src/main/java/com/resume/entity/Resume.java` 中的 `fontSize` 字段类型为 `Integer`，保存到数据库后小数精度会丢失。
- **实现目标**：将后端 `Resume.fontSize` 字段类型调整为 `Double`（并确认 H2/未来数据库表结构兼容），前后端保持半像素调节精度一致。

### 3. [ ] 支持页头区域字号与间距调节
- **现状问题**：`frontend/src/styles/resume.css` 中 `.resume-name`（`26px`）、`.resume-role`（`15px`）、`.resume-contacts`（`12.5px`）及 `.resume-header` 底部内/外边距为固定值，无法在检查器中微调，也不随正文/标题字号联动。
- **实现目标**：将页头姓名、岗位、联系信息字号与下边距抽象为 CSS 变量并在排版设置面板中提供调节或比例联动。

### 4. [ ] 补全更多 Markdown 元素样式与悬浮定位反馈
- **现状问题**：
  - `frontend/src/utils/markdownParser.js` 支持引用块等标准语法，但 `frontend/src/styles/resume.css` 中 `.resume-body` 缺少 `blockquote`、表格 `table`、分割线 `hr` 与正文内超链接 `a` 的专属简历样式。
  - 点击定位源码的悬浮反馈选择器目前仅覆盖 `h1 ~ h3`，未包含 `h4 ~ h6`。
- **实现目标**：补全常用 Markdown 元素的打印/简历友好样式，并将 `h4 ~ h6` 纳入 `:hover` 交互高亮。

### 5. [ ] 页脚页码开关持久化与自定义页脚格式
- **现状问题**：`frontend/src/App.vue` 中的 `showPageFooter` 仅保存在组件内存，刷新后恢复默认；页脚内容写死为中文「第 X 页 / 共 Y 页」。
- **实现目标**：持久化页码开关状态，支持中英文格式切换或自定义页脚文字。

---

## 二、导出与分页引擎

### 6. [ ] 服务端真矢量 PDF 导出（可选中文字 / ATS 友好）
- **优先级**：高
- **现状问题**：`frontend/src/utils/pdfExporter.js` 当前的「导出 PDF 文档」采用 `html-to-image` (`toJpeg`) 截图后嵌入 A4 PDF（外加超链接热区），导致导出 PDF 内文字不可选中复制，也不利于招聘系统（ATS）解析。
- **实现目标**：在保留前端离线兜底与浏览器原生打印的同时，新增后端无头浏览器（如 Playwright）矢量 PDF 导出接口，生成文字可选中、体积更小且 ATS 友好的真矢量 PDF。

### 7. [ ] 完善智能分页防孤行、复杂块拆分与超页预警
- **现状问题**：`frontend/src/App.vue` 的 `paginateResume` 目前仅对 `H1 ~ H4` 做防孤行判断（未包含 `H5 ~ H6`），且跨页拆分仅支持 `ul`/`ol` 列表项；超长段落 `p`、多行 `::: cols-*` 网格或表格可能整块被推到下一页或发生单页溢出。
- **实现目标**：将 `H5 ~ H6` 纳入防孤行检测，增强多行网格与表格的跨页拆分能力，并增加「一页简历溢出提示」预警徽标。

### 8. [ ] 头像上传校验、前端裁剪与外链跨域导出兜底
- **现状问题**：
  - `backend/src/main/java/com/resume/controller/ResumeController.java` 的 `uploadAvatar` 接口尚未校验图片格式与尺寸，前端缺少裁剪框。
  - `frontend/src/utils/pdfExporter.js` 中的 `imageUrlToDataUrl` 在第三方头像接口跨域拉取失败时静默返回原 URL，可能造成导出图片/PDF 中头像缺失而无提示。
- **实现目标**：补充图片类型/大小校验、前端头像比例裁剪交互，并在导出遇到外链图片跨域失败时给予明确提示或提供一键转存本地后端。

---

## 三、编辑器与解析能力

### 9. [ ] 集成编辑器搜索替换（`Ctrl + F`）与章节大纲导航
- **现状问题**：`frontend/package.json` 尚未引入 `@codemirror/search`，`frontend/src/components/MarkdownEditor.vue` 暂不支持文档内查找/替换；长简历缺少章节大纲目录与模块顺序快速调整能力。
- **实现目标**：集成 CodeMirror 搜索替换扩展，并增加基于标题的简历大纲导航（支持点击跳转与章节拖拽重排）。

### 10. [ ] 完善自定义 Markdown 解析边界处理
- **现状问题**：`frontend/src/utils/markdownParser.js` 中的 `normalizeChineseMarkdown` 会对非自定义块行直接执行正则替换，遇到多行围栏代码块（```` ``` ````）或反斜杠转义符号时存在误替换风险。
- **实现目标**：在预处理阶段识别并跳过代码块区域及转义语法，提升解析稳定性。

---

## 四、AI 辅助与模板生态

### 11. [ ] 接入真实大模型流式润色、JD 匹配度评测与润色预览对比
- **现状问题**：
  - `backend/src/main/java/com/resume/controller/ResumeController.java` 中 `/api/ai/polish` 目前为固定规则与字符串拼接 Mock（对应 Roadmap 规划）。
  - 后端已预留 `quantify`（量化增强）模式，但前端 `handleAiPolish` 仅固定传入 `star`，且润色结果直接覆盖选区，缺乏对比确认。
- **实现目标**：接入 Spring AI / DeepSeek / 通义千问等真实大模型实现流式输出与岗位 JD 匹配度分析；前端支持切换润色模式并提供 Diff 对比弹窗让用户确认采纳或撤销。

### 12. [ ] 支持保存个人自定义模板与模板分类筛选
- **现状问题**：当前模板库仅由 `backend/src/main/java/com/resume/config/DataInitializer.java` 初始化并在重启时同步内置模板，用户无法将当前简历保存为个人模板，模板弹窗也缺少分类筛选与搜索。
- **实现目标**：新增模板创建/删除接口，区分系统内置模板与用户自定义模板，并支持按岗位分类筛选与预览。

---

## 五、数据安全、存储与工程化

### 13. [ ] 本地离线草稿按简历 ID 隔离缓存
- **现状问题**：`frontend/src/App.vue` 当前所有简历共用同一个 `localStorage` key（`markresume_draft`），在离线状态或切换多份简历时可能相互覆盖草稿。
- **实现目标**：按简历 ID 分别存储本地草稿并在恢复时提示选择。

### 14. [ ] 删除简历时清理孤儿头像资源
- **现状问题**：`ResumeController.deleteResume` 仅删除简历记录，未清理不再被任何简历引用的 `AvatarImage` 数据库记录及 `uploads/avatars/` 磁盘文件。
- **实现目标**：删除简历或定期任务中检查引用关系，安全清理未被引用的头像二进制与本地文件。

### 15. [ ] 简历历史版本快照对比与一键回滚
- **规划来源**：README Roadmap
- **实现目标**：在每次手动保存或关键节点记录简历版本快照，支持查看历史版本差异并一键回滚。

### 16. [ ] 数据库平滑切换至 MySQL 8 / PostgreSQL + Flyway 版本迁移
- **规划来源**：README Roadmap
- **实现目标**：完善生产环境多数据源配置与 Flyway 数据库表结构演进脚本。

### 17. [ ] 多用户鉴权隔离、只读在线分享链接与窄屏适配
- **实现目标**：增加基础账号体系、支持生成带有效期/访问密码的只读简历分享链接，并优化平板与移动端下的编辑/预览分栏切换体验。
