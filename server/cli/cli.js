// cli.js — Main menu
require('dotenv').config();
const inquirer = require('inquirer');
const { runFilterFlow } = require('./filterCli');
const { BASE_URL } = require('./api.cli');

async function mainMenu() {
  console.log('\n=== AI Talent Finder — CLI ===\n');

  while (true) {
    const ans = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Chọn chức năng:',
        choices: [
          { name: '🔍 Multi-Filter Search', value: 'filters' },
          { name: '🚪 Exit', value: 'exit' }
        ]
      }
    ]);

    if (ans.action === 'exit') {
      process.exit(0);
    }

    if (ans.action === 'filters') {
      const next = await runFilterFlow();
      if (next === 'home') continue;
      if (next === 'back') continue; // quay lại hỏi filter
    }
  }
}

mainMenu().catch(err => {
  console.error(err);
  process.exit(1);
});
