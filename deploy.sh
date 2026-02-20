#!/bin/bash

# deploy.sh — Replace DOMAIN and API_URL placeholders
# Usage: ./deploy.sh <domain> [api_url]
# Example: ./deploy.sh myvpndirect.com https://vpnnoborder.sytes.net

set -e

if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh <domain> [api_url]"
  echo "Example: ./deploy.sh myvpndirect.com https://vpnnoborder.sytes.net"
  exit 1
fi

DOMAIN="$1"
API_URL="${2:-https://vpnnoborder.sytes.net}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Deploying NoBorder VPN landing to: $DOMAIN"
echo "API URL: $API_URL"
echo ""

# Replace DOMAIN in HTML/XML files
FILES=(
  "$DIR/index.html"
  "$DIR/sitemap.xml"
  "$DIR/robots.txt"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    sed -i "s|DOMAIN|$DOMAIN|g" "$file"
    echo "  Updated: $(basename "$file")"
  fi
done

# Replace API_URL placeholder in JS
if [ -f "$DIR/js/main.js" ]; then
  sed -i "s|__API_URL__|$API_URL|g" "$DIR/js/main.js"
  echo "  Updated: js/main.js (API_URL)"
fi

echo ""
echo "Done! Domain set to: $DOMAIN, API: $API_URL"
echo ""
echo "Next steps:"
echo "  1. Upload files to hosting / Cloudflare Pages / Nginx"
echo "  2. Point DNS A-record for $DOMAIN to your server"
echo "  3. Set up SSL (certbot or Cloudflare)"
echo "  4. Verify: https://$DOMAIN"
