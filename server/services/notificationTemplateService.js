const SystemConfigService = require('./systemConfigService');

/**
 * Service for rendering notification templates with variable substitution
 * Supports email, SMS, and push notification channels
 */
class NotificationTemplateService {
  static normalizeTemplateName(name = '') {
    return String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toLowerCase();
  }

  /**
   * Render a template by name with provided variables
   * @param {string} templateName - Name of the template (e.g., 'Registrierung und Kontoaktivierung')
   * @param {string} channelType - Channel type: 'email', 'sms', or 'push'
   * @param {object} variables - Object with template variables { companyName, customerName, ... }
   * @returns {Promise<object>} { subject, content, text (for email plain text) }
   */
  static async renderTemplate(templateName, channelType, variables = {}) {
    try {
      console.log(`NotificationTemplateService: Rendering template "${templateName}" for channel "${channelType}"`);
      
      const config = await SystemConfigService.getSystemConfiguration();
      const templates = config.notificationTemplates || [];

      // Find template by exact or normalized name and active flag
      const normalizedSearchName = this.normalizeTemplateName(templateName);
      const template = templates.find((t) => {
        if (t.type !== channelType || t.isActive === false) {
          return false;
        }

        if (t.name === templateName) {
          return true;
        }

        return this.normalizeTemplateName(t.name) === normalizedSearchName;
      });

      if (!template) {
        console.warn(`NotificationTemplateService: Template "${templateName}" (${channelType}) not found or inactive`);
        return null;
      }

      // Substitute variables in subject and content
      const subject = this.substituteVariables(template.subject || '', variables);
      const content = this.substituteVariables(template.content, variables);

      // For email, also generate plain text version
      let plainText = null;
      if (channelType === 'email') {
        plainText = this.htmlToPlainText(content);
      }

      console.log(`NotificationTemplateService: Template rendered successfully`);
      return {
        subject,
        content,
        text: plainText,
        template: template
      };
    } catch (error) {
      console.error(`NotificationTemplateService: Error rendering template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all available templates for a specific channel or all channels
   * @param {string} channelType - Optional: 'email', 'sms', or 'push'
   * @returns {Promise<array>} Array of matching templates
   */
  static async getAvailableTemplates(channelType = null) {
    try {
      const config = await SystemConfigService.getSystemConfiguration();
      let templates = config.notificationTemplates || [];

      if (channelType) {
        templates = templates.filter(t => t.type === channelType && t.isActive !== false);
      } else {
        templates = templates.filter(t => t.isActive !== false);
      }

      console.log(`NotificationTemplateService: Found ${templates.length} active templates`);
      return templates;
    } catch (error) {
      console.error(`NotificationTemplateService: Error getting templates: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get template by exact name and type
   * @param {string} templateName - Template name
   * @param {string} channelType - Channel type
   * @returns {Promise<object>} Template object
   */
  static async getTemplateByName(templateName, channelType) {
    try {
      const config = await SystemConfigService.getSystemConfiguration();
      const templates = config.notificationTemplates || [];
      const normalizedSearchName = this.normalizeTemplateName(templateName);

      const template = templates.find((t) => {
        if (t.type !== channelType) {
          return false;
        }

        if (t.name === templateName) {
          return true;
        }

        return this.normalizeTemplateName(t.name) === normalizedSearchName;
      });

      return template || null;
    } catch (error) {
      console.error(`NotificationTemplateService: Error getting template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Substitute {{variableName}} placeholders with actual values
   * @param {string} text - Template content with {{variables}}
   * @param {object} variables - Objects with variable values
   * @returns {string} Text with substituted variables
   */
  static substituteVariables(text, variables = {}) {
    if (!text) return '';

    let result = text;
    const regex = /{{(\w+)}}/g;

    result = result.replace(regex, (match, variableName) => {
      const value = variables[variableName];
      if (value === undefined) {
        console.warn(`NotificationTemplateService: Variable "${variableName}" not provided`);
        return match; // Keep original placeholder
      }
      return String(value);
    });

    return result;
  }

  /**
   * Convert HTML to plain text (for email text alternatives)
   * Removes HTML tags and normalizes whitespace
   * @param {string} html - HTML content
   * @returns {string} Plain text version
   */
  static htmlToPlainText(html) {
    if (!html) return '';

    let text = html
      // Remove script and style tags
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      // Remove HTML comments
      .replace(/<!--.*?-->/gs, '')
      // Replace line breaks with newlines
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      // Normalize whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double
      .replace(/[ \t]+/g, ' ') // Multiple spaces to single
      .trim();

    return text;
  }

  /**
   * Check if all required variables are provided
   * @param {string} templateName - Template name
   * @param {string} channelType - Channel type
   * @param {object} providedVariables - Provided variables
   * @returns {Promise<object>} { isValid: boolean, missingVariables: string[] }
   */
  static async validateTemplateVariables(templateName, channelType, providedVariables = {}) {
    try {
      const template = await this.getTemplateByName(templateName, channelType);
      
      if (!template) {
        return { 
          isValid: false, 
          error: `Template "${templateName}" (${channelType}) not found`,
          missingVariables: []
        };
      }

      const requiredVars = (template.variables || [])
        .filter(v => v.required === true)
        .map(v => v.name);

      const missing = requiredVars.filter(varName => !providedVariables.hasOwnProperty(varName));

      return {
        isValid: missing.length === 0,
        missingVariables: missing,
        requiredVariables: requiredVars
      };
    } catch (error) {
      console.error(`NotificationTemplateService: Error validating variables: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get template metadata (for admin UI)
   * @param {string} templateName - Template name
   * @param {string} channelType - Channel type
   * @returns {Promise<object>} Template metadata
   */
  static async getTemplateMetadata(templateName, channelType) {
    try {
      const template = await this.getTemplateByName(templateName, channelType);
      
      if (!template) return null;

      const requiredVars = (template.variables || []).filter(v => v.required === true);
      const allVars = template.variables || [];

      return {
        name: template.name,
        type: template.type,
        subject: template.subject,
        isActive: template.isActive,
        variableCount: allVars.length,
        requiredVariableCount: requiredVars.length,
        variables: allVars,
        description: `${template.type === 'email' ? 'Email-Template' : template.type === 'sms' ? 'SMS' : 'Push-Nachricht'}`
      };
    } catch (error) {
      console.error(`NotificationTemplateService: Error getting metadata: ${error.message}`);
      throw error;
    }
  }
}

module.exports = NotificationTemplateService;
