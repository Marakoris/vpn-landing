#!/bin/bash

# deploy.sh — Full deployment automation for NoBorder VPN landing
# Replaces placeholders → deploys to Cloudflare Pages → restores placeholders
#
# Usage:
#   ./deploy.sh <domain> [api_url]
#   ./deploy.sh fastnet-secure.com
#   ./deploy.sh new-domain.com https://vpnnoborder.sytes.net
#
# Requirements:
#   - wrangler (npm i -g wrangler) — Cloudflare Pages CLI
#   - CLOUDFLARE_API_TOKEN env variable (or wrangler login)

set -e

# ─── Config ───────────────────────────────────────────────────────────
CF_ACCOUNT_ID="6d755f2fe5d90ac46b3d6e2f90de59a8"
CF_PROJECT_NAME="noborder-landing"
DEFAULT_API_URL="https://vpnnoborder.sytes.net"
GA_ID="${GA_ID:-}"  # Set GA_ID env var before deploy (e.g. G-XXXXXXXXXX)

# ─── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ─── Args ─────────────────────────────────────────────────────────────
if [ -z "$1" ]; then
  echo -e "${CYAN}NoBorder VPN — Deploy Script${NC}"
  echo ""
  echo "Usage: ./deploy.sh <domain> [api_url] [flags]"
  echo ""
  echo "Examples:"
  echo "  ./deploy.sh fastnet-secure.com"
  echo "  ./deploy.sh new-domain.com https://custom-api.example.com"
  echo "  ./deploy.sh fastnet-secure.com --no-deploy"
  echo ""
  echo "Flags:"
  echo "  --no-deploy    Only replace placeholders, skip wrangler deploy"
  echo "  --no-restore   Don't restore placeholders after deploy"
  echo "  --add-domain   Also add custom domain to CF Pages via API"
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse args
DOMAIN=""
API_URL=""
NO_DEPLOY=false
NO_RESTORE=false
ADD_DOMAIN=false

for arg in "$@"; do
  case $arg in
    --no-deploy)  NO_DEPLOY=true ;;
    --no-restore) NO_RESTORE=true ;;
    --add-domain) ADD_DOMAIN=true ;;
    --*)          echo "Unknown flag: $arg"; exit 1 ;;
    *)
      if [ -z "$DOMAIN" ]; then
        DOMAIN="$arg"
      elif [ -z "$API_URL" ]; then
        API_URL="$arg"
      fi
      ;;
  esac
done

API_URL="${API_URL:-$DEFAULT_API_URL}"

if [ -z "$DOMAIN" ]; then
  echo -e "${CYAN}NoBorder VPN — Deploy Script${NC}"
  echo ""
  echo "Usage: ./deploy.sh <domain> [api_url] [flags]"
  echo ""
  echo "Error: domain argument is required"
  exit 1
fi

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  NoBorder VPN — Deploy${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Domain:  ${GREEN}$DOMAIN${NC}"
echo -e "  API URL: ${GREEN}$API_URL${NC}"
echo -e "  GA4 ID:  ${GREEN}${GA_ID:-<not set>}${NC}"
echo -e "  Project: ${GREEN}$CF_PROJECT_NAME${NC}"
echo ""

# ─── Step 1: Replace placeholders ────────────────────────────────────
echo -e "${YELLOW}[1/4] Replacing placeholders...${NC}"

# Files with DOMAIN placeholder
DOMAIN_FILES=(
  "$DIR/index.html"
  "$DIR/sitemap.xml"
  "$DIR/robots.txt"
)

for file in "${DOMAIN_FILES[@]}"; do
  if [ -f "$file" ]; then
    sed -i "s|DOMAIN|$DOMAIN|g" "$file"
    echo -e "  ${GREEN}✓${NC} $(basename "$file") — DOMAIN → $DOMAIN"
  fi
done

# Files with __API_URL__ placeholder
API_FILES=(
  "$DIR/js/main.js"
  "$DIR/index.html"
)

for file in "${API_FILES[@]}"; do
  if [ -f "$file" ]; then
    sed -i "s|__API_URL__|$API_URL|g" "$file"
    echo -e "  ${GREEN}✓${NC} $(basename "$file") — __API_URL__ → $API_URL"
  fi
done

# __GA_ID__ placeholder (in index.html only)
if [ -n "$GA_ID" ]; then
  sed -i "s|__GA_ID__|$GA_ID|g" "$DIR/index.html"
  echo -e "  ${GREEN}✓${NC} index.html — __GA_ID__ → $GA_ID"
else
  echo -e "  ${YELLOW}⚠${NC} GA_ID not set — analytics placeholder kept as __GA_ID__"
fi

echo ""

# ─── Step 2: Deploy to Cloudflare Pages ──────────────────────────────
if [ "$NO_DEPLOY" = true ]; then
  echo -e "${YELLOW}[2/4] Skipping deploy (--no-deploy)${NC}"
else
  echo -e "${YELLOW}[2/4] Deploying to Cloudflare Pages...${NC}"

  if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}  ✗ wrangler not found. Install: npm i -g wrangler${NC}"
    echo "  Skipping deploy step."
  else
    wrangler pages deploy "$DIR" \
      --project-name="$CF_PROJECT_NAME" \
      --branch=main \
      --commit-dirty=true \
      2>&1 | while IFS= read -r line; do echo "  $line"; done

    echo -e "  ${GREEN}✓${NC} Deployed to Cloudflare Pages"
  fi
fi

echo ""

# ─── Step 3: Add custom domain (optional) ────────────────────────────
if [ "$ADD_DOMAIN" = true ]; then
  echo -e "${YELLOW}[3/4] Adding custom domain to Cloudflare Pages...${NC}"

  if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${RED}  ✗ CLOUDFLARE_API_TOKEN not set. Skipping.${NC}"
    echo "  Set it: export CLOUDFLARE_API_TOKEN=your_token"
  else
    RESPONSE=$(curl -s -X POST \
      "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/$CF_PROJECT_NAME/domains" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$DOMAIN\"}")

    if echo "$RESPONSE" | grep -q '"success":true'; then
      echo -e "  ${GREEN}✓${NC} Custom domain $DOMAIN added to CF Pages"
    else
      ERROR=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | head -1)
      echo -e "  ${YELLOW}⚠${NC} $ERROR"
      echo "  (Domain may already be added, or DNS needs to be configured first)"
    fi
  fi
else
  echo -e "${YELLOW}[3/4] Skipping custom domain (use --add-domain to enable)${NC}"
fi

echo ""

# ─── Step 4: Restore placeholders ────────────────────────────────────
if [ "$NO_RESTORE" = true ]; then
  echo -e "${YELLOW}[4/4] Skipping restore (--no-restore)${NC}"
else
  echo -e "${YELLOW}[4/4] Restoring placeholders (keeping git clean)...${NC}"

  for file in "${DOMAIN_FILES[@]}"; do
    if [ -f "$file" ]; then
      sed -i "s|$DOMAIN|DOMAIN|g" "$file"
      echo -e "  ${GREEN}✓${NC} $(basename "$file") — restored DOMAIN"
    fi
  done

  for file in "${API_FILES[@]}"; do
    if [ -f "$file" ]; then
      sed -i "s|$API_URL|__API_URL__|g" "$file"
      echo -e "  ${GREEN}✓${NC} $(basename "$file") — restored __API_URL__"
    fi
  done

  if [ -n "$GA_ID" ]; then
    sed -i "s|$GA_ID|__GA_ID__|g" "$DIR/index.html"
    echo -e "  ${GREEN}✓${NC} index.html — restored __GA_ID__"
  fi
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Deploy complete!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Checklist:${NC}"
echo "  1. DNS: point $DOMAIN → Cloudflare (CNAME to $CF_PROJECT_NAME.pages.dev)"
echo "     Or set Cloudflare NS records on the domain registrar"
echo "  2. SSL: auto via Cloudflare (verify in dashboard)"
echo "  3. Verify: https://$DOMAIN"
echo "  4. Google Search Console: add property, submit sitemap"
echo "     → https://search.google.com/search-console"
echo "     → Sitemap URL: https://$DOMAIN/sitemap.xml"
echo "  5. Test OG image: https://www.opengraph.xyz/url/https://$DOMAIN"
echo "  6. PageSpeed: https://pagespeed.web.dev/analysis?url=https://$DOMAIN"
echo ""
