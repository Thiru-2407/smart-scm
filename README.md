# Smart Software Release & Version Tracking System for Configuration Management

A comprehensive web-based configuration management and release governance platform built with the MERN stack (MongoDB, Express, React, Node.js), integrated with **Unity Version Control** (formerly Plastic SCM) for source-code change tracking.

---

## 1. Project Overview

In software engineering, Configuration Management (CM) and Release Management ensure that software deliverables are consistently tracked, verified, and delivered across environments. 

This project provides a centralized, functional system to govern:
- Software releases, builds, and version increments.
- Change requests (CRs) and bug resolutions mapped to releases.
- Automated release note generation and audit trails.
- Real-time visibility into project health, team velocity, and deployment states via an interactive dashboard.

---

## 2. Separation of Responsibilities

To maintain high engineering discipline and avoid conflating business release governance with raw repository operations, the system enforces a clean separation of concerns:

```
+-----------------------------------------------------------------------+
|                       WEB APPLICATION LAYER                           |
|       (React Frontend + Express/Node.js API + MongoDB Database)       |
+-----------------------------------------------------------------------+
|  - Project & Workspace Portfolio                                      |
|  - Team Members & Role-Based Access Control                           |
|  - Semantic Software Versions & Release Cycles                        |
|  - Release Notes Compilation & Publishing                             |
|  - Bug Tracking, Triage, & Resolutions                                |
|  - Change Request (CR) Workflows & Approval Gates                     |
|  - Configuration Auditing, Reports, & Executive Dashboard             |
+-----------------------------------------------------------------------+
                                  |
                                  | References & Traceability
                                  v
+-----------------------------------------------------------------------+
|                     SOURCE CODE MANAGEMENT LAYER                      |
|             (Unity Version Control / Plastic SCM CLI/Engine)          |
+-----------------------------------------------------------------------+
|  - Actual Source Code Check-ins / Commits                             |
|  - Branch Management (feature, release, main)                         |
|  - Changeset Merging & Conflict Resolution                            |
|  - Tree Version History & Diff Revisions                              |
|  - Safe Rollback & Workspace Revert Operations                        |
+-----------------------------------------------------------------------+
```

1. **Web Application Responsibilities**:
   - Manages metadata, release schedules, team permissions, change request approvals, bug lifecycles, and configuration audit reporting.
   - Links specific Unity Version Control changesets/branches/tags to formal release entities without mocking or replacing the SCM engine.

2. **Unity Version Control (Plastic SCM) Responsibilities**:
   - Governs actual source code files, repository revisions, commits (changesets), branching schemes, merging, and codebase rollbacks.

---

## 3. Technology Stack

- **Frontend**: React (SPA with modular components, interactive UI, and release dashboards)
- **Backend**: Node.js & Express.js (RESTful API architecture, validation, authentication)
- **Database**: MongoDB (Flexible document schema for projects, releases, change requests, and audit logs)
- **Source Control Management**: Unity Version Control / Plastic SCM (`cm` CLI integration & repository metadata tracking)

---

## 4. Planned System Architecture & Modules

### 4.1 Project & Team Management Module
- Multi-project configuration support.
- Team member onboarding, role assignment (Release Manager, Developer, QA, Configuration Auditor), and permission controls.

### 4.2 Software Version & Release Management Module
- Semantic Versioning (SemVer: `MAJOR.MINOR.PATCH`) tracking.
- Release lifecycle states: `Planning`, `In Progress`, `Code Freeze`, `Release Candidate (RC)`, `Released`, `Archived`.
- Association of releases with specific Unity Version Control branches and changesets.

### 4.3 Change Request (CR) & Bug Tracking Module
- Formal change proposals with impact analysis, risk assessment, and approval states.
- Defect logging, severity grading, reproduction steps, and resolution linkage.
- Bidirectional traceability: linking bug fixes and CRs directly to the target software release.

### 4.4 Release Notes & Documentation Generator
- Automated collation of merged CRs, resolved bugs, and version notes for each release milestone.
- Export formats (Markdown, PDF, HTML) for internal engineering and customer-facing distribution.

### 4.5 Configuration Reports & Metrics Dashboard
- Visual metrics: Release velocity, open vs. resolved defects, pending change requests, build stability.
- Comprehensive audit trails for regulatory and academic configuration management review.

---

## 5. Project Directory Structure

```
smart-scm/
├── frontend/             # React single-page application
├── backend/              # Node.js + Express REST API server
├── README.md             # Project documentation & architectural roadmap
└── .gitignore            # Git exclusion rules for node_modules, env files, and artifacts
```

---

## 6. Phase 1 Verification

Phase 1 establishes the root directory, separation boundary, and workspace layout:

1. **Directory Integrity**:
   - Confirm `smart-scm/frontend` and `smart-scm/backend` directories exist.
   - Confirm `.gitignore` correctly ignores environment configs (`.env`), build directories, and `node_modules`.
   - Confirm `README.md` documents the architectural scope and separation from Unity Version Control.

2. **Next Steps (Phase 2 onwards)**:
   - Setup and initialization of the backend server (`package.json`, Express, MongoDB connection setup).
   - Setup and initialization of the React frontend application.
