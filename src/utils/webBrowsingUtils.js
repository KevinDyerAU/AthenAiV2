// Shared Web Browsing Utilities for AthenAI Agents
const axios = require('axios');
const cheerio = require('cheerio');
const { logger } = require('./logger');

class WebBrowsingUtils {
  static async performWebSearch(query, options = {}) {
    try {
      const {
        maxResults = 5,
        timeout = 10000,
        userAgent = 'AthenAI-Agent/1.0'
      } = options;

      // Use DuckDuckGo Instant Answer API for web search
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      
      const response = await axios.get(searchUrl, {
        timeout,
        headers: {
          'User-Agent': userAgent
        }
      });

      const results = [];
      
      // Extract instant answer if available
      if (response.data.Abstract) {
        results.push({
          title: response.data.Heading || 'Instant Answer',
          content: response.data.Abstract,
          url: response.data.AbstractURL || '',
          source: response.data.AbstractSource || 'DuckDuckGo',
          type: 'instant_answer'
        });
      }

      // Extract related topics
      if (response.data.RelatedTopics && response.data.RelatedTopics.length > 0) {
        response.data.RelatedTopics.slice(0, maxResults - results.length).forEach(topic => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              content: topic.Text,
              url: topic.FirstURL,
              source: 'DuckDuckGo',
              type: 'related_topic'
            });
          }
        });
      }

      // If no results from DuckDuckGo, try web scraping fallback
      if (results.length === 0) {
        try {
          const searchEngineUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          const searchResponse = await axios.get(searchEngineUrl, {
            timeout: timeout + 5000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });

          const $ = cheerio.load(searchResponse.data);
          
          $('.result').slice(0, maxResults).each((i, element) => {
            const title = $(element).find('.result__title a').text().trim();
            const url = $(element).find('.result__title a').attr('href');
            const snippet = $(element).find('.result__snippet').text().trim();
            
            if (title && url) {
              results.push({
                title,
                content: snippet,
                url: url.startsWith('http') ? url : `https://${url}`,
                source: 'Web Search',
                type: 'search_result'
              });
            }
          });
        } catch (scrapeError) {
          logger.warn('Web scraping fallback failed', { error: scrapeError.message });
        }
      }

      return results.length > 0 ? results : [{
        title: 'Search Completed',
        content: `Search performed for: ${query}. No specific results found, but search was executed successfully.`,
        url: '',
        source: 'AthenAI',
        type: 'search_status'
      }];

    } catch (error) {
      logger.error('Web search failed', { query, error: error.message });
      return [{
        title: 'Search Error',
        content: `Failed to search for: ${query}. Error: ${error.message}`,
        url: '',
        source: 'AthenAI',
        type: 'error'
      }];
    }
  }

  static async browseUrl(url, options = {}) {
    try {
      const {
        timeout = 15000,
        maxContentLength = 5000,
        userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      } = options;

      // Validate URL format
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await axios.get(url, {
        timeout,
        maxRedirects: 5,
        headers: {
          'User-Agent': userAgent
        }
      });

      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, nav, footer, aside, .advertisement, .ads').remove();
      
      // Extract main content
      const title = $('title').text().trim() || $('h1').first().text().trim() || 'No Title';
      
      // Try to find main content area
      let mainContent = '';
      const contentSelectors = [
        'main', 
        'article', 
        '.content', 
        '.main-content', 
        '.post-content', 
        '.entry-content',
        '#content',
        '.container'
      ];
      
      for (const selector of contentSelectors) {
        const content = $(selector).first();
        if (content.length > 0) {
          mainContent = content.text().trim();
          break;
        }
      }
      
      // Fallback to body content if no main content found
      if (!mainContent) {
        mainContent = $('body').text().trim();
      }
      
      // Clean up the content
      mainContent = mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim()
        .substring(0, maxContentLength);
      
      // Extract meta information
      const description = $('meta[name="description"]').attr('content') || '';
      const keywords = $('meta[name="keywords"]').attr('content') || '';
      
      return {
        title,
        description,
        keywords,
        content: mainContent,
        url,
        contentLength: mainContent.length,
        extractedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('URL browsing failed', { url, error: error.message });
      return {
        title: 'Browse Error',
        description: '',
        keywords: '',
        content: `Failed to browse URL: ${url}. Error: ${error.message}`,
        url,
        contentLength: 0,
        extractedAt: new Date().toISOString(),
        error: error.message
      };
    }
  }

  static async verifyReferences(references, content, options = {}) {
    try {
      const {
        maxReferences = 5,
        timeout = 15000
      } = options;

      const verificationResults = [];
      
      for (const reference of references.slice(0, maxReferences)) {
        try {
          let referenceUrl = reference;
          
          // Extract URL if reference is in citation format
          const urlMatch = reference.match(/https?:\/\/[^\s\)]+/);
          if (urlMatch) {
            referenceUrl = urlMatch[0];
          }
          
          if (referenceUrl.startsWith('http')) {
            const urlContent = await this.browseUrl(referenceUrl, { timeout });
            
            // Simple relevance check
            const contentWords = content.toLowerCase().split(/\s+/).slice(0, 50);
            const referenceWords = urlContent.content.toLowerCase().split(/\s+/);
            
            let relevanceScore = 0;
            contentWords.forEach(word => {
              if (word.length > 3 && referenceWords.includes(word)) {
                relevanceScore++;
              }
            });
            
            const relevancePercentage = Math.min((relevanceScore / contentWords.length) * 100, 100);
            
            verificationResults.push({
              reference,
              url: referenceUrl,
              accessible: !urlContent.error,
              title: urlContent.title,
              relevanceScore: relevancePercentage,
              status: urlContent.error ? 'error' : 'verified',
              error: urlContent.error || null,
              contentPreview: urlContent.content.substring(0, 200)
            });
          } else {
            verificationResults.push({
              reference,
              url: null,
              accessible: false,
              title: 'Non-URL Reference',
              relevanceScore: 0,
              status: 'non_url',
              error: 'Reference is not a URL',
              contentPreview: ''
            });
          }
        } catch (error) {
          verificationResults.push({
            reference,
            url: reference,
            accessible: false,
            title: 'Verification Error',
            relevanceScore: 0,
            status: 'error',
            error: error.message,
            contentPreview: ''
          });
        }
      }
      
      const accessibleCount = verificationResults.filter(r => r.accessible).length;
      const averageRelevance = verificationResults.reduce((sum, r) => sum + r.relevanceScore, 0) / verificationResults.length;
      
      return {
        totalReferences: references.length,
        verifiedReferences: verificationResults.length,
        accessibleReferences: accessibleCount,
        averageRelevanceScore: averageRelevance,
        verificationResults,
        overallStatus: accessibleCount > 0 ? 'verified' : 'failed',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Reference verification failed', { error: error.message });
      return {
        totalReferences: references.length,
        verifiedReferences: 0,
        accessibleReferences: 0,
        averageRelevanceScore: 0,
        verificationResults: [],
        overallStatus: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  static createWebBrowsingTools(sessionId = null, progressBroadcaster = null) {
    const { DynamicTool } = require('@langchain/core/tools');
    
    return [
      // Web Search Tool
      new DynamicTool({
        name: 'web_search',
        description: 'Search the web for information, current data, facts, or research materials',
        func: async (input) => {
          try {
            if (sessionId && progressBroadcaster) {
              progressBroadcaster.updateThinking(sessionId, 'web_search', `Searching web for: ${input.substring(0, 100)}...`);
            }
            
            const searchResults = await this.performWebSearch(input);
            return JSON.stringify({
              query: input,
              results: searchResults,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            return JSON.stringify({ error: error.message, query: input });
          }
        }
      }),

      // URL Browser Tool
      new DynamicTool({
        name: 'browse_url',
        description: 'Browse and extract content from a specific URL for detailed information',
        func: async (input) => {
          try {
            if (sessionId && progressBroadcaster) {
              progressBroadcaster.updateThinking(sessionId, 'browse_url', `Browsing URL: ${input}`);
            }
            
            const urlContent = await this.browseUrl(input);
            return JSON.stringify({
              url: input,
              content: urlContent,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            return JSON.stringify({ error: error.message, url: input });
          }
        }
      }),

      // Reference Verification Tool
      new DynamicTool({
        name: 'verify_references',
        description: 'Verify the accessibility and relevance of references or citations',
        func: async (input) => {
          try {
            const { references, content } = JSON.parse(input);
            if (sessionId && progressBroadcaster) {
              progressBroadcaster.updateThinking(sessionId, 'verify_refs', `Verifying ${references.length} references...`);
            }
            
            const verification = await this.verifyReferences(references, content);
            return JSON.stringify(verification);
          } catch (error) {
            return JSON.stringify({ error: error.message });
          }
        }
      })
    ];
  }
}

module.exports = { WebBrowsingUtils };
