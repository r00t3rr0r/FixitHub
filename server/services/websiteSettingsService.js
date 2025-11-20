const WebsiteSettings = require('../models/WebsiteSettings');
const PageContent = require('../models/PageContent');

class WebsiteSettingsService {
  /**
   * Get current website settings
   */
  static async getSettings() {
    try {
      console.log('Fetching website settings');
      const settings = await WebsiteSettings.getSettings();
      return settings;
    } catch (error) {
      console.error('Error fetching website settings:', error);
      throw new Error('Failed to fetch website settings');
    }
  }

  /**
   * Update website settings
   */
  static async updateSettings(updates) {
    try {
      console.log('Updating website settings with data:', Object.keys(updates));
      const settings = await WebsiteSettings.updateSettings(updates);
      return settings;
    } catch (error) {
      console.error('Error updating website settings:', error);
      throw new Error('Failed to update website settings');
    }
  }

  /**
   * Update general settings
   */
  static async updateGeneralSettings(data) {
    try {
      console.log('Updating general settings');
      const updates = {
        projectTitle: data.projectTitle,
        subdomain: data.subdomain,
        customDomain: data.customDomain,
        defaultLanguage: data.defaultLanguage,
        supportedLanguages: data.supportedLanguages
      };
      return await this.updateSettings(updates);
    } catch (error) {
      console.error('Error updating general settings:', error);
      throw error;
    }
  }

  /**
   * Update SEO settings
   */
  static async updateSEOSettings(seoData) {
    try {
      console.log('Updating SEO settings');
      return await this.updateSettings({ seo: seoData });
    } catch (error) {
      console.error('Error updating SEO settings:', error);
      throw error;
    }
  }

  /**
   * Update page layout settings
   */
  static async updatePageLayout(layoutData) {
    try {
      console.log('Updating page layout settings');
      return await this.updateSettings({ pageLayout: layoutData });
    } catch (error) {
      console.error('Error updating page layout:', error);
      throw error;
    }
  }

  /**
   * Update header configuration
   */
  static async updateHeader(headerData) {
    try {
      console.log('Updating header configuration');
      return await this.updateSettings({ header: headerData });
    } catch (error) {
      console.error('Error updating header:', error);
      throw error;
    }
  }

  /**
   * Update footer configuration
   */
  static async updateFooter(footerData) {
    try {
      console.log('Updating footer configuration');
      return await this.updateSettings({ footer: footerData });
    } catch (error) {
      console.error('Error updating footer:', error);
      throw error;
    }
  }

  /**
   * Update navigation menu
   */
  static async updateNavigation(navData) {
    try {
      console.log('Updating navigation menu');
      return await this.updateSettings({ navigation: navData });
    } catch (error) {
      console.error('Error updating navigation:', error);
      throw error;
    }
  }

  /**
   * Update color scheme
   */
  static async updateColorScheme(colorData) {
    try {
      console.log('Updating color scheme');
      return await this.updateSettings({ colorScheme: colorData });
    } catch (error) {
      console.error('Error updating color scheme:', error);
      throw error;
    }
  }

  /**
   * Update dark mode settings
   */
  static async updateDarkMode(darkModeData) {
    try {
      console.log('Updating dark mode settings');
      return await this.updateSettings({ darkMode: darkModeData });
    } catch (error) {
      console.error('Error updating dark mode:', error);
      throw error;
    }
  }

  /**
   * Update typography settings
   */
  static async updateTypography(typographyData) {
    try {
      console.log('Updating typography settings');
      return await this.updateSettings({ typography: typographyData });
    } catch (error) {
      console.error('Error updating typography:', error);
      throw error;
    }
  }

  /**
   * Update spacing settings
   */
  static async updateSpacing(spacingData) {
    try {
      console.log('Updating spacing settings');
      return await this.updateSettings({ spacing: spacingData });
    } catch (error) {
      console.error('Error updating spacing:', error);
      throw error;
    }
  }

  /**
   * Update border radius settings
   */
  static async updateBorderRadius(borderRadiusData) {
    try {
      console.log('Updating border radius settings');
      return await this.updateSettings({ borderRadius: borderRadiusData });
    } catch (error) {
      console.error('Error updating border radius:', error);
      throw error;
    }
  }

  /**
   * Update shadow settings
   */
  static async updateShadows(shadowData) {
    try {
      console.log('Updating shadow settings');
      return await this.updateSettings({ shadows: shadowData });
    } catch (error) {
      console.error('Error updating shadows:', error);
      throw error;
    }
  }

  /**
   * Update background settings
   */
  static async updateBackground(backgroundData) {
    try {
      console.log('Updating background settings');
      return await this.updateSettings({ background: backgroundData });
    } catch (error) {
      console.error('Error updating background:', error);
      throw error;
    }
  }

  /**
   * Update content modules configuration
   */
  static async updateContentModules(modulesData) {
    try {
      console.log('Updating content modules');
      return await this.updateSettings({ contentModules: modulesData });
    } catch (error) {
      console.error('Error updating content modules:', error);
      throw error;
    }
  }

  /**
   * Update breakpoints
   */
  static async updateBreakpoints(breakpointsData) {
    try {
      console.log('Updating breakpoints');
      return await this.updateSettings({ breakpoints: breakpointsData });
    } catch (error) {
      console.error('Error updating breakpoints:', error);
      throw error;
    }
  }

  /**
   * Update responsive settings
   */
  static async updateResponsiveSettings(responsiveData) {
    try {
      console.log('Updating responsive settings');
      return await this.updateSettings({ responsiveSettings: responsiveData });
    } catch (error) {
      console.error('Error updating responsive settings:', error);
      throw error;
    }
  }

  /**
   * Update animation settings
   */
  static async updateAnimations(animationData) {
    try {
      console.log('Updating animation settings');
      return await this.updateSettings({ animations: animationData });
    } catch (error) {
      console.error('Error updating animations:', error);
      throw error;
    }
  }

  /**
   * Update custom CSS
   */
  static async updateCustomCSS(css) {
    try {
      console.log('Updating custom CSS');
      return await this.updateSettings({ customCSS: css });
    } catch (error) {
      console.error('Error updating custom CSS:', error);
      throw error;
    }
  }

  /**
   * Update custom JavaScript
   */
  static async updateCustomJS(js) {
    try {
      console.log('Updating custom JavaScript');
      return await this.updateSettings({ customJS: js });
    } catch (error) {
      console.error('Error updating custom JavaScript:', error);
      throw error;
    }
  }

  /**
   * Update integrations
   */
  static async updateIntegrations(integrationsData) {
    try {
      console.log('Updating integrations');
      return await this.updateSettings({ integrations: integrationsData });
    } catch (error) {
      console.error('Error updating integrations:', error);
      throw error;
    }
  }

  /**
   * Update publishing settings
   */
  static async updatePublishing(publishingData) {
    try {
      console.log('Updating publishing settings');
      return await this.updateSettings({ publishing: publishingData });
    } catch (error) {
      console.error('Error updating publishing:', error);
      throw error;
    }
  }

  /**
   * Publish website
   */
  static async publishWebsite(userId) {
    try {
      console.log('Publishing website by user:', userId);
      const updates = {
        publishing: {
          status: 'published',
          lastPublished: new Date(),
          publishedBy: userId,
          version: (await this.getSettings()).publishing.version + 1
        }
      };
      return await this.updateSettings(updates);
    } catch (error) {
      console.error('Error publishing website:', error);
      throw error;
    }
  }

  /**
   * Create backup
   */
  static async createBackup() {
    try {
      console.log('Creating website settings backup');
      const settings = await this.getSettings();
      // In a real implementation, this would save to a backup storage
      return {
        success: true,
        backup: settings.toObject(),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Export website settings
   */
  static async exportSettings(format = 'json') {
    try {
      console.log('Exporting website settings as', format);
      const settings = await this.getSettings();
      const data = settings.toObject();

      if (format === 'json') {
        return { data, mimeType: 'application/json' };
      }

      // Could add HTML, ZIP formats here
      return { data, mimeType: 'application/json' };
    } catch (error) {
      console.error('Error exporting settings:', error);
      throw error;
    }
  }

  /**
   * Manage page hierarchy
   */
  static async updatePages(pages) {
    try {
      console.log('Updating page hierarchy with', pages.length, 'pages');
      return await this.updateSettings({ pages });
    } catch (error) {
      console.error('Error updating pages:', error);
      throw error;
    }
  }

  /**
   * Add new page
   */
  static async addPage(pageData) {
    try {
      console.log('Adding new page:', pageData.title);
      const settings = await this.getSettings();
      const pages = settings.pages || [];
      const newPage = {
        id: `page_${Date.now()}`,
        ...pageData,
        order: pages.length
      };
      pages.push(newPage);

      // Create corresponding PageContent document for Visual Page Builder
      try {
        console.log('Creating empty PageContent for new page:', newPage.id);
        await PageContent.createPage({
          pageId: newPage.id,
          pageTitle: newPage.title,
          pageSlug: newPage.slug,
          sections: [],
          globalStyles: {
            primaryColor: '#3b82f6',
            secondaryColor: '#10b981',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px',
            backgroundColor: '#ffffff',
            textColor: '#1f2937'
          }
        }, null);
        console.log('PageContent created successfully for:', newPage.id);
      } catch (pageContentError) {
        console.error('Error creating PageContent:', pageContentError);
        // Don't fail the page creation if PageContent fails
        // The Visual Page Builder will handle this gracefully
      }

      return await this.updateSettings({ pages });
    } catch (error) {
      console.error('Error adding page:', error);
      throw error;
    }
  }

  /**
   * Update page
   */
  static async updatePage(pageId, pageData) {
    try {
      console.log('Updating page:', pageId);
      const settings = await this.getSettings();
      const pages = settings.pages || [];
      const pageIndex = pages.findIndex(p => p.id === pageId);

      if (pageIndex === -1) {
        throw new Error('Page not found');
      }

      pages[pageIndex] = { ...pages[pageIndex], ...pageData };
      return await this.updateSettings({ pages });
    } catch (error) {
      console.error('Error updating page:', error);
      throw error;
    }
  }

  /**
   * Delete page
   */
  static async deletePage(pageId) {
    try {
      console.log('Deleting page:', pageId);
      const settings = await this.getSettings();
      const pages = (settings.pages || []).filter(p => p.id !== pageId);
      return await this.updateSettings({ pages });
    } catch (error) {
      console.error('Error deleting page:', error);
      throw error;
    }
  }

  /**
   * Reorder pages
   */
  static async reorderPages(pageIds) {
    try {
      console.log('Reordering pages');
      const settings = await this.getSettings();
      const pages = settings.pages || [];
      const reorderedPages = pageIds.map((id, index) => {
        const page = pages.find(p => p.id === id);
        if (page) {
          page.order = index;
        }
        return page;
      }).filter(Boolean);

      return await this.updateSettings({ pages: reorderedPages });
    } catch (error) {
      console.error('Error reordering pages:', error);
      throw error;
    }
  }
}

module.exports = WebsiteSettingsService;
