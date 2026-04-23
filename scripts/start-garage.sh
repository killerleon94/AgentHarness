#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GARAGE_DIR="$(dirname "$SCRIPT_DIR")/garage"

while true; do
    echo "Starting Garage..."
    /usr/local/bin/garage -c "$GARAGE_DIR/garage.toml" server
    echo "Garage exited, restarting in 5 seconds..."
    sleep 5
done
