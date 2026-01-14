const PageContent = require('../models/PageContent');

class PageContentService {
  /**
   * Get page content by page ID
   */
  static async getPageContent(pageId) {
    try {
      console.log('Fetching page content for page:', pageId);
      const pageContent = await PageContent.getByPageId(pageId);

      if (!pageContent) {
        throw new Error('Page content not found');
      }

      return pageContent;
    } catch (error) {
      console.error('Error fetching page content:', error);
      throw error;
    }
  }

  /**
   * Create new page content
   */
  static async createPageContent(pageData, userId) {
    try {
      console.log('Creating page content:', pageData.pageTitle);

      // Check if page already exists
      const existingPage = await PageContent.findOne({ pageSlug: pageData.pageSlug });
      if (existingPage) {
        throw new Error('Page with this slug already exists');
      }

      const pageContent = await PageContent.createPage(pageData, userId);
      console.log('Page content created successfully:', pageContent.pageId);

      return pageContent;
    } catch (error) {
      console.error('Error creating page content:', error);
      throw error;
    }
  }

  /**
   * Update page content
   */
  static async updatePageContent(pageId, updates, userId) {
    try {
      console.log('Updating page content for page:', pageId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      // Update fields
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          pageContent[key] = updates[key];
        }
      });

      pageContent.updatedBy = userId;
      await pageContent.save();

      console.log('Page content updated successfully');
      return pageContent;
    } catch (error) {
      console.error('Error updating page content:', error);
      throw error;
    }
  }

  /**
   * Delete page content
   */
  static async deletePageContent(pageId) {
    try {
      console.log('Deleting page content:', pageId);

      const result = await PageContent.deleteOne({ pageId });

      if (result.deletedCount === 0) {
        throw new Error('Page content not found');
      }

      console.log('Page content deleted successfully');
      return { success: true, message: 'Page deleted successfully' };
    } catch (error) {
      console.error('Error deleting page content:', error);
      throw error;
    }
  }

  /**
   * Duplicate page content
   */
  static async duplicatePageContent(pageId, newPageData, userId) {
    try {
      console.log('Duplicating page:', pageId);

      const duplicatedPage = await PageContent.duplicatePage(pageId, newPageData, userId);
      console.log('Page duplicated successfully:', duplicatedPage.pageId);

      return duplicatedPage;
    } catch (error) {
      console.error('Error duplicating page:', error);
      throw error;
    }
  }

  /**
   * Add section to page
   */
  static async addSection(pageId, sectionData, userId) {
    try {
      console.log('Adding section to page:', pageId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      const newSection = {
        id: sectionData.id || `section_${Date.now()}`,
        name: sectionData.name || 'New Section',
        type: sectionData.type || 'custom',
        components: sectionData.components || [],
        styles: sectionData.styles || {},
        order: pageContent.sections.length
      };

      pageContent.sections.push(newSection);
      pageContent.updatedBy = userId;
      await pageContent.save();

      console.log('Section added successfully');
      return pageContent;
    } catch (error) {
      console.error('Error adding section:', error);
      throw error;
    }
  }

  /**
   * Update section
   */
  static async updateSection(pageId, sectionId, sectionData, userId) {
    try {
      console.log('Updating section:', sectionId, 'in page:', pageId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      const sectionIndex = pageContent.sections.findIndex(s => s.id === sectionId);
      if (sectionIndex === -1) {
        throw new Error('Section not found');
      }

      pageContent.sections[sectionIndex] = {
        ...pageContent.sections[sectionIndex],
        ...sectionData
      };

      pageContent.updatedBy = userId;
      await pageContent.save();

      console.log('Section updated successfully');
      return pageContent;
    } catch (error) {
      console.error('Error updating section:', error);
      throw error;
    }
  }

  /**
   * Delete section
   */
  static async deleteSection(pageId, sectionId, userId) {
    try {
      console.log('Deleting section:', sectionId, 'from page:', pageId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      pageContent.sections = pageContent.sections.filter(s => s.id !== sectionId);
      pageContent.updatedBy = userId;
      await pageContent.save();

      console.log('Section deleted successfully');
      return pageContent;
    } catch (error) {
      console.error('Error deleting section:', error);
      throw error;
    }
  }

  /**
   * Reorder sections
   */
  static async reorderSections(pageId, sectionIds, userId) {
    try {
      console.log('Reordering sections in page:', pageId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      const reorderedSections = sectionIds.map((id, index) => {
        const section = pageContent.sections.find(s => s.id === id);
        if (section) {
          section.order = index;
        }
        return section;
      }).filter(Boolean);

      pageContent.sections = reorderedSections;
      pageContent.updatedBy = userId;
      await pageContent.save();

      console.log('Sections reordered successfully');
      return pageContent;
    } catch (error) {
      console.error('Error reordering sections:', error);
      throw error;
    }
  }

  /**
   * Add component to section
   */
  static async addComponent(pageId, sectionId, componentData, userId) {
    try {
      console.log('Adding component to section:', sectionId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      const section = pageContent.sections.find(s => s.id === sectionId);
      if (!section) {
        throw new Error('Section not found');
      }

      const newComponent = {
        id: componentData.id || `component_${Date.now()}`,
        type: componentData.type,
        name: componentData.name || componentData.type,
        content: componentData.content || {},
        styles: componentData.styles || {},
        order: section.components.length,
        parentId: componentData.parentId || null,
        children: []
      };

      section.components.push(newComponent);
      pageContent.updatedBy = userId;
      await pageContent.save();

      console.log('Component added successfully');
      return pageContent;
    } catch (error) {
      console.error('Error adding component:', error);
      throw error;
    }
  }

  /**
   * Update component
   */
  static async updateComponent(pageId, sectionId, componentId, componentData, userId) {
    try {
      console.log('Updating component:', componentId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      const section = pageContent.sections.find(s => s.id === sectionId);
      if (!section) {
        throw new Error('Section not found');
      }

      const componentIndex = section.components.findIndex(c => c.id === componentId);
      if (componentIndex === -1) {
        throw new Error('Component not found');
      }

      section.components[componentIndex] = {
        ...section.components[componentIndex],
        ...componentData
      };

      pageContent.updatedBy = userId;
      await pageContent.save();

      console.log('Component updated successfully');
      return pageContent;
    } catch (error) {
      console.error('Error updating component:', error);
      throw error;
    }
  }

  /**
   * Delete component
   */
  static async deleteComponent(pageId, sectionId, componentId, userId) {
    try {
      console.log('Deleting component:', componentId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      const section = pageContent.sections.find(s => s.id === sectionId);
      if (!section) {
        throw new Error('Section not found');
      }

      section.components = section.components.filter(c => c.id !== componentId);
      pageContent.updatedBy = userId;
      await pageContent.save();

      console.log('Component deleted successfully');
      return pageContent;
    } catch (error) {
      console.error('Error deleting component:', error);
      throw error;
    }
  }

  /**
   * Reorder components within a section
   */
  static async reorderComponents(pageId, sectionId, componentIds, userId) {
    try {
      console.log('Reordering components in section:', sectionId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      const section = pageContent.sections.find(s => s.id === sectionId);
      if (!section) {
        throw new Error('Section not found');
      }

      const reorderedComponents = componentIds.map((id, index) => {
        const component = section.components.find(c => c.id === id);
        if (component) {
          component.order = index;
        }
        return component;
      }).filter(Boolean);

      section.components = reorderedComponents;
      pageContent.updatedBy = userId;
      await pageContent.save();

      console.log('Components reordered successfully');
      return pageContent;
    } catch (error) {
      console.error('Error reordering components:', error);
      throw error;
    }
  }

  /**
   * Publish page
   */
  static async publishPage(pageId) {
    try {
      console.log('Publishing page:', pageId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      await pageContent.publish();
      console.log('Page published successfully');

      return pageContent;
    } catch (error) {
      console.error('Error publishing page:', error);
      throw error;
    }
  }

  /**
   * Create version snapshot
   */
  static async createVersion(pageId, userId, action = 'manual_save') {
    try {
      console.log('Creating version for page:', pageId);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      await pageContent.createVersion(userId, action);
      console.log('Version created successfully');

      return pageContent;
    } catch (error) {
      console.error('Error creating version:', error);
      throw error;
    }
  }

  /**
   * Restore from version
   */
  static async restoreVersion(pageId, versionIndex) {
    try {
      console.log('Restoring page:', pageId, 'to version:', versionIndex);

      const pageContent = await PageContent.findOne({ pageId });
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      await pageContent.restoreVersion(versionIndex);
      console.log('Version restored successfully');

      return pageContent;
    } catch (error) {
      console.error('Error restoring version:', error);
      throw error;
    }
  }

  /**
   * Get version history
   */
  static async getVersionHistory(pageId) {
    try {
      console.log('Fetching version history for page:', pageId);

      const pageContent = await PageContent.findOne({ pageId }).select('history version');
      if (!pageContent) {
        throw new Error('Page content not found');
      }

      return {
        currentVersion: pageContent.version,
        history: pageContent.history
      };
    } catch (error) {
      console.error('Error fetching version history:', error);
      throw error;
    }
  }

  /**
   * Get all pages list
   */
  static async getAllPages() {
    try {
      console.log('Fetching all pages');

      const pages = await PageContent.find()
        .select('pageId pageTitle pageSlug isDraft version publishedVersion lastPublished createdAt updatedAt')
        .sort({ updatedAt: -1 });

      return pages;
    } catch (error) {
      console.error('Error fetching all pages:', error);
      throw error;
    }
  }
}

module.exports = PageContentService;
