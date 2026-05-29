package com.safecity.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class UserAccountResponse {
    private String id;
    private String username;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private Boolean enabled;
    private String department;
    private List<String> roles;
}
