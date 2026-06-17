import fs from 'fs';

const filePath = 'c:\\Users\\ajaishanth\\Downloads\\remix_-untitled\\src\\components\\ChessGame.tsx';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log('Searching for capturedPieces:');
lines.forEach((line, idx) => {
  if (line.includes('capturedPieces')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
