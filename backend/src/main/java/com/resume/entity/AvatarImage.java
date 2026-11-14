package com.resume.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "avatar_images")
public class AvatarImage {

    @Id
    @Column(length = 100)
    private String filename;

    @Column(length = 60)
    private String contentType;

    @Lob
    @Column(nullable = false, columnDefinition = "BLOB")
    private byte[] data;

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public byte[] getData() {
        return data;
    }

    public void setData(byte[] data) {
        this.data = data;
    }
}

