package com.safecity.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Web configuration to serve uploaded photos publicly.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        System.out.println("WebConfig: addResourceHandlers called");
        
        // Determine the uploads directory (works both in Docker and locally)
        Path uploadsPath = Paths.get(System.getProperty("user.dir"), "uploads", "incidents");
        System.out.println("WebConfig: uploadsPath = " + uploadsPath);
        
        // Ensure directory exists at startup if possible
        try {
            Files.createDirectories(uploadsPath);
            System.out.println("WebConfig: Directory created/exists: " + uploadsPath);

            // Serve files from uploads/incidents/ at /uploads/incidents/
            String fileUri = uploadsPath.toUri().toString();
            System.out.println("WebConfig: Registering resource handler for /uploads/incidents/** -> " + fileUri);
            registry.addResourceHandler("/uploads/incidents/**")
                    .addResourceLocations(fileUri)
                    .setCachePeriod(3600);
            System.out.println("WebConfig: Resource handler registered successfully");
        } catch (Exception e) {
            System.err.println("WebConfig: WARN: Could not create uploads directory or register resource handler: " + uploadsPath);
            e.printStackTrace();
        }
    }
}