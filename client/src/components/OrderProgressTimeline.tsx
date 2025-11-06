import { Check, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"

interface TimelineStage {
  id: string
  label: string
  status: 'completed' | 'in-progress' | 'pending'
  date?: string
  icon: React.ReactNode
}

interface OrderProgressTimelineProps {
  stages: TimelineStage[]
  currentStage: string
}

// Description: Horizontal timeline component showing order progress across key stages
// Displays 5 milestones: Creation → Diagnostic → Repair → Quality Check → Ready/Completed
// Each stage shows icon, label, and completion date if available
export function OrderProgressTimeline({ stages, currentStage }: OrderProgressTimelineProps) {
  return (
    <Card className="bg-white border-0 shadow-none">
      <div className="p-3">
        {/* Timeline Container */}
        <div className="relative">
          {/* Timeline Track */}
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-muted">
            {/* Progress Fill */}
            <div
              className="h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{
                width: `${((stages.findIndex(s => s.id === currentStage) || 0) / (stages.length - 1)) * 100}%`
              }}
            />
          </div>

          {/* Timeline Stages */}
          <div className="flex justify-between relative z-10">
            {stages.map((stage, index) => {
              const isCompleted = stage.status === 'completed'
              const isActive = stage.id === currentStage

              return (
                <div key={stage.id} className="flex flex-col items-center flex-1">
                  {/* Stage Icon Container - Smaller */}
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-1.5 transition-all duration-300 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500'
                        : isActive
                        ? 'bg-blue-500 border-blue-500 ring-2 ring-blue-200'
                        : 'bg-muted border-muted-foreground'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : stage.icon ? (
                      <div className={`${isActive ? 'text-white' : 'text-muted-foreground'}`}>
                        {stage.icon}
                      </div>
                    ) : (
                      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-muted-foreground'}`} />
                    )}
                  </div>

                  {/* Stage Label - Smaller text */}
                  <div className="text-center">
                    <p
                      className={`text-xs font-medium transition-colors duration-300 leading-tight ${
                        isCompleted || isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {stage.label}
                    </p>
                  </div>

                  {/* Stage Date - Only show if completed */}
                  {stage.date && isCompleted && (
                    <div className="text-center mt-0.5">
                      <p className="text-xs text-green-600">
                        {stage.date}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Current Stage Indicator - Compact */}
        <div className="mt-2 pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-blue-500" />
            <span className="text-xs text-muted-foreground">
              Current:{' '}
              <span className="font-medium text-foreground">
                {stages.find(s => s.id === currentStage)?.label || 'Unknown'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
