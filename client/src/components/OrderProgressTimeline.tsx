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
      <div className="p-6">
        {/* Timeline Container */}
        <div className="relative">
          {/* Timeline Track */}
          <div className="absolute top-6 left-0 right-0 h-1 bg-muted">
            {/* Progress Fill */}
            <div
              className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
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
                  {/* Stage Icon Container */}
                  <div
                    className={`w-12 h-12 rounded-full border-4 flex items-center justify-center mb-3 transition-all duration-300 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500'
                        : isActive
                        ? 'bg-blue-500 border-blue-500 ring-4 ring-blue-200'
                        : 'bg-muted border-muted-foreground'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-6 w-6 text-white" />
                    ) : stage.icon ? (
                      <div className={isActive ? 'text-white' : 'text-muted-foreground'}>
                        {stage.icon}
                      </div>
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-muted-foreground'}`} />
                    )}
                  </div>

                  {/* Stage Label */}
                  <div className="text-center mb-2">
                    <p
                      className={`text-sm font-medium transition-colors duration-300 ${
                        isCompleted || isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {stage.label}
                    </p>
                  </div>

                  {/* Stage Date */}
                  {stage.date && (
                    <div className="text-center">
                      <p className={`text-xs ${isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {stage.date}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Current Stage Indicator */}
        <div className="mt-8 pt-6 border-t">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">
              Current Stage:{' '}
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
