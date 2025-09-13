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
    new winston.transports.File({ filename: 'logs/relationship_extractor.log' }),
    new winston.transports.Console()
  ]
});

class RelationshipExtractor {
  constructor() {
    this.relationshipPatterns = [
      // Basic relationship patterns
      { pattern: /(\w+)\s+is\s+a\s+(\w+)/gi, type: 'IS_A' },
      { pattern: /(\w+)\s+has\s+(\w+)/gi, type: 'HAS' },
      { pattern: /(\w+)\s+owns\s+(\w+)/gi, type: 'OWNS' },
      { pattern: /(\w+)\s+works\s+for\s+(\w+)/gi, type: 'WORKS_FOR' },
      { pattern: /(\w+)\s+manages\s+(\w+)/gi, type: 'MANAGES' },
      { pattern: /(\w+)\s+reports\s+to\s+(\w+)/gi, type: 'REPORTS_TO' },
      { pattern: /(\w+)\s+created\s+(\w+)/gi, type: 'CREATED' },
      { pattern: /(\w+)\s+developed\s+(\w+)/gi, type: 'DEVELOPED' },
      { pattern: /(\w+)\s+uses\s+(\w+)/gi, type: 'USES' },
      { pattern: /(\w+)\s+depends\s+on\s+(\w+)/gi, type: 'DEPENDS_ON' },
      { pattern: /(\w+)\s+implements\s+(\w+)/gi, type: 'IMPLEMENTS' },
      { pattern: /(\w+)\s+extends\s+(\w+)/gi, type: 'EXTENDS' },
      { pattern: /(\w+)\s+inherits\s+from\s+(\w+)/gi, type: 'INHERITS_FROM' },
      { pattern: /(\w+)\s+connects\s+to\s+(\w+)/gi, type: 'CONNECTS_TO' },
      { pattern: /(\w+)\s+communicates\s+with\s+(\w+)/gi, type: 'COMMUNICATES_WITH' },
      { pattern: /(\w+)\s+sends\s+(\w+)\s+to\s+(\w+)/gi, type: 'SENDS_TO' },
      { pattern: /(\w+)\s+receives\s+(\w+)\s+from\s+(\w+)/gi, type: 'RECEIVES_FROM' }
    ];

    this.technicalPatterns = [
      { pattern: /(\w+)\s+API\s+calls?\s+(\w+)/gi, type: 'API_CALL' },
      { pattern: /(\w+)\s+service\s+integrates\s+with\s+(\w+)/gi, type: 'INTEGRATES_WITH' },
      { pattern: /(\w+)\s+database\s+stores\s+(\w+)/gi, type: 'STORES' },
      { pattern: /(\w+)\s+function\s+returns\s+(\w+)/gi, type: 'RETURNS' },
      { pattern: /(\w+)\s+class\s+implements\s+(\w+)/gi, type: 'IMPLEMENTS' },
      { pattern: /(\w+)\s+module\s+exports\s+(\w+)/gi, type: 'EXPORTS' },
      { pattern: /(\w+)\s+imports\s+(\w+)/gi, type: 'IMPORTS' }
    ];

    this.businessPatterns = [
      { pattern: /(\w+)\s+company\s+acquired\s+(\w+)/gi, type: 'ACQUIRED' },
      { pattern: /(\w+)\s+partners\s+with\s+(\w+)/gi, type: 'PARTNERS_WITH' },
      { pattern: /(\w+)\s+competes\s+with\s+(\w+)/gi, type: 'COMPETES_WITH' },
      { pattern: /(\w+)\s+supplies\s+(\w+)\s+to\s+(\w+)/gi, type: 'SUPPLIES_TO' },
      { pattern: /(\w+)\s+invests\s+in\s+(\w+)/gi, type: 'INVESTS_IN' },
      { pattern: /(\w+)\s+sponsors\s+(\w+)/gi, type: 'SPONSORS' }
    ];
  }

  async extractRelationships(text, entities = []) {
    try {
      logger.info('Starting relationship extraction', { 
        textLength: text.length,
        entitiesCount: entities.length 
      });

      const relationships = [];
      
      // Extract pattern-based relationships
      const patternRelationships = this.extractPatternRelationships(text);
      relationships.push(...patternRelationships);

      // Extract entity-based relationships if entities are provided
      if (entities.length > 0) {
        const entityRelationships = this.extractEntityRelationships(text, entities);
        relationships.push(...entityRelationships);
      }

      // Extract co-occurrence relationships
      const cooccurrenceRelationships = this.extractCooccurrenceRelationships(text, entities);
      relationships.push(...cooccurrenceRelationships);

      // Extract semantic relationships using NLP
      const semanticRelationships = this.extractSemanticRelationships(text);
      relationships.push(...semanticRelationships);

      // Remove duplicates and filter by confidence
      const uniqueRelationships = this.deduplicateRelationships(relationships);
      const filteredRelationships = uniqueRelationships.filter(rel => rel.confidence >= 0.5);

      logger.info('Relationship extraction completed', { 
        totalRelationships: filteredRelationships.length,
        relationshipTypes: [...new Set(filteredRelationships.map(r => r.type))]
      });

      return filteredRelationships;
    } catch (error) {
      logger.error('Error in relationship extraction:', error);
      return [];
    }
  }

  extractPatternRelationships(text) {
    const relationships = [];
    const allPatterns = [
      ...this.relationshipPatterns,
      ...this.technicalPatterns,
      ...this.businessPatterns
    ];

    allPatterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const source = match[1].trim();
        const target = match[2] ? match[2].trim() : match[3]?.trim();
        
        if (source && target && source !== target) {
          relationships.push({
            source: source,
            target: target,
            type: type,
            confidence: 0.8,
            context: this.getRelationshipContext(text, match.index, match[0].length),
            extractionMethod: 'pattern_based'
          });
        }
      }
    });

    return relationships;
  }

  extractEntityRelationships(text, entities) {
    const relationships = [];
    
    // Create entity map for quick lookup
    const entityMap = new Map();
    entities.forEach(entity => {
      entityMap.set(entity.name.toLowerCase(), entity);
    });

    // Find relationships between known entities
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        const relationship = this.findRelationshipBetweenEntities(text, entity1, entity2);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }

    return relationships;
  }

  findRelationshipBetweenEntities(text, entity1, entity2) {
    const name1 = entity1.name;
    const name2 = entity2.name;
    
    // Find sentences containing both entities
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (lowerSentence.includes(name1.toLowerCase()) && lowerSentence.includes(name2.toLowerCase())) {
        
        // Determine relationship type based on entity types and context
        const relType = this.inferRelationshipType(entity1, entity2, sentence);
        
        if (relType) {
          return {
            source: name1,
            target: name2,
            type: relType.type,
            confidence: relType.confidence,
            context: sentence.trim(),
            extractionMethod: 'entity_based'
          };
        }
      }
    }

    return null;
  }

  inferRelationshipType(entity1, entity2, context) {
    const type1 = entity1.type;
    const type2 = entity2.type;
    const lowerContext = context.toLowerCase();

    // Person-Organization relationships
    if (type1 === 'PERSON' && type2 === 'ORGANIZATION') {
      if (lowerContext.includes('work') || lowerContext.includes('employ')) {
        return { type: 'WORKS_FOR', confidence: 0.7 };
      }
      if (lowerContext.includes('found') || lowerContext.includes('start')) {
        return { type: 'FOUNDED', confidence: 0.8 };
      }
      if (lowerContext.includes('ceo') || lowerContext.includes('manage')) {
        return { type: 'MANAGES', confidence: 0.8 };
      }
    }

    // Organization-Technology relationships
    if (type1 === 'ORGANIZATION' && type2 === 'TECHNOLOGY') {
      if (lowerContext.includes('use') || lowerContext.includes('implement')) {
        return { type: 'USES', confidence: 0.7 };
      }
      if (lowerContext.includes('develop') || lowerContext.includes('create')) {
        return { type: 'DEVELOPED', confidence: 0.8 };
      }
    }

    // Location-based relationships
    if (type1 === 'PERSON' && type2 === 'LOCATION') {
      if (lowerContext.includes('live') || lowerContext.includes('resid')) {
        return { type: 'LIVES_IN', confidence: 0.7 };
      }
      if (lowerContext.includes('born') || lowerContext.includes('from')) {
        return { type: 'FROM', confidence: 0.7 };
      }
    }

    // Technology relationships
    if (type1 === 'TECHNOLOGY' && type2 === 'TECHNOLOGY') {
      if (lowerContext.includes('integrate') || lowerContext.includes('connect')) {
        return { type: 'INTEGRATES_WITH', confidence: 0.7 };
      }
      if (lowerContext.includes('depend') || lowerContext.includes('require')) {
        return { type: 'DEPENDS_ON', confidence: 0.7 };
      }
    }

    // Generic association for co-occurrence
    return { type: 'ASSOCIATED_WITH', confidence: 0.5 };
  }

  extractCooccurrenceRelationships(text, entities) {
    const relationships = [];
    const sentences = text.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      const entitiesInSentence = entities.filter(entity => 
        sentence.toLowerCase().includes(entity.name.toLowerCase())
      );

      // Create relationships for entities that co-occur in the same sentence
      for (let i = 0; i < entitiesInSentence.length; i++) {
        for (let j = i + 1; j < entitiesInSentence.length; j++) {
          relationships.push({
            source: entitiesInSentence[i].name,
            target: entitiesInSentence[j].name,
            type: 'CO_OCCURS_WITH',
            confidence: 0.4,
            context: sentence.trim(),
            extractionMethod: 'cooccurrence'
          });
        }
      }
    });

    return relationships;
  }

  extractSemanticRelationships(text) {
    const relationships = [];
    
    try {
      // Use compromise.js for semantic analysis
      const doc = compromise(text);
      
      // Extract subject-verb-object relationships
      const sentences = doc.sentences().out('array');
      
      sentences.forEach(sentence => {
        const sentenceDoc = compromise(sentence);
        
        // Find subjects and objects
        const subjects = sentenceDoc.match('#Noun').out('array');
        const verbs = sentenceDoc.verbs().out('array');
        const objects = sentenceDoc.match('#Noun').out('array');
        
        if (subjects.length > 0 && verbs.length > 0 && objects.length > 0) {
          subjects.forEach(subject => {
            objects.forEach(object => {
              if (subject !== object) {
                verbs.forEach(verb => {
                  relationships.push({
                    source: subject,
                    target: object,
                    type: this.verbToRelationType(verb),
                    confidence: 0.6,
                    context: sentence,
                    extractionMethod: 'semantic'
                  });
                });
              }
            });
          });
        }
      });
    } catch (error) {
      logger.warn('Error in semantic relationship extraction:', error);
    }

    return relationships;
  }

  verbToRelationType(verb) {
    const verbMap = {
      'create': 'CREATES',
      'make': 'CREATES',
      'build': 'CREATES',
      'develop': 'DEVELOPS',
      'use': 'USES',
      'utilize': 'USES',
      'manage': 'MANAGES',
      'control': 'CONTROLS',
      'own': 'OWNS',
      'have': 'HAS',
      'contain': 'CONTAINS',
      'include': 'INCLUDES',
      'send': 'SENDS',
      'receive': 'RECEIVES',
      'connect': 'CONNECTS_TO',
      'link': 'LINKS_TO',
      'relate': 'RELATES_TO',
      'associate': 'ASSOCIATES_WITH'
    };

    const lowerVerb = verb.toLowerCase();
    return verbMap[lowerVerb] || 'RELATES_TO';
  }

  getRelationshipContext(text, startIndex, length, contextWindow = 100) {
    const start = Math.max(0, startIndex - contextWindow);
    const end = Math.min(text.length, startIndex + length + contextWindow);
    
    return text.substring(start, end).trim();
  }

  deduplicateRelationships(relationships) {
    const seen = new Map();
    const unique = [];

    relationships.forEach(relationship => {
      const key = `${relationship.source.toLowerCase()}_${relationship.type}_${relationship.target.toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.set(key, relationship);
        unique.push(relationship);
      } else {
        // Keep the relationship with higher confidence
        const existing = seen.get(key);
        if (relationship.confidence > existing.confidence) {
          const index = unique.indexOf(existing);
          unique[index] = relationship;
          seen.set(key, relationship);
        }
      }
    });

    return unique;
  }

  // Extract domain-specific relationships
  extractDomainRelationships(text, domain, entities = []) {
    switch (domain) {
      case 'software':
        return this.extractSoftwareRelationships(text, entities);
      case 'business':
        return this.extractBusinessRelationships(text, entities);
      case 'academic':
        return this.extractAcademicRelationships(text, entities);
      default:
        return this.extractRelationships(text, entities);
    }
  }

  extractSoftwareRelationships(text, entities) {
    const relationships = [];
    
    // API relationships
    const apiPattern = /(\w+)\s+API\s+(calls?|invokes?|requests?)\s+(\w+)/gi;
    let match;
    while ((match = apiPattern.exec(text)) !== null) {
      relationships.push({
        source: match[1],
        target: match[3],
        type: 'API_CALL',
        confidence: 0.8,
        context: this.getRelationshipContext(text, match.index, match[0].length)
      });
    }

    // Dependency relationships
    const depPattern = /(\w+)\s+(depends on|requires|needs)\s+(\w+)/gi;
    while ((match = depPattern.exec(text)) !== null) {
      relationships.push({
        source: match[1],
        target: match[3],
        type: 'DEPENDS_ON',
        confidence: 0.8,
        context: this.getRelationshipContext(text, match.index, match[0].length)
      });
    }

    return relationships;
  }

  extractBusinessRelationships(text, entities) {
    const relationships = [];
    
    // Partnership relationships
    const partnerPattern = /(\w+)\s+(partners with|collaborates with)\s+(\w+)/gi;
    let match;
    while ((match = partnerPattern.exec(text)) !== null) {
      relationships.push({
        source: match[1],
        target: match[3],
        type: 'PARTNERS_WITH',
        confidence: 0.8,
        context: this.getRelationshipContext(text, match.index, match[0].length)
      });
    }

    return relationships;
  }

  extractAcademicRelationships(text, entities) {
    const relationships = [];
    
    // Citation relationships
    const citePattern = /(\w+)\s+(cites?|references?)\s+(\w+)/gi;
    let match;
    while ((match = citePattern.exec(text)) !== null) {
      relationships.push({
        source: match[1],
        target: match[3],
        type: 'CITES',
        confidence: 0.8,
        context: this.getRelationshipContext(text, match.index, match[0].length)
      });
    }

    return relationships;
  }
}

// Export singleton instance
const extractor = new RelationshipExtractor();

module.exports = {
  extractRelationships: (text, entities, domain) => extractor.extractRelationships(text, entities, domain),
  RelationshipExtractor
};
