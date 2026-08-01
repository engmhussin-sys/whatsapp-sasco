# Optional containerized build path for the Flutter app. The GitHub Actions
# workflow (.github/workflows/mobile-ci.yml) uses subosito/flutter-action
# directly instead, which is faster (better caching) — this Dockerfile is
# provided for teams that prefer a fully containerized/reproducible build
# environment (e.g. self-hosted CI, or building outside GitHub Actions).
FROM ghcr.io/cirruslabs/flutter:3.24.0 AS builder
WORKDIR /app

COPY pubspec.yaml pubspec.lock* ./
RUN flutter pub get

COPY . .
ARG API_BASE_URL=http://localhost:3000/api/v1
ARG WS_BASE_URL=http://localhost:3000
RUN flutter build apk --release \
    --dart-define=API_BASE_URL=${API_BASE_URL} \
    --dart-define=WS_BASE_URL=${WS_BASE_URL}

# Output stage: just holds the built APK for `docker cp` extraction —
# there is nothing to "run" for a mobile app in a container.
FROM scratch AS output
COPY --from=builder /app/build/app/outputs/flutter-apk/app-release.apk /app-release.apk
