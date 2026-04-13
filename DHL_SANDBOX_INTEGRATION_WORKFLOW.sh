#!/bin/bash
# DHL Sandbox Integration Test Workflow
# Integrates DHL OAuth2 ROPC flow into existing DHL Shipping integration

echo "🚀 DHL Parcel DE Sandbox Integration Setup"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# Check if .env is configured
if grep -q "DHL_CLIENT_ID" .env && grep -q "DHL_CLIENT_SECRET" .env; then
    echo "✅ DHL_CLIENT_ID and DHL_CLIENT_SECRET configured in .env"
else
    echo "❌ DHL credentials not in .env"
    echo "   Please add:"
    echo "   DHL_CLIENT_ID=your_client_id"
    echo "   DHL_CLIENT_SECRET=your_client_secret"
    exit 1
fi

echo ""
echo "📋 ARCHITECTURE OVERVIEW:"
echo "─────────────────────────────────────────────────────────────────────"
echo ""
echo "1️⃣  BACKEND COMPONENTS:"
echo "   ✓ /server/services/dhlService.js"
echo "     - getParcelDEConfig() - Extracts OAuth credentials"
echo "     - getAccessToken() - OAuth2 ROPC token retrieval with cache"
echo "     - testConnection() - Connection test with masked debug info"
echo "     - createShipment() - Creates shipping labels"
echo ""
echo "   ✓ /server/services/systemConfigService.js"
echo "     - testShippingIntegration() - Calls DHLService.testConnection()"
echo "     - Validations for required fields"
echo ""
echo "2️⃣  FRONTEND COMPONENTS:"
echo "   ✓ /client/src/api/systemConfig.ts"
echo "     - Integration interface with credentials & metadata"
echo "     - testIntegration() API method"
echo ""
echo "   ✓ /client/src/components/admin/IntegrationDialog.tsx"
echo "     - DHL provider form fields"
echo "     - client_id / client_secret inputs"
echo "     - Username / password inputs (Business Customer)"
echo "     - Metadata & Credentials synchronization on save"
echo ""
echo "   ✓ /client/src/pages/admin/SystemConfiguration.tsx"
echo "     - Test integration handler"
echo "     - Test result modal with debug info"
echo "     - OAuth error diagnostics"
echo ""
echo "3️⃣  TEST SCRIPTS:"
echo "   ✓ /server/test-dhl-sandbox-existing.js"
echo "     - Updates existing DHL Shipping integration"
echo "     - Tests OAuth flow"
echo "     - Validates connection"
echo ""

echo "📊 WORKFLOW:"
echo "─────────────────────────────────────────────────────────────────────"
echo ""
echo "STEP 1: Run backend test"
echo "   $ cd server && node test-dhl-sandbox-existing.js"
echo "   → Updates 'DHL Shipping' integration in database"
echo "   → Tests OAuth2 ROPC flow"
echo "   → Shows debug info with masked credentials"
echo ""
echo "STEP 2: Test in Admin Panel"
echo "   → Open http://localhost:5173/admin/system"
echo "   → Go to 'Integrations' tab"
echo "   → Click test icon (🧪) on DHL Shipping integration"
echo "   → View:  ✅ Connection status"
echo "           🔐 Auth details (environment, endpoints)"
echo "           📝 Credentials status"
echo "           🔒 Masked credentials (first 2 + last 2 chars)"
echo "           ⚠️  OAuth error diagnostics (if any)"
echo ""
echo "STEP 3: Create shipping labels"
echo "   → Use DHL Shipping integration for orders"
echo ""

echo ""
echo "🔧 INTERFACE STRUCTURE:"
echo "─────────────────────────────────────────────────────────────────────"
echo ""
cat << 'EOF'
Integration {
  apiKey: string              // DHL client_id
  apiSecret: string           // DHL client_secret
  endpoint: string            // Base URL (https://api-sandbox.dhl.com)

  credentials: {              // Backup copy for API calls
    apiKey: string
    apiSecret: string
    clientId: string
    clientSecret: string
    username: string          // Business Customer username
    password: string          // Business Customer password
    accountId: string         // EKP/Billing number
  }

  metadata: {                 // DHL-specific config
    environment: 'sandbox|production'
    clientId: string
    clientSecret: string
    username: string
    password: string
  }

  settings: {                 // UI & behavior config
    accountNumber: string     // EKP/Billing number
    profile: string           // PARCEL_DE
    product: string           // V01PAK
    dhlApis: {                // API toggles
      parcelDeShipping: boolean
      parcelDeTracking: boolean
      parcelDeReturns: boolean
    }
    shipper: { }              // Default shipper address
  }
}
EOF
echo ""

echo "✨ KEY FEATURES:"
echo "─────────────────────────────────────────────────────────────────────"
echo ""
echo "✓ OAuth2 Password Flow (ROPC)"
echo "  - Automatic token retrieval from sandbox"
echo "  - Token caching (1 hour expiry - 60s buffer)"
echo "  - Automatic refresh on token expiry"
echo ""
echo "✓ Error Handling"
echo "  - Detects OAuth error subtypes"
echo "  - invalid_client → wrong app credentials or env mismatch"
echo "  - invalid_grant → wrong BC username/password"
echo "  - unauthorized_client → app not authorized for API"
echo ""
echo "✓ Security"
echo "  - Masked debug info (👁️  cannot expose full credentials)"
echo "  - First 2 + last 2 chars visible only"
echo "  - Safe audit trail in test results"
echo ""
echo "✓ Responsive UI"
echo "  - Full integration setup in dialog"
echo "  - Test results in separate modal"
echo "  - Environment auto-switches endpoint"
echo ""

echo "═══════════════════════════════════════════════════════════════════════"
echo "✅ Setup complete - ready to test!"
echo ""
