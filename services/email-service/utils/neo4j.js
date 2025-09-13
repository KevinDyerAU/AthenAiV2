const neo4j = require('neo4j-driver');
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
    new winston.transports.File({ filename: 'logs/neo4j.log' }),
    new winston.transports.Console()
  ]
});

let driver = null;

function createNeo4jDriver() {
  if (driver) {
    return driver;
  }

  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    throw new Error('Missing Neo4j configuration. Please set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD environment variables.');
  }

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
      disableLosslessIntegers: true
    });

    logger.info('Neo4j driver initialized successfully');
    return driver;
  } catch (error) {
    logger.error('Failed to initialize Neo4j driver:', error);
    throw error;
  }
}

// Knowledge graph operations for email processing
class EmailKnowledgeGraph {
  constructor() {
    this.driver = createNeo4jDriver();
  }

  async createEmailNode(emailData) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        CREATE (e:Email {
          id: $id,
          gmail_id: $gmail_id,
          subject: $subject,
          from_address: $from_address,
          to_address: $to_address,
          received_at: datetime($received_at),
          created_at: datetime()
        })
        RETURN e
        `,
        {
          id: emailData.id,
          gmail_id: emailData.gmail_id,
          subject: emailData.subject,
          from_address: emailData.from_address,
          to_address: emailData.to_address,
          received_at: emailData.received_at
        }
      );

      logger.info(`Email node created in Neo4j: ${emailData.id}`);
      return result.records[0]?.get('e').properties;
    } catch (error) {
      logger.error('Error creating email node:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createContactNode(contactData) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MERGE (c:Contact {email_address: $email_address})
        SET c.full_name = $full_name,
            c.company = $company,
            c.role = $role,
            c.updated_at = datetime()
        ON CREATE SET c.created_at = datetime()
        RETURN c
        `,
        {
          email_address: contactData.email_address,
          full_name: contactData.full_name,
          company: contactData.company,
          role: contactData.role
        }
      );

      logger.info(`Contact node created/updated in Neo4j: ${contactData.email_address}`);
      return result.records[0]?.get('c').properties;
    } catch (error) {
      logger.error('Error creating contact node:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async linkEmailToContact(emailId, contactEmail, relationship = 'SENT_BY') {
    const session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (e:Email {id: $emailId})
        MATCH (c:Contact {email_address: $contactEmail})
        MERGE (e)-[r:${relationship}]->(c)
        SET r.created_at = datetime()
        `,
        { emailId, contactEmail }
      );

      logger.info(`Email linked to contact: ${emailId} -> ${contactEmail}`);
    } catch (error) {
      logger.error('Error linking email to contact:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async findRelatedEmails(contactEmail, limit = 10) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (c:Contact {email_address: $contactEmail})-[:SENT_BY|RECEIVED_BY]-(e:Email)
        RETURN e
        ORDER BY e.received_at DESC
        LIMIT $limit
        `,
        { contactEmail, limit }
      );

      const emails = result.records.map(record => record.get('e').properties);
      logger.info(`Found ${emails.length} related emails for contact: ${contactEmail}`);
      return emails;
    } catch (error) {
      logger.error('Error finding related emails:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createKnowledgeEntity(entityData) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        CREATE (k:KnowledgeEntity {
          id: $id,
          content: $content,
          entity_type: $entity_type,
          source_type: $source_type,
          created_at: datetime()
        })
        RETURN k
        `,
        {
          id: entityData.id,
          content: entityData.content,
          entity_type: entityData.entity_type,
          source_type: entityData.source_type
        }
      );

      logger.info(`Knowledge entity created in Neo4j: ${entityData.id}`);
      return result.records[0]?.get('k').properties;
    } catch (error) {
      logger.error('Error creating knowledge entity:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async linkEmailToKnowledge(emailId, knowledgeId) {
    const session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (e:Email {id: $emailId})
        MATCH (k:KnowledgeEntity {id: $knowledgeId})
        MERGE (e)-[r:CONTAINS_KNOWLEDGE]->(k)
        SET r.created_at = datetime()
        `,
        { emailId, knowledgeId }
      );

      logger.info(`Email linked to knowledge entity: ${emailId} -> ${knowledgeId}`);
    } catch (error) {
      logger.error('Error linking email to knowledge:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async close() {
    if (this.driver) {
      await this.driver.close();
      logger.info('Neo4j driver closed');
    }
  }
}

module.exports = {
  createNeo4jDriver,
  EmailKnowledgeGraph
};
