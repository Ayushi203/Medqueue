# MedQueue

A hospital appointment and live-queue management system. Patients book appointments and track their place in the queue, doctors manage their daily queue and write prescriptions, and admins manage doctors and view clinic statistics.

## Features

**Patients**
- Register and log in
- Browse doctors and book an available slot
- Live queue tracker: token number, current token and patients ahead
- Cancel or reschedule appointments
- View and print prescriptions
- Rate doctors after a visit

**Doctors**
- Daily queue with check-in and status updates
- Register walk-in patients
- Write prescriptions, with reusable prescription templates
- Appointment and prescription history, plus ratings received

**Admins**
- Add, edit, activate/deactivate and remove doctors
- Clinic statistics dashboard

## Tech stack

| Part | Technology |
| --- | --- |
| Backend | Java 21, Spring Boot 4, Spring Security, Spring Data JPA, JWT (jjwt) |
| Database | MySQL |
| Frontend | React 19, Vite, Bootstrap 5 |

## Project structure

```
medqueue/            Spring Boot REST API (port 8080)
medqueue-frontend/   React + Vite client
MedQueue_Project_Report.docx
```

## Getting started

### Prerequisites

- JDK 21 or newer
- MySQL 8
- Node.js 20 or newer

### 1. Database

Create an empty database; tables are created automatically on first start.

```sql
CREATE DATABASE medqueue;
```

### 2. Backend

Copy the example secrets file and fill in your values:

```bash
cd medqueue
cp src/main/resources/local-secrets.properties.example src/main/resources/local-secrets.properties
```

| Setting | Environment variable | Purpose |
| --- | --- | --- |
| `local.db-username` | `MEDQUEUE_DB_USERNAME` | MySQL user (default `root`) |
| `local.db-password` | `MEDQUEUE_DB_PASSWORD` | MySQL password |
| `local.jwt-secret` | `MEDQUEUE_JWT_SECRET` | JWT signing key, at least 32 characters |
| `local.admin-email` | `MEDQUEUE_ADMIN_EMAIL` | Admin account created on first start |
| `local.admin-password` | `MEDQUEUE_ADMIN_PASSWORD` | Password for that admin account |

Environment variables override `local-secrets.properties`, which is ignored by git. `MEDQUEUE_TIMEZONE` sets the clinic timezone (default `Asia/Kolkata`).

Run the API:

```bash
./mvnw spring-boot:run
```

On Windows use `mvnw.cmd spring-boot:run`. The API starts at `http://localhost:8080`.

### 3. Frontend

```bash
cd medqueue-frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). To use a backend at another address, set `VITE_API_URL` in `medqueue-frontend/.env.local`.

## API overview

All endpoints are under `/api`; everything except register and login needs a `Bearer` JWT.

| Area | Base path | Examples |
| --- | --- | --- |
| Auth | `/api/auth` | `POST /register`, `POST /login` |
| Doctors | `/api/doctors` | list, create, update, activate/deactivate |
| Appointments | `/api/appointments` | `GET /slots`, `POST /book`, `POST /walk-in`, `PUT /{id}/check-in`, `GET /{id}/queue-status` |
| Prescriptions | `/api/prescriptions` | create/update per appointment, patient and doctor history |
| Templates | `/api/prescription-templates` | list, create, delete |
| Ratings | `/api/ratings` | rate an appointment, doctor rating summaries |
| Admin | `/api/admin` | `GET /statistics` |

## Running tests

```bash
cd medqueue
./mvnw test
```
