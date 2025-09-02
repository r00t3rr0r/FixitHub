import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { X } from "lucide-react"
import { useToast } from "@/hooks/useToast"
import { createTeam, getStaffMembers, StaffMember } from "@/api/staff"

interface CreateTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTeamCreated: () => void
}

export function CreateTeamDialog({ open, onOpenChange, onTeamCreated }: CreateTeamDialogProps) {
  const [loading, setLoading] = useState(false)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaderId: '',
    department: 'Technical',
    specializations: [] as string[],
    permissions: [] as string[],
    members: [] as { userId: string; role: string }[]
  })
  const [newSpecialization, setNewSpecialization] = useState('')
  const [newPermission, setNewPermission] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchStaffMembers()
    }
  }, [open])

  const fetchStaffMembers = async () => {
    try {
      const response = await getStaffMembers()
      setStaffMembers(response.staff || [])
    } catch (error) {
      console.error('Error fetching staff members:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.name || !formData.leaderId) {
        throw new Error('Team name and leader are required')
      }

      await createTeam(formData)

      toast({
        title: "Success",
        description: "Team created successfully"
      })

      onTeamCreated()
      onOpenChange(false)

      // Reset form
      setFormData({
        name: '',
        description: '',
        leaderId: '',
        department: 'Technical',
        specializations: [],
        permissions: [],
        members: []
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const addSpecialization = () => {
    if (newSpecialization.trim() && !formData.specializations.includes(newSpecialization.trim())) {
      setFormData(prev => ({
        ...prev,
        specializations: [...prev.specializations, newSpecialization.trim()]
      }))
      setNewSpecialization('')
    }
  }

  const removeSpecialization = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.filter(s => s !== spec)
    }))
  }

  const addPermission = () => {
    if (newPermission.trim() && !formData.permissions.includes(newPermission.trim())) {
      setFormData(prev => ({
        ...prev,
        permissions: [...prev.permissions, newPermission.trim()]
      }))
      setNewPermission('')
    }
  }

  const removePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.filter(p => p !== perm)
    }))
  }

  const toggleMember = (userId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        members: [...prev.members, { userId, role: 'member' }]
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        members: prev.members.filter(m => m.userId !== userId)
      }))
    }
  }

  const updateMemberRole = (userId: string, role: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map(m => 
        m.userId === userId ? { ...m, role } : m
      )
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Create a new team and assign members with their roles and permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter team name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technical">Technical</SelectItem>
                  <SelectItem value="Customer Service">Customer Service</SelectItem>
                  <SelectItem value="Management">Management</SelectItem>
                  <SelectItem value="Quality Assurance">Quality Assurance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter team description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="leaderId">Team Leader *</Label>
            <Select
              value={formData.leaderId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, leaderId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team leader" />
              </SelectTrigger>
              <SelectContent>
                {staffMembers.map((staff) => (
                  <SelectItem key={staff._id} value={staff._id}>
                    {staff.name} - {staff.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Specializations</Label>
            <div className="flex gap-2">
              <Input
                value={newSpecialization}
                onChange={(e) => setNewSpecialization(e.target.value)}
                placeholder="Add specialization"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
              />
              <Button type="button" onClick={addSpecialization} variant="outline">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.specializations.map((spec) => (
                <Badge key={spec} variant="secondary" className="flex items-center gap-1">
                  {spec}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeSpecialization(spec)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="flex gap-2">
              <Input
                value={newPermission}
                onChange={(e) => setNewPermission(e.target.value)}
                placeholder="Add permission"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPermission())}
              />
              <Button type="button" onClick={addPermission} variant="outline">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.permissions.map((perm) => (
                <Badge key={perm} variant="secondary" className="flex items-center gap-1">
                  {perm}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removePermission(perm)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Team Members</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-4 space-y-3">
              {staffMembers.map((staff) => {
                const isSelected = formData.members.some(m => m.userId === staff._id)
                const memberData = formData.members.find(m => m.userId === staff._id)
                
                return (
                  <div key={staff._id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={staff._id}
                        checked={isSelected}
                        onCheckedChange={(checked) => toggleMember(staff._id, checked as boolean)}
                      />
                      <Label htmlFor={staff._id} className="flex-1">
                        {staff.name} - {staff.email}
                      </Label>
                    </div>
                    {isSelected && (
                      <Select
                        value={memberData?.role || 'member'}
                        onValueChange={(value) => updateMemberRole(staff._id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}