#!/bin/bash
cd "$(dirname "$0")" && \
MULTICA_SERVER_URL=ws://localhost:8080/ws \
JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET before starting the server}" \
DATABASE_URL="${DATABASE_URL:-postgres://multica:multica@localhost:5432/multica?sslmode=disable}" \
./server/bin/server
