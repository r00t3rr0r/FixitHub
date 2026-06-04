import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import DeleteAllConfirmButton from '@/components/admin/DeleteAllConfirmButton';
import { useToast } from '@/hooks/useToast';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Power,
  PowerOff,
  BarChart3,
  Package,
  Wrench,
} from 'lucide-react';
import {
  getServiceCategories,
  getCategoryStatistics,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  deleteAllServiceCategories,
  activateCategory,
  deactivateCategory,
  ServiceCategory,
  CategoryStatistics,
  CreateCategoryData,
  UpdateCategoryData,
} from '@/api/serviceCategories';

export default function ServiceCategoryManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [statistics, setStatistics] = useState<CategoryStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [migrateFromName, setMigrateFromName] = useState('');

  // Form states
  const [formData, setFormData] = useState<CreateCategoryData>({
    name: '',
    description: '',
    type: 'repair',
    icon: '',
    color: '#3b82f6',
    order: 0,
  });

  useEffect(() => {
    fetchCategories();
    fetchStatistics();
  }, [typeFilter, statusFilter]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const filters: any = {};

      if (typeFilter !== 'all') {
        filters.type = typeFilter;
      }

      if (statusFilter !== 'all') {
        filters.isActive = statusFilter === 'active';
      }

      const response = await getServiceCategories(filters);
      setCategories(response.categories);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch categories',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await getCategoryStatistics();
      setStatistics(response.statistics);
    } catch (error: any) {
      console.error('Error fetching statistics:', error);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const response = await createServiceCategory(formData);
      toast({
        title: 'Success',
        description: response.message || 'Category created successfully',
      });
      setShowCreateDialog(false);
      resetForm();
      fetchCategories();
      fetchStatistics();
    } catch (error: any) {
      console.error('Error creating category:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create category',
      });
    }
  };

  const handleUpdateCategory = async () => {
    if (!selectedCategory) return;

    try {
      const updateData: UpdateCategoryData = {
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        color: formData.color,
        order: formData.order,
        ...(migrateFromName.trim() ? { migrateFromName: migrateFromName.trim() } : {}),
      };

      const response = await updateServiceCategory(selectedCategory._id, updateData);
      toast({
        title: 'Success',
        description: response.message || 'Category updated successfully',
      });
      setShowEditDialog(false);
      setSelectedCategory(null);
      resetForm();
      fetchCategories();
      fetchStatistics();
    } catch (error: any) {
      console.error('Error updating category:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update category',
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;

    try {
      const response = await deleteServiceCategory(selectedCategory._id);
      toast({
        title: 'Success',
        description: response.message || 'Category deleted successfully',
      });
      setShowDeleteDialog(false);
      setSelectedCategory(null);
      fetchCategories();
      fetchStatistics();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete category',
      });
    }
  };

  const handleToggleStatus = async (category: ServiceCategory) => {
    try {
      const response = category.isActive
        ? await deactivateCategory(category._id)
        : await activateCategory(category._id);

      toast({
        title: 'Success',
        description: response.message || `Category ${category.isActive ? 'deactivated' : 'activated'} successfully`,
      });
      fetchCategories();
      fetchStatistics();
    } catch (error: any) {
      console.error('Error toggling category status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update category status',
      });
    }
  };

  const openEditDialog = (category: ServiceCategory) => {
    setSelectedCategory(category);
    setMigrateFromName('');
    setFormData({
      name: category.name,
      description: category.description,
      type: category.type,
      icon: category.icon,
      color: category.color,
      order: category.order,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (category: ServiceCategory) => {
    setSelectedCategory(category);
    setShowDeleteDialog(true);
  };

  const resetForm = () => {
    setMigrateFromName('');
    setFormData({
      name: '',
      description: '',
      type: 'repair',
      icon: '',
      color: '#3b82f6',
      order: 0,
    });
  };

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatForCategory = (categoryId: string) => {
    return statistics.find((stat) => stat._id === categoryId);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl px-5 py-4 text-white shadow-sm" style={{ background: '#1a2a5e' }}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Category Management</h1>
          <p className="mt-1 text-sm text-blue-100">
            Manage dynamic service categories for repair and add-on services
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DeleteAllConfirmButton
            resourceLabel="service categories"
            onConfirmDelete={(password) => deleteAllServiceCategories(password)}
            onDeleted={fetchCategories}
          />
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="secondary"
            className="border-0 bg-white text-blue-700 hover:bg-blue-50"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">
              Across all types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repair Categories</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categories.filter((c) => c.type === 'repair').length}
            </div>
            <p className="text-xs text-muted-foreground">
              For repair services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Add-on Categories</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categories.filter((c) => c.type === 'addon').length}
            </div>
            <p className="text-xs text-muted-foreground">
              For add-on services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Categories</CardTitle>
            <Power className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categories.filter((c) => c.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="addon">Add-on</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            View and manage your service categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading categories...</div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No categories found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => {
                  const stat = getStatForCategory(category._id);
                  return (
                    <TableRow key={category._id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {category.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant={category.type === 'repair' ? 'default' : 'secondary'}>
                          {category.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <BarChart3 className="h-3 w-3 mr-1" />
                          {stat?.serviceCount || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full border"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {category.color}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{category.order}</TableCell>
                      <TableCell>
                        <Badge variant={category.isActive ? 'default' : 'secondary'}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(category)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(category)}
                          >
                            {category.isActive ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(category)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Category Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 [&>button]:right-3 [&>button]:top-3 [&>button]:text-white [&>button]:hover:bg-white/15 [&>button]:hover:text-white">
          <DialogHeader className="space-y-0.5 px-4 py-3 text-left sm:text-left" style={{ background: '#1a2a5e' }}>
            <DialogTitle className="text-sm font-semibold text-white">Create New Category</DialogTitle>
            <DialogDescription className="text-xs text-blue-100">
              Add a new service category for repair or add-on services
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 p-3">
            <div>
              <Label htmlFor="name" className="mb-1 block text-xs font-medium">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Category name"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="description" className="mb-1 block text-xs font-medium">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Category description"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="type" className="mb-1 block text-xs font-medium">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'repair' | 'addon') =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repair" className="text-xs">Repair</SelectItem>
                  <SelectItem value="addon" className="text-xs">Add-on</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="icon" className="mb-1 block text-xs font-medium">Icon Name (Lucide)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="e.g., Monitor, Battery"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="color" className="mb-1 block text-xs font-medium">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-8 w-14 p-1"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#3b82f6"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="order" className="mb-1 block text-xs font-medium">Order</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) =>
                  setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                }
                placeholder="Display order"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="border-t bg-slate-50 px-3 py-2 sm:justify-end sm:space-x-1.5">
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 px-3 text-xs" onClick={handleCreateCategory}>Create Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 [&>button]:right-3 [&>button]:top-3 [&>button]:text-white [&>button]:hover:bg-white/15 [&>button]:hover:text-white">
          <DialogHeader className="space-y-0.5 px-4 py-3 text-left sm:text-left" style={{ background: '#1a2a5e' }}>
            <DialogTitle className="text-sm font-semibold text-white">Edit Category</DialogTitle>
            <DialogDescription className="text-xs text-blue-100">
              Update the category information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 p-3">
            <div>
              <Label htmlFor="edit-name" className="mb-1 block text-xs font-medium">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Category name"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="edit-description" className="mb-1 block text-xs font-medium">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Category description"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="edit-icon" className="mb-1 block text-xs font-medium">Icon Name (Lucide)</Label>
              <Input
                id="edit-icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="e.g., Monitor, Battery"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="edit-color" className="mb-1 block text-xs font-medium">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-8 w-14 p-1"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#3b82f6"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-order" className="mb-1 block text-xs font-medium">Order</Label>
              <Input
                id="edit-order"
                type="number"
                value={formData.order}
                onChange={(e) =>
                  setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                }
                placeholder="Display order"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="edit-migrate-from" className="mb-1 block text-xs font-medium">
                Dienste migrieren von (optional)
              </Label>
              <Input
                id="edit-migrate-from"
                value={migrateFromName}
                onChange={(e) => setMigrateFromName(e.target.value)}
                placeholder="Alter Kategoriename, z.B. Emergency"
                className="h-8 text-xs"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Nur nötig wenn Dienste noch den alten Kategorienamen verwenden.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t bg-slate-50 px-3 py-2 sm:justify-end sm:space-x-1.5">
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 px-3 text-xs" onClick={handleUpdateCategory}>Update Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedCategory?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategory}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
