package com.safecity.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AssignDepartmentRequest {
    @NotBlank
    private String department;

    private String note;
}
