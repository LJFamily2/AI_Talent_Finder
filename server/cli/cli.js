//==================================================================
// CLI Main Entry Point
// Provides a simple terminal interface to run author search or filter search
//==================================================================

const readline = require('readline');
const { runAuthorFlow } = require('./authorCli');
const { runFilterFlow } = require('./filterCli');

//==================================================================
// Initialize Readline Interface
//==================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

//==================================================================
// CLI Main Menu Loop
// - Option 1: Author search and save
// - Option 2: Multi-filter search (by topic, country, metrics...)
// - Option 3: Quit the CLI program
//==================================================================

function mainMenu() {
  console.clear();
  console.log('┌────────────────────────────────────────────────────────────────┐');
  console.log('│       TEAM FRIENDS - CLI Build For Academic Talent Finder      │');
  console.log('├────────────────────────────────────────────────────────────────┤');
  console.log('│ 1) Search & Save Author to DB                                  │');
  console.log('│ 2) Multi-Filter Search Profiles                                │');
  console.log('│ 3) Quit                                                        │');
  console.log('└────────────────────────────────────────────────────────────────┘');

  rl.question('Select an option: ', opt => {
    switch (opt.trim()) {
      case '1':
        runAuthorFlow(rl, mainMenu);
        break;
      case '2':
        runFilterFlow(rl, mainMenu);
        break;
      case '3':
        console.log('👋 Goodbye!');
        rl.close();
        process.exit(0);
      default:
        mainMenu();
    }
  });
}

//==================================================================
// Start the CLI application
//==================================================================

mainMenu();
