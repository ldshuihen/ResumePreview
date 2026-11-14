package com.resume.repository;

import com.resume.entity.ResumeTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ResumeTemplateRepository extends JpaRepository<ResumeTemplate, Long> {
}

