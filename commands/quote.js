'use strict';

/**
 * commands/quote.js — inspirational quote of the day.
 */

const NAME = 'quote';
const ALIASES = ['q', 'inspire'];
const DESC = 'Get an inspirational quote';

const QUOTES = [
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['Success is not final, failure is not fatal: it is the courage to continue that counts.', 'Winston Churchill'],
  ['Believe you can and you\'re halfway there.', 'Theodore Roosevelt'],
  ['The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt'],
  ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese Proverb'],
  ['Your limitation—it\'s only your imagination.', 'Unknown'],
  ['Push yourself, because no one else is going to do it for you.', 'Unknown'],
  ['Great things never come from comfort zones.', 'Unknown'],
  ['Dream it. Wish it. Do it.', 'Unknown'],
  ['Success doesn\'t just find you. You have to go out and get it.', 'Unknown'],
  ['The harder you work for something, the greater you\'ll feel when you achieve it.', 'Unknown'],
  ['Don\'t stop when you\'re tired. Stop when you\'re done.', 'Unknown'],
  ['Wake up with determination. Go to bed with satisfaction.', 'Unknown'],
  ['Do something today that your future self will thank you for.', 'Sean Patrick Flanery'],
];

async function run({ sock, jid }) {
  const [text, author] = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  await sock.sendMessage(jid, {
    text: `💡 *Quote of the moment:*\n\n"${text}"\n\n— ${author}`,
  });
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
