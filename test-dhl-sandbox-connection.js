/**
 * DHL Parcel DE Shipping API - Sandbox Connection Test
 * Tests OAuth 2.0 ROPC Flow with provided sandbox credentials
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const DHLService = require('./server/services/dhlService');
const SystemConfiguration = require('./server/models/SystemConfiguration');

async function testDHLSandbox() {
  try {
    // Connect to MongoDB
    console.log('📡 Verbinde mit MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ MongoDB verbunden\n');

    // Get or create system configuration with DHL integration
    console.log('🔍 Lade Systemkonfiguration...');
    let config = await SystemConfiguration.findOne({});
    
    if (!config) {
      console.log('⚠️  Systemkonfiguration existiert nicht, erstelle neue...');
      config = new SystemConfiguration({
        companyInfo: {
          name: 'FixitHub Test',
          email: 'test@fixithub.de'
        },
        integrations: []
      });
    }

    // Configure DHL integration with sandbox credentials
    console.log('\n🛠️  Konfiguriere DHL Sandbox Integration...');
    
    const dhlIntegration = {
      provider: 'dhl',
      name: 'DHL Parcel DE Sandbox',
      isActive: true,
      apiKey: process.env.DHL_CLIENT_ID || 'YOUR_CLIENT_ID',
      apiSecret: process.env.DHL_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
      credentials: {
        apiKey: process.env.DHL_CLIENT_ID || 'YOUR_CLIENT_ID',
        apiSecret: process.env.DHL_CLIENT_SECRET || 'YOUR_CLIENT_SECRET'
      },
      metadata: {
        environment: 'sandbox',
        endpoint: 'https://api-sandbox.dhl.com',
        clientId: process.env.DHL_CLIENT_ID || 'YOUR_CLIENT_ID',
        clientSecret: process.env.DHL_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
        username: 'user-valid',
        password: 'SandboxPasswort2023!',
        accountNumber: '33333333330101',
        profile: 'PARCEL_DE',
        product: 'V01PAK'
      },
      settings: {
        dhlApis: {
          parcelDeShipping: true,
          parcelDeTracking: false,
          parcelDeReturns: false
        },
        shipper: {
          company: 'FixitHub Test Company',
          country: 'DE',
          street: 'Teststraße 1',
          city: 'Berlin',
          postalCode: '10115',
          email: 'shipping@fixithub.de',
          phone: '+49 30 123456'
        }
      }
    };

    // Remove old DHL integration and add new one
    config.integrations = config.integrations.filter(i => i.provider !== 'dhl');
    config.integrations.push(dhlIntegration);
    
    console.log('✅ Integration konfiguriert mit:');
    console.log(`   📍 Umgebung: ${dhlIntegration.metadata.environment}`);
    console.log(`   🔐 Endpoint: ${dhlIntegration.metadata.endpoint}`);
    console.log(`   👤 Username: ${dhlIntegration.metadata.username}`);
    console.log(`   🏢 Billing Number (EKP): ${dhlIntegration.metadata.accountNumber}\n`);

    // Save configuration
    await config.save();
    console.log('💾 Systemkonfiguration gespeichert\n');

    // Test DHL connection with OAuth flow
    console.log('🔐 Starte OAuth 2.0 ROPC Token-Request...');
    console.log(`   POST ${dhlIntegration.metadata.endpoint}/parcel/de/account/auth/ropc/v1/token\n`);

    const testResult = await DHLService.testConnection({
      username: dhlIntegration.metadata.username,
      password: dhlIntegration.metadata.password
    }, dhlIntegration);

    console.log('\n' + '═'.repeat(70));
    console.log('📋 TEST RESULT');
    console.log('═'.repeat(70));
    console.log(`Status: ${testResult.success ? '✅ ERFOLGREICH' : '❌ FEHLER'}`);
    console.log(`Nachricht: ${testResult.message}`);
    
    if (testResult.errorCode) {
      console.log(`Fehlercode: ${testResult.errorCode}`);
    }

    if (testResult.debug) {
      console.log('\n📊 DEBUG-INFORMATIONEN:');
      console.log('─'.repeat(70));
      
      const debug = testResult.debug;
      
      // Authentication details
      console.log('\n🔐 Authentifizierung:');
      console.log(`   Umgebung: ${debug.environment}`);
      console.log(`   Token-Endpoint: ${debug.tokenEndpoint}`);
      console.log(`   Test-Endpoint: ${debug.probeEndpoint}`);
      console.log(`   Auth-Flow: ${debug.authFlow}`);

      // Credentials status
      console.log('\n📝 Anmeldedaten-Status:');
      console.log(`   Client ID vorhanden: ${debug.hasClientId ? '✅' : '❌'}`);
      console.log(`   Client Secret vorhanden: ${debug.hasClientSecret ? '✅' : '❌'}`);
      console.log(`   Username vorhanden: ${debug.hasUsername ? '✅' : '❌'}`);
      console.log(`   Password vorhanden: ${debug.hasPassword ? '✅' : '❌'}`);

      // Credentials sources
      console.log('\n📍 Anmeldedaten-Quellen:');
      console.log(`   Username-Quelle: ${debug.usernameSource}`);
      console.log(`   Password-Quelle: ${debug.passwordSource}`);

      // Masked credentials for audit trail
      if (debug.clientIdMasked) {
        console.log('\n🔒 Maskierte Zugangsdaten (für Audit-Trail):');
        console.log(`   Client ID: ${debug.clientIdMasked}`);
        console.log(`   Username: ${debug.usernameMasked}`);
      }

      // OAuth error details
      if (debug.oauthError) {
        console.log('\n⚠️  OAuth-Fehler:');
        console.log(`   Fehlertyp: ${debug.oauthError}`);
        console.log(`   Beschreibung: ${debug.oauthErrorDescription || 'Keine Beschreibung'}`);
        
        // Provide targeted troubleshooting
        console.log('\n🔧 Lösungsschritte:');
        switch (debug.oauthError) {
          case 'invalid_client':
            console.log('   • Client ID und Secret sind falsch ODER');
            console.log('   • Sandbox-Zugangsdaten werden auf Production-Endpoint verwendet (oder umgekehrt)');
            console.log('   • Lösung: Überprüfen Sie die App-Anmeldedaten im DHL Developer Portal');
            break;
          case 'invalid_grant':
            console.log('   • Business Customer Username/Password sind falsch');
            console.log('   • Lösung: Überprüfen Sie die Anmeldedaten im DHL Partner Portal');
            break;
          case 'unauthorized_client':
            console.log('   • App existiert, ist aber nicht autorisiert für Parcel DE Shipping API');
            console.log('   • Lösung: Aktivieren Sie "Parcel DE Shipping" für diese App im Developer Portal');
            break;
          default:
            console.log(`   • Unbekannter Fehler: ${debug.oauthError}`);
        }
      }
    }

    console.log('\n' + '═'.repeat(70));

    // Close database connection
    await mongoose.connection.close();
    console.log('\n✅ Datenbankverbindung geschlossen');

  } catch (error) {
    console.error('\n❌ Fehler beim Testen der DHL-Verbindung:');
    console.error('   ' + error.message);
    if (error.response?.data) {
      console.error('   Antwort:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
console.log('🚀 DHL Parcel DE Shipping API - Sandbox Test');
console.log('═'.repeat(70) + '\n');

testDHLSandbox().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
