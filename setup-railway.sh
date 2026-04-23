#!/bin/bash
set -e

echo ""
echo "🚀 LeadReply — Railway Setup Script"
echo "======================================"
echo ""

# Check railway auth
if ! railway whoami &>/dev/null; then
  echo "❌ Not logged in to Railway. Run: railway login"
  echo "   Then re-run this script."
  exit 1
fi

echo "✅ Railway: logged in as $(railway whoami)"
echo ""

# Create + link Railway project
echo "📦 Creating Railway project..."
railway init --name "leadreply"

echo ""
echo "🔑 Setting environment variables..."

# Read from .env.local and set each non-empty, non-comment variable
while IFS= read -r line; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "$line" ]] && continue

  key="${line%%=*}"
  value="${line#*=}"

  # Skip empty values
  [[ -z "$value" ]] && continue

  # Skip NEXT_PUBLIC_APP_URL — we set it after getting the domain
  [[ "$key" == "NEXT_PUBLIC_APP_URL" ]] && continue

  railway variables set "$key=$value" --quiet
  echo "   ✓ $key"
done < .env.local

# Always set NODE_ENV
railway variables set "NODE_ENV=production" --quiet
echo "   ✓ NODE_ENV=production"

echo ""
echo "🔨 Deploying (this takes ~2 min)..."
railway up --detach

echo ""
echo "======================================"
echo "✅ Deployed! Now do two things:"
echo ""
echo "1. Get your domain:"
echo "   railway domain"
echo "   (or open Railway dashboard → Settings → Networking → Generate Domain)"
echo ""
echo "2. Set NEXT_PUBLIC_APP_URL with that domain:"
echo "   railway variables set \"NEXT_PUBLIC_APP_URL=https://YOUR-DOMAIN.up.railway.app\""
echo "   railway up --detach"
echo ""
echo "3. Set up the cron job (in Railway dashboard):"
echo "   New Service → Cron Job"
echo "   Schedule: */5 * * * *"
echo "   Command: curl -s -X GET \$RAILWAY_PUBLIC_DOMAIN/api/cron/follow-up -H \"Authorization: Bearer \$CRON_SECRET\""
echo "======================================"
