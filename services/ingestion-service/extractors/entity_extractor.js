const natural = require('natural');
const compromise = require('compromise');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/entity_extractor.log' }),
    new winston.transports.Console()
  ]
});

class EntityExtractor {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
  }

  async extractEntities(text) {
    try {
      logger.info('Starting entity extraction', { textLength: text.length });

      const entities = [];
      
      // Use compromise.js for NLP processing
      const doc = compromise(text);

      // Extract people
      const people = doc.people().out('array');
      people.forEach(person => {
        entities.push({
          name: person,
          type: 'PERSON',
          confidence: 0.8,
          context: this.getEntityContext(text, person)
        });
      });

      // Extract organizations
      const organizations = doc.organizations().out('array');
      organizations.forEach(org => {
        entities.push({
          name: org,
          type: 'ORGANIZATION',
          confidence: 0.7,
          context: this.getEntityContext(text, org)
        });
      });

      // Extract places
      const places = doc.places().out('array');
      places.forEach(place => {
        entities.push({
          name: place,
          type: 'LOCATION',
          confidence: 0.7,
          context: this.getEntityContext(text, place)
        });
      });

      // Extract dates
      const dates = doc.dates().out('array');
      dates.forEach(date => {
        entities.push({
          name: date,
          type: 'DATE',
          confidence: 0.9,
          context: this.getEntityContext(text, date)
        });
      });

      // Extract money/financial terms
      const money = doc.money().out('array');
      money.forEach(amount => {
        entities.push({
          name: amount,
          type: 'MONEY',
          confidence: 0.8,
          context: this.getEntityContext(text, amount)
        });
      });

      // Extract technical terms and concepts
      const technicalEntities = this.extractTechnicalEntities(text);
      entities.push(...technicalEntities);

      // Extract email addresses
      const emails = this.extractEmails(text);
      entities.push(...emails);

      // Extract URLs
      const urls = this.extractUrls(text);
      entities.push(...urls);

      // Remove duplicates and low-confidence entities
      const uniqueEntities = this.deduplicateEntities(entities);
      const filteredEntities = uniqueEntities.filter(entity => entity.confidence >= 0.6);

      logger.info('Entity extraction completed', { 
        totalEntities: filteredEntities.length,
        entityTypes: [...new Set(filteredEntities.map(e => e.type))]
      });

      return filteredEntities;
    } catch (error) {
      logger.error('Error in entity extraction:', error);
      return [];
    }
  }

  extractTechnicalEntities(text) {
    const entities = [];
    
    // Programming languages
    const programmingLanguages = [
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'PHP', 'Go', 'Rust', 'TypeScript',
      'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'SQL', 'HTML', 'CSS', 'React', 'Vue', 'Angular'
    ];

    // Technologies and frameworks
    const technologies = [
      'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Node.js', 'Express', 'Django', 'Flask',
      'Spring', 'Laravel', 'Rails', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch',
      'Apache', 'Nginx', 'Jenkins', 'Git', 'GitHub', 'GitLab', 'Jira', 'Slack', 'Teams'
    ];

    // Combine all technical terms
    const allTechnicalTerms = [...programmingLanguages, ...technologies];

    allTechnicalTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        entities.push({
          name: term,
          type: 'TECHNOLOGY',
          confidence: 0.8,
          context: this.getEntityContext(text, term),
          occurrences: matches.length
        });
      }
    });

    // Extract version numbers
    const versionRegex = /v?\d+\.\d+(\.\d+)?/g;
    const versions = text.match(versionRegex);
    if (versions) {
      versions.forEach(version => {
        entities.push({
          name: version,
          type: 'VERSION',
          confidence: 0.7,
          context: this.getEntityContext(text, version)
        });
      });
    }

    return entities;
  }

  extractEmails(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    
    return emails.map(email => ({
      name: email,
      type: 'EMAIL',
      confidence: 0.95,
      context: this.getEntityContext(text, email)
    }));
  }

  extractUrls(text) {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const urls = text.match(urlRegex) || [];
    
    return urls.map(url => ({
      name: url,
      type: 'URL',
      confidence: 0.9,
      context: this.getEntityContext(text, url)
    }));
  }

  getEntityContext(text, entity, contextWindow = 50) {
    const entityIndex = text.toLowerCase().indexOf(entity.toLowerCase());
    if (entityIndex === -1) return '';

    const start = Math.max(0, entityIndex - contextWindow);
    const end = Math.min(text.length, entityIndex + entity.length + contextWindow);
    
    return text.substring(start, end).trim();
  }

  deduplicateEntities(entities) {
    const seen = new Map();
    const unique = [];

    entities.forEach(entity => {
      const key = `${entity.name.toLowerCase()}_${entity.type}`;
      
      if (!seen.has(key)) {
        seen.set(key, entity);
        unique.push(entity);
      } else {
        // Keep the entity with higher confidence
        const existing = seen.get(key);
        if (entity.confidence > existing.confidence) {
          const index = unique.indexOf(existing);
          unique[index] = entity;
          seen.set(key, entity);
        }
      }
    });

    return unique;
  }

  // Extract domain-specific entities based on content type
  extractDomainEntities(text, domain) {
    const entities = [];

    switch (domain) {
      case 'software':
        entities.push(...this.extractSoftwareEntities(text));
        break;
      case 'business':
        entities.push(...this.extractBusinessEntities(text));
        break;
      case 'academic':
        entities.push(...this.extractAcademicEntities(text));
        break;
      case 'legal':
        entities.push(...this.extractLegalEntities(text));
        break;
    }

    return entities;
  }

  extractSoftwareEntities(text) {
    const entities = [];
    
    // API endpoints
    const apiRegex = /\/api\/[a-zA-Z0-9\/\-_]+/g;
    const apis = text.match(apiRegex) || [];
    apis.forEach(api => {
      entities.push({
        name: api,
        type: 'API_ENDPOINT',
        confidence: 0.8,
        context: this.getEntityContext(text, api)
      });
    });

    // Function names
    const functionRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g;
    const functions = text.match(functionRegex) || [];
    functions.forEach(func => {
      const funcName = func.replace('(', '');
      entities.push({
        name: funcName,
        type: 'FUNCTION',
        confidence: 0.6,
        context: this.getEntityContext(text, func)
      });
    });

    return entities;
  }

  extractBusinessEntities(text) {
    const entities = [];
    
    // Business metrics
    const metricTerms = ['revenue', 'profit', 'ROI', 'KPI', 'conversion rate', 'churn rate', 'ARPU', 'LTV'];
    metricTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(text)) {
        entities.push({
          name: term,
          type: 'BUSINESS_METRIC',
          confidence: 0.7,
          context: this.getEntityContext(text, term)
        });
      }
    });

    return entities;
  }

  extractAcademicEntities(text) {
    const entities = [];
    
    // Research terms
    const researchTerms = ['hypothesis', 'methodology', 'analysis', 'conclusion', 'literature review', 'peer review'];
    researchTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(text)) {
        entities.push({
          name: term,
          type: 'RESEARCH_TERM',
          confidence: 0.7,
          context: this.getEntityContext(text, term)
        });
      }
    });

    return entities;
  }

  extractLegalEntities(text) {
    const entities = [];
    
    // Legal terms
    const legalTerms = ['contract', 'agreement', 'liability', 'compliance', 'regulation', 'statute', 'jurisdiction'];
    legalTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(text)) {
        entities.push({
          name: term,
          type: 'LEGAL_TERM',
          confidence: 0.7,
          context: this.getEntityContext(text, term)
        });
      }
    });

    return entities;
  }
}

// Export singleton instance
const extractor = new EntityExtractor();

module.exports = {
  extractEntities: (text, domain) => extractor.extractEntities(text, domain),
  EntityExtractor
};
