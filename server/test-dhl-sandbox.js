/**
 * DHL Parcel DE Shipping API - Sandbox Connection Test
 * Tests OAuth 2.0 ROPC Flow with provided sandbox credentials
 * 
 * Usage: node test-dhl-sandbox.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DHLService = require('./services/dhlService');
const SystemConfiguration = require('./models/SystemConfiguration');

async function testDHLSandbox() {
  try {
    // Connect to MongoDB
    console.log('🚀 DHL Parcel DE Shipping API - Sandbox Test');
    console.log('═'.repeat(70) + '\n');

    console.log('📡 Verbinde mit MongoDB...');
    console.log(`   URL: ${process.env.DATABASE_URL}`);
    
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ MongoDB verbunden\n');

    // Get or create system configuration with DHL integration
    console.log('🔍 Lade Systemkonfiguration...');
    let config = await SystemConfiguration.findOne({});
    
    if (!config) {
      console.log('⚠️  Systemkonfiguration existiert nicht, erstelle neue...');
      config = new SystemConfiguration({
        companyInfo: {
          name: 'McRepair.de Test',
          email: 'test@mcrepair.de'
        },
        integrations: []
      });
    }

    // Configure DHL integration with sandbox credentials
    console.log('🛠️  Konfiguriere DHL Sandbox Integration...\n');
    
    const clientId = process.env.DHL_CLIENT_ID;
    const clientSecret = process.env.DHL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('DHL_CLIENT_ID und DHL_CLIENT_SECRET sind nicht in .env konfiguriert!');
    }

    const dhlIntegration = {
      name: 'DHL Parcel DE Sandbox Test',
      type: 'shipping',
      provider: 'dhl',
      isActive: true,
      apiKey: clientId,
      apiSecret: clientSecret,
      credentials: {
        apiKey: clientId,
        apiSecret: clientSecret
      },
      metadata: {
        environment: 'sandbox',
        endpoint: 'https://api-sandbox.dhl.com',
        clientId: clientId,
        clientSecret: clientSecret,
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
          company: 'McRepair.de Test Company',
          country: 'DE',
          street: 'Teststraße 1',
          city: 'Berlin',
          postalCode: '10115',
          email: 'shipping@mcrepair.de',
          phone: '+49 30 123456'
        }
      }
    };

    // Remove old DHL integration and add new one
    config.integrations = config.integrations.filter(i => i.provider !== 'dhl');
    config.integrations.push(dhlIntegration);
    
    console.log('✅ Konfiguriert mit:');
    console.log(`   📍 Umgebung: ${dhlIntegration.metadata.environment}`);
    console.log(`   🔐 Endpoint: ${dhlIntegration.metadata.endpoint}`);
    console.log(`   👤 Username (Business Customer): ${dhlIntegration.metadata.username}`);
    console.log(`   🏢 Billing Number (EKP): ${dhlIntegration.metadata.accountNumber}`);
    console.log(`   🔑 Client ID: ${clientId.substring(0,2)}...${clientId.substring(clientId.length-2)}\n`);

    // Save configuration
    await config.save();
    console.log('💾 Systemkonfiguration gespeichert\n');

    // Test DHL connection with OAuth flow
    console.log('🔐 Starte OAuth 2.0 ROPC Token-Request...');
    console.log('─'.repeat(70));

    const testResult = await DHLService.testConnection(
      clientId,                                    // apiKey
      clientSecret,                                // apiSecret
      'https://api-sandbox.dhl.com',              // endpoint
      {                                            // auth object
        username: dhlIntegration.metadata.username,
        password: dhlIntegration.metadata.password
      }
    );

    console.log('\n' + '═'.repeat(70));
    console.log('📋 TEST RESULT');
    console.log('═'.repeat(70));
    console.log(`\nStatus: ${testResult.success ? '✅ ERFOLGREICH' : '❌ FEHLER'}`);
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
      console.log(`   Client ID vorhanden: ${debug.hasClientId ? '✅ Ja' : '❌ Nein'}`);
      console.log(`   Client Secret vorhanden: ${debug.hasClientSecret ? '✅ Ja' : '❌ Nein'}`);
      console.log(`   Username vorhanden: ${debug.hasUsername ? '✅ Ja' : '❌ Nein'}`);
      console.log(`   Password vorhanden: ${debug.hasPassword ? '✅ Ja' : '❌ Nein'}`);

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
        console.log('\n⚠️  OAuth-Fehler Beschreibung:');
        console.log(`   Fehlertyp: ${debug.oauthError}`);
        console.log(`   Beschreibung: ${debug.oauthErrorDescription || 'Keine weitere Beschreibung von DHL erhalten'}`);
        
        // Provide targeted troubleshooting
        console.log('\n🔧 LÖSUNGSSCHRITTE nach Fehlertyp:');
        console.log('─'.repeat(70));
        switch (debug.oauthError) {
          case 'invalid_client':
            console.log('Fehlertyp: invalid_client');
            console.log('Ursache: Client ID und/oder Secret sind falsch ODER');
            console.log('         Sandbox-Anmeldedaten auf Production-Endpoint (oder umgekehrt)');
            console.log('\nLösung:');
            console.log('  1. Öffnen Sie https://developer.dhl.com/');
            console.log('  2. Gehen Sie zu "Applications" → Ihre App');
            console.log('  3. Kopieren Sie die aktuellen Client ID und Client Secret');
            console.log('  4. Überprüfen Sie, dass Sie Sandbox-Anmeldedaten verwenden (nicht Production)');
            console.log('  5. Aktualisieren Sie die .env Datei mit den richtigen Werten');
            console.log('  6. Starten Sie den Test erneut: node server/test-dhl-sandbox.js');
            break;
          case 'invalid_grant':
            console.log('Fehlertyp: invalid_grant');
            console.log('Ursache: Business Customer Username oder Password sind falsch');
            console.log('\nLösung:');
            console.log('  1. Überprüfen Sie die Standard-Testdaten:');
            console.log('     Username: user-valid');
            console.log('     Password: SandboxPasswort2023!');
            console.log('  2. Diese müssen mit den Zugangsdaten in Ihrem DHL Partner Portal stimmen');
            console.log('  3. Falls Sie andere Testbenutzer haben, aktualisieren Sie diese im Skript');
            console.log('  4. Starten Sie den Test erneut: node server/test-dhl-sandbox.js');
            break;
          case 'unauthorized_client':
            console.log('Fehlertyp: unauthorized_client');
            console.log('Ursache: App existiert, ist aber nicht autorisiert für Parcel DE Shipping API');
            console.log('\nLösung:');
            console.log('  1. Melden Sie sich unter https://developer.dhl.com/ an');
            console.log('  2. Gehen Sie zu "Applications" → Ihre App');
            console.log('  3. Klicken Sie auf "API Subscriptions" oder "API Access"');
            console.log('  4. Aktivieren Sie die Berechtigung für "Parcel DE Shipping" in Sandbox');
            console.log('  5. Warten Sie auf die Aktivierung (kann einige Minuten dauern)');
            console.log('  6. Starten Sie den Test erneut: node server/test-dhl-sandbox.js');
            break;
          default:
            console.log(`Fehlertyp: ${debug.oauthError}`);
            console.log('Kontaktieren Sie den DHL Support unter support@dhl.com mit diesem Fehlercode.');
        }
      } else if (testResult.success) {
        console.log('\n✨ ERFOLG!');
        console.log('─'.repeat(70));
        console.log('Nächste Schritte:');
        console.log('  1. DHL Integration ist konfiguriert und einsatzbereit');
        console.log('  2. Öffnen Sie http://localhost:5173/admin/system');
        console.log('  3. Gehen Sie zum Tab "Integrations"');
        console.log('  4. Die DHL Konfiguration sollte dort sichtbar sein');
        console.log('  5. Sie können jetzt Versandlabels erstellen!');
      }
    }

    console.log('\n' + '═'.repeat(70) + '\n');

    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Datenbankverbindung geschlossen\n');

    process.exit(testResult.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Fehler beim Testen der DHL-Verbindung:');
    console.error('─'.repeat(70));
    console.error(`Fehler: ${error.message}\n`);
    
    if (error.response?.data) {
      console.error('Antwort vom Server:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    console.error('\n💡 Häufige Lösungen:');
    console.error('  • Stellen Sie sicher, dass MongoDB läuft: mongod');
    console.error('  • Überprüfen Sie, dass .env korrekt konfiguriert ist');
    console.error('  • Überprüfen Sie die Netzwerkverbindung zu api-sandbox.dhl.com');
    
    console.log('\n' + '═'.repeat(70) + '\n');
    process.exit(1);
  }
}

// Optional: Run the test if executed directly
if (require.main === module) {
  testDHLSandbox();
}

module.exports = testDHLSandbox;
