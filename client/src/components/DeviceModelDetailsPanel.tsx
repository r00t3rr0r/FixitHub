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

      <CardContent className="pt-4">
        {/* Device Image */}
        {model.image && (
          <div className="mb-6 flex justify-center">
            <div className="w-48 h-48 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center bg-gray-100 dark:bg-gray-900">
              <img
                src={model.image}
                alt={model.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
            Basic Information
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Device Type:</span>
              <Badge variant="outline">{deviceType}</Badge>
            </div>
            {model.other?.releaseDate && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Release Date:</span>
                <span className="font-medium">{model.other.releaseDate}</span>
              </div>
            )}
            {model.other?.price && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Price:</span>
                <span className="font-medium">{model.other.price}</span>
              </div>
            )}
            {model.other?.colors && model.other.colors.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Available Colors:</span>
                <div className="flex gap-1">
                  {model.other.colors.map((color, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {color}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabbed Specifications */}
        <Tabs defaultValue="display" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
            <TabsTrigger value="display" className="text-xs">Display</TabsTrigger>
            <TabsTrigger value="platform" className="text-xs">Platform</TabsTrigger>
            <TabsTrigger value="camera" className="text-xs">Camera</TabsTrigger>
            <TabsTrigger value="connectivity" className="text-xs">Connect</TabsTrigger>
            <TabsTrigger value="features" className="text-xs hidden lg:block">Features</TabsTrigger>
          </TabsList>

          {/* Display Tab */}
          <TabsContent value="display" className="space-y-4 mt-4">
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-purple-600" />
                Display
              </h4>
              {model.display && Object.values(model.display).some(v => v) ? (
                <div className="space-y-2">
                  <SpecificationRow label="Type" value={model.display.type} />
                  <SpecificationRow label="Size" value={model.display.size} />
                  <SpecificationRow label="Resolution" value={model.display.resolution} />
                  <SpecificationRow label="Protection" value={model.display.protection} />
                  <SpecificationRow label="Features" value={model.display.features} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No display information available</p>
              )}
            </div>

            {/* Physical */}
            <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-yellow-600" />
                Physical
              </h4>
              {model.physical && Object.values(model.physical).some(v => v) ? (
                <div className="space-y-2">
                  <SpecificationRow label="Dimensions" value={model.physical.dimensions} />
                  <SpecificationRow label="Weight" value={model.physical.weight} />
                  <SpecificationRow label="Build" value={model.physical.build} />
                  <SpecificationRow label="SIM Type" value={model.physical.simType} />
                  <SpecificationRow label="SIM Count" value={model.physical.simCount} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No physical information available</p>
              )}
            </div>
          </TabsContent>

          {/* Platform & Performance Tab */}
          <TabsContent value="platform" className="space-y-4 mt-4">
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-green-600" />
                Platform & Performance
              </h4>
              {model.platform && Object.values(model.platform).some(v => v) ? (
                <div className="space-y-2">
                  <SpecificationRow label="OS" value={model.platform.os} />
                  <SpecificationRow label="Chipset" value={model.platform.chipset} />
                  <SpecificationRow label="CPU" value={model.platform.cpu} />
                  <SpecificationRow label="GPU" value={model.platform.gpu} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No platform information available</p>
              )}
            </div>

            {/* Memory */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                Memory & Storage
              </h4>
              {model.memory ? (
                <div className="space-y-2">
                  {model.memory.internal && model.memory.internal.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">RAM & Storage Variants:</p>
                      <div className="flex flex-wrap gap-2">
                        {model.memory.internal.map((variant, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/30">
                            {variant.ram ? `${variant.ram} RAM` : ''}{variant.ram && variant.storage ? ' / ' : ''}{variant.storage ? `${variant.storage} Storage` : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <SpecificationRow label="Card Slot" value={model.memory.cardSlot} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No memory information available</p>
              )}
            </div>

            {/* Battery */}
            <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Battery className="h-4 w-4 text-red-600" />
                Battery
              </h4>
              {model.battery && Object.values(model.battery).some(v => v) ? (
                <div className="space-y-2">
                  <SpecificationRow label="Type" value={model.battery.type} />
                  <SpecificationRow label="Charging" value={model.battery.charging} />
                  <SpecificationRow label="Standby Time" value={model.battery.standbyTime} />
                  <SpecificationRow label="Talk Time" value={model.battery.talkTime} />
                  <SpecificationRow label="Music Play" value={model.battery.musicPlay} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No battery information available</p>
              )}
            </div>
          </TabsContent>

          {/* Camera Tab */}
          <TabsContent value="camera" className="space-y-4 mt-4">
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4 text-indigo-600" />
                Rear Camera
              </h4>
              {model.rearCamera && Object.values(model.rearCamera).some(v => v) ? (
                <div className="space-y-2">
                  <SpecificationRow label="Modules" value={model.rearCamera.modules} />
                  <SpecificationRow label="Features" value={model.rearCamera.features} />
                  <SpecificationRow label="Video" value={model.rearCamera.video} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No rear camera information available</p>
              )}
            </div>

            <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 rounded-lg border border-pink-200 dark:border-pink-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4 text-pink-600" />
                Front Camera
              </h4>
              {model.frontCamera && Object.values(model.frontCamera).some(v => v) ? (
                <div className="space-y-2">
                  <SpecificationRow label="Modules" value={model.frontCamera.modules} />
                  <SpecificationRow label="Features" value={model.frontCamera.features} />
                  <SpecificationRow label="Video" value={model.frontCamera.video} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No front camera information available</p>
              )}
            </div>
          </TabsContent>

          {/* Connectivity Tab */}
          <TabsContent value="connectivity" className="space-y-4 mt-4">
            <div className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 rounded-lg border border-teal-200 dark:border-teal-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Wifi className="h-4 w-4 text-teal-600" />
                Network & Connectivity
              </h4>
              {model.network && Object.values(model.network).some(v => v) ? (
                <div className="space-y-2">
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
                <p className="text-xs text-gray-500 dark:text-gray-400">No network information available</p>
              )}
            </div>

            <div className="p-4 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20 rounded-lg border border-sky-200 dark:border-sky-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Wifi className="h-4 w-4 text-sky-600" />
                Other Connectivity
              </h4>
              {model.connectivity && Object.values(model.connectivity).some(v => v) ? (
                <div className="space-y-2">
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
                <p className="text-xs text-gray-500 dark:text-gray-400">No connectivity information available</p>
              )}
            </div>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-4 mt-4">
            <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-lg border border-violet-200 dark:border-violet-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-violet-600" />
                Features & Additional Info
              </h4>
              {model.features ? (
                <div className="space-y-3">
                  {model.features.sensors && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Sensors:</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{model.features.sensors}</p>
                    </div>
                  )}
                  {model.features.special && model.features.special.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Special Features:</p>
                      <div className="flex flex-wrap gap-2">
                        {model.features.special.map((feature, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No feature information available</p>
              )}
            </div>

            {/* Audio */}
            <div className="p-4 bg-gradient-to-br from-lime-50 to-green-50 dark:from-lime-950/20 dark:to-green-950/20 rounded-lg border border-lime-200 dark:border-lime-800">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Speaker className="h-4 w-4 text-lime-600" />
                Audio
              </h4>
              {model.audio && Object.values(model.audio).some(v => v) ? (
                <div className="space-y-2">
                  <SpecificationRow label="Loudspeaker" value={model.audio.loudspeaker} />
                  <SpecificationRow label="3.5mm Jack" value={model.audio.jack3_5mm} />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">No audio information available</p>
              )}
            </div>

            {/* Other Information */}
            {model.other && (
              <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-600" />
                  Other Information
                </h4>
                <div className="space-y-2">
                  {model.other.models && model.other.models.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Model Numbers:</p>
                      <div className="flex flex-wrap gap-1">
                        {model.other.models.map((m, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {model.other.sarValues && (model.other.sarValues.head || model.other.sarValues.body) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">SAR Values (W/kg):</p>
                      <div className="text-xs space-y-1">
                        {model.other.sarValues.head && <p>Head: {model.other.sarValues.head}</p>}
                        {model.other.sarValues.body && <p>Body: {model.other.sarValues.body}</p>}
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
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Additional Images
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {model.images.map((img, idx) => (
                <div key={idx} className="relative group">
                  <div className="w-full h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.caption || `Device image ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : img.base64 ? (
                      <img
                        src={img.base64}
                        alt={img.caption || `Device image ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : null}
                  </div>
                  {img.caption && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-center">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
