package com.safecity.domain;

public enum AuditActionType {
    CREATED,
    STATUS_CHANGED,
    ASSIGNED,
    FIX_SUBMITTED,
    FIX_APPROVED,
    FIX_REFUSED,
    REJECTED,
    COMMENT_ADDED,
    SLA_SET,
    RATED,
    DUPLICATE_LINKED
}
