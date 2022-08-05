const chalk = require('chalk');
const cliSpinners = require('cli-spinners');

function log(data, opts = `s`) {
   let styles = {
	'p' : chalk.bgHex('#4F44E0').bold, //primary
	's' :  chalk.reset, //secondary
	'e' : chalk.bgHex('#E34F2F').bold, //error
	'i' : chalk.inverse //cray
   }
	
    console.log(styles[opts](data))
	console.log(cliSpinners.random)
}


module.exports = { log }