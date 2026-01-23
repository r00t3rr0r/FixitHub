const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testCreateExampleModels() {
  try {
    console.log('=== Creating Example Device Models ===\n');

    // Step 1: Login as admin
    console.log('Step 1: Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    });

    const token = loginResponse.data.accessToken;
    console.log('✓ Login successful\n');

    // Step 2: Get brands
    console.log('Step 2: Fetching brands...');
    const brandsResponse = await axios.get(`${API_URL}/api/devices/brands`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const brands = brandsResponse.data.brands;
    console.log(`✓ Found ${brands.length} brands\n`);

    // Step 3: Get device types
    console.log('Step 3: Fetching device types...');
    const typesResponse = await axios.get(`${API_URL}/api/devices/types`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const deviceTypes = typesResponse.data.deviceTypes;
    console.log(`✓ Found ${deviceTypes.length} device types\n`);
    console.log('Brands:', brands.map(b => b.name));
    console.log('Device types:', deviceTypes.map(t => t.name));

    // Find Apple brand and smartphone type
    const appleBrand = brands.find(b => b.name.toLowerCase().includes('apple'));
    const smartphoneType = deviceTypes.find(t => t.name.toLowerCase() === 'smartphone');

    if (!appleBrand || !smartphoneType) {
      console.error('❌ Could not find Apple brand or smartphone type');
      console.error('Apple brand found:', appleBrand);
      console.error('Smartphone type found:', smartphoneType);
      return;
    }

    // Step 4: Create example iPhone model with comprehensive data
    console.log('Step 4: Creating iPhone 15 Pro Max with full specifications...');

    const iphone15ProMax = {
      name: 'iPhone 15 Pro Max',
      brandId: appleBrand._id,
      deviceType: smartphoneType._id,
      image: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-max-blue-titanium-select?wid=470&hei=556',
      specifications: {
        display: '6.7-inch Super Retina XDR',
        processor: 'A17 Pro chip',
        storage: '256GB/512GB/1TB',
        camera: 'Triple 48MP system'
      },
      network: {
        technology2G: 'GSM 850 / 900 / 1800 / 1900',
        bands2G: 'GSM 850 / 900 / 1800 / 1900',
        technology3G: 'HSDPA 850 / 900 / 1700(AWS) / 1900 / 2100',
        bands3G: 'HSDPA 850 / 900 / 1700(AWS) / 1900 / 2100',
        technology4G: 'LTE',
        bands4G: '1, 2, 3, 4, 5, 7, 8, 12, 13, 17, 18, 19, 20, 25, 26, 28, 30, 32, 34, 38, 39, 40, 41, 42, 46, 48, 66',
        technology5G: '5G NR',
        bands5G: 'n1, n2, n3, n5, n7, n8, n12, n20, n25, n28, n30, n38, n40, n41, n48, n66, n77, n78, n79',
        speed: 'HSPA, LTE-A, 5G'
      },
      physical: {
        dimensions: '159.9 x 76.7 x 8.25 mm',
        weight: '221 g',
        build: 'Glass front (Corning-made glass), glass back (Corning-made glass), titanium frame',
        simType: 'Nano-SIM and eSIM',
        simCount: 'Dual SIM (nano-SIM and eSIM)'
      },
      display: {
        type: 'LTPO Super Retina XDR OLED, 120Hz, HDR10, Dolby Vision',
        size: '6.7 inches, 110.2 cm2',
        resolution: '1290 x 2796 pixels, 19.5:9 ratio (~460 ppi density)',
        protection: 'Ceramic Shield glass',
        features: '120Hz ProMotion, Always-On display, HDR10, Dolby Vision, 2000 nits peak brightness'
      },
      platform: {
        os: 'iOS 17, upgradable to iOS 17.2',
        chipset: 'Apple A17 Pro (3 nm)',
        cpu: 'Hexa-core (2x3.78 GHz + 4x2.11 GHz)',
        gpu: 'Apple GPU (6-core graphics)'
      },
      memory: {
        internal: [
          { ram: '8GB', storage: '256GB' },
          { ram: '8GB', storage: '512GB' },
          { ram: '8GB', storage: '1TB' }
        ],
        cardSlot: 'No'
      },
      rearCamera: {
        modules: '48 MP, f/1.8, 24mm (wide), 1/1.28", 1.22µm, dual pixel PDAF, sensor-shift OIS\n12 MP, f/2.8, 120mm (periscope telephoto), 1/3.06", 1.12µm, dual pixel PDAF, 3D sensor-shift OIS, 5x optical zoom\n12 MP, f/2.2, 13mm, 120˚ (ultrawide), 1/2.55", 1.4µm, dual pixel PDAF',
        features: 'Dual-LED dual-tone flash, HDR (photo/panorama)',
        video: '4K@24/25/30/60fps, 1080p@25/30/60/120/240fps, 10-bit HDR, Dolby Vision HDR (up to 60fps), ProRes, Cinematic mode (4K@30fps), stereo sound rec.'
      },
      frontCamera: {
        modules: '12 MP, f/1.9, 23mm (wide), 1/3.6", PDAF',
        features: 'HDR, Dolby Vision HDR (up to 60fps)',
        video: '4K@24/25/30/60fps, 1080p@25/30/60/120fps, gyro-EIS'
      },
      audio: {
        loudspeaker: 'Yes, with stereo speakers',
        jack3_5mm: 'No'
      },
      connectivity: {
        wlan: 'Wi-Fi 802.11 a/b/g/n/ac/6e, dual-band, hotspot',
        bluetooth: '5.3, A2DP, LE',
        positioning: 'GPS, GLONASS, GALILEO, BDS, QZSS',
        nfc: 'Yes',
        radio: 'No',
        usb: 'USB Type-C 3.0, DisplayPort',
        infrared: 'Yes',
        other: 'Ultra Wideband 2 (UWB) support'
      },
      features: {
        sensors: 'Face ID, accelerometer, gyro, proximity, compass, barometer, Ultra Wideband 2 (UWB) support',
        special: ['Emergency SOS via satellite', 'Crash Detection', 'Action button']
      },
      battery: {
        type: 'Li-Ion 4441 mAh, non-removable',
        charging: 'Wired, PD2.0, 50% in 30 min (advertised), 15W wireless (MagSafe), 15W wireless (Qi2), 4.5W reverse wired',
        standbyTime: 'Up to 29 hours video playback',
        talkTime: '',
        musicPlay: 'Up to 95 hours audio playback'
      },
      other: {
        models: ['A3108', 'A2849', 'A3106', 'iPhone16,2'],
        sarValues: {
          head: '1.15 W/kg',
          body: '1.08 W/kg'
        },
        price: '$1,199 / €1,349 / £1,199 / ₹1,59,900',
        releaseDate: 'Released 2023, September 22',
        colors: ['Black Titanium', 'White Titanium', 'Blue Titanium', 'Natural Titanium']
      }
    };

    const createResponse = await axios.post(
      `${API_URL}/api/devices/models`,
      iphone15ProMax,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('✓ iPhone 15 Pro Max created successfully!');
    console.log(`  Model ID: ${createResponse.data.model._id}`);
    console.log(`  Name: ${createResponse.data.model.name}`);
    console.log(`  Brand: ${appleBrand.name}`);
    console.log(`  Device Type: ${smartphoneType.name}\n`);

    // Step 5: Create Samsung Galaxy S24 Ultra
    const samsungBrand = brands.find(b => b.name.toLowerCase().includes('samsung'));

    if (samsungBrand) {
      console.log('Step 5: Creating Samsung Galaxy S24 Ultra...');

      const galaxyS24Ultra = {
        name: 'Galaxy S24 Ultra',
        brandId: samsungBrand._id,
        deviceType: smartphoneType._id,
        image: 'https://images.samsung.com/is/image/samsung/p6pim/za/2401/gallery/za-galaxy-s24-s928-sm-s928bzadeuk-thumb-539573335',
        specifications: {
          display: '6.8-inch Dynamic AMOLED 2X',
          processor: 'Snapdragon 8 Gen 3',
          storage: '256GB/512GB/1TB',
          camera: 'Quad 200MP system'
        },
        network: {
          technology2G: 'GSM 850 / 900 / 1800 / 1900',
          bands2G: 'GSM 850 / 900 / 1800 / 1900',
          technology3G: 'HSDPA 850 / 900 / 1700(AWS) / 1900 / 2100',
          bands3G: 'HSDPA 850 / 900 / 1700(AWS) / 1900 / 2100',
          technology4G: 'LTE',
          bands4G: '1, 2, 3, 4, 5, 7, 8, 12, 13, 17, 18, 19, 20, 25, 26, 28, 32, 38, 39, 40, 41, 66',
          technology5G: '5G NR',
          bands5G: 'n1, n2, n3, n5, n7, n8, n12, n20, n25, n28, n38, n40, n41, n66, n77, n78',
          speed: 'HSPA, LTE-A, 5G'
        },
        physical: {
          dimensions: '162.3 x 79 x 8.6 mm',
          weight: '232 g',
          build: 'Glass front (Gorilla Armor), glass back (Gorilla Glass Victus 2), titanium frame',
          simType: 'Nano-SIM and eSIM',
          simCount: 'Dual SIM (nano-SIM and eSIM)'
        },
        display: {
          type: 'Dynamic AMOLED 2X, 120Hz, HDR10+',
          size: '6.8 inches, 113.5 cm2',
          resolution: '1440 x 3120 pixels, 19.3:9 ratio (~505 ppi density)',
          protection: 'Corning Gorilla Armor',
          features: '120Hz adaptive refresh rate, Always-on display, 2600 nits peak brightness'
        },
        platform: {
          os: 'Android 14, One UI 6.1',
          chipset: 'Qualcomm SM8650-AC Snapdragon 8 Gen 3 (4 nm)',
          cpu: 'Octa-core (1x3.39 GHz Cortex-X4 & 3x3.1 GHz Cortex-A720 & 2x2.9 GHz Cortex-A720 & 2x2.2 GHz Cortex-A520)',
          gpu: 'Adreno 750'
        },
        memory: {
          internal: [
            { ram: '12GB', storage: '256GB' },
            { ram: '12GB', storage: '512GB' },
            { ram: '12GB', storage: '1TB' }
          ],
          cardSlot: 'No'
        },
        rearCamera: {
          modules: '200 MP, f/1.7, 24mm (wide), 1/1.3", 0.6µm, multi-directional PDAF, Laser AF, OIS\n50 MP, f/3.4, 111mm (periscope telephoto), PDAF, OIS, 5x optical zoom\n10 MP, f/2.4, 67mm (telephoto), 1/3.52", 1.12µm, dual pixel PDAF, OIS, 3x optical zoom\n12 MP, f/2.2, 13mm, 120˚ (ultrawide), 1/2.55", 1.4µm, dual pixel PDAF, Super Steady video',
          features: 'LED flash, auto-HDR, panorama',
          video: '8K@24/30fps, 4K@30/60/120fps, 1080p@30/60/240fps, 1080p@960fps, HDR10+, stereo sound rec., gyro-EIS'
        },
        frontCamera: {
          modules: '12 MP, f/2.2, 26mm (wide), dual pixel PDAF',
          features: 'Dual video call, Auto-HDR, HDR10+',
          video: '4K@30/60fps, 1080p@30fps'
        },
        audio: {
          loudspeaker: 'Yes, with stereo speakers',
          jack3_5mm: 'No'
        },
        connectivity: {
          wlan: 'Wi-Fi 802.11 a/b/g/n/ac/6e/7, tri-band, Wi-Fi Direct',
          bluetooth: '5.3, A2DP, LE',
          positioning: 'GPS, GLONASS, BDS, GALILEO, QZSS',
          nfc: 'Yes',
          radio: 'No',
          usb: 'USB Type-C 3.2, DisplayPort 1.2, OTG',
          infrared: 'Yes',
          other: 'Ultra Wideband (UWB) support'
        },
        features: {
          sensors: 'Fingerprint (under display, ultrasonic), accelerometer, gyro, proximity, compass, barometer',
          special: ['Samsung DeX', 'Samsung Wireless DeX', 'S Pen support']
        },
        battery: {
          type: 'Li-Ion 5000 mAh, non-removable',
          charging: '45W wired, PD3.0, 65% in 30 min (advertised), 15W wireless (Qi/PMA), 4.5W reverse wireless',
          standbyTime: '',
          talkTime: '',
          musicPlay: ''
        },
        other: {
          models: ['SM-S928B', 'SM-S928B/DS', 'SM-S928U', 'SM-S928U1', 'SM-S928W', 'SM-S928N', 'SM-S9280'],
          sarValues: {
            head: '0.95 W/kg',
            body: '1.28 W/kg'
          },
          price: '$1,299 / €1,449 / £1,249 / ₹1,29,999',
          releaseDate: 'Released 2024, January 24',
          colors: ['Titanium Black', 'Titanium Gray', 'Titanium Violet', 'Titanium Yellow']
        }
      };

      const galaxyResponse = await axios.post(
        `${API_URL}/api/devices/models`,
        galaxyS24Ultra,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✓ Samsung Galaxy S24 Ultra created successfully!');
      console.log(`  Model ID: ${galaxyResponse.data.model._id}`);
      console.log(`  Name: ${galaxyResponse.data.model.name}`);
      console.log(`  Brand: ${samsungBrand.name}`);
      console.log(`  Device Type: ${smartphoneType.name}\n`);
    }

    // Step 6: Create Google Pixel 8 Pro
    const googleBrand = brands.find(b => b.name.toLowerCase().includes('google'));

    if (googleBrand) {
      console.log('Step 6: Creating Google Pixel 8 Pro...');

      const pixel8Pro = {
        name: 'Pixel 8 Pro',
        brandId: googleBrand._id,
        deviceType: smartphoneType._id,
        image: 'https://lh3.googleusercontent.com/qDmzzFuqSHl4wZF8SLjHHxEtZvh8owgrkdGjkz1C_mZaFqFz1x1qX0YDSL9c7b8gBqGdnA=w2400',
        specifications: {
          display: '6.7-inch LTPO OLED',
          processor: 'Google Tensor G3',
          storage: '128GB/256GB/512GB',
          camera: 'Triple 50MP system'
        },
        network: {
          technology2G: 'GSM 850 / 900 / 1800 / 1900',
          bands2G: 'GSM 850 / 900 / 1800 / 1900',
          technology3G: 'HSDPA 850 / 900 / 1700(AWS) / 1900 / 2100',
          bands3G: 'HSDPA 850 / 900 / 1700(AWS) / 1900 / 2100',
          technology4G: 'LTE',
          bands4G: '1, 2, 3, 4, 5, 7, 8, 12, 13, 14, 17, 18, 19, 20, 25, 26, 28, 29, 30, 38, 39, 40, 41, 42, 46, 48, 66, 71',
          technology5G: '5G NR',
          bands5G: 'n1, n2, n3, n5, n7, n8, n12, n20, n25, n26, n28, n30, n38, n40, n41, n48, n66, n71, n77, n78',
          speed: 'HSPA, LTE-A, 5G'
        },
        physical: {
          dimensions: '162.6 x 76.5 x 8.8 mm',
          weight: '213 g',
          build: 'Glass front (Gorilla Glass Victus 2), glass back (Gorilla Glass Victus 2), aluminum frame',
          simType: 'Nano-SIM and eSIM',
          simCount: 'Dual SIM (nano-SIM and eSIM)'
        },
        display: {
          type: 'LTPO OLED, 120Hz, HDR10+',
          size: '6.7 inches, 110.7 cm2',
          resolution: '1344 x 2992 pixels, 20:9 ratio (~489 ppi density)',
          protection: 'Corning Gorilla Glass Victus 2',
          features: '120Hz adaptive refresh rate, Always-on display, 2400 nits peak brightness'
        },
        platform: {
          os: 'Android 14',
          chipset: 'Google Tensor G3 (4 nm)',
          cpu: 'Nona-core (1x3.0 GHz Cortex-X3 & 4x2.45 GHz Cortex-A715 & 4x2.15 GHz Cortex-A510)',
          gpu: 'Immortalis-G715s MC10'
        },
        memory: {
          internal: [
            { ram: '12GB', storage: '128GB' },
            { ram: '12GB', storage: '256GB' },
            { ram: '12GB', storage: '512GB' }
          ],
          cardSlot: 'No'
        },
        rearCamera: {
          modules: '50 MP, f/1.7, 25mm (wide), 1/1.31", 1.2µm, multi-directional PDAF, Laser AF, OIS\n48 MP, f/2.8, 113mm (telephoto), 1/2.55", 0.7µm, dual pixel PDAF, OIS, 5x optical zoom\n48 MP, f/2.0, 126˚ (ultrawide), 0.8µm, dual pixel PDAF',
          features: 'Dual-LED flash, Pixel Shift, Ultra-HDR, panorama, Best Take',
          video: '4K@24/30/60fps, 1080p@24/30/60/120/240fps, 10-bit HDR'
        },
        frontCamera: {
          modules: '10.5 MP, f/2.2, 20mm (ultrawide), 1.22µm, PDAF',
          features: 'Auto-HDR, panorama',
          video: '4K@24/30/60fps, 1080p@30/60fps'
        },
        audio: {
          loudspeaker: 'Yes, with stereo speakers',
          jack3_5mm: 'No'
        },
        connectivity: {
          wlan: 'Wi-Fi 802.11 a/b/g/n/ac/6e/7, tri-band, Wi-Fi Direct',
          bluetooth: '5.3, A2DP, LE, aptX HD',
          positioning: 'GPS, GLONASS, GALILEO, QZSS, BDS',
          nfc: 'Yes',
          radio: 'No',
          usb: 'USB Type-C 3.2, DisplayPort 1.4, OTG',
          infrared: 'No',
          other: 'Ultra Wideband (UWB) support'
        },
        features: {
          sensors: 'Fingerprint (under display, optical), accelerometer, gyro, proximity, compass, barometer, thermometer (skin temperature)',
          special: ['Magic Eraser', 'Photo Unblur', 'Night Sight', 'Face Unblur', 'Motion Mode']
        },
        battery: {
          type: 'Li-Ion 5050 mAh, non-removable',
          charging: '30W wired, PD3.0, 50% in 30 min (advertised), 23W wireless, reverse wireless',
          standbyTime: 'Up to 24 hours',
          talkTime: '',
          musicPlay: 'Up to 72 hours audio playback'
        },
        other: {
          models: ['GB7N6', 'G1MNW', 'GE9DP'],
          sarValues: {
            head: '0.99 W/kg',
            body: '1.42 W/kg'
          },
          price: '$999 / €1,099 / £999 / ₹1,06,999',
          releaseDate: 'Released 2023, October 12',
          colors: ['Obsidian', 'Porcelain', 'Bay']
        }
      };

      const pixelResponse = await axios.post(
        `${API_URL}/api/devices/models`,
        pixel8Pro,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✓ Google Pixel 8 Pro created successfully!');
      console.log(`  Model ID: ${pixelResponse.data.model._id}`);
      console.log(`  Name: ${pixelResponse.data.model.name}`);
      console.log(`  Brand: ${googleBrand.name}`);
      console.log(`  Device Type: ${smartphoneType.name}\n`);
    }

    console.log('=== ✓ All Example Models Created Successfully! ===\n');
    console.log('You can now test the edit functionality with fully populated models.');

  } catch (error) {
    console.error('\n❌ Error creating example models:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCreateExampleModels();
