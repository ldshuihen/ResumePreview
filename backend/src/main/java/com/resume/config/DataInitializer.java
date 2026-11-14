package com.resume.config;

import com.resume.entity.Resume;
import com.resume.entity.ResumeTemplate;
import com.resume.repository.ResumeRepository;
import com.resume.repository.ResumeTemplateRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private final ResumeRepository resumeRepository;
    private final ResumeTemplateRepository templateRepository;

    public DataInitializer(ResumeRepository resumeRepository, ResumeTemplateRepository templateRepository) {
        this.resumeRepository = resumeRepository;
        this.templateRepository = templateRepository;
    }

    @Override
    public void run(String... args) {
        if (templateRepository.count() == 0) {
            ResumeTemplate t1 = new ResumeTemplate();
            t1.setName("Java 后端开发工程师（标准单栏）");
            t1.setCategory("技术研发");
            t1.setDescription("经典大厂投递模板，突出高并发项目指标、技术栈标签与 STAR 法则描述");
            t1.setDefaultTheme("classic-blue");
            t1.setDefaultColor("#2563eb");
            t1.setMarkdownContent(JAVA_BACKEND_TEMPLATE);
            templateRepository.save(t1);

            ResumeTemplate t2 = new ResumeTemplate();
            t2.setName("全栈 / 前端架构师（现代极简）");
            t2.setCategory("全栈前端");
            t2.setDescription("适合 Vue/React/Node 全栈开发者，强调开源贡献、工程化与性能优化指标");
            t2.setDefaultTheme("modern-slate");
            t2.setDefaultColor("#0f766e");
            t2.setMarkdownContent(FULLSTACK_TEMPLATE);
            templateRepository.save(t2);

            ResumeTemplate t3 = new ResumeTemplate();
            t3.setName("校招 / 实习生精简模板（学术优雅）");
            t3.setCategory("校招实习");
            t3.setDescription("突出教育背景、核心课程、竞赛奖项与实验室科研项目经历");
            t3.setDefaultTheme("elegant-serif");
            t3.setDefaultColor("#7c3aed");
            t3.setMarkdownContent(CAMPUS_TEMPLATE);
            templateRepository.save(t3);
        } else {
            // Keep all built-in templates synced with the latest header fields
            templateRepository.findAll().forEach(tpl -> {
                if (tpl.getName() != null) {
                    if (tpl.getName().startsWith("Java 后端开发工程师")) {
                        tpl.setMarkdownContent(JAVA_BACKEND_TEMPLATE);
                        templateRepository.save(tpl);
                    } else if (tpl.getName().startsWith("全栈")) {
                        tpl.setMarkdownContent(FULLSTACK_TEMPLATE);
                        templateRepository.save(tpl);
                    } else if (tpl.getName().startsWith("校招")) {
                        tpl.setMarkdownContent(CAMPUS_TEMPLATE);
                        templateRepository.save(tpl);
                    }
                }
            });
        }

        if (resumeRepository.count() == 0) {
            Resume r1 = new Resume();
            r1.setTitle("林远 - 高级 Java 后端开发简历");
            r1.setTheme("classic-blue");
            r1.setPrimaryColor("#2563eb");
            r1.setFontSize(14);
            r1.setLineHeight(1.6);
            r1.setPageMargin(28);
            r1.setMarkdownContent(JAVA_BACKEND_TEMPLATE);
            resumeRepository.save(r1);
        } else {
            // Also upgrade the initial sample resume if it still has the old header without gender/birthday/politics
            resumeRepository.findAll().forEach(r -> {
                String md = r.getMarkdownContent();
                if (md != null && md.contains("name: 林远") && !md.contains("birthday:") && !md.contains("出生年月:")) {
                    md = md.replace(
                            "role: 高级 Java 后端开发工程师 · 4年经验\n",
                            "role: 高级 Java 后端开发工程师 · 4年经验\nheaderCols: cols-3\ngender: 男\nbirthday: 1999.08\npolitics: 中共预备党员\n"
                    );
                    r.setMarkdownContent(md);
                    resumeRepository.save(r);
                }
            });
        }
    }

    public static final String JAVA_BACKEND_TEMPLATE = """
---
name: 林远 (Lin Yuan)
role: 高级 Java 后端开发工程师 · 4年经验
headerCols: cols-3
gender: 男
birthday: 1999.08
politics: 中共预备党员
phone: 138-0013-8000
email: linyuan.dev@example.com
location: 杭州 / 上海
github: github.com/linyuan-dev
blog: tech.linyuan.dev
avatar: https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=dbeafe
---

## 专业技能

- **Java 核心**：精通 Java 17/21 并发编程（JUC、AQS、线程池调优），深入理解 JVM 内存模型与 G1/ZGC 垃圾回收调优。
- **框架生态**：熟练掌握 `Spring Boot 3`、`Spring Cloud Alibaba`、`MyBatis-Plus`、`Netty`，阅读过核心模块源码。
- **数据存储**：精通 `MySQL`（索引优化、MVCC、分库分表 ShardingSphere）与 `Redis`（分布式锁、多级缓存架构、热 Key 治理）。
- **中间件与云原生**：熟悉 `Kafka`、`RocketMQ` 消息可靠性投递；熟练使用 `Docker`、`Kubernetes`、`Prometheus + Grafana` 可观测体系。

## 工作经历

::: row
**字节跳动 (ByteDance)** | 电商交易研发部 · 高级后端开发工程师 | 2023.04 - 至今
:::
- **高并发履约核心链路重构**：主导订单履约与库存预占服务拆分，引入 `Caffeine + Redis` 二级缓存与异步扣减方案，大促峰值 QPS 突破 **65,000+**，接口 P99 延迟从 `140ms` 降至 `28ms`。
- **分布式事务一致性治理**：基于 `RocketMQ` 事务消息 + 本地消息表兜底对账机制，将跨系统数据不一致率降至 **0.0001%** 以下，日均处理订单超 **1,200 万笔**。
- **线上稳定性保障**：搭建全链路压测与自适应限流降级策略（Sentinel），连续 2 年双十一核心服务可用性达 **99.995%**。

::: row
**网易 (NetEase)** | 云音乐基础架构组 · Java 开发工程师 | 2021.07 - 2023.03
:::
- **统一配置与灰度发布平台**：设计并实现基于长连接推送的毫秒级动态配置中心，接入内部 **300+** 微服务集群。
- **慢 SQL 与存储成本优化**：推进冷热数据分层存储方案（TiDB + MySQL 归档），单集群存储成本节省 **42%**，消灭全部核心链路慢查询。

## 核心项目经验

::: row
**CloudResume 分布式简历渲染与 AI 评测引擎** | 个人开源负责人 (`Star 1.8k`) | 2024.02 - 至今
:::
- **技术栈**：`Spring Boot 3` `Vue 3` `Playwright` `Spring AI` `Redis`
- **架构设计**：采用左侧 Markdown 增量 AST 解析与右侧 A4 纸张 CSS 变量驱动渲染，支持双端毫秒级行号同步滚动与矢量 PDF 导出。
- **AI 赋能**：集成大模型流式输出接口，实现针对岗位 JD 的简历匹配度打分与 **STAR 法则一键润色**。

## 教育背景

::: row
**浙江大学** | 软件工程 · 工学硕士（保研） | 2018.09 - 2021.06
:::
- **荣誉奖项**：国家奖学金、ACM-ICPC 亚洲区域赛银奖、优秀毕业研究生

::: row
**武汉大学** | 计算机科学与技术 · 工学学士 | 2014.09 - 2018.06
:::
- **GPA**：3.88 / 4.0（专业前 5%） | CET-6 (615分)
""";

    public static final String FULLSTACK_TEMPLATE = """
---
name: 苏哲 (Su Zhe)
role: 全栈开发工程师 (Vue 3 / Spring Boot)
headerCols: cols-3
gender: 男
birthday: 1998.11
politics: 中共党员
phone: 186-1234-5678
email: suzhe.fullstack@example.com
location: 广东深圳
github: github.com/suzhe-fe
---

## 核心技术栈

- **前端工程化**：精通 `Vue 3`、`TypeScript`、`Vite`、`Pinia`、`TailwindCSS`，熟悉 AST 编译与编辑器（Monaco / CodeMirror）深度定制。
- **后端与架构**：熟练使用 `Spring Boot 3`、`Node.js (NestJS)`、`PostgreSQL`、`Redis`，具备从 0 到 1 独立交付 SaaS 产品能力。

## 工作与项目经历

::: row
**腾讯 (Tencent)** | 企业微信文档团队 · 高级前端/全栈工程师 | 2022.06 - 至今
:::
- **协同文档 Markdown 引擎优化**：主导虚拟列表渲染与增量协同算法改造，万字长文档首屏渲染耗时缩短 **62%**，帧率稳定在 `60 FPS`。
- **插件化主题系统**：设计基于 CSS Variables 与 Schema 驱动的动态排版引擎，支持 20+ 套行业模板热切换。

## 教育背景

::: row
**华南理工大学** | 计算机科学与技术 · 本科 | 2018.09 - 2022.06
:::
""";

    public static final String CAMPUS_TEMPLATE = """
---
name: 陈思语 (Chen Siyu)
role: 2027届硕士 · 计算机视觉 / 后端研发实习生
headerCols: cols-3
gender: 女
birthday: 2002.05
politics: 中共预备党员
phone: 159-8888-9999
email: chen.siyu@edu.cn
location: 北京
github: github.com/chensiyu-ai
---

## 教育背景

::: row
**北京航空航天大学** | 计算机科学与技术 · 硕士研究生 | 2024.09 - 2027.06
:::
- **研究方向**：分布式系统与大模型推理加速 | **综合排名**：Top 3%

::: row
**北京邮电大学** | 软件工程 · 本科 | 2020.09 - 2024.06
:::
- **主修课程**：数据结构与算法 (98)、操作系统 (95)、计算机网络 (96)、数据库系统原理 (94)

## 科研与实习经历

::: row
**阿里云** | 云原生数据库部 · 研发实习生 | 2025.06 - 2025.12
:::
- **查询优化器规则扩展**：参与 SQL 解析与执行计划代价估算调优，在 TPC-H 基准测试集上提升复杂聚合查询性能 **18%**。

## 竞赛与荣誉

- **2024.11** 蓝桥杯全国软件和信息技术专业人才大赛 Java 组 **全国一等奖**
- **2023.10** 国家奖学金、校级三好学生标兵
""";
}

