import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Trash2, Play, Pause, CheckCircle, Clock, AlertCircle } from "lucide-react"

interface WorkflowCardProps {
  workflow: any
  orderId: string
  onDelete: (workflowId: string) => void
  onStart?: (workflowId: string) => void
  onPause?: (workflowId: string) => void
  onResume?: (workflowId: string) => void
  isDeleting?: boolean
}

export function WorkflowCard({
  workflow,
  orderId,
  onDelete,
  onStart,
  onPause,
  onResume,
  isDeleting = false,
}: WorkflowCardProps) {
  const { t } = useTranslation()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Calculate workflow progress
  const totalSteps = workflow.steps?.length || 0
  const completedSteps = workflow.steps?.filter((s: any) => s.status === 'completed').length || 0
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-700 border-green-200'
      case 'in-progress':
        return 'bg-blue-500/10 text-blue-700 border-blue-200'
      case 'on-hold':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200'
      case 'not-started':
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200'
    }
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'in-progress':
        return <AlertCircle className="h-4 w-4" />
      case 'on-hold':
        return <Pause className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  // Get status label
  const getStatusLabel = (status: string) => {
    const statusLabels: { [key: string]: string } = {
      'completed': t('common.completed') || 'Completed',
      'in-progress': t('common.inProgress') || 'In Progress',
      'on-hold': t('common.onHold') || 'On Hold',
      'not-started': t('common.notStarted') || 'Not Started',
    }
    return statusLabels[status] || status
  }

  const handleDelete = () => {
    setShowDeleteConfirm(false)
    onDelete(workflow._id)
  }

  return (
    <>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg">{workflow.workflowName}</CardTitle>
              <CardDescription className="mt-1">
                {totalSteps} {totalSteps === 1 ? 'step' : 'steps'}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={`flex items-center gap-1 ${getStatusBadgeColor(workflow.status)}`}
            >
              {getStatusIcon(workflow.status)}
              <span>{getStatusLabel(workflow.status)}</span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Progress: {completedSteps}/{totalSteps} steps
              </span>
              <span className="font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Time Estimate */}
          {workflow.estimatedCompletionTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Estimated time: {Math.round(workflow.estimatedCompletionTime)} minutes
              </span>
            </div>
          )}

          {/* Steps Overview */}
          {workflow.steps && workflow.steps.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Steps:</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {workflow.steps.map((step: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50"
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${
                        step.status === 'completed'
                          ? 'bg-green-500'
                          : step.status === 'in-progress'
                            ? 'bg-blue-500'
                            : step.status === 'skipped'
                              ? 'bg-gray-400'
                              : 'bg-gray-300'
                      }`}
                    />
                    <span className="flex-1">{step.stepName}</span>
                    <span className="text-xs text-muted-foreground">
                      {step.status === 'completed' && '✓'}
                      {step.status === 'in-progress' && '⟳'}
                      {step.status === 'skipped' && '⊘'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            {workflow.status === 'not-started' && onStart && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStart(workflow._id)}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            )}

            {workflow.status === 'in-progress' && onPause && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPause(workflow._id)}
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}

            {workflow.status === 'on-hold' && onResume && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResume(workflow._id)}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the workflow "{workflow.workflowName}" from this
              order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
