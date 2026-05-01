# 🏙️ SafeCity-Connect

**SafeCity-Connect** is a state-of-the-art citizen-reporting platform. It empowers residents to report urban issues (potholes, leaks, etc.) via a mobile-responsive web app, utilizes AI (simulated YOLO) for automated categorization, and provides administrators with a predictive heatmap dashboard for urban planning.

---

## 🚀 Quick Start (Docker)

Ensure you have **Docker** and **Docker Compose** installed.

1. **Clone and Enter**:
   ```bash
   cd safecity-connect
   ```

2. **Launch Infrastructure**:
   ```bash
   docker-compose up -d
   ```
   *This starts: PostgreSQL (PostGIS), Keycloak, Spring Boot (Backend), and Angular (Frontend).*

3. **Access the Apps**:
   - **Frontend**: [http://localhost:4200](http://localhost:4200)
   - **Backend API**: [http://localhost:8081/actuator/health](http://localhost:8081/actuator/health)
   - **Keycloak Admin**: [http://localhost:8080](http://localhost:8080) (Admin: `admin` / `admin`)

---

## 🔐 Auth & Test Users

The project comes with a pre-configured Keycloak realm (`safecity`).

| User | Password | Role | Access |
| :--- | :--- | :--- | :--- |
| **`citizen1`** | `citizen123` | **CITIZEN** | Report incidents, See own history, Earn points |
| **`admin1`** | `admin123` | **ADMIN** | Manage all incidents, View Heatmap & Analytics |

---

## 🛠️ Tech Stack

### Backend (Spring Boot 3.2 + Java 21)
- **Security**: Spring Security OAuth2 Resource Server (JWT validation).
- **Data**: Spring Data JPA + Hibernate Spatial (PostGIS support).
- **AI**: Integratable `AiAnalysisService` (currently simulates YOLO responses).
- **Gamification**: Logic to award "Impact Points" upon incident validation.

### Frontend (Angular 18)
- **Auth**: `angular-oauth2-oidc` with PKCE Flow.
- **Maps**: Leaflet.js with custom dark-matter styling.
- **Heatmap**: `leaflet.heat` for density visualization.
- **UI**: Vanilla SCSS Design System with modern dark-mode aesthetics.

### Infrastructure
- **PostGIS**: For geospatial data storage.
- **Nginx**: Production-grade frontend delivery and API proxying.
- **Multi-stage Docker**: Optimised builds for both services.

---

## 📂 Project Structure

```text
├── backend/                # Spring Boot Maven Project
│   ├── src/main/java       # Source code (Controllers, Services, Domain)
│   ├── src/main/resources  # application.yml
│   └── Dockerfile          # Multi-stage JRE build
├── frontend/               # Angular Workspace
│   ├── src/app/core        # Security, Guards, Interceptors, Services
│   ├── src/app/features    # Citizen/Admin/Auth modules
│   ├── src/styles.scss     # Global Design System
│   └── Dockerfile          # Nginx-based build
├── keycloak/realms/        # Pre-configured Keycloak Realm JSON
├── init-scripts/           # Database initialization (schemas/extensions)
└── docker-compose.yml      # Orchestration
```

---

## 🔮 Next Steps
- **AI Integration**: Replace the simulation in `AiAnalysisService.java` with a real REST call to a TorchServe/FastAPI YOLO model.
- **Email Notifications**: Add `spring-boot-starter-mail` to notify citizens when their incident status changes.
- **Native Mobile**: Use Capacitor to wrap this Angular app for iOS/Android.
