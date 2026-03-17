import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download, X } from "lucide-react"
import { useToast } from "@/hooks/useToast"
import jsPDF from "jspdf"

interface WorkflowReportModalProps {
  isOpen: boolean
  onClose: () => void
  workflow: any
  orderId: string
}

export function WorkflowReportModal({
  isOpen,
  onClose,
  workflow,
  orderId,
}: WorkflowReportModalProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in-progress":
        return "bg-blue-100 text-blue-800"
      case "skipped":
        return "bg-gray-100 text-gray-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "N/A"
    const dateObj = typeof date === "string" ? new Date(date) : date
    return dateObj.toLocaleString()
  }

  const formatValue = (value: any): string => {
    if (Array.isArray(value)) {
      return value.join(", ")
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No"
    }
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value, null, 2)
    }
    return String(value || "-")
  }

  const generatePDF = async () => {
    try {
      setIsGeneratingPDF(true)

      const pdf = new jsPDF()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 15
      const contentWidth = pageWidth - 2 * margin
      let yPosition = margin

      // Helper function to add text with word wrap
      const addText = (text: string, size: number, weight: "bold" | "normal" = "normal", color = [0, 0, 0]) => {
        pdf.setFontSize(size)
        pdf.setTextColor(...color)
        if (weight === "bold") {
          pdf.setFont(undefined, "bold")
        } else {
          pdf.setFont(undefined, "normal")
        }
        const lines = pdf.splitTextToSize(text, contentWidth)
        pdf.text(lines, margin, yPosition)
        yPosition += lines.length * 7 + 2
      }

      const addLine = () => {
        yPosition += 2
        pdf.setDrawColor(200, 200, 200)
        pdf.line(margin, yPosition, pageWidth - margin, yPosition)
        yPosition += 2
      }

      // Check page space
      const checkPageSpace = (space: number) => {
        if (yPosition + space > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
        }
      }

      // Title
      addText(`Workflow Execution Report`, 16, "bold", [0, 51, 102])
      addLine()

      // Summary Section
      addText("Summary", 12, "bold", [0, 51, 102])
      addText(`Workflow: ${workflow.workflowName}`, 10)
      addText(`Order ID: ${orderId}`, 10)
      addText(`Status: ${workflow.status || "N/A"}`, 10)
      addText(`Started: ${formatDate(workflow.startedAt)}`, 10)
      addText(`Completed: ${formatDate(workflow.completedAt)}`, 10)

      if (workflow.steps && workflow.steps.length > 0) {
        const completedSteps = workflow.steps.filter((s: any) => s.status === "completed").length
        addText(`Progress: ${completedSteps}/${workflow.steps.length} steps completed`, 10)
      }

      addLine()

      // Steps Section
      if (workflow.steps && workflow.steps.length > 0) {
        addText("Workflow Steps", 12, "bold", [0, 51, 102])

        workflow.steps.forEach((step: any, index: number) => {
          checkPageSpace(30)

          // Step header
          addText(`Step ${index + 1}: ${step.stepName}`, 11, "bold", [51, 51, 51])
          addText(`Status: ${step.status || "pending"}`, 10)

          if (step.assignedStaffId) {
            addText(`Assigned Staff: ${step.staffName || "N/A"}`, 10)
          }

          if (step.startedAt) {
            addText(`Started: ${formatDate(step.startedAt)}`, 10)
          }

          if (step.completedAt) {
            addText(`Completed: ${formatDate(step.completedAt)}`, 10)
          }

          // Form Data
          if (step.formData && Object.keys(step.formData).length > 0) {
            checkPageSpace(15)
            addText("Form Data:", 10, "bold")
            Object.entries(step.formData).forEach(([key, value]) => {
              checkPageSpace(5)
              const formattedValue = formatValue(value)
              addText(`  ${key}: ${formattedValue}`, 9)
            })
          }

          // Checklist Data
          if (step.checklistData && Object.keys(step.checklistData).length > 0) {
            checkPageSpace(15)
            addText("Checklist Items:", 10, "bold")
            Object.entries(step.checklistData).forEach(([key, value]) => {
              checkPageSpace(5)
              const status = value ? "✓ Completed" : "✗ Not completed"
              addText(`  ${key}: ${status}`, 9)
            })
          }

          // Notes
          if (step.notes) {
            checkPageSpace(10)
            addText("Notes:", 10, "bold")
            const noteLines = pdf.splitTextToSize(step.notes, contentWidth - 10)
            pdf.setFontSize(9)
            pdf.text(noteLines, margin + 5, yPosition)
            yPosition += noteLines.length * 5 + 3
          }

          addLine()
        })
      }

      // Footer
      yPosition = pageHeight - margin - 10
      pdf.setFontSize(8)
      pdf.setTextColor(150, 150, 150)
      pdf.text(
        `Report generated on ${new Date().toLocaleString()}`,
        margin,
        yPosition
      )

      // Save PDF
      pdf.save(`workflow-report-${workflow.workflowName}-${new Date().getTime()}.pdf`)
      showToast("PDF downloaded successfully", "success")
    } catch (error) {
      console.error("Error generating PDF:", error)
      showToast("Failed to generate PDF", "error")
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workflow Execution Report</DialogTitle>
          <DialogDescription>
            Detailed report of all workflow step execution data and collected information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Workflow</p>
                  <p className="text-base font-semibold">{workflow.workflowName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <Badge className={getStatusColor(workflow.status)}>
                    {workflow.status || "N/A"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Started</p>
                  <p className="text-sm">{formatDate(workflow.startedAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                  <p className="text-sm">{formatDate(workflow.completedAt)}</p>
                </div>
              </div>
              {workflow.steps && workflow.steps.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium text-gray-500">Progress</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${
                            (workflow.steps.filter((s: any) => s.status === "completed")
                              .length / workflow.steps.length) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold">
                      {workflow.steps.filter((s: any) => s.status === "completed").length}/
                      {workflow.steps.length}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Steps Section */}
          {workflow.steps && workflow.steps.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Workflow Steps</h3>
              {workflow.steps.map((step: any, index: number) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          Step {index + 1}: {step.stepName}
                        </CardTitle>
                        <CardDescription>
                          {step.assignedStaffId && `Assigned to: ${step.staffName || "Unknown"}`}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(step.status)}>
                        {step.status || "pending"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Timeline */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500">Started</p>
                        <p className="text-sm">{formatDate(step.startedAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">Completed</p>
                        <p className="text-sm">{formatDate(step.completedAt)}</p>
                      </div>
                    </div>

                    {/* Form Data */}
                    {step.formData && Object.keys(step.formData).length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Form Data</p>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          {Object.entries(step.formData).map(([key, value], idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium text-gray-700">{key}:</span>
                              <span className="text-gray-600 ml-2">{formatValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Checklist Data */}
                    {step.checklistData && Object.keys(step.checklistData).length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Checklist Items</p>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          {Object.entries(step.checklistData).map(([key, value], idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              {value ? (
                                <span className="text-green-600 font-bold">✓</span>
                              ) : (
                                <span className="text-red-600 font-bold">✗</span>
                              )}
                              <span className="text-gray-700">{key}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {step.notes && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Notes</p>
                        <div className="bg-white rounded-lg p-3 text-sm text-gray-700 border border-gray-200 shadow-sm">
                          {step.notes}
                        </div>
                      </div>
                    )}

                    {/* Photos */}
                    {step.photos && step.photos.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Photos</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {step.photos.map((photo: string, idx: number) => (
                            <div key={idx} className="relative bg-gray-100 rounded-lg overflow-hidden">
                              <img
                                src={photo}
                                alt={`Step ${index + 1} photo ${idx + 1}`}
                                className="w-full h-24 object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {(!workflow.steps || workflow.steps.length === 0) && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No workflow steps data available</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {isGeneratingPDF ? "Generating..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
