#!/bin/bash

# Live-Tracking Setup Script
# Generiert TRACKING_SALT und fügt es zu .env hinzu

echo "=== Live-Tracking Setup ==="
echo ""

# Prüfe ob .env existiert
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Creating new one..."
  touch .env
fi

# Prüfe ob TRACKING_SALT bereits existiert
if grep -q "TRACKING_SALT=" .env; then
  echo "✅ TRACKING_SALT already exists in .env"
  exit 0
fi

# Generiere neuen Salt
echo "Generating new TRACKING_SALT..."
TRACKING_SALT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Füge zu .env hinzu
echo "" >> .env
echo "# Live Tracking" >> .env
echo "TRACKING_SALT=$TRACKING_SALT" >> .env

echo "✅ TRACKING_SALT added to .env"
echo ""
echo "Setup complete! You can now start the server with 'npm start'"
