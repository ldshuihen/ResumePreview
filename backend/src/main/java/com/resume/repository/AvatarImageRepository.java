package com.resume.repository;

import com.resume.entity.AvatarImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AvatarImageRepository extends JpaRepository<AvatarImage, String> {
}

