import { DeviceModel } from "@/api/devices"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Smartphone,
  Cpu,
  Camera,
  Wifi,
  Battery,
  Zap,
  Speaker,
  Package,
  Check,
  Info,
  Image as ImageIcon
} from "lucide-react"

interface DeviceModelDetailsPanelProps {
  model: DeviceModel | null
  deviceType: string
}

const getDeviceIcon = (deviceType: string) => {
  switch (deviceType.toLowerCase()) {
    case 'smartphone':
      return <Smartphone className="h-5 w-5" />
    case 'tablet':
      return <Smartphone className="h-5 w-5" />
    case 'laptop':
      return <Package className="h-5 w-5" />
    default:
      return <Package className="h-5 w-5" />
  }
}

const SpecificationRow = ({ label, value }: { label: string, value?: string | boolean | null }) => {
  if (!value) return null
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize">
        {label.replace(/([A-Z])/g, ' $1').trim()}:
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right max-w-xs">
        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
      </span>
    </div>
  )
}

export function DeviceModelDetailsPanel({ model, deviceType }: DeviceModelDetailsPanelProps) {
  if (!model) return null

  return (
    <Card className="w-full border-2 border-blue-200 dark:border-blue-800 shadow-lg animate-in zoom-in duration-300">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-3 text-lg md:text-xl mb-1">
              <div className="p-2 bg-blue-500 rounded-lg shadow-md">
                {getDeviceIcon(deviceType)}
              </div>
              <span className="truncate">{model.name}</span>
            </CardTitle>
            <CardDescription className="text-sm">
              Comprehensive device specifications and information
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex-shrink-0">
            <Info className="h-3 w-3 mr-1" />
            Details
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* Prominent Device Image - Full Width */}
        {model.image && (
          <div className="flex justify-center animate-in fade-in duration-500">
            <div className="relative w-full max-w-sm">
              <div className="w-full rounded-2xl overflow-hidden border-4 border-gradient-to-br from-blue-400 to-indigo-400 shadow-xl flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 aspect-square">
                <img
                  src={model.image}
                  alt={model.name}
                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              {/* Device Name Badge on Image */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
                  <p className="font-bold text-sm text-center">{model.name}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Basic Information - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Device Type Card */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl border-2 border-blue-300 dark:border-blue-700 shadow-md">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">Device Type</p>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                {getDeviceIcon(deviceType)}
              </div>
              <Badge className="bg-blue-500 text-white text-sm px-3 py-1">{deviceType}</Badge>
            </div>
          </div>

          {/* Release Date Card */}
          {model.other?.releaseDate && (
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl border-2 border-purple-300 dark:border-purple-700 shadow-md">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-2">Release Date</p>
              <p className="font-bold text-lg text-purple-900 dark:text-purple-100">{model.other.releaseDate}</p>
            </div>
          )}

          {/* Price Card */}
          {model.other?.price && (
            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 rounded-xl border-2 border-green-300 dark:border-green-700 shadow-md">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2">Retail Price</p>
              <p className="font-bold text-lg text-green-900 dark:text-green-100">{model.other.price}</p>
            </div>
          )}

          {/* Colors Card */}
          {model.other?.colors && model.other.colors.length > 0 && (
            <div className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/30 dark:to-pink-900/20 rounded-xl border-2 border-pink-300 dark:border-pink-700 shadow-md md:col-span-2">
              <p className="text-xs font-semibold text-pink-700 dark:text-pink-400 uppercase tracking-wider mb-3">Available Colors</p>
              <div className="flex flex-wrap gap-2">
                {model.other.colors.map((color, idx) => (
                  <Badge key={idx} variant="secondary" className="bg-pink-200 dark:bg-pink-900/50 text-pink-900 dark:text-pink-100 text-sm">
                    {color}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section Divider */}
        <div className="my-6 pt-4 border-t-2 border-gray-300 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Complete Specifications</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Review all detailed device specifications organized by category</p>
        </div>

        {/* Tabbed Specifications */}
        <Tabs defaultValue="display" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <TabsTrigger value="display" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Display</span>
              <span className="sm:hidden">📺</span>
            </TabsTrigger>
            <TabsTrigger value="platform" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Platform</span>
              <span className="sm:hidden">⚙️</span>
            </TabsTrigger>
            <TabsTrigger value="camera" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Camera</span>
              <span className="sm:hidden">📷</span>
            </TabsTrigger>
            <TabsTrigger value="connectivity" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Connect</span>
              <span className="sm:hidden">📡</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="text-xs hidden lg:flex data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">
              Features
            </TabsTrigger>
          </TabsList>

          {/* Display Tab */}
          <TabsContent value="display" className="space-y-4 mt-6">
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl border-2 border-purple-300 dark:border-purple-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-purple-200 dark:border-purple-700">
                <div className="p-2 bg-purple-500 rounded-lg text-white">
                  <Smartphone className="h-5 w-5" />
                </div>
                <span className="text-purple-900 dark:text-purple-100">Display Specifications</span>
              </h4>
              {model.display && Object.values(model.display).some(v => v) ? (
                <div className="space-y-1">
                  <SpecificationRow label="Type" value={model.display.type} />
                  <SpecificationRow label="Size" value={model.display.size} />
                  <SpecificationRow label="Resolution" value={model.display.resolution} />
                  <SpecificationRow label="Protection" value={model.display.protection} />
                  <SpecificationRow label="Features" value={model.display.features} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No display information available</p>
              )}
            </div>

            {/* Physical */}
            <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 rounded-xl border-2 border-yellow-300 dark:border-yellow-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-yellow-200 dark:border-yellow-700">
                <div className="p-2 bg-yellow-500 rounded-lg text-white">
                  <Package className="h-5 w-5" />
                </div>
                <span className="text-yellow-900 dark:text-yellow-100">Physical Properties</span>
              </h4>
              {model.physical && Object.values(model.physical).some(v => v) ? (
                <div className="space-y-1">
                  <SpecificationRow label="Dimensions" value={model.physical.dimensions} />
                  <SpecificationRow label="Weight" value={model.physical.weight} />
                  <SpecificationRow label="Build" value={model.physical.build} />
                  <SpecificationRow label="SIM Type" value={model.physical.simType} />
                  <SpecificationRow label="SIM Count" value={model.physical.simCount} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No physical information available</p>
              )}
            </div>
          </TabsContent>

          {/* Platform & Performance Tab */}
          <TabsContent value="platform" className="space-y-4 mt-6">
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl border-2 border-green-300 dark:border-green-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-green-200 dark:border-green-700">
                <div className="p-2 bg-green-500 rounded-lg text-white">
                  <Cpu className="h-5 w-5" />
                </div>
                <span className="text-green-900 dark:text-green-100">Platform & Performance</span>
              </h4>
              {model.platform && Object.values(model.platform).some(v => v) ? (
                <div className="space-y-1">
                  <SpecificationRow label="OS" value={model.platform.os} />
                  <SpecificationRow label="Chipset" value={model.platform.chipset} />
                  <SpecificationRow label="CPU" value={model.platform.cpu} />
                  <SpecificationRow label="GPU" value={model.platform.gpu} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No platform information available</p>
              )}
            </div>

            {/* Memory */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-xl border-2 border-blue-300 dark:border-blue-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-blue-200 dark:border-blue-700">
                <div className="p-2 bg-blue-500 rounded-lg text-white">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="text-blue-900 dark:text-blue-100">Memory & Storage</span>
              </h4>
              {model.memory ? (
                <div className="space-y-3">
                  {model.memory.internal && model.memory.internal.length > 0 && (
                    <div className="pb-3 border-b border-blue-100 dark:border-blue-900">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">RAM & Storage Variants:</p>
                      <div className="flex flex-wrap gap-2">
                        {model.memory.internal.map((variant, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200">
                            {variant.ram ? `${variant.ram} RAM` : ''}{variant.ram && variant.storage ? ' / ' : ''}{variant.storage ? `${variant.storage} Storage` : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <SpecificationRow label="Card Slot" value={model.memory.cardSlot} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No memory information available</p>
              )}
            </div>

            {/* Battery */}
            <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 rounded-xl border-2 border-red-300 dark:border-red-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-red-200 dark:border-red-700">
                <div className="p-2 bg-red-500 rounded-lg text-white">
                  <Battery className="h-5 w-5" />
                </div>
                <span className="text-red-900 dark:text-red-100">Battery Information</span>
              </h4>
              {model.battery && Object.values(model.battery).some(v => v) ? (
                <div className="space-y-1">
                  <SpecificationRow label="Type" value={model.battery.type} />
                  <SpecificationRow label="Charging" value={model.battery.charging} />
                  <SpecificationRow label="Standby Time" value={model.battery.standbyTime} />
                  <SpecificationRow label="Talk Time" value={model.battery.talkTime} />
                  <SpecificationRow label="Music Play" value={model.battery.musicPlay} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No battery information available</p>
              )}
            </div>
          </TabsContent>

          {/* Camera Tab */}
          <TabsContent value="camera" className="space-y-4 mt-6">
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-indigo-200 dark:border-indigo-700">
                <div className="p-2 bg-indigo-500 rounded-lg text-white">
                  <Camera className="h-5 w-5" />
                </div>
                <span className="text-indigo-900 dark:text-indigo-100">Rear Camera</span>
              </h4>
              {model.rearCamera && Object.values(model.rearCamera).some(v => v) ? (
                <div className="space-y-1">
                  <SpecificationRow label="Modules" value={model.rearCamera.modules} />
                  <SpecificationRow label="Features" value={model.rearCamera.features} />
                  <SpecificationRow label="Video" value={model.rearCamera.video} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No rear camera information available</p>
              )}
            </div>

            <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 rounded-xl border-2 border-pink-300 dark:border-pink-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-pink-200 dark:border-pink-700">
                <div className="p-2 bg-pink-500 rounded-lg text-white">
                  <Camera className="h-5 w-5" />
                </div>
                <span className="text-pink-900 dark:text-pink-100">Front Camera</span>
              </h4>
              {model.frontCamera && Object.values(model.frontCamera).some(v => v) ? (
                <div className="space-y-1">
                  <SpecificationRow label="Modules" value={model.frontCamera.modules} />
                  <SpecificationRow label="Features" value={model.frontCamera.features} />
                  <SpecificationRow label="Video" value={model.frontCamera.video} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No front camera information available</p>
              )}
            </div>
          </TabsContent>

          {/* Connectivity Tab */}
          <TabsContent value="connectivity" className="space-y-4 mt-6">
            <div className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 rounded-xl border-2 border-teal-300 dark:border-teal-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-teal-200 dark:border-teal-700">
                <div className="p-2 bg-teal-500 rounded-lg text-white">
                  <Wifi className="h-5 w-5" />
                </div>
                <span className="text-teal-900 dark:text-teal-100">Network & Connectivity</span>
              </h4>
              {model.network && Object.values(model.network).some(v => v) ? (
                <div className="space-y-1">
                  <SpecificationRow label="2G Technology" value={model.network.technology2G} />
                  <SpecificationRow label="2G Bands" value={model.network.bands2G} />
                  <SpecificationRow label="3G Technology" value={model.network.technology3G} />
                  <SpecificationRow label="3G Bands" value={model.network.bands3G} />
                  <SpecificationRow label="4G Technology" value={model.network.technology4G} />
                  <SpecificationRow label="4G Bands" value={model.network.bands4G} />
                  <SpecificationRow label="5G Technology" value={model.network.technology5G} />
                  <SpecificationRow label="5G Bands" value={model.network.bands5G} />
                  <SpecificationRow label="Speed" value={model.network.speed} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No network information available</p>
              )}
            </div>

            <div className="p-4 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20 rounded-xl border-2 border-sky-300 dark:border-sky-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-sky-200 dark:border-sky-700">
                <div className="p-2 bg-sky-500 rounded-lg text-white">
                  <Wifi className="h-5 w-5" />
                </div>
                <span className="text-sky-900 dark:text-sky-100">Other Connectivity</span>
              </h4>
              {model.connectivity && Object.values(model.connectivity).some(v => v) ? (
                <div className="space-y-1">
                  <SpecificationRow label="WLAN" value={model.connectivity.wlan} />
                  <SpecificationRow label="Bluetooth" value={model.connectivity.bluetooth} />
                  <SpecificationRow label="Positioning" value={model.connectivity.positioning} />
                  <SpecificationRow label="NFC" value={model.connectivity.nfc} />
                  <SpecificationRow label="Radio" value={model.connectivity.radio} />
                  <SpecificationRow label="USB" value={model.connectivity.usb} />
                  <SpecificationRow label="Infrared" value={model.connectivity.infrared} />
                  <SpecificationRow label="Other" value={model.connectivity.other} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No connectivity information available</p>
              )}
            </div>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-4 mt-6">
            <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-xl border-2 border-violet-300 dark:border-violet-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-violet-200 dark:border-violet-700">
                <div className="p-2 bg-violet-500 rounded-lg text-white">
                  <Check className="h-5 w-5" />
                </div>
                <span className="text-violet-900 dark:text-violet-100">Features & Additional Info</span>
              </h4>
              {model.features ? (
                <div className="space-y-3">
                  {model.features.sensors && (
                    <div className="pb-3 border-b border-violet-100 dark:border-violet-900">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Sensors:</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{model.features.sensors}</p>
                    </div>
                  )}
                  {model.features.special && model.features.special.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Special Features:</p>
                      <div className="flex flex-wrap gap-2">
                        {model.features.special.map((feature, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-900 dark:text-violet-200">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No feature information available</p>
              )}
            </div>

            {/* Audio */}
            <div className="p-4 bg-gradient-to-br from-lime-50 to-green-50 dark:from-lime-950/20 dark:to-green-950/20 rounded-xl border-2 border-lime-300 dark:border-lime-700 shadow-md">
              <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-lime-200 dark:border-lime-700">
                <div className="p-2 bg-lime-500 rounded-lg text-white">
                  <Speaker className="h-5 w-5" />
                </div>
                <span className="text-lime-900 dark:text-lime-100">Audio</span>
              </h4>
              {model.audio && Object.values(model.audio).some(v => v) ? (
                <div className="space-y-1">
                  <SpecificationRow label="Loudspeaker" value={model.audio.loudspeaker} />
                  <SpecificationRow label="3.5mm Jack" value={model.audio.jack3_5mm} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No audio information available</p>
              )}
            </div>

            {/* Other Information */}
            {model.other && (
              <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 rounded-xl border-2 border-amber-300 dark:border-amber-700 shadow-md">
                <h4 className="font-bold text-base mb-4 flex items-center gap-3 pb-3 border-b-2 border-amber-200 dark:border-amber-700">
                  <div className="p-2 bg-amber-500 rounded-lg text-white">
                    <Info className="h-5 w-5" />
                  </div>
                  <span className="text-amber-900 dark:text-amber-100">Other Information</span>
                </h4>
                <div className="space-y-3">
                  {model.other.models && model.other.models.length > 0 && (
                    <div className="pb-3 border-b border-amber-100 dark:border-amber-900">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Model Numbers:</p>
                      <div className="flex flex-wrap gap-2">
                        {model.other.models.map((m, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {model.other.sarValues && (model.other.sarValues.head || model.other.sarValues.body) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">SAR Values (W/kg):</p>
                      <div className="text-xs space-y-1 text-gray-900 dark:text-gray-100 font-medium">
                        {model.other.sarValues.head && <p>Head: <span className="font-bold text-amber-600 dark:text-amber-400">{model.other.sarValues.head}</span></p>}
                        {model.other.sarValues.body && <p>Body: <span className="font-bold text-amber-600 dark:text-amber-400">{model.other.sarValues.body}</span></p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Device Images Gallery (if available) */}
        {model.images && model.images.length > 0 && (
          <div className="mt-8 pt-8 border-t-2 border-gray-300 dark:border-gray-700">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-3">
              <div className="p-2 bg-indigo-500 rounded-lg text-white">
                <ImageIcon className="h-5 w-5" />
              </div>
              <span className="text-gray-900 dark:text-gray-100">Device Image Gallery</span>
              <Badge variant="secondary" className="ml-auto text-xs">{model.images.length} Images</Badge>
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {model.images.map((img, idx) => (
                <div key={idx} className="relative group">
                  <div className="w-full h-40 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 shadow-md hover:shadow-lg transition-shadow">
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.caption || `Device image ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : img.base64 ? (
                      <img
                        src={img.base64}
                        alt={img.caption || `Device image ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : null}
                  </div>
                  {img.caption && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center font-medium">{img.caption}</p>
                  )}
                  <Badge variant="secondary" className="absolute top-2 right-2 bg-gray-900/70 dark:bg-gray-100/70 text-white dark:text-gray-900 text-xs">#{idx + 1}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
