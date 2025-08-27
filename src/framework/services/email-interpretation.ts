import { EmailData, ProcessedContent, MediaFile, SystemError } from '../types';

export class EmailInterpretationService {
  private errors: SystemError[] = [];

  async interpretEmail(email: EmailData): Promise<ProcessedContent> {
    const startTime = Date.now();
    
    try {
      // Extract content and classify
      const contentType = this.classifyContentType(email);
      const intent = this.determineIntent(email.body);
      const targetFrontends = this.extractTargetFrontends(email.body);
      
      // Process content
      const content = this.extractContent(email);
      const media = await this.processAttachments(email.attachments);
      
      const processedContent: ProcessedContent = {
        type: contentType,
        intent,
        target_frontends: targetFrontends,
        content,
        media
      };

      return processedContent;
    } catch (error) {
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: `Email interpretation failed: ${error.message}`,
        severity: 'high',
        component: 'EmailInterpretationService',
        resolved: false
      });
      throw error;
    }
  }

  private classifyContentType(email: EmailData): 'article' | 'product' | 'update' | 'announcement' | 'other' {
    const { subject, body } = email;
    const text = `${subject} ${body}`.toLowerCase();

    // Classification rules
    if (text.includes('blog') || text.includes('article') || text.includes('post')) {
      return 'article';
    }
    
    if (text.includes('product') || text.includes('item') || text.includes('listing')) {
      return 'product';
    }
    
    if (text.includes('update') || text.includes('changes') || text.includes('modified')) {
      return 'update';
    }
    
    if (text.includes('announcement') || text.includes('news') || text.includes('important')) {
      return 'announcement';
    }

    return 'other';
  }

  private determineIntent(body: string): 'immediate' | 'scheduled' | 'draft' {
    const text = body.toLowerCase();

    if (text.includes('publish now') || text.includes('immediate') || text.includes('asap')) {
      return 'immediate';
    }
    
    if (text.includes('schedule') || text.includes('later') || text.includes('specific time')) {
      return 'scheduled';
    }
    
    if (text.includes('draft') || text.includes('save') || text.includes('review first')) {
      return 'draft';
    }

    return 'immediate'; // Default to immediate
  }

  private extractTargetFrontends(body: string): string[] {
    const text = body.toLowerCase();
    const frontends: string[] = [];

    // Common frontend patterns
    if (text.includes('main site') || text.includes('website') || text.includes('homepage')) {
      frontends.push('main_site');
    }
    
    if (text.includes('developer portal') || text.includes('dev portal') || text.includes('api docs')) {
      frontends.push('developer_portal');
    }
    
    if (text.includes('blog') || text.includes('news site')) {
      frontends.push('blog');
    }
    
    if (text.includes('admin panel') || text.includes('dashboard')) {
      frontends.push('admin_panel');
    }

    // If no specific frontends mentioned, target all available
    return frontends.length > 0 ? frontends : ['all'];
  }

  private extractContent(email: EmailData): Record<string, any> {
    const { subject, body } = email;
    
    // Extract structured content from email
    const content: Record<string, any> = {
      title: subject,
      body: this.cleanBody(body),
      author: email.sender,
      created_at: email.timestamp,
      excerpt: this.generateExcerpt(body),
      tags: this.extractTags(body),
      metadata: this.extractMetadata(body)
    };

    return content;
  }

  private cleanBody(body: string): string {
    // Remove email signatures, quoted text, and formatting
    return body
      .replace(/--\s*[\s\S]*$/m, '') // Remove email signature
      .replace(/^>.*$/gm, '') // Remove quoted lines
      .replace(/^\s*On.*wrote:.*$/m, '') // Remove "On date, person wrote:"
      .trim();
  }

  private generateExcerpt(body: string): string {
    const cleanBody = this.cleanBody(body);
    const words = cleanBody.split(' ');
    return words.slice(0, 50).join(' ') + (words.length > 50 ? '...' : '');
  }

  private extractTags(body: string): string[] {
    const text = body.toLowerCase();
    const tags: string[] = [];
    
    // Look for common tag patterns
    const tagPatterns = [
      /#(\w+)/g, // #hashtag
      /tag[s]?:\s*([^,\n]+)/gi, // tags: word1, word2
      /category:\s*([^,\n]+)/gi, // category: word
    ];

    tagPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const tag = match.replace(/[#\s,:]/g, '');
          if (tag && !tags.includes(tag)) {
            tags.push(tag);
          }
        });
      }
    });

    return tags;
  }

  private extractMetadata(body: string): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Extract common metadata patterns
    const patterns = {
      priority: /priority:\s*(high|medium|low)/i,
      category: /category:\s*([^\n]+)/i,
      language: /language:\s*([^\n]+)/i,
      featured: /featured:\s*(true|false)/i,
    };

    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = body.match(pattern);
      if (match) {
        metadata[key] = match[1].trim();
      }
    });

    return metadata;
  }

  private async processAttachments(attachments: string[]): Promise<MediaFile[]> {
    const mediaFiles: MediaFile[] = [];

    for (let i = 0; i < attachments.length; i++) {
      try {
        const attachment = attachments[i];
        const mediaFile = await this.processSingleAttachment(attachment, i);
        mediaFiles.push(mediaFile);
      } catch (error) {
        this.errors.push({
          timestamp: new Date().toISOString(),
          error: `Failed to process attachment ${i}: ${error.message}`,
          severity: 'medium',
          component: 'EmailInterpretationService',
          resolved: false
        });
      }
    }

    return mediaFiles;
  }

  private async processSingleAttachment(attachment: string, index: number): Promise<MediaFile> {
    // In a real implementation, this would process the base64 data
    // For now, we'll create a basic media file structure
    
    const contentType = this.detectContentType(attachment);
    const filename = `attachment_${index + 1}.${this.getFileExtension(contentType)}`;
    
    return {
      filename,
      content_type: contentType,
      data: attachment,
      metadata: {
        alt_text: `Attachment ${index + 1}`,
        caption: `Attached file from email`,
        size: Math.round(attachment.length * 0.75), // Approximate size
        dimensions: contentType.startsWith('image/') ? { width: 800, height: 600 } : undefined
      }
    };
  }

  private detectContentType(base64Data: string): string {
    // Simple content type detection based on base64 header
    const header = base64Data.substring(0, 32).toLowerCase();
    
    if (header.includes('png')) return 'image/png';
    if (header.includes('jpg') || header.includes('jpeg')) return 'image/jpeg';
    if (header.includes('gif')) return 'image/gif';
    if (header.includes('pdf')) return 'application/pdf';
    if (header.includes('text')) return 'text/plain';
    
    return 'application/octet-stream';
  }

  private getFileExtension(contentType: string): string {
    const extensions: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/octet-stream': 'bin'
    };

    return extensions[contentType] || 'bin';
  }

  getErrors(): SystemError[] {
    return this.errors;
  }

  clearErrors(): void {
    this.errors = [];
  }
}