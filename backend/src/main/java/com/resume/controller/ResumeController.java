package com.resume.controller;

import com.resume.entity.AvatarImage;
import com.resume.entity.Resume;
import com.resume.entity.ResumeTemplate;
import com.resume.repository.AvatarImageRepository;
import com.resume.repository.ResumeRepository;
import com.resume.repository.ResumeTemplateRepository;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ResumeController {

    private final ResumeRepository resumeRepository;
    private final ResumeTemplateRepository templateRepository;
    private final AvatarImageRepository avatarImageRepository;

    public ResumeController(
            ResumeRepository resumeRepository,
            ResumeTemplateRepository templateRepository,
            AvatarImageRepository avatarImageRepository
    ) {
        this.resumeRepository = resumeRepository;
        this.templateRepository = templateRepository;
        this.avatarImageRepository = avatarImageRepository;
    }

    @GetMapping("/resumes")
    public List<Resume> listResumes() {
        return resumeRepository.findAllByOrderByUpdatedAtDesc();
    }

    @GetMapping("/resumes/{id}")
    public ResponseEntity<Resume> getResume(@PathVariable Long id) {
        return resumeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/resumes")
    public Resume createResume(@RequestBody Resume resume) {
        resume.setId(null);
        if (resume.getTitle() == null || resume.getTitle().isBlank()) {
            resume.setTitle("未命名简历");
        }
        return resumeRepository.save(resume);
    }

    @PutMapping("/resumes/{id}")
    public ResponseEntity<Resume> updateResume(@PathVariable Long id, @RequestBody Resume payload) {
        return resumeRepository.findById(id).map(existing -> {
            if (payload.getTitle() != null) existing.setTitle(payload.getTitle());
            if (payload.getMarkdownContent() != null) existing.setMarkdownContent(payload.getMarkdownContent());
            if (payload.getTheme() != null) existing.setTheme(payload.getTheme());
            if (payload.getPrimaryColor() != null) existing.setPrimaryColor(payload.getPrimaryColor());
            if (payload.getFontSize() != null) existing.setFontSize(payload.getFontSize());
            if (payload.getLineHeight() != null) existing.setLineHeight(payload.getLineHeight());
            if (payload.getPageMargin() != null) existing.setPageMargin(payload.getPageMargin());
            if (payload.getMarginTop() != null) existing.setMarginTop(payload.getMarginTop());
            if (payload.getMarginBottom() != null) existing.setMarginBottom(payload.getMarginBottom());
            if (payload.getFontFamily() != null) existing.setFontFamily(payload.getFontFamily());
            if (payload.getSectionGap() != null) existing.setSectionGap(payload.getSectionGap());
            if (payload.getItemGap() != null) existing.setItemGap(payload.getItemGap());
            return ResponseEntity.ok(resumeRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/resumes/{id}")
    public ResponseEntity<Void> deleteResume(@PathVariable Long id) {
        if (!resumeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        resumeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/templates")
    public List<ResumeTemplate> listTemplates() {
        return templateRepository.findAll();
    }

    @PostMapping("/upload/avatar")
    public ResponseEntity<Map<String, String>> uploadAvatar(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "上传文件不能为空"));
        }
        Path uploadDir = Paths.get("uploads", "avatars").toAbsolutePath().normalize();
        Files.createDirectories(uploadDir);

        String originalName = file.getOriginalFilename();
        String ext = ".png";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf("."));
        }
        String filename = UUID.randomUUID().toString().replace("-", "") + ext;
        byte[] bytes = file.getBytes();

        // 1. Save binary image into database (BLOB) so it never gets lost
        AvatarImage img = new AvatarImage();
        img.setFilename(filename);
        img.setContentType(file.getContentType() != null ? file.getContentType() : "image/png");
        img.setData(bytes);
        avatarImageRepository.save(img);

        // 2. Also save to local disk uploads/avatars/
        Path targetPath = uploadDir.resolve(filename);
        Files.write(targetPath, bytes);

        Map<String, String> res = new HashMap<>();
        res.put("url", "/api/upload/avatar/" + filename);
        res.put("filename", filename);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/upload/avatar/{filename:.+}")
    public ResponseEntity<byte[]> getAvatar(@PathVariable String filename) throws IOException {
        var dbImgOpt = avatarImageRepository.findById(filename);
        if (dbImgOpt.isPresent()) {
            AvatarImage img = dbImgOpt.get();
            MediaType mediaType = MediaType.IMAGE_PNG;
            try {
                if (img.getContentType() != null) {
                    mediaType = MediaType.parseMediaType(img.getContentType());
                }
            } catch (Exception ignored) {
            }
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .body(img.getData());
        }

        // Fallback to disk if uploaded before DB table was added
        Path diskPath = Paths.get("uploads", "avatars").toAbsolutePath().normalize().resolve(filename);
        if (Files.exists(diskPath)) {
            String probeType = Files.probeContentType(diskPath);
            MediaType mediaType = probeType != null ? MediaType.parseMediaType(probeType) : MediaType.IMAGE_PNG;
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .body(Files.readAllBytes(diskPath));
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/ai/polish")
    public Map<String, String> polishSection(@RequestBody Map<String, String> request) {
        String text = request.getOrDefault("text", "").trim();
        String mode = request.getOrDefault("mode", "star");
        String result;

        if (text.isEmpty()) {
            result = "- **主导核心架构升级**：重构高并发链路，引入多级缓存机制，使接口 P99 响应耗时降低 **45%**，系统吞吐量提升 **2.3 倍**。";
        } else if ("quantify".equals(mode)) {
            result = text
                    .replaceAll("提高了|提升了", "大幅提升 **40%+** 的")
                    .replaceAll("优化了", "深度重构并优化了")
                    + "\n- **量化成果补充**：核心接口 QPS 从 `1,200` 提升至 `4,500`，线上故障率下降 **90%**。";
        } else {
            // STAR 法则润色示例增强
            result = "- **[背景与任务]** 针对原模块高并发场景下的性能瓶颈，主导核心服务架构升级与链路治理；\n"
                    + "- **[核心行动]** " + text.replaceFirst("^[-*]\\s*", "") + "，结合异步解耦与多级缓存策略落地高可用方案；\n"
                    + "- **[量化结果]** 接口平均响应时间由 `180ms` 降至 `42ms`（降低 **76%**），支撑日均千万级请求零故障运行。";
        }

        Map<String, String> res = new HashMap<>();
        res.put("polished", result);
        return res;
    }
}

