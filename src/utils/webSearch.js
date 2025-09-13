/**
 * Web Search Utility - Secondary Knowledge Enrichment
 * Provides web search capabilities as fallback for knowledge substrate
 */

const axios = require('axios');

/**
 * Search the web using available search APIs
 * @param {string} query - Search query
 * @param {object} context - Additional context for search
 * @returns {Array} Search results
 */
async function searchWeb(query, context = {}) {
  try {
    // Try SerpAPI first if available
    if (process.env.SERPAPI_API_KEY) {
      return await searchWithSerpAPI(query, context);
    }
    
    // Fallback to other search methods
    console.log('No web search API configured, returning empty results');
    return [];
    
  } catch (error) {
    console.error('Web search failed:', error);
    return [];
  }
}

/**
 * Search using SerpAPI (Google Search)
 * @param {string} query - Search query
 * @param {object} context - Additional context
 * @returns {Array} Search results
 */
async function searchWithSerpAPI(query, context = {}) {
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: query,
        api_key: process.env.SERPAPI_API_KEY,
        engine: 'google',
        num: context.maxResults || 10,
        hl: 'en',
        gl: 'us'
      },
      timeout: 10000
    });

    const results = response.data.organic_results || [];
    
    return results.map(result => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      content: result.snippet, // Use snippet as content for now
      source: 'serpapi',
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    console.error('SerpAPI search failed:', error);
    throw error;
  }
}

/**
 * Search using Firecrawl for web scraping
 * @param {string} query - Search query
 * @param {object} context - Additional context
 * @returns {Array} Search results
 */
async function searchWithFirecrawl(query, context = {}) {
  try {
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new Error('Firecrawl API key not configured');
    }

    // First, we need URLs to scrape - this would typically come from a search engine
    // For now, this is a placeholder implementation
    const urls = context.urls || [];
    
    if (urls.length === 0) {
      return [];
    }

    const results = [];
    
    for (const url of urls.slice(0, 5)) { // Limit to 5 URLs
      try {
        const response = await axios.post('https://api.firecrawl.dev/v0/scrape', {
          url: url,
          pageOptions: {
            onlyMainContent: true
          }
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        if (response.data.success) {
          results.push({
            title: response.data.data.metadata?.title || 'No title',
            url: url,
            content: response.data.data.content,
            snippet: response.data.data.content?.substring(0, 200) + '...',
            source: 'firecrawl',
            timestamp: new Date().toISOString()
          });
        }
      } catch (scrapeError) {
        console.error(`Failed to scrape ${url}:`, scrapeError.message);
      }
    }

    return results;
    
  } catch (error) {
    console.error('Firecrawl search failed:', error);
    throw error;
  }
}

/**
 * Enhanced web search that combines multiple sources
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Array} Combined search results
 */
async function enhancedWebSearch(query, options = {}) {
  const results = [];
  
  try {
    // Get search results from SerpAPI
    if (process.env.SERPAPI_API_KEY) {
      const serpResults = await searchWithSerpAPI(query, options);
      results.push(...serpResults);
    }
    
    // If we have URLs and Firecrawl is available, scrape content
    if (process.env.FIRECRAWL_API_KEY && results.length > 0) {
      const urlsToScrape = results.slice(0, 3).map(r => r.url); // Top 3 results
      const scrapedResults = await searchWithFirecrawl(query, { urls: urlsToScrape });
      
      // Merge scraped content with search results
      scrapedResults.forEach(scraped => {
        const existing = results.find(r => r.url === scraped.url);
        if (existing) {
          existing.content = scraped.content;
          existing.fullContent = true;
        }
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('Enhanced web search failed:', error);
    return results; // Return partial results if available
  }
}

/**
 * Search for specific domain expertise
 * @param {string} topic - Topic to search for
 * @param {string} domain - Specific domain (e.g., 'academic', 'industry', 'news')
 * @returns {Array} Domain-specific search results
 */
async function searchDomainExpertise(topic, domain = 'general') {
  const domainQueries = {
    academic: `${topic} site:edu OR site:arxiv.org OR site:scholar.google.com`,
    industry: `${topic} "industry expert" OR "professional" OR "consultant"`,
    news: `${topic} site:reuters.com OR site:bloomberg.com OR site:wsj.com`,
    technical: `${topic} "technical documentation" OR "API" OR "implementation"`,
    general: topic
  };
  
  const query = domainQueries[domain] || domainQueries.general;
  return await searchWeb(query, { domain, maxResults: 15 });
}

module.exports = {
  searchWeb,
  searchWithSerpAPI,
  searchWithFirecrawl,
  enhancedWebSearch,
  searchDomainExpertise
};
