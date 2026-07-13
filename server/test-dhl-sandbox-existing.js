/**
 * DHL Parcel DE Shipping API - Sandbox Connection Test
 * Updates and tests the existing DHL Shipping integration
 * 
 * Usage: node server/test-dhl-sandbox-existing.js
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

    // Get system configuration
    console.log('🔍 Lade Systemkonfiguration...');
    let config = await SystemConfiguration.findOne({});
    
    if (!config) {
      throw new Error('Systemkonfiguration existiert nicht! Bitte zuerst initialisieren.');
    }

    // Find existing DHL Shipping integration
    console.log('🔎 Suche nach bestehender DHL Shipping Integration...');
    let dhlIntegration = config.integrations.find(i =>
      i.provider?.toUpperCase() === 'DHL' &&
      i.type === 'shipping' &&
      !String(i.name || '').toLowerCase().includes('returns')
    );

    // Get API credentials from environment
    const clientId = process.env.DHL_CLIENT_ID;
    const clientSecret = process.env.DHL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('DHL_CLIENT_ID und DHL_CLIENT_SECRET sind nicht in .env konfiguriert!');
    }

    // Prepare DHL integration data
    const dhlData = {
      name: dhlIntegration?.name || 'DHL Shipping',
      type: 'shipping',
      provider: 'DHL',
      isActive: true,
      apiKey: clientId,
      apiSecret: clientSecret,
      endpoint: 'https://api-sandbox.dhl.com',
      credentials: {
        apiKey: clientId,
        apiSecret: clientSecret,
        apiEndpoint: 'https://api-sandbox.dhl.com'
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
        bookingLabelMode: dhlIntegration?.settings?.bookingLabelMode || process.env.BOOKING_DHL_LABEL_MODE || 'dummy',
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

    if (dhlIntegration) {
      // Update existing integration
      console.log('✅ Bestehende DHL Integration gefunden: ' + dhlIntegration.name);
      console.log('🔄 Aktualisiere Integration mit Sandbox-Konfiguration...\n');
      
      // Update fields but keep an existing, valid integration identity.
      Object.assign(dhlIntegration, dhlData, {
        name: dhlIntegration.name || dhlData.name,
      });
    } else {
      // Create new integration if it doesn't exist
      console.log('⚠️  Keine bestehende DHL Integration gefunden');
      console.log('➕ Erstelle neue DHL Parcel DE Shipping Integration...\n');
      
      config.integrations.push(dhlData);
      dhlIntegration = config.integrations[config.integrations.length - 1];
    }

    console.log('📋 Konfiguriert mit:');
    console.log(`   📍 Umgebung: ${dhlIntegration.metadata.environment}`);
    console.log(`   🔐 Endpoint: ${dhlIntegration.endpoint}`);
    console.log(`   👤 Username (Business Customer): ${dhlIntegration.metadata.username}`);
    console.log(`   🏢 Billing Number (EKP): ${dhlIntegration.metadata.accountNumber}`);
    console.log(`   🔑 Client ID: ${clientId.substring(0,2)}...${clientId.substring(clientId.length-2)}\n`);

    // Save configuration
    await config.save();
    console.log('💾 Integration in Systemkonfiguration gespeichert\n');

    // Test DHL connection with OAuth flow
    console.log('🔐 Starte OAuth 2.0 ROPC Token-Request...');
    console.log('─'.repeat(70));

    const testResult = await DHLService.testConnection(
      clientId,                                    // apiKey
      clientSecret,                                // apiSecret
      dhlIntegration.endpoint,                     // endpoint
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
      console.log(`   Username-Quelle: ${debug.usernameSource || 'nicht vorhanden'}`);
      console.log(`   Password-Quelle: ${debug.passwordSource || 'nicht vorhanden'}`);

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
            console.log('  6. Starten Sie den Test erneut: node server/test-dhl-sandbox-existing.js');
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
            console.log('  4. Starten Sie den Test erneut: node server/test-dhl-sandbox-existing.js');
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
            console.log('  6. Starten Sie den Test erneut: node server/test-dhl-sandbox-existing.js');
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
        console.log('  4. Die DHL Konfiguration sollte dort sichtbar sein mit Status "Connected"');
        console.log('  5. Sie können jetzt Versandlabels erstellen!');
        console.log('\n📖 API-Dokumentation:');
        console.log('  • DHL Parcel DE Shipping: https://developer.dhl.com/documentation/parcel-de-shipping-apis');
        console.log('  • DHL Sandbox: https://sandbox.dhl.de/');
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
    console.error('  • DHL_CLIENT_ID und DHL_CLIENT_SECRET müssen in .env gesetzt sein');
    console.error('  • Überprüfen Sie die Netzwerkverbindung zu api-sandbox.dhl.com');
    
    console.log('\n' + '═'.repeat(70) + '\n');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testDHLSandbox();
}

module.exports = testDHLSandbox;
