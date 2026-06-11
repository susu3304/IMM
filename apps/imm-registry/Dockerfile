FROM rust:1.92-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY apps/imm-registry ./apps/imm-registry
RUN cargo build --release -p imm-registry

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/imm-registry /usr/local/bin/imm-registry

ENV IMM_REGISTRY_BIND=0.0.0.0:8080
ENV IMM_REGISTRY_STORAGE_ROOT=/var/lib/imm-registry

EXPOSE 8080
CMD ["imm-registry"]
