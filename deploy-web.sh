#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$REPO_ROOT/artifacts/tryout-app/dist/public"

echo "Building web dashboard..."
cd "$REPO_ROOT/artifacts/tryout-app"
VITE_API_URL="https://efficient-amazement-production-864a.up.railway.app" VITE_SUPER_ADMIN_EMAIL="giancarlosho@gmail.com,alyssarenee2990@gmail.com" PORT=19107 BASE_PATH="/" npx vite build

# Restore Vercel project link (wiped by each build)
mkdir -p "$DIST/.vercel"
cat > "$DIST/.vercel/project.json" <<'EOF'
{"projectId":"prj_dtxuGjys0beLB4B89VAOrfh6iIyd","orgId":"team_VqrvQ2gFe6sx0YBJBEvNz7zd","projectName":"tryoutdesk"}
EOF

# SPA fallback — all routes serve index.html so refresh works on any page
cat > "$DIST/vercel.json" <<'EOF'
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
EOF

echo "Deploying to Vercel (tryoutdesk)..."
cd "$DIST"
vercel --yes --prod

echo "Done."
