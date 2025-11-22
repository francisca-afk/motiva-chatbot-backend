const natural = require('natural');
const { SentimentAnalyzer, PorterStemmer } = natural;

const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');

exports.analyzeSentiment = (message) => {
  const tokens = new natural.WordTokenizer().tokenize(message.toLowerCase());
  const score = analyzer.getSentiment(tokens);
  
  // Score range: -5 to 5
  // Negative < -1 = very negative/frustrated
  let detectedMood;
  if (score < -2) detectedMood = 'very-negative';
  else if (score < -0.5) detectedMood = 'negative';
  else if (score > 2) detectedMood = 'very-positive';
  else if (score > 0.5) detectedMood = 'positive';
  else detectedMood = 'neutral';
  
  return {
    score,
    detectedMood,
    isLowMood: score < -1
  };
};