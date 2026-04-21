#!/bin/bash
cd "$(dirname "$0")" && \
MULTICA_SERVER_URL=ws://localhost:8080/ws \
JWT_SECRET="your-super-secret-jwt-secret-change-me-in-production" \
DATABASE_URL="postgres://multica:multica@localhost:5432/multica?sslmode=disable" \
./server/bin/server
