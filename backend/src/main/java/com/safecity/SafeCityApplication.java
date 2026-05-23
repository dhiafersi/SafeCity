package com.safecity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
public class SafeCityApplication {
    public static void main(String[] args) {
        SpringApplication.run(SafeCityApplication.class, args);
    }
}
