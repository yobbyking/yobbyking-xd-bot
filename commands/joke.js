'use strict';

/**
 * commands/joke.js — random joke.
 */

const NAME = 'joke';
const ALIASES = ['jokes'];
const DESC = 'Get a random joke';

const JOKES = [
  'Why don\'t programmers like nature? It has too many bugs. 🐛',
  'I told my computer I needed a break, and it said "No problem, I\'ll go to sleep." 💤',
  'Why do Java developers wear glasses? Because they don\'t C#. 👓',
  'A SQL query walks into a bar, walks up to two tables and asks: "Can I join you?" 🍻',
  'What do you call a fake noodle? An impasta. 🍝',
  'Why did the scarecrow win an award? Because he was outstanding in his field. 🌾',
  'I would tell you a UDP joke, but you might not get it. 📡',
  'There are 10 types of people: those who understand binary and those who don\'t. 🤓',
  'Why was the math book sad? It had too many problems. 📚',
  'What did the grape say when it got stepped on? Nothing, it just let out a little wine. 🍇',
  'How do you organize a space party? You planet. 🪐',
  'I\'m reading a book about anti-gravity. It\'s impossible to put down. 📖',
  'What do you call a fish wearing a crown? Your majesty. 👑🐟',
  'Why don\'t skeletons fight each other? They don\'t have the guts. 💀',
  'I told my wife she was drawing her eyebrows too high. She looked surprised. 😮',
];

async function run({ sock, jid }) {
  const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
  await sock.sendMessage(jid, { text: `🎭 *Joke:*\n\n${joke}` });
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
