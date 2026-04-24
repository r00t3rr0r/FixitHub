import React, { useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2 } from "lucide-react"
import { useToast } from "@/hooks/useToast"

export interface DeleteAllConfirmButtonProps {
  /** Human-readable label for what will be deleted, used in dialog text. e.g. "services", "add-on services". */
  resourceLabel: string
  /** Button label. Defaults to "Delete All". */
  buttonLabel?: string
  /** Title shown in the confirmation dialog. */
  dialogTitle?: string
  /**
   * Async function that performs the bulk delete. Receives the password the user entered.
   * Must throw on failure. May return an object with `deletedCount` for the toast message.
   */
  onConfirmDelete: (password: string) => Promise<{ deletedCount?: number } | void>
  /** Called after a successful delete (e.g. to refresh the list). */
  onDeleted?: () => void
  /** Override the button styling. */
  buttonClassName?: string
  /** Override the button size. Defaults to "sm". */
  buttonSize?: "default" | "sm" | "lg" | "icon"
}

/**
 * Destructive "Delete All" button paired with a password-protected confirmation dialog.
 * Shared across admin management pages (services, add-ons, categories, brands, parts).
 */
const DeleteAllConfirmButton: React.FC<DeleteAllConfirmButtonProps> = ({
  resourceLabel,
  buttonLabel = "Delete All",
  dialogTitle,
  onConfirmDelete,
  onDeleted,
  buttonClassName,
  buttonSize = "sm",
}) => {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDeleting(true)
    try {
      const result = await onConfirmDelete(password)
      const count = result && typeof result === "object" ? result.deletedCount : undefined
      toast({
        title: `All ${resourceLabel} deleted`,
        description:
          typeof count === "number"
            ? `Successfully deleted ${count} ${resourceLabel}.`
            : `All ${resourceLabel} were deleted.`,
      })
      setOpen(false)
      setPassword("")
      onDeleted?.()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: err?.message || `Failed to delete ${resourceLabel}`,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size={buttonSize}
        className={buttonClassName}
        onClick={() => {
          setPassword("")
          setOpen(true)
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {buttonLabel}
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (isDeleting) return
          setOpen(next)
          if (!next) setPassword("")
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              {dialogTitle || `Delete ALL ${resourceLabel}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="font-semibold text-red-600">
                  WARNING: This action permanently deletes every {resourceLabel.replace(/s$/, "")} in the
                  database. It cannot be undone.
                </p>
                <p>Enter the admin password below to confirm.</p>
                <Input
                  type="password"
                  placeholder="Admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  disabled={isDeleting}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && password.length > 0 && !isDeleting) {
                      e.preventDefault()
                      ;(document.getElementById(
                        `confirm-delete-all-${resourceLabel.replace(/\s+/g, "-")}-btn`
                      ) as HTMLButtonElement | null)?.click()
                    }
                  }}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              id={`confirm-delete-all-${resourceLabel.replace(/\s+/g, "-")}-btn`}
              disabled={isDeleting || password.length === 0}
              className="bg-red-600 hover:bg-red-700"
              onClick={handleConfirm}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Deleting...
                </>
              ) : (
                `Delete All ${resourceLabel.replace(/^./, (c) => c.toUpperCase())}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default DeleteAllConfirmButton
