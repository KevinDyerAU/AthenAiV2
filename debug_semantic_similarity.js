// Debug script to test semantic similarity matching
const { SemanticSimilarity } = require('./src/utils/semanticSimilarity');

// Test exact same phrases
const testPhrase = "analyze sales data for Q3 performance";
const exactSame = "analyze sales data for Q3 performance";

console.log('Testing exact same phrases:');
console.log('Phrase 1:', testPhrase);
console.log('Phrase 2:', exactSame);

const result = SemanticSimilarity.calculateSimilarity(testPhrase, exactSame, 0.75);
console.log('Similarity result:', result);

// Test normalized text
console.log('\nNormalized texts:');
console.log('Normalized 1:', SemanticSimilarity.normalizeText(testPhrase));
console.log('Normalized 2:', SemanticSimilarity.normalizeText(exactSame));

// Test individual metrics
const norm1 = SemanticSimilarity.normalizeText(testPhrase);
const norm2 = SemanticSimilarity.normalizeText(exactSame);

console.log('\nIndividual metrics:');
console.log('Jaccard:', SemanticSimilarity.jaccardSimilarity(norm1, norm2));
console.log('Cosine:', SemanticSimilarity.cosineSimilarity(norm1, norm2));
console.log('Levenshtein:', SemanticSimilarity.levenshteinSimilarity(norm1, norm2));

// Test with slight variations
const variations = [
  "analyze sales data for Q3 performance",
  "Analyze sales data for Q3 performance",
  "analyze sales data for Q3 performance.",
  "Analyze sales data for Q3 performance!",
  "analyze  sales  data  for  Q3  performance"
];

console.log('\nTesting variations:');
variations.forEach((variation, index) => {
  const result = SemanticSimilarity.calculateSimilarity(testPhrase, variation, 0.75);
  console.log(`Variation ${index + 1}: "${variation}" -> Similarity: ${result.similarity}, Match: ${result.isMatch}`);
});

// Test findBestMatch function
const mockCachedResults = [
  { original_query: "analyze sales data for Q3 performance", research_results: "cached result 1" },
  { original_query: "review financial metrics", research_results: "cached result 2" },
  { original_query: "analyze sales data for Q3", research_results: "cached result 3" }
];

console.log('\nTesting findBestMatch:');
const bestMatch = SemanticSimilarity.findBestMatch(testPhrase, mockCachedResults, 'original_query', 0.75);
console.log('Best match:', bestMatch);
