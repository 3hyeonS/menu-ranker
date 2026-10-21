#!/usr/bin/env bash
set -euo pipefail

commit="${1:?Commit SHA is required}"
artifact="${2:?Build archive is required}"
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit SHA'; exit 1; }
[[ "$artifact" == "/tmp/melo-dist-${commit}.tar.gz" ]] || { echo 'Invalid archive path'; exit 1; }

export PATH="/home/ubuntu/.nvm/versions/node/v20.20.1/bin:$PATH"
cd /home/ubuntu/menu-ranker

# Prevent overlapping manual and Actions deployments.
exec 9>/home/ubuntu/.melo-deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }

test -f .env
test -f "$artifact"
# Preserve server-only files and stop if tracked source has local changes.
test -z "$(git status --porcelain --untracked-files=no)" || {
  echo 'Tracked files have local changes; deployment stopped.'
  exit 1
}
git fetch origin main
git merge-base --is-ancestor "$commit" origin/main
git merge --ff-only "$commit"
test "$(git rev-parse HEAD)" = "$commit" || {
  echo 'Server is ahead of this build; deployment stopped.'
  exit 1
}
npm ci --omit=dev
# The archive was built and tested on GitHub at the same commit.
tar -xzf "$artifact"
pm2 restart main
pm2 save

port="$(node -e 'require("dotenv").config(); console.log(process.env.PORT || 3000)')"
for attempt in {1..30}; do
  if curl --fail --silent --max-time 2 "http://127.0.0.1:${port}/health"; then
    printf '\nDeployed %s successfully\n' "$commit"
    rm -f "$artifact"
    exit 0
  fi
  sleep 2
done

echo 'Health check failed. Inspect pm2 logs main.'
exit 1
