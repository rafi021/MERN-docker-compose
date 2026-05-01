# Dockerizing a MERN Stack Application for Production

A complete guide to containerizing a full-stack MERN (MongoDB, Express, React, Node.js) application using Docker and Docker Compose. This guide walks through every decision made in the Dockerfiles and the Compose configuration, explains why each choice was made, and shows you how to run the entire stack with a single command.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Why Bun Instead of npm](#why-bun-instead-of-npm)
4. [Project Structure](#project-structure)
5. [Backend Dockerfile Explained](#backend-dockerfile-explained)
6. [Frontend Dockerfile Explained](#frontend-dockerfile-explained)
7. [Nginx Configuration Explained](#nginx-configuration-explained)
8. [Docker Compose Explained](#docker-compose-explained)
9. [Why This Setup Is Production Ready](#why-this-setup-is-production-ready)
10. [Prerequisites](#prerequisites)
11. [Running the Application](#running-the-application)
12. [Verifying Everything Works](#verifying-everything-works)
13. [Useful Commands](#useful-commands)

---

## Project Overview

This application is a simple user record manager. It allows users to create, read, update, and delete (CRUD) user records. The frontend is a React single-page application. The backend is a REST API built with Express. The data is stored in MongoDB.

The goal of this guide is not just to make it run in Docker, but to make it run the same way in production as it does on your local machine, with proper startup ordering, health checks, persistent storage, and a secure, minimal final image size.

---

## Tech Stack

- **MongoDB** — document database, run as an official Docker container
- **Express 5** — backend web framework for Node.js
- **React 19** — frontend UI library
- **Node.js** (via Bun runtime) — JavaScript runtime for the backend
- **Vite 8** — frontend build tool and dev server
- **Tailwind CSS 4** — utility-first CSS framework
- **Bun 1** — fast JavaScript runtime and package manager
- **Nginx (stable-alpine)** — production web server for the React build
- **Docker + Docker Compose** — container orchestration

---

## Why Bun Instead of npm

When this project originally used `npm ci` to install dependencies inside Docker, every build took several minutes. There were two reasons for this.

The first reason was that `npm ci` downloads packages from the internet on every single build unless a cache is explicitly configured. In a Docker environment without a persistent cache mount, this means a full download on every image build.

The second reason was that the project had Cypress listed as a devDependency. Cypress downloads a roughly 300 MB binary during installation even if you never run it. In a Docker build environment, this download happened every time.

Bun solves both problems. It is significantly faster at resolving and installing packages than npm. In measured builds on this project:

- `npm ci` with Cypress: approximately 7 minutes
- `bun install --frozen-lockfile` with Bun cache mount: approximately 22 seconds on first run, under 2 seconds on subsequent cached builds

Bun is also used as the runtime for the backend server instead of Node.js. Bun is a drop-in replacement for `node` that handles ESM modules natively and starts up faster. The official `oven/bun:1-alpine` image is smaller and more purpose-built than the equivalent Node.js Alpine image.

**The lockfile difference:** npm uses `package-lock.json`, pnpm uses `pnpm-lock.yaml`, and Bun uses `bun.lock`. This project uses `bun.lock`. If you need to regenerate it after changing `package.json`, see the [Useful Commands](#useful-commands) section.

---

## Project Structure

```
.
├── docker-compose.yaml
└── mern/
    ├── backend/
    │   ├── Dockerfile
    │   ├── .dockerignore
    │   ├── package.json
    │   ├── bun.lock
    │   ├── server.js
    │   ├── db/
    │   │   └── connection.js
    │   └── routes/
    │       └── users.js
    └── frontend/
        ├── Dockerfile
        ├── .dockerignore
        ├── nginx.conf
        ├── package.json
        ├── bun.lock
        ├── vite.config.js
        ├── index.html
        └── src/
            ├── main.jsx
            ├── App.jsx
            ├── index.css
            └── components/
```

---

## Backend Dockerfile Explained

```dockerfile
# syntax=docker/dockerfile:1.7
FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

FROM base AS release
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER bun
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:5000/record || exit 1
CMD ["bun", "run", "server.js"]
```

**Line 1 — BuildKit syntax directive**

```dockerfile
# syntax=docker/dockerfile:1.7
```

This line tells Docker to use BuildKit version 1.7 to parse this file. BuildKit is the modern build engine that ships with Docker. It enables features that the classic builder does not support, including the `--mount=type=cache` instruction used later. Without this line, the cache mount would be silently ignored on older Docker versions.

**Line 2-3 — Base stage**

```dockerfile
FROM oven/bun:1-alpine AS base
WORKDIR /app
```

`oven/bun:1-alpine` is the official Bun image built on Alpine Linux. Alpine is a minimal Linux distribution. The full Alpine image is around 5 MB compared to Debian-based images that are over 100 MB. The `1` tag means the latest stable Bun 1.x release. Using `AS base` names this stage so subsequent stages can inherit from it without repeating the `FROM` instruction.

`WORKDIR /app` creates the `/app` directory inside the container and sets it as the working directory. Every subsequent `COPY`, `RUN`, and `CMD` instruction will operate relative to this path.

**Lines 5-9 — Dependency installation stage**

```dockerfile
FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production
```

This is a separate stage named `deps`. It exists only to install dependencies. By separating it from the final stage, Docker can cache the installed `node_modules` layer independently. If you change your application source code but not `package.json` or `bun.lock`, Docker will reuse the cached `node_modules` layer and skip the install step entirely.

`COPY package.json bun.lock ./` copies only the two files needed for installation. If any other source file changes but these two files stay the same, this layer cache is preserved.

`--mount=type=cache,target=/root/.bun/install/cache` is a BuildKit feature. It mounts a persistent cache directory that survives between builds on the same machine. Bun stores downloaded package tarballs here. On the second build, Bun reads from this cache instead of downloading from the internet. This is what makes subsequent builds take under 2 seconds instead of 22 seconds.

`--frozen-lockfile` tells Bun to refuse to install if `bun.lock` is out of sync with `package.json`. This is a safety check. It prevents the situation where a developer forgets to commit an updated lockfile, causing the Docker image to install different package versions than everyone else.

`--production` tells Bun to skip devDependencies. Tools like Vite, ESLint, and TypeScript types are only needed during development and building. The running backend server does not need them, so excluding them keeps `node_modules` smaller.

**Lines 11-25 — Final runtime stage**

```dockerfile
FROM base AS release
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER bun
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:5000/record || exit 1
CMD ["bun", "run", "server.js"]
```

`FROM base AS release` starts from the clean base image, not from the `deps` stage. This means the final image does not contain the Bun package cache, temporary build artifacts, or any of the tooling that was only needed for the install step.

`ENV NODE_ENV=production` sets the environment variable inside the container. Express and many libraries read this variable to change their behavior. In production mode, Express disables detailed error stack traces that would expose internal paths to users, and enables performance optimizations like view caching.

`COPY --from=deps /app/node_modules ./node_modules` copies only the installed production `node_modules` from the `deps` stage into the clean final image. This is the key benefit of multistage builds.

`COPY . .` copies the application source code. This is placed after the `node_modules` copy deliberately. Since source code changes more frequently than dependencies, Docker will only need to re-run the layers from this point onward when you change your code.

`USER bun` switches the container process from the root user to the non-root `bun` user that comes pre-created in the `oven/bun` image. Running as root inside a container is a security risk. If an attacker were to exploit a vulnerability in your application code, they would have root access to the container filesystem. Running as a non-root user limits the blast radius of any such exploit.

`HEALTHCHECK` defines how Docker checks if the container is actually healthy, not just running. Docker starts a process and immediately marks it as running, but your Express server might still be connecting to MongoDB. The healthcheck runs `wget` against the `/record` endpoint every 30 seconds. If it fails 3 times in a row, Docker marks the container as unhealthy. Docker Compose uses this status to control startup ordering, so the frontend container does not start until the backend is confirmed healthy.

`CMD ["bun", "run", "server.js"]` is the command that runs when the container starts. Using the JSON array form (`["bun", ...]`) instead of shell form (`bun run server.js`) means the process receives signals directly. When Docker sends a SIGTERM signal to stop the container, Bun receives it immediately and can shut down gracefully. In shell form, the signal goes to the shell process, not to Bun, and the application may be killed forcefully.

---

## Frontend Dockerfile Explained

```dockerfile
# syntax=docker/dockerfile:1.7
FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM base AS builder
ENV CYPRESS_INSTALL_BINARY=0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_BASE_URL=http://backend:5000
ENV VITE_BASE_URL=$VITE_BASE_URL
RUN bun run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

The frontend uses three build stages: `deps`, `builder`, and a final Nginx stage. The final image contains only Nginx and the compiled static files. It contains no Node.js, no Bun, no source code, no `node_modules`, and no build tools.

**Stage 1 — deps**

```dockerfile
FROM base AS deps
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
```

`ENV CYPRESS_INSTALL_BINARY=0` prevents Cypress from downloading its ~300 MB binary. Even though Cypress has been removed from this project's `package.json`, this variable is kept as a safety net. It is a best practice for any frontend project that might have Cypress as a transitive dependency. Setting it to `0` tells the Cypress post-install script to skip the binary download entirely.

Note that `--production` is not used here unlike in the backend. The frontend needs devDependencies like Vite, the React plugin, and Tailwind CSS to perform the build step.

**Stage 2 — builder**

```dockerfile
FROM base AS builder
ENV CYPRESS_INSTALL_BINARY=0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_BASE_URL=http://backend:5000
ENV VITE_BASE_URL=$VITE_BASE_URL
RUN bun run build
```

`ARG VITE_BASE_URL=http://backend:5000` declares a build argument with a default value. Build arguments are values you can pass in at build time from the outside. Docker Compose passes `VITE_BASE_URL: http://backend:5000` from the `args` section of the Compose file.

`ENV VITE_BASE_URL=$VITE_BASE_URL` promotes the build argument into an environment variable so that Vite can read it during the build process.

This is an important distinction: `ARG` values are only available during the image build. `ENV` values are baked into the image and available when the container runs. Vite reads `VITE_BASE_URL` at build time and embeds the value directly into the compiled JavaScript bundle. There is no way to change this value after the image is built without rebuilding the image.

`RUN bun run build` runs `vite build`, which compiles the React application into static HTML, CSS, and JavaScript files in the `dist/` directory.

**Stage 3 — Nginx runtime**

```dockerfile
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/ /usr/share/nginx/html/
```

`FROM nginx:stable-alpine` starts a completely fresh image. This image contains only Nginx and nothing else. The Bun runtime, the source code, and all 350+ packages in `node_modules` are not present in the final image at all. They existed only in the intermediate build stages.

`RUN rm -rf /usr/share/nginx/html/*` removes the default Nginx welcome page before copying the application files.

`COPY --from=builder /app/dist/ /usr/share/nginx/html/` copies only the compiled output from the builder stage.

The resulting image is roughly 50 MB total, compared to several hundred MB if Bun and `node_modules` were included.

---

## Nginx Configuration Explained

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /record {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**`server_name _;`** — The underscore is a catch-all value. It matches any hostname. This is appropriate for a containerized application where the hostname is not known ahead of time.

**`location /record`** — This block matches any request whose URI starts with `/record`. This covers `GET /record`, `POST /record`, `GET /record/some-id`, `PATCH /record/some-id`, and `DELETE /record/some-id`.

There is no trailing slash on `/record`. This is intentional. If you write `location /record/`, Nginx uses a prefix match that requires a trailing slash. A `POST` request to `/record` (without trailing slash) would not match and would fall through to the SPA handler, returning `index.html` instead of reaching the backend. Without the trailing slash, all paths starting with `/record` match correctly.

**`proxy_pass http://backend:5000;`** — There is no path appended after the port number. This is also intentional. If you write `proxy_pass http://backend:5000/record/`, Nginx rewrites the URI by substituting the matched location prefix with the proxy path. A request to `/record/some-id` would become `/record/some-id` rewritten to `/some-id`, losing the `/record` prefix. Without a path on `proxy_pass`, Nginx forwards the original request URI unchanged to the backend.

`http://backend` uses the service name from Docker Compose. Docker's internal DNS resolves `backend` to the IP address of the backend container. This is how containers communicate with each other on the same Docker network.

**`proxy_set_header X-Forwarded-For`** — When Nginx proxies a request, the backend would normally see Nginx's IP address as the client IP. These headers pass the real client IP and protocol information through to the backend so that logging and security features work correctly.

**`try_files $uri $uri/ /index.html;`** — This is the standard single-page application routing fallback. A React application manages routing in the browser using the History API. When a user navigates directly to a URL like `http://yourdomain.com/some/page`, Nginx receives a request for `/some/page`. That file does not exist on disk. Without this directive, Nginx would return a 404. With it, Nginx falls back to serving `index.html`, which loads the React application, which then reads the URL and renders the correct page.

---

## Docker Compose Explained

```yaml
services:
  backend:
    build:
      context: ./mern/backend
      dockerfile: Dockerfile
      network: host
    container_name: backend
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGO_URI: mongodb://mongodb:27017/mydatabase
    ports:
      - "5000:5000"
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:5000/record"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    networks:
      - mern_network
    depends_on:
      mongodb:
        condition: service_healthy
    restart: always

  frontend:
    build:
      context: ./mern/frontend
      dockerfile: Dockerfile
      network: host
      args:
        VITE_BASE_URL: http://backend:5000
    container_name: frontend
    ports:
      - "80:80"
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    networks:
      - mern_network
    depends_on:
      backend:
        condition: service_healthy
    restart: always

  mongodb:
    image: mongo
    container_name: mongodb
    ports:
      - "27017:27017"
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 20s
    networks:
      - mern_network
    volumes:
      - mongo-data:/data/db
    restart: always

networks:
  mern_network:
    driver: bridge

volumes:
  mongo-data:
```

**`build.network: host`**

During the `docker build` process, Docker creates a temporary container to run each `RUN` instruction. By default, this temporary container uses a Docker-managed bridge network, which goes through Docker's internal NAT. On some Linux systems (particularly those running inside WSL2 or with custom network configurations), this bridge network cannot resolve external DNS hostnames reliably, causing `bun install` to fail with `EAI_AGAIN` or similar DNS resolution errors.

Setting `network: host` on the build configuration makes the build container use the host machine's network stack directly. This bypasses Docker's internal network and gives the build container the same DNS resolution capability as your machine, making package downloads reliable.

This setting only applies during the image build process. It does not affect the network behavior of the running containers.

**`depends_on` with `condition: service_healthy`**

Plain `depends_on` only waits for a container to start. It does not wait for the application inside the container to be ready. Without health-condition depends_on:

- Docker Compose starts MongoDB, then immediately starts the backend
- The backend tries to connect to MongoDB before MongoDB has finished its initialization
- The connection fails and the backend crashes

With `condition: service_healthy`, Docker Compose waits until the MongoDB container's healthcheck reports healthy before starting the backend. Similarly, the frontend waits until the backend healthcheck reports healthy. This creates a guaranteed startup order:

1. MongoDB starts and passes its healthcheck (mongosh ping succeeds)
2. Backend starts, connects to MongoDB, and passes its healthcheck (HTTP 200 on `/record`)
3. Frontend starts

**`healthcheck` — `start_period`**

The `start_period` value gives a container time to initialize before the healthcheck failures start counting toward the retry limit. MongoDB takes time to start up. The `start_period: 20s` means the first 20 seconds of healthcheck failures are not counted. After the start period, if the healthcheck fails `retries` times in a row, the container is marked unhealthy.

**`MONGO_URI: mongodb://mongodb:27017/mydatabase`**

The hostname `mongodb` refers to the service name defined in the Compose file. Docker Compose creates a DNS entry for each service on the shared network. The backend container can reach MongoDB by using `mongodb` as the hostname. The database name `mydatabase` is appended to the URI path.

**`volumes: mongo-data:/data/db`**

Docker containers are ephemeral. When a container is removed, everything written to its filesystem is lost. MongoDB stores its data in `/data/db`. Without a volume, stopping and removing the containers would delete all your data.

`mongo-data` is a named volume managed by Docker. The data is stored on the host machine's filesystem in a Docker-managed location. It persists independently of the container lifecycle. You can remove and recreate the MongoDB container without losing data.

**`restart: always`**

If a container crashes due to an unhandled error or the host machine restarts, Docker will automatically restart the container. This is the baseline behavior expected of a production service.

**`networks: mern_network`**

All three services are attached to the same bridge network named `mern_network`. This means they can communicate with each other using their service names as hostnames. Containers on different networks cannot communicate with each other by default, which provides network isolation.

---

## Why This Setup Is Production Ready

**Multistage builds keep images small**

The backend image contains only Bun, the production `node_modules`, and the application source. No devDependencies, no build cache, no test tooling. The frontend image contains only Nginx and the compiled static files. The Bun runtime, the React source code, and all build tools are discarded after the build is complete. Smaller images mean faster deployments, less storage cost, and a reduced attack surface because there is less software that could contain vulnerabilities.

**Non-root user in the backend**

The backend process runs as the `bun` user, not as root. If an attacker exploits a vulnerability in the application, they cannot write to system directories, modify other processes, or escalate privileges beyond what the `bun` user is allowed to do.

**Deterministic builds with lockfiles**

`bun install --frozen-lockfile` refuses to proceed if the lockfile is inconsistent with `package.json`. This means every build uses the exact same package versions. You will never encounter the situation where a new patch version of a dependency introduces a regression in production that you cannot reproduce locally.

**Healthchecks replace guesswork with facts**

Without healthchecks, `docker compose up` would report all containers as running even if the Express server crashed on startup or MongoDB failed to initialize. With healthchecks, the reported status reflects the actual health of each service. Orchestration platforms like Docker Swarm and Kubernetes also use health status to route traffic and restart unhealthy pods.

**Startup ordering is enforced**

`condition: service_healthy` in `depends_on` ensures that each service is not only started but actually ready before the next service tries to connect to it. This eliminates an entire category of race condition bugs that commonly affect containerized applications.

**Persistent data storage**

The MongoDB data volume ensures that your data survives container restarts, upgrades, and redeployments. Upgrading the MongoDB image version does not lose your data.

**Build cache optimization through layer ordering**

Both Dockerfiles copy `package.json` and `bun.lock` first, install dependencies, and only then copy the application source. Docker caches layers in order. Since dependencies change far less often than source code, the dependency installation layer is almost always served from cache. Only the layers after `COPY . .` need to be rebuilt when you change your code. This is what makes incremental rebuilds fast.

---

## Prerequisites

Before running this application, make sure you have the following installed.

**Docker Desktop or Docker Engine**

On Linux, install Docker Engine:

```sh
curl -fsSL https://get.docker.com | sh
```

Verify the installation:

```sh
docker --version
docker compose version
```

Both commands should return a version number. Docker Compose v2 is required. It is included with Docker Desktop and recent Docker Engine installations. If `docker compose` is not found but `docker-compose` (with a hyphen) works, you have the older v1 plugin and should upgrade.

**Git**

```sh
git --version
```

---

## Running the Application

**Step 1 — Clone the repository**

```sh
git clone <your-repository-url>
cd MERN-docker-compose
```

**Step 2 — Start all services**

```sh
docker compose up -d --build
```

This single command does the following in order:

1. Builds the backend Docker image
2. Builds the frontend Docker image
3. Pulls the MongoDB image if not already present
4. Creates the `mern_network` bridge network
5. Creates the `mongo-data` persistent volume
6. Starts MongoDB and waits for it to become healthy
7. Starts the backend and waits for it to become healthy
8. Starts the frontend

The `--build` flag forces Docker to rebuild the images even if they already exist. Omit it on subsequent runs if you have not changed any source files and want to reuse the cached images.

The `-d` flag runs all containers in detached mode, meaning they run in the background and you get your terminal back.

**Step 3 — Check that all services are running**

```sh
docker compose ps
```

The output should show all three services with a status of `running (healthy)`. If any service shows `starting`, wait 30 seconds and run the command again. MongoDB and the backend take some time to initialize.

**Step 4 — Open the application**

Open your browser and navigate to:

```
http://localhost
```

The React application is served by Nginx on port 80. You do not need to specify a port number. The application communicates with the Express backend through the Nginx reverse proxy. API calls to `/record` are transparently forwarded by Nginx to the Express server running on port 5000.

---

## Verifying Everything Works

**Check container health status**

```sh
docker compose ps
```

All three containers should show `healthy`.

**View logs from all services**

```sh
docker compose logs -f
```

Press `Ctrl+C` to stop following logs. You should see output similar to:

```
backend   | Pinged your deployment. You successfully connected to MongoDB!
backend   | Server listening on port 5000
```

**View logs from a specific service**

```sh
docker compose logs backend
docker compose logs frontend
docker compose logs mongodb
```

**Test the backend API directly**

```sh
curl http://localhost:5000/record
```

This should return a JSON array (empty `[]` if no records have been created yet).

---

## Useful Commands

**Start all services (without rebuilding images)**

```sh
docker compose up -d
```

**Stop all services without removing containers**

```sh
docker compose stop
```

**Stop and remove containers, networks, and volumes**

Warning: this deletes all data stored in MongoDB.

```sh
docker compose down -v
```

**Rebuild a single service image**

```sh
DOCKER_BUILDKIT=1 docker compose build backend
DOCKER_BUILDKIT=1 docker compose build frontend
```

**Restart a single service**

```sh
docker compose restart backend
```

**Open a shell inside a running container**

```sh
docker exec -it backend sh
docker exec -it frontend sh
docker exec -it mongodb mongosh
```

**Regenerate the backend bun.lock after changing package.json**

```sh
docker run --rm --network=host \
  -v $(pwd)/mern/backend:/app \
  -w /app \
  oven/bun:1 bun install

sudo chown $USER:$USER mern/backend/bun.lock
```

**Regenerate the frontend bun.lock after changing package.json**

```sh
docker run --rm --network=host \
  -e CYPRESS_INSTALL_BINARY=0 \
  -v $(pwd)/mern/frontend:/app \
  -w /app \
  oven/bun:1 bun install

sudo chown $USER:$USER mern/frontend/bun.lock
```

These commands run `bun install` inside a temporary Docker container and mount your local directory as the working directory. This approach is used instead of running `bun install` directly on your machine because it ensures that the lockfile is generated with the same Bun version used inside the Docker images, avoiding any version mismatch issues.

### OPEN Source. Build with Love 
## Need Help Email: eng.ibrahim.mahmud@gmail.com

