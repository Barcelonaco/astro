#!/bin/bash
# Astro frontend rebuild script — called by PHP in background.
# Uses a lockfile to prevent concurrent builds and a queue mechanism
# to handle changes that arrive during a build.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(dirname "$BACKEND_DIR")/frontend"
LOCK_FILE="$BACKEND_DIR/uploads/.rebuild.lock"
STATUS_FILE="$BACKEND_DIR/uploads/.rebuild_status.json"

# Ensure node/npm are in PATH (Apache may have a minimal PATH)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

do_build() {
    # Create lock
    echo $$ > "$LOCK_FILE"

    # Update status
    echo "{\"status\":\"building\",\"started_at\":$(date +%s)}" > "$STATUS_FILE"

    # Run build
    cd "$FRONTEND_DIR" && npm run build 2>&1

    BUILD_EXIT=$?

    # Remove lock
    rm -f "$LOCK_FILE"

    if [ $BUILD_EXIT -eq 0 ]; then
        echo "{\"status\":\"done\",\"completed_at\":$(date +%s)}" > "$STATUS_FILE"
    else
        echo "{\"status\":\"error\",\"completed_at\":$(date +%s),\"exit_code\":$BUILD_EXIT}" > "$STATUS_FILE"
    fi
}

# First build
do_build

# Check if another rebuild was queued during our build
if [ -f "$STATUS_FILE" ]; then
    QUEUED=$(python3 -c "import json; d=json.load(open('$STATUS_FILE')); print(d.get('status',''))" 2>/dev/null)
    if [ "$QUEUED" = "queued" ]; then
        do_build
    fi
fi
