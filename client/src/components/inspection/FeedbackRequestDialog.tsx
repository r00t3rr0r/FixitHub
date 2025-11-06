import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface FeedbackRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionType: string
  onSubmit: (message: string) => void
  isLoading?: boolean
}

export function FeedbackRequestDialog({
  open,
  onOpenChange,
  actionType,
  onSubmit,
  isLoading = false,
}: FeedbackRequestDialogProps) {
  const [message, setMessage] = useState("")

  const getDefaultMessage = () => {
    const messages: { [key: string]: string } = {
      part_replacement: "This device requires a part replacement. Please confirm if you would like to proceed with the repair.",
      incorrect_device: "We noticed that the device specification might be incorrect. Could you please verify the device details?",
      incorrect_unlock_code: "The unlock code provided does not match the device. Please confirm or provide the correct code.",
      additional_costs: "We found additional issues that will increase the repair cost. Do you approve these additional charges?",
    }
    return messages[actionType] || ""
  }

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit(message.trim())
      setMessage("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Update to Customer</DialogTitle>
          <DialogDescription>
            Send a message about {actionType.replace(/_/g, " ").toLowerCase()} to the customer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              defaultValue={getDefaultMessage()}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !message.trim()}>
            {isLoading ? "Sending..." : "Send Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
