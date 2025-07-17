// server/cli/cli.js
// Entry-point: in đây chỉ chứa menu và điều hướng sang 2 flow

const readline       = require('readline');
const { runAuthorFlow } = require('./authorCli');
const { runFilterFlow } = require('./filterCli');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function mainMenu() {
  console.clear();
  console.log('┌────────────────────────────────────────────────────────────────┐');
  console.log('│                   CLI Academic Talent Finder                   │');
  console.log('├────────────────────────────────────────────────────────────────┤');
  console.log('│ 1) Search & Save Author to DB                                  │');
  console.log('│ 2) Multi-Filter Search Profiles                                │');
  console.log('│ q) Quit                                                        │');
  console.log('└────────────────────────────────────────────────────────────────┘');
  rl.question('Select an option: ', opt => {
    switch (opt.trim()) {
      case '1':
        runAuthorFlow(rl, mainMenu);
        break;
      case '2':
        runFilterFlow(rl, mainMenu);
        break;
      case 'q':
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      default:
        mainMenu();
    }
  });
}

// Kick things off
mainMenu();
