import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getLanguages,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  setDefaultLanguage,
  Language
} from '@/api/languages';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { Plus, Edit, Trash2, Star, Check } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function LanguageManagementTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  const [languageToDelete, setLanguageToDelete] = useState<Language | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    nativeName: '',
    direction: 'ltr' as 'ltr' | 'rtl',
    isActive: true,
  });

  useEffect(() => {
    fetchLanguages();
  }, []);

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const response = await getLanguages();
      setLanguages(response.languages);
    } catch (error: any) {
      console.error('Error fetching languages:', error);
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (language?: Language) => {
    if (language) {
      setEditingLanguage(language);
      setFormData({
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
        direction: language.direction,
        isActive: language.isActive,
      });
    } else {
      setEditingLanguage(null);
      setFormData({
        code: '',
        name: '',
        nativeName: '',
        direction: 'ltr',
        isActive: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLanguage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingLanguage) {
        await updateLanguage(editingLanguage.code, formData);
        toast({
          title: t('toast.success.updated'),
          description: 'Language updated successfully',
        });
      } else {
        await createLanguage(formData);
        toast({
          title: t('toast.success.created'),
          description: 'Language created successfully',
        });
      }

      handleCloseDialog();
      fetchLanguages();
    } catch (error: any) {
      console.error('Error saving language:', error);
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (code: string) => {
    try {
      await setDefaultLanguage(code);
      toast({
        title: t('toast.success.updated'),
        description: 'Default language updated successfully',
      });
      fetchLanguages();
    } catch (error: any) {
      console.error('Error setting default language:', error);
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLanguage = async () => {
    if (!languageToDelete) return;

    try {
      await deleteLanguage(languageToDelete.code);
      toast({
        title: t('toast.success.deleted'),
        description: 'Language deleted successfully',
      });
      setDeleteDialogOpen(false);
      setLanguageToDelete(null);
      fetchLanguages();
    } catch (error: any) {
      console.error('Error deleting language:', error);
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">{t('admin.languageManagement.title')}</h3>
          <p className="text-sm text-muted-foreground">
            Manage system languages and translations
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.languageManagement.addLanguage')}
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Native Name</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="text-right">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {languages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No languages found
                </TableCell>
              </TableRow>
            ) : (
              languages.map((language) => (
                <TableRow key={language._id}>
                  <TableCell className="font-mono">{language.code}</TableCell>
                  <TableCell>{language.name}</TableCell>
                  <TableCell>{language.nativeName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{language.direction.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    {language.isActive ? (
                      <Badge variant="default">
                        <Check className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {language.isDefault ? (
                      <Badge variant="default">
                        <Star className="mr-1 h-3 w-3" />
                        Default
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(language.code)}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(language)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!language.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setLanguageToDelete(language);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLanguage
                ? t('admin.languageManagement.editLanguage')
                : t('admin.languageManagement.addLanguage')}
            </DialogTitle>
            <DialogDescription>
              {editingLanguage
                ? 'Update the language settings'
                : 'Add a new language to the system'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">{t('admin.languageManagement.languageCode')}</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="en, de, fr..."
                  disabled={!!editingLanguage}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('admin.languageManagement.languageName')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="English"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nativeName">{t('admin.languageManagement.nativeName')}</Label>
                <Input
                  id="nativeName"
                  value={formData.nativeName}
                  onChange={(e) => setFormData({ ...formData, nativeName: e.target.value })}
                  placeholder="English"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direction">{t('admin.languageManagement.direction')}</Label>
                <Select
                  value={formData.direction}
                  onValueChange={(value: 'ltr' | 'rtl') =>
                    setFormData({ ...formData, direction: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ltr">{t('admin.languageManagement.ltr')}</SelectItem>
                    <SelectItem value="rtl">{t('admin.languageManagement.rtl')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">{t('admin.languageManagement.isActive')}</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the language "{languageToDelete?.name}". This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLanguageToDelete(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLanguage}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
