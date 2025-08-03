//==================================================================
// CLI Main Entry Point
// Provides a simple terminal interface to run author search or search-filters search
//==================================================================

const inquirer = require('inquirer');
const { runAuthorFlow } = require('./authorCli');
const { runFilterFlow } = require('./filterCli');

//-------------------------------
// Main Menu Loop
//-------------------------------
async function mainMenu() {
  while (true) {
    console.clear();
    const { action } = await inquirer.prompt([{ 
      type: 'list',
      name: 'action',
      message: 'Select an option:',
      choices: [
        { name: '👤 Search Authors',         value: 'author' },
        { name: '🔍 Multi-Filter Search',    value: 'filter' },
        { name: '🚪 Quit',                   value: 'quit' }
      ]
    }]);

    switch (action) {
      case 'author':
        // Run author search flow, then return here
        await runAuthorFlow(mainMenu);
        break;
      case 'filter':
        // Run search-filter search flow, then return here
        await runFilterFlow(mainMenu);
        break;
      case 'quit':
        console.log('👋 Goodbye!');
        process.exit(0);
      default:
        break;
    }
  }
}

//-------------------------------
// Start the CLI Application
//-------------------------------
mainMenu();