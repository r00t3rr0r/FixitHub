const mongoose = require('mongoose');

const deviceModelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceBrand',
    required: true
  },
  deviceType: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  image: {
    type: String,
    default: ''
  },
  commonProblems: [{
    type: String,
    trim: true
  }],
  // Legacy specifications field (kept for backward compatibility)
  specifications: {
    type: Map,
    of: String,
    default: {}
  },
  // Category 1: Device Images
  images: [{
    url: {
      type: String,
      trim: true
    },
    base64: {
      type: String
    },
    caption: {
      type: String,
      trim: true
    }
  }],
  // Category 2: Network Technologies and Bands
  network: {
    technology2G: {
      type: String,
      trim: true
    },
    bands2G: {
      type: String,
      trim: true
    },
    technology3G: {
      type: String,
      trim: true
    },
    bands3G: {
      type: String,
      trim: true
    },
    technology4G: {
      type: String,
      trim: true
    },
    bands4G: {
      type: String,
      trim: true
    },
    technology5G: {
      type: String,
      trim: true
    },
    bands5G: {
      type: String,
      trim: true
    },
    speed: {
      type: String,
      trim: true
    }
  },
  // Category 3: Physical Characteristics
  physical: {
    dimensions: {
      type: String,
      trim: true
    },
    weight: {
      type: String,
      trim: true
    },
    build: {
      type: String,
      trim: true
    },
    simType: {
      type: String,
      trim: true
    },
    simCount: {
      type: String,
      trim: true
    }
  },
  // Category 4: Display Specifications
  display: {
    type: {
      type: String,
      trim: true
    },
    size: {
      type: String,
      trim: true
    },
    resolution: {
      type: String,
      trim: true
    },
    protection: {
      type: String,
      trim: true
    },
    features: {
      type: String,
      trim: true
    }
  },
  // Category 5: Software and Hardware Platform
  platform: {
    os: {
      type: String,
      trim: true
    },
    chipset: {
      type: String,
      trim: true
    },
    cpu: {
      type: String,
      trim: true
    },
    gpu: {
      type: String,
      trim: true
    }
  },
  // Category 6: Storage and Memory Specifications
  memory: {
    internal: [{
      ram: {
        type: String,
        trim: true
      },
      storage: {
        type: String,
        trim: true
      }
    }],
    cardSlot: {
      type: String,
      trim: true
    }
  },
  // Category 7: Rear Camera Specifications
  rearCamera: {
    modules: {
      type: String,
      trim: true
    },
    features: {
      type: String,
      trim: true
    },
    video: {
      type: String,
      trim: true
    }
  },
  // Category 8: Front Camera Specifications
  frontCamera: {
    modules: {
      type: String,
      trim: true
    },
    features: {
      type: String,
      trim: true
    },
    video: {
      type: String,
      trim: true
    }
  },
  // Category 9: Audio Capabilities
  audio: {
    loudspeaker: {
      type: String,
      trim: true
    },
    jack3_5mm: {
      type: String,
      trim: true
    }
  },
  // Category 10: Connectivity Options
  connectivity: {
    wlan: {
      type: String,
      trim: true
    },
    bluetooth: {
      type: String,
      trim: true
    },
    positioning: {
      type: String,
      trim: true
    },
    nfc: {
      type: String,
      trim: true
    },
    radio: {
      type: String,
      trim: true
    },
    usb: {
      type: String,
      trim: true
    },
    infrared: {
      type: String,
      trim: true
    },
    other: {
      type: String,
      trim: true
    }
  },
  // Category 11: Device Features
  features: {
    sensors: {
      type: String,
      trim: true
    },
    special: [{
      type: String,
      trim: true
    }]
  },
  // Category 12: Battery Specifications and Charging Capabilities
  battery: {
    type: {
      type: String,
      trim: true
    },
    charging: {
      type: String,
      trim: true
    },
    standbyTime: {
      type: String,
      trim: true
    },
    talkTime: {
      type: String,
      trim: true
    },
    musicPlay: {
      type: String,
      trim: true
    }
  },
  // Category 13: Other Information
  other: {
    models: [{
      type: String,
      trim: true
    }],
    sarValues: {
      head: {
        type: String,
        trim: true
      },
      body: {
        type: String,
        trim: true
      }
    },
    price: {
      type: String,
      trim: true
    },
    releaseDate: {
      type: String,
      trim: true
    },
    colors: [{
      type: String,
      trim: true
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const deviceBrandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  logo: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const deviceTypeSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamps before saving
deviceModelSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

deviceBrandSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

deviceTypeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
deviceModelSchema.index({ brandId: 1, deviceType: 1 });
deviceModelSchema.index({ name: 1 });
// deviceBrandSchema name already has unique: true index at line 46, no need for duplicate

const DeviceModel = mongoose.model('DeviceModel', deviceModelSchema);
const DeviceBrand = mongoose.model('DeviceBrand', deviceBrandSchema);
const DeviceType = mongoose.model('DeviceType', deviceTypeSchema);

module.exports = {
  DeviceModel,
  DeviceBrand,
  DeviceType
};